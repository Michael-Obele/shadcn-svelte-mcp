import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  fetchGeneralDocs,
  type FetchResult,
} from "../../services/doc-fetcher.js";
import {
  parseBitsUiApi,
  getInstallPrefix,
  sanitizeContent,
  extractSummary,
} from "./utils/shadcn-utils.js";

/**
 * Response interface for structured JSON output
 * Optimized for LLM consumption
 */
interface ToolResponse {
  success: boolean;
  name?: string;
  type?: "component" | "doc" | "unknown";
  description?: string;
  docs?: {
    main?: string;
    llm?: string;
  };
  api?: {
    raw?: string;
  };
  contextRules?: string[];
  rawContent?: string;
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
    const llmUrl = `https://bits-ui.com/docs/components/${normalizedName}/llms.txt`;

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
        };
        return JSON.stringify(response, null, 2);
      }

      // Parse structured API data from content
      const apiData = parseBitsUiApi(result.content);
      const rawContent = sanitizeContent(result.content);

      const response: ToolResponse = {
        success: true,
        name: result.metadata?.title || name,
        type: "component",
        description:
          extractSummary(rawContent) ||
          `Technical documentation for the ${name} component.`,
        docs: {
          main: `https://bits-ui.com/docs/components/${normalizedName}`,
          llm: llmUrl,
        },
        api: apiData ? { raw: apiData.raw } : undefined,
        contextRules: [
          "This is a Bits UI component documentation. Bits UI is the underlying library for shadcn-svelte.",
          "Use these primitives for building accessible custom components.",
        ],
        rawContent,
      };
      return JSON.stringify(response, null, 2);
    } catch (error) {
      const response: ToolResponse = {
        success: false,
        error: `Error retrieving Bits UI component "${normalizedName}": ${error instanceof Error ? error.message : error}`,
      };
      return JSON.stringify(response, null, 2);
    }
  },
});
