/**
 * Documentation Fetcher Service
 * Fetches documentation from shadcn-svelte.com using dual strategy:
 * 1. Direct .md fetch for components
 * 2. Cheerio + Turndown for HTML pages
 */

import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { getFromCache, saveToCache } from "./cache-manager.js";

// Configuration
const SHADCN_BASE_URL = "https://www.shadcn-svelte.com";
const FETCH_TIMEOUT = 30000; // 30 seconds

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
}

export interface FetchResult {
  success: boolean;
  markdown?: string;
  html?: string;
  title?: string;
  source?: "cache" | "md" | "html";
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
    .replace(/\\"/g, '"')  // \" → "
    .replace(/\\'/g, "'")  // \' → '
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
        markdown,
        title,
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

    // Extract title
    const title = $("title").text() || $("h1").first().text() || undefined;

    // Remove navigation, footer, and other non-content elements
    $("nav, footer, aside, script, style, .navigation, .sidebar").remove();

    // Try to find main content area (common patterns for shadcn-svelte.com)
    let content = $("main").html() || $("article").html() || $("body").html();

    if (!content) {
      throw new Error("Could not find main content in HTML");
    }

    // Convert HTML to Markdown
    const markdown = turndownService.turndown(content);

    console.log(`[Fetcher] ✓ HTML fetch and conversion successful: ${url}`);
    return {
      success: true,
      markdown,
      html: content,
      title,
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
 * Fetches documentation using dual strategy with caching
 */
export async function fetchUrl(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const { useCache = true, timeout = FETCH_TIMEOUT } = options;

  // Check cache first if enabled
  if (useCache) {
    const cached = await getFromCache<FetchResult>(url);
    if (cached) {
      return { ...cached, source: "cache" };
    }
  }

  // Strategy 1: Try direct .md endpoint first
  const mdResult = await tryFetchMarkdown(url);
  if (mdResult) {
    // Cache the result
    if (useCache) {
      await saveToCache(url, mdResult);
    }
    return mdResult;
  }

  // Strategy 2: Fall back to HTML scraping + conversion
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
