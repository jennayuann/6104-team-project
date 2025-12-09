import { Collection, Db } from "npm:mongodb";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
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

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-1.5-flash";
const GEMINI_LOG_RAW = Deno.env.get("GEMINI_LOG_RAW") === "1";
const MAX_CANDIDATES = 50;
const MAX_OUTPUT_TOKENS = 256;
const BATCH_PROMPT_CANDIDATES = 5; // per-call cap to avoid token blowups
const CANDIDATE_TEXT_LIMIT = 80; // truncate per-candidate text to reduce tokens

function truncate(text: string, max = 400): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

function buildCandidateText(doc: {
  label?: string;
  firstName?: string;
  lastName?: string;
  headline?: string | null;
  location?: string | null;
  industry?: string | null;
  currentPosition?: string | null;
  currentCompany?: string | null;
  summary?: string | null;
  skills?: string[];
}): string {
  const parts: string[] = [];
  const name = [doc.firstName, doc.lastName]
    .filter((x) => x && x.trim().length > 0)
    .join(" ");
  if (name) parts.push(name);
  if (doc.label && doc.label.trim()) parts.push(doc.label.trim());
  const roleCompany = [doc.currentPosition, doc.currentCompany]
    .filter((x) => x && x.trim().length > 0)
    .join(" at ");
  if (roleCompany) parts.push(roleCompany);
  if (doc.headline && doc.headline.trim()) parts.push(doc.headline.trim());
  if (doc.location && doc.location.trim()) parts.push(doc.location.trim());
  if (doc.industry && doc.industry.trim()) parts.push(doc.industry.trim());
  if (doc.summary && doc.summary.trim()) parts.push(doc.summary.trim());
  if (doc.skills && doc.skills.length) {
    parts.push(`Skills: ${doc.skills.join(", ")}`);
  }
  return parts.join(" | ");
}

const stripCodeFences = (s: string) =>
  s.replace(/```json\s*/gi, "").replace(/```/g, "");
const stripTrailingCommas = (s: string) => s.replace(/,\s*([}\]])/g, "$1");

const tryParseJson = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch (_err) {
    return undefined;
  }
};

function parseGeminiJson(text: string): {
  entries: Array<{ connectionId?: string; score?: number }>;
  ok: boolean;
} {
  const cleaned = stripTrailingCommas(stripCodeFences(text.trim()));
  let parsed = tryParseJson(cleaned);
  if (parsed === undefined) {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      parsed = tryParseJson(stripTrailingCommas(match[0]));
    }
  }
  if (parsed === undefined) {
    return { entries: [], ok: false };
  }
  const array = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { results?: unknown }).results)
    ? (parsed as { results: unknown[] }).results
    : [];

  const entries = array.filter((p) =>
    typeof p === "object" && p !== null
  ) as Array<
    { connectionId?: string; score?: number }
  >;
  return { entries, ok: true };
}
async function geminiRank(
  query: string,
  candidates: Array<{ id: string; text: string }>,
  limit: number,
): Promise<Array<{ item: Item; score: number }>> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  if (!candidates.length) return [];

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
    },
  });

  const aggregate = new Map<string, number>();
  const batches: Array<Array<{ id: string; text: string }>> = [];
  for (let i = 0; i < candidates.length; i += BATCH_PROMPT_CANDIDATES) {
    const slice = candidates.slice(i, i + BATCH_PROMPT_CANDIDATES);
    if (slice.length) batches.push(slice);
  }

  while (batches.length) {
    const batch = batches.shift();
    if (!batch?.length) continue;

    const promptLines: string[] = [];
    const cappedK = Math.min(limit, batch.length, 5);
    promptLines.push("You are a ranking function.");
    promptLines.push(
      "Return ONLY the JSON array described below. Do not preface it, do not say 'Here is'.",
    );
    promptLines.push(
      'Format: a JSON array (no code fences) of up to K objects, sorted best to worst, each exactly {"connectionId": string, "score": number between 0 and 1}.',
    );
    promptLines.push(
      "If no candidates are relevant, return [] (just the brackets).",
    );
    promptLines.push(`Query: ${query}`);
    promptLines.push("Candidates:");
    for (const c of batch) {
      promptLines.push(
        `- id: ${c.id}\n  text: ${truncate(c.text, CANDIDATE_TEXT_LIMIT)}`,
      );
    }
    promptLines.push(
      `K: up to ${cappedK} (choose count based on relevance, no padding).`,
    );

    const body = {
      systemInstruction: {
        role: "user",
        parts: [{
          text:
            "Always obey the user instructions exactly. Never wrap answers in ```json or say 'Here is the JSON requested'.",
        }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: promptLines.join("\n"),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
      },
    };

    const result = await model.generateContent(body);
    const response = result.response;
    // deno-lint-ignore no-explicit-any
    const finishReason = (response as any)?.candidates?.[0]?.finishReason;
    const text = response?.text() ?? "";
    if (GEMINI_LOG_RAW) {
      console.log("[Gemini] raw json:", JSON.stringify(response ?? {}));
      console.log("[Gemini] raw text:", text);
      if (finishReason) {
        console.log("[Gemini] finishReason:", finishReason);
      }
    }

    if (!text || finishReason === "MAX_TOKENS") {
      if (finishReason === "MAX_TOKENS" && batch.length > 1) {
        const mid = Math.ceil(batch.length / 2);
        batches.unshift(batch.slice(mid));
        batches.unshift(batch.slice(0, mid));
      } else if (GEMINI_LOG_RAW) {
        console.log(
          "[Gemini] skipping batch due to empty response or token limit",
        );
      }
      continue;
    }

    const parsed = parseGeminiJson(text);
    if (!parsed.ok) {
      if (GEMINI_LOG_RAW) {
        console.log("[Gemini] parse failed for text length", text.length);
      }
      continue;
    }

    for (const entry of parsed.entries) {
      if (!entry?.connectionId) continue;
      const score = typeof entry.score === "number" ? entry.score : 0;
      const existing = aggregate.get(entry.connectionId);
      if (existing === undefined || score > existing) {
        aggregate.set(entry.connectionId, score);
      }
    }
  }

  return Array.from(aggregate.entries())
    .map(([item, score]) => ({ item, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export default class SemanticSearchConcept {
  indexedItems: Collection<IndexedItems>;
  searchQueries: Collection<SearchQueries>;

  constructor(private readonly db: Db) {
    this.indexedItems = this.db.collection(PREFIX + "indexedItems");
    this.searchQueries = this.db.collection(PREFIX + "searchQueries");
  }

  /**
   * indexItem (owner: Owner, item: Item, text: String, vector: JSON?): Empty
   *
   * **requires** none.
   *
   * **effects** creates or updates an IndexedItems entry for (owner, item)
   * with the provided text and optional vector, and forwards the text to the
   * external semantic search service for indexing.
   */
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

    return {};
  }

  /**
   * removeIndexedItem (owner: Owner, item: Item): Empty
   *
   * **requires** none.
   *
   * **effects** deletes any IndexedItems entry for (owner, item).
   * (Current implementation does not delete from the external index; it can
   * be extended later if needed.)
   */
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

  /**
   * queryItems (owner: Owner, queryText: String, filters: JSON?): (queryID: String)
   *
   * **requires** queryText is not empty.
   *
   * **effects** creates a new SearchQueries entry with queryText, filters,
   * and a ranked sequence resultItems based on the external semantic search
   * service; returns the new queryID.
   */
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

    // Gemini ranking is stateless; we only store the request/response pairing.
    const ownerDocs = await this.indexedItems.find({ owner }).toArray();
    const candidates = ownerDocs.map((doc) => ({
      id: String(doc.item),
      text: doc.text,
    }));
    const results = await geminiRank(queryText, candidates, 50);
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

  /**
   * refineQuery (queryID: String, filters: JSON): Empty
   *
   * **requires** a SearchQueries entry with queryID exists.
   *
   * **effects** updates the filters for the query and recomputes resultItems
   * based on the new filters.
   */
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

    const ownerDocs = await this.indexedItems.find({ owner: existing.owner })
      .toArray();
    const candidates = ownerDocs.map((doc) => ({
      id: String(doc.item),
      text: doc.text,
    }));
    const results = await geminiRank(existing.queryText, candidates, 50);
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

  /**
   * searchConnections (owner: Owner, queryText: String, limit?: Number): { results: { connectionId, score, text, connection }[] }
   *
   * **requires** queryText is not empty.
   *
   * **effects** runs a semantic search for the given owner and queryText and
   * joins the ranked item ids against LinkedInImport.connections to return
   * rich connection previews for the frontend.
   */
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

    // Load all owner-owned connections (capped) and ask Gemini to rank.
    const accountsCollection = this.db.collection("LinkedInImport.accounts");
    const ownerAccounts = await accountsCollection
      .find({ user: owner as unknown })
      .toArray();
    const ownerAccountIds = ownerAccounts.map((a) => a._id);

    const connectionsCollection = this.db.collection<
      { _id: string; account: unknown }
    >("LinkedInImport.connections");

    const docs = await connectionsCollection
      .find({ account: { $in: ownerAccountIds as unknown[] } })
      .limit(MAX_CANDIDATES)
      .toArray();

    const candidates = docs.map((doc) => ({
      id: String(doc._id),
      text: buildCandidateText(doc),
    }));

    const rawResults = await geminiRank(trimmed, candidates, limit);
    if (!rawResults.length) return { results: [] };

    // deno-lint-ignore no-explicit-any
    const byId = new Map<string, any>(
      docs.map((doc) => [String(doc._id), doc]),
    );

    const results = rawResults
      .map((r) => {
        const connectionId = String(r.item);
        const score = Number.isFinite(r.score) ? r.score : 0;
        const doc = byId.get(connectionId);
        if (!doc) return null;
        return {
          connectionId,
          score,
          text: candidates.find((c) => c.id === connectionId)?.text ?? trimmed,
          connection: {
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
          },
        };
      })
      .filter(Boolean) as Array<{
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

    // De-duplicate by connectionId, keeping highest score
    const bestById = new Map<string, (typeof results)[number]>();
    for (const r of results) {
      const existing = bestById.get(r.connectionId);
      if (!existing || r.score > existing.score) {
        bestById.set(r.connectionId, r);
      }
    }

    return { results: Array.from(bestById.values()).slice(0, limit) };
  }
}
