/**
 * Configuration module for environment variables
 */

import { ChatAnthropic } from "@langchain/anthropic";

/**
 * Checks if an environment variable is set and returns its value
 * Throws an error if the variable is not set
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  return value;
}

// Required API keys
export const TAVILY_API_KEY = requireEnv("TAVILY_API_KEY");
export const OPENAI_API_KEY = requireEnv("OPENAI_API_KEY");
export const ANTHROPIC_API_KEY = requireEnv("ANTHROPIC_API_KEY");
export const NEWS_API_KEY = requireEnv("NEWS_API_KEY");

// Initialize models
const small_llm = new ChatAnthropic({
  modelName: "claude-3-5-haiku-20241022",
  anthropicApiKey: ANTHROPIC_API_KEY,
});

const large_llm = new ChatAnthropic({
  modelName: "claude-3-7-sonnet-20250219",
  anthropicApiKey: ANTHROPIC_API_KEY,
});

// Export config object for convenience
export const config = {
  tavilyApiKey: TAVILY_API_KEY,
  openaiApiKey: OPENAI_API_KEY,
  anthropicApiKey: ANTHROPIC_API_KEY,
  newsApiKey: NEWS_API_KEY,
  truthSocialApiUrl:
    process.env.TRUTH_SOCIAL_API_URL || "https://truthsocial.com/api/v1",
  trumpTruthSocialId: process.env.TRUMP_TRUTH_SOCIAL_ID || "107780257626128497",
  small_llm,
  large_llm,
};

console.log("config", config);

export default config;
