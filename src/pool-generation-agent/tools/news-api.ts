import axios from "axios";
import config from "../../config";
import type { AgentState } from "../betting-pool-graph";

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
 * Function to call the News API
 */
export async function newsApiSearchFunction(state: AgentState) {
  console.log("newsApiSearch", state);
  console.log("newsApiSearchQuery", state.newsApiSearchQuery);

  if (!state.newsApiSearchQuery) {
    return {
      newsApiSearchResults: "No search query available.",
      newsApiSearchFailed: true,
    };
  }

  try {
    const defaultDates = getDefaultDates();

    const params: NewsApiParams = {
      q: state.newsApiSearchQuery,
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

    return {
      newsApiSearchResults: response.data,
      newsApiSearchFailed: false,
    };
  } catch (error) {
    console.error("Error calling News API:", error);
    return {
      newsApiSearchResults: `Error calling News API: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      newsApiSearchFailed: true,
    };
  }
}
