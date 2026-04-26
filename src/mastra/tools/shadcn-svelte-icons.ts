import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getFromCache, saveToCache } from "../../services/cache-manager.js";

function normalizeIconName(input: string): string {
  return input
    .trim()
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function parseMultiIconQuery(query: string): string[] | undefined {
  const trimmedQuery = query.trim();
  if (!/[\s,]/.test(trimmedQuery)) {
    return undefined;
  }

  const parsedNames = trimmedQuery
    .split(/[\s,]+/)
    .map((name) => normalizeIconName(name))
    .filter((name) => name.length > 0);

  return parsedNames.length > 0 ? parsedNames : undefined;
}

function tokenizeQuery(query: string): string[] {
  return query
    .split(/[\s,]+/)
    .map((part) => normalizeIconName(part))
    .filter((part) => part.length > 0);
}

function scoreIconMatch(
  iconName: string,
  query: string,
  tags: string[],
): number {
  const normalizedQuery = normalizeIconName(query);
  const queryTokens = tokenizeQuery(query);
  const nameLower = iconName.toLowerCase();
  let score = 0;

  if (normalizedQuery && nameLower === normalizedQuery) {
    score += 100;
  }

  if (normalizedQuery && nameLower.startsWith(normalizedQuery)) {
    score += 40;
  }

  if (normalizedQuery && nameLower.includes(normalizedQuery)) {
    score += 20;
  }

  for (const token of queryTokens) {
    if (nameLower === token) {
      score += 90;
    } else if (nameLower.startsWith(token)) {
      score += 35;
    } else if (nameLower.includes(token)) {
      score += 15;
    }

    for (const tag of tags) {
      const tagLower = tag.toLowerCase();
      if (tagLower === token) {
        score += 25;
      } else if (tagLower.includes(token)) {
        score += 8;
      }
    }
  }

  return score;
}

// Tool for searching and browsing Lucide icons
export const shadcnSvelteIconsTool = createTool({
  id: "shadcn-svelte-icons",
  description:
    "Search and browse Lucide icons available for use with lucide-svelte. Browse all 1600+ Lucide icons with search by name and tags. No AI hallucination - returns only real icons that exist. IMPORTANT: ONLY use this tool for Lucide icons - do NOT use for shadcn-svelte component information. For components, use shadcn-svelte-get, shadcn-svelte-search, or shadcn-svelte-list instead. Can handle multiple icon names: pass comma-separated names like 'truck, package, dashboard' or space-separated names like 'truck package dashboard' in the query parameter.",
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        "Search term to filter icons (searches icon names and tags), or multiple icon names separated by commas or spaces (e.g., 'truck, package, dashboard' or 'truck package dashboard')",
      ),
    // `names` allows an agent to request a specific set of icons by name
    names: z
      .array(z.string())
      .optional()
      .describe("Specific icon names to return (e.g., ['arrow-left', 'user'])"),
    importLimit: z
      .number()
      .optional()
      .default(10)
      .describe(
        "Maximum number of icon imports to show in the snippet (default: 10). This prevents long import lines but can be increased if needed.",
      ),
    limit: z
      .number()
      .optional()
      .default(100)
      .describe("Maximum number of icons to return (default: 50)"),
    packageManager: z
      .enum(["npm", "yarn", "pnpm", "bun"])
      .optional()
      .describe(
        "Optional package manager for install commands. If omitted, the tool will use a recommended default (npx/PNPM/Yarn/bun as appropriate).",
      ),
  }),
  execute: async ({ context }) => {
    const { query, limit = 100, importLimit = 10, packageManager } = context;
    let { names } = context;

    // Parse query to detect multiple icon names
    if (query && !names) {
      names = parseMultiIconQuery(query);
    }

    try {
      // URLs for Lucide data
      const iconsUrl = "https://unpkg.com/lucide-static@latest/icon-nodes.json";
      const tagsUrl = "https://unpkg.com/lucide-static@latest/tags.json";

      // Fetch icon data with caching
      let iconData = await getFromCache<Record<string, unknown>>(iconsUrl);
      if (!iconData) {
        console.log("[Icons] Fetching icon data from CDN...");
        const iconResponse = await fetch(iconsUrl);
        if (!iconResponse.ok) {
          throw new Error(`Failed to fetch icon data: ${iconResponse.status}`);
        }
        iconData = (await iconResponse.json()) as Record<string, unknown>;
        await saveToCache(iconsUrl, iconData);
      }

      const allIcons = Object.keys(iconData);

      // Fetch tags data with caching (only if searching)
      let tagsData: Record<string, string[]> = {};
      if (query || (names && names.length > 0)) {
        tagsData =
          (await getFromCache<Record<string, string[]>>(tagsUrl)) || {};
        if (Object.keys(tagsData).length === 0) {
          console.log("[Icons] Fetching tags data from CDN...");
          const tagsResponse = await fetch(tagsUrl);
          if (tagsResponse.ok) {
            tagsData = (await tagsResponse.json()) as Record<string, string[]>;
            await saveToCache(tagsUrl, tagsData);
          }
        }
      }

      // Filter icons if query provided
      let filteredIcons = allIcons;
      if (names && names.length > 0) {
        const normalizedNames = names.map((name) => normalizeIconName(name));
        const nameSet = new Set(normalizedNames);
        filteredIcons = allIcons.filter((iconName) =>
          nameSet.has(iconName.toLowerCase()),
        );
      } else if (query) {
        const scoredIcons = allIcons
          .map((iconName) => {
            const tags = tagsData[iconName] || [];
            return {
              iconName,
              score: scoreIconMatch(iconName, query, tags),
            };
          })
          .filter(({ score }) => score > 0)
          .sort((left, right) => {
            if (right.score !== left.score) {
              return right.score - left.score;
            }

            if (left.iconName.length !== right.iconName.length) {
              return left.iconName.length - right.iconName.length;
            }

            return left.iconName.localeCompare(right.iconName);
          });

        filteredIcons = scoredIcons.map(({ iconName }) => iconName);
      }

      // Apply limit
      const limitedIcons = filteredIcons.slice(0, limit);
      const hasMore = filteredIcons.length > limit;

      // Build response
      let iconList = `# Lucide Icons${query ? ` (search: "${query}")` : ""}\n\n`;
      iconList += `Found **${filteredIcons.length}** icon${filteredIcons.length !== 1 ? "s" : ""}`;
      iconList += ` (showing ${limitedIcons.length})${hasMore ? ` — showing first ${limit}` : ""}\n\n`;

      const missingIcons: string[] = [];
      if (names && names.length > 0) {
        // Determine missing names
        for (const nm of names) {
          const normalizedName = normalizeIconName(nm);
          if (!allIcons.some((a) => a.toLowerCase() === normalizedName)) {
            missingIcons.push(nm);
          }
        }
      }
      if (limitedIcons.length === 0) {
        // Build friendly message depending on query/names provided
        if (names && names.length > 0) {
          iconList += `No icons found for names: ${names.join(", ")}.\n\n`;
        } else if (query) {
          iconList += `No icons found matching "${query}".\n\n`;
        } else {
          iconList += `No icons found.\n\n`;
        }
        iconList += `**Tips:**\n`;
        iconList += `- Try different keywords (e.g., "arrow", "user", "file")\n`;
        iconList += `- Use singular form (e.g., "star" instead of "stars")\n`;
        iconList += `- Be more generic (e.g., "shape" instead of "triangle")\n`;
      } else {
        iconList += `## Icons\n\n`;
        for (const iconName of limitedIcons) {
          const tags = tagsData[iconName];
          iconList += `- **${iconName}**`;
          if (tags && tags.length > 0) {
            const displayTags = tags.slice(0, 5);
            iconList += ` (${displayTags.join(", ")})`;
            if (tags.length > 5) {
              iconList += ` +${tags.length - 5} more`;
            }
          }
          iconList += `\n`;
        }

        if (hasMore) {
          iconList += `\n_...and ${filteredIcons.length - limit} more. Refine your search or increase the limit._\n`;
        }

        iconList += `\n\n## Usage\n\n`;
        iconList += `\`\`\`bash\n`;
        iconList += `# Install @lucide/svelte (only if not already installed)\n`;
        iconList += `${(() => {
          if (!packageManager) return "npm install";
          if (packageManager === "npm") return "npm install";
          if (packageManager === "yarn") return "yarn add";
          if (packageManager === "pnpm") return "pnpm add";
          if (packageManager === "bun") return "bun add";
          return "npm install";
        })()} @lucide/svelte\n`;
        iconList += `\`\`\`\n\n`;

        // Show individual examples for each icon (up to importLimit)
        const exampleIcons = limitedIcons.slice(0, importLimit);
        const pascalize = (name: string) =>
          name
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join("");
        for (const iconName of exampleIcons) {
          const pascalName = pascalize(iconName);
          iconList += `\`\`\`svelte\n`;
          iconList += `<script>\n`;
          iconList += `  import { ${pascalName} } from '@lucide/svelte';\n`;
          iconList += `</script>\n\n`;
          iconList += `<${pascalName} />\n`;
          iconList += `\`\`\`\n\n`;
        }

        if (limitedIcons.length > importLimit) {
          const remaining = limitedIcons.length - importLimit;
          iconList += `*...and ${remaining} more icon${remaining !== 1 ? "s" : ""}. Increase \`importLimit\` to see more examples.*\n\n`;
        }
      }
      iconList += `\n**Total icons available:** ${allIcons.length}\n`;
      iconList += `**Search tips:** Try keywords like "arrow", "user", "file", "check", "heart", "star", etc.\n`;

      if (missingIcons.length) {
        iconList += `\n**Missing icons:** ${missingIcons.join(", ")}\n`;
      }

      // Heuristic & recommendation: if many matches, recommend the best candidate
      if (query && limitedIcons.length > 1) {
        let recommendedIcon: string | null = null;
        let recommendedReason = "";
        let bestScore = -1;
        for (const ic of limitedIcons) {
          const sc = scoreIconMatch(ic, query || "", tagsData[ic] || []);
          if (sc > bestScore) {
            bestScore = sc;
            recommendedIcon = ic;
          }
        }
        if (recommendedIcon && bestScore > 0) {
          // determine simple reason label
          if (query && query.toLowerCase() === recommendedIcon.toLowerCase())
            recommendedReason = "exact match";
          else if (
            query &&
            recommendedIcon.toLowerCase().startsWith(query.toLowerCase())
          )
            recommendedReason = "name starts with query";
          else recommendedReason = "highest relevance based on tags and name";
          iconList += `\n**Recommended icon:** **${recommendedIcon}** (${recommendedReason}).\n`;
          iconList += `If you only need one icon, request it by passing the name in the \`names\` parameter or set \`limit: 1\`.\n`;
          iconList += `\n**Heuristics used:**\n- Exact name match\n- Name prefix\n- Tag overlap\n- Highest relevance score\n`;
        }
      }

      return iconList;
    } catch (error) {
      return `Error fetching icon data: ${error}`;
    }
  },
});
