import { HumanMessage } from "@langchain/core/messages";
import "dotenv/config";
import { bettingPoolGeneratorGraph } from "./src/betting-pool-graph";
import config from "./src/config";

async function testFullGraph() {
  console.log("config.tavilyApiKey", config.tavilyApiKey);

  const result = await bettingPoolGeneratorGraph.invoke({
    messages: [new HumanMessage("What's the latest on Trump's legal cases?")],
    targetTruthSocialAccountId: config.trumpTruthSocialId,
  });

  console.log("\n--- FINAL RESULT ---");
  console.log(result);
}
console.log("testFullGraph");

testFullGraph().catch(console.error);
