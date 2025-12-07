import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getFromCache, saveToCache } from "../../services/cache-manager.js";

// Tool for searching and browsing Lucide icons
export const shadcnSvelteIconsTool = createTool({
  id: "shadcn-svelte-icons",
  description:
    "Search and browse Lucide icons available for use with lucide-svelte. Browse all 1600+ Lucide icons with search by name and tags. No AI hallucination - returns only real icons that exist.",
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe("Search term to filter icons (searches icon names and tags)"),
    // `names` allows an agent to request a specific set of icons by name
    names: z
      .array(z.string())
      .optional()
      .describe("Specific icon names to return (e.g., ['arrow-left', 'user'])"),
    limit: z
      .number()
      .optional()
      .default(50)
      .describe("Maximum number of icons to return (default: 50)"),
    packageManager: z
      .enum(["npm", "yarn", "pnpm", "bun"])
      .optional()
      .default("npm")
      .describe("Package manager for install commands"),
  }),
  execute: async ({ context }) => {
    const { query, limit = 50, packageManager = "npm" } = context;
    const { names } = context;

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
        const nameSet = new Set(names.map((n) => n.toLowerCase()));
        filteredIcons = allIcons.filter((iconName) => nameSet.has(iconName.toLowerCase()));
      } else if (query) {
        const searchLower = query.toLowerCase();
        filteredIcons = allIcons.filter((iconName) => {
          // Search in icon name
          if (iconName.toLowerCase().includes(searchLower)) {
            return true;
          }
          // Search in tags
          const tags = tagsData[iconName] || [];
          return tags.some((tag) => tag.toLowerCase().includes(searchLower));
        });
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
          if (!allIcons.some((a) => a.toLowerCase() === nm.toLowerCase())) {
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
        iconList += `${packageManager === "npm" ? "npm install" : packageManager === "yarn" ? "yarn add" : packageManager === "bun" ? "bun add" : "pnpm add"} @lucide/svelte\n`;
        iconList += `\`\`\`\n\n`;
        iconList += `\`\`\`svelte\n`;
        iconList += `<script>\n`;
        const pascalize = (name: string) =>
          name
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join("");
        // Import multiple icons if requested (respect limit)
        const importIcons = limitedIcons.slice(0, 10).map(pascalize); // limit import length for readability
        iconList += `  import { ${importIcons.join(", ")} } from '@lucide/svelte';\n`;
        iconList += `</script>\n\n`;
        for (const iconName of importIcons) {
          iconList += `<${iconName} /> `;
        }
        iconList += `\n`;
      }
      iconList += `\n**Total icons available:** ${allIcons.length}\n`;
      iconList += `**Search tips:** Try keywords like "arrow", "user", "file", "check", "heart", "star", etc.\n`;

      if (missingIcons.length) {
        iconList += `\n**Missing icons:** ${missingIcons.join(", ")}\n`;
      }

      return iconList;
    } catch (error) {
      return `Error fetching icon data: ${error}`;
    }
  },
});
