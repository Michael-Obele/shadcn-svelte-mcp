/**
 * Component Discovery Service
 * Discovers components by scraping the components index page
 */

import { fetchUrl } from "./doc-fetcher.js";
import { getFromCache, saveToCache } from "./cache-manager.js";

export interface ComponentInfo {
  name: string;
  category: string;
}

/**
 * Discovers all components by scraping the components index page
 */
export async function discoverComponents(): Promise<ComponentInfo[]> {
  const cacheKey = "component-list";

  // Check cache first
  const cached = await getFromCache<ComponentInfo[]>(cacheKey);
  if (cached) {
    console.log(
      `[Discovery] Using cached component list (${cached.length} components)`
    );
    return cached;
  }

  console.log("[Discovery] Fetching component list from website...");

  // Fetch the components index page (caching handled internally)
  const result = await fetchUrl(
    "https://www.shadcn-svelte.com/docs/components",
    {
      useCache: true,
    }
  );

  if (!result.success || !result.markdown) {
    console.error("[Discovery] Failed to fetch components page");
    return [];
  }

  // Extract component links from markdown
  // Pattern: [Component Name](https://www.shadcn-svelte.com/docs/components/component-name)
  // or [Component Name](/docs/components/component-name)
  const componentRegex =
    /\[([^\]]+)\]\((?:https?:\/\/[^\/]+)?\/docs\/components\/([a-z-]+)\)/g;
  const components: ComponentInfo[] = [];
  const seen = new Set<string>();

  let match;
  while ((match = componentRegex.exec(result.markdown)) !== null) {
    const name = match[2];
    const displayName = match[1];

    if (!seen.has(name)) {
      seen.add(name);
      components.push({
        name,
        category: "component",
      });
    }
  }

  // Also try to extract from the actual links if available
  // This is a fallback in case the markdown doesn't have the right format
  if (components.length === 0 && result.html) {
    const linkRegex = /href="\/docs\/components\/([a-z-]+)"/g;
    while ((match = linkRegex.exec(result.html)) !== null) {
      const name = match[1];
      if (!seen.has(name)) {
        seen.add(name);
        components.push({
          name,
          category: "component",
        });
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

  const docs = {
    installation: ["sveltekit", "vite", "astro"],
    darkMode: ["svelte"],
    migration: ["svelte-5", "tailwind-v4"],
    general: [
      "cli",
      "theming",
      "components-json",
      "figma",
      "changelog",
      "about",
    ],
  };

  // Cache the result
  await saveToCache(cacheKey, docs);

  return docs;
}

/**
 * Gets a comprehensive list of all available content
 */
export async function getAllContent(): Promise<{
  components: ComponentInfo[];
  docs: {
    installation: string[];
    darkMode: string[];
    migration: string[];
    general: string[];
  };
}> {
  const [components, docs] = await Promise.all([
    discoverComponents(),
    discoverDocs(),
  ]);

  return { components, docs };
}
