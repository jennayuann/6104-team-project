import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";
import "jsr:@std/dotenv/load";

// Collection prefix to ensure namespace separation
const PREFIX = "LLMDisambiguation" + ".";

// Generic type for the concept's external dependencies
type Node = ID;

// Internal entity types, represented as IDs
type Comparison = ID;
type Merge = ID;

/**
 * State: A set of Comparisons tracking node disambiguation attempts.
 */
interface ComparisonDoc {
  _id: Comparison;
  node1: Node;
  node2: Node;
  llmSimilarityScore?: number; // 0.0 to 1.0, where 1.0 means definitely the same
  llmReasoning?: string;
  llmConfidence?: "high" | "medium" | "low";
  userDecision?: "same" | "different" | "pending";
  userConfirmedAt?: Date;
  createdAt: Date;
  node1Info?: Record<string, unknown>; // Snapshot of information available for node1 at comparison time
  node2Info?: Record<string, unknown>; // Snapshot of information available for node2 at comparison time
}

/**
 * State: A set of Merges recording node merge decisions.
 */
interface MergeDoc {
  _id: Merge;
  node1: Node; // The node that is merged into node2
  node2: Node; // The node that remains after merge
  comparison: Comparison;
  mergedAt: Date;
  mergedBy?: "system" | "user";
}

/**
 * @concept LLMDisambiguation
 * @purpose Determine whether two nodes in a network represent the same real-world entity by comparing their associated information, enabling the system to detect duplicates and maintain accurate network representations.
 * @principle When two nodes are compared, the system uses an LLM to analyze their associated information (names, locations, affiliations, etc.) and generates a similarity assessment. The user can then confirm or reject the assessment, and if confirmed, the nodes can be marked as representing the same entity, allowing downstream concepts to merge or link them appropriately.
 */
export default class LLMDisambiguationConcept {
  comparisons: Collection<ComparisonDoc>;
  merges: Collection<MergeDoc>;

  constructor(private readonly db: Db) {
    this.comparisons = this.db.collection(PREFIX + "comparisons");
    this.merges = this.db.collection(PREFIX + "merges");
  }

  /**
   * Action: Compares two nodes using LLM analysis.
   * compareNodes (node1: Node, node2: Node, node1Info: JSON?, node2Info: JSON?): (comparison: Comparison)
   *
   * **requires**:
   *   - node1 != node2.
   *
   * **effects**:
   *   - If a Comparisons entry exists for (node1, node2) or (node2, node1), updates it; otherwise creates a new entry.
   *   - Uses LLM to analyze node1Info and node2Info (or fetches information if not provided).
   *   - Generates or updates llmSimilarityScore, llmReasoning, and llmConfidence.
   *   - Sets userDecision to "pending" (if updating an existing comparison with a decision, resets to "pending").
   *   - Updates node1Info and node2Info snapshots.
   *   - Returns the comparison ID.
   */
  async compareNodes({
    node1,
    node2,
    node1Info,
    node2Info,
  }: {
    node1: Node;
    node2: Node;
    node1Info?: Record<string, unknown>;
    node2Info?: Record<string, unknown>;
  }): Promise<{ comparison: Comparison } | { error: string }> {
    if (node1 === node2) {
      return { error: "node1 and node2 must be different" };
    }

    // Check if comparison already exists (check both orderings)
    const existingComparison = await this.comparisons.findOne({
      $or: [
        { node1, node2 },
        { node1: node2, node2: node1 },
      ],
    });

    // Use LLM to analyze the nodes
    const llmResult = await this.analyzeWithLLM(node1Info, node2Info);
    if ("error" in llmResult) {
      return { error: llmResult.error };
    }

    const now = new Date();

    if (existingComparison) {
      // Update existing comparison
      // Normalize node order (always use node1 < node2 for consistency)
      const normalizedNode1 = node1 < node2 ? node1 : node2;
      const normalizedNode2 = node1 < node2 ? node2 : node1;
      const normalizedNode1Info = node1 < node2 ? node1Info : node2Info;
      const normalizedNode2Info = node1 < node2 ? node2Info : node1Info;

      await this.comparisons.updateOne(
        { _id: existingComparison._id },
        {
          $set: {
            node1: normalizedNode1,
            node2: normalizedNode2,
            llmSimilarityScore: llmResult.similarityScore,
            llmReasoning: llmResult.reasoning,
            llmConfidence: llmResult.confidence,
            userDecision: "pending", // Reset to pending when re-comparing
            node1Info: normalizedNode1Info,
            node2Info: normalizedNode2Info,
          },
        },
      );

      return { comparison: existingComparison._id };
    } else {
      // Create new comparison
      // Normalize node order (always use node1 < node2 for consistency)
      const normalizedNode1 = node1 < node2 ? node1 : node2;
      const normalizedNode2 = node1 < node2 ? node2 : node1;
      const normalizedNode1Info = node1 < node2 ? node1Info : node2Info;
      const normalizedNode2Info = node1 < node2 ? node2Info : node1Info;

      const comparisonId = freshID() as Comparison;
      await this.comparisons.insertOne({
        _id: comparisonId,
        node1: normalizedNode1,
        node2: normalizedNode2,
        llmSimilarityScore: llmResult.similarityScore,
        llmReasoning: llmResult.reasoning,
        llmConfidence: llmResult.confidence,
        userDecision: "pending",
        createdAt: now,
        node1Info: normalizedNode1Info,
        node2Info: normalizedNode2Info,
      });

      return { comparison: comparisonId };
    }
  }

  /**
   * Action: Confirms a comparison with a user decision.
   * confirmComparison (comparison: Comparison, userDecision: String): Empty
   *
   * **requires**:
   *   - A Comparisons entry with the given comparison ID exists.
   *   - userDecision is one of: "same", "different".
   *   - The comparison's current userDecision is "pending".
   *
   * **effects**:
   *   - Updates userDecision to the provided value.
   *   - Sets userConfirmedAt to the current date.
   */
  async confirmComparison({
    comparison,
    userDecision,
  }: {
    comparison: Comparison;
    userDecision: "same" | "different";
  }): Promise<Empty | { error: string }> {
    if (userDecision !== "same" && userDecision !== "different") {
      return {
        error: 'userDecision must be either "same" or "different"',
      };
    }

    const existingComparison = await this.comparisons.findOne({
      _id: comparison,
    });
    if (!existingComparison) {
      return { error: `Comparison with ID ${comparison} not found.` };
    }

    if (existingComparison.userDecision !== "pending") {
      return {
        error: `Comparison ${comparison} already has a decision (${existingComparison.userDecision}). Cannot confirm again.`,
      };
    }

    await this.comparisons.updateOne(
      { _id: comparison },
      {
        $set: {
          userDecision,
          userConfirmedAt: new Date(),
        },
      },
    );

    return {};
  }

  /**
   * Action: Records a merge decision for two nodes.
   * mergeNodes (comparison: Comparison, keepNode: Node): (merge: Merge)
   *
   * **requires**:
   *   - A Comparisons entry with the given comparison ID exists.
   *   - userDecision is "same".
   *   - keepNode is either node1 or node2 from the comparison.
   *
   * **effects**:
   *   - Creates a new Merges entry recording that the other node was merged into keepNode.
   *   - Sets mergedBy to "user".
   *   - Returns the merge ID.
   */
  async mergeNodes({
    comparison,
    keepNode,
  }: {
    comparison: Comparison;
    keepNode: Node;
  }): Promise<{ merge: Merge } | { error: string }> {
    const existingComparison = await this.comparisons.findOne({
      _id: comparison,
    });
    if (!existingComparison) {
      return { error: `Comparison with ID ${comparison} not found.` };
    }

    if (existingComparison.userDecision !== "same") {
      return {
        error: `Cannot merge nodes: comparison ${comparison} has userDecision "${existingComparison.userDecision}", but "same" is required.`,
      };
    }

    if (
      keepNode !== existingComparison.node1 &&
      keepNode !== existingComparison.node2
    ) {
      return {
        error: `keepNode ${keepNode} must be either node1 (${existingComparison.node1}) or node2 (${existingComparison.node2}) from the comparison.`,
      };
    }

    const mergeNode = keepNode === existingComparison.node1
      ? existingComparison.node2
      : existingComparison.node1;

    const mergeId = freshID() as Merge;
    await this.merges.insertOne({
      _id: mergeId,
      node1: mergeNode, // The node that is merged into node2
      node2: keepNode, // The node that remains after merge
      comparison,
      mergedAt: new Date(),
      mergedBy: "user",
    });

    return { merge: mergeId };
  }

  /**
   * Action: Cancels a pending comparison.
   * cancelComparison (comparison: Comparison): Empty
   *
   * **requires**:
   *   - A Comparisons entry with the given comparison ID exists.
   *   - userDecision is "pending".
   *
   * **effects**:
   *   - Removes the Comparisons entry.
   */
  async cancelComparison({
    comparison,
  }: {
    comparison: Comparison;
  }): Promise<Empty | { error: string }> {
    const existingComparison = await this.comparisons.findOne({
      _id: comparison,
    });
    if (!existingComparison) {
      return { error: `Comparison with ID ${comparison} not found.` };
    }

    if (existingComparison.userDecision !== "pending") {
      return {
        error: `Cannot cancel comparison ${comparison}: userDecision is "${existingComparison.userDecision}", but "pending" is required.`,
      };
    }

    await this.comparisons.deleteOne({ _id: comparison });

    return {};
  }

  /**
   * Query: Retrieves the comparison for a given node pair.
   */
  async _getComparison({
    node1,
    node2,
  }: {
    node1: Node;
    node2: Node;
  }): Promise<ComparisonDoc[]> {
    const comparison = await this.comparisons.findOne({
      $or: [
        { node1, node2 },
        { node1: node2, node2: node1 },
      ],
    });

    return comparison ? [comparison] : [];
  }

  /**
   * Query: Retrieves all comparisons involving a given node.
   */
  async _getComparisonsForNode({
    node,
  }: {
    node: Node;
  }): Promise<ComparisonDoc[]> {
    return await this.comparisons
      .find({
        $or: [{ node1: node }, { node2: node }],
      })
      .toArray();
  }

  /**
   * Query: Retrieves all pending comparisons.
   */
  async _getPendingComparisons(): Promise<ComparisonDoc[]> {
    return await this.comparisons
      .find({ userDecision: "pending" })
      .toArray();
  }

  /**
   * Query: Retrieves all merges involving a given node.
   */
  async _getMergesForNode({ node }: { node: Node }): Promise<MergeDoc[]> {
    return await this.merges
      .find({
        $or: [{ node1: node }, { node2: node }],
      })
      .toArray();
  }

  /**
   * Query: Retrieves full comparison details including LLM reasoning and node information snapshots.
   */
  async _getComparisonDetails({
    comparison,
  }: {
    comparison: Comparison;
  }): Promise<ComparisonDoc[]> {
    const comparisonDoc = await this.comparisons.findOne({ _id: comparison });
    return comparisonDoc ? [comparisonDoc] : [];
  }

  /**
   * Helper: Uses LLM to analyze two nodes and determine if they represent the same entity.
   * Returns similarity score, reasoning, and confidence level.
   */
  private async analyzeWithLLM(
    node1Info?: Record<string, unknown>,
    node2Info?: Record<string, unknown>,
  ): Promise<
    | {
      similarityScore: number;
      reasoning: string;
      confidence: "high" | "medium" | "low";
    }
    | { error: string }
  > {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return { error: "GEMINI_API_KEY environment variable not set" };
    }

    // Prepare information for LLM analysis
    const info1 = node1Info
      ? JSON.stringify(node1Info, null, 2)
      : "No information provided for node 1";
    const info2 = node2Info
      ? JSON.stringify(node2Info, null, 2)
      : "No information provided for node 2";

    const comparisonPrompt = `You are an entity disambiguation assistant. Your task is to determine whether two nodes in a network represent the same real-world person or entity.

Node 1 Information:
${info1}

Node 2 Information:
${info2}

Analyze the information provided and determine:
1. Whether these two nodes likely represent the same person/entity
2. Your confidence level (high, medium, or low)
3. Your reasoning for the decision

Consider factors such as:
- Name similarity (including variations, nicknames, abbreviations)
- Location/affiliation overlap
- Professional information (companies, positions, education)
- Any other identifying information

Return ONLY a JSON object with the following structure:
{
  "similarityScore": <number between 0.0 and 1.0, where 1.0 means definitely the same>,
  "confidence": <"high" | "medium" | "low">,
  "reasoning": <string explaining your analysis>
}

Example response:
{
  "similarityScore": 0.85,
  "confidence": "high",
  "reasoning": "Both nodes share the same full name (John Smith), work at the same company (Acme Corp), and are located in the same city (Boston). The email addresses are different but this could be due to different accounts."
}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: comparisonPrompt }],
            }],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { error: `LLM API error: ${errorText}` };
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        return { error: "No response from LLM" };
      }

      // Extract JSON from LLM response (may include markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { error: "Could not parse LLM response as JSON" };
      }

      const result = JSON.parse(jsonMatch[0]);

      // Validate and normalize the response
      const similarityScore = typeof result.similarityScore === "number"
        ? Math.max(0, Math.min(1, result.similarityScore))
        : 0.5;
      const confidence = ["high", "medium", "low"].includes(result.confidence)
        ? result.confidence
        : "medium";
      const reasoning = typeof result.reasoning === "string"
        ? result.reasoning
        : "No reasoning provided";

      return {
        similarityScore,
        confidence: confidence as "high" | "medium" | "low",
        reasoning,
      };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      return { error: `LLM analysis failed: ${err.message}` };
    }
  }
}

