import config from "../../config";
import puppeteerStealth from "../../puppeteer-stealth-request";
import type { ResearchItem } from "../../types/research-item";
import type { TruthSocialPost } from "../../types/truth-social-post";
import type { AgentState } from "../betting-pool-graph";

/**
 * Fetches the latest Truth Social posts for a given account ID
 * Uses puppeteer-stealth to avoid detection
 */
export async function getLatestTruthSocialPosts(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("Fetching Truth Social posts");

  // Use Trump's account ID from config if not specified in state
  const targetAccountId = state.targetTruthSocialAccountId;
  if (!targetAccountId) {
    throw new Error(
      "Target Truth Social account ID is required (state.targetTruthSocialAccountId)"
    );
  }

  try {
    // Construct the URL to fetch posts
    const postsUrl = `${config.truthSocialApiUrl}/accounts/${targetAccountId}/statuses`;

    console.log(`Fetching Truth Social posts from: ${postsUrl}`);

    // Call the puppeteer-stealth-request with the URL
    const postsData = await puppeteerStealth.fetchWithPuppeteer(postsUrl);

    console.log("Successfully fetched Truth Social posts");

    if (postsData) {
      const truthSocialPosts = postsData as TruthSocialPost[];

      // Initialize research array with Truth Social posts
      const researchItems: ResearchItem[] = truthSocialPosts.map((post) => ({
        truthSocialPost: post,
      }));

      console.log(
        `Created ${researchItems.length} research items from Truth Social posts`
      );

      // Return initialized research items
      return {
        research: researchItems,
      };
    } else {
      console.warn("No posts data returned from Truth Social API");
      return {
        research: [],
      };
    }
  } catch (error) {
    console.error("Error fetching Truth Social posts:", error);

    // Return empty array in case of failure
    return {
      research: [],
    };
  }
}
