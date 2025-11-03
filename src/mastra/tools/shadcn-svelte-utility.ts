import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  fetchInstallationDocs,
  fetchGeneralDocs,
} from "../../services/doc-fetcher.js";

// Tool for utility functions like installation and migration
export const shadcnSvelteUtilityTool = createTool({
  id: "shadcn-svelte-utility",
  description:
    "Utility tool for installation guides, migration help, theming, and other shadcn-svelte tasks from the live website. IMPORTANT: All guides are for SVELTE, not React. Do not confuse with React patterns.",
  inputSchema: z.object({
    action: z
      .enum(["install", "migrate", "theme", "cli", "icons", "help"])
      .describe(
        "Action to perform: install, migrate, theme, cli, icons, or help"
      ),
    framework: z
      .enum(["sveltekit", "vite", "astro", "sapper", "plain-svelte"])
      .optional()
      .describe("Framework for installation"),
    packageManager: z
      .enum(["npm", "yarn", "pnpm", "bun"])
      .optional()
      .describe("Package manager preference (for display purposes)"),
    query: z
      .string()
      .optional()
      .describe(
        "Search query for filtering icons (searches icon names and tags)"
      ),
    limit: z
      .number()
      .optional()
      .default(50)
      .describe("Maximum number of icons to return (default: 50)"),
  }),
  execute: async ({ context }) => {
    const {
      action,
      framework,
      packageManager = "npm",
      query,
      limit = 50,
    } = context;

    try {
      if (action === "install") {
        const result = await fetchInstallationDocs(framework, {
          useCache: true,
        });

        if (!result.success || !result.markdown) {
          return `Error fetching installation docs: ${result.error}`;
        }

        let response = `# Installation Guide\n\n`;
        if (framework) {
          response += `**Framework:** ${framework}\n\n`;
        }
        response += result.markdown;

        // Add package manager note
        response += `\n\n---\n\n**Note:** The examples above can be adapted for ${packageManager}. Replace the package manager commands as needed.`;

        return response;
      } else if (action === "migrate") {
        let result = await fetchGeneralDocs("/docs/migration", {
          useCache: true,
        });

        // Try alternate paths if the main one fails
        if (!result.success) {
          result = await fetchGeneralDocs("/docs/migration/svelte-5", {
            useCache: true,
          });
        }

        if (!result.success || !result.markdown) {
          return `Error fetching migration docs: ${result.error}`;
        }

        return `# Migration Guide\n\n${result.markdown}`;
      } else if (action === "theme") {
        const result = await fetchGeneralDocs("/docs/theming", {
          useCache: true,
        });

        if (!result.success || !result.markdown) {
          return `Error fetching theming docs: ${result.error}`;
        }

        return `# Theming Guide\n\n${result.markdown}`;
      } else if (action === "cli") {
        const result = await fetchGeneralDocs("/docs/cli", { useCache: true });

        if (!result.success || !result.markdown) {
          return `Error fetching CLI docs: ${result.error}`;
        }

        return `# CLI Documentation\n\n${result.markdown}`;
      } else if (action === "icons") {
        // Fetch Lucide icon data from CDN
        try {
          const iconResponse = await fetch(
            "https://unpkg.com/lucide-static@latest/icon-nodes.json"
          );
          if (!iconResponse.ok) {
            throw new Error(
              `Failed to fetch icon data: ${iconResponse.status}`
            );
          }

          const iconData = (await iconResponse.json()) as Record<
            string,
            unknown
          >;
          const allIcons = Object.keys(iconData);

          // Fetch tags for better search if query provided
          let tagsData: Record<string, string[]> = {};
          if (query) {
            const tagsResponse = await fetch(
              "https://unpkg.com/lucide-static@latest/tags.json"
            );
            if (tagsResponse.ok) {
              tagsData = (await tagsResponse.json()) as Record<
                string,
                string[]
              >;
            }
          }

          // Filter icons if query provided
          let filteredIcons = allIcons;
          if (query) {
            const searchLower = query.toLowerCase();
            filteredIcons = allIcons.filter((iconName) => {
              // Search in icon name
              if (iconName.toLowerCase().includes(searchLower)) {
                return true;
              }
              // Search in tags
              const tags = tagsData[iconName] || [];
              return tags.some((tag) =>
                tag.toLowerCase().includes(searchLower)
              );
            });
          }

          // Apply limit
          const limitedIcons = filteredIcons.slice(0, limit);
          const hasMore = filteredIcons.length > limit;

          // Build response
          let iconList = `# Lucide Icons${query ? ` (search: "${query}")` : ""}\n\n`;
          iconList += `Found **${filteredIcons.length}** icon${filteredIcons.length !== 1 ? "s" : ""}`;
          iconList += ` (showing ${limitedIcons.length})${hasMore ? ` — showing first ${limit}` : ""}\n\n`;

          if (limitedIcons.length === 0) {
            iconList += `No icons found matching "${query}".\n\n`;
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
            const firstIconPascal = limitedIcons[0]
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join("");
            iconList += `  import { ${firstIconPascal} } from '@lucide/svelte';\n`;
            iconList += `</script>\n\n`;
            iconList += `<${firstIconPascal} />\n`;
            iconList += `\`\`\`\n`;
          }

          iconList += `\n**Total icons available:** ${allIcons.length}\n`;
          iconList += `**Search tips:** Try keywords like "arrow", "user", "file", "check", "heart", "star", etc.\n`;

          return iconList;
        } catch (error) {
          return `Error fetching icon data: ${error}`;
        }
      } else if (action === "help") {
        return `# shadcn-svelte Help

## Available Actions

### Installation (\`install\`)
Get installation guides for different frameworks.

**Parameters:**
- \`framework\`: sveltekit, vite, astro, sapper, plain-svelte (optional)
- \`packageManager\`: npm, yarn, pnpm, bun (optional, for preference note)

**Example:**
\`\`\`json
{
  "action": "install",
  "framework": "sveltekit",
  "packageManager": "pnpm"
}
\`\`\`

### Migration (\`migrate\`)
Get migration guides for upgrading shadcn-svelte or Svelte versions.

**Example:**
\`\`\`json
{
  "action": "migrate"
}
\`\`\`

### Theming (\`theme\`)
Get theming and customization documentation.

**Example:**
\`\`\`json
{
  "action": "theme"
}
\`\`\`

### CLI (\`cli\`)
Get CLI tool documentation.

**Example:**
\`\`\`json
{
  "action": "cli"
}
\`\`\`

### Icons (\`icons\`)
Search and browse Lucide icons available for use with lucide-svelte.

**Parameters:**
- \`query\`: Search term to filter icons (searches names and tags) (optional)
- \`limit\`: Maximum number of icons to return (default: 50) (optional)
- \`packageManager\`: npm, yarn, pnpm, bun (optional, for install commands)

**Example:**
\`\`\`json
{
  "action": "icons",
  "query": "arrow",
  "limit": 20,
  "packageManager": "pnpm"
}
\`\`\`

**Features:**
- Browse all 1400+ Lucide icons
- Search by icon name or tags (e.g., "email", "user", "arrow")
- Get usage examples with proper PascalCase imports
- No AI hallucination - returns only real icons that exist

## Other Tools

- **List Tool** (\`shadcn-svelte-list\`): See all available components and documentation
- **Get Tool** (\`shadcn-svelte-get\`): Get detailed information about specific components or docs

## Quick Start

1. Use \`list\` to see what's available
2. Use \`get\` to retrieve specific component or documentation details
3. Use this \`utility\` tool for installation, migration, theming, and CLI help

## Tips

- All content is fetched from the live shadcn-svelte.com website
- Results are cached for 24 hours for better performance
- Always use Svelte 5 with runes (\`$state\`, \`$props\`, \`$derived\`, \`$effect\`)`;
      }

      return `Unknown action "${action}". Use "install", "migrate", "theme", "cli", or "help".`;
    } catch (error) {
      return `Error performing ${action}: ${error}`;
    }
  },
});
