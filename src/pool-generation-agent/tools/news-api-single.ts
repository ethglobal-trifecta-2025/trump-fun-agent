/**
 *
 * IMPORTANT: THIS TOOL IS NOT BEING USED RIGHT NOW, DO NOT MODIFY IF YOU'RE DEALING WITH A PRODUCTION ISSUE
 * IT'S A STARTING POINT TO TRAIN OTHER TEAM MEMBERS ON THE AGENT CODE
 * Learning session scheduled for Mar. 26th.
 * Please remove this comment after the single research subgraph is fully implemented
 */
import axios from "axios";
import config from "../../config";
import type { SingleResearchItemState } from "../betting-pool-graph";

interface NewsApiParams {
  q: string; // Search query
  from?: string; // Start date, format YYYY-MM-DD
  to?: string; // End date, format YYYY-MM-DD
  language?: string; // Article language
  sortBy?: "relevancy" | "popularity" | "publishedAt"; // Sorting method
  pageSize?: number; // Number of results to return per page (max 100)
  page?: number; // Page number
}

/**
 * Get yesterday and today dates in YYYY-MM-DD format
 */
function getDefaultDates(): { from: string; to: string } {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    from: formatDate(yesterday),
    to: formatDate(today),
  };
}

/**
 * Function to call the News API for a single research item
 */
export async function newsApiSearchFunctionSingle(
  state: SingleResearchItemState
): Promise<Partial<SingleResearchItemState>> {
  console.log("newsApiSearchFunctionSingle", state.research?.news_search_query);

  const researchItem = state.research;
  if (!researchItem) {
    console.log("No research item to search news for");
    return {
      research: undefined,
    };
  }

  // Check if item should be processed
  if (researchItem.should_process === false) {
    console.log("Item marked as should not process, skipping news search");
    return {
      research: researchItem,
    };
  }

  if (!researchItem.news_search_query) {
    console.log("No search query available for news search");
    return {
      research: {
        ...researchItem,
        should_process: false,
        skip_reason: "no_news_search_query",
      },
    };
  }

  try {
    const defaultDates = getDefaultDates();

    const params: NewsApiParams = {
      q: researchItem.news_search_query,
      from: defaultDates.from,
      to: defaultDates.to,
      language: "en",
      sortBy: "publishedAt",
      pageSize: 10,
    };

    const response = await axios.get("https://newsapi.org/v2/everything", {
      params: {
        ...params,
        apiKey: config.newsApiKey,
      },
    });

    console.log("newsApiSearch response status:", response.status);

    // Extract article titles from the response
    const articles = response.data.articles || [];
    const articleTitles = articles.map((article: any) => article.title);

    return {
      research: {
        ...researchItem,
        related_news: articleTitles,
      },
    };
  } catch (error) {
    console.error("Error calling News API:", error);
    return {
      research: {
        ...researchItem,
        should_process: false,
        skip_reason: "news_search_failed",
      },
    };
  }
}
