/**
 * shadcn-svelte-search
 *
 * Search tool for finding shadcn-svelte components, blocks, charts, and documentation
 * by keyword or phrase. Uses local string matching over cached site map data for
 * cost-effective search without AI.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { fetchUrl } from "../../services/doc-fetcher.js";

// Types
interface SiteMapEntry {
  url: string;
  title?: string;
  description?: string;
  keywords?: string[];
  type?: string;
}

interface SearchResult {
  title: string;
  url: string;
  description?: string;
  keywords?: string[];
  type: string;
  score: number;
}

// In-memory cache for site map (24-hour TTL, same as doc-fetcher)
const siteMapCache = {
  data: null as SiteMapEntry[] | null,
  timestamp: 0,
  ttl: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Fetch site map from shadcn-svelte.com with rich metadata
 */
async function getCachedSiteMap(): Promise<SiteMapEntry[]> {
  const now = Date.now();

  // Return cached data if still valid
  if (siteMapCache.data && now - siteMapCache.timestamp < siteMapCache.ttl) {
    console.log("[shadcn-svelte-search] Using cached site map with metadata");
    return siteMapCache.data;
  }

  console.log(
    "[shadcn-svelte-search] Fetching fresh site map and metadata from shadcn-svelte.com"
  );

  try {
    // Fetch sitemap.xml directly from shadcn-svelte.com
    const response = await fetch("https://shadcn-svelte.com/sitemap.xml");

    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.statusText}`);
    }

    const text = await response.text();

    // Parse sitemap XML (basic parser)
    const urlMatches = text.matchAll(/<loc>(.*?)<\/loc>/g);
    const urls = Array.from(urlMatches).map((match) => match[1]);

    console.log(
      `[shadcn-svelte-search] Found ${urls.length} URLs, fetching metadata...`
    );

    // Fetch metadata for each URL (limit to avoid overwhelming the server)
    const entries: SiteMapEntry[] = [];
    const BATCH_SIZE = 5; // Process in batches to avoid rate limiting

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (url) => {
        try {
          // Fetch the page to get rich metadata
          const result = await fetchUrl(url, {
            useCache: true,
            includeMetadata: true,
            timeout: 10000, // Shorter timeout for search indexing
          });

          if (result.success && result.metadata) {
            return {
              url,
              title: result.metadata.title || extractTitleFromUrl(url),
              description: result.metadata.description,
              keywords: result.metadata.keywords,
              type: result.type,
            };
          } else {
            // Fallback to basic URL parsing
            return {
              url,
              title: extractTitleFromUrl(url),
              description: undefined,
              keywords: undefined,
              type: getResourceType(url),
            };
          }
        } catch (error) {
          console.warn(
            `[shadcn-svelte-search] Failed to fetch metadata for ${url}:`,
            error
          );
          // Fallback to basic URL parsing
          return {
            url,
            title: extractTitleFromUrl(url),
            description: undefined,
            keywords: undefined,
            type: getResourceType(url),
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      entries.push(...batchResults);

      // Small delay between batches to be respectful
      if (i + BATCH_SIZE < urls.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    siteMapCache.data = entries;
    siteMapCache.timestamp = now;

    console.log(
      `[shadcn-svelte-search] Cached ${entries.length} URLs with rich metadata`
    );
    return entries;
  } catch (error) {
    console.error("[shadcn-svelte-search] Error fetching site map:", error);

    // Return empty array if fetch fails
    return [];
  }
}

/**
 * Extract a human-readable title from a URL path
 */
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);

    if (pathParts.length === 0) return "Home";

    // Get the last part of the path
    const lastPart = pathParts[pathParts.length - 1];

    // Convert kebab-case to Title Case
    return lastPart
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } catch {
    return url;
  }
}

/**
 * Determine the type of resource from its URL or metadata
 */
function getResourceType(url: string, metadataType?: string): string {
  // Use metadata type if available
  if (metadataType && metadataType !== "unknown") {
    return metadataType;
  }

  // Fallback to URL-based detection
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes("/docs/components/")) return "component";
  if (lowerUrl.includes("/blocks/")) return "block";
  if (lowerUrl.includes("/charts/")) return "chart";
  if (lowerUrl.includes("/docs/")) return "doc";
  if (lowerUrl.includes("/examples/")) return "example";

  return "other";
}

/**
 * Filter entries by type
 */
function filterByType(entries: SiteMapEntry[], type: string): SiteMapEntry[] {
  if (type === "all") return entries;

  return entries.filter((entry) => {
    const resourceType = getResourceType(entry.url, entry.type);
    return resourceType === type;
  });
}

/**
 * Score an entry based on query relevance using rich metadata
 */
function scoreEntry(entry: SiteMapEntry, query: string): number {
  const normalizedQuery = query.toLowerCase().trim();
  const words = normalizedQuery.split(/\s+/);

  let score = 0;
  const title = (entry.title || "").toLowerCase();
  const description = (entry.description || "").toLowerCase();
  const keywords = entry.keywords || [];
  const url = entry.url.toLowerCase();

  // Title exact match (highest priority)
  if (title === normalizedQuery) {
    score += 150;
  } else if (title.includes(normalizedQuery)) {
    score += 100;
  } else if (words.every((word) => title.includes(word))) {
    // Title contains all words
    score += 75;
  }

  // Description matches (high priority)
  if (description) {
    if (description.includes(normalizedQuery)) {
      score += 60;
    } else if (words.every((word) => description.includes(word))) {
      score += 40;
    }
  }

  // Keywords matches (very high priority)
  const keywordMatches = keywords.filter(
    (keyword) =>
      normalizedQuery.includes(keyword.toLowerCase()) ||
      keyword.toLowerCase().includes(normalizedQuery)
  );
  score += keywordMatches.length * 80;

  // Individual keyword matches
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    if (normalizedQuery.includes(keywordLower)) {
      score += 50;
    }
    // Partial keyword matches
    if (
      words.some(
        (word) => keywordLower.includes(word) || word.includes(keywordLower)
      )
    ) {
      score += 25;
    }
  }

  // URL contains query
  if (url.includes(normalizedQuery)) {
    score += 25;
  }

  // Boost for exact component name matches
  const urlParts = url.split("/").filter(Boolean);
  const lastPart = urlParts[urlParts.length - 1];
  if (
    lastPart === normalizedQuery ||
    lastPart === normalizedQuery.replace(/\s+/g, "-")
  ) {
    score += 50;
  }

  return score;
}

/**
 * Format results as markdown
 */
function formatResults(
  results: SearchResult[],
  query: string,
  type: string
): string {
  if (results.length === 0) {
    return `# No Results Found\n\nNo matches found for query: **"${query}"**\n\nTry:\n- Using different keywords\n- Checking spelling\n- Being more general`;
  }

  // Group by type
  const grouped = results.reduce(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<string, SearchResult[]>
  );

  let markdown = `# Search Results for "${query}"\n\n`;
  markdown += `Found ${results.length} result${results.length === 1 ? "" : "s"}`;
  if (type !== "all") {
    markdown += ` in **${type}s**`;
  }
  markdown += "\n\n";

  // Type labels with emoji
  const typeLabels: Record<string, string> = {
    component: "🧩 Components",
    block: "🏗️ Blocks",
    chart: "📊 Charts",
    doc: "📖 Documentation",
    example: "💡 Examples",
    other: "🔗 Other",
  };

  // Output each type group
  const typeOrder = ["component", "block", "chart", "doc", "example", "other"];

  for (const resourceType of typeOrder) {
    const items = grouped[resourceType];
    if (!items || items.length === 0) continue;

    markdown += `## ${typeLabels[resourceType]} (${items.length})\n\n`;

    items.forEach((item, index) => {
      markdown += `${index + 1}. **[${item.title}](${item.url})**`;

      if (item.score >= 100) {
        markdown += " ⭐"; // High relevance indicator
      }

      markdown += `\n`;

      if (item.description) {
        markdown += `   ${item.description}\n`;
      }

      if (item.keywords && item.keywords.length > 0) {
        markdown += `   *Keywords: ${item.keywords.join(", ")}*\n`;
      }

      markdown += `   *Score: ${item.score}*\n\n`;
    });
  }

  markdown += "---\n\n";
  markdown += `**Query**: "${query}" | **Type Filter**: ${type} | **Total Results**: ${results.length}\n`;

  return markdown;
}

/**
 * Main search tool
 */
export const shadcnSvelteSearchTool = createTool({
  id: "shadcn-svelte-search",
  description:
    "Search shadcn-svelte documentation, components, blocks, and charts by keyword or phrase. Returns relevant results with descriptions and links.",
  inputSchema: z.object({
    query: z.string().describe("Search query (keywords or phrase)"),
    type: z
      .enum(["all", "component", "block", "chart", "doc", "example"])
      .optional()
      .default("all")
      .describe("Filter results by resource type"),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of results to return"),
  }),
  outputSchema: z.object({
    markdown: z.string().describe("Formatted search results in markdown"),
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        description: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        type: z.string(),
        score: z.number(),
      })
    ),
    query: z.string(),
    totalResults: z.number(),
  }),
  execute: async ({ context }) => {
    const { query, type = "all", limit = 10 } = context;

    console.log(
      `[shadcn-svelte-search] Searching for: "${query}" (type: ${type}, limit: ${limit})`
    );

    // Get cached or fresh site map
    const siteMap = await getCachedSiteMap();

    if (siteMap.length === 0) {
      return {
        markdown: "# Error\n\nFailed to load site map. Please try again later.",
        results: [],
        query,
        totalResults: 0,
      };
    }

    // Filter by type
    const filtered = filterByType(siteMap, type);

    // Score and filter entries
    const scored = filtered
      .map((entry) => ({
        ...entry,
        score: scoreEntry(entry, query),
      }))
      .filter((entry) => entry.score > 0) // Only include entries with matches
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .slice(0, limit); // Limit results

    // Transform to SearchResult format
    const results: SearchResult[] = scored.map((entry) => ({
      title: entry.title || "Untitled",
      url: entry.url,
      description: entry.description,
      keywords: entry.keywords,
      type: getResourceType(entry.url, entry.type),
      score: entry.score,
    }));

    // Format as markdown
    const markdown = formatResults(results, query, type);

    return {
      markdown,
      results,
      query,
      totalResults: results.length,
    };
  },
});
