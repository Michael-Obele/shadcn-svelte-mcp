/**
 * shadcn-svelte-search
 *
 * Search tool for finding shadcn-svelte components, blocks, charts, and documentation
 * by keyword or phrase. Uses Fuse.js for intelligent fuzzy matching with typo tolerance.
 */

import { defineTool } from "tmcp/tool";
import { tool } from "tmcp/utils";
import * as v from "valibot";
import Fuse from "fuse.js";
import { getAllContent } from "../../services/component-discovery.js";
import {
  buildInstallLine,
  packageInstallLine,
  titleCase as formatTitle,
  bitsUiComponentUrl,
  shadcnComponentUrl,
  shadcnDocUrl,
  sectionAnchorUrl,
} from "./utils/shadcn-utils.js";

// Types
interface SearchResult {
  title: string;
  url: string;
  description?: string;
  type: string;
  score: number;
  similarity?: number; // Percentage similarity (0-100)
  installCommand?: string | null;
}

interface Suggestion {
  name: string;
  type: string;
  similarity: number;
  nextAction: string;
}

interface SearchableItem {
  name: string;
  type: string;
  category?: string;
}

/**
 * Get all searchable items (components, blocks, charts, docs)
 * Blocks/charts come from the live registry index via getAllContent.
 */
async function getSearchableItems(): Promise<SearchableItem[]> {
  console.log("[shadcn-svelte-search] Loading searchable items...");

  const content = await getAllContent();
  const items: SearchableItem[] = [
    ...content.components.map((c) => ({
      name: c.name,
      type: "component" as const,
      category: c.category,
    })),
    ...content.bitsUIComponents.map((c) => ({
      name: c.name,
      type: "component" as const,
      category: c.category,
    })),
    ...content.blocks.map((b) => ({
      name: b.name,
      type: "block" as const,
      category: "block",
    })),
    ...content.charts.map((c) => ({
      name: c.name,
      type: "chart" as const,
      category: "chart",
    })),
  ];

  for (const [category, docs] of Object.entries(content.docs)) {
    for (const doc of docs) items.push({ name: doc, type: "doc", category });
  }

  console.log(`[shadcn-svelte-search] Loaded ${items.length} searchable items`);
  return items;
}

/**
 * Perform fuzzy search using Fuse.js
 * Returns scored results with similarity percentage
 */
function performFuzzySearch(
  items: SearchableItem[],
  query: string,
  options: {
    threshold?: number;
    limit?: number;
  } = {},
): Array<{ item: SearchableItem; score: number; similarity: number }> {
  const { threshold = 0.4, limit = 50 } = options;

  const fuse = new Fuse(items, {
    keys: ["name"],
    threshold, // 0 = exact match, 1 = match anything
    includeScore: true,
    ignoreLocation: true, // Search anywhere in string
    minMatchCharLength: 1,
    distance: 100, // How far to search
  });

  const results = fuse.search(query, { limit });

  // Convert Fuse.js results to our format
  // Fuse score: 0 = perfect match, 1 = poor match
  // Our score: 2000 = perfect, 0 = poor (for consistency with existing code)
  return results.map((result) => {
    const fuseScore = result.score || 0;
    const similarity = Math.round((1 - fuseScore) * 100); // Convert to percentage
    const score = Math.round((1 - fuseScore) * 2000); // Convert to our scoring system

    return {
      item: result.item,
      score,
      similarity,
    };
  });
}

/**
 * Get suggestions when no good matches are found
 * Uses a more lenient threshold to find close matches
 */
function getSuggestionsForNoResults(
  items: SearchableItem[],
  query: string,
  count: number = 3,
): Array<{ item: SearchableItem; similarity: number }> {
  // Use higher threshold (more lenient) for suggestions
  const results = performFuzzySearch(items, query, {
    threshold: 0.7,
    limit: count,
  });

  return results.map((r) => ({ item: r.item, similarity: r.similarity }));
}

/**
 * Build URL for an item
 */
function buildUrl(item: SearchableItem): string {
  if (item.category === "bits-ui-component") {
    return bitsUiComponentUrl(item.name);
  }

  switch (item.type) {
    case "component":
      return shadcnComponentUrl(item.name);
    case "block":
      return sectionAnchorUrl("blocks", item.name);
    case "chart":
      return sectionAnchorUrl("charts", item.name);
    default:
      // Docs (category refines the root) and anything else.
      return shadcnDocUrl(item.name, item.category);
  }
}

/**
 * Build install command for an item with specified package manager
 */
function buildInstallCommand(
  item: SearchableItem,
  packageManager?: "npm" | "yarn" | "pnpm" | "bun",
): string | null {
  // Bits UI components are part of the bits-ui package
  if (item.category === "bits-ui-component") {
    return packageInstallLine("bits-ui", packageManager);
  }

  // Only components, blocks, and charts have install commands
  if (
    item.type === "component" ||
    item.type === "block" ||
    item.type === "chart"
  ) {
    return buildInstallLine(item.name, packageManager);
  }
  return null;
}

function parseCommaSeparatedQueries(query: string): string[] {
  return query
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function buildSearchResult(
  item: SearchableItem,
  score: number,
  similarity: number,
  packageManager: "npm" | "yarn" | "pnpm" | "bun",
): SearchResult {
  return {
    title: formatTitle(item.name),
    url: buildUrl(item),
    description: generateDescription(item),
    installCommand: buildInstallCommand(item, packageManager),
    type: item.type,
    score,
    similarity,
  };
}

function combineCommaSeparatedResults(
  filtered: SearchableItem[],
  query: string,
  packageManager: "npm" | "yarn" | "pnpm" | "bun",
  limit: number,
): { results: SearchResult[]; fragments: string[] } | null {
  const fragments = parseCommaSeparatedQueries(query);
  if (fragments.length < 2) {
    return null;
  }

  const resultsByKey = new Map<string, SearchResult>();

  for (const fragment of fragments) {
    const scored = performFuzzySearch(filtered, fragment, { limit });

    for (const { item, score, similarity } of scored) {
      const result = buildSearchResult(item, score, similarity, packageManager);
      const key = `${result.type}:${result.url}`;
      const existing = resultsByKey.get(key);

      if (
        !existing ||
        result.score > existing.score ||
        (result.score === existing.score &&
          (result.similarity ?? 0) > (existing.similarity ?? 0))
      ) {
        resultsByKey.set(key, result);
      }
    }
  }

  const results = Array.from(resultsByKey.values()).sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if ((right.similarity ?? 0) !== (left.similarity ?? 0)) {
      return (right.similarity ?? 0) - (left.similarity ?? 0);
    }

    return left.title.localeCompare(right.title);
  });

  return { results: results.slice(0, limit), fragments };
}

function buildCommaSeparatedFallbackMarkdown(
  markdown: string,
  query: string,
  fragments: string[],
): string {
  const header = `# Search Results for "${query}"\n\n`;
  const fragmentList = fragments.map((fragment) => `"${fragment}"`).join(", ");
  const note = `No direct matches found for the full query. Searched comma-separated fragments: ${fragmentList}\n\n`;

  if (markdown.startsWith(header)) {
    return `${header}${note}${markdown.slice(header.length)}`;
  }

  return `${header}${note}${markdown}`;
}

/**
 * Generate description for an item
 */
function generateDescription(item: SearchableItem): string {
  if (item.category === "bits-ui-component") {
    return `Bits UI: Headless ${formatTitle(item.name)} primitive`;
  }

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

/** Markdown for a no-result search, with fuzzy "did you mean" suggestions. */
function formatNoResults(
  query: string,
  packageManager: "npm" | "yarn" | "pnpm" | "bun",
  allItems?: SearchableItem[],
): { markdown: string; suggestions: Suggestion[] } {
  const suggestions: Suggestion[] = [];
  let markdown = `# No Results Found\n\nNo matches found for query: **"${query}"**\n\n`;

  // Provide suggestions if we have all items
  if (allItems) {
    const fuzzyResults = getSuggestionsForNoResults(allItems, query);
    if (fuzzyResults.length > 0) {
      markdown += `## 💡 Did you mean?\n\n`;
      fuzzyResults.forEach(
        (
          suggestion: { item: SearchableItem; similarity: number },
          index: number,
        ) => {
          const { item, similarity } = suggestion;
          const installCmd = buildInstallCommand(item, packageManager);

          // Build suggestion for structured data
          suggestions.push({
            name: item.name,
            type: item.type,
            similarity: Math.round(similarity),
            nextAction: `Try shadcn-svelte-get("${item.name}", "${item.type}")`,
          });

          markdown += `${index + 1}. **${formatTitle(item.name)}** (${similarity}% similar)\n`;
          markdown += `   Type: ${item.type}\n`;
          if (installCmd) {
            markdown += `   📦 Install: \`${installCmd}\`\n`;
          }
          markdown += `   🔗 [View docs](${buildUrl(item)})\n\n`;
        },
      );
    }
  }

  markdown += `\n**Try:**\n- Using different keywords\n- Checking spelling\n- Being more general\n\nYou can use the \`list\` tool to see all available components and docs.\n`;
  return { markdown, suggestions };
}

/** Markdown for a non-empty result set, grouped by resource type. */
function formatGroupedResults(
  results: SearchResult[],
  query: string,
  type: string,
): { markdown: string; suggestions: Suggestion[] } {
  // Group by type
  const grouped = results.reduce(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<string, SearchResult[]>,
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
      // Use similarity from Fuse.js (already calculated as percentage)
      const matchPercent =
        item.similarity || Math.round((item.score / 2000) * 100);

      markdown += `${index + 1}. **[${item.title}](${item.url})**`;

      if (matchPercent >= 95) {
        markdown += " 🎯"; // Perfect/near-perfect match
      } else if (matchPercent >= 80) {
        markdown += " ⭐⭐"; // Very high relevance
      } else if (matchPercent >= 60) {
        markdown += " ⭐"; // High relevance
      }

      markdown += ` (${matchPercent}% match)\n`;

      if (item.description) {
        markdown += `   ${item.description}\n`;
      }

      // Add install command if available
      if (item.installCommand) {
        markdown += `   📦 Install: \`${item.installCommand}\`\n`;
      }

      markdown += `\n`;
    });
  }

  markdown += "---\n\n";
  markdown += `**Query**: "${query}" | **Type Filter**: ${type} | **Total Results**: ${results.length}\n`;

  return { markdown, suggestions: [] };
}

/**
 * Format results as markdown with install commands
 * Returns both markdown and structured suggestions
 */
function formatResults(
  results: SearchResult[],
  query: string,
  type: string,
  packageManager: "npm" | "yarn" | "pnpm" | "bun" = "bun",
  allItems?: SearchableItem[],
): { markdown: string; suggestions: Suggestion[] } {
  return results.length === 0
    ? formatNoResults(query, packageManager, allItems)
    : formatGroupedResults(results, query, type);
}

/**
 * Main search tool
 */
export const shadcnSvelteSearchTool = defineTool(
  {
    name: "shadcn-svelte-search",
    description:
      "Fuzzy-search shadcn-svelte components, blocks, charts, and docs by keyword or phrase. Returns links, install commands, and similarity scores; suggests alternatives when nothing matches. Use for discovery or finding components to install.",
    schema: v.object({
      query: v.pipe(
        v.string(),
        v.description("Search query (keywords or phrase, typo-tolerant)"),
      ),
      type: v.optional(
        v.pipe(
          v.picklist(["all", "component", "block", "chart", "doc", "example"]),
          v.description("Filter results by resource type"),
        ),
        "all",
      ),
      limit: v.optional(
        v.pipe(
          v.number(),
          v.description("Maximum number of results to return"),
        ),
        10,
      ),
      packageManager: v.optional(
        v.pipe(
          v.picklist(["npm", "yarn", "pnpm", "bun"]),
          v.description(
            "Optional package manager for install commands. If omitted, defaults to 'npx' for npm-style one-time commands",
          ),
        ),
        "npm",
      ),
    }),
  },
  async ({ query, type = "all", limit = 10, packageManager = "npm" }) => {
    console.log(
      `[shadcn-svelte-search] Searching for: "${query}" (type: ${type}, limit: ${limit}, packageManager: ${packageManager})`,
    );

    try {
      // Get all searchable items
      const items = await getSearchableItems();

      // Filter by type if specified
      const filtered =
        type === "all" ? items : items.filter((item) => item.type === type);

      // Perform fuzzy search using Fuse.js
      const scored = performFuzzySearch(filtered, query, { limit });

      // Build results
      const results: SearchResult[] = scored.map(
        ({ item, score, similarity }) =>
          buildSearchResult(item, score, similarity, packageManager),
      );

      const commaSeparatedFallback =
        results.length === 0
          ? combineCommaSeparatedResults(filtered, query, packageManager, limit)
          : null;

      if (commaSeparatedFallback && commaSeparatedFallback.results.length > 0) {
        const fallbackResults = commaSeparatedFallback.results;
        const { markdown } = formatResults(
          fallbackResults,
          query,
          type,
          packageManager,
          items,
        );

        return tool.text(
          buildCommaSeparatedFallbackMarkdown(
            markdown,
            query,
            commaSeparatedFallback.fragments,
          ),
        );
      }

      // Format as markdown (pass allItems for suggestions if no results)
      const { markdown, suggestions } = formatResults(
        results,
        query,
        type,
        packageManager,
        items,
      );

      return tool.text(markdown);
    } catch (error) {
      console.error("[shadcn-svelte-search] Error during search:", error);
      const { markdown } = formatResults([], query, type, packageManager, []);

      return tool.text(markdown);
    }
  },
);
