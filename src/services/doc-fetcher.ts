/**
 * Documentation Fetcher Service
 * Fetches documentation from shadcn-svelte.com using multi-strategy approach:
 * 1. Direct .md fetch for components
 * 2. Crawlee (Playwright) for JavaScript-heavy pages
 * 3. Cheerio + Turndown for simple HTML pages (fallback)
 */

import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { PlaywrightCrawler, Dataset, Configuration } from "crawlee";
import { getFromCache, saveToCache } from "./cache-manager.js";

// Configuration
const SHADCN_BASE_URL = "https://www.shadcn-svelte.com";
const FETCH_TIMEOUT = 30000; // 30 seconds
const CRAWLEE_TIMEOUT = 45000; // 45 seconds for Crawlee (needs more time for browser)

// Initialize Turndown service for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  fence: "```",
  emDelimiter: "*",
  strongDelimiter: "**",
  linkStyle: "inlined",
});

// Types
export interface FetchOptions {
  useCache?: boolean;
  timeout?: number;
  includeMetadata?: boolean;
  includeCodeBlocks?: boolean;
}

export interface DocumentMetadata {
  title?: string;
  description?: string;
  author?: string;
  keywords?: string[];
  ogImage?: string;
  url?: string;
  lastModified?: string;
}

export interface FetchResult {
  success: boolean;
  content?: string; // Markdown content
  markdown?: string; // Deprecated: use content instead
  html?: string;
  metadata?: DocumentMetadata;
  warnings?: string[];
  notes?: string[];
  type?: "component" | "doc" | "block" | "chart" | "theme" | "unknown";
  source?: "cache" | "md" | "html" | "crawlee";
  codeBlocks?: Array<{
    language?: string;
    code: string;
    title?: string;
  }>;
  error?: string;
}

/**
 * Unescapes common escape sequences in Markdown content
 * Fixes escaped quotes in code blocks from .md sources
 */
function unescapeMarkdown(markdown: string): string {
  // Unescape quotes in the content
  // This fixes the issue where .md files from shadcn-svelte.com have \" instead of "
  return markdown
    .replace(/\\"/g, '"') // \" → "
    .replace(/\\'/g, "'") // \' → '
    .replace(/&apos;/g, "'"); // &apos; → '
}

/**
 * Fetches a URL with timeout support
 */
async function fetchWithTimeout(
  url: string,
  timeout: number = FETCH_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "shadcn-svelte-mcp/1.0.0 (Documentation Fetcher; +https://github.com/your-repo)",
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Tries to fetch .md endpoint directly (for components)
 */
async function tryFetchMarkdown(url: string): Promise<FetchResult | null> {
  try {
    // Convert regular URL to .md URL
    const mdUrl = url.endsWith(".md") ? url : `${url}.md`;

    console.log(`[Fetcher] Trying direct .md fetch: ${mdUrl}`);
    const response = await fetchWithTimeout(mdUrl);

    if (response.ok) {
      let markdown = await response.text();

      // Unescape the markdown content (fixes escaped quotes from .md sources)
      markdown = unescapeMarkdown(markdown);

      // Extract title from first heading if possible
      const titleMatch = markdown.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : undefined;

      console.log(`[Fetcher] ✓ Direct .md fetch successful: ${mdUrl}`);
      return {
        success: true,
        content: markdown,
        markdown, // Deprecated: keep for backward compatibility
        metadata: {
          title,
          url: mdUrl,
        },
        type: "component",
        source: "md",
      };
    }

    // 404 or other error, return null to try HTML fallback
    console.log(
      `[Fetcher] ✗ .md endpoint not found (${response.status}): ${mdUrl}`
    );
    return null;
  } catch (error) {
    console.log(`[Fetcher] ✗ Error fetching .md: ${error}`);
    return null;
  }
}

/**
 * Fetches HTML and converts to Markdown using cheerio + turndown
 */
async function fetchHtmlAndConvert(url: string): Promise<FetchResult> {
  try {
    console.log(`[Fetcher] Fetching HTML: ${url}`);
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract comprehensive metadata
    const metadata = extractMetadata($, url);

    // Remove navigation, footer, header, and other non-content elements
    $(
      "nav, footer, aside, script, style, .navigation, .sidebar, header"
    ).remove();

    // Try to find main content area with improved selectors for SPA-style pages
    // For landing pages (charts, themes, colors, blocks), extract specific content sections
    let content = "";

    // Try to get content from main sections, excluding shell elements
    const mainSections = $("main > section, main > .container-wrapper");
    if (mainSections.length > 0) {
      // Found main content sections - extract them
      mainSections.each((_, elem) => {
        content += $.html(elem);
      });
    } else {
      // Fallback to traditional selectors
      content =
        $("main").html() || $("article").html() || $("body").html() || "";
    }

    if (!content || content.trim().length === 0) {
      throw new Error("Could not find main content in HTML");
    }

    // Convert HTML to Markdown
    const markdown = turndownService.turndown(content);

    // Extract code blocks from markdown
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const codeBlocks: Array<{ language?: string; code: string }> = [];
    let match;
    while ((match = codeBlockRegex.exec(markdown)) !== null) {
      codeBlocks.push({
        language: match[1] || undefined,
        code: match[2].trim(),
      });
    }

    // Determine content type from URL
    let type: FetchResult["type"] = "unknown";
    if (url.includes("/docs/components/")) type = "component";
    else if (url.includes("/docs/")) type = "doc";
    else if (url.includes("/blocks")) type = "block";
    else if (url.includes("/charts")) type = "chart";
    else if (url.includes("/themes")) type = "theme";

    console.log(`[Fetcher] ✓ HTML fetch and conversion successful: ${url}`);
    return {
      success: true,
      content: markdown,
      markdown, // Deprecated: keep for backward compatibility
      html: content,
      metadata,
      type,
      codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined,
      source: "html",
    };
  } catch (error) {
    console.error(`[Fetcher] Error fetching HTML for ${url}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetches documentation using Crawlee (Playwright) for JavaScript-heavy pages
 * This handles modern SPAs and dynamic content that Cheerio can't handle
 */
async function tryFetchWithCrawlee(url: string): Promise<FetchResult | null> {
  try {
    console.log(`[Fetcher] Trying Crawlee (Playwright) fetch: ${url}`);

    // Disable Crawlee's default storage to prevent file system clutter
    Configuration.getGlobalConfig().set("persistStorage", false);

    // Use a container object to work around TypeScript closure issues
    const result: { data: FetchResult | null } = { data: null };

    const crawler = new PlaywrightCrawler({
      maxRequestsPerCrawl: 1,
      requestHandlerTimeoutSecs: CRAWLEE_TIMEOUT / 1000,
      headless: true,
      launchContext: {
        launchOptions: {
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      },
      async requestHandler({ page, request }) {
        try {
          // Wait for the page to be fully loaded
          await page.waitForLoadState("networkidle", {
            timeout: CRAWLEE_TIMEOUT,
          });

          // Get the page HTML
          const html = await page.content();
          const $ = cheerio.load(html);

          // Extract metadata
          const metadata = extractMetadata($, url);

          // Remove unwanted elements
          $(
            "nav, footer, aside, script, style, .navigation, .sidebar, header"
          ).remove();

          // Try to find main content area with improved selectors
          let content = "";
          const mainSections = $(
            "main > section, main > .container-wrapper, main > div.content"
          );

          if (mainSections.length > 0) {
            mainSections.each((_, elem) => {
              content += $.html(elem);
            });
          } else {
            content =
              $("main").html() || $("article").html() || $("body").html() || "";
          }

          if (!content || content.trim().length === 0) {
            throw new Error("Could not find main content in HTML");
          }

          // Convert HTML to Markdown
          const markdown = turndownService.turndown(content);

          // Extract code blocks
          const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
          const codeBlocks: Array<{ language?: string; code: string }> = [];
          let match;
          while ((match = codeBlockRegex.exec(markdown)) !== null) {
            codeBlocks.push({
              language: match[1] || undefined,
              code: match[2].trim(),
            });
          }

          // Determine content type
          let type: FetchResult["type"] = "unknown";
          if (url.includes("/docs/components/")) type = "component";
          else if (url.includes("/docs/")) type = "doc";
          else if (url.includes("/blocks")) type = "block";
          else if (url.includes("/charts")) type = "chart";
          else if (url.includes("/themes")) type = "theme";

          result.data = {
            success: true,
            content: markdown,
            markdown,
            html: content,
            metadata,
            type,
            codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined,
            source: "crawlee",
          };
        } catch (error) {
          console.error(`[Fetcher] Error in Crawlee request handler:`, error);
          result.data = {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
      failedRequestHandler({ request }, error) {
        console.error(
          `[Fetcher] Crawlee request failed for ${request.url}:`,
          error
        );
        result.data = {
          success: false,
          error: error.message,
        };
      },
    });

    await crawler.run([url]);

    if (!result.data) {
      console.log(`[Fetcher] ✗ Crawlee returned no data: ${url}`);
      return null;
    }

    console.log(
      `[Fetcher] ${result.data.success ? "✓" : "✗"} Crawlee fetch ${result.data.success ? "successful" : "failed"}: ${url}`
    );
    return result.data;
  } catch (error) {
    console.log(`[Fetcher] ✗ Crawlee error: ${error}`);
    return null;
  }
}

/**
 * Extracts metadata from HTML cheerio object
 */
function extractMetadata($: cheerio.CheerioAPI, url: string): DocumentMetadata {
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text() ||
    $("h1").first().text() ||
    undefined;

  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    undefined;

  const author =
    $('meta[name="author"]').attr("content") ||
    $('meta[property="og:author"]').attr("content") ||
    undefined;

  const ogImage = $('meta[property="og:image"]').attr("content") || undefined;

  const keywordsStr = $('meta[name="keywords"]').attr("content");
  const keywords = keywordsStr
    ? keywordsStr.split(",").map((k) => k.trim())
    : undefined;

  return {
    title,
    description,
    author,
    ogImage,
    url,
    keywords,
  };
}

/**
 * Fetches documentation using multi-strategy approach with caching
 * Strategy order:
 * 1. Cache (if enabled)
 * 2. Direct .md endpoint (fastest for components)
 * 3. Crawlee with Playwright (best for JavaScript-heavy pages)
 * 4. Simple HTML scraping + conversion (fallback for simple pages)
 */
export async function fetchUrl(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const {
    useCache = true,
    timeout = FETCH_TIMEOUT,
    includeMetadata = true,
  } = options;

  // Check cache first if enabled
  if (useCache) {
    const cached = await getFromCache<FetchResult>(url);
    if (cached) {
      console.log(`[Fetcher] ✓ Retrieved from cache: ${url}`);
      return { ...cached, source: "cache" };
    }
  }

  // Strategy 1: Try direct .md endpoint first (fastest for components)
  const mdResult = await tryFetchMarkdown(url);
  if (mdResult) {
    // Cache the result
    if (useCache) {
      await saveToCache(url, mdResult);
    }
    return mdResult;
  }

  // Strategy 2: Use Crawlee for JavaScript-heavy pages (charts, themes, blocks)
  // These pages require JavaScript to render properly
  const isJsHeavyPage =
    url.includes("/charts") ||
    url.includes("/themes") ||
    url.includes("/blocks") ||
    url.includes("/colors");

  if (isJsHeavyPage) {
    const crawleeResult = await tryFetchWithCrawlee(url);
    if (crawleeResult && crawleeResult.success) {
      // Cache the result
      if (useCache) {
        await saveToCache(url, crawleeResult);
      }
      return crawleeResult;
    }
  }

  // Strategy 3: Fall back to simple HTML scraping + conversion
  const htmlResult = await fetchHtmlAndConvert(url);

  // Cache the result if successful
  if (htmlResult.success && useCache) {
    await saveToCache(url, htmlResult);
  }

  return htmlResult;
}

/**
 * Fetches component documentation from shadcn-svelte.com
 */
export async function fetchComponentDocs(
  componentName: string,
  options?: FetchOptions
): Promise<FetchResult> {
  const url = `${SHADCN_BASE_URL}/docs/components/${componentName}`;
  return fetchUrl(url, options);
}

/**
 * Fetches installation guide documentation
 */
export async function fetchInstallationDocs(
  framework?: string,
  options?: FetchOptions
): Promise<FetchResult> {
  const path = framework
    ? `/docs/installation/${framework}`
    : "/docs/installation";
  const url = `${SHADCN_BASE_URL}${path}`;
  return fetchUrl(url, options);
}

/**
 * Fetches general documentation page
 */
export async function fetchGeneralDocs(
  path: string,
  options?: FetchOptions
): Promise<FetchResult> {
  const url = `${SHADCN_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  return fetchUrl(url, options);
}

/**
 * Discovers URLs from a website by scraping the sitemap or homepage links
 * Note: This is a basic implementation. For comprehensive crawling, consider using a dedicated crawler.
 */
export async function discoverUrls(
  baseUrl: string = SHADCN_BASE_URL,
  options: {
    search?: string;
    limit?: number;
  } = {}
): Promise<{ urls: string[]; success: boolean; error?: string }> {
  try {
    console.log(`[Fetcher] Discovering URLs from ${baseUrl}`);

    // Try fetching sitemap first
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    try {
      const response = await fetchWithTimeout(sitemapUrl);
      if (response.ok) {
        const xml = await response.text();
        const $ = cheerio.load(xml, { xmlMode: true });
        const urls = $("loc")
          .map((_, el) => $(el).text())
          .get();

        console.log(`[Fetcher] ✓ Discovered ${urls.length} URLs from sitemap`);
        return { urls: urls.slice(0, options.limit || 100), success: true };
      }
    } catch (error) {
      console.log("[Fetcher] No sitemap found, trying homepage links");
    }

    // Fallback: scrape homepage for links
    const response = await fetchWithTimeout(baseUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const urls: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        // Convert relative URLs to absolute
        const absoluteUrl = new URL(href, baseUrl).href;
        // Only include URLs from the same domain
        if (absoluteUrl.startsWith(baseUrl)) {
          urls.push(absoluteUrl);
        }
      }
    });

    // Apply search filter if provided
    let filteredUrls = urls;
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filteredUrls = urls.filter((url) =>
        url.toLowerCase().includes(searchLower)
      );
    }

    // Deduplicate and limit
    const uniqueUrls = [...new Set(filteredUrls)].slice(
      0,
      options.limit || 100
    );

    console.log(
      `[Fetcher] ✓ Discovered ${uniqueUrls.length} URLs from homepage`
    );
    return { urls: uniqueUrls, success: true };
  } catch (error) {
    console.error(`[Fetcher] Error discovering URLs from ${baseUrl}:`, error);
    return {
      urls: [],
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Tests the fetcher by trying to fetch a known documentation page
 */
export async function testConnection(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    console.log("[Fetcher] Testing connection...");
    const result = await fetchUrl(`${SHADCN_BASE_URL}/docs`, {
      useCache: false,
      timeout: 10000,
    });

    if (result.success && result.markdown) {
      return {
        success: true,
        message: `Successfully fetched documentation (source: ${result.source})`,
      };
    } else {
      return {
        success: false,
        message: result.error || "Failed to fetch test URL",
      };
    }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Connection test failed",
    };
  }
}

// Export configuration for other modules
export const config = {
  SHADCN_BASE_URL,
  FETCH_TIMEOUT,
};
