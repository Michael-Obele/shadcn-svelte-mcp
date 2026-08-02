/**
 * Bits UI Component Discovery Service
 * Discovers Bits UI components by fetching the authoritative list from the Bits UI GitHub repository
 */

import { getFromCache, saveToCache } from "./cache-manager.js";

export interface BitsUIComponentInfo {
  name: string;
  category: string;
}

/**
 * Discovers all Bits UI components by fetching the component list from the Bits UI GitHub repository
 */
export async function discoverBitsUIComponents(): Promise<
  BitsUIComponentInfo[]
> {
  const cacheKey = "bits-ui-component-list";

  // Check cache first
  const cached = await getFromCache<BitsUIComponentInfo[]>(cacheKey);
  if (cached) {
    console.log(
      `[Bits UI Discovery] Using cached component list (${cached.length} components)`,
    );
    return cached;
  }

  console.log("[Bits UI Discovery] Fetching component list from Bits UI GitHub repository");

  const components: BitsUIComponentInfo[] = [];

  try {
    // Fetch the raw TypeScript file directly from GitHub
    const response = await fetch(
      "https://raw.githubusercontent.com/huntabyte/bits-ui/main/docs/src/lib/content/api-reference/index.ts"
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    console.log(`[Bits UI Discovery] Fetched raw content length: ${content.length}`);

    // Extract component names from the 'bits' array in the TypeScript file
    // The array looks like: export const bits = [ "accordion", "alert-dialog", ... ] as const;
    const bitsArrayMatch = content.match(/export const bits = \[\s*([\s\S]*?)\s*\] as const;/);

    if (bitsArrayMatch) {
      console.log("[Bits UI Discovery] Found bits array match");
      // Extract individual component names from the array - handle both double and single quotes
      const componentMatches = bitsArrayMatch[1].match(/["']([^"']+)["']/g);
      if (componentMatches) {
        console.log(`[Bits UI Discovery] Found ${componentMatches.length} raw component matches`);
        for (const match of componentMatches) {
          const name = match.slice(1, -1); // Remove quotes
          components.push({
            name,
            category: "bits-ui-component",
          });
        }
      } else {
        console.log("[Bits UI Discovery] No component matches found in array");
      }
    } else {
      console.log("[Bits UI Discovery] Could not find 'export const bits' array");
    }
  } catch (error) {
    console.error("[Bits UI Discovery] Error fetching component list:", error);
  }

  console.log(`[Bits UI Discovery] Found ${components.length} components`);

  // Cache the result for 3 days (same as component discovery)
  await saveToCache(cacheKey, components);

  return components;
}
