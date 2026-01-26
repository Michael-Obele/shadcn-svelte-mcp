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
  suggestion?: string;
  nextSteps?: string[];
}

// Tool for getting detailed information about Bits UI components
// NOTE: This is a SECONDARY tool - only use after shadcn-svelte-get or when you need deeper API details
export const bitsUiGetTool = createTool({
  id: "bits-ui-get",
  description:
    "Get DEEPER API DETAILS about Bits UI primitives (the underlying library for shadcn-svelte). ONLY use this tool when: (1) shadcn-svelte-get returned a docs.bitsuiName field (meaning the component IS based on Bits UI), (2) you need lower-level primitive API documentation, or (3) you're building custom components with Bits UI primitives. DO NOT use this tool for components that don't have bitsuiName. For standard shadcn-svelte component usage, always use shadcn-svelte-get first. Returns structured JSON with API details optimized for AI consumption.",
  inputSchema: z.object({
    name: z.string().describe("Name of the Bits UI component"),
    packageManager: z
      .enum(["npm", "yarn", "pnpm", "bun"])
      .optional()
      .describe(
        "Preferred package manager to use when rendering installation commands",
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
        },
      );

      if (!result.success || !result.content) {
        const response: ToolResponse = {
          success: false,
          error: `Bits UI component "${normalizedName}" not found`,
          suggestion: `The component name "${normalizedName}" may not exist. Use shadcn-svelte-get to find the correct Bits UI primitive link.`,
          nextSteps: [
            `1. Use shadcn-svelte-get to see available shadcn-svelte components`,
            `2. Check the "docs.primitive" field in the response for the Bits UI component link`,
            `3. Or visit https://bits-ui.com/docs/components to browse all Bits UI components`,
            `4. Note: shadcn-svelte component names may differ from Bits UI names`,
          ],
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
        suggestion: `Use shadcn-svelte-get first to find the correct Bits UI component name. It provides docs.bitsuiName field with the exact Bits UI component name.`,
        nextSteps: [
          `1. Use shadcn-svelte-get with a shadcn-svelte component name (e.g., "sheet", "dialog")`,
          `2. Check the response's docs.bitsuiName field for the Bits UI component name`,
          `3. Use that name with bits-ui-get for deeper API details`,
          `4. Or visit https://bits-ui.com/docs/components to browse all components`,
        ],
      };
      return JSON.stringify(response, null, 2);
    }
  },
});
