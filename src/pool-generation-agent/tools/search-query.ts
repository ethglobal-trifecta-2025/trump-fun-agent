import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import config from "../../config";
import type { AgentState } from "../betting-pool-graph";

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
export async function extractSearchQueryFunction(state: AgentState) {
  console.log("extract_query initial state", state);
  const originalMessage = state.originalMessage;

  const structuredLlm = config.large_llm.withStructuredOutput(
    searchQuerySchema,
    {
      name: "extractSearchQuery",
    }
  );

  // Format the input with the prompt
  const formattedPrompt = await extractSearchQueryPrompt.formatMessages({
    input: originalMessage,
  });

  // Call the LLM with the formatted prompt
  const result = await structuredLlm.invoke(formattedPrompt);
  console.log("result in extract_query", result);

  // Set the same search query for both Tavily and News API
  return {
    tavilySearchQuery: result.searchQuery,
    newsApiSearchQuery: result.searchQuery,
  };
}
