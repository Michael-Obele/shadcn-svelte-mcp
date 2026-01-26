import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getAllContent } from "../../services/component-discovery.js";
import { discoverBitsUIComponents } from "../../services/bits-ui-discovery.js";

// Known blocks and charts (manually curated from investigation)
const BLOCKS = {
  featured: ["dashboard-01"],
  sidebar: ["sidebar-03", "sidebar-07"],
  login: ["login-03", "login-04"],
  // Add more as discovered
};

const CHARTS = {
  area: ["chart-area-default", "chart-area-interactive"],
  bar: ["chart-bar-default", "chart-bar-interactive"],
  line: ["chart-line-default", "chart-line-interactive"],
  pie: ["chart-pie-default", "chart-pie-interactive"],
  radar: ["chart-radar-default", "chart-radar-interactive"],
  radial: ["chart-radial-default", "chart-radial-interactive"],
  tooltip: ["chart-tooltip-default", "chart-tooltip-icons"],
  // Add more as discovered
};

// Tool for listing all available components and documentation
export const shadcnSvelteListTool = createTool({
  id: "shadcn-svelte-list",
  description:
    "List all available shadcn-svelte components, blocks, charts, documentation sections, and Bits UI primitives by discovering them from the live websites",
  inputSchema: z.object({
    type: z
      .enum(["components", "blocks", "charts", "docs", "bits-ui", "all"])
      .optional()
      .default("all")
      .describe("What to list: components, blocks, charts, docs, bits-ui, or all"),
  }),
  execute: async ({ context }) => {
    const { type = "all" } = context;

    try {
      // Get all content from discovery service
      const content = await getAllContent();

      let result = "# shadcn-svelte Resources\n\n";

      // List components if requested
      if (type === "components" || type === "all") {
        result += "## Components\n\n";
        result += `Found ${content.components.length} shadcn-svelte components:\n\n`;

        // Display in columns for better readability
        const columns = 3;
        for (let i = 0; i < content.components.length; i += columns) {
          const row = content.components
            .slice(i, i + columns)
            .map((c) => `\`${c.name}\``)
            .join(" · ");
          result += `${row}\n`;
        }
        result += "\n";
      }

      // List Bits UI components if requested
      if (type === "bits-ui" || type === "all") {
        const bitsUIComponents = content.bitsUIComponents;
        result += "## Bits UI Components\n\n";
        result += `Found ${bitsUIComponents.length} headless UI primitives (used by shadcn-svelte):\n\n`;

        // Display in columns for better readability
        const columns = 3;
        for (let i = 0; i < bitsUIComponents.length; i += columns) {
          const row = bitsUIComponents
            .slice(i, i + columns)
            .map((c) => `\`${c.name}\``)
            .join(" · ");
          result += `${row}\n`;
        }
        result += "\n";
        result += "*These are the underlying headless components that shadcn-svelte builds upon.*\n\n";
      }

      // List blocks if requested
      if (type === "blocks" || type === "all") {
        result += "## Blocks\n\n";
        result +=
          "Pre-built sections (dashboards, sidebars, login pages, etc.):\n\n";

        for (const [category, blocks] of Object.entries(BLOCKS)) {
          result += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n`;
          for (const block of blocks) {
            result += `- \`${block}\`\n`;
          }
          result += "\n";
        }
      }

      // List charts if requested
      if (type === "charts" || type === "all") {
        result += "## Charts\n\n";
        result += "Pre-built chart components:\n\n";

        for (const [category, charts] of Object.entries(CHARTS)) {
          result += `### ${category.charAt(0).toUpperCase() + category.slice(1)} Charts\n`;
          for (const chart of charts) {
            result += `- \`${chart}\`\n`;
          }
          result += "\n";
        }
      }

      // List documentation if requested
      if (type === "docs" || type === "all") {
        result += "## Documentation\n\n";

        result += "### Installation\n";
        for (const doc of content.docs.installation) {
          result += `- \`${doc}\`\n`;
        }
        result += "\n";

        result += "### Dark Mode\n";
        for (const doc of content.docs.darkMode) {
          result += `- \`${doc}\`\n`;
        }
        result += "\n";

        result += "### Migration\n";
        for (const doc of content.docs.migration) {
          result += `- \`${doc}\`\n`;
        }
        result += "\n";

        result += "### General\n";
        for (const doc of content.docs.general) {
          result += `- \`${doc}\`\n`;
        }
        result += "\n";
      }

      // Add notes about themes and colors
      if (type === "all") {
        result += "## Additional Resources\n\n";
        result += "### Themes\n";
        result +=
          "Interactive theme generator available at `/themes`. Themes are not individual components but CSS configurations you can copy and paste.\n\n";
        result += "### Colors\n";
        result +=
          "Tailwind color palette reference available at `/colors`. Shows colors in HEX, RGB, HSL, OKLCH, and CSS variable formats.\n\n";
        result += "### Icons\n";
        result +=
          "Lucide Svelte icons documentation and search available via the `icons` tool. Browse 1600+ Lucide icons with search and usage examples.\n\n";
      }

      result +=
        "---\n\n**Usage:** Use the `get` tool with `name` and `type` to retrieve detailed information.\n\n";
      result += "**Examples:**\n";
      result +=
        "- Get button component: `{ name: 'button', type: 'component' }`\n";
      result +=
        "- Get chart: `{ name: 'chart-tooltip-default', type: 'component' }`\n";
      result += "- Get block: `{ name: 'dashboard-01', type: 'component' }`\n";
      result +=
        "- Get installation docs: `{ name: 'sveltekit', type: 'doc' }`\n";

      return result;
    } catch (error) {
      return `Error listing resources: ${error}`;
    }
  },
});
