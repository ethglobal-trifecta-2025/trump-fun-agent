import { BaseMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { BettingChainConfig } from "../config";
import { DEFAULT_CHAIN_ID, config } from "../config";
import type { ResearchItem } from "../types/research-item";
import { createBettingPools } from "./tools/create-betting-pools";
import { filterProcessedTruthSocialPosts } from "./tools/filter-processed-truth-social-posts";
import { generateBettingPoolIdeas } from "./tools/generate-betting-pool-ideas";
import { generateImages } from "./tools/generate-images";
import { getLatestTruthSocialPosts } from "./tools/get-latest-truth-social-posts";
import { newsApiSearchFunction } from "./tools/news-api";
import { setOriginalMessageFunction } from "./tools/set-original-message";
import { tavilySearchFunction } from "./tools/tavily-search";
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
      // Instead of replacing, merge by matching truth_social_post.id
      if (curr.length === 0) return update;

      // Create a map of current items by ID for faster lookup
      const currMap = new Map<string, ResearchItem>();
      curr.forEach((item) => {
        if (item.truth_social_post?.id) {
          currMap.set(item.truth_social_post.id, item);
        }
      });

      // Create merged array, prioritizing update values but preserving
      // important fields from curr (like transaction_hash) if not in update
      const merged = update.map((updateItem) => {
        const id = updateItem.truth_social_post?.id;
        if (!id) return updateItem;

        const currItem = currMap.get(id);
        if (!currItem) return updateItem;

        // Merge, prioritizing update values but keeping transaction_hash from curr if not in update
        return {
          ...currItem,
          ...updateItem,
          transaction_hash:
            updateItem.transaction_hash || currItem.transaction_hash,
          pool_id: updateItem.pool_id || currItem.pool_id,
        };
      });

      return merged;
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
    (item) => item.should_process === true
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
  .addNode("research_news", newsApiSearchFunction)
  .addNode("research_web", tavilySearchFunction)
  .addNode("generate_betting_pool_ideas", generateBettingPoolIdeas)
  .addNode("generate_images", generateImages)
  .addNode("create_betting_pools", createBettingPools)
  .addNode("upsert_truth_social_posts", upsertTruthSocialPosts)
  .addEdge(START, "set_original_message")
  .addEdge("set_original_message", "truth_social_posts")
  .addEdge("truth_social_posts", "filter_processed_posts")
  .addConditionalEdges("filter_processed_posts", checkHasPosts, {
    has_posts: "research_news",
    no_posts: END,
  })
  .addEdge("research_news", "research_web")
  // .addEdge("research_news", "generate_betting_pool_ideas")
  .addEdge("research_web", "generate_betting_pool_ideas")
  .addEdge("generate_betting_pool_ideas", "generate_images")
  // .addEdge("generate_betting_pool_ideas", "create_betting_pools")
  .addEdge("generate_images", "create_betting_pools")
  .addEdge("create_betting_pools", "upsert_truth_social_posts")
  .addEdge("upsert_truth_social_posts", END);

// const generateBettingPoolSubgraph = builder
//   .addNode("research_news", newsApiSearchFunction)
//   .addNode("research_web", tavilySearchFunction)
//   .addNode("generate_betting_pool_ideas", generateBettingPoolIdeas)
//   // .addNode("generate_images", generateImages)
//   .addNode("create_betting_pools", createBettingPools)
//   .addNode("upsert_truth_social_posts", upsertTruthSocialPosts)
//   .addEdge(START, "research_news")
//   .addEdge(START, "research_web")
//   .addEdge("research_news", "generate_betting_pool_ideas")
//   .addEdge("research_web", "generate_betting_pool_ideas")
//   // .addEdge("generate_betting_pool_ideas", "generate_images")
//   .addEdge("generate_betting_pool_ideas", "create_betting_pools")
//   // .addEdge("generate_images", "create_betting_pools")
//   .addEdge("create_betting_pools", "upsert_truth_social_posts")
//   .addEdge("upsert_truth_social_posts", END);

// Compile the graph
export const bettingPoolGeneratorGraph = builder.compile();
bettingPoolGeneratorGraph.name = "trump-fun-pool-creation-agent";
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
