import { BaseMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { BettingChainConfig } from "../config";
import { DEFAULT_CHAIN_ID, config } from "../config";
import type { FetchPendingPoolsQuery } from "../types/__generated__/graphql";
import { callGradePoolContract } from "./tools/call-grade-pool-contract";
import { fetchPendingPools } from "./tools/fetch-pending-pools";
import { gatherEvidence } from "./tools/gather-evidence";
import { generateEvidenceQueries } from "./tools/generate-evidence-queries";
import { gradeBettingPoolIdea } from "./tools/grade-betting-pool-idea";

export type PendingPool = {
  pool: FetchPendingPoolsQuery["pools"][number];
  evidenceSearchQueries: string[];
  evidence: Array<{
    url: string;
    summary: string;
    search_query: string;
  }>;
  gradingResult: {
    result: string;
    result_code: number;
    probabilities?: Record<string, number>;
    sources: string[];
    explanation: string;
  };
  contractUpdated: boolean;
  txHash: string;
  failed: boolean;
};

// State annotation for the grader graph
const GraderStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, update) => [...curr, ...update],
    default: () => [],
  }),
  // Key is pool id
  pendingPools: Annotation<Record<string, PendingPool>>({
    value: (curr, update) => update,
    default: () => ({}) as Record<string, PendingPool>,
  }),
  chainConfig: Annotation<BettingChainConfig>({
    value: (curr, update) => update,
    default: () => config.chainConfig[DEFAULT_CHAIN_ID],
  }),
});

// Define type alias for State
export type GraderState = typeof GraderStateAnnotation.State;

// Create the graph
const builder = new StateGraph(GraderStateAnnotation);

// Add nodes to the graph
builder
  .addNode("fetch_pending_pools", fetchPendingPools)
  .addNode("generate_evidence_queries", generateEvidenceQueries)
  .addNode("gather_evidence", gatherEvidence)
  .addNode("grade_betting_pool_idea", gradeBettingPoolIdea)
  .addNode("call_grade_pool_contract", callGradePoolContract)
  .addEdge(START, "fetch_pending_pools")
  .addEdge("fetch_pending_pools", "generate_evidence_queries")
  .addEdge("generate_evidence_queries", "gather_evidence")
  .addEdge("gather_evidence", "grade_betting_pool_idea")
  .addEdge("grade_betting_pool_idea", "call_grade_pool_contract")
  .addEdge("call_grade_pool_contract", END);

// Compile the graph
export const bettingGraderGraph = builder.compile();
bettingGraderGraph.name = "trump-fun-bet-grading-agent";

// Export a function to run a single node for testing
export async function runSingleNode(
  nodeName: keyof typeof bettingGraderGraph.nodes,
  state: GraderState
) {
  const node = bettingGraderGraph.nodes[nodeName];
  if (!node) {
    throw new Error(`Node '${nodeName}' not found in the graph`);
  }

  const result = await node.invoke(state);
  return result;
}
