/**
 * Registry discovery service.
 *
 * Fetches the live shadcn-svelte registry index, which is the single source of
 * truth for UI components, blocks, and charts. Component/docs names,
 * descriptions, and categories are supplied by the catalog in `catalog.ts`.
 */

import { getFromCache, saveToCache } from "./cache-manager.js";
import { fetchJson } from "./http.js";

export interface ComponentInfo {
  name: string;
  category: string;
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
 * Discovers blocks, charts, and UI components from the live registry index.
 * Single source of truth — replaces hardcoded component/block/chart lists.
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
