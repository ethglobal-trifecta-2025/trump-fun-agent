import axios from "axios";
import { gql, type DocumentType } from "../../types/__generated__";
import type { FetchPendingPoolsDocument } from "../../types/__generated__/graphql";
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
  // Define the GraphQL query to fetch pending pools
  try {
    // Send the POST request to GraphQL endpoint
    const response = await axios.post<{
      data: DocumentType<typeof FetchPendingPoolsDocument>;
    }>(chainConfig.subgraphUrl, {
      query: fetchPendingPoolsQuery,
    });

    console.log("Response data:");
    console.log(response.data);
    console.log(response.data.data);
    console.log(response.data.data.pools);
    console.log(response.data.data.pools[0]);
    console.log("--------------------------------");
    // Extract the pools from the response
    const pools = response.data.data.pools;
    console.log(`Found ${pools.length} pending pools`);

    return {
      pendingPools: pools.reduce(
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
