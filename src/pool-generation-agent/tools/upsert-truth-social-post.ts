import { supabase } from "../../config";
import type { Database, Json } from "../../types/database.types";
import type { SingleResearchItemState } from "../betting-pool-graph";

/**
 * Upserts a single Truth Social post into the database
 * This stores the post content and metadata for future reference and betting pool creation
 */
export async function upsertTruthSocialPost(
  state: SingleResearchItemState
): Promise<Partial<SingleResearchItemState>> {
  console.log("Upserting Truth Social post to database");

  const researchItem = state.research;

  if (!researchItem) {
    console.log("No research item to upsert");
    return {
      research: undefined,
    };
  }

  try {
    console.log(
      `Upserting Truth Social post ${researchItem.truth_social_post.id} to database`
    );

    // Check if item should be processed
    if (researchItem.should_process === false) {
      console.log("Item marked as should not process, skipping upsert");
      return {
        research: researchItem,
      };
    }

    // Add detailed debugging for the research item
    console.log("Detailed research item:", {
      id: researchItem.truth_social_post?.id,
      pool_id: researchItem.pool_id,
      transaction_hash: researchItem.transaction_hash,
      should_process: researchItem.should_process,
    });

    // Prepare the record for upsert
    const record: Database["public"]["Tables"]["truth_social_posts"]["Insert"] =
      {
        post_id: researchItem.truth_social_post.id,
        pool_id: researchItem.pool_id,
        string_content: JSON.stringify(researchItem.truth_social_post),
        json_content: JSON.parse(
          JSON.stringify(researchItem.truth_social_post)
        ) as Json,
        transaction_hash: researchItem.transaction_hash || null,
        created_at: new Date().toISOString(),
        image_url: researchItem.image_url || null,
        prompt_data: JSON.parse(JSON.stringify(researchItem)) as Json,
      };

    console.log("Upserting record to database");

    const { data, error } = await supabase
      .from("truth_social_posts")
      .upsert(record, {
        onConflict: "post_id",
        ignoreDuplicates: false,
      });

    if (error) {
      console.error("Error upserting Truth Social post:", error);
      throw error;
    }

    console.log(
      `Successfully upserted Truth Social post ${researchItem.truth_social_post.id}`
    );

    return {
      research: researchItem,
    };
  } catch (error) {
    console.error("Error upserting Truth Social post:", error);
    return {
      research: researchItem,
    };
  }
}
