import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";

const PREFIX = "SemanticSearch.";

type Owner = ID;
type Item = ID;

interface IndexedItems {
  _id: string; // document id: `${owner}:${item}`
  owner: Owner;
  item: Item;
  text: string;
  vector?: unknown; // reserved for future use
}

interface SearchQueries {
  _id: string; // queryID
  owner: Owner;
  queryText: string;
  filters?: unknown;
  resultItems: Item[];
}

const SEMANTIC_SERVICE_URL = Deno.env.get("SEMANTIC_SERVICE_URL") ??
  "http://localhost:8001";

async function semanticIndex(
  owner: Owner,
  items: Array<
    { item: Item; text: string; metadata?: Record<string, unknown> }
  >,
): Promise<void> {
  const payload = items.map((i) => ({
    id: `${owner}:${i.item}`,
    text: i.text,
    tags: { owner, ...(i.metadata ?? {}) },
  }));

  const addResponse = await fetch(`${SEMANTIC_SERVICE_URL}/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!addResponse.ok) {
    throw new Error(`txtai add failed: ${addResponse.status}`);
  }
  if (addResponse.body) {
    await addResponse.arrayBuffer();
  }

  const indexResponse = await fetch(`${SEMANTIC_SERVICE_URL}/index`, {
    method: "GET",
  });
  if (!indexResponse.ok) {
    throw new Error(`txtai index failed: ${indexResponse.status}`);
  }
  if (indexResponse.body) {
    await indexResponse.arrayBuffer();
  }
}

async function semanticSearch(
  owner: Owner,
  query: string,
  _filters: unknown,
  limit = 20,
): Promise<Array<{ item: Item; score: number }>> {
  const url = new URL(`${SEMANTIC_SERVICE_URL}/search`);
  url.searchParams.set("query", query);
  if (typeof limit === "number") {
    url.searchParams.set("limit", String(limit));
  }

  // Enforce owner-level privacy in txtai by filtering on tags.owner.
  url.searchParams.set("filters", JSON.stringify({ owner }));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`txtai search failed: ${response.status}`);
  }
  const data = await response.json();
  const results = Array.isArray(data) ? data : data.results ?? [];
  return results.map(
    (entry: { id?: string; document?: string; score?: number } | string) => {
      const id = typeof entry === "string"
        ? entry
        : entry.id ?? entry.document ?? "";
      const itemId = typeof id === "string"
        ? id.substring(id.lastIndexOf(":") + 1)
        : "";
      const score = typeof entry === "string" ? 0 : Number(entry.score ?? 0);
      return { item: itemId as Item, score };
    },
  );
}

export default class TxtaiSemanticSearchConcept {
  indexedItems: Collection<IndexedItems>;
  searchQueries: Collection<SearchQueries>;

  constructor(private readonly db: Db) {
    this.indexedItems = this.db.collection(PREFIX + "indexedItems");
    this.searchQueries = this.db.collection(PREFIX + "searchQueries");
  }

  async indexItem({
    owner,
    item,
    text,
    vector,
  }: {
    owner: Owner;
    item: Item;
    text: string;
    vector?: unknown;
  }): Promise<Empty> {
    const docId = `${owner}:${item}`;

    await this.indexedItems.updateOne(
      { _id: docId },
      {
        $set: {
          _id: docId,
          owner,
          item,
          text,
          vector,
        },
      },
      { upsert: true },
    );

    const ownerDocs = await this.indexedItems.find({ owner }).toArray();
    await semanticIndex(
      owner,
      ownerDocs.map((doc) => ({
        item: doc.item,
        text: doc.text,
      })),
    );

    return {};
  }

  async removeIndexedItem({
    owner,
    item,
  }: {
    owner: Owner;
    item: Item;
  }): Promise<Empty> {
    const docId = `${owner}:${item}`;
    await this.indexedItems.deleteOne({ _id: docId });
    return {};
  }

  async queryItems({
    owner,
    queryText,
    filters,
  }: {
    owner: Owner;
    queryText: string;
    filters?: unknown;
  }): Promise<{ queryID: string }> {
    if (!queryText || queryText.trim() === "") {
      return { queryID: "" };
    }

    const results = await semanticSearch(owner, queryText, filters ?? {}, 50);
    const resultItems = results.map((r) => r.item);

    const queryID = crypto.randomUUID();

    await this.searchQueries.insertOne({
      _id: queryID,
      owner,
      queryText,
      filters,
      resultItems,
    });

    return { queryID };
  }

  async refineQuery({
    queryID,
    filters,
  }: {
    queryID: string;
    filters: unknown;
  }): Promise<Empty> {
    const existing = await this.searchQueries.findOne({ _id: queryID });
    if (!existing) {
      return {};
    }

    const results = await semanticSearch(
      existing.owner,
      existing.queryText,
      filters ?? {},
      50,
    );
    const resultItems = results.map((r) => r.item);

    await this.searchQueries.updateOne(
      { _id: queryID },
      {
        $set: {
          filters,
          resultItems,
        },
      },
    );

    return {};
  }

  async searchConnections({
    owner,
    queryText,
    limit = 10,
  }: {
    owner: Owner;
    queryText: string;
    limit?: number;
  }): Promise<{
    results: Array<{
      connectionId: string;
      score: number;
      text: string;
      connection?: {
        _id: string;
        linkedInConnectionId?: string;
        firstName?: string;
        lastName?: string;
        headline?: string | null;
        location?: string | null;
        industry?: string | null;
        currentPosition?: string | null;
        currentCompany?: string | null;
        profileUrl?: string | null;
        profilePictureUrl?: string | null;
        summary?: string | null;
      };
    }>;
  }> {
    const trimmed = queryText.trim();
    if (!trimmed) {
      return { results: [] };
    }

    const rawResults = await semanticSearch(owner, trimmed, {}, limit);
    if (!rawResults.length) return { results: [] };

    const ids = rawResults
      .map((r) => String(r.item))
      .filter((id) =>
        id && !["FULLSTACK_ID", "BACKEND_ID", "ML_ID"].includes(id)
      );

    const connectionsCollection = this.db.collection<
      { _id: string; account: unknown }
    >(
      "LinkedInImport.connections",
    );
    const accountsCollection = this.db.collection(
      "LinkedInImport.accounts",
    );
    const ownerAccounts = await accountsCollection
      .find({ user: owner as unknown })
      .toArray();
    const ownerAccountIds = ownerAccounts.map((a) => a._id);

    const docs = await connectionsCollection
      .find({
        _id: { $in: ids as string[] },
        account: { $in: ownerAccountIds as unknown[] },
      })
      .toArray();

    // deno-lint-ignore no-explicit-any
    const byId = new Map<string, any>(
      docs.map((doc) => [String(doc._id), doc]),
    );

    const results = rawResults.map((r) => {
      const connectionId = String(r.item);
      const score = Number.isFinite(r.score) ? r.score : 0;
      const doc = byId.get(connectionId);

      const connection = doc
        ? {
          _id: String(doc._id),
          linkedInConnectionId: doc.linkedInConnectionId,
          firstName: doc.firstName,
          lastName: doc.lastName,
          headline: doc.headline ?? null,
          location: doc.location ?? null,
          industry: doc.industry ?? null,
          currentPosition: doc.currentPosition ?? null,
          currentCompany: doc.currentCompany ?? null,
          profileUrl: doc.profileUrl ?? null,
          profilePictureUrl: doc.profilePictureUrl ?? null,
          summary: doc.summary ?? null,
        }
        : undefined;

      const text = doc?.summary ? String(doc.summary) : trimmed;

      return { connectionId, score, text, connection };
    });

    const connected = results.filter((r) => r.connection);

    const bestById = new Map<string, (typeof connected)[number]>();
    for (const r of connected) {
      const existing = bestById.get(r.connectionId);
      if (!existing || r.score > existing.score) {
        bestById.set(r.connectionId, r);
      }
    }

    return { results: Array.from(bestById.values()) };
  }
}
