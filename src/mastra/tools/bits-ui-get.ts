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
    "Get DEEPER API DETAILS about Bits UI primitives (the underlying library for shadcn-svelte). Use this ONLY when: (1) you need lower-level primitive API documentation, (2) shadcn-svelte-get doesn't provide sufficient implementation details, or (3) you're building custom components with Bits UI primitives. For standard shadcn-svelte component usage, always use shadcn-svelte-get first. Returns structured JSON with API details optimized for AI consumption.",
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
          suggestion: `The component name "${normalizedName}" may not exist. Available Bits UI components can be discovered.`,
          nextSteps: [
            `1. Use the shadcn-svelte-list tool to see all available shadcn-svelte components and blocks`,
            `2. Or if you're looking for a specific Bits UI primitive, check the Bits UI documentation at https://bits-ui.com/docs/components`,
            `3. Try searching with a corrected component name`,
            `4. Note: shadcn-svelte wraps Bits UI components, so using shadcn-svelte-get is often better than bits-ui-get for standard components`,
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
        suggestion: `An error occurred while retrieving the component. Try these alternatives:`,
        nextSteps: [
          `1. Double-check the component name spelling`,
          `2. Use shadcn-svelte-get instead if this is a shadcn-svelte component`,
          `3. Check https://bits-ui.com/docs/components for valid component names`,
          `4. Try using shadcn-svelte-list to discover available components`,
        ],
      };
      return JSON.stringify(response, null, 2);
    }
  },
});
