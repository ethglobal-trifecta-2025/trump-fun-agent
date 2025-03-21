// Making a request to Truth Social API using Puppeteer with Puppeteer-Stealth and proxies
import { Browser, ConsoleMessage, HTTPRequest, HTTPResponse } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import config from "./config";
import freeProxies from "./free-proxies.json";

// Add stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

// Load proxies from JSON file
interface Proxy {
  ip: string;
  port: string;
  protocols: string[];
  anonymityLevel: string;
  country: string;
  upTime: number;
  speed: number;
}

// Filter proxies by protocol and uptime
function filterProxies(
  proxies: Proxy[],
  protocol: string = "http",
  minUpTime: number = 50
): Proxy[] {
  return proxies.filter(
    (proxy) => proxy.protocols.includes(protocol) && proxy.upTime >= minUpTime
  );
}

// Get a random proxy from the filtered list
function getRandomProxy(filteredProxies: Proxy[]): Proxy | undefined {
  if (filteredProxies.length === 0) {
    return undefined;
  }
  const randomIndex = Math.floor(Math.random() * filteredProxies.length);
  return filteredProxies[randomIndex];
}

// Format proxy string for puppeteer based on protocol
function formatProxyString(proxy: Proxy, protocol: string): string {
  return `${protocol}://${proxy.ip}:${proxy.port}`;
}

export async function fetchWithPuppeteer(
  url: string,
  protocol: string = "http"
) {
  // Load and filter proxies
  const allProxies = freeProxies as Proxy[];
  console.log(`Loaded ${allProxies.length} proxies from file`);

  // First try with higher uptime for better performance
  let filteredProxies = filterProxies(allProxies, protocol, 70);

  // If we don't have enough proxies, lower the threshold
  if (filteredProxies.length < 5) {
    console.log(
      `Not enough ${protocol} proxies with high uptime, lowering threshold...`
    );
    filteredProxies = filterProxies(allProxies, protocol, 50);
  }

  console.log(
    `Found ${filteredProxies.length} ${protocol} proxies with acceptable uptime`
  );

  if (filteredProxies.length === 0) {
    console.error(
      `No ${protocol} proxies found with acceptable uptime. Try another protocol.`
    );
    return null;
  }

  // Try up to 3 different proxies if needed
  const maxProxyAttempts = Math.min(3, filteredProxies.length);
  console.log(`Will try up to ${maxProxyAttempts} different proxies if needed`);

  for (let attempt = 1; attempt <= maxProxyAttempts; attempt++) {
    // Select a random proxy
    const selectedProxy = getRandomProxy(filteredProxies);
    if (!selectedProxy) {
      console.error("Failed to select a proxy");
      return null;
    }

    const proxyServer = formatProxyString(selectedProxy, protocol);
    console.log(`\nAttempt ${attempt}/${maxProxyAttempts}`);
    console.log(
      `Using proxy: ${proxyServer} (Country: ${selectedProxy.country}, Uptime: ${selectedProxy.upTime}%)`
    );

    // Launch browser with proxy
    console.log("Launching browser...");
    let browser: Browser | null = null;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          `--proxy-server=${proxyServer}`,
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

      // Configure request interception for authentication if needed
      if (protocol === "socks4" || protocol === "socks5") {
        await page.setRequestInterception(true);
        page.on("request", (request: HTTPRequest) => {
          const headers = request.headers();
          headers["Accept"] = "application/json";
          request.continue({ headers });
        });
      }

      // Response data storage
      let responseData = null;

      // Response handler
      page.on("response", async (response: HTTPResponse) => {
        if (response.url() === url) {
          console.log(`Response status from event: ${response.status()}`);
          if (response.status() === 200) {
            try {
              const data = await response.json();
              console.log("\nAPI Response Data from event:");
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
              console.log("\nAPI Response Data:");
              console.log(JSON.stringify(responseData, null, 2));
            }
            // Success! No need to try more proxies
            return responseData;
          } catch (e) {
            console.error("Error parsing response JSON:", e);
          }
        } else {
          console.error(`Error: ${statusCode} ${response.statusText()}`);
          // Continue to next proxy since this one failed
        }
      }

      // Wait a bit before closing the browser
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(
        `Error during fetch (attempt ${attempt}/${maxProxyAttempts}):`,
        error
      );
      // Continue to next proxy
    } finally {
      if (browser) {
        await browser.close();
        console.log("Browser closed");
      }
    }

    // If we reach here and it's not the last attempt, we'll try another proxy
    if (attempt < maxProxyAttempts) {
      console.log(`\nTrying another proxy...`);
      // Remove the failed proxy from our list
      filteredProxies = filteredProxies.filter(
        (p) => p.ip !== selectedProxy.ip
      );
      // Wait before trying the next proxy
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(
    "\nAll proxy attempts failed. Try again or use a different protocol."
  );
  return null;
}

// Run the function with specified protocol type if this file is executed directly
if (require.main === module) {
  // Available protocols in the proxy list: http, socks4, socks5
  const proxyProtocol = process.env.PROXY_PROTOCOL || "http";
  const trumpAccountUrl = `${config.truthSocialApiUrl}/accounts/${config.trumpTruthSocialId}/statuses`;
  console.log(`Starting fetching data using ${proxyProtocol} proxy...`);

  fetchWithPuppeteer(trumpAccountUrl, proxyProtocol)
    .then((responseData) => {
      if (responseData) {
        console.log("\nRequest completed successfully");
        console.log(`Retrieved ${responseData.length || 0} posts`);
      } else {
        console.error("\nRequest failed: No response data received");
      }
    })
    .catch((error) => console.error("\nRequest failed:", error));
}

// Export the fetchWithPuppeteer function as default
export default { fetchWithPuppeteer };
