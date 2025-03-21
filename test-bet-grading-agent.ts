import { HumanMessage } from "@langchain/core/messages";
import "dotenv/config";
import { bettingGraderGraph } from "./src/bet-grading-agent/betting-grader-graph";
import { config, DEFAULT_CHAIN_ID } from "./src/config";

async function testBettingGrader() {
  console.log("Starting betting grader test");
  console.log("Chain Config:", config.chainConfig[DEFAULT_CHAIN_ID]);

  // Initial state for the grader graph
  const result = await bettingGraderGraph.invoke({
    messages: [new HumanMessage("Test grading pending betting pools")],
    pendingPools: {}, // Will be populated by fetch_pending_pools node
    chainConfig: config.chainConfig[DEFAULT_CHAIN_ID],
  });

  console.log("\n--- BETTING GRADER RESULTS ---");
  console.log(JSON.stringify(result, null, 2));
}

console.log("Running betting grader test");
testBettingGrader().catch(console.error);
