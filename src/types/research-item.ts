import type { TruthSocialPost } from "./truth-social-post";

/**
 * Represents a research item containing a Truth Social post and related data
 * for generating betting pool ideas
 */
export interface ResearchItem {
  truthSocialPost: TruthSocialPost;
  relatedNews?: string[];
  relatedSearchResults?: string[];
  bettingPoolIdea?: string;
  newsSearchQuery?: string;
  tavilySearchQuery?: string;
}
