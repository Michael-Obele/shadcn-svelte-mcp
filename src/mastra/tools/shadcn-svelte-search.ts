/**
 * shadcn-svelte-search
 *
 * Search tool for finding shadcn-svelte components, blocks, charts, and documentation
 * by keyword or phrase. Uses Fuse.js for intelligent fuzzy matching with typo tolerance.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import Fuse from "fuse.js";
import { getAllContent } from "../../services/component-discovery.js";

// Types
interface SearchResult {
  title: string;
  url: string;
  description?: string;
  type: string;
  score: number;
  similarity?: number; // Percentage similarity (0-100)
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
 * Perform fuzzy search using Fuse.js
 * Returns scored results with similarity percentage
 */
function performFuzzySearch(
  items: SearchableItem[],
  query: string,
  options: {
    threshold?: number;
    limit?: number;
  } = {}
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
  count: number = 3
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
 * Build install command for an item with specified package manager
 */
function buildInstallCommand(
  item: SearchableItem,
  packageManager: "npm" | "yarn" | "pnpm" | "bun" = "npm"
): string | null {
  // Only components, blocks, and charts have install commands
  if (
    item.type === "component" ||
    item.type === "block" ||
    item.type === "chart"
  ) {
    let prefix: string;
    switch (packageManager) {
      case "npm":
        prefix = "npx";
        break;
      case "yarn":
        prefix = "yarn dlx";
        break;
      case "pnpm":
        prefix = "pnpm dlx";
        break;
      case "bun":
        prefix = "bun x";
        break;
      default:
        prefix = "npx";
    }
    return `${prefix} shadcn-svelte@latest add ${item.name}`;
  }
  return null;
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
 * Format results as markdown with install commands
 */
function formatResults(
  results: SearchResult[],
  query: string,
  type: string,
  packageManager: "npm" | "yarn" | "pnpm" | "bun" = "npm",
  allItems?: SearchableItem[]
): string {
  if (results.length === 0) {
    let markdown = `# No Results Found\n\nNo matches found for query: **"${query}"**\n\n`;

    // Provide suggestions if we have all items
    if (allItems) {
      const suggestions = getSuggestionsForNoResults(allItems, query);
      if (suggestions.length > 0) {
        markdown += `## 💡 Did you mean?\n\n`;
        suggestions.forEach(
          (
            suggestion: { item: SearchableItem; similarity: number },
            index: number
          ) => {
            const { item, similarity } = suggestion;
            const installCmd = buildInstallCommand(item, packageManager);
            markdown += `${index + 1}. **${formatTitle(item.name)}** (${similarity}% similar)\n`;
            markdown += `   Type: ${item.type}\n`;
            if (installCmd) {
              markdown += `   📦 Install: \`${installCmd}\`\n`;
            }
            markdown += `   🔗 [View docs](${buildUrl(item)})\n\n`;
          }
        );
      }
    }

    markdown += `\n**Try:**\n- Using different keywords\n- Checking spelling\n- Being more general\n\nYou can use the \`list\` tool to see all available components and docs.\n`;
    return markdown;
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

      // Add install command for components/blocks/charts
      if (
        resourceType === "component" ||
        resourceType === "block" ||
        resourceType === "chart"
      ) {
        const itemName = item.title.toLowerCase().replace(/\s+/g, "-");
        let prefix: string;
        switch (packageManager) {
          case "npm":
            prefix = "npx";
            break;
          case "yarn":
            prefix = "yarn dlx";
            break;
          case "pnpm":
            prefix = "pnpm dlx";
            break;
          case "bun":
            prefix = "bun x";
            break;
          default:
            prefix = "npx";
        }
        markdown += `   📦 Install: \`${prefix} shadcn-svelte@latest add ${itemName}\`\n`;
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
    "Search shadcn-svelte documentation, components, blocks, and charts by keyword or phrase. Features advanced fuzzy matching for typo tolerance, returns relevant results with descriptions, links, install commands, and similarity scores. When no exact matches found, provides intelligent suggestions. Use this for both discovery (exploring options) and direct action (finding specific components to install).",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search query (keywords or phrase, typo-tolerant)"),
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
    packageManager: z
      .enum(["npm", "yarn", "pnpm", "bun"])
      .optional()
      .default("npm")
      .describe(
        "Package manager for install commands (npm uses npx, others use dlx)"
      ),
  }),
  execute: async ({ context }) => {
    const { query, type = "all", limit = 10, packageManager = "npm" } = context;

    console.log(
      `[shadcn-svelte-search] Searching for: "${query}" (type: ${type}, limit: ${limit}, packageManager: ${packageManager})`
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
        ({ item, score, similarity }) => ({
          title: formatTitle(item.name),
          url: buildUrl(item),
          description: generateDescription(item),
          type: item.type,
          score,
          similarity,
        })
      );

      // Format as markdown (pass allItems for suggestions if no results)
      const markdown = formatResults(
        results,
        query,
        type,
        packageManager,
        items
      );

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
