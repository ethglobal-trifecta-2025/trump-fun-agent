import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import config from "../../config";
import type { AgentState } from "../betting-pool-graph";

// Search function with structured output
export async function tavilySearchFunction(
  state: AgentState
): Promise<Partial<AgentState>> {

  if (!state.tavilySearchQuery) {
    return {
      tavilySearchResults: [],
    };
  }

  const tavilySearchTool = new TavilySearchResults({
    apiKey: config.tavilyApiKey,
    maxResults: 5,
    // searchDepth: "deep",
    includeAnswer: true,
    includeRawContent: true,
  });

  const results = await tavilySearchTool.invoke({
    input: "Just testing",
  });
  
  console.log("results", results);

  return {
    tavilySearchResults: results,
  };
}
