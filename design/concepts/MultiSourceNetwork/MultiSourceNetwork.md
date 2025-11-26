* **concept**: MultiSourceNetwork [Owner, Node, Source]
* **purpose**: Allow an owner to maintain and explore a single unified network of nodes and connections that may originate from multiple independent sources.
* **principle**: Each canonical Node is stored once globally. An owner’s unified graph is the combination of `Memberships` (which record which source(s) brought a node into the owner’s network) and owner-scoped `Edges` (each attributed to a Source). When a contributing Source removes its data, the owner’s network reflects those removals automatically.

* **state**:
    * a set of `Networks` with
        * `_id` String
        * `owner` Owner
        * `root?` Node
        * `createdAt?` String
        * `updatedAt?` String
    * a set of `Memberships` with
        * `_id` String
        * `owner` Owner
        * `node` Node
        * `sources` JSON (map of sourceId -> metadata)
        * `createdAt?` String
        * `updatedAt?` String
    * a set of `Edges` with
        * `_id` String
        * `owner` Owner
        * `from` Node
        * `to` Node
        * `source` Source
        * `weight?` Number
        * `createdAt?` String
        * `updatedAt?` String
    * a set of `Nodes` with
        * `_id` String
        * `sourceIds?` JSON
        * `label?` String
        * `firstName?` String
        * `lastName?` String
        * `headline?` String
        * `profileUrl?` String
        * `avatarUrl?` String
        * `tags?` String
        * `createdAt?` String
        * `updatedAt?` String

* **actions**:

    * `createNetwork (owner: Owner, root: Node?): Empty`
        * **requires**:
            * No `Networks` entry exists for `owner`.
        * **effects**:
            * Creates a new `Networks` entry for the owner with optional `root`.

    * `setRootNode (owner: Owner, root: Node): Empty`
        * **requires**:
            * A `Networks` entry exists for `owner`.
            * A `Memberships` entry exists for `(owner, root)`.
        * **effects**:
            * Sets the `root` field for the owner’s network.

    * `addNodeToNetwork (owner: Owner, node: Node, source: Source): Empty`
        * **requires**: none.
        * **effects**:
            * Upserts a `Memberships` entry for `(owner, node)`; adds the `source` to the membership's `sources` map. Ensures canonical `Node` exists (create or reuse via `sourceIds`).

    * `removeNodeFromNetwork (owner: Owner, node: Node, source: Source?): Empty`
        * **requires**:
            * A `Memberships` entry exists for `(owner, node)`.
        * **effects**:
            * If `source` provided: remove `source` from membership `sources`. If `sources` becomes empty: delete the `Memberships` entry and delete all `Edges` for the owner where `from==node OR to==node`.
            * If `source` omitted: delete the `Memberships` entry and delete all owner `Edges` touching the node.

    * `addEdge (owner: Owner, from: Node, to: Node, source: Source, weight: Number?): Empty`
        * **requires**:
            * `from != to`.
        * **effects**:
            * Upserts an `Edges` entry for `(owner, from, to, source)` and sets/updates `weight`.

    * `removeEdge (owner: Owner, from: Node, to: Node, source: Source): Empty`
        * **requires**:
            * An `Edges` entry exists for `(owner, from, to, source)`.
        * **effects**:
            * Removes the specified edge.

    * `setRootNode` and `addEdge` assume the caller enforces authorization (owner or sync acting on behalf of owner); `updateNode` operations should require membership-based authorization.

* **notes**:
    * Use unique indexes and upserts for `Memberships` (`{ owner:1, node:1 }`) and `Edges` (`{ owner:1, from:1, to:1, source:1 }`) to avoid duplication under concurrency.
    * Prefer exact dedupe using `sourceIds` rather than name-only matching.
    * When a membership is removed because no sources remain, cascade-delete owner edges for that node so the owner’s unified graph reflects source deletions.
