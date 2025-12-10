### concept: SemanticSearch

* **concept**: SemanticSearch [Owner, Item]
* **purpose**:
  Allow an owner to perform semantic, intent-based searches over their items and receive a ranked list of items most related to the query.
* **principle**:
  When an owner indexes items with descriptive text, and later issues a natural-language query, the concept produces a ranked set of items whose descriptions are most relevant. If the query is refined, the ranking adapts accordingly.

* **state**:
    * a set of `IndexedItems` with
        * `item` Item
        * `owner` Owner
        * `text` String
        * `vector` JSON?

    * a set of `SearchQueries` with
        * `queryID` String
        * `owner` Owner
        * `queryText` String
        * `filters` JSON?
        * `resultItems` Item[]

    *Implementation note*: every indexed item is also forwarded to an external semantic search service (txtai). When forwarding, each item is tagged with its `owner` so that later searches can be filtered to that owner’s corpus server-side.

* **actions**:

    * `indexItem (owner: Owner, item: Item, text: String, vector: JSON?): Empty`
        * **requires**:
            * None
        * **effects**:
            * Creates or updates an `IndexedItems` entry for `(owner, item)` with the provided text and optional vector.

    * `removeIndexedItem (owner: Owner, item: Item): Empty`
        * **requires**:
            * None
        * **effects**:
            * Deletes any `IndexedItems` entry for `(owner, item)` in the concept state (the external index is not yet pruned).

    * `queryItems (owner: Owner, queryText: String, filters: JSON?): (queryID: String)`
        * **requires**:
            * `queryText` is not empty.
        * **effects**:
            * Creates a new `SearchQueries` entry with
              `queryText`, `filters`, and a ranked sequence `resultItems`.
            * Returns the new `queryID`.

    * `refineQuery (queryID: String, filters: JSON): Empty`
        * **requires**:
            * A `SearchQueries` entry with `queryID` exists.
        * **effects**:
            * Updates the filters for the query.
            * Recomputes and replaces `resultItems` based on new filters.

    * `searchConnections (owner: Owner, queryText: String, limit?: Number): (results: [{ connectionId: Item, score: Number, text: String, connection?: JSON }])`
        * **requires**:
            * `queryText` is not empty.
        * **effects**:
            * Executes a semantic search for the owner with the given query text (limit defaults to 10) using the external service, filtering on the owner tag so only that user’s indexed items are considered.
            * Drops results below a minimum semantic score threshold (currently 0.25) to avoid surfacing irrelevant matches.
            * Interprets the returned item identifiers as LinkedIn connection ids, joins them with the `LinkedInImport.connections` state (scoped to accounts owned by the caller), and produces a list of rich connection previews (e.g., `_id`, `firstName`, `lastName`, `headline`, `location`, `currentPosition`, `currentCompany`, `profileUrl`, `profilePictureUrl`, `summary`) along with semantic scores and snippet text.
            * For results not backed by LinkedInImport.connections, falls back to matching MultiSourceNetwork nodes owned by the user.
            * Deduplicates results by `connectionId`, keeping the highest-scoring entry per id, and omits entries the owner does not have access to.
    * `reindexAllOwners (): Empty`
        * **requires**:
            * txtai semantic service is reachable.
        * **effects**:
            * For each distinct owner in IndexedItems, re-sends all of their indexed items to the external semantic search service. Useful when the txtai index has been lost or restarted while the MongoDB-backed metadata remains intact.

* **invariants**:
    * All `resultItems` in any query belong to the same owner's indexed items.

* **notes**:
    * `vector` is part of the state to consider support for vector-based semantic similarity.
    * The concept does not assume anything about how semantic similarity is computed.
    * The implementation enforces owner-level privacy by tagging every indexed document with its owner and passing `{ owner }` as the filter payload when querying txtai.
    * Indexing replays the owner’s entire corpus to the external service to keep its index in sync; removing an item only affects the internal store (external removal can be added later if needed).
    * Restarting the txtai service clears its in-memory index; when this happens, connections must be reindexed (e.g., by re-importing LinkedIn data or running the helper script `scripts/reindex_all_connections.ts`, or by calling the `reindexAllOwners` method, which rebuilds txtai from the current Mongo collections).

* **integration guidance**:
    * Start the txtai service with the provided `semantic_search_service/app.yml` so that POST `/add`, GET `/index`, and GET `/search` endpoints are available on `SEMANTIC_SERVICE_URL` (default `http://localhost:8001`).
    * Ensure `.env` includes `SEMANTIC_SERVICE_URL` for deployment environments where txtai is not running on localhost.
