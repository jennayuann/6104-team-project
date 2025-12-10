* **concept**: MultiSourceNetwork [Owner, Node, Source]
* **purpose**: Allow an owner to maintain and explore a single unified network of nodes and connections that may originate from multiple independent sources.
* **principle**: Each canonical Node is stored once globally. An owner’s unified graph is the combination of `Memberships` (which record which source(s) brought a node into the owner’s network) and owner-scoped `Edges` (each attributed to a Source). When a contributing Source removes its data, the owner’s network reflects those removals automatically.

* **state**:
    * a set of `Networks` with
        * `_id` Owner
        * `owner` Owner
        * `root?` Node
        * `createdAt?` Date
        * `updatedAt?` Date
    * a set of `Memberships` with
        * `_id` String
        * `owner` Owner
        * `node` Node
        * `sources` Record<Source, true>
        * `label?` String
        * `createdAt?` Date
        * `updatedAt?` Date
    * a set of `Edges` with
        * `_id` String
        * `owner` Owner
        * `from` Node
        * `to` Node
        * `source` Source
        * `weight?` Number
        * `createdAt?` Date
        * `updatedAt?` Date
    * a set of `Nodes` with
        * `_id` String
        * `sourceIds?` Record<string, string>
        * `label?` String
        * `firstName?` String
        * `lastName?` String
        * `headline?` String
        * `profileUrl?` String
        * `avatarUrl?` String
        * `location?` String
        * `industry?` String
        * `currentPosition?` String
        * `currentCompany?` String
        * `profilePictureUrl?` String
        * `summary?` String
        * `skills?` String[]
        * `education?` Array<{ school?: string; degree?: string; fieldOfStudy?: string; startYear?: number; endYear?: number; }>
        * `experience?` Array<{ title?: string; company?: string; startDate?: string; endDate?: string; description?: string; }>
        * `tags?` String[]
        * `createdAt` Date
        * `updatedAt?` Date

* **actions**:

    * `createNetwork (owner: Owner, root: Node?): { network?: Owner, error?: String }`
        * **requires**:
            * No `Networks` entry exists for `owner`.
        * **effects**:
            * Creates a new `Networks` entry for the owner with optional `root`.
            * If `root` is omitted, defaults to `owner`.
            * Ensures the owner has a `Memberships` entry for `(owner, owner)` and adds the `self` source to that membership. This guarantees the owner appears as a node in their network.

    * `setRootNode (owner: Owner, root: Node): Empty | { error: String }`
        * **requires**:
            * A `Networks` entry exists for `owner`.
            * A `Memberships` entry exists for `(owner, root)`.
        * **effects**:
            * Sets the `root` field for the owner’s network.

    * `addNodeToNetwork (owner: Owner, node?: Node, source: Source, nodeMeta?: Partial<NodeDoc>): { node?: ID, error?: String }`
        * **requires**: none.
        * **effects**:
            * Upserts a `Memberships` entry for `(owner, node)`; adds the `source` to the membership's `sources` map. Ensures canonical `Node` exists (create or reuse via `sourceIds`).
            * Supports creating a canonical node by passing `nodeMeta` instead of `node`. When `nodeMeta` is supplied, a canonical node is created (via `createNodeForUser`) and the returned node id is added to membership.

    * `updateNode (node: Node, meta?: Partial<NodeDoc>, updater: Owner): { node?: ID, error?: String }`
        * **requires**: `node` to exist, `updater` to be the owner of the node
        * **effects**:
            * Updates given `node` based on new `meta` data.

    * `removeNodeFromNetwork (owner: Owner, node: Node, source?: Source): Empty | { error: String }`
        * **requires**:
            * A `Memberships` entry exists for `(owner, node)`.
        * **effects**:
            * If `source` provided: remove `source` from membership `sources`. If `sources` becomes empty: delete the `Memberships` entry and delete all `Edges` for the owner where `from==node OR to==node`.
            * If `source` omitted: delete the `Memberships` entry and delete all owner `Edges` touching the node.

    * `searchNodes ({ owner: Owner, query?: String, limit?: Number, offset?: Number }): { results: Array<Record<string, unknown>>, total: Number }`
        * **requires**: `owner` to exist
        * **effects**:
            * Returns nodes that match query, limited to `limit` results, with offset `offset` (how many "pages").

    * `getNodes ({ ids: String[], owner?: Owner }): Array<NodeDoc & { membershipSources?: Record<string, true> }>`
        * **requires**: `id` to exist as a node id
        * **effects**:
            * Returns array of node information based on ids provided.

    * `addEdge ({ owner: Owner, from: Node, to: Node, source: Source, weight?: Number }): Empty | { error: String }`
        * **requires**:
            * `from != to`.
        * **effects**:
            * Upserts an `Edges` entry for `(owner, from, to, source)` and sets/updates `weight`.

    * `removeEdge ({ owner: Owner, from: Node, to: Node, source: Source }): Empty | { error: String }`
            * `_getAdjacencyArray ({ owner: Owner }): Record<string, Array<{ to: Node, source: Source, weight?: Number }>>`
                * **effects**:
                    * Returns the adjacency mapping for the owner's network, including node labels.
        * **requires**:
            * An `Edges` entry exists for `(owner, from, to, source)`.
        * **effects**:
            * Removes the specified edge.

    * `removeEdge (owner: Owner, from: Node, to: Node, source: Source): Empty`
        * **requires**:
            * An `Edges` entry exists for `(owner, from, to, source)`.
        * **effects**:
            * Removes the specified edge.

    * `setRootNode` and `addEdge` assume the caller enforces authorization (owner or sync acting on behalf of owner); `updateNode` operations should require membership-based authorization.

    * `createNodeForUser ({ owner, firstName?: String, lastName?: String, label?: String, headline?: String, profileUrl?: String, avatarUrl?: String, tags?: String[], sourceIds?: Record<string, string>, location?: String, industry?: String, currentPosition?: String, currentCompany?: String, profilePictureUrl?: String, summary?: String, skills?: String[], education?: Array, experience?: Array, skipMembership?: Boolean }): { node?: ID, error?: String }`
        * **requires**: either `firstName+lastName` or `label` (a display name) so a canonical label can be derived.
        * **effects**:
            * Inserts a `Nodes` document (with `sourceIds` if provided) and a `Memberships` entry for `(owner, node)` with the source set to `user` (or the internal caller tag). Returns the new canonical node id.

    * `addOrMigrateNodeFromSource ({ owner: Owner, legacyNodeId?: Node, source: Source, nodeMeta?: Partial<NodeDoc>, externalId?: String }): { node: ID }`
        * **notes**:
            * Memberships' `sources` is a map of sourceId to true, not metadata.
            * Node creation via `addNodeToNetwork` supports passing `nodeMeta` for canonical node creation.
            * `addEdge` upserts by owner/from/to, not owner/from/to/source.
            * `getNodes` can return membership sources if owner is provided.
            * `searchNodes` supports searching label, headline, tags, firstName, lastName.
            * `createNodeForUser` requires firstName and lastName or a label, and supports many profile fields.
            * `addOrMigrateNodeFromSource` normalizes source names and migrates legacy memberships.
            * `updateNode` requires membership-based authorization.
            * All methods return error objects as appropriate.
        * **requires**: `owner` to exist and be provided, `source` to be provided
        * **effects**: creates `{ node }` with the canonical node id.

* **notes**:
    * metadata for nodes vary from implementation to implementation, depending on what the network represents.
    * The concept is multi-source because each node or edge may be contributed by one or more independent sources (e.g., multiple platforms).
    * This supports combining, removing, and updating source-specific network data without affecting other sources.
    * `Networks` represents the owner’s unified network workspace and stores per-owner configuration such as the chosen `root` node.
    * `Memberships` records which nodes appear in the owner’s unified network and tracks which sources contributed each node.
    * `searchNodes` is scoped to nodes that the owner has a membership for and (by implementation) only performs substring searches on `firstName` and `lastName` (case-insensitive). The UI should rely on the membership filter to control visibility.
    * Edge creation from imports is best-effort: the flow ensures membership exists and upserts the owner->node edge, but a failure to create the edge should not fail the overall import/sync operation.
