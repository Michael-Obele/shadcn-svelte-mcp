import { defineTool } from "tmcp/tool";
import { tool } from "tmcp/utils";
import * as v from "valibot";
import {
  fetchComponentDocs,
  fetchGeneralDocs,
} from "../../services/doc-fetcher.js";
import { discoverBitsUIComponents } from "../../services/bits-ui-discovery.js";
import {
  parseBitsUiApi,
  sanitizeContent,
  extractSummary,
  normalizeName,
  extractBitsUiName,
  toJson,
  bitsUiComponentUrl,
  BITS_UI_STEPS,
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
  return extractBitsUiName(input);
}

function normalizeBitsUiComponentName(input: string): string {
  return normalizeName(extractBitsUiComponentName(input) ?? input);
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
export const bitsUiGetTool = defineTool(
  {
    name: "bits-ui-get",
    description:
      "Bits UI primitive internals. Use only after shadcn-svelte-get returns docs.bitsuiName or tooling.bitsUi.exactName, and only when you need the underlying primitive API. Accepts canonical Bits UI names, PascalCase names, component URLs, or some shadcn component names.",
    schema: v.object({
      name: v.pipe(v.string(), v.description("Name of the Bits UI component")),
      packageManager: v.optional(
        v.pipe(
          v.picklist(["npm", "yarn", "pnpm", "bun"]),
          v.description(
            "Preferred package manager to use when rendering installation commands",
          ),
        ),
      ),
    }),
  },
  async ({ name }) => {
    const fail = (response: ToolResponse) => tool.text(toJson(response));
    try {
      const resolution = await resolveBitsUiComponentName(name);

      if (!resolution.resolvedName) {
        return fail({
          success: false,
          error: `Bits UI component "${resolution.normalizedName || name}" not found`,
          lookup: resolution,
          suggestion:
            resolution.normalizedName && resolution.normalizedName !== name
              ? `The input was normalized to "${resolution.normalizedName}" but still did not match a Bits UI primitive. Use shadcn-svelte-get first and only pass its docs.bitsuiName value into bits-ui-get.`
              : `Use shadcn-svelte-get first to find the correct Bits UI primitive link and exact docs.bitsuiName value.`,
          nextSteps: BITS_UI_STEPS,
        });
      }

      const resolved = resolution.resolvedName;
      const llmUrl = `${bitsUiComponentUrl(resolved)}/llms.txt`;

      // Fetch from Bits UI LLM docs
      const result = await fetchGeneralDocs(
        `/docs/components/${resolved}/llms.txt`,
        {
          useCache: true,
          baseUrl: "https://bits-ui.com",
        },
      );

      if (!result.success || !result.content) {
        return fail({
          success: false,
          error: `Bits UI component "${resolved}" not found`,
          lookup: resolution,
          suggestion:
            resolution.source === "shadcn-component"
              ? `"${resolution.shadcnComponentName}" is a shadcn-svelte component that maps to the Bits UI primitive "${resolved}". Use shadcn-svelte-get for normal wrapper usage, and use bits-ui-get only when you need primitive internals.`
              : `The component name "${resolved}" may not exist. Use shadcn-svelte-get to find the correct Bits UI primitive link.`,
          nextSteps: [
            `1. Use shadcn-svelte-get to inspect the shadcn-svelte component you want`,
            `2. Check the response's docs.bitsuiName field for the exact Bits UI primitive name`,
            `3. Only come back to bits-ui-get when you need lower-level primitive behavior`,
            `4. Or visit https://bits-ui.com/docs/components to browse all Bits UI components`,
            `5. Note: shadcn-svelte component names may differ from Bits UI names`,
          ],
        });
      }

      // Parse structured API data from content
      const apiData = parseBitsUiApi(result.content);
      const rawContent = sanitizeContent(result.content);

      return fail({
        success: true,
        name: result.metadata?.title || resolved,
        type: "component",
        description:
          extractSummary(rawContent) ||
          `Technical documentation for the ${resolved} component.`,
        docs: {
          main: bitsUiComponentUrl(resolved),
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
            ? `The requested input resolves through the shadcn-svelte component \"${resolution.shadcnComponentName}\" to the underlying Bits UI primitive \"${resolved}\". Use the shadcn wrapper in app code unless the user explicitly asks for primitive internals.`
            : `This is Bits UI primitive documentation for \"${resolved}\", the underlying headless component used by shadcn-svelte.`,
        ],
        rawContent,
      });
    } catch (error) {
      return fail({
        success: false,
        error: `Error retrieving Bits UI component "${name}": ${error instanceof Error ? error.message : error}`,
        suggestion: `Use shadcn-svelte-get first to find the correct Bits UI component name. It provides docs.bitsuiName with the exact canonical value to pass here.`,
        nextSteps: [
          `1. Use shadcn-svelte-get with a shadcn-svelte component name (for example, "sheet" or "dialog")`,
          `2. Check the response's docs.bitsuiName field for the canonical Bits UI primitive name`,
          `3. Use that exact value with bits-ui-get when you need deeper primitive API details`,
          `4. Or visit https://bits-ui.com/docs/components to browse all components`,
        ],
      });
    }
  },
);
