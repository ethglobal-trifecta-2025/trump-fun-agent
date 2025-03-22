import { BaseMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { BettingChainConfig } from "../config";
import { DEFAULT_CHAIN_ID, config } from "../config";
import type { ResearchItem } from "../types/research-item";
import { createBettingPools } from "./tools/create-betting-pools";
import { filterProcessedTruthSocialPosts } from "./tools/filter-processed-truth-social-posts";
import { generateBettingPoolIdeas } from "./tools/generate-betting-pool-ideas";
import { getLatestTruthSocialPosts } from "./tools/get-latest-truth-social-posts";
import { setOriginalMessageFunction } from "./tools/set-original-message";
import { upsertTruthSocialPosts } from "./tools/upsert-truth-social-posts";

const AgentStateAnnotation = Annotation.Root({
  originalMessage: Annotation<string>,
  targetTruthSocialAccountId: Annotation<string>,
  tavilySearchQuery: Annotation<string>,
  newsApiSearchQuery: Annotation<string>,
  tavilySearchResults: Annotation<object>, //TODO get a better type here
  newsApiSearchResults: Annotation<object>, //TODO get a better type here
  newsApiSearchFailed: Annotation<boolean>,
  chainConfig: Annotation<BettingChainConfig>({
    value: (curr, update) => update,
    default: () => config.chainConfig[DEFAULT_CHAIN_ID],
  }),
  research: Annotation<ResearchItem[]>({
    reducer: (curr, update) => {
      // Create a map of existing items by some unique identifier (assuming id exists)
      const existingMap = new Map(
        curr.map((item) => [item.truthSocialPost.id, item])
      );

      // Merge update items, replacing existing ones with the same id
      update.forEach((item) => {
        existingMap.set(item.truthSocialPost.id, item);
      });

      // Convert map values back to array
      return Array.from(existingMap.values());
    },
    default: () => [],
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, update) => [...curr, ...update],
    default: () => [],
  }),
});

// Define type alias for State
export type AgentState = typeof AgentStateAnnotation.State;

// Function to check if there are posts to process
function checkHasPosts(state: AgentState): "has_posts" | "no_posts" {
  const research = state.research || [];
  // Check if there are any posts marked for processing
  const hasProcessablePosts = research.some(
    (item) => item.shouldProcess === true
  );
  return hasProcessablePosts ? "has_posts" : "no_posts";
}

// Create the graph
const builder = new StateGraph(AgentStateAnnotation);

// Add nodes to the graph and create parallel search flows
builder
  .addNode("set_original_message", setOriginalMessageFunction)
  .addNode("truth_social_posts", getLatestTruthSocialPosts)
  .addNode("filter_processed_posts", filterProcessedTruthSocialPosts)
  .addNode("generate_betting_pool_ideas", generateBettingPoolIdeas)
  .addNode("create_betting_pools", createBettingPools)
  .addNode("upsert_truth_social_posts", upsertTruthSocialPosts)
  .addEdge(START, "set_original_message")
  .addEdge("set_original_message", "truth_social_posts")
  .addEdge("truth_social_posts", "filter_processed_posts")
  .addConditionalEdges("filter_processed_posts", checkHasPosts, {
    has_posts: "generate_betting_pool_ideas",
    no_posts: END,
  })
  .addEdge("generate_betting_pool_ideas", "create_betting_pools")
  .addEdge("create_betting_pools", "upsert_truth_social_posts")
  .addEdge("upsert_truth_social_posts", END);

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
