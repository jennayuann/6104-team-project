* **concept**: LLMDisambiguation [Node]
* **purpose**: Determine whether two nodes in a network represent the same real-world entity by comparing their associated information, enabling the system to detect duplicates and maintain accurate network representations.
* **principle**: When two nodes are compared, the system uses an LLM to analyze their associated information (names, locations, affiliations, etc.) and generates a similarity assessment. The user can then confirm or reject the assessment, and if confirmed, the nodes can be marked as representing the same entity, allowing downstream concepts to merge or link them appropriately.

* **state**:
    * a set of `Comparisons` with
        * `node1` Node
        * `node2` Node
        * `llmSimilarityScore` Number? (0.0 to 1.0, where 1.0 means definitely the same)
        * `llmReasoning` String?
        * `llmConfidence` String? (high, medium, low)
        * `userDecision` String? (same, different, pending)
        * `userConfirmedAt` Date?
        * `createdAt` Date
        * `node1Info` JSON? (snapshot of information available for node1 at comparison time)
        * `node2Info` JSON? (snapshot of information available for node2 at comparison time)
    * a set of `Merges` with
        * `node1` Node (the node that is merged into node2)
        * `node2` Node (the node that remains after merge)
        * `comparison` Comparison
        * `mergedAt` Date
        * `mergedBy` String? (system or user)

* **actions**:

    * `compareNodes (node1: Node, node2: Node, node1Info: JSON?, node2Info: JSON?): (comparison: Comparison)`
        * **requires**:
            * `node1 != node2`.
        * **effects**:
            * If a `Comparisons` entry exists for `(node1, node2)` or `(node2, node1)`, updates it; otherwise creates a new entry.
            * Uses LLM to analyze `node1Info` and `node2Info` (or fetches information if not provided).
            * Generates or updates `llmSimilarityScore`, `llmReasoning`, and `llmConfidence`.
            * Sets `userDecision` to "pending" (if updating an existing comparison with a decision, resets to "pending").
            * Updates `node1Info` and `node2Info` snapshots.
            * Returns the comparison ID.

    * `confirmComparison (comparison: Comparison, userDecision: String): Empty`
        * **requires**:
            * A `Comparisons` entry with the given `comparison` ID exists.
            * `userDecision` is one of: "same", "different".
            * The comparison's current `userDecision` is "pending".
        * **effects**:
            * Updates `userDecision` to the provided value.
            * Sets `userConfirmedAt` to the current date.

    * `mergeNodes (comparison: Comparison, keepNode: Node): (merge: Merge)`
        * **requires**:
            * A `Comparisons` entry with the given `comparison` ID exists.
            * `userDecision` is "same".
            * `keepNode` is either `node1` or `node2` from the comparison.
        * **effects**:
            * Creates a new `Merges` entry recording that the other node was merged into `keepNode`.
            * Sets `mergedBy` to "user".
            * Returns the merge ID.

    * `cancelComparison (comparison: Comparison): Empty`
        * **requires**:
            * A `Comparisons` entry with the given `comparison` ID exists.
            * `userDecision` is "pending".
        * **effects**:
            * Removes the `Comparisons` entry.

* **queries**:

    * `_getComparison (node1: Node, node2: Node): (comparison: Comparison)`
        * **requires**: true
        * **effects**: Returns the comparison for the given node pair (checks both orderings).

    * `_getComparisonsForNode (node: Node): (comparison: Comparison)`
        * **requires**: true
        * **effects**: Returns all comparisons involving the given node.

    * `_getPendingComparisons (): (comparison: Comparison)`
        * **requires**: true
        * **effects**: Returns all comparisons with `userDecision` of "pending".

    * `_getMergesForNode (node: Node): (merge: Merge)`
        * **requires**: true
        * **effects**: Returns all merges where the given node was either merged into another node or had another node merged into it.

    * `_getComparisonDetails (comparison: Comparison): (comparison: Comparison)`
        * **requires**: true
        * **effects**: Returns the full comparison details including LLM reasoning and node information snapshots.

* **notes**:
    * This concept is designed to work with any concept that manages nodes (such as MultiSourceNetwork). The `Node` type parameter is completely generic and polymorphic.
    * The concept does not perform the actual merging of nodes in other concepts; it only records that a merge should occur. Synchronizations with other concepts (like MultiSourceNetwork) should handle the actual node merging based on `Merges` entries.
    * The `node1Info` and `node2Info` parameters allow callers to provide structured information about nodes (e.g., names, locations, affiliations, etc.) for LLM analysis. If not provided, the concept may need to query other concepts via synchronizations to gather this information.
    * The LLM comparison uses semantic understanding to handle variations in names, abbreviations, and formatting that might indicate the same person.
    * User confirmation is essential for accuracy, as LLM assessments may have false positives or false negatives.
    * The concept maintains snapshots of node information at comparison time to ensure consistency even if node data changes later.
