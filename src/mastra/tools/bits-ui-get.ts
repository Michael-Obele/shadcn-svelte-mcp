import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  fetchComponentDocs,
  fetchGeneralDocs,
} from "../../services/doc-fetcher.js";
import { discoverBitsUIComponents } from "../../services/bits-ui-discovery.js";
import {
  parseBitsUiApi,
  sanitizeContent,
  extractSummary,
} from "./utils/shadcn-utils.js";

type ResolutionSource = "bits-ui-url" | "canonical-name" | "shadcn-component";

interface LookupResolution {
  requestedName: string;
  normalizedName: string;
  resolvedName?: string;
  source?: ResolutionSource;
  shadcnComponentName?: string;
}

function extractBitsUiComponentName(input?: string): string | undefined {
  if (!input) return undefined;

  try {
    const url = new URL(input.trim());
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (
      pathParts.length >= 3 &&
      pathParts[0] === "docs" &&
      pathParts[1] === "components"
    ) {
      return pathParts[2].toLowerCase();
    }
  } catch {
    // Input was not a URL.
  }

  return undefined;
}

function normalizeBitsUiComponentName(input: string): string {
  const extractedFromUrl = extractBitsUiComponentName(input);
  const candidate = extractedFromUrl ?? input.trim();

  return candidate
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function resolveBitsUiComponentName(
  input: string,
): Promise<LookupResolution> {
  const requestedName = input.trim();
  const normalizedName = normalizeBitsUiComponentName(requestedName);
  const bitsUiComponents = await discoverBitsUIComponents();
  const bitsUiComponentNames = new Set(
    bitsUiComponents.map((component) => component.name),
  );
  const urlComponentName = extractBitsUiComponentName(requestedName);

  if (urlComponentName && bitsUiComponentNames.has(urlComponentName)) {
    return {
      requestedName,
      normalizedName,
      resolvedName: urlComponentName,
      source: "bits-ui-url",
    };
  }

  if (bitsUiComponentNames.has(normalizedName)) {
    return {
      requestedName,
      normalizedName,
      resolvedName: normalizedName,
      source: "canonical-name",
    };
  }

  if (!normalizedName) {
    return {
      requestedName,
      normalizedName,
    };
  }

  const shadcnResult = await fetchComponentDocs(normalizedName, {
    useCache: true,
  });
  const shadcnBitsUiName = extractBitsUiComponentName(
    shadcnResult.metadata?.bitsUiUrl || shadcnResult.bitsUiUrl,
  );

  if (
    shadcnResult.success &&
    shadcnBitsUiName &&
    bitsUiComponentNames.has(shadcnBitsUiName)
  ) {
    return {
      requestedName,
      normalizedName,
      resolvedName: shadcnBitsUiName,
      source: "shadcn-component",
      shadcnComponentName: normalizedName,
    };
  }

  return {
    requestedName,
    normalizedName,
  };
}

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
  lookup?: LookupResolution;
  api?: {
    raw?: string;
  };
  tooling?: {
    preferredFor?: string;
    useShadcnWrapper?: string;
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
    "SECONDARY TOOL for lower-level Bits UI primitive internals. Use this only after shadcn-svelte-get returns docs.bitsuiName or tooling.bitsUi.exactName, and only when you need the underlying primitive API rather than standard shadcn-svelte usage. Accepts canonical Bits UI names, PascalCase names, or Bits UI component URLs, and can resolve some shadcn component names to their underlying primitive. For normal shadcn-svelte component usage, installation, or page composition, stay with shadcn-svelte-get.",
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

    try {
      const resolution = await resolveBitsUiComponentName(name);

      if (!resolution.resolvedName) {
        const response: ToolResponse = {
          success: false,
          error: `Bits UI component "${resolution.normalizedName || name}" not found`,
          lookup: resolution,
          suggestion:
            resolution.normalizedName && resolution.normalizedName !== name
              ? `The input was normalized to "${resolution.normalizedName}" but still did not match a Bits UI primitive. Use shadcn-svelte-get first and only pass its docs.bitsuiName value into bits-ui-get.`
              : `Use shadcn-svelte-get first to find the correct Bits UI primitive link and exact docs.bitsuiName value.`,
          nextSteps: [
            `1. Use shadcn-svelte-get with the shadcn-svelte component name you actually plan to use`,
            `2. If that response includes docs.bitsuiName, pass that exact value to bits-ui-get`,
            `3. Do not use bits-ui-get for standard shadcn-svelte installation or wrapper usage`,
            `4. Or visit https://bits-ui.com/docs/components to browse the canonical Bits UI primitive names`,
          ],
        };
        return JSON.stringify(response, null, 2);
      }

      const llmUrl = `https://bits-ui.com/docs/components/${resolution.resolvedName}/llms.txt`;

      // Fetch from Bits UI LLM docs
      const result = await fetchGeneralDocs(
        `/docs/components/${resolution.resolvedName}/llms.txt`,
        {
          useCache: true,
          baseUrl: "https://bits-ui.com",
        },
      );

      if (!result.success || !result.content) {
        const response: ToolResponse = {
          success: false,
          error: `Bits UI component "${resolution.resolvedName}" not found`,
          lookup: resolution,
          suggestion:
            resolution.source === "shadcn-component"
              ? `"${resolution.shadcnComponentName}" is a shadcn-svelte component that maps to the Bits UI primitive "${resolution.resolvedName}". Use shadcn-svelte-get for normal wrapper usage, and use bits-ui-get only when you need primitive internals.`
              : `The component name "${resolution.resolvedName}" may not exist. Use shadcn-svelte-get to find the correct Bits UI primitive link.`,
          nextSteps: [
            `1. Use shadcn-svelte-get to inspect the shadcn-svelte component you want`,
            `2. Check the response's docs.bitsuiName field for the exact Bits UI primitive name`,
            `3. Only come back to bits-ui-get when you need lower-level primitive behavior`,
            `4. Or visit https://bits-ui.com/docs/components to browse all Bits UI components`,
            `5. Note: shadcn-svelte component names may differ from Bits UI names`,
          ],
        };
        return JSON.stringify(response, null, 2);
      }

      // Parse structured API data from content
      const apiData = parseBitsUiApi(result.content);
      const rawContent = sanitizeContent(result.content);

      const response: ToolResponse = {
        success: true,
        name: result.metadata?.title || resolution.resolvedName,
        type: "component",
        description:
          extractSummary(rawContent) ||
          `Technical documentation for the ${resolution.resolvedName} component.`,
        docs: {
          main: `https://bits-ui.com/docs/components/${resolution.resolvedName}`,
          llm: llmUrl,
        },
        lookup: resolution,
        api: apiData ? { raw: apiData.raw } : undefined,
        tooling: {
          preferredFor:
            "Use this tool only for underlying Bits UI primitive internals, advanced behavior, and custom composition.",
          useShadcnWrapper:
            resolution.source === "shadcn-component"
              ? resolution.shadcnComponentName
              : undefined,
        },
        contextRules: [
          "Only use this tool after shadcn-svelte-get confirms docs.bitsuiName or tooling.bitsUi.exactName.",
          "Prefer shadcn-svelte-get for standard component usage, installation, and page composition.",
          resolution.source === "shadcn-component"
            ? `The requested input resolves through the shadcn-svelte component \"${resolution.shadcnComponentName}\" to the underlying Bits UI primitive \"${resolution.resolvedName}\". Use the shadcn wrapper in app code unless the user explicitly asks for primitive internals.`
            : `This is Bits UI primitive documentation for \"${resolution.resolvedName}\", the underlying headless component used by shadcn-svelte.`,
        ],
        rawContent,
      };
      return JSON.stringify(response, null, 2);
    } catch (error) {
      const response: ToolResponse = {
        success: false,
        error: `Error retrieving Bits UI component "${name}": ${error instanceof Error ? error.message : error}`,
        suggestion: `Use shadcn-svelte-get first to find the correct Bits UI component name. It provides docs.bitsuiName with the exact canonical value to pass here.`,
        nextSteps: [
          `1. Use shadcn-svelte-get with a shadcn-svelte component name (for example, "sheet" or "dialog")`,
          `2. Check the response's docs.bitsuiName field for the canonical Bits UI primitive name`,
          `3. Use that exact value with bits-ui-get when you need deeper primitive API details`,
          `4. Or visit https://bits-ui.com/docs/components to browse all components`,
        ],
      };
      return JSON.stringify(response, null, 2);
    }
  },
});
