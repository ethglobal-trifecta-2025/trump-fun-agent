import { request } from "graphql-request";
import { gql } from "../../types/__generated__";
import type { GraderState, PendingPool } from "../betting-grader-graph";
/**
 * Fetches pools with "PENDING" status from the GraphQL endpoint
 */
const fetchPendingPoolsQuery = gql(`
    query fetchPendingPools {
      pools(where: {status: PENDING}) {
        id
        status
        question
        options
        betsCloseAt
        closureCriteria
        closureInstructions
        usdcBetTotals
        pointsBetTotals
        originalTruthSocialPostId
      }
    }
  `);
export async function fetchPendingPools(
  state: GraderState
): Promise<Partial<GraderState>> {
  console.log("Fetching pending pools...");

  const chainConfig = state.chainConfig;

  try {
    // Send the GraphQL request using graphql-request
    const response = await request({
      url: chainConfig.subgraphUrl,
      document: fetchPendingPoolsQuery,
      requestHeaders: {
        Authorization: `Bearer ${chainConfig.subgraphApiKey}`,
      },
    });

    // Extract the pools from the response
    const pools = response.pools;
    console.log(`Found ${pools.length} pending pools`);

    return {
      pendingPools: pools.slice(0, 1).reduce(
        (acc, pool) => {
          acc[pool.id] = {
            pool,
            evidenceSearchQueries: [],
            evidence: [],
            gradingResult: {
              result: "",
              result_code: 0,
              probabilities: {},
              sources: [],
              explanation: "",
            },
            contractUpdated: false,
            txHash: "",
            failed: false,
          };
          return acc;
        },
        {} as Record<string, PendingPool>
      ),
    };
  } catch (error) {
    console.error(`Request failed: ${error}`);
    return { pendingPools: {} };
  }
}
