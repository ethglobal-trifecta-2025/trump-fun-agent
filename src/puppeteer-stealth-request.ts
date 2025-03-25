// Making a request to Truth Social API using Puppeteer with Puppeteer-Stealth
import { Browser, ConsoleMessage, HTTPResponse } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Add stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

export async function fetchWithPuppeteer(url: string) {
  console.log(`Starting direct fetch with puppeteer-stealth...`);

  // Launch browser without proxy
  console.log("Launching browser...");
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
      timeout: 60000,
    });

    console.log(`Fetching data from: ${url}`);
    const page = await browser.newPage();

    // Handle console logs from the browser
    page.on("console", (msg: ConsoleMessage) =>
      console.log("Browser console:", msg.text())
    );

    // Set timeout for navigation
    page.setDefaultNavigationTimeout(30000);

    // Set user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    );

    // Response data storage
    let responseData = null;

    // Response handler
    page.on("response", async (response: HTTPResponse) => {
      if (response.url() === url) {
        console.log(`Response status from event: ${response.status()}`);
        if (response.status() === 200) {
          try {
            const data = await response.json();
            // console.log("\nAPI Response Data from event:");
            console.log(JSON.stringify(data, null, 2));
            // Store response data
            responseData = data;
          } catch (e) {
            console.error("Error parsing response JSON from event:", e);
          }
        }
      }
    });

    // Navigate to API endpoint with timeout and wait options
    const response = await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Get response data
    if (response) {
      const statusCode = response.status();
      console.log(`Response status: ${statusCode}`);

      if (statusCode === 200) {
        try {
          // If we already have data from the event, use that
          if (!responseData) {
            responseData = await response.json();
            // console.log("\nAPI Response Data:");
            // console.log(JSON.stringify(responseData, null, 2));
          }
          return responseData;
        } catch (e) {
          console.error("Error parsing response JSON:", e);
        }
      } else {
        console.error(`Error: ${statusCode} ${response.statusText()}`);
      }
    }

    // Wait a bit before closing the browser
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return responseData;
  } catch (error) {
    console.error(`Error during fetch:`, error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
      console.log("Browser closed");
    }
  }
}

// Run the function if this file is executed directly
// if (require.main === module) {
//   const trumpAccountUrl = `${config.truthSocialApiUrl}/accounts/${config.trumpTruthSocialId}/statuses`;
//   console.log(`Starting fetching data...`);

//   fetchWithPuppeteer(trumpAccountUrl)
//     .then((responseData) => {
//       if (responseData) {
//         console.log("\nRequest completed successfully");
//         console.log(`Retrieved ${responseData.length || 0} posts`);
//       } else {
//         console.error("\nRequest failed: No response data received");
//       }
//     })
//     .catch((error) => console.error("\nRequest failed:", error));
// }

// Export the fetchWithPuppeteer function as default
export default { fetchWithPuppeteer };
