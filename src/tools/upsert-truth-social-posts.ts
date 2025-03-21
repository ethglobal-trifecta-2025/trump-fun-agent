import type { AgentState } from "../betting-pool-graph";
import { supabase } from "../config";
import type { Database, Json } from "../types/database.types";
/**
 * Upserts Truth Social posts into the database concurrently
 * This stores the post content and metadata for future reference and betting pool creation
 */
export async function upsertTruthSocialPosts(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("Upserting Truth Social posts to database");

  // For now, we're using empty values for poolId and transactionHash
  // These will be populated in a later implementation
  const poolId = null;
  const transactionHash = "";

  const researchItems = state.research || [];

  if (researchItems.length === 0) {
    console.log("No research items to upsert");
    return {
      research: [],
    };
  }

  try {
    console.log(
      `Upserting ${researchItems.length} Truth Social posts to database concurrently`
    );

    // Prepare the records for upsert
    const records: Database["public"]["Tables"]["truth_social_posts"]["Insert"][] =
      researchItems.map((item) => ({
        post_id: item.truthSocialPost.id,
        pool_id: poolId,
        string_content: JSON.stringify(item.truthSocialPost),
        json_content: JSON.parse(JSON.stringify(item.truthSocialPost)) as Json, //TODO: This chain offends me
        transaction_hash: transactionHash,
      }));

    // Split records into batches for concurrent processing
    // Supabase has limits on batch size, so we'll process in smaller chunks
    const batchSize = 10;
    const batches = [];

    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }

    console.log(`Processing ${batches.length} batches concurrently`);

    // Process each batch concurrently
    const upsertPromises = batches.map(async (batch, index) => {
      console.log(
        `Upserting batch ${index + 1}/${batches.length} (${
          batch.length
        } records)`
      );

      const { data, error } = await supabase
        .from("truth_social_posts")
        .upsert(batch, {
          onConflict: "post_id",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`Error upserting batch ${index + 1}:`, error);
        throw error;
      }

      console.log(`Successfully upserted batch ${index + 1}`);
      return data;
    });

    // Wait for all batches to complete
    await Promise.all(upsertPromises)
      .then(() => console.log("All batches successfully upserted"))
      .catch((error) => console.error("Error in one or more batches:", error));

    console.log(`Successfully upserted ${records.length} Truth Social posts`);

    return {
      research: researchItems,
    };
  } catch (error) {
    console.error("Error upserting Truth Social posts:", error);
    return {
      research: researchItems,
    };
  }
}
