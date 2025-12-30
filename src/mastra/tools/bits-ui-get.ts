import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  fetchGeneralDocs,
  type FetchResult,
} from "../../services/doc-fetcher.js";

/**
 * Response interface for structured JSON output
 */
interface ToolResponse {
  success: boolean;
  content?: string;
  metadata?: {
    title?: string;
    description?: string;
    author?: string;
    url?: string;
    keywords?: string[];
  };
  warnings?: string[];
  notes?: string[];
  type?: "component" | "doc" | "unknown";
  codeBlocks?: Array<{
    language?: string;
    code: string;
    title?: string;
  }>;
  error?: string;
}

// Tool for getting detailed information about Bits UI components
export const bitsUiGetTool = createTool({
  id: "bits-ui-get",
  description:
    "Get detailed information about any Bits UI component from the official LLM-optimized documentation. Bits UI is the underlying library for shadcn-svelte components, providing deeper API details and implementation specifics. Returns structured JSON with content optimized for AI consumption.",
  inputSchema: z.object({
    name: z.string().describe("Name of the Bits UI component"),
    packageManager: z
      .enum(["npm", "yarn", "pnpm", "bun"])
      .optional()
      .describe(
        "Preferred package manager to use when rendering installation commands"
      ),
  }),
  execute: async ({ context }): Promise<string> => {
    const { name } = context;

    // Normalize component name to lowercase for Bits UI
    const normalizedName = name.toLowerCase();

    try {
      // Fetch from Bits UI LLM docs
      const result = await fetchGeneralDocs(
        `/docs/components/${normalizedName}/llms.txt`,
        {
          useCache: true,
          baseUrl: "https://bits-ui.com",
        }
      );

      if (!result.success || !result.content) {
        const response: ToolResponse = {
          success: false,
          error:
            result.error || `Bits UI component "${normalizedName}" not found`,
          notes: [
            "Bits UI provides the underlying components for shadcn-svelte.",
            "Use this tool for detailed API documentation and implementation details.",
          ],
        };
        return JSON.stringify(response, null, 2);
      }

      // If a packageManager was provided, replace common installer patterns in result.content
      let content = result.content;
      const getPrefix = (pm?: string) => {
        if (!pm) return "npx";
        if (pm === "npm") return "npx";
        if (pm === "yarn") return "yarn dlx";
        if (pm === "pnpm") return "pnpm dlx";
        if (pm === "bun") return "bunx";
        return "npx";
      };
      const prefix = getPrefix(context.packageManager);
      if (content) {
        content = content.replace(
          /(?:npx|yarn dlx|pnpm dlx|bunx|bun x)\s+bits-ui@latest\s+add/gi,
          `${prefix} bits-ui@latest add`
        );
      }

      const response: ToolResponse = {
        success: true,
        content: content || result.content,
        metadata: result.metadata || {
          title: `${name} Component`,
          url: `https://bits-ui.com/docs/components/${normalizedName}/llms.txt`,
        },
        warnings: [
          "This is a Bits UI component documentation. Bits UI is the underlying library for shadcn-svelte.",
          "For shadcn-svelte usage examples, also check the shadcn-svelte-get tool.",
        ],
        type: "component",
        codeBlocks: result.codeBlocks,
      };
      return JSON.stringify(response, null, 2);
    } catch (error) {
      const response: ToolResponse = {
        success: false,
        error: `Error retrieving Bits UI component "${normalizedName}": ${error}`,
      };
      return JSON.stringify(response, null, 2);
    }
  },
});
