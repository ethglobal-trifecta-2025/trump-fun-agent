import { HumanMessage } from "@langchain/core/messages";
import "dotenv/config";
import { runSingleNode } from "./src/bet-grading-agent/betting-grader-graph";
import { config, DEFAULT_CHAIN_ID } from "./src/config";

async function testSingleNode() {
  // Get the node name from command line args
  const nodeName = process.argv[2];
  if (!nodeName) {
    console.error("Please provide a node name as an argument");
    console.log(
      "Available nodes: fetch_pending_pools, generate_evidence_queries, gather_evidence, grade_betting_pool_idea, call_grade_pool_contract"
    );
    process.exit(1);
  }

  console.log(`Testing single node: ${nodeName}`);

  // Initial state for testing
  const initialState = {
    messages: [new HumanMessage("Test single node execution")],
    pendingPools: {}, // Will be populated if testing nodes that depend on it
    chainConfig: config.chainConfig[DEFAULT_CHAIN_ID],
  };

  try {
    const result = await runSingleNode(nodeName as any, initialState);
    console.log("\n--- NODE EXECUTION RESULT ---");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error executing node:", error);
  }
}

testSingleNode().catch(console.error);
