/**
 * shadcn-svelte-search
 *
 * Real, concept-aware search over the live catalog. Instead of matching the
 * whole query against component names (which fails for intents like
 * "dark mode theme toggle button"), it:
 *
 *   1. tokenizes the query into meaningful terms (drops function words),
 *   2. scores each term across name / keywords / title / category /
 *      description with BM25 (@orama/orama, k1 1.2, b 0.75),
 *   3. unions the per-term hits under OR semantics and ranks the union.
 *
 * Step 3 is why the query should be keywords. OR semantics means a term that
 * matches nothing meaningful still contributes a score, so question scaffolding
 * ("how do I make a ...") outranks the component the user actually meant. The
 * tool description says so; see the `query` schema for examples.
 *
 * It also supports filtering by category and running several queries in one
 * call (`queries`). Nothing is hardcoded — categories, descriptions, and
 * keywords all come from the catalog service.
 */

import { defineTool } from "tmcp/tool";
import { tool } from "tmcp/utils";
import * as v from "valibot";
import {
  getCatalog,
  type Catalog,
  type CatalogItem,
  type CatalogType,
} from "../../services/catalog.js";
import {
  buildIndex,
  queryTerms,
  searchOnce,
  type ScoredItem,
} from "../../services/catalog-search.js";
import {
  buildInstallLine,
  packageInstallLine,
  type PackageManager,
} from "./utils/shadcn-utils.js";

const TYPE_META: Record<CatalogType, { label: string; order: number }> = {
  component: { label: "🧩 Components", order: 0 },
  "bits-ui": { label: "🧱 Bits UI Primitives", order: 1 },
  block: { label: "🏗️ Blocks", order: 2 },
  chart: { label: "📊 Charts", order: 3 },
  utility: { label: "🔧 Utilities", order: 4 },
  doc: { label: "📖 Documentation", order: 5 },
};

/** Install command for an item, or null when it isn't installable. */
function installFor(item: CatalogItem, pm: PackageManager): string | null {
  if (item.type === "bits-ui") return packageInstallLine("bits-ui", pm);
  if (
    item.type === "component" ||
    item.type === "block" ||
    item.type === "chart"
  ) {
    return buildInstallLine(item.name, pm);
  }
  return null;
}

/** The exact call the agent should use to fetch this match. */
function fetchHint(item: CatalogItem): string {
  if (item.type === "bits-ui") return `bits-ui-get("${item.name}")`;
  if (item.type === "doc" || item.type === "utility") {
    return `shadcn-svelte-get("${item.name}", type: "doc")`;
  }
  return `shadcn-svelte-get("${item.name}", type: "component")`;
}

/** Renders a scored result set grouped by resource type. */
function renderScoredResults(
  results: ScoredItem[],
  pm: PackageManager,
  multiTerm: boolean,
  /** Names that have a Bits UI primitive behind them, so component hits can signpost it. */
  primitiveNames: Set<string>,
): string {
  const grouped = new Map<CatalogType, ScoredItem[]>();
  for (const result of results) {
    const bucket = grouped.get(result.item.type) ?? [];
    bucket.push(result);
    grouped.set(result.item.type, bucket);
  }

  const types = [...grouped.keys()].sort(
    (a, b) => TYPE_META[a].order - TYPE_META[b].order,
  );

  let out = "";
  for (const type of types) {
    const bucket = grouped.get(type)!;
    out += `### ${TYPE_META[type].label} (${bucket.length})\n\n`;

    bucket.forEach((result, index) => {
      const { item, similarity, coverage } = result;
      out += `${index + 1}. **[${item.title}](${item.url})** — \`${item.category}\` · ${similarity}% match`;
      if (multiTerm) out += ` · ${Math.round(coverage * 100)}% of terms`;
      out += `\n`;
      if (item.description) out += `   ${item.description}\n`;
      const install = installFor(item, pm);
      if (install) out += `   📦 Install: \`${install}\`\n`;
      out += `   → ${fetchHint(item)}\n`;
      // Only for the styled wrapper: it is what the agent should install, and
      // the primitive is the escape hatch for internals it does not expose.
      if (item.type === "component" && primitiveNames.has(item.name)) {
        out += `   🧱 Raw primitive (props, data-attributes, internals): \`bits-ui-get("${item.name}")\`\n`;
      }
      out += `\n`;
    });
  }
  return out;
}

/** Shared footer: how to fetch each type, plus categories seen in results. */
function renderFooter(
  queries: string[],
  type: string,
  category: string | undefined,
  count: number,
  results: ScoredItem[],
): string {
  const seenCategories = [...new Set(results.map((r) => r.item.category))];
  let out = `---\n\n`;
  out += `**Quer${queries.length === 1 ? "y" : "ies"}**: ${queries
    .map((q) => `"${q}"`)
    .join(", ")} · **Type**: ${type}`;
  if (category) out += ` · **Category**: ${category}`;
  out += ` · **Results**: ${count}\n\n`;
  out += `**Fetching a match**: components/blocks/charts → \`shadcn-svelte-get(name, type: "component")\`; docs & utilities → \`shadcn-svelte-get(name, type: "doc")\`; bits-ui primitives → \`bits-ui-get(name)\`.\n\n`;
  if (seenCategories.length > 0) {
    out += `**Categories in results**: ${seenCategories.join(" · ")}\n`;
  }
  out += `_Run \`shadcn-svelte-list\` to browse all categories._\n`;
  return out;
}

/** No-results output with fuzzy "did you mean" suggestions and guidance. */
function renderNoResults(
  query: string,
  catalog: Catalog,
  type: string,
  category: string | undefined,
): string {
  let out = `# No results for "${query}"\n\n`;
  if (category) out += `Category filter: **${category}**\n\n`;
  if (type !== "all") out += `Type filter: **${type}**\n\n`;

  // Suggest closest names from the whole catalog (ignoring filters). Re-running
  // the same query would just fail again, so retry with one term on its own.
  const catalogIndex = buildIndex(catalog.items);
  const singleTerm = queryTerms(query).at(-1) ?? query;
  const suggestions = searchOnce(catalogIndex, singleTerm, 3);
  if (suggestions.length > 0) {
    out += `## 💡 Did you mean?\n\n`;
    suggestions.forEach(({ item }, index) => {
      out += `${index + 1}. **${item.title}** (\`${item.category}\`) — ${fetchHint(item)}\n`;
    });
    out += `\n`;
  }

  out += `**Try:** different keywords, check spelling, or be more general.\n\n`;

  // The vocabulary gap - "notification" for a component documented only as
  // "toast" - cannot be bridged from the site's text, and guessing with a
  // synonym table would rot as the site's wording changes. So the catalog's
  // real vocabulary is listed instead: the calling model can see that `sonner`
  // exists and re-query with the word the site actually uses.
  const components = catalog.items.filter((item) => item.type === "component");
  if (components.length > 0) {
    out += `**Available components** (re-query using these names):\n\n`;
    const byCategory = new Map<string, string[]>();
    for (const item of components) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item.name);
      byCategory.set(item.category, list);
    }
    for (const [name, items] of byCategory) {
      out += `- **${name}**: ${items.map((n) => `\`${n}\``).join(", ")}\n`;
    }
    out += `\n`;
  }

  out += `**Types**: ${Object.keys(TYPE_META).join(" · ")}\n\n`;
  out += `**Categories**: ${catalog.categories.join(" · ")}\n`;
  return out;
}

/** Component names that have a Bits UI primitive behind them. */
function primitiveNamesOf(catalog: Catalog): Set<string> {
  return new Set(
    catalog.items
      .filter((item) => item.type === "bits-ui")
      .map((item) => item.name),
  );
}

function formatSingle(
  query: string,
  results: ScoredItem[],
  catalog: Catalog,
  type: string,
  category: string | undefined,
  pm: PackageManager,
): string {
  if (results.length === 0) {
    return renderNoResults(query, catalog, type, category);
  }

  let out = `# Search Results for "${query}"\n\n`;
  out += `Found **${results.length}** result${results.length === 1 ? "" : "s"}`;
  if (type !== "all") out += ` in **${type}**`;
  if (category) out += ` · category ~ "${category}"`;
  out += `\n\n`;
  out += renderScoredResults(
    results,
    pm,
    queryTerms(query).length > 1,
    primitiveNamesOf(catalog),
  );
  out += renderFooter([query], type, category, results.length, results);
  return out;
}

function formatMulti(
  queries: string[],
  sections: Array<{ query: string; results: ScoredItem[] }>,
  catalog: Catalog,
  type: string,
  category: string | undefined,
  pm: PackageManager,
): string {
  const primitives = primitiveNamesOf(catalog);
  let out = `# Multi-Search (${queries.length} queries)\n\n`;
  let total = 0;

  for (const section of sections) {
    out += `## "${section.query}"\n\n`;
    if (section.results.length === 0) {
      out += `_No matches._\n\n`;
      continue;
    }
    total += section.results.length;
    out += renderScoredResults(section.results, pm, true, primitives);
  }

  out += renderFooter(
    queries,
    type,
    category,
    total,
    sections.flatMap((s) => s.results),
  );
  return out;
}

/**
 * Search tool.
 */
export const shadcnSvelteSearchTool = defineTool(
  {
    name: "shadcn-svelte-search",
    description:
      "Search shadcn-svelte components, bits, blocks, charts, docs, and utilities. Send 1-3 KEYWORD terms (nouns naming the thing you want), not a question or a sentence — 'modal', 'data table', 'date picker' work; 'how do I make a modal dialog for my app' does not, because filler words are matched as loosely as real ones and displace the right component. Typo-tolerant and understands concepts (e.g. 'toggle' finds 'switch'). Returns links, categories, install commands, and the exact get call for each match.",
    schema: v.object({
      query: v.optional(
        v.pipe(
          v.string(),
          v.description(
            "1-3 keyword terms naming what you want (e.g. 'date picker', 'data table', 'toggle'). Do NOT send a question or a full sentence: filler words ('how', 'make', 'my', 'app') are matched as loosely as real terms and can bury the component you want. Say 'modal', not 'how do I make a modal'.",
          ),
        ),
      ),
      queries: v.optional(
        v.pipe(
          v.array(v.string()),
          v.description(
            "Run several keyword searches in one call (e.g. ['toggle', 'dialog', 'data table']). Each query is ranked separately.",
          ),
        ),
      ),
      type: v.optional(
        v.pipe(
          v.picklist([
            "all",
            "component",
            "bits-ui",
            "block",
            "chart",
            "doc",
            "utility",
          ]),
          v.description("Filter results by resource type"),
        ),
        "all",
      ),
      category: v.optional(
        v.pipe(
          v.string(),
          v.description(
            "Filter by category as published on the site (e.g. 'Form & Input', 'Overlays & Dialogs', 'Installation'). Substring match.",
          ),
        ),
      ),
      limit: v.optional(
        v.pipe(
          v.number(),
          v.description("Maximum number of results per query"),
        ),
        10,
      ),
      packageManager: v.optional(
        v.pipe(
          v.picklist(["npm", "yarn", "pnpm", "bun"]),
          v.description("Package manager for rendered install commands"),
        ),
        "npm",
      ),
    }),
  },
  async ({
    query,
    queries,
    type = "all",
    category,
    limit = 10,
    packageManager = "npm",
  }) => {
    const searchQueries = (queries ?? [])
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .map((q) => q.trim());
    if (searchQueries.length === 0 && query?.trim()) {
      searchQueries.push(query.trim());
    }

    if (searchQueries.length === 0) {
      return tool.error(
        "Provide a `query`, or one or more `queries` to search for.",
      );
    }

    console.log(
      `[shadcn-svelte-search] queries=${JSON.stringify(searchQueries)} type=${type} category=${category ?? "-"} limit=${limit}`,
    );

    try {
      const catalog = await getCatalog();

      let filtered = catalog.items;
      if (type !== "all")
        filtered = filtered.filter((item) => item.type === type);
      if (category) {
        const needle = category.toLowerCase();
        filtered = filtered.filter((item) =>
          item.category.toLowerCase().includes(needle),
        );
      }

      if (filtered.length === 0) {
        return tool.text(
          renderNoResults(searchQueries[0], catalog, type, category),
        );
      }

      const index = buildIndex(filtered);

      if (searchQueries.length === 1) {
        const results = searchOnce(index, searchQueries[0], limit);
        return tool.text(
          formatSingle(
            searchQueries[0],
            results,
            catalog,
            type,
            category,
            packageManager,
          ),
        );
      }

      const sections = searchQueries.map((q) => ({
        query: q,
        results: searchOnce(index, q, limit),
      }));
      return tool.text(
        formatMulti(
          searchQueries,
          sections,
          catalog,
          type,
          category,
          packageManager,
        ),
      );
    } catch (error) {
      console.error("[shadcn-svelte-search] Error during search:", error);
      return tool.error(
        `Search failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  },
);
