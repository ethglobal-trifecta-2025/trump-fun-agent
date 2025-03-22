import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import contractABI from "../../../artifacts/BettingContract.json";
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

  // Get chain configuration from state
  const chainConfig = state.chainConfig;
  if (!chainConfig) {
    console.error("Missing chain configuration in state");
    return {
      research: researchItems,
    };
  }

  // Set up viem clients
  const account = privateKeyToAccount(chainConfig.privateKey);

  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  try {
    // Filter research items to only process those marked with shouldProcess: true
    const itemsToProcess = researchItems.filter(
      (item) => item.shouldProcess === true && item.bettingPoolIdea
    );

    console.log(
      `Processing ${itemsToProcess.length} out of ${researchItems.length} total research items for betting pool creation`
    );

    if (itemsToProcess.length === 0) {
      console.log("No items to process after filtering");
      return {
        research: researchItems,
      };
    }

    // Create a function to process each research item and create a betting pool
    const processResearchItem = async (item: any, index: number) => {
      // Add a random delay to prevent rate limiting (100-300ms)
      const jitter = Math.floor(Math.random() * 200) + 100; // 100-300ms
      await new Promise((resolve) => setTimeout(resolve, jitter));

      console.log(
        `Creating betting pool for research item ${index + 1}/${
          itemsToProcess.length
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
      // Calculate and format the expected resolution date for human readability
      const resolutionDate = new Date(betsCloseAt * 1000);
      const formattedResolutionDate = resolutionDate.toLocaleString();

      // Standard closure criteria and instructions for 7-day window
      const closureCriteria =
        "This pool will be resolved within 7 days based on verifiable public information.";
      const closureInstructions = `This prediction resolves by ${formattedResolutionDate}. Grade as YES if the predicted event occurs by the resolution date, and NO otherwise. Use verifiable public sources to determine the outcome.`;

      const createPoolParams = {
        question: item.bettingPoolIdea,
        options: ["Yes", "No"] as [string, string],
        betsCloseAt: betsCloseAt,
        closureCriteria: closureCriteria,
        closureInstructions: closureInstructions,
        originalTruthSocialPostId: item.truthSocialPost?.id?.toString() || "",
      };
      console.log("createPoolParams", createPoolParams);

      try {
        // Send the transaction
        const hash = await walletClient.writeContract({
          address: chainConfig.contractAddress,
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
    const updatedResearch = [...researchItems]; // Start with a copy of all items to preserve ones we skip

    // Process only the items that have shouldProcess: true
    for (let i = 0; i < itemsToProcess.length; i++) {
      const currentItem = itemsToProcess[i];

      // Skip if item is undefined (shouldn't happen, but TypeScript needs this check)
      if (!currentItem) continue;

      const itemIndex = researchItems.findIndex(
        (item) => item.truthSocialPost.id === currentItem.truthSocialPost.id
      );

      if (itemIndex === -1) continue; // Shouldn't happen, but just in case

      const updatedResearchItem = await processResearchItem(currentItem, i);

      // Update the specific item in our copy of the array
      updatedResearch[itemIndex] = updatedResearchItem;

      // Add delay between transactions (100-300ms)
      if (i < itemsToProcess.length - 1) {
        const delay = Math.floor(Math.random() * 200) + 100; // 100-300ms
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.log(
      `Created betting pools for ${itemsToProcess.length} research items`
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
