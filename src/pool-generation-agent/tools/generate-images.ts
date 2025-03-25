import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import config, { supabase } from "../../config";
import type { ResearchItem } from "../../types/research-item";
import type { AgentState } from "../betting-pool-graph";

// Define schema for image prompt output
const imagePromptSchema = z.object({
  imagePrompt: z
    .string()
    .describe("Generated prompt for Flux AI image generation"),
});

/**
 * Extracts a filename from a prompt
 * Creates a simple filename based on the first few words of the prompt plus timestamp
 */
function generateFilenameFromPrompt(prompt: string): string {
  const timestamp = new Date().getTime();
  // Get the first few words
  const words = prompt.split(" ").slice(0, 4).join("-");
  // Replace special characters
  const cleanWords = words.replace(/[^a-zA-Z0-9-]/g, "");
  return `${cleanWords.substring(0, 50)}-${timestamp}.jpg`;
}

/**
 * Generates image prompts and images for betting pool ideas using Anthropic and Flux.ai
 * This enhances betting pools with visual elements
 */
export async function generateImages(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("Generating images for betting pool ideas");

  const researchItems = state.research || [];

  if (researchItems.length === 0) {
    console.log("No research items to generate images for");
    return {
      research: [],
    };
  }

  try {
    // Filter research items to only process those marked with shouldProcess: true
    // and that have a betting pool idea
    console.log("RESEARCH_ITEMS", researchItems);
    const itemsToProcess = researchItems.filter(
      (item) => item.should_process === true && item.betting_pool_idea
    );

    console.log(
      `Processing ${itemsToProcess.length} out of ${researchItems.length} total research items for image generation`
    );

    if (itemsToProcess.length === 0) {
      console.log("No items to process after filtering");
      return {
        research: researchItems,
      };
    }

    // Limit the number of images to generate to respect the configured maximum
    const maxImagesPerRun = config.maxImagesPerRun;
    const itemsToGenerateImagesFor = itemsToProcess.slice(0, maxImagesPerRun);

    console.log(
      `Will generate images for ${itemsToGenerateImagesFor.length} items (max: ${maxImagesPerRun})`
    );

    // Create a prompt template for image prompt generation
    const imagePromptTemplate = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are an expert prompt engineer who will help a user generate a strong prompt to pass to Flux AI to generate an image.

The user has created a bettable idea based on a Truth Social post from Donald Trump and wants to generate an image to go along with it.

Rules:
- The key features of the image should be viewable in a thumbnail
- You should always show Donald Trump in a favorable light in the image
- You should generate a creative and over the top prompt with elements of surrealism, absurdity, and pop culture
- If the bettable idea includes other public figures, you should include them in the image and make sure they're visible in the thumbnail
- If the image has multiple people, you should define how they should be positioned and how they should interact
- Lean towards photo realistic images 
- The image must always include Donald Trump

Your response should only be the prompt and nothing else.`,
      ],
      [
        "human",
        `Here is the Truth Social post from Donald Trump:
{truthSocialPost}

And this is the bettable idea based on it:
{bettingPoolIdea}

Please generate an image prompt for Flux AI.`,
      ],
    ]);

    // Create a structured LLM for image prompt generation
    const structuredLlm = config.large_llm.withStructuredOutput(
      imagePromptSchema,
      {
        name: "generateImagePrompt",
      }
    );

    // Process each research item sequentially (to avoid rate limiting)
    const updatedResearch = [...researchItems]; // Start with a copy of all items to preserve ones we skip

    for (let i = 0; i < itemsToGenerateImagesFor.length; i++) {
      const currentItem = itemsToGenerateImagesFor[i];

      // Skip if item is undefined (shouldn't happen, but TypeScript needs this check)
      if (!currentItem) continue;

      const itemIndex = researchItems.findIndex(
        (item) => item.truth_social_post.id === currentItem.truth_social_post.id
      );

      if (itemIndex === -1) continue; // Shouldn't happen, but just in case

      try {
        console.log(
          `Processing image for research item ${i + 1}/${itemsToGenerateImagesFor.length}`
        );

        // Check if the item already has an image URL from the database
        // Check both snake_case (from DB) and camelCase (from the object) property names
        const hasImageUrl =
          ("image_url" in currentItem &&
            typeof currentItem.image_url === "string" &&
            currentItem.image_url.length > 0) ||
          (typeof currentItem.image_url === "string" &&
            currentItem.image_url.length > 0);

        if (hasImageUrl) {
          const existingImageUrl =
            "image_url" in currentItem &&
            typeof currentItem.image_url === "string"
              ? currentItem.image_url
              : (currentItem.image_url as string);

          console.log(
            `Using existing image URL from database: ${existingImageUrl}`
          );

          // Assign to camelCase imageUrl and continue processing
          const updatedItem: ResearchItem = {
            ...currentItem,
            image_url: existingImageUrl,
          };

          updatedResearch[itemIndex] = updatedItem;
          console.log(`Research item ${i + 1} updated with existing image URL`);

          // Skip to the next item
          continue;
        }

        console.log(
          `Generating image for research item ${i + 1}/${itemsToGenerateImagesFor.length}`
        );

        // Extract the betting pool idea and truth social post content
        const bettingPoolIdea = currentItem.betting_pool_idea;
        const truthSocialPost = currentItem.truth_social_post.content.replace(
          /<\/?[^>]+(>|$)/g,
          ""
        ); // Remove HTML tags

        if (!bettingPoolIdea) {
          console.warn(
            `No betting pool idea found for item ${i + 1}, skipping image generation`
          );
          continue;
        }

        console.log(
          `Generating image prompt for: ${bettingPoolIdea.substring(0, 50)}...`
        );

        // Format the prompt with the Truth Social post and betting pool idea
        const formattedPrompt = await imagePromptTemplate.formatMessages({
          truthSocialPost,
          bettingPoolIdea,
        });

        // Call the structured LLM to generate the image prompt
        const result = await structuredLlm.invoke(formattedPrompt);
        const imagePrompt = result.imagePrompt;

        console.log(
          `Generated image prompt: ${imagePrompt.substring(0, 100)}...`
        );

        // Call Flux API to generate the image
        console.log(`Calling Flux API with model: ${config.fluxModel}`);

        // Create URL with parameters for GET request
        const fluxResponse = await fetch(
          "https://api.us1.bfl.ai/v1/" + config.fluxModel,
          {
            method: "POST",
            headers: {
              accept: "application/json",
              "x-key": config.fluxApiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: imagePrompt,
              width: 1024,
              height: 1024,
            }),
          }
        );

        if (!fluxResponse.ok) {
          throw new Error(
            `Flux API error: ${fluxResponse.status} ${fluxResponse.statusText}`
          );
        }

        const fluxData = (await fluxResponse.json()) as { id: string };
        const requestId = fluxData.id;

        console.log(`Flux API request submitted with ID: ${requestId}`);

        // Poll for the result
        let fluxImageUrl = null;
        let attempts = 0;
        const maxAttempts = 30; // Maximum 15 seconds (30 attempts * 500ms)

        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms between polling

          // Create URL with query parameters appended
          const resultUrl = new URL("https://api.us1.bfl.ai/v1/get_result");
          resultUrl.searchParams.append("id", requestId);

          const resultResponse = await fetch(resultUrl.toString(), {
            method: "GET",
            headers: {
              accept: "application/json",
              "x-key": config.fluxApiKey,
            },
          });

          if (!resultResponse.ok) {
            console.warn(
              `Error fetching result: ${resultResponse.status} ${resultResponse.statusText}`
            );
            attempts++;
            continue;
          }

          const result = (await resultResponse.json()) as {
            status: string;
            result?: { sample: string };
            error?: string;
          };

          if (result.status === "Ready" && result.result) {
            fluxImageUrl = result.result.sample;
            console.log(`Image generated successfully: ${fluxImageUrl}`);
            break;
          } else if (result.status === "Error") {
            throw new Error(
              `Error generating image: ${result.error || "Unknown error"}`
            );
          }

          console.log(
            `Image generation status: ${result.status}, attempt ${attempts + 1}/${maxAttempts}`
          );
          attempts++;
        }

        if (!fluxImageUrl) {
          throw new Error("Timed out waiting for image generation");
        }

        // Now download the image from Flux and upload to Supabase
        console.log("Downloading image from Flux...");
        const imageResponse = await fetch(fluxImageUrl);

        if (!imageResponse.ok) {
          throw new Error(
            `Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`
          );
        }

        // Get the image as blob
        const imageBlob = await imageResponse.blob();

        // Convert blob to array buffer and then to Buffer for Supabase
        const arrayBuffer = await imageBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Generate a filename based on the prompt
        const filename = generateFilenameFromPrompt(imagePrompt);
        const filepath = `trump-images/${filename}`;

        console.log(`Uploading image to Supabase at path: ${filepath}`);

        // Upload to Supabase
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("trump-fun")
          .upload(filepath, buffer, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(
            `Failed to upload image to Supabase: ${uploadError.message}`
          );
        }

        // Get the public URL
        const { data: publicUrlData } = supabase.storage
          .from("trump-fun")
          .getPublicUrl(filepath);

        const supabaseImageUrl = publicUrlData.publicUrl;

        console.log(`Image uploaded to Supabase: ${supabaseImageUrl}`);

        // Update the research item with the image prompt and URL
        const updatedItem: ResearchItem = {
          ...currentItem,
          image_prompt: imagePrompt,
          image_url: supabaseImageUrl, // Store Supabase URL instead of Flux URL
          // Preserve other important fields that might have been set by previous steps
          transaction_hash: currentItem.transaction_hash,
          pool_id: currentItem.pool_id,
          betting_pool_idea: currentItem.betting_pool_idea,
          should_process: currentItem.should_process,
          skip_reason: currentItem.skip_reason,
        };

        updatedResearch[itemIndex] = updatedItem;

        console.log(
          `Research item ${i + 1} updated with Supabase image URL: ${supabaseImageUrl}`
        );
      } catch (error) {
        console.error(
          `Error generating image for research item ${i + 1}:`,
          error
        );
        // Mark the item as should not process with reason for failure
        // But preserve all other fields
        const updatedItem: ResearchItem = {
          ...currentItem,
          should_process: false,
          skip_reason: "failed_image_generation",
          // Preserve other important fields
          transaction_hash: currentItem.transaction_hash,
          pool_id: currentItem.pool_id,
          betting_pool_idea: currentItem.betting_pool_idea,
          image_url: currentItem.image_url,
        };
        updatedResearch[itemIndex] = updatedItem;
        console.log(
          `Research item ${i + 1} marked as should not process due to image generation failure`
        );
        // Continue with the next item without failing the entire process
        continue;
      }

      // Add a delay between processing items to avoid rate limiting
      if (i < itemsToGenerateImagesFor.length - 1) {
        const delay = 1000; // 1 second
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.log(
      `Finished image generation for ${itemsToGenerateImagesFor.length} research items`
    );

    return {
      research: updatedResearch,
    };
  } catch (error) {
    console.error("Error generating images:", error);
    return {
      research: researchItems,
    };
  }
}
