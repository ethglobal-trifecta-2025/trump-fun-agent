import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { config } from "../../config";
import type { GraderState, PendingPool } from "../betting-grader-graph";

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

  // Process all pools concurrently
  const pendingPoolsPromises = Object.entries(state.pendingPools).map(
    async ([poolId, pendingPool]) => {
      // Skip already failed pools
      if (pendingPool.failed) {
        return [poolId, pendingPool];
      }

      const evidenceSearchSysMsg = new SystemMessage(
        `Your task is to generate 3 search queries for finding evidence about the outcome of a betting pool.
    
        IMPORTANT TIME CONTEXT:
        - Focus on the actual time period mentioned in the question (e.g., "Q1 2024", "January 2024", etc.)
        - If the question refers to a specific time period that has already passed, prioritize finding final/official results
        - For questions about specific quarters/periods, ensure to include the company's official reporting dates
        
        Generate queries that will:
        1. Find official results/data for the specified time period
        2. Find company announcements or official statements
        3. Find reliable third-party verification of the results
        
        Your queries should focus on finding CONCLUSIVE evidence, even if the pool's decision date hasn't arrived yet.
        
        response must be a JSON object with the following fields, and nothing else:
        {
            "evidence_search_queries": ["query1", "query2", "query3"] // List of 3 search queries
        }`
      );

      const evidenceSearchUserMsg = new HumanMessage(
        `Here is the betting pool information:

        BETTING POOL IDEA:
        ${pendingPool.pool.question}

        OPTIONS:
        ${pendingPool.pool.options}

        CLOSURE CRITERIA:
        ${pendingPool.pool.closureCriteria}

        CLOSURE INSTRUCTIONS:
        ${pendingPool.pool.closureInstructions}

        Please generate search queries that will help find evidence to verify these conditions.`
      );

      try {
        const result = await config.large_llm.invoke([
          evidenceSearchSysMsg,
          evidenceSearchUserMsg,
        ]);

        console.log(`Generated queries for pool ${poolId}:`, result);

        // Parse the result - might be string or already parsed JSON
        let queries: string[] = [];
        if (typeof result.content === "string") {
          const parsed = JSON.parse(result.content);
          queries = parsed.evidence_search_queries || [];
        } else {
          // If we've already got an object with the property
          const content = result.content as any;
          queries = content.evidence_search_queries || [];
        }

        // Return updated pool with evidence search queries
        return [
          poolId,
          {
            ...pendingPool,
            evidenceSearchQueries: queries,
          },
        ] as [string, PendingPool];
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
        ] as [string, PendingPool];
      }
    }
  );

  // Wait for all pools to be processed
  const processedPools = await Promise.all(pendingPoolsPromises);

  // Reconstruct the pendingPools object
  const updatedPendingPools = Object.fromEntries(processedPools);

  return { pendingPools: updatedPendingPools };
}
