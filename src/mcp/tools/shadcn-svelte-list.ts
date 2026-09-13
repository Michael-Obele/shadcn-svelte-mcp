import { defineTool } from "tmcp/tool";
import { tool } from "tmcp/utils";
import * as v from "valibot";
import { getAllContent } from "../../services/component-discovery.js";
import {
  bulletList,
  renderColumns,
  renderGroupedSection,
  LIST_FOOTER,
  LIST_USAGE,
} from "./utils/shadcn-utils.js";

// Tool for listing all available components and documentation
export const shadcnSvelteListTool = defineTool(
  {
    name: "shadcn-svelte-list",
    description:
      "List all available shadcn-svelte components, blocks, charts, documentation sections, and Bits UI primitives by discovering them from the live websites",
    schema: v.object({
      type: v.optional(
        v.pipe(
          v.picklist([
            "components",
            "blocks",
            "charts",
            "docs",
            "bits-ui",
            "all",
          ]),
          v.description(
            "What to list: components, blocks, charts, docs, bits-ui, or all",
          ),
        ),
        "all",
      ),
    }),
  },
  async ({ type }) => {
    try {
      // Get all content from discovery service
      const content = await getAllContent();

      let result = "# shadcn-svelte Resources\n\n";

      // List components if requested
      if (type === "components" || type === "all") {
        result += "## Components\n\n";
        result += `Found ${content.components.length} shadcn-svelte components:\n\n`;
        result += renderColumns(content.components.map((c) => c.name));
      }

      // List Bits UI components if requested
      if (type === "bits-ui" || type === "all") {
        result += "## Bits UI Components\n\n";
        result += `Found ${content.bitsUIComponents.length} headless UI primitives (used by shadcn-svelte):\n\n`;
        result += renderColumns(content.bitsUIComponents.map((c) => c.name));
        result +=
          "*These are the underlying headless components that shadcn-svelte builds upon.*\n\n";
      }

      // List blocks if requested (live registry data)
      if (type === "blocks" || type === "all") {
        result += "## Blocks\n\n";
        result += `Found ${content.blocks.length} pre-built sections (dashboards, sidebars, login pages, etc.):\n\n`;
        result += renderGroupedSection(
          content.blocks.map((b) => b.name),
          false,
        );
      }

      // List charts if requested (live registry data)
      if (type === "charts" || type === "all") {
        result += "## Charts\n\n";
        result += `Found ${content.charts.length} pre-built chart components:\n\n`;
        result += renderGroupedSection(
          content.charts.map((c) => c.name),
          true,
          " Charts",
        );
      }

      // List documentation if requested
      if (type === "docs" || type === "all") {
        result += "## Documentation\n\n";
        const sections = [
          ["Installation", content.docs.installation],
          ["Dark Mode", content.docs.darkMode],
          ["Migration", content.docs.migration],
          ["General", content.docs.general],
        ] as const;
        for (const [heading, names] of sections) {
          result += `### ${heading}\n`;
          result += bulletList(names);
          result += "\n";
        }
      }

      // Add notes about themes and colors
      if (type === "all") {
        result += `${LIST_FOOTER}\n`;
      }

      result += LIST_USAGE;

      return tool.text(result);
    } catch (error) {
      return tool.error(`Error listing resources: ${error}`);
    }
  },
);
