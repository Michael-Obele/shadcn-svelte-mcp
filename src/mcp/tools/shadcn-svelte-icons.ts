import { defineTool } from "tmcp/tool";
import { tool } from "tmcp/utils";
import * as v from "valibot";
import { getFromCache, saveToCache } from "../../services/cache-manager.js";
import {
  normalizeName as normalizeIconName,
  pascalCase,
  npmClient,
  addVerb,
} from "./utils/shadcn-utils.js";

function tokenVariants(token: string): string[] {
  // Light plural tolerance: "messages" also matches "message".
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return [token, token.slice(0, -1)];
  }
  return [token];
}

/**
 * Resolves a query string to an exact icon-name lookup, or returns
 * undefined to fall through to fuzzy scored search.
 *
 * - Comma-separated input is always treated as an explicit name list
 *   (e.g. 'truck, package').
 * - Otherwise the whole query is normalized first, so 'message circle'
 *   resolves to the exact icon 'message-circle'.
 * - Space-separated tokens are only treated as an exact lookup when
 *   EVERY token is a real icon name; otherwise fuzzy search runs so
 *   partial words like 'message circle chat' match across names + tags.
 */
function resolveNamesFromQuery(
  query: string,
  iconNameSet: Set<string>,
): string[] | undefined {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return undefined;

  if (trimmedQuery.includes(",")) {
    const parts = trimmedQuery
      .split(",")
      .map((name) => normalizeIconName(name))
      .filter((name) => name.length > 0);
    return parts.length > 0 ? parts : undefined;
  }

  const normalizedFull = normalizeIconName(trimmedQuery);
  if (normalizedFull && iconNameSet.has(normalizedFull)) {
    return [normalizedFull];
  }

  const tokens = tokenizeQuery(trimmedQuery);
  if (tokens.length > 1 && tokens.every((token) => iconNameSet.has(token))) {
    return tokens;
  }

  return undefined;
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

  // Multi-word queries reward icons matching MANY tokens (coverage), so
  // 'message circle chat' ranks 'message-circle' above plain 'circle'.
  let matchedTokens = 0;

  for (const token of queryTokens) {
    let tokenMatched = false;
    const variants = tokenVariants(token);

    for (const variant of variants) {
      // Singular fallbacks score slightly lower than the literal token.
      const weight = variant === token ? 1 : 0.8;
      if (nameLower === variant) {
        score += 90 * weight;
        tokenMatched = true;
        break;
      } else if (nameLower.startsWith(variant)) {
        score += 35 * weight;
        tokenMatched = true;
        break;
      } else if (variant.length > 2 && nameLower.includes(variant)) {
        score += 15 * weight;
        tokenMatched = true;
        break;
      }
    }

    for (const tag of tags) {
      const tagLower = tag.toLowerCase();
      for (const variant of variants) {
        const weight = variant === token ? 1 : 0.8;
        if (tagLower === variant) {
          score += 25 * weight;
          tokenMatched = true;
          break;
        } else if (
          variant.length > 2 &&
          tagLower.length > 2 &&
          (tagLower.includes(variant) ||
            (variant.length >= 4 &&
              tagLower.length >= 4 &&
              variant.includes(tagLower)))
        ) {
          score += 8 * weight;
          tokenMatched = true;
          break;
        }
      }
    }

    if (tokenMatched) {
      matchedTokens += 1;
    }
  }

  if (queryTokens.length > 1 && matchedTokens > 0) {
    score += matchedTokens * 30;
    if (matchedTokens === queryTokens.length) {
      score += 50;
    }
  }

  return score;
}

// Tool for searching and browsing Lucide icons
export const shadcnSvelteIconsTool = defineTool(
  {
    name: "shadcn-svelte-icons",
    description:
      "Search real Lucide icons for lucide-svelte by name or tag (1600+ icons, no hallucination). Icons only — for components use shadcn-svelte-get, shadcn-svelte-search, or shadcn-svelte-list. Accepts comma- or space-separated names (e.g. 'truck, package').",
    schema: v.object({
      query: v.optional(
        v.pipe(
          v.string(),
          v.description(
            "Search term to filter icons (searches icon names and tags), or multiple icon names separated by commas or spaces (e.g., 'truck, package, dashboard' or 'truck package dashboard')",
          ),
        ),
      ),
      // `names` allows an agent to request a specific set of icons by name
      names: v.optional(
        v.pipe(
          v.array(v.string()),
          v.description(
            "Specific icon names to return (e.g., ['arrow-left', 'user'])",
          ),
        ),
      ),
      importLimit: v.optional(
        v.pipe(
          v.number(),
          v.description(
            "Maximum number of icon imports to show in the snippet (default: 10). This prevents long import lines but can be increased if needed.",
          ),
        ),
        10,
      ),
      limit: v.optional(
        v.pipe(
          v.number(),
          v.description("Maximum number of icons to return (default: 50)"),
        ),
        100,
      ),
      packageManager: v.optional(
        v.pipe(
          v.picklist(["npm", "yarn", "pnpm", "bun"]),
          v.description(
            "Optional package manager for install commands. If omitted, the tool will use a recommended default (npx/PNPM/Yarn/bun as appropriate).",
          ),
        ),
      ),
    }),
  },
  async (input) => {
    const { query, limit = 100, importLimit = 10, packageManager } = input;
    let { names } = input;

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

      // Resolve multi-name queries against the real icon list. Needs the
      // fetched data: space-separated words fall through to fuzzy search
      // unless every word (or the dashed whole) is an exact icon name.
      if (query && !names) {
        names = resolveNamesFromQuery(
          query,
          new Set(allIcons.map((name) => name.toLowerCase())),
        );
      }

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
        iconList += `${npmClient(packageManager)} ${addVerb(packageManager)} @lucide/svelte\n`;
        iconList += `\`\`\`\n\n`;

        // Show individual examples for each icon (up to importLimit)
        const exampleIcons = limitedIcons.slice(0, importLimit);
        for (const iconName of exampleIcons) {
          const pascalName = pascalCase(iconName);
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

      return tool.text(iconList);
    } catch (error) {
      return tool.error(`Error fetching icon data: ${error}`);
    }
  },
);
