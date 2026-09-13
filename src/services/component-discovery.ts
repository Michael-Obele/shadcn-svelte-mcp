/**
 * Component Discovery Service
 * Discovers components by scraping the components index page or llms.txt
 */

import { fetchUrl } from "./doc-fetcher.js";
import { getFromCache, saveToCache } from "./cache-manager.js";
import { fetchJson } from "./http.js";
import {
  discoverBitsUIComponents,
  type BitsUIComponentInfo,
} from "./bits-ui-discovery.js";

export interface ComponentInfo {
  name: string;
  category: string;
}

/** Adds a component to `list` once, preserving first-seen order. */
function pushUnique(
  list: ComponentInfo[],
  seen: Set<string>,
  name: string,
): void {
  if (seen.has(name)) return;
  seen.add(name);
  list.push({ name, category: "component" });
}

/** Unique capture group 1 matches of `pattern` in `text` (first-seen order). */
function collectMatches(text: string, pattern: RegExp): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(pattern)) seen.add(match[1]);
  return [...seen];
}

/** Known docs sections — the fallback baseline when discovery is incomplete. */
const BASE_DOCS = {
  installation: ["sveltekit", "vite", "astro"],
  darkMode: ["svelte"],
  migration: ["svelte-5", "tailwind-v4"],
  general: ["cli", "theming", "components-json", "figma", "changelog", "about"],
};

/**
 * Discovers all components by fetching llms.txt or scraping the components index page
 */
export async function discoverComponents(): Promise<ComponentInfo[]> {
  const cacheKey = "component-list";

  // Check cache first
  const cached = await getFromCache<ComponentInfo[]>(cacheKey);
  if (cached) {
    console.log(
      `[Discovery] Using cached component list (${cached.length} components)`,
    );
    return cached;
  }

  console.log("[Discovery] Fetching component list from llms.txt...");

  // Try llms.txt first as it's more reliable for AI
  const llmsResult = await fetchUrl("https://shadcn-svelte.com/llms.txt", {
    useCache: true,
  });

  const components: ComponentInfo[] = [];
  const seen = new Set<string>();

  if (llmsResult.success && llmsResult.content) {
    // Extract components from ## Components section in llms.txt
    const componentsSection = llmsResult.content
      .split("## Components")[1]
      ?.split("##")[0];
    if (componentsSection) {
      const componentRegex =
        /\[([^\]]+)\]\(https?:\/\/[^\/]+\/docs\/components\/([a-z-]+)(?:\.md)?\)/g;
      let match;
      while ((match = componentRegex.exec(componentsSection)) !== null) {
        pushUnique(components, seen, match[2]);
      }
    }
  }

  // Fallback to scraping the components index page if llms.txt failed or returned nothing
  if (components.length === 0) {
    console.log(
      "[Discovery] Falling back to scraping components index page...",
    );
    const result = await fetchUrl(
      "https://www.shadcn-svelte.com/docs/components",
      {
        useCache: true,
      },
    );

    if (result.success && result.content) {
      const componentRegex =
        /\[([^\]]+)\]\((?:https?:\/\/[^\/]+)?\/docs\/components\/([a-z-]+)\)/g;

      let match;
      while ((match = componentRegex.exec(result.content)) !== null) {
        pushUnique(components, seen, match[2]);
      }
    }

    // Also try to extract from the actual links if available
    if (components.length === 0 && result.html) {
      const linkRegex = /href="\/docs\/components\/([a-z-]+)"/g;
      let match;
      while ((match = linkRegex.exec(result.html)) !== null) {
        pushUnique(components, seen, match[1]);
      }
    }
  }

  // Sort alphabetically
  components.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`[Discovery] Found ${components.length} components`);

  // Cache the result
  await saveToCache(cacheKey, components);

  return components;
}

/**
 * Discovers documentation sections
 */
export async function discoverDocs(): Promise<{
  installation: string[];
  darkMode: string[];
  migration: string[];
  general: string[];
}> {
  const cacheKey = "docs-list";

  // Check cache first
  const cached = await getFromCache<any>(cacheKey);
  if (cached) {
    console.log("[Discovery] Using cached docs list");
    return cached;
  }

  console.log("[Discovery] Discovering documentation sections...");

  // Fetch the main docs page to discover all documentation sections
  const result = await fetchUrl("https://www.shadcn-svelte.com/docs", {
    useCache: true,
  });

  if (!result.success || !result.content) {
    console.error(
      "[Discovery] Failed to fetch docs page, falling back to hardcoded list",
    );
    await saveToCache(cacheKey, BASE_DOCS);
    return BASE_DOCS;
  }

  // Extract documentation links from markdown
  // Look for patterns like [Title](/docs/section/name) or [Title](https://www.shadcn-svelte.com/docs/section/name)
  const docs: {
    installation: string[];
    darkMode: string[];
    migration: string[];
    general: string[];
  } = {
    installation: [],
    darkMode: [],
    migration: [],
    general: [],
  };

  // Define known categories and their URL patterns
  const categoryPatterns = {
    installation: /\/docs\/installation\/([a-z-]+)/g,
    darkMode: /\/docs\/dark-mode\/([a-z-]+)/g,
    migration: /\/docs\/migration\/([a-z-]+)/g,
    general:
      /\/docs\/(?!components|installation|dark-mode|migration|registry)([a-z-]+(?:\/[a-z-]+)*)/g,
  };

  // Also look for registry docs
  const registryPattern = /\/docs\/registry\/([a-z-]+(?:\/[a-z-]+)*)/g;

  // Extract from markdown content
  const content = result.content;

  // Process each category
  for (const [category, pattern] of Object.entries(categoryPatterns)) {
    const sections = collectMatches(content, pattern);

    if (category === "general") {
      // For general, also add registry sections
      sections.push(
        ...collectMatches(content, registryPattern).map(
          (section) => `registry/${section}`,
        ),
      );
    }

    docs[category as keyof typeof docs] = sections;
  }

  // If we didn't find much content, try HTML parsing as fallback
  const totalSections = Object.values(docs).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  if (totalSections < 5 && result.html) {
    console.log(
      "[Discovery] Limited sections found in markdown, trying HTML parsing...",
    );

    // Try to extract from HTML links
    const linkRegex = /href="\/docs\/([^"]+)"/g;
    const htmlSections: { [key: string]: Set<string> } = {
      installation: new Set(),
      darkMode: new Set(),
      migration: new Set(),
      general: new Set(),
    };

    let match;
    while ((match = linkRegex.exec(result.html)) !== null) {
      const path = match[1];

      if (path.startsWith("installation/")) {
        htmlSections.installation.add(path.substring("installation/".length));
      } else if (path.startsWith("dark-mode/")) {
        htmlSections.darkMode.add(path.substring("dark-mode/".length));
      } else if (path.startsWith("migration/")) {
        htmlSections.migration.add(path.substring("migration/".length));
      } else if (path.startsWith("registry/")) {
        htmlSections.general.add(path);
      } else if (!path.startsWith("components/") && path !== "docs") {
        // Skip components and main docs page
        htmlSections.general.add(path);
      }
    }

    // Convert Sets to arrays
    for (const [category, sections] of Object.entries(htmlSections)) {
      docs[category as keyof typeof docs] = Array.from(sections).sort();
    }
  }

  // Ensure we have at least the base sections that are known to exist
  for (const [category, requiredSections] of Object.entries(BASE_DOCS)) {
    for (const section of requiredSections) {
      if (!docs[category as keyof typeof docs].includes(section)) {
        docs[category as keyof typeof docs].push(section);
      }
    }
  }

  // Sort all sections
  for (const category of Object.keys(docs)) {
    docs[category as keyof typeof docs].sort();
  }

  console.log(`[Discovery] Found docs sections:`, docs);

  // Cache the result
  await saveToCache(cacheKey, docs);

  return docs;
}

/**
 * Registry index item from https://shadcn-svelte.com/registry/index.json
 */
interface RegistryIndexItem {
  name: string;
  type: string;
  relativeUrl?: string;
}

/**
 * Discovers blocks and charts from the live registry index.
 * Single source of truth — replaces hardcoded BLOCKS/CHARTS lists.
 */
export async function discoverRegistry(): Promise<{
  ui: ComponentInfo[];
  blocks: ComponentInfo[];
  charts: ComponentInfo[];
}> {
  const cacheKey = "registry-index-blocks";
  const cached = await getFromCache<{
    ui: ComponentInfo[];
    blocks: ComponentInfo[];
    charts: ComponentInfo[];
  }>(cacheKey);
  if (cached) {
    console.log(
      `[Discovery] Using cached registry index (${cached.blocks.length} blocks, ${cached.charts.length} charts, ${cached.ui.length} UI)`,
    );
    return cached;
  }

  console.log("[Discovery] Fetching registry index...");
  const empty = {
    ui: [] as ComponentInfo[],
    blocks: [] as ComponentInfo[],
    charts: [] as ComponentInfo[],
  };
  try {
    const items = await fetchJson<RegistryIndexItem[]>(
      "https://shadcn-svelte.com/registry/index.json",
    );
    const ui: ComponentInfo[] = [];
    const blocks: ComponentInfo[] = [];
    const charts: ComponentInfo[] = [];
    for (const item of items) {
      if (item.type === "registry:ui") {
        ui.push({ name: item.name, category: "component" });
      } else if (item.type === "registry:block") {
        if (item.name.startsWith("chart-")) {
          charts.push({ name: item.name, category: "chart" });
        } else {
          blocks.push({ name: item.name, category: "block" });
        }
      }
    }
    ui.sort((a, b) => a.name.localeCompare(b.name));
    blocks.sort((a, b) => a.name.localeCompare(b.name));
    charts.sort((a, b) => a.name.localeCompare(b.name));
    console.log(
      `[Discovery] Registry: ${ui.length} UI, ${blocks.length} blocks, ${charts.length} charts`,
    );
    const result = { ui, blocks, charts };
    await saveToCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error("[Discovery] Registry index fetch failed:", error);
    return empty;
  }
}

/**
 * Gets a comprehensive list of all available content
 */
export async function getAllContent(): Promise<{
  components: ComponentInfo[];
  blocks: ComponentInfo[];
  charts: ComponentInfo[];
  bitsUIComponents: BitsUIComponentInfo[];
  docs: {
    installation: string[];
    darkMode: string[];
    migration: string[];
    general: string[];
  };
}> {
  const [components, registry, bitsUIComponents, docs] = await Promise.all([
    discoverComponents(),
    discoverRegistry(),
    discoverBitsUIComponents(),
    discoverDocs(),
  ]);

  // Union llms.txt components with registry UI (covers registry-only items
  // like `form`). Clone first so the cached array is never mutated.
  const merged = [...components];
  const seen = new Set(merged.map((c) => c.name));
  for (const item of registry.ui) {
    if (!seen.has(item.name)) {
      seen.add(item.name);
      merged.push(item);
    }
  }
  merged.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`[getAllContent] shadcn-svelte components: ${merged.length}`);
  console.log(
    `[getAllContent] blocks: ${registry.blocks.length}, charts: ${registry.charts.length}`,
  );
  console.log(`[getAllContent] Bits UI components: ${bitsUIComponents.length}`);

  return {
    components: merged,
    blocks: registry.blocks,
    charts: registry.charts,
    bitsUIComponents,
    docs,
  };
}
