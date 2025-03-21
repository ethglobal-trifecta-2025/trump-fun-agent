import type { AgentState } from "../betting-pool-graph";
import config from "../config";

/**
 * Generates Yes/No betting pool questions for each item in the research array in parallel
 * Each question is written in Trump's distinctive communication style
 */
export async function generateBettingPoolIdeas(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("Generating betting pool ideas for research items");

  const researchItems = state.research || [];

  if (researchItems.length === 0) {
    console.log("No research items to generate ideas from");
    return {
      research: [],
    };
  }

  try {
    const llm = config.large_llm;

    // Process each research item in parallel
    const updatedResearchPromises = researchItems.map(async (item) => {
      console.log(
        `Generating betting idea for post: ${item.truthSocialPost.id}`
      );

      // Extract key content from the post
      const postContent = item.truthSocialPost.content.replace(
        /<\/?[^>]+(>|$)/g,
        ""
      ); // Remove HTML tags

      console.log(`Post content: ${postContent.substring(0, 100)}...`);

      // Include any existing research data in the prompt
      const newsInfo = item.relatedNews
        ? `Related news: ${item.relatedNews.join(", ")}`
        : "No related news yet";
      const searchInfo = item.relatedSearchResults
        ? `Related search results: ${item.relatedSearchResults.join(", ")}`
        : "No search results yet";

      const prompt = `
You are creating a Yes/No betting question based on a Truth Social post by Donald Trump.
The question should be written in Trump's distinctive style, using ALL CAPS for emphasis and his characteristic tone.
The question must be a clear Yes/No prediction about something that could happen in the future related to the post.

Truth Social post: "${postContent}"

Research information:
<related_news>
${newsInfo}
</related_news>
<related_web_search_results>
${searchInfo}
</related_web_search_results>

Create a Yes/No question in Trump's style that users can bet on. The question should:
1. Be related to the content of the post
2. Be written in FIRST PERSON as if Trump is asking it
3. Use ALL CAPS for emphasis
4. Include Trump's distinctive phrasing and tone
5. Be clear what a YES or NO outcome would mean
6. Focus on something that will be verifiable in the future

Format your answer as a single Yes/No question with no additional text.
`;

      const response = await llm.invoke(prompt);

      // Extract the betting pool idea from the response
      const responseContent =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);

      let bettingPoolIdea = responseContent.trim();

      // Ensure it ends with a question mark
      if (!bettingPoolIdea.endsWith("?")) {
        bettingPoolIdea += "?";
      }

      console.log(`Generated betting pool idea: ${bettingPoolIdea}`);

      // Return updated research item with the betting pool idea
      return {
        ...item,
        bettingPoolIdea,
      };
    });

    // Wait for all promises to resolve
    const updatedResearch = await Promise.all(updatedResearchPromises);

    console.log(
      `Generated ${updatedResearch.length} betting pool ideas in parallel`
    );

    return {
      research: updatedResearch,
    };
  } catch (error) {
    console.error("Error generating betting pool ideas:", error);
    return {
      research: researchItems,
    };
  }
}
