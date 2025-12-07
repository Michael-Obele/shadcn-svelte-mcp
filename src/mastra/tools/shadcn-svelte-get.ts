import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  fetchComponentDocs,
  fetchGeneralDocs,
  type FetchResult,
} from "../../services/doc-fetcher.js";

// Block/Chart detection patterns
const BLOCK_PATTERNS = [
  /^chart-/i,
  /^dashboard-/i,
  /^sidebar-/i,
  /^login-/i,
  /^signup-/i,
  /^otp-/i,
  /^calendar-/i,
];

/**
 * Detects if a component name is a block/chart
 */
function isBlock(name: string): boolean {
  return BLOCK_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Fetches block/chart code from the /api/block/ endpoint
 */
async function fetchBlockCode(
  name: string,
  packageManager?: "npm" | "yarn" | "pnpm" | "bun"
): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const url = `https://shadcn-svelte.com/api/block/${name}`;
    console.log(`[Fetcher] Fetching block from: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "shadcn-svelte-mcp/1.0.0 (Block Fetcher; +https://github.com/your-repo)",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    if (data.type !== "registry:block") {
      return {
        success: false,
        error: `Expected registry:block, got ${data.type}`,
      };
    }

    // Extract code from all files
    const files = data.files || [];
    let codeOutput = `# ${data.name}\n\n`;

    if (data.description) {
      codeOutput += `**Description:** ${data.description}\n\n`;
    }

    codeOutput += `**Type:** ${data.type}\n\n`;
    const getInstallPrefix = (pm?: string) => {
      if (!pm) return "npx";
      if (pm === "npm") return "npx";
      if (pm === "yarn") return "yarn dlx";
      if (pm === "pnpm") return "pnpm dlx";
      if (pm === "bun") return "bunx";
      return "npx";
    };
    const installPrefix = getInstallPrefix(packageManager);
    codeOutput += `**Installation:**\n\`\`\`bash\n${installPrefix} shadcn-svelte@latest add ${name}\n\`\`\`\n\n`;

    // Process each file
    for (const file of files) {
      const fileName = file.target || file.path || "unknown";
      codeOutput += `## File: ${fileName}\n\n`;
      codeOutput += `**Type:** ${file.type}\n\n`;

      // Parse highlightedContent (HTML-escaped pre tag with code)
      if (file.highlightedContent) {
        // Extract code from the pre tag
        const codeMatch = file.highlightedContent.match(
          /<pre[^>]*>.*?<code[^>]*>(.*?)<\/code>.*?<\/pre>/s
        );
        if (codeMatch) {
          // Decode HTML entities and escape sequences
          let code = codeMatch[1]
            .replace(/<span[^>]*>/g, "")
            .replace(/<\/span>/g, "")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&#x3C;/g, "<")
            .replace(/&#x3E;/g, ">")
            .replace(/\\n/g, "\n");

          // Detect language from filename
          let language = "typescript";
          if (fileName.endsWith(".svelte")) language = "svelte";
          else if (fileName.endsWith(".ts")) language = "typescript";
          else if (fileName.endsWith(".js")) language = "javascript";
          else if (fileName.endsWith(".css")) language = "css";

          codeOutput += `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
        }
      }
    }

    return { success: true, code: codeOutput };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

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
  type?: "component" | "block" | "chart" | "doc" | "theme" | "unknown";
  codeBlocks?: Array<{
    language?: string;
    code: string;
    title?: string;
  }>;
  error?: string;
}

// Tool for getting detailed information about components or documentation
export const shadcnSvelteGetTool = createTool({
  id: "shadcn-svelte-get",
  description:
    "Get detailed information about any shadcn-svelte component, block, chart, or documentation section from the live website. Returns structured JSON with content, metadata, code blocks, and warnings. Supports components (UI primitives), blocks (pre-built sections like dashboards/sidebars), and charts. IMPORTANT: This is for SVELTE components only - do NOT use React-specific props like 'asChild' or React patterns. Svelte has different APIs and patterns than React.",
  inputSchema: z.object({
    name: z.string().describe("Name of the component or documentation section"),
    type: z
      .enum(["component", "doc"])
      .describe(
        "Type: 'component' for UI components/blocks/charts, 'doc' for documentation"
      ),
    packageManager: z
      .enum(["npm", "yarn", "pnpm", "bun"]) // optional package manager override for generated snippets
      .optional()
      .describe(
        "Preferred package manager to use when rendering installation commands"
      ),
  }),
  execute: async ({ context }): Promise<string> => {
    const { name, type } = context;

    try {
      if (type === "component") {
        // Check if this is a block/chart (uses different API)
        if (isBlock(name)) {
          console.log(
            `[Tool] Detected block/chart pattern for "${name}", using /api/block/ endpoint`
          );
          const blockResult = await fetchBlockCode(name, context.packageManager);

          if (!blockResult.success) {
            const response: ToolResponse = {
              success: false,
              error: `Block/Chart "${name}" not found: ${blockResult.error}`,
              notes: ["Use the list tool to see available blocks and charts."],
            };
            return JSON.stringify(response, null, 2);
          }

          // Extract code blocks from the markdown-formatted code
          const codeBlocks: Array<{
            language?: string;
            code: string;
            title?: string;
          }> = [];
          const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
          let match;
          while (
            (match = codeBlockRegex.exec(blockResult.code || "")) !== null
          ) {
            codeBlocks.push({
              language: match[1] || undefined,
              code: match[2].trim(),
            });
          }

          const response: ToolResponse = {
            success: true,
            content: blockResult.code,
            metadata: {
              title: name,
              description: `Block/Chart component for shadcn-svelte`,
              url: `https://shadcn-svelte.com/blocks/${name}`,
            },
            warnings: [
              "This is a SVELTE block/chart. Do NOT use React-specific props or patterns (like 'asChild', 'React.ReactNode', etc.).",
              "Always follow the Svelte examples shown in the code blocks.",
            ],
            type: name.startsWith("chart-") ? "chart" : "block",
            codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined,
          };
          return JSON.stringify(response, null, 2);
        }

        // Regular component - fetch from component docs
        const result = await fetchComponentDocs(name, { useCache: true });

        if (!result.success || !result.content) {
          const response: ToolResponse = {
            success: false,
            error: result.error || `Component "${name}" not found`,
            notes: ["Use the list tool to see available components."],
          };
          return JSON.stringify(response, null, 2);
        }

        // If a packageManager was provided, replace common installer patterns in result.content
        let content = result.content;
        // Always replace examples in the content with the selected package manager prefix
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
            /(?:npx|yarn dlx|pnpm dlx|bunx|bun x)\s+shadcn-svelte@latest\s+add/gi,
            `${prefix} shadcn-svelte@latest add`
          );
        }

        const response: ToolResponse = {
          success: true,
          content: content || result.content,
          metadata: result.metadata || {
            title: `${name} Component`,
            url: `https://shadcn-svelte.com/docs/components/${name}`,
          },
          warnings: [
            "This is a SVELTE component. Do NOT use React-specific props or patterns (like 'asChild', 'React.ReactNode', etc.).",
            "Always follow the Svelte examples shown in the documentation.",
          ],
          type: "component",
          codeBlocks: result.codeBlocks,
        };
        return JSON.stringify(response, null, 2);
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

        if (!result || !result.success || !result.content) {
          const response: ToolResponse = {
            success: false,
            error: result?.error || `Documentation "${name}" not found`,
            notes: [
              "Use the list tool to see available documentation sections.",
            ],
          };
          return JSON.stringify(response, null, 2);
        }

        const response: ToolResponse = {
          success: true,
          content: result.content,
          metadata: result.metadata || {
            title: name,
          },
          notes: result.notes,
          warnings: result.warnings,
          type: result.type || "doc",
          codeBlocks: result.codeBlocks,
        };
        return JSON.stringify(response, null, 2);
      }

      const response: ToolResponse = {
        success: false,
        error: `Invalid type "${type}". Use "component" or "doc".`,
      };
      return JSON.stringify(response, null, 2);
    } catch (error) {
      const response: ToolResponse = {
        success: false,
        error: `Error retrieving ${type} "${name}": ${error}`,
      };
      return JSON.stringify(response, null, 2);
    }
  },
});
