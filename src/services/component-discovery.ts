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

  // Fetch the main docs page to discover all documentation sections
  const result = await fetchUrl("https://www.shadcn-svelte.com/docs", {
    useCache: true,
  });

  if (!result.success || !result.markdown) {
    console.error(
      "[Discovery] Failed to fetch docs page, falling back to hardcoded list"
    );
    // Fallback to hardcoded list if scraping fails
    const fallbackDocs = {
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
    await saveToCache(cacheKey, fallbackDocs);
    return fallbackDocs;
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
  const content = result.markdown;

  // Process each category
  for (const [category, pattern] of Object.entries(categoryPatterns)) {
    const matches = [...content.matchAll(pattern)];
    const sections = matches
      .map((match) => match[1])
      .filter((value, index, self) => self.indexOf(value) === index); // deduplicate

    if (category === "general") {
      // For general, also add registry sections
      const registryMatches = [...content.matchAll(registryPattern)];
      const registrySections = registryMatches
        .map((match) => `registry/${match[1]}`)
        .filter((value, index, self) => self.indexOf(value) === index);
      sections.push(...registrySections);
    }

    docs[category as keyof typeof docs] = sections;
  }

  // If we didn't find much content, try HTML parsing as fallback
  const totalSections = Object.values(docs).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  if (totalSections < 5 && result.html) {
    console.log(
      "[Discovery] Limited sections found in markdown, trying HTML parsing..."
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

  // Ensure we have at least the basic sections that are known to exist
  const ensureSections = {
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

  for (const [category, requiredSections] of Object.entries(ensureSections)) {
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
