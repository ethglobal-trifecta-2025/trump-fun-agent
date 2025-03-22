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
  transactionHash?: string; // Blockchain transaction hash from creating the betting pool
  poolId?: string; // ID of the betting pool on the smart contract
  shouldProcess?: boolean; // Flag to indicate if this item should be processed further
  skipReason?: string; // Reason why the item was marked for skipping (e.g., "already_processed", "too_old")
  imagePrompt?: string; // Generated prompt for image creation
  imageUrl?: string; // URL of the generated image
}
