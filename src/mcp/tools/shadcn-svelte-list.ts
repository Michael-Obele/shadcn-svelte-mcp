import { defineTool } from "tmcp/tool";
import { tool } from "tmcp/utils";
import * as v from "valibot";
import {
  getCatalog,
  type CatalogItem,
} from "../../services/catalog.js";
import {
  bulletList,
  renderColumns,
  renderGroupedSection,
  LIST_FOOTER,
  LIST_USAGE,
} from "./utils/shadcn-utils.js";

/** Preserves catalog (site) order while grouping items by category. */
function groupByCategory(
  items: CatalogItem[],
): Array<[string, CatalogItem[]]> {
  const groups = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const bucket = groups.get(item.category) ?? [];
    bucket.push(item);
    groups.set(item.category, bucket);
  }
  return [...groups.entries()];
}

// Tool for listing all available components and documentation
export const shadcnSvelteListTool = defineTool(
  {
    name: "shadcn-svelte-list",
    description:
      "List shadcn-svelte components (grouped by category), blocks, charts, docs, utilities, and Bits UI primitives, discovered live from shadcn-svelte.com. Optionally filter by category.",
    schema: v.object({
      type: v.optional(
        v.pipe(
          v.picklist([
            "components",
            "bits-ui",
            "blocks",
            "charts",
            "docs",
            "utilities",
            "all",
          ]),
          v.description(
            "What to list: components, bits-ui, blocks, charts, docs, utilities, or all",
          ),
        ),
        "all",
      ),
      category: v.optional(
        v.pipe(
          v.string(),
          v.description(
            "Optional category filter as published on the site (e.g. 'Form & Input', 'Layout & Navigation', 'Installation'). Substring match.",
          ),
        ),
      ),
    }),
  },
  async ({ type = "all", category }) => {
    try {
      const catalog = await getCatalog();
      const needle = category?.toLowerCase();
      const keep = (item: CatalogItem) =>
        !needle || item.category.toLowerCase().includes(needle);
      const of = (t: CatalogItem["type"]) =>
        catalog.items.filter((item) => item.type === t && keep(item));

      let result = "# shadcn-svelte Resources\n\n";
      const scope = category ? ` in **${category}**` : "";

      if (type === "components" || type === "all") {
        const components = of("component");
        result += `## Components${scope}\n\n`;
        result += `Found ${components.length} shadcn-svelte components:\n\n`;
        for (const [name, items] of groupByCategory(components)) {
          result += `### ${name}\n`;
          result += renderColumns(items.map((i) => i.name));
        }
      }

      if (type === "bits-ui" || type === "all") {
        const bits = of("bits-ui");
        result += `## Bits UI Components${scope}\n\n`;
        result += `Found ${bits.length} headless UI primitives (used by shadcn-svelte):\n\n`;
        result += renderColumns(bits.map((b) => b.name));
        result +=
          "*These are the underlying headless components that shadcn-svelte builds upon.*\n\n";
      }

      if (type === "blocks" || type === "all") {
        const blocks = of("block");
        result += `## Blocks${scope}\n\n`;
        result += `Found ${blocks.length} pre-built sections (dashboards, sidebars, login pages, etc.):\n\n`;
        result += category
          ? bulletList(blocks.map((b) => b.name))
          : renderGroupedSection(blocks.map((b) => b.name), false);
      }

      if (type === "charts" || type === "all") {
        const charts = of("chart");
        result += `## Charts${scope}\n\n`;
        result += `Found ${charts.length} pre-built chart components:\n\n`;
        result += category
          ? bulletList(charts.map((c) => c.name))
          : renderGroupedSection(charts.map((c) => c.name), true, " Charts");
      }

      if (type === "docs" || type === "all") {
        const docs = of("doc");
        result += `## Documentation${scope}\n\n`;
        for (const [name, items] of groupByCategory(docs)) {
          result += `### ${name}\n`;
          result += bulletList(items.map((d) => d.name));
          result += "\n";
        }
      }

      if (type === "utilities" || type === "all") {
        const utilities = of("utility");
        if (utilities.length > 0) {
          result += `## Utilities${scope}\n\n`;
          result += bulletList(utilities.map((u) => u.name));
          result += "\n";
        }
      }

      if (type === "all" && !category) {
        result += `${LIST_FOOTER}\n`;
      }

      result += `**Categories** (pass as \`category\` to this tool or \`shadcn-svelte-search\`): ${catalog.categories.join(" · ")}\n\n`;
      result += LIST_USAGE;

      return tool.text(result);
    } catch (error) {
      return tool.error(`Error listing resources: ${error}`);
    }
  },
);
