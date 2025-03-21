import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import contractABI from "../../artifacts/BettingContract.json";
import type { AgentState } from "../betting-pool-graph";

/**
 * Creates betting pools for each research item in the state
 * Uses viem to interact with the smart contract
 */
export async function createBettingPools(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("Creating betting pools for research items");

  const researchItems = state.research || [];

  if (researchItems.length === 0) {
    console.log("No research items to create betting pools for");
    return {
      research: [],
    };
  }

  // Environment variables
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.BETTING_CONTRACT_ADDRESS;

  if (!privateKey || !rpcUrl || !contractAddress) {
    console.error(
      "Missing required environment variables for contract interaction"
    );
    return {
      research: researchItems,
    };
  }

  // Set up viem clients
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: baseSepolia, //TODO Don't hardcode
    transport: http(rpcUrl), //TODO Don't hardcode
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia, //TODO Don't hardcode
    transport: http(rpcUrl), //TODO Don't hardcode
  });

  try {
    // Create a function to process each research item and create a betting pool
    const processResearchItem = async (item: any, index: number) => {
      // Add a random delay to prevent rate limiting (100-300ms)
      const jitter = Math.floor(Math.random() * 200) + 100; // 100-300ms
      await new Promise((resolve) => setTimeout(resolve, jitter));

      console.log(
        `Creating betting pool for research item ${index + 1}/${
          researchItems.length
        }`
      );

      if (!item.bettingPoolIdea) {
        console.warn(
          `No betting pool idea found for item ${index + 1}, skipping`
        );
        return item;
      }

      // Set up the parameters for the betting pool
      const betsCloseAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours from now

      const createPoolParams = {
        question: item.bettingPoolIdea,
        options: ["Yes", "No"] as [string, string],
        betsCloseAt: betsCloseAt,
        closureCriteria: "",
        closureInstructions: "",
        originalTruthSocialPostId: item.truthSocialPost?.id?.toString() || "",
      };
      console.log("createPoolParams", createPoolParams);

      try {
        // Send the transaction
        const hash = await walletClient.writeContract({
          address: contractAddress as `0x${string}`,
          abi: contractABI.abi,
          functionName: "createPool",
          args: [createPoolParams],
        });

        console.log(`Transaction sent for item ${index + 1}, hash: ${hash}`);

        // Wait for transaction receipt
        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
          timeout: 60000, // 60 seconds
        });

        console.log(
          `Transaction confirmed for item ${index + 1}, status: ${
            receipt.status
          }`
        );

        if (receipt.status === "success") {
          // Parse the logs to get the poolId
          const logs = parseEventLogs({
            abi: contractABI.abi,
            eventName: "PoolCreated",
            logs: receipt.logs,
          });

          if (logs && logs.length > 0) {
            type PoolCreatedEvent = { args: { poolId: bigint } };
            const poolId = (logs[0] as unknown as PoolCreatedEvent).args.poolId;
            console.log(
              `Pool created for item ${index + 1}, poolId: ${poolId}`
            );

            // Update the research item with the transaction hash and pool ID
            return {
              ...item,
              transactionHash: hash,
              poolId: poolId.toString(),
            };
          }
        }

        return item;
      } catch (error) {
        console.error(`Error creating pool for item ${index + 1}:`, error);
        return item;
      }
    };

    // Process all research items sequentially with a 100-300ms delay between calls
    const updatedResearch = [];
    for (let i = 0; i < researchItems.length; i++) {
      const updatedResearchItem = await processResearchItem(
        researchItems[i],
        i
      );
      updatedResearch.push(updatedResearchItem);

      // Add delay between transactions (100-300ms)
      if (i < researchItems.length - 1) {
        const delay = Math.floor(Math.random() * 200) + 100; // 100-300ms
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.log(
      `Created betting pools for ${updatedResearch.length} research items`
    );

    return {
      research: updatedResearch,
    };
  } catch (error) {
    console.error("Error creating betting pools:", error);
    return {
      research: researchItems,
    };
  }
}
