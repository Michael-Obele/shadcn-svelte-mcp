/**
 * shadcn-svelte-search
 *
 * Search tool for finding shadcn-svelte components, blocks, charts, and documentation
 * by keyword or phrase. Uses fast local string matching against the component registry.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getAllContent } from "../../services/component-discovery.js";

// Types
interface SearchResult {
  title: string;
  url: string;
  description?: string;
  type: string;
  score: number;
}

interface SearchableItem {
  name: string;
  type: string;
  category?: string;
}

// Known blocks and charts (synced with list tool)
const BLOCKS = {
  featured: ["dashboard-01"],
  sidebar: ["sidebar-03", "sidebar-07"],
  login: ["login-03", "login-04"],
};

const CHARTS = {
  area: ["chart-area-default", "chart-area-interactive"],
  bar: ["chart-bar-default", "chart-bar-interactive"],
  line: ["chart-line-default", "chart-line-interactive"],
  pie: ["chart-pie-default", "chart-pie-interactive"],
  radar: ["chart-radar-default", "chart-radar-interactive"],
  radial: ["chart-radial-default", "chart-radial-interactive"],
  tooltip: ["chart-tooltip-default", "chart-tooltip-icons"],
};

/**
 * Get all searchable items (components, blocks, charts, docs)
 */
async function getSearchableItems(): Promise<SearchableItem[]> {
  console.log("[shadcn-svelte-search] Loading searchable items...");

  const content = await getAllContent();
  const items: SearchableItem[] = [];

  // Add components
  for (const component of content.components) {
    items.push({
      name: component.name,
      type: "component",
      category: component.category,
    });
  }

  // Add blocks
  for (const category of Object.values(BLOCKS)) {
    for (const block of category) {
      items.push({
        name: block,
        type: "block",
        category: "block",
      });
    }
  }

  // Add charts
  for (const category of Object.values(CHARTS)) {
    for (const chart of category) {
      items.push({
        name: chart,
        type: "chart",
        category: "chart",
      });
    }
  }

  // Add documentation sections
  for (const [category, docs] of Object.entries(content.docs)) {
    for (const doc of docs) {
      items.push({
        name: doc,
        type: "doc",
        category,
      });
    }
  }

  console.log(`[shadcn-svelte-search] Loaded ${items.length} searchable items`);
  return items;
}

/**
 * Score an item based on query relevance
 */
function scoreItem(item: SearchableItem, query: string): number {
  const normalizedQuery = query.toLowerCase().trim();
  const queryWords = normalizedQuery.split(/\s+/);
  const itemName = item.name.toLowerCase();

  let score = 0;

  // Exact match (highest priority)
  if (itemName === normalizedQuery) {
    score += 1000;
  }

  // Name starts with query
  if (itemName.startsWith(normalizedQuery)) {
    score += 500;
  }

  // Name contains full query
  if (itemName.includes(normalizedQuery)) {
    score += 250;
  }

  // Check individual words
  let matchedWords = 0;
  for (const word of queryWords) {
    // Exact word match
    if (itemName === word) {
      score += 200;
      matchedWords++;
    }
    // Word at start
    else if (itemName.startsWith(word)) {
      score += 150;
      matchedWords++;
    }
    // Word contained
    else if (itemName.includes(word)) {
      score += 100;
      matchedWords++;
    }
    // Fuzzy match (edit distance 1)
    else if (fuzzyMatch(itemName, word)) {
      score += 50;
      matchedWords++;
    }
  }

  // Bonus for matching all words
  if (matchedWords === queryWords.length && queryWords.length > 1) {
    score += 200;
  }

  return score;
}

/**
 * Simple fuzzy matching (checks if strings are similar with edit distance ≤ 1)
 */
function fuzzyMatch(str: string, pattern: string): boolean {
  // If lengths differ by more than 1, can't be edit distance 1
  if (Math.abs(str.length - pattern.length) > 1) {
    return false;
  }

  let differences = 0;
  let i = 0;
  let j = 0;

  while (i < str.length && j < pattern.length) {
    if (str[i] !== pattern[j]) {
      differences++;
      if (differences > 1) return false;

      // Try to skip a character
      if (str.length > pattern.length) {
        i++;
      } else if (pattern.length > str.length) {
        j++;
      } else {
        i++;
        j++;
      }
    } else {
      i++;
      j++;
    }
  }

  // Account for remaining characters
  differences += str.length - i + pattern.length - j;

  return differences <= 1;
}

/**
 * Build URL for an item
 */
function buildUrl(item: SearchableItem): string {
  const base = "https://www.shadcn-svelte.com";

  switch (item.type) {
    case "component":
      return `${base}/docs/components/${item.name}`;
    case "block":
      return `${base}/blocks#${item.name}`;
    case "chart":
      return `${base}/charts#${item.name}`;
    case "doc":
      // Handle different doc categories
      if (item.category === "installation") {
        return `${base}/docs/installation/${item.name}`;
      } else if (item.category === "darkMode") {
        return `${base}/docs/dark-mode/${item.name}`;
      } else if (item.category === "migration") {
        return `${base}/docs/migration/${item.name}`;
      } else {
        return `${base}/docs/${item.name}`;
      }
    default:
      return `${base}/docs/${item.name}`;
  }
}

/**
 * Format name as title
 */
function formatTitle(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Generate description for an item
 */
function generateDescription(item: SearchableItem): string {
  switch (item.type) {
    case "component":
      return `UI component: ${formatTitle(item.name)}`;
    case "block":
      return `Pre-built section: ${formatTitle(item.name)}`;
    case "chart":
      return `Chart component: ${formatTitle(item.name)}`;
    case "doc":
      return `Documentation: ${formatTitle(item.name)}`;
    default:
      return formatTitle(item.name);
  }
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
    return `# No Results Found\n\nNo matches found for query: **"${query}"**\n\nTry:\n- Using different keywords\n- Checking spelling\n- Being more general\n\nYou can use the \`list\` tool to see all available components and docs.`;
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
  };

  // Output each type group
  const typeOrder = ["component", "block", "chart", "doc"];

  for (const resourceType of typeOrder) {
    const items = grouped[resourceType];
    if (!items || items.length === 0) continue;

    markdown += `## ${typeLabels[resourceType]} (${items.length})\n\n`;

    items.forEach((item, index) => {
      markdown += `${index + 1}. **[${item.title}](${item.url})**`;

      if (item.score >= 500) {
        markdown += " ⭐⭐"; // Very high relevance
      } else if (item.score >= 200) {
        markdown += " ⭐"; // High relevance
      }

      markdown += `\n`;

      if (item.description) {
        markdown += `   ${item.description}\n`;
      }

      markdown += `\n`;
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

    try {
      // Get all searchable items
      const items = await getSearchableItems();

      // Filter by type if specified
      const filtered =
        type === "all" ? items : items.filter((item) => item.type === type);

      // Score each item
      const scored = filtered
        .map((item) => ({
          item,
          score: scoreItem(item, query),
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Build results
      const results: SearchResult[] = scored.map(({ item, score }) => ({
        title: formatTitle(item.name),
        url: buildUrl(item),
        description: generateDescription(item),
        type: item.type,
        score,
      }));

      // Format as markdown
      const markdown = formatResults(results, query, type);

      return {
        markdown,
        results,
        query,
        totalResults: results.length,
      };
    } catch (error) {
      console.error("[shadcn-svelte-search] Error during search:", error);
      return {
        markdown: `# Error\n\nFailed to perform search: ${error}\n\nPlease try again or use the \`list\` tool to browse available content.`,
        results: [],
        query,
        totalResults: 0,
      };
    }
  },
});
