import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { config } from "../../config";
import type { GraderState } from "../betting-grader-graph";

/**
 * Generates evidence search queries for all pending pools concurrently
 */
export async function generateEvidenceQueries(
  state: GraderState
): Promise<Partial<GraderState>> {
  console.log("Generating evidence search queries for all pending pools...");

  if (Object.keys(state.pendingPools).length === 0) {
    console.error("No pending pools to generate queries for");
    return { pendingPools: {} };
  }

  // Define the expected output schema
  const evidenceQueriesSchema = z.object({
    evidence_search_queries: z.array(z.string()).length(3),
  });

  // Process all pools concurrently
  const pendingPoolsPromises = Object.entries(state.pendingPools).map(
    async ([poolId, pendingPool]) => {
      // Skip already failed pools
      if (pendingPool.failed) {
        return [poolId, pendingPool];
      }

      const evidenceSearchPrompt = ChatPromptTemplate.fromMessages([
        [
          "system",
          `Your task is to generate 3 search queries for finding evidence about the outcome of a betting pool.
    
          IMPORTANT TIME CONTEXT:
          - Focus on the actual time period mentioned in the question (e.g., "Q1 2024", "January 2024", etc.)
          - If the question refers to a specific time period that has already passed, prioritize finding final/official results
          - For questions about specific quarters/periods, ensure to include the company's official reporting dates
          
          Generate queries that will:
          1. Find official results/data for the specified time period
          2. Find company announcements or official statements
          3. Find reliable third-party verification of the results
          
          Your queries should focus on finding CONCLUSIVE evidence, even if the pool's decision date hasn't arrived yet.`,
        ],
        [
          "human",
          `Here is the betting pool information:

          BETTING POOL IDEA:
          {question}

          OPTIONS:
          {options}

          CLOSURE CRITERIA:
          {closureCriteria}

          CLOSURE INSTRUCTIONS:
          {closureInstructions}

          Please generate search queries that will help find evidence to verify these conditions.`,
        ],
      ]);

      try {
        // Create the structured LLM
        const structuredLlm = config.large_llm.withStructuredOutput(
          evidenceQueriesSchema,
          {
            name: "generateEvidenceQueries",
          }
        );

        // Format the prompt with the pool information
        const formattedPrompt = await evidenceSearchPrompt.formatMessages({
          question: pendingPool.pool.question,
          options: pendingPool.pool.options,
          closureCriteria: pendingPool.pool.closureCriteria,
          closureInstructions: pendingPool.pool.closureInstructions,
        });

        // Call the LLM with the formatted prompt
        const result = await structuredLlm.invoke(formattedPrompt);
        console.log(`Generated queries for pool ${poolId}:`, result);

        // Return updated pool with evidence search queries
        return [
          poolId,
          {
            ...pendingPool,
            evidenceSearchQueries: result.evidence_search_queries,
          },
        ];
      } catch (error) {
        console.error(
          `Error generating evidence search queries for pool ${poolId}:`,
          error
        );
        return [
          poolId,
          {
            ...pendingPool,
            failed: true,
          },
        ];
      }
    }
  );

  // Wait for all pools to be processed
  const processedPools = await Promise.all(pendingPoolsPromises);

  // Reconstruct the pendingPools object
  const updatedPendingPools = Object.fromEntries(processedPools);

  return { pendingPools: updatedPendingPools };
}
