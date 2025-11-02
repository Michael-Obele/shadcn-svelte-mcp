import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  fetchComponentDocs,
  fetchGeneralDocs,
  type FetchResult,
} from "../../services/doc-fetcher.js";

// Tool for getting detailed information about components or documentation
export const shadcnSvelteGetTool = createTool({
  id: "shadcn-svelte-get",
  description:
    "Get detailed information about any shadcn-svelte component or documentation section from the live website. IMPORTANT: This is for SVELTE components only - do NOT use React-specific props like 'asChild' or React patterns. Svelte has different APIs and patterns than React.",
  inputSchema: z.object({
    name: z.string().describe("Name of the component or documentation section"),
    type: z
      .enum(["component", "doc"])
      .describe("Type: 'component' for UI components, 'doc' for documentation"),
  }),
  execute: async ({ context }) => {
    const { name, type } = context;

    try {
      if (type === "component") {
        // Fetch component docs (caching handled internally)
        const result = await fetchComponentDocs(name, { useCache: true });

        if (!result.success) {
          return `Component "${name}" not found or error occurred: ${result.error}\n\nUse the list tool to see available components.`;
        }

        if (!result.markdown) {
          return `Component "${name}" not found. Use the list tool to see available components.`;
        }

        // Add anti-hallucination warning at the top
        return `⚠️ IMPORTANT: This is a SVELTE component. Do NOT use React-specific props or patterns (like 'asChild', 'React.ReactNode', etc.). Always follow the Svelte examples shown below.\n\n# ${name} Component\n\n${result.markdown}`;
      } else if (type === "doc") {
        // Try common documentation paths
        const paths = [
          `/docs/${name}`,
          `/docs/installation/${name}`,
          `/docs/dark-mode/${name}`,
          `/docs/migration/${name}`,
        ];

        let result: FetchResult | null = null;
        for (const path of paths) {
          result = await fetchGeneralDocs(path, { useCache: true });
          if (result.success && result.markdown) {
            break;
          }
        }

        if (!result || !result.success || !result.markdown) {
          return `Documentation "${name}" not found. Use the list tool to see available documentation sections.`;
        }

        return `# ${name}\n\n${result.markdown}`;
      }

      return `Invalid type "${type}". Use "component" or "doc".`;
    } catch (error) {
      return `Error retrieving ${type} "${name}": ${error}`;
    }
  },
});
