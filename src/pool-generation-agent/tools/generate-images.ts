import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import config from "../../config";
import type { ResearchItem } from "../../types/research-item";
import type { AgentState } from "../betting-pool-graph";

// Define schema for image prompt output
const imagePromptSchema = z.object({
  imagePrompt: z
    .string()
    .describe("Generated prompt for Flux AI image generation"),
});

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
    const itemsToProcess = researchItems.filter(
      (item) => item.shouldProcess === true && item.bettingPoolIdea
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
        (item) => item.truthSocialPost.id === currentItem.truthSocialPost.id
      );

      if (itemIndex === -1) continue; // Shouldn't happen, but just in case

      try {
        console.log(
          `Generating image for research item ${i + 1}/${itemsToGenerateImagesFor.length}`
        );

        // Extract the betting pool idea and truth social post content
        const bettingPoolIdea = currentItem.bettingPoolIdea;
        const truthSocialPost = currentItem.truthSocialPost.content.replace(
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
        let imageUrl = null;
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
            imageUrl = result.result.sample;
            console.log(`Image generated successfully: ${imageUrl}`);
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

        if (!imageUrl) {
          throw new Error("Timed out waiting for image generation");
        }

        // Update the research item with the image prompt and URL
        const updatedItem: ResearchItem = {
          ...currentItem,
          imagePrompt,
          imageUrl,
        };

        updatedResearch[itemIndex] = updatedItem;

        console.log(
          `Research item ${i + 1} updated with image URL: ${imageUrl}`
        );
      } catch (error) {
        console.error(
          `Error generating image for research item ${i + 1}:`,
          error
        );
        // Mark the item as should not process with reason for failure
        const updatedItem: ResearchItem = {
          ...currentItem,
          shouldProcess: false,
          skipReason: "failed_image_generation",
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
