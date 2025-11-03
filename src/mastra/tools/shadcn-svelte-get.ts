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
        // Try a broad set of possible documentation roots so we can fetch
        // docs that live outside of `/docs` (e.g. /charts, /themes, /colors, /blocks, /view, /examples)
        const roots = [
          `/docs`,
          `/docs/installation`,
          `/docs/dark-mode`,
          `/docs/migration`,
          `/docs/registry`,
          `/docs/theming`,
          `/docs/cli`,
          `/charts`,
          `/themes`,
          `/colors`,
          `/blocks`,
          `/view`,
          `/examples`,
        ];

        let result: FetchResult | null = null;

        // If the caller provided a path-like name (contains a slash), try it directly first
        if (name.includes("/")) {
          result = await fetchGeneralDocs(`/docs/${name}`, { useCache: true });
          if (!result.success) {
            // also try without /docs prefix (handles top-level paths passed in)
            result = await fetchGeneralDocs(`/${name}`, { useCache: true });
          }
        }

        // Try each root + name
        if (!result || !result.success || !result.markdown) {
          for (const root of roots) {
            const path = name ? `${root}/${name}` : root;
            result = await fetchGeneralDocs(path, { useCache: true });
            if (result.success && result.markdown) break;
          }
        }

        // As a final fallback, try the root pages themselves (e.g. /charts)
        // But only if the name matches the root (to avoid returning /docs for a "charts" query)
        if ((!result || !result.success || !result.markdown) && roots.length) {
          for (const root of roots) {
            // Check if this root matches the name (e.g., "/charts" matches "charts")
            const rootName = root.substring(root.lastIndexOf("/") + 1);
            if (!name || rootName === name || root === `/${name}`) {
              result = await fetchGeneralDocs(root, { useCache: true });
              if (result.success && result.markdown) break;
            }
          }
        }

        if (!result || !result.success || !result.markdown) {
          return `Documentation "${name}" not found. Use the list tool to see available documentation sections.`;
        }

        // Return the markdown content with a helpful heading
        return `# ${name}\n\n${result.markdown}`;
      }

      return `Invalid type "${type}". Use "component" or "doc".`;
    } catch (error) {
      return `Error retrieving ${type} "${name}": ${error}`;
    }
  },
});
