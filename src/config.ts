/**
 * Configuration module for environment variables
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types/database.types";

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
const openaiApiKey = requireEnv("OPENAI_API_KEY");
const anthropicApiKey = requireEnv("ANTHROPIC_API_KEY");

// Initialize models
const small_llm = new ChatAnthropic({
  modelName: "claude-3-5-haiku-20241022",
  anthropicApiKey: anthropicApiKey,
});

const large_llm = new ChatAnthropic({
  modelName: "claude-3-7-sonnet-20250219",
  anthropicApiKey: anthropicApiKey,
});

// Export config object for convenience
export const config = {
  openaiApiKey,
  anthropicApiKey,
  tavilyApiKey: requireEnv("TAVILY_API_KEY"),
  newsApiKey: requireEnv("NEWS_API_KEY"),
  truthSocialApiUrl:
    process.env.TRUTH_SOCIAL_API_URL || "https://truthsocial.com/api/v1",
  trumpTruthSocialId: process.env.TRUMP_TRUTH_SOCIAL_ID || "107780257626128497",
  small_llm,
  large_llm,
};

export const supabase = createClient<Database>(
  requireEnv("SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_KEY")
);

export default config;
