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
    const postIds = researchItems.map((item) => item.truth_social_post.id);

    console.log(`Checking Supabase for ${postIds.length} posts`);

    // Query Supabase for all matching posts, without filtering on transaction_hash
    const { data: supabasePosts, error } = await supabase
      .from("truth_social_posts")
      .select("*")
      .in("post_id", postIds);

    if (error) {
      console.error("Error querying Supabase:", error);
      return {
        research: researchItems,
      };
    }

    console.log(
      `Found ${supabasePosts?.length || 0} matching posts in Supabase`
    );

    // Merge Supabase data with research items and set processing flags
    const updatedResearch = researchItems.map((item) => {
      const supabasePost = supabasePosts?.find(
        (post) => post.post_id === item.truth_social_post.id
      );

      if (supabasePost) {
        // If post exists in Supabase and has a transaction hash, mark as should not process
        const hasTransactionHash =
          supabasePost.transaction_hash &&
          supabasePost.transaction_hash.trim() !== "";

        if (hasTransactionHash) {
          console.log(
            `Marking post ${item.truth_social_post.id} as already processed (has transaction hash)`
          );
          return {
            ...item,
            ...supabasePost,
            should_process: false,
            skip_reason: "already_processed",
          };
        } else {
          // Post exists in Supabase but has no transaction hash, add Supabase data but keep processing
          return {
            ...item,
            ...supabasePost,
            should_process: true,
          };
        }
      }

      // Post not in Supabase yet, mark as should process
      return {
        ...item,
        should_process: true,
      };
    });

    // Filter out posts older than a 24 hours (also by marking them)
    const currentTime = new Date();
    const twentyFourHoursAgo = new Date(currentTime);
    twentyFourHoursAgo.setHours(currentTime.getHours() - 24);

    const finalResearch = updatedResearch.map((item) => {
      // Skip if already marked for not processing
      if (item.should_process === false) {
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
      //     should_process: false,
      //     skipReason: "too_old",
      //   };
      // }

      // Mark valid posts explicitly
      return {
        ...item,
        should_process: true,
      };
    });

    // Count how many items are marked for processing
    const processingCount = finalResearch.filter(
      (item) => item.should_process === true
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
