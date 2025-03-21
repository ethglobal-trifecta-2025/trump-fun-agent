import { BaseMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { getLatestTruthSocialPosts } from "./tools/get-latest-truth-social-posts";
import { newsApiSearchFunction } from "./tools/news-api";
import { extractSearchQueryFunction } from "./tools/search-query";
import { setOriginalMessageFunction } from "./tools/set-original-message";
import { tavilySearchFunction } from "./tools/tavily-search";

const AgentStateAnnotation = Annotation.Root({
  originalMessage: Annotation<string>,
  targetTruthSocialAccountId: Annotation<string>,
  tavilySearchQuery: Annotation<string>,
  newsApiSearchQuery: Annotation<string>,
  tavilySearchResults: Annotation<object>, //TODO get a better type here
  newsApiSearchResults: Annotation<object>, //TODO get a better type here
  newsApiSearchFailed: Annotation<boolean>,
  truthSocialPosts: Annotation<any>, // Will be updated with proper type later
  bettingPoolIdea: Annotation<string>,
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, update) => [...curr, ...update],
    default: () => [],
  }),
});

// Define type alias for State
export type AgentState = typeof AgentStateAnnotation.State;

// Create the graph
const builder = new StateGraph(AgentStateAnnotation);

// Add nodes to the graph and create parallel search flows
builder
  .addNode("set_original_message", setOriginalMessageFunction)
  .addNode("truth_social_posts", getLatestTruthSocialPosts)
  .addNode("extract_query", extractSearchQueryFunction)
  .addNode("tavily_search", tavilySearchFunction)
  .addNode("news_api_search", newsApiSearchFunction)
  .addEdge(START, "set_original_message")
  .addEdge("set_original_message", "truth_social_posts")
  .addEdge("truth_social_posts", "extract_query")
  .addEdge("extract_query", "tavily_search")
  .addEdge("extract_query", "news_api_search")
  .addEdge("extract_query", "truth_social_posts")
  .addEdge("tavily_search", END)
  .addEdge("news_api_search", END)
  .addEdge("truth_social_posts", END);

// Compile the graph
export const bettingPoolGeneratorGraph = builder.compile();

// Export a function to run a single node for testing
export async function runSingleNode(
  nodeName: keyof typeof bettingPoolGeneratorGraph.nodes,
  state: AgentState
) {
  // Use type assertion to access the node by name
  const node = bettingPoolGeneratorGraph.nodes[nodeName];
  if (!node) {
    throw new Error(`Node '${nodeName}' not found in the graph`);
  }

  const result = await node.invoke(state);
  return result;
}
