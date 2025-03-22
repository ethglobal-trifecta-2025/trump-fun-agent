import { supabase } from "../../config";
import type { AgentState } from "../betting-pool-graph";

/**
 * Filters out Truth Social posts that already exist in Supabase with a non-null transaction hash
 * This ensures we only process new posts or posts that haven't been finalized in a transaction
 *
 * NOTE: Instead of removing items from the array, we mark them with a `shouldProcess: false` flag
 * so the reducer in betting-pool-graph.ts will preserve these entries but later nodes will skip them
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
    // Query Supabase for posts with non-null and non-empty transaction_hash
    const { data: existingPosts, error } = await supabase
      .from("truth_social_posts")
      .select("post_id, pool_id, transaction_hash")
      .in("post_id", postIds)
      .not("transaction_hash", "is", null)
      .not("transaction_hash", "eq", "");

    console.log("existingPosts", existingPosts);
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

    // Clone and mark already processed posts instead of filtering them out
    const updatedResearch = researchItems.map((item) => {
      const existingPost = existingPosts?.find(
        (post) => post.post_id === item.truthSocialPost.id
      );
      if (existingPost) {
        console.log(
          `Marking post ${item.truthSocialPost.id} as already processed`
        );
        return {
          ...item,
          poolId: existingPost.pool_id || item.poolId,
          transactionHash:
            existingPost.transaction_hash || item.transactionHash,
          shouldProcess: false,
          skipReason: "already_processed",
        };
      }
      return item;
    });

    console.log(
      `Marked ${existingPostIds.length} research items as already processed`
    );

    // Filter out posts older than a 24 hours (also by marking them)
    const currentTime = new Date();
    const twentyFourHoursAgo = new Date(currentTime);
    twentyFourHoursAgo.setHours(currentTime.getHours() - 24);

    const finalResearch = updatedResearch.map((item) => {
      // Skip if already marked for not processing
      if (item.shouldProcess === false) {
        return item;
      }

      // TODO Commented to help generate noise when running against a newly deployed contract. Uncomment after hackathon.
      // const postDate = new Date(item.truthSocialPost.created_at);
      // const isRecent = postDate >= twentyFourHoursAgo;

      // if (!isRecent) {
      //   console.log(
      //     `Marking post ${item.truthSocialPost.id} from ${postDate.toLocaleString()} as too old`
      //   );
      //   return {
      //     ...item,
      //     shouldProcess: false,
      //     skipReason: "too_old",
      //   };
      // }

      // Mark valid posts explicitly
      return {
        ...item,
        shouldProcess: true,
      };
    });

    // Count how many items are marked for processing
    const processingCount = finalResearch.filter(
      (item) => item.shouldProcess === true
    ).length;
    console.log(
      `${processingCount} research items will be processed after filtering`
    );

    return {
      research: finalResearch,
    };
  } catch (error) {
    console.error("Error filtering processed Truth Social posts:", error);
    // Return original research items in case of error to avoid blocking the process
    return {
      research: researchItems,
    };
  }
}
