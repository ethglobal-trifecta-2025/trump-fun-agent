import type { AgentState } from "../betting-pool-graph";
import { supabase } from "../config";

/**
 * Filters out Truth Social posts that already exist in Supabase with a non-null transaction hash
 * This ensures we only process new posts or posts that haven't been finalized in a transaction
 * TEMPORARY: Currently limited to returning at most 5 posts at a time
 */
export async function filterProcessedTruthSocialPosts(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("Filtering processed Truth Social posts");

  const researchItems = state.research || [];

  if (researchItems.length === 0) {
    console.log("No research items to filter");
    return {
      research: [],
    };
  }

  try {
    // Extract post IDs from the research items
    const postIds = researchItems.map((item) => item.truthSocialPost.id);

    console.log(
      `Checking if any of ${postIds.length} posts have been processed already`
    );

    // Query Supabase for posts with non-null transaction_hash
    const { data: existingPosts, error } = await supabase
      .from("truth_social_posts")
      .select("post_id")
      .in("post_id", postIds)
      .not("transaction_hash", "is", null);

    if (error) {
      console.error("Error querying Supabase:", error);
      return {
        research: researchItems,
      };
    }

    // Extract existing post IDs
    const existingPostIds = existingPosts?.map((post) => post.post_id) || [];

    console.log(
      `Found ${existingPostIds.length} posts that have already been processed`
    );

    // Filter out research items with posts that already exist with a non-null transaction_hash
    const filteredResearch = researchItems.filter(
      (item) => !existingPostIds.includes(item.truthSocialPost.id)
    );

    console.log(
      `${filteredResearch.length} research items remaining after filtering`
    );

    // TEMPORARY: Limit to processing at most 5 posts at a time
    const limitedResearch = filteredResearch.slice(0, 5);

    if (limitedResearch.length < filteredResearch.length) {
      console.log(
        `TEMPORARY LIMIT: Returning only ${limitedResearch.length} out of ${filteredResearch.length} available posts`
      );
    }

    return {
      research: limitedResearch,
    };
  } catch (error) {
    console.error("Error filtering processed Truth Social posts:", error);
    // Return original research items in case of error to avoid blocking the process
    return {
      research: researchItems.slice(0, 5), // Also apply limit in error case
    };
  }
}
