import request, { gql } from "graphql-request";
import OpenAI from "openai";
import { baseSepolia } from "viem/chains";
import config, { supabase } from "./src/config";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to run as a cron job
export async function processTrumpReplies() {
  try {
    console.log("Starting Trump reply process...");

    // Query for comments mentioning @realTrumpFun and haven't been responded to
    const { data: pendingComments, error: queryError } = await supabase
      .from("comments")
      .select("*, pool_id")
      .ilike("body", "%@realTrumpFun%")
      .eq("trump_responded", false)
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("Error querying comments:", queryError);
      return;
    }

    console.log(`Found ${pendingComments?.length || 0} comments to respond to`);

    // Process each comment
    for (const comment of pendingComments || []) {
      try {
        // Get the last 5 messages before this comment for context
        const { data: previousComments, error: contextError } = await supabase
          .from("comments")
          .select("*")
          .eq("pool_id", comment.pool_id)
          .lt("created_at", comment.created_at)
          .order("created_at", { ascending: false })
          .limit(5);

        if (contextError) {
          console.error(
            `Error fetching context for comment ${comment.id}:`,
            contextError
          );
          continue;
        }

        // Fetch additional pool data from subgraph if needed
        let subgraphPoolData = null;
        try {
          const fetchPendingPoolsQuery = gql`
            query fetchPool {
              pool(id: "${comment.pool_id}") {
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
          `;

          const response = await request({
            url: config.chainConfig[baseSepolia.id].subgraphUrl,
            document: fetchPendingPoolsQuery,
            requestHeaders: {
              Authorization: `Bearer ${config.chainConfig[baseSepolia.id].subgraphApiKey}`,
            },
          });

          console.log(response);

          // @ts-ignore
          subgraphPoolData = response.pool;
        } catch (subgraphError) {
          console.error(
            `Error fetching subgraph data for pool ${comment.pool_id}:`,
            subgraphError
          );
        }

        // Prepare context for the prompt
        const context =
          previousComments
            ?.map((c) => `User ${c.user_address.substring(0, 8)}: ${c.body}`)
            .join("\n") || "";

        // Create prompt for GPT-4o
        const prompt = `
You are Donald Trump in 2025, now President again. You're responding to a comment on trump.fun, a prediction market website themed around your posts.

IMPORTANT: Your response MUST be less than 2 sentences and under 50 words total. Keep it extremely brief.

IMPORTANT: Your response MUST be less than 2 sentences and under 50 words total. This is repeated twice to emphasize how critical it is.

Context:
- Prediction market question: "${subgraphPoolData?.question || "Unknown betting pool"}"
Previous conversation:
${context}

Comment you're responding to:
User ${comment.user_address.substring(0, 8)}: ${comment.body}

Write a very brief response (MUST be under 50 words and 2 sentences max) in Donald Trump's authentic voice. Use his typical speaking style with capitalization for emphasis, superlatives, and self-reference.
`;

        // Generate Trump's response
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "You are Donald Trump in 2025. Keep responses UNDER 50 WORDS and 2 SENTENCES MAX. This is critically important.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 100, // Keep responses short
          temperature: 0.9, // Higher creativity
        });

        const trumpResponse = completion.choices[0]?.message?.content?.trim();

        if (!trumpResponse) {
          console.error(
            `Failed to generate response for comment ${comment.id}`
          );
          continue;
        }

        console.log(
          `Generated response for comment ${comment.id}: ${trumpResponse}`
        );

        // Add Trump's response as a new comment
        const { error: insertError } = await supabase.from("comments").insert({
          pool_id: comment.pool_id,
          body: trumpResponse,
          signature: "0xRealDonaldTrump2025",
          user_address: "0xRealDonaldTrump2025",
          commentID: comment.id,
        });

        if (insertError) {
          console.error(
            `Error inserting Trump's response for comment ${comment.id}:`,
            insertError
          );
          continue;
        }

        // Mark the original comment as responded to
        const { error: updateError } = await supabase
          .from("comments")
          .update({
            body: `${comment.body}`,
            trump_responded: true,
          })
          .eq("id", comment.id);

        if (updateError) {
          console.error(
            `Error updating comment ${comment.id} as responded:`,
            updateError
          );
        }

        // Add a small delay to prevent rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (commentError) {
        console.error(`Error processing comment ${comment.id}:`, commentError);
      }
    }

    console.log("Trump reply process completed.");
  } catch (error) {
    console.error("Error in Trump reply process:", error);
  }
}

// If running the script directly
if (require.main === module) {
  processTrumpReplies()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}
