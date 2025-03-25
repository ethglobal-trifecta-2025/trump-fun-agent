import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import config from "../../config";
import type { SingleResearchItemState } from "../betting-pool-graph";

// Define schema for search query
const searchQuerySchema = z.object({
  searchQuery: z.string().describe("Query optimized for web search"),
});

const extractSearchQueryPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an expert at extracting search queries from user input. 
Your job is to take a user's input and extract a concise, clear search query that would best address their information need.

Follow these guidelines:
1. Extract only the essential search terms needed to find relevant information
2. Remove filler words and unnecessary context
3. Focus on the specific question or information being requested
4. Format your response as a concise search query
5. DO NOT explain your reasoning or add any additional text
6. Return ONLY the search query with no additional formatting

You should return just the search query text that would be sent to a search engine, nothing else.`,
  ],
  ["human", "{input}"],
]);

// Extract search query function using structured output
export async function extractSearchQueryFunctionSingle(
  state: SingleResearchItemState
): Promise<Partial<SingleResearchItemState>> {
  console.log("extract_query_single initial state", state);

  const researchItem = state.research;
  if (!researchItem) {
    console.log("No research item to extract search query for");
    return {
      research: undefined,
    };
  }

  // Check if item should be processed
  if (researchItem.should_process === false) {
    console.log(
      "Item marked as should not process, skipping search query extraction"
    );
    return {
      research: researchItem,
    };
  }

  const structuredLlm = config.large_llm.withStructuredOutput(
    searchQuerySchema,
    {
      name: "extractSearchQuery",
    }
  );

  // Format the input with the prompt
  const formattedPrompt = await extractSearchQueryPrompt.formatMessages({
    input: researchItem.truth_social_post.content,
  });

  // Call the LLM with the formatted prompt
  const result = await structuredLlm.invoke(formattedPrompt);
  console.log("result in extract_query_single", result);

  // Set the same search query for both Tavily and News API
  return {
    research: {
      ...researchItem,
      tavily_search_query: result.searchQuery,
      news_search_query: result.searchQuery,
    },
  };
}
