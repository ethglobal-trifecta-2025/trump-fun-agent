import type { AgentState } from "../betting-pool-graph";
import config from "../config";
import puppeteerStealth from "../puppeteer-stealth-request";

/**
 * Fetches the latest Truth Social posts for a given account ID
 * Uses puppeteer-stealth to avoid detection and proxies to handle rate limiting
 */
export async function getLatestTruthSocialPosts(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("Fetching Truth Social posts");

  // Use Trump's account ID from config if not specified in state
  const targetAccountId =
    state.targetTruthSocialAccountId || config.trumpTruthSocialId;

  try {
    // Construct the URL to fetch posts
    const postsUrl = `${config.truthSocialApiUrl}/accounts/${targetAccountId}/statuses`;

    console.log(`Fetching Truth Social posts from: ${postsUrl}`);

    // Use the proxyProtocol from env or default to http
    const proxyProtocol = process.env.PROXY_PROTOCOL || "http";

    // Call the puppeteer-stealth-request with the URL
    const postsData = await puppeteerStealth.fetchWithPuppeteer(
      postsUrl,
      proxyProtocol
    );

    console.log("Successfully fetched Truth Social posts");

    if (postsData) {
      // Return the actual posts data from the API
      return {
        truthSocialPosts: postsData,
      };
    } else {
      console.warn("No posts data returned from Truth Social API");
      return {
        truthSocialPosts: [],
      };
    }
  } catch (error) {
    console.error("Error fetching Truth Social posts:", error);

    // Return empty array in case of failure
    return {
      truthSocialPosts: [],
    };
  }
}
