/**
 * Documentation Fetcher Service
 * Fetches documentation from shadcn-svelte.com using a two-strategy approach:
 * 1. Direct .md fetch (fastest, preferred)
 * 2. Cheerio + Turndown HTML conversion (fallback)
 */

import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { getFromCache, saveToCache } from "./cache-manager.js";
import { fetchWithTimeout } from "./http.js";

// Configuration
const SHADCN_BASE_URL = "https://www.shadcn-svelte.com";

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
  baseUrl?: string;
}

export interface DocumentMetadata {
  title?: string;
  description?: string;
  author?: string;
  keywords?: string[];
  ogImage?: string;
  url?: string;
}

export interface FetchResult {
  success: boolean;
  content?: string; // Markdown content
  html?: string;
  metadata?: DocumentMetadata;
  bitsUiUrl?: string; // Link to the Bits UI primitive docs (if any)
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
 * Tries to fetch text-based endpoints directly (for components/docs)
 */
async function tryFetchMarkdown(url: string): Promise<FetchResult | null> {
  try {
    const textUrl =
      url.endsWith(".md") || url.endsWith(".txt") ? url : `${url}.md`;

    console.log(`[Fetcher] Trying direct text fetch: ${textUrl}`);
    const response = await fetchWithTimeout(textUrl);

    if (response.ok) {
      let markdown = await response.text();

      // Unescape the markdown content (fixes escaped quotes from .md sources)
      markdown = unescapeMarkdown(markdown);

      // Extract title from first heading if possible
      const titleMatch = markdown.match(/^#\s+(.+)$/m);

      // Extract the Bits UI primitive link from the markdown if present
      const bitsUiMatch = markdown.match(
        /https:\/\/bits-ui\.com\/docs\/components\/[a-z-]+/,
      );

      console.log(`[Fetcher] ✓ Direct text fetch successful: ${textUrl}`);
      return {
        success: true,
        content: markdown,
        metadata: {
          title: titleMatch ? titleMatch[1] : undefined,
          url: textUrl,
        },
        bitsUiUrl: bitsUiMatch ? bitsUiMatch[0] : undefined,
      };
    }

    // 404 or other error, return null to try HTML fallback
    console.log(
      `[Fetcher] ✗ text endpoint not found (${response.status}): ${textUrl}`,
    );
    return null;
  } catch (error) {
    console.log(`[Fetcher] ✗ Error fetching text endpoint: ${error}`);
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
      "nav, footer, aside, script, style, .navigation, .sidebar, header",
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

    console.log(`[Fetcher] ✓ HTML fetch and conversion successful: ${url}`);
    return {
      success: true,
      content: markdown,
      html: content,
      metadata,
      bitsUiUrl: $('a[href*="bits-ui.com/docs/components/"]')
        .first()
        .attr("href"),
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
 * Fetches documentation with caching.
 * Strategy order:
 * 1. Cache (if enabled)
 * 2. Direct .md endpoint (fastest for components)
 * 3. HTML scraping + conversion (fallback)
 */
export async function fetchUrl(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResult> {
  const { useCache = true } = options;

  // Check cache first if enabled
  if (useCache) {
    const cached = await getFromCache<FetchResult>(url);
    if (cached) {
      console.log(`[Fetcher] ✓ Retrieved from cache: ${url}`);
      return cached;
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

  // Strategy 2: Fall back to simple HTML scraping + conversion
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
  options?: FetchOptions,
): Promise<FetchResult> {
  const url = `${SHADCN_BASE_URL}/docs/components/${componentName}`;
  return fetchUrl(url, options);
}

/**

 * Fetches general documentation page
 */
export async function fetchGeneralDocs(
  path: string,
  options?: FetchOptions,
): Promise<FetchResult> {
  const baseUrl = options?.baseUrl || SHADCN_BASE_URL;
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  return fetchUrl(url, options);
}
