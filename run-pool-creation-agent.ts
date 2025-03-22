import "dotenv/config";
import config from "./src/config";
import { bettingPoolGeneratorGraph } from "./src/pool-generation-agent/betting-pool-graph";

async function testFullGraph() {
  console.log("config.tavilyApiKey", config.tavilyApiKey);

  const result = await bettingPoolGeneratorGraph.invoke({
    messages: [],
    targetTruthSocialAccountId: config.trumpTruthSocialId,
  });

  console.log("\n--- FINAL RESULT ---");
  console.log(result);
}

testFullGraph().catch(console.error);
