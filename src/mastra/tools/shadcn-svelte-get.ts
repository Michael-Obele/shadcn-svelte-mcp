import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  fetchComponentDocs,
  fetchGeneralDocs,
  fetchSvelteSonnerDocs,
  type FetchResult,
} from "../../services/doc-fetcher.js";
import {
  isBlock,
  fetchBlockCode,
  extractExamples,
  extractVariants,
  extractSummary,
  sanitizeContent,
  getInstallCommand,
  getImportPath,
  getFirstCodeBlock,
} from "./utils/shadcn-utils.js";

/**
 * Response interface for structured JSON output
 * Optimized for LLM consumption
 */
interface ToolResponse {
  success: boolean;
  name?: string;
  type?: "component" | "block" | "chart" | "doc" | "theme" | "unknown";
  description?: string;
  installCommand?: {
    packageManagers: {
      npm: string;
      yarn: string;
      pnpm: string;
      bun: string;
    };
    cliOptions: Record<string, string>;
  };
  importPath?: string;
  dependencies?: string[];
  docs?: {
    main?: string;
    primitive?: string;
  };
  usage?: {
    summary?: string;
    code?: string;
  };
  variants?: string[];
  contextRules?: string[];
  rawContent?: string;
  error?: string;
  // Metadata for non-component docs
  metadata?: {
    url?: string;
    title?: string;
    [key: string]: any;
  };
}

// Tool for getting detailed information about components or documentation
export const shadcnSvelteGetTool = createTool({
  id: "shadcn-svelte-get",
  description:
    "Get detailed information about any shadcn-svelte component, block, chart, documentation section, or Svelte Sonner docs from the live websites. Returns structured JSON with content, metadata, code blocks, and warnings. Supports components (UI primitives), blocks (pre-built sections like dashboards/sidebars), charts, docs, and sonner. IMPORTANT: This is for SVELTE components only - do NOT use React-specific props like 'asChild' or React patterns. Svelte has different APIs and patterns than React.",
  inputSchema: z.object({
    name: z
      .string()
      .describe(
        "Name of the component, documentation section, or 'sonner' for Svelte Sonner docs"
      ),
    type: z
      .enum(["component", "doc", "sonner"])
      .describe(
        "Type: 'component' for UI components/blocks/charts, 'doc' for documentation, 'sonner' for Svelte Sonner docs"
      ),
    packageManager: z
      .enum(["npm", "yarn", "pnpm", "bun"]) // optional package manager override for generated snippets
      .optional()
      .describe(
        "Preferred package manager to use when rendering installation commands"
      ),
  }),
  execute: async ({ context }): Promise<string> => {
    const { name, type, packageManager } = context;

    try {
      if (type === "component") {
        // Check if this is a block/chart (uses different API)
        if (isBlock(name)) {
          const blockResult = await fetchBlockCode(name, packageManager);

          if (!blockResult.success) {
            const response: ToolResponse = {
              success: false,
              error: `Block/Chart "${name}" not found: ${blockResult.error}`,
            };
            return JSON.stringify(response, null, 2);
          }

          const response: ToolResponse = {
            success: true,
            name,
            type: name.startsWith("chart-") ? "chart" : "block",
            description: `Block/Chart component: ${name}`,
            installCommand: getInstallCommand(name, packageManager),
            docs: {
              main: `https://shadcn-svelte.com/blocks/${name}`,
            },
            contextRules: [
              "This is a SVELTE block/chart. Do NOT use React-specific props or patterns.",
              "Note: Project should already be initialized with shadcn-svelte before adding components.",
            ],
            rawContent: blockResult.code,
          };
          return JSON.stringify(response, null, 2);
        }

        // Regular component - fetch from component docs
        const result = await fetchComponentDocs(name, { useCache: true });

        if (!result.success || !result.content) {
          const response: ToolResponse = {
            success: false,
            error: result.error || `Component "${name}" not found`,
          };
          return JSON.stringify(response, null, 2);
        }

        const rawContent = sanitizeContent(result.content);
        const summary = extractSummary(rawContent);
        const examples = extractExamples(rawContent);
        const variants = extractVariants(rawContent);

        // Fallback for primary code if examples didn't catch it
        const primaryCode =
          examples.length > 0
            ? examples[0].code
            : getFirstCodeBlock(rawContent);

        const response: ToolResponse = {
          success: true,
          name: result.metadata?.title || name,
          type: "component",
          description: summary || `Displays a ${name} component.`,
          installCommand: getInstallCommand(name, packageManager),
          importPath: getImportPath(name),
          dependencies: ["bits-ui"],
          docs: {
            main: `https://shadcn-svelte.com/docs/components/${name}`,
            primitive: result.metadata?.bitsUiUrl || result.bitsUiUrl,
          },
          usage: {
            summary: "Use the examples below to understand implementation.",
            code: primaryCode,
          },
          variants:
            variants.length > 0 ? variants.map((v) => v.name) : undefined,
          contextRules: [
            "Do NOT use React-specific props like 'asChild'.",
            "Use standard Svelte slot patterns or snippets where applicable.",
            "Always follow the Svelte examples shown in the documentation.",
          ],
          rawContent,
        };
        return JSON.stringify(response, null, 2);
      } else if (type === "doc") {
        let result: FetchResult | null = null;

        // Try path directly if it has a slash
        if (name.includes("/")) {
          result = await fetchGeneralDocs(`/docs/${name}`, { useCache: true });
          if (!result.success)
            result = await fetchGeneralDocs(`/${name}`, { useCache: true });
        }

        // Try standard roots
        if (!result || !result.success) {
          const searchPaths = name
            ? [
                `/docs/${name}`,
                `/docs/installation/${name}`,
                `/docs/cli/${name}`,
                `/${name}`,
              ]
            : [`/docs`];
          for (const path of searchPaths) {
            result = await fetchGeneralDocs(path, { useCache: true });
            if (result.success) break;
          }
        }

        if (!result || !result.success || !result.content) {
          const response: ToolResponse = {
            success: false,
            error: result?.error || `Documentation "${name}" not found`,
          };
          return JSON.stringify(response, null, 2);
        }

        const content = sanitizeContent(result.content);
        const response: ToolResponse = {
          success: true,
          name: result.metadata?.title || name,
          type: "doc",
          description: extractSummary(content),
          docs: {
            main: result.metadata?.url,
          },
          usage: {
            summary: "Primary usage code block extracted from documentation.",
            code: getFirstCodeBlock(content),
          },
          rawContent: content,
          metadata: result.metadata,
        };
        return JSON.stringify(response, null, 2);
      } else if (type === "sonner") {
        const result = await fetchSvelteSonnerDocs({ useCache: true });

        if (!result.success || !result.content) {
          const response: ToolResponse = {
            success: false,
            error:
              result.error || "Failed to fetch Svelte Sonner documentation",
          };
          return JSON.stringify(response, null, 2);
        }

        const content = sanitizeContent(result.content);
        const response: ToolResponse = {
          success: true,
          name: "Svelte Sonner",
          type: "doc",
          description: "An opinionated toast component for Svelte.",
          installCommand: getInstallCommand("sonner", packageManager),
          importPath: 'import { toast } from "svelte-sonner";',
          docs: {
            main: "https://shadcn-svelte.com/docs/components/sonner",
          },
          usage: {
            summary: "Primary usage code block extracted from documentation.",
            code: getFirstCodeBlock(content),
          },
          rawContent: content,
          metadata: result.metadata,
        };
        return JSON.stringify(response, null, 2);
      }

      throw new Error(`Invalid type "${type}"`);
    } catch (error) {
      return JSON.stringify(
        {
          success: false,
          error: `Error retrieving ${type} "${name}": ${error instanceof Error ? error.message : error}`,
        },
        null,
        2
      );
    }
  },
});
