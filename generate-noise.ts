import dotenv from "dotenv";
import "dotenv/config";
import { GraphQLClient, gql } from "graphql-request";
import path from "path";
import { setTimeout } from "timers/promises";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { bettingContractAbi, erc20Abi } from "./src/types/contract.types";

dotenv.config({ path: path.join(__dirname, ".env") });
console.log(path.join(__dirname, ".env"));
// GraphQL query to get pools
const GET_POOLS_QUERY = gql`
  query GetPools(
    $filter: Pool_filter!
    $orderBy: Pool_orderBy!
    $orderDirection: OrderDirection!
    $first: Int
  ) {
    pools(
      where: $filter
      orderBy: $orderBy
      orderDirection: $orderDirection
      first: $first
    ) {
      id
      poolId
      question
      options
      status
      chainId
      chainName
      createdAt
      createdBlockNumber
      createdBlockTimestamp
      createdTransactionHash
      lastUpdatedBlockNumber
      lastUpdatedBlockTimestamp
      lastUpdatedTransactionHash
      gradedBlockNumber
      gradedBlockTimestamp
      gradedTransactionHash
      betsCloseAt
      usdcBetTotals
      pointsBetTotals
      usdcVolume
      pointsVolume
      originalTruthSocialPostId
    }
  }
`;

// Types
type Pool = {
  id: string;
  poolId: string;
  question: string;
  options: string[];
  status: string;
  pointsVolume: string;
  betsCloseAt: string;
};

type PoolsResponse = {
  pools: Pool[];
};

// Config
const CONTRACT_ADDRESS = process.env
  .BASE_SEPOLIA_BETTING_CONTRACT_ADDRESS as `0x${string}`;

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL as string;
const SUBGRAPH_URL = process.env.BASE_SEPOLIA_SUBGRAPH_URL as string;
const SUBGRAPH_API_KEY = process.env.BASE_SEPOLIA_SUBGRAPH_API_KEY as string;

// Freedom token address
const FREEDOM_TOKEN_ADDRESS =
  //   "0x634AFEA4d8cbE4C1Deb5b5fDe992f92E92AD4214" as `0x${string}`;
  "0xA373482b473E33B96412a6c0cA8B847E6BBB4D0d" as `0x${string}`;

// Setup accounts
const PRIVATE_KEYS = [
  process.env.ACCOUNT1_PRIVATE_KEY as `0x${string}`,
  process.env.ACCOUNT2_PRIVATE_KEY as `0x${string}`,
  process.env.ACCOUNT3_PRIVATE_KEY as `0x${string}`,
];

// Setup accounts
const accounts = PRIVATE_KEYS.map((privateKey) =>
  privateKeyToAccount(privateKey)
);

// Track nonces for each account to avoid nonce-related errors
const accountNonces: Record<string, bigint> = {};

// Track when account was last used (timestamp)
const accountLastUsed: Record<string, number> = {};

// Initialize account tracking
for (const account of accounts) {
  accountNonces[account.address] = 0n;
  accountLastUsed[account.address] = 0;
}

// Initialize GraphQL client
const graphQLClient = new GraphQLClient(SUBGRAPH_URL, {
  headers: {
    Authorization: `Bearer ${SUBGRAPH_API_KEY}`,
  },
});

// Initialize Public Client
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

// Get a random account from our list with a preference for accounts not used recently
const getRandomAccount = (): ReturnType<typeof privateKeyToAccount> => {
  if (accounts.length === 0) {
    throw new Error("No accounts configured. Check your .env file.");
  }

  // Current time
  const now = Date.now();

  // Sort accounts by when they were last used (least recently used first)
  const sortedAccounts = [...accounts].sort((a, b) => {
    const lastUsedA = accountLastUsed[a.address] || 0;
    const lastUsedB = accountLastUsed[b.address] || 0;
    return lastUsedA - lastUsedB;
  });

  // Pick first account (least recently used)
  // We know this is safe because we checked accounts.length > 0 above
  const account = sortedAccounts[0];

  if (!account) {
    // This should never happen due to our check above, but TypeScript doesn't know that
    throw new Error("Failed to get a valid account");
  }

  // Update last used time
  accountLastUsed[account.address] = now;

  return account;
};

// Get a random bet amount between 10-50 FREEDOM points
const getRandomBetAmount = () => {
  // Generate a random amount between 10 and 50 FREEDOM tokens
  const freedomAmount = Math.floor(Math.random() * 501) + 100; // 10-50 range
  // Convert to smallest units (6 decimals)
  return BigInt(freedomAmount * 1_000_000);
};

// Get account balances and print them
const checkAccountBalances = async () => {
  console.log("Checking account balances...");
  for (const account of accounts) {
    try {
      const balance = await publicClient.readContract({
        address: FREEDOM_TOKEN_ADDRESS,
        abi: [
          {
            type: "function",
            name: "balanceOf",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
            stateMutability: "view",
          },
        ],
        functionName: "balanceOf",
        args: [account.address],
      });

      console.log(
        `Account ${account.address} has ${balance} FREEDOM tokens (${Number(balance) / 1e6} FREEDOM)`
      );
    } catch (error) {
      console.error(`Error checking balance for ${account.address}:`, error);
    }
  }
};

// Helper to check the balance of a specific account
const getAccountBalance = async (address: `0x${string}`): Promise<bigint> => {
  try {
    const balance = await publicClient.readContract({
      address: FREEDOM_TOKEN_ADDRESS,
      abi: [
        {
          type: "function",
          name: "balanceOf",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
        },
      ],
      functionName: "balanceOf",
      args: [address],
    });

    return BigInt(balance.toString());
  } catch (error) {
    console.error(`Error checking balance for ${address}:`, error);
    return 0n;
  }
};

// Helper to approve the betting contract to spend tokens
const approveTokenSpending = async (
  account: ReturnType<typeof privateKeyToAccount>,
  amount: bigint
): Promise<boolean> => {
  try {
    // Create wallet client for this account
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(RPC_URL),
    });

    // Get current nonce
    const currentNonce =
      accountNonces[account.address] ||
      BigInt(
        await publicClient.getTransactionCount({
          address: account.address,
        })
      );

    console.log(
      `Approving ${CONTRACT_ADDRESS} to spend ${Number(amount) / 1e6} FREEDOM tokens from ${account.address}`
    );

    // Approve the betting contract to spend tokens
    const hash = await walletClient.writeContract({
      address: FREEDOM_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACT_ADDRESS, amount],
      nonce: Number(currentNonce),
    });

    // Increment nonce
    accountNonces[account.address] = currentNonce + 1n;
    console.log(`Approval transaction: ${hash}`);

    // Wait for the transaction to be mined
    await publicClient.waitForTransactionReceipt({ hash });
    return true;
  } catch (error) {
    console.error(`Error approving tokens:`, error);
    return false;
  }
};

// Helper to place a bet
const placeBet = async (
  poolId: bigint,
  account: ReturnType<typeof privateKeyToAccount>
) => {
  try {
    // Check account balance first
    const balance = await getAccountBalance(account.address);
    if (balance === 0n) {
      console.log(
        `Account ${account.address} has no FREEDOM tokens, skipping bet`
      );
      return null;
    }

    // TokenType 1 is for FREEDOM/points
    const tokenType = 1;
    // Random option (0 or 1)
    const optionIndex = Math.floor(Math.random() * 2);

    // Get random bet amount (10-50 FREEDOM)
    const amount = getRandomBetAmount();

    // Make sure we don't exceed balance
    const safeAmount = amount > balance ? balance / 2n : amount;

    // If balance is too low, skip
    if (safeAmount < BigInt(5_000_000)) {
      // Minimum 5 FREEDOM
      console.log(
        `Account ${account.address} has insufficient balance (${balance}, ${Number(balance) / 1e6} FREEDOM) for a meaningful bet`
      );
      return null;
    }

    // First approve the contract to spend the tokens
    const approved = await approveTokenSpending(account, safeAmount);
    if (!approved) {
      console.log(`Failed to approve token spending for ${account.address}`);
      return null;
    }

    // Create wallet client for this account
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(RPC_URL),
    });

    // If nonce is not yet initialized for this account, get it from the network
    if (
      !accountNonces[account.address] ||
      accountNonces[account.address] === 0n
    ) {
      const networkNonce = await publicClient.getTransactionCount({
        address: account.address,
      });
      accountNonces[account.address] = BigInt(networkNonce);
      console.log(`Initialized nonce for ${account.address}: ${networkNonce}`);
    }

    // Use tracked nonce for transaction - we know it exists now
    const currentNonce = accountNonces[account.address] || 0n;

    console.log(
      `Placing bet with ${account.address} on pool ${poolId}, option ${optionIndex}, amount ${safeAmount} FREEDOM points (${Number(safeAmount) / 1e6} FREEDOM), balance: ${Number(balance) / 1e6} FREEDOM, nonce: ${currentNonce}`
    );

    try {
      // Place the bet with manual nonce management
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: bettingContractAbi,
        functionName: "placeBet",
        args: [
          poolId,
          BigInt(optionIndex),
          safeAmount,
          account.address,
          tokenType,
        ],
        nonce: Number(currentNonce), // Convert bigint to number as required by the API
      });

      // Increment nonce for next transaction
      accountNonces[account.address] = currentNonce + 1n;


      // Wait for transaction receipt to check for success
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return hash;
    } catch (error: any) {
      // Check for specific error types
      if (error.message && error.message.includes("InsufficientBalance")) {
        console.error(
          `Insufficient balance error for account ${account.address}. This is likely an approval issue.`
        );
        // Log more details about the error to help debug
        console.error("Error details:", error);
      } else if (
        error.message &&
        error.message.includes("BettingPeriodClosed")
      ) {
        console.error(`Betting period closed for pool ${poolId}`);
      } else if (error.message && error.message.includes("PoolNotOpen")) {
        console.error(`Pool ${poolId} is not open for betting`);
      } else {
        console.error(`Error placing bet on pool ${poolId}:`, error);
      }
      return null;
    }
  } catch (error) {
    console.error(`Unexpected error in placeBet function:`, error);
    return null;
  }
};

// Get pools by ID
const getTopPools = async (count: number): Promise<Pool[]> => {
  try {
    // Get current time in seconds
    const currentTimeSeconds = Math.floor(Date.now() / 1000);

    const response = await graphQLClient.request<PoolsResponse>(
      GET_POOLS_QUERY,
      {
        filter: {
          status: "PENDING",
          betsCloseAt_gt: currentTimeSeconds.toString(),
        },
        orderBy: "poolId",
        orderDirection: "desc",
        first: count,
      }
    );

    return response.pools;
  } catch (error) {
    console.error("Error fetching top pools by ID:", error);
    return [];
  }
};

// Get pools by points volume
const getTopPoolsByVolume = async (count: number): Promise<Pool[]> => {
  try {
    // Get current time in seconds
    const currentTimeSeconds = Math.floor(Date.now() / 1000);

    const response = await graphQLClient.request<PoolsResponse>(
      GET_POOLS_QUERY,
      {
        filter: {
          status: "PENDING",
          betsCloseAt_gt: currentTimeSeconds.toString(),
        },
        orderBy: "pointsVolume",
        orderDirection: "desc",
        first: count,
      }
    );

    return response.pools;
  } catch (error) {
    console.error("Error fetching pools by volume:", error);
    return [];
  }
};

// Get random pools
const getRandomPools = async (count: number): Promise<Pool[]> => {
  try {
    // Get current time in seconds
    const currentTimeSeconds = Math.floor(Date.now() / 1000);

    // Get all open pools
    const response = await graphQLClient.request<PoolsResponse>(
      GET_POOLS_QUERY,
      {
        filter: {
          status: "PENDING",
          betsCloseAt_gt: currentTimeSeconds.toString(),
        },
        orderBy: "createdAt",
        orderDirection: "desc",
        first: 100,
      }
    );

    // Shuffle and pick random ones
    const shuffled = [...response.pools].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  } catch (error) {
    console.error("Error fetching random pools:", error);
    return [];
  }
};

// Pick random items from an array
const pickRandom = <T>(arr: T[], count: number): T[] => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
};

// Sleep for a random amount of time between min and max milliseconds
const randomSleep = async (min: number, max: number) => {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  await setTimeout(ms);
};

// Main function that runs continuously
const run = async () => {
  // Check balances at startup
  await checkAccountBalances();

  while (true) {
    try {
      console.log("\n=== Starting new round of bets ===");

      // 1. Get top pools by ID and place bets
      const topPools = await getTopPools(3);
      console.log(`Found ${topPools.length} top pools by ID`);

      for (const pool of topPools) {
        const account = getRandomAccount();
        await placeBet(BigInt(pool.poolId), account);
        // Add random delay between bets (50-100ms)
        //   await randomSleep(50, 100);
      }

      // 2. Get top pools by volume and place bets on random 5
      //   const topVolumesPools = await getTopPoolsByVolume(5);
      //   console.log(`Found ${topVolumesPools.length} top pools by volume`);

      //   const selectedVolumesPools = pickRandom(topVolumesPools, 5);
      //   for (const pool of selectedVolumesPools) {
      //     const account = getRandomAccount();
      //     await placeBet(BigInt(pool.poolId), account);
      //     // Add random delay between bets (50-100ms)
      //     await randomSleep(50, 100);
      //   }

      //   // 3. Get random pools and place bets on 5
      //   const randomPools = await getRandomPools(5);
      //   console.log(`Found ${randomPools.length} random pools`);

      //   for (const pool of randomPools) {
      //     const account = getRandomAccount();
      //     await placeBet(BigInt(pool.poolId), account);
      //     // Add random delay between bets (50-100ms)
      //     await randomSleep(50, 100);
      //   }

      //   console.log("Sleeping for 1 second before next round...");
      //   await setTimeout(1000);
    } catch (error) {
      console.error("Error in main loop:", error);
      await setTimeout(5000);
    }
  }
};

// Run the process
console.log("Starting noise generation for demo...");
run().catch(console.error);
