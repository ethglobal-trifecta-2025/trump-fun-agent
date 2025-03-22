import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { tavily } from "@tavily/core";
import { z } from "zod";
import { config } from "../../config";
import type { GraderState, PendingPool } from "../betting-grader-graph";
/**
 * Gathers evidence from search queries for all non-failed pools concurrently
 */

// TODO Tool is giving me trouble, using the client directly for now.
const tavilyClient = tavily({
  apiKey: config.tavilyApiKey,
});
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

  // Define the expected output schema
  const evidenceSchema = z.object({
    url: z.string(),
    summary: z.string(),
    search_query: z.string(),
  });

  // Set up Tavily search
  const tavilySearch = new TavilySearchResults({
    apiKey: config.tavilyApiKey,
    maxResults: 3,
    includeRawContent: true,
  });

  const updatedPendingPools: Record<string, PendingPool> = {};
  for (const [poolId, pendingPool] of Object.entries(state.pendingPools)) {
    // Process one pool at a time
    // Skip pools that have failed or don't have search queries
    if (pendingPool.failed || pendingPool.evidenceSearchQueries.length === 0) {
      console.log(`Skipping pool ${poolId} - failed or no search queries`);
      updatedPendingPools[poolId] = {
        ...pendingPool,
        failed:
          pendingPool.failed || pendingPool.evidenceSearchQueries.length === 0,
      };
      continue;
    }

    const evidenceList: Evidence[] = [];

    const evidencePrompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a search assistant that finds and summarizes relevant evidence.
        For the given search query, return information from reliable sources.
        
        BETTING CONTEXT:
        What users are betting on: {question}
        
        Options: {options}

        Guidelines:
        - Only include sources that are directly relevant
        - Summarize the key points in 2-3 sentences
        - Prefer recent sources from reputable outlets`,
      ],
      [
        "human",
        `SEARCH QUERY: {query}

        SOURCE URL: {url}
        
        CONTENT: {content}`,
      ],
    ]);

    // Process search queries for this pool
    for (const query of pendingPool.evidenceSearchQueries) {
      try {
        // Use Tavily to gather evidence
        console.log(
          `Searching for evidence for pool ${poolId} with query: ${query}`
        );
        //TODO Tool gave me trouble, using the client directly for now.
        const searchDocsRaw = await tavilyClient.search(query, {
          maxResults: 3,
        });
        const searchDocs = searchDocsRaw.results;
        // const searchDocs =
        // await tavilySearch.invoke(query);

        console.log("searchDocs", searchDocs);
        console.log("searchDocs[0]", searchDocs[0]);
        console.log(typeof searchDocs[0]);
        console.log(`Found ${searchDocs.length} search results`);
        for (const doc of searchDocs) {
          // Create structured LLM
          const structuredLlm = config.large_llm.withStructuredOutput(
            evidenceSchema,
            {
              name: "gatherEvidence",
            }
          );

          // Format the prompt with the search and document information
          const formattedPrompt = await evidencePrompt.formatMessages({
            question: pendingPool.pool.question,
            options: pendingPool.pool.options,
            query: query,
            url: doc.url || "",
            content: doc.content || "",
          });

          // Call the LLM with the formatted prompt
          const result = await structuredLlm.invoke(formattedPrompt);
          console.log(
            `Search result summary for ${doc.url}: ${JSON.stringify(result)}`
          );

          // If search_query is missing (shouldn't happen with schema validation), add it
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
    updatedPendingPools[poolId] = {
      ...pendingPool,
      evidence: evidenceList,
    };
  }

  return { pendingPools: updatedPendingPools };
}
