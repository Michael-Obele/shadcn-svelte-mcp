/**
 * Live resource catalog.
 *
 * Single source of truth for the search and list tools. Everything here is
 * derived from live sources — nothing is hardcoded:
 *
 * 1. `llms.txt` supplies components, docs, utilities, their titles, their
 *    descriptions, and the site's own category groupings.
 * 2. The registry index (`registry/index.json`) supplies blocks, charts, and
 *    registry-only UI components.
 * 3. The Bits UI GitHub source supplies the underlying primitive names.
 */

import { fetchUrl } from "./doc-fetcher.js";
import { getFromCache, saveToCache } from "./cache-manager.js";
import { discoverRegistry } from "./component-discovery.js";
import { discoverBitsUIComponents } from "./bits-ui-discovery.js";
import {
  bitsUiComponentUrl,
  sectionAnchorUrl,
  shadcnComponentUrl,
  shadcnDocUrl,
  titleCase,
} from "../mcp/tools/utils/shadcn-utils.js";

export type CatalogType =
  | "component"
  | "bits-ui"
  | "block"
  | "chart"
  | "doc"
  | "utility";

export interface CatalogItem {
  /** Canonical id the get tools accept (`switch`, `installation/sveltekit`). */
  name: string;
  /** Human title as published (`Switch`, `Button Group`). */
  title: string;
  type: CatalogType;
  /** Category as published by the site (e.g. `Form & Input`). */
  category: string;
  /** One-line description as published by the site. */
  description: string;
  /** Canonical docs URL. */
  url: string;
  /** Search terms derived from name/title/category. */
  keywords: string[];
}

export interface Catalog {
  items: CatalogItem[];
  /** Unique categories in first-seen (site) order. */
  categories: string[];
  counts: Record<CatalogType, number>;
}

const LLMS_URL = "https://shadcn-svelte.com/llms.txt";
const CACHE_KEY = "catalog:llms:v1";

/** `- [Title](url): Description` — the shape of every llms.txt entry. */
const ENTRY_RE = /^-\s*\[([^\]]+)\]\((https?:\/\/[^\s)]+?)\)\s*(?::\s*(.+?))?$/;

const WORD_SPLIT_RE = /[^a-z0-9+]+/i;

/** Function words carry no signal when deriving keywords. */
const KEYWORD_STOPWORDS = new Set([
  "and",
  "or",
  "the",
  "of",
  "to",
  "for",
  "a",
  "an",
  "in",
  "on",
  "with",
]);

/** Lower-cased word tokens shared by keyword derivation and search. */
export function tokenizeWords(input: string): string[] {
  return input.toLowerCase().split(WORD_SPLIT_RE).filter(Boolean);
}

/** Search keywords from name/title/category — the site's own vocabulary. */
function deriveKeywords(...parts: Array<string | undefined>): string[] {
  const set = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const word of tokenizeWords(part)) {
      if (word.length > 1 && !KEYWORD_STOPWORDS.has(word)) set.add(word);
    }
  }
  return [...set];
}

interface LlmsEntry {
  title: string;
  href: string;
  description: string;
  /** Sub-heading under `## Components`, else the top-level section heading. */
  category: string;
}

/**
 * Parses llms.txt into entries, tracking the `##` section and `###`
 * sub-section headings so each entry inherits the site's own category.
 */
function parseLlms(text: string): LlmsEntry[] {
  const entries: LlmsEntry[] = [];
  let section = "";
  let subsection = "";

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      section = h2[1];
      subsection = "";
      continue;
    }

    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h3) {
      subsection = h3[1];
      continue;
    }

    const match = line.match(ENTRY_RE);
    if (!match) continue;
    entries.push({
      title: match[1].trim(),
      href: match[2],
      description: (match[3] ?? "").trim(),
      category: subsection || section,
    });
  }

  return entries;
}

/** Turns an llms.txt entry into a catalog item, or null if not a docs page. */
function entryToItem(entry: LlmsEntry): CatalogItem | null {
  let path: string;
  try {
    path = new URL(entry.href).pathname.replace(/\.md$/, "");
  } catch {
    return null;
  }

  if (path.startsWith("/docs/components/")) {
    const name = path.slice("/docs/components/".length);
    if (!name) return null;
    return {
      name,
      title: entry.title,
      type: "component",
      category: entry.category || "Components",
      description: entry.description || `The ${entry.title} component.`,
      url: shadcnComponentUrl(name),
      keywords: deriveKeywords(name, entry.title, entry.category),
    };
  }

  if (path.startsWith("/docs/")) {
    const rel = path.slice("/docs/".length);
    if (!rel) return null;
    const isUtility = rel.startsWith("utils/");
    return {
      name: rel,
      title: entry.title,
      type: isUtility ? "utility" : "doc",
      category: entry.category || (isUtility ? "Utilities" : "Docs"),
      description: entry.description || `${entry.title} documentation.`,
      url: shadcnDocUrl(rel),
      keywords: deriveKeywords(rel, entry.title, entry.category),
    };
  }

  return null;
}

/** Registry-derived category: charts by second segment, blocks by first. */
function registryCategory(name: string, isChart: boolean): string {
  const parts = name.split("-");
  if (isChart) return titleCase(parts[1] ?? "other");
  if (name.startsWith("demo-sidebar")) return "Demo Sidebar";
  if (name.startsWith("new-components")) return "New Components";
  return titleCase(parts[0] ?? name);
}

function registryToItem(name: string, isChart: boolean): CatalogItem {
  const category = registryCategory(name, isChart);
  return {
    name,
    title: titleCase(name),
    type: isChart ? "chart" : "block",
    category,
    description: `Pre-built ${category} ${isChart ? "chart" : "block"} from the shadcn-svelte registry.`,
    url: sectionAnchorUrl(isChart ? "charts" : "blocks", name),
    keywords: deriveKeywords(name, category),
  };
}

/** Registry UI item with no docs page (e.g. `form`). */
function fallbackComponent(name: string): CatalogItem {
  return {
    name,
    title: titleCase(name),
    type: "component",
    category: "Components",
    description: `The ${titleCase(name)} component.`,
    url: shadcnComponentUrl(name),
    keywords: deriveKeywords(name),
  };
}

function bitsToItem(name: string): CatalogItem {
  return {
    name,
    title: titleCase(name),
    type: "bits-ui",
    category: "Bits UI Primitives",
    description: `Headless ${titleCase(name)} primitive (Bits UI).`,
    url: bitsUiComponentUrl(name),
    keywords: deriveKeywords(name, "bits ui primitive"),
  };
}

/** Loads (and caches) the full catalog, merging every live source. */
export async function getCatalog(): Promise<Catalog> {
  const cached = await getFromCache<Catalog>(CACHE_KEY);
  if (cached) {
    console.log(`[Catalog] Cache hit (${cached.items.length} items)`);
    return cached;
  }

  console.log("[Catalog] Building catalog from llms.txt + registry...");
  const items: CatalogItem[] = [];
  const seenComponents = new Set<string>();

  // 1. llms.txt — components, docs, utilities, with titles/descriptions/categories.
  const llms = await fetchUrl(LLMS_URL, { useCache: true });
  if (llms.success && llms.content) {
    for (const entry of parseLlms(llms.content)) {
      const item = entryToItem(entry);
      if (!item) continue;
      if (item.type === "component") {
        if (seenComponents.has(item.name)) continue;
        seenComponents.add(item.name);
      }
      items.push(item);
    }
  } else {
    console.error(
      `[Catalog] llms.txt unavailable (${llms.error ?? "unknown"}) — continuing with registry only`,
    );
  }

  // 2. Registry — blocks/charts plus UI components missing from llms.txt.
  const registry = await discoverRegistry();
  for (const block of registry.blocks) items.push(registryToItem(block.name, false));
  for (const chart of registry.charts) items.push(registryToItem(chart.name, true));
  for (const ui of registry.ui) {
    if (seenComponents.has(ui.name)) continue;
    seenComponents.add(ui.name);
    items.push(fallbackComponent(ui.name));
  }

  // 3. Bits UI — the underlying headless primitives.
  for (const primitive of await discoverBitsUIComponents()) {
    items.push(bitsToItem(primitive.name));
  }

  const categories: string[] = [];
  const counts = {
    component: 0,
    "bits-ui": 0,
    block: 0,
    chart: 0,
    doc: 0,
    utility: 0,
  } as Record<CatalogType, number>;
  for (const item of items) {
    counts[item.type] += 1;
    if (!categories.includes(item.category)) categories.push(item.category);
  }

  const catalog: Catalog = { items, categories, counts };
  await saveToCache(CACHE_KEY, catalog);
  console.log(
    `[Catalog] Built ${items.length} items across ${categories.length} categories:`,
    counts,
  );
  return catalog;
}
