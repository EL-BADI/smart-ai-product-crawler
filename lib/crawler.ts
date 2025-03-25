import puppeteer, { Browser, Page } from "puppeteer";
import { URL } from "url";
import { normalizeUrl, isValidUrl, isResourceUrl } from "./urlUtils";
import { model } from "./initAi";

// Define interfaces
interface ProductData {
  name: string;
  price: string;
  description: string;
  url: string;
  imageUrl?: string;
}

interface CrawlResult {
  products: ProductData[];
  visitedUrls: string[];
  error?: string;
}

interface PageAnalysis {
  pageType: "product" | "listing" | "category" | "other";
  product?: ProductData;
  productLinks?: string[];
  paginationLinks?: string[];
  categoryLinks?: string[];
  otherRelevantLinks?: string[];
}

// Maximum pages to crawl to prevent infinite loops
const MAX_PAGES = 100;

let browser: Browser | null = null;
const pagePool: Page[] = [];
const MAX_CONCURRENT_PAGES = 3;

// Add these constants at the top with other constants
const CONCURRENT_CRAWLS = 3; // Number of parallel crawls
const BATCH_SIZE = 5; // Size of URL batches to process together

// Add this new interface
interface PendingUrl {
  url: string;
  priority: number; // Higher number = higher priority
}

async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    // Initialize page pool
    for (let i = 0; i < MAX_CONCURRENT_PAGES; i++) {
      const page = await browser.newPage();
      pagePool.push(page);
    }
  }
  return browser;
}

async function getPage(): Promise<Page> {
  if (pagePool.length > 0) {
    return pagePool.pop()!;
  }
  return await browser!.newPage();
}

async function releasePage(page: Page) {
  if (pagePool.length < MAX_CONCURRENT_PAGES) {
    pagePool.push(page);
  } else {
    await page.close();
  }
}

function getBaseDomain(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch {
    return "";
  }
}

export async function crawlWebsite(
  startUrl: string,
  maxPages: number
): Promise<CrawlResult> {
  if (!isValidUrl(startUrl)) {
    return { products: [], visitedUrls: [], error: "Invalid start URL" };
  }

  const baseDomain = getBaseDomain(startUrl);
  console.log(`Crawling only within domain: ${baseDomain}`);
  const normalizedStartUrl = normalizeUrl(startUrl);
  const visitedUrls = new Set<string>([normalizedStartUrl]);
  const pendingUrls: PendingUrl[] = [{ url: normalizedStartUrl, priority: 1 }];
  const products: ProductData[] = [];
  const seenProductUrls = new Set<string>();
  const urlCache = new Map<string, PageAnalysis>(); // Cache for analyzed URLs

  try {
    await initBrowser();

    while (pendingUrls.length > 0 && visitedUrls.size < maxPages) {
      // Sort pending URLs by priority
      pendingUrls.sort((a, b) => b.priority - a.priority);

      // Take a batch of URLs to process
      const currentBatch = pendingUrls.splice(0, BATCH_SIZE);

      // Process batch in parallel
      const batchResults = await Promise.all(
        chunk(currentBatch, CONCURRENT_CRAWLS).map(async (urls) => {
          return Promise.all(
            urls.map(async ({ url }) => {
              const startTime = Date.now();

              if (isResourceUrl(url)) {
                return null;
              }

              try {
                const pageResult = await fetchPage(url);
                if (!pageResult) return null;

                const { html, links, baseUrl } = pageResult;

                // Use cached analysis if available
                let pageAnalysis = urlCache.get(url);
                if (!pageAnalysis) {
                  pageAnalysis = await analyzePageWithGemini(html, url, links);
                  urlCache.set(url, pageAnalysis);
                }

                // Process product data
                if (
                  pageAnalysis.pageType === "product" &&
                  pageAnalysis.product
                ) {
                  const normalizedProductUrl = normalizeUrl(url);
                  if (!seenProductUrls.has(normalizedProductUrl)) {
                    products.push({
                      ...pageAnalysis.product,
                      url: normalizedProductUrl,
                    });
                    seenProductUrls.add(normalizedProductUrl);
                  }
                }

                // Process and prioritize new URLs
                const newUrls = processNewUrls(
                  links,
                  baseUrl,
                  baseDomain,
                  visitedUrls,
                  pageAnalysis
                );

                // Add new URLs to pending queue with priorities
                newUrls.forEach((newUrl) => {
                  if (!visitedUrls.has(newUrl.url)) {
                    visitedUrls.add(newUrl.url);
                    pendingUrls.push(newUrl);
                  }
                });

                const endTime = Date.now();
                console.log(
                  `Completed ${url} - Time taken: ${
                    (endTime - startTime) / 1000
                  }s`
                );

                return pageAnalysis;
              } catch (error) {
                console.error(`Error processing ${url}:`, error);
                return null;
              }
            })
          );
        })
      );
    }

    return {
      products: deduplicateProducts(products),
      visitedUrls: Array.from(visitedUrls),
    };
  } finally {
    await cleanup();
  }
}

// Add these new helper functions
function chunk<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
}

function processNewUrls(
  links: string[],
  baseUrl: string,
  baseDomain: string,
  visitedUrls: Set<string>,
  pageAnalysis: PageAnalysis
): PendingUrl[] {
  const newUrls: PendingUrl[] = [];

  const processUrl = (url: string, priority: number) => {
    try {
      const normalizedLink = normalizeUrl(new URL(url, baseUrl).href);
      if (
        getBaseDomain(normalizedLink) === baseDomain &&
        !visitedUrls.has(normalizedLink)
      ) {
        newUrls.push({ url: normalizedLink, priority });
      }
    } catch {}
  };

  // Prioritize URLs based on their type
  pageAnalysis.productLinks?.forEach((url) => processUrl(url, 3));
  pageAnalysis.paginationLinks?.forEach((url) => processUrl(url, 2));
  pageAnalysis.categoryLinks?.forEach((url) => processUrl(url, 2));
  pageAnalysis.otherRelevantLinks?.forEach((url) => processUrl(url, 1));

  return newUrls;
}

async function cleanup() {
  if (browser) {
    for (const page of pagePool) {
      await page.close();
    }
    await browser.close();
    browser = null;
  }
}

// Update the fetchPage function to handle redirects
async function fetchPage(url: string) {
  const page = await getPage();
  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36"
    );

    const response = await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Skip if page returns 404
    if (response?.status() === 404) {
      console.log(`Skipping ${url} - 404 Not Found`);
      return null;
    }

    // Handle redirects
    const finalUrl = normalizeUrl(response?.url() || url);

    await page.waitForSelector("body", { timeout: 5000 });

    const html = await page.content();
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a"))
        .map((a) => a.href)
        .filter((href) => href && !href.startsWith("javascript:"));
    });

    return { html, links, baseUrl: finalUrl };
  } finally {
    await releasePage(page);
  }
}

async function analyzePageWithGemini(
  html: string,
  url: string,
  allLinks: string[]
): Promise<PageAnalysis> {
  try {
    // Truncate HTML to avoid token limits
    const truncatedHtml =
      html.length > 15000 ? html.substring(0, 15000) + "..." : html;

    // First send a small sample of links for classification
    const linksSample = allLinks.slice(0, 100).join("\n");

    const prompt = `
You are an e-commerce data extraction system analyzing a web page with the URL: ${url}
HTML content: 
${truncatedHtml}

Links found on the page:
${linksSample}

Please analyze this content and respond in JSON format with the following:
1. Determine if this is a product page, a listing page, a category page, or another type of page
2. If it's a product page, extract the product name, price, and description
3. Classify all links on the page into these categories:
   - productLinks: Links that lead to individual product pages
   - paginationLinks: Links that navigate to different pages of the same product listing (next page, previous page, page numbers)
   - categoryLinks: Links to product categories or collections
   - otherRelevantLinks: Any other links that might be relevant for e-commerce crawling (but are not products, pagination, or categories)

Your goal is to help a crawler navigate through the site to discover all products efficiently.

Response format:
{
  "pageType": "product" or "listing" or "category" or "other",
  "product": {
    "name": "Product Name",
    "price": "Price",
    "description": "Description"
  },
  "productLinks": ["link1", "link2", ...],
  "paginationLinks": ["link1", "link2", ...],
  "categoryLinks": ["link1", "link2", ...],
  "otherRelevantLinks": ["link1", "link2", ...]
}
`;

    const text = await model(prompt);

    // Parse the JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : text;
      const analysis = JSON.parse(jsonString);

      return {
        pageType: analysis.pageType || "other",
        product: analysis.product,
        productLinks: analysis.productLinks || [],
        paginationLinks: analysis.paginationLinks || [],
        categoryLinks: analysis.categoryLinks || [],
        otherRelevantLinks: analysis.otherRelevantLinks || [],
      };
    } catch (parseError) {
      console.error("Error parsing Gemini response:", parseError);
      return { pageType: "other" };
    }
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return { pageType: "other" };
  }
}

// Helper to deduplicate products by URL
function deduplicateProducts(products: ProductData[]): ProductData[] {
  const uniqueProducts = new Map<string, ProductData>();

  for (const product of products) {
    if (!uniqueProducts.has(product.url)) {
      uniqueProducts.set(product.url, product);
    }
  }

  return Array.from(uniqueProducts.values());
}
