import { defineTool } from "tmcp/tool";
import { tool } from "tmcp/utils";
import * as v from "valibot";
import {
  fetchComponentDocs,
  fetchGeneralDocs,
  type FetchResult,
} from "../../services/doc-fetcher.js";
import {
  isBlock,
  fetchRegistryItem,
  extractExamples,
  extractVariants,
  extractSummary,
  sanitizeContent,
  getInstallCommand,
  getImportPath,
  getFirstCodeBlock,
  extractBitsUiName,
  toJson,
  shadcnComponentUrl,
  registryBlockUrl,
  DISCOVER_STEPS,
  SVELTE_RULES,
  BLOCK_CHART_RULES,
} from "./utils/shadcn-utils.js";

/** Extract Bits UI component name from a docs URL. */

/**
 * Response interface for structured JSON output
 * Optimized for LLM consumption
 */
interface ToolResponse {
  success: boolean;
  name?: string;
  type?: "component" | "block" | "chart" | "doc" | "theme" | "unknown";
  description?: string;
  tooling?: {
    primary: "shadcn-svelte-get";
    bitsUi?: {
      available: boolean;
      exactName?: string;
      onlyFor?: string;
      reason?: string;
    };
  };
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
    bitsuiName?: string;
  };
  usage?: {
    summary?: string;
    code?: string;
  };
  variants?: string[];
  contextRules?: string[];
  rawContent?: string;
  error?: string;
  suggestion?: string;
  nextSteps?: string[];
  // Metadata for non-component docs
  metadata?: {
    url?: string;
    title?: string;
    [key: string]: any;
  };
}

// PRIMARY TOOL - Tool for getting detailed information about components or documentation
export const shadcnSvelteGetTool = defineTool(
  {
    name: "shadcn-svelte-get",
    description:
      "PRIMARY tool for shadcn-svelte. Get docs for any component, block, chart, or doc section. Use FIRST for shadcn-svelte questions. Svelte only, not React. If the response includes tooling.bitsUi.exactName, that is the only value to pass to bits-ui-get.",
    schema: v.object({
      name: v.pipe(
        v.string(),
        v.description("Name of the component or documentation section"),
      ),
      type: v.pipe(
        v.picklist(["component", "doc"]),
        v.description(
          "Type: 'component' for UI components/blocks/charts (including sonner), 'doc' for documentation",
        ),
      ),
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
  async ({ name, type, packageManager }) => {
    const respond = (response: ToolResponse) => tool.text(toJson(response));

    /** Builds the success envelope for a registry-sourced item. */
    const registryResponse = (
      itemName: string,
      registryType: string | undefined,
      code: string | undefined,
    ): ToolResponse => ({
      success: true,
      name: itemName,
      type:
        itemName.startsWith("chart-") ? "chart"
        : registryType === "registry:ui" ? "component"
        : "block",
      description:
        registryType === "registry:ui"
          ? `UI component (registry source): ${itemName}`
          : `Block/Chart component: ${itemName}`,
      installCommand: getInstallCommand(itemName),
      docs: { main: registryBlockUrl(itemName) },
      contextRules: BLOCK_CHART_RULES,
      rawContent: code,
    });

    try {
      if (type === "component") {
        // Check if this is a block/chart (uses different API)
        if (isBlock(name)) {
          const blockResult = await fetchRegistryItem(name, packageManager);

          if (!blockResult.success) {
            return respond({
              success: false,
              error: `Block/Chart "${name}" not found: ${blockResult.error}`,
              suggestion: `The block/chart name "${name}" may not exist. Use shadcn-svelte-list to discover available blocks and charts.`,
              nextSteps: [
                `1. Use shadcn-svelte-list with type "blocks" or "charts" to see all available blocks and charts`,
                `2. Check the correct spelling - block/chart names are case-sensitive`,
                `3. Visit https://shadcn-svelte.com/blocks to browse all available blocks`,
                `4. Blocks often have numerical suffixes (e.g., sidebar-03, dashboard-01)`,
              ],
            });
          }

          return respond(
            registryResponse(name, blockResult.registryType, blockResult.code),
          );
        }

        // Regular component - fetch from component docs
        const result = await fetchComponentDocs(name, { useCache: true });

        if (!result.success || !result.content) {
          // Fallback: registry-only items (e.g. `form`) have no docs page
          // but exist in the registry. Try the block/registry fetch.
          const blockFallback = await fetchRegistryItem(name, packageManager);
          if (blockFallback.success) {
            return respond(
              registryResponse(
                name,
                blockFallback.registryType,
                blockFallback.code,
              ),
            );
          }

          return respond({
            success: false,
            error: result.error || `Component "${name}" not found`,
            suggestion: `The component name "${name}" may not exist in shadcn-svelte. Available components can be discovered.`,
            nextSteps: DISCOVER_STEPS,
          });
        }

        const rawContent = sanitizeContent(result.content);
        const summary = extractSummary(rawContent);
        const examples = extractExamples(rawContent);
        const variants = extractVariants(rawContent);
        const bitsUiName = extractBitsUiName(result.bitsUiUrl);
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
          tooling: {
            primary: "shadcn-svelte-get",
            bitsUi: bitsUiName
              ? {
                  available: true,
                  exactName: bitsUiName,
                  onlyFor: `Only use bits-ui-get if you need lower-level primitive internals for \"${bitsUiName}\". For normal shadcn-svelte wrapper usage, stay with shadcn-svelte-get.`,
                }
              : {
                  available: false,
                  reason:
                    "No underlying Bits UI primitive was exposed for this component response, so bits-ui-get is not needed.",
                },
          },
          installCommand: getInstallCommand(name),
          importPath: getImportPath(name),
          dependencies: bitsUiName ? ["bits-ui"] : [],
          docs: {
            main: shadcnComponentUrl(name),
            primitive: result.bitsUiUrl,
            bitsuiName: bitsUiName,
          },
          usage: {
            summary: "Use the examples below to understand implementation.",
            code: primaryCode,
          },
          variants:
            variants.length > 0 ? variants.map((v) => v.name) : undefined,
          contextRules: [
            ...SVELTE_RULES,
            bitsUiName
              ? `Use this shadcn-svelte wrapper for standard app code. Only call bits-ui-get when you specifically need the lower-level \"${bitsUiName}\" primitive internals.`
              : "If no docs.bitsuiName is present, do not switch to bits-ui-get.",
          ],
          rawContent,
        };
        return respond(response);
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
          return respond({
            success: false,
            error: result?.error || `Documentation "${name}" not found`,
          });
        }

        const content = sanitizeContent(result.content);
        return respond({
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
        });
      }

      throw new Error(`Invalid type "${type}"`);
    } catch (error) {
      return respond({
        success: false,
        error: `Error retrieving ${type} "${name}": ${error instanceof Error ? error.message : error}`,
      });
    }
  },
);
