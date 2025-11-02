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
      .enum(["install", "migrate", "theme", "cli", "help"])
      .describe("Action to perform: install, migrate, theme, cli, or help"),
    framework: z
      .enum(["sveltekit", "vite", "astro", "sapper", "plain-svelte"])
      .optional()
      .describe("Framework for installation"),
    packageManager: z
      .enum(["npm", "yarn", "pnpm", "bun"])
      .optional()
      .describe("Package manager preference (for display purposes)"),
  }),
  execute: async ({ context }) => {
    const { action, framework, packageManager = "npm" } = context;

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
