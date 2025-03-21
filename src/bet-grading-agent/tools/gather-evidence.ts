import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { config } from "../../config";
import type { GraderState, PendingPool } from "../betting-grader-graph";


/**
 * Gathers evidence from search queries for all non-failed pools concurrently
 */

export interface Evidence {
  url: string;
  summary: string;
  search_query: string;
}

export async function gatherEvidence(
  state: GraderState
): Promise<Partial<GraderState>> {
  console.log(
    "Gathering evidence from search queries for all pools concurrently"
  );

  if (Object.keys(state.pendingPools).length === 0) {
    console.error("No pending pools to gather evidence for");
    return { pendingPools: {} };
  }

  // Set up Tavily search
  const tavilySearch = new TavilySearchResults({
    apiKey: config.tavilyApiKey,
    maxResults: 3,
    includeRawContent: true,
  });

  // Process each non-failed pool concurrently
  const pendingPoolsPromises = Object.entries(state.pendingPools).map(
    async ([poolId, pendingPool]) => {
      // Skip pools that have failed or don't have search queries
      if (
        pendingPool.failed ||
        pendingPool.evidenceSearchQueries.length === 0
      ) {
        console.log(`Skipping pool ${poolId} - failed or no search queries`);
        return [
          poolId,
          {
            ...pendingPool,
            failed:
              pendingPool.failed ||
              pendingPool.evidenceSearchQueries.length === 0,
          },
        ] as [string, PendingPool];
      }

      const evidenceList: Evidence[] = [];

      const searchSysMsg = new SystemMessage(
        `You are a search assistant that finds and summarizes relevant evidence.
        For the given search query, return information from reliable sources.
        
        BETTING CONTEXT:
        What users are betting on: ${pendingPool.pool.question}
        
        Options: ${pendingPool.pool.options}
        
        Your response must be a JSON object with these fields and nothing else:
        {
            "url": "source URL",
            "summary": "brief summary of relevant information from the source",
            "search_query": "the search query that found this evidence"
        }
        
        Guidelines:
        - Only include sources that are directly relevant
        - Summarize the key points in 2-3 sentences
        - Prefer recent sources from reputable outlets`
      );

      // Process search queries for this pool
      for (const query of pendingPool.evidenceSearchQueries) {
        try {
          // Use Tavily to gather evidence
          const searchDocs = await tavilySearch.invoke(query);

          for (const doc of searchDocs) {
            const searchUserMsg = new HumanMessage(
              `SEARCH QUERY: ${query}
              
              SOURCE URL: ${doc.url || ""}
              CONTENT: ${doc.pageContent || ""}

              Please analyze and summarize this search result in the context of the betting pool.`
            );

            const resultJson = await config.large_llm.invoke([
              searchSysMsg,
              searchUserMsg,
            ]);

            // Parse the result
            let result: Evidence;
            if (typeof resultJson.content === "string") {
              result = JSON.parse(resultJson.content);
            } else {
              result = resultJson.content as any;
            }

            if (!result.search_query) {
              result.search_query = query;
            }

            evidenceList.push(result);
          }
        } catch (error) {
          console.error(
            `Error processing query '${query}' for pool ${poolId}:`,
            error
          );
          continue;
        }
      }

      console.log(
        `Gathered ${evidenceList.length} pieces of evidence for pool ${poolId}`
      );

      // Return updated pool with evidence
      return [
        poolId,
        {
          ...pendingPool,
          evidence: evidenceList,
        },
      ] as [string, PendingPool];
    }
  );

  // Wait for all pools to be processed
  const processedPools = await Promise.all(pendingPoolsPromises);

  // Reconstruct the pendingPools object
  const updatedPendingPools = Object.fromEntries(processedPools);

  return { pendingPools: updatedPendingPools };
}
