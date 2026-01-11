/**
 * Utility functions for shadcn-svelte MCP tools
 */

// Block/Chart detection patterns
export const BLOCK_PATTERNS = [
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
export function isBlock(name: string): boolean {
  return BLOCK_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Gets the installation prefix based on the package manager
 */
export function getInstallPrefix(pm?: string): string {
  if (!pm) return "npx";
  if (pm === "npm") return "npx";
  if (pm === "yarn") return "yarn dlx";
  if (pm === "pnpm") return "pnpm dlx";
  if (pm === "bun") return "bun x";
  return "npx";
}

/**
 * Fetches block/chart code from the /api/block/ endpoint
 */
export async function fetchBlockCode(
  name: string,
  packageManager?: "npm" | "yarn" | "pnpm" | "bun"
): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const url = `https://shadcn-svelte.com/api/block/${name}`;
    console.log(`[Fetcher] Fetching block from: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "shadcn-svelte-mcp/1.0.0 (Block Fetcher; +https://github.com/Michael-Obele/shadcn-svelte-mcp)",
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
 * Extracts structured examples from component documentation
 */
export function extractExamples(content: string): Array<{
  title: string;
  description?: string;
  code: string;
  language?: string;
}> {
  const examples: Array<{
    title: string;
    description?: string;
    code: string;
    language?: string;
  }> = [];

  // Look for example sections (### Example Name, ### Size, ### Variant, etc.)
  const exampleSections = content.split(/^###\s+(.+)$/gm);

  for (let i = 1; i < exampleSections.length; i += 2) {
    const title = exampleSections[i].trim();
    const sectionContent = exampleSections[i + 1] || "";

    // Skip certain sections that aren't examples
    if (
      title.toLowerCase().includes("installation") ||
      title.toLowerCase().includes("changelog") ||
      title.toLowerCase().includes("link") ||
      title.toLowerCase().includes("usage")
    ) {
      continue;
    }

    // Extract code blocks from this section
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const codes: Array<{ lang?: string; code: string }> = [];
    let match;
    while ((match = codeBlockRegex.exec(sectionContent)) !== null) {
      codes.push({
        lang: match[1],
        code: match[2].trim(),
      });
    }

    if (codes.length > 0) {
      // Create separate entries for multiple code blocks in same section if they seem different
      // or combine if they are small. For simplicity, we create one example per title.
      examples.push({
        title,
        code: codes.map((c) => c.code).join("\n\n"),
        language: codes[0].lang || "svelte",
      });
    }
  }

  return examples;
}

/**
 * Extracts component variants from documentation
 */
export function extractVariants(content: string): Array<{
  name: string;
  description?: string;
}> {
  const variants: Array<{
    name: string;
    description?: string;
  }> = [];

  // Look for variant mentions in the content
  // We look for patterns like variant="default" or variant='outline'
  const variantPatterns = [
    /variant=["']([^"']+)["']/g,
    /variant=\{["']([^"']+)["']\}/g,
  ];

  const foundVariants = new Set<string>();

  for (const pattern of variantPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Filter out values that are likely variables or logic
      if (
        !match[1].includes("$") &&
        !match[1].includes("(") &&
        match[1].length < 30
      ) {
        foundVariants.add(match[1]);
      }
    }
  }

  // Also look for specific markdown headers in variant sections
  // This helps when variants are listed as "### Secondary" etc.
  // We only do this for known variant names to avoid false positives
  const commonVariantNames = [
    "default",
    "secondary",
    "destructive",
    "outline",
    "ghost",
    "link",
    "success",
    "warning",
    "info",
  ];

  for (const name of commonVariantNames) {
    if (content.match(new RegExp(`###\\s+${name}`, "i"))) {
      foundVariants.add(name);
    }
  }

  for (const variant of foundVariants) {
    variants.push({
      name: variant,
      description: getVariantDescription(variant),
    });
  }

  return variants;
}

/**
 * Gets description for common variants
 */
function getVariantDescription(variant: string): string {
  const descriptions: Record<string, string> = {
    default: "Primary style with default background",
    secondary: "Secondary style with muted background",
    destructive: "Destructive action style, typically red",
    outline: "Outlined style with transparent background and border",
    ghost: "Minimal style with no background or border",
    link: "Styled as a text link",
    success: "Indicates a successful action, typically green",
    warning: "Indicates a warning, typically orange/yellow",
    info: "Indicates informational content, typically blue",
  };
  return descriptions[variant] || `Variant: ${variant}`;
}

/**
 * Extracts a high-level summary from the documentation content
 */
export function extractSummary(content: string): string | undefined {
  if (!content) return undefined;

  // Try to get the first paragraph after the title
  // Strip markdown title first
  const plainContent = content.replace(/^#\s+.+$/m, "").trim();
  const firstParagraph = plainContent.split("\n\n")[0].trim();

  if (
    firstParagraph &&
    firstParagraph.length > 10 &&
    firstParagraph.length < 500
  ) {
    // Remove markdown links and formatting for a cleaner summary
    return firstParagraph
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();
  }

  return undefined;
}

/**
 * Parses Bits UI API documentation for structured data from content
 */
export function parseBitsUiApi(content: string): {
  properties?: Array<{
    name: string;
    type: string;
    description: string;
    default?: string;
    required?: boolean;
  }>;
  dataAttributes?: Array<{
    name: string;
    value: string;
    description: string;
  }>;
  raw?: string;
} | null {
  if (!content) return null;

  // Search for API Reference section
  // It can be ## API Reference, # API Reference, or even just text if headers are stripped
  // We want to capture everything from "API Reference" until the end of the content
  // or until a footer navigation section (like [Previous ...][Next ...])
  const patterns = [
    /(?:##|#|\\#+)\s*API Reference([\s\S]*?)(?=\[Previous|$)/i,
    /API Reference([\s\S]*?)(?=\[Previous|$)/i,
  ];

  let apiText = "";
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1] && match[1].trim().length > 20) {
      apiText = match[1].trim();
      break;
    }
  }

  if (apiText) {
    return {
      raw: apiText,
    };
  }

  return null;
}

/**
 * Fetches and parses Bits UI API documentation for structured data (DEPRECATED: parse content directly)
 */
export async function fetchBitsUiApi(bitsUiLlmUrl?: string): Promise<{
  properties?: Array<{
    name: string;
    type: string;
    description: string;
    default?: string;
    required?: boolean;
  }>;
  dataAttributes?: Array<{
    name: string;
    value: string;
    description: string;
  }>;
  raw?: string;
} | null> {
  if (!bitsUiLlmUrl) return null;

  try {
    const response = await fetch(bitsUiLlmUrl);
    if (!response.ok) return null;
    const content = await response.text();
    return parseBitsUiApi(content);
  } catch (error) {
    return null;
  }
}

/**
 * Gets installation command details including package manager variants and CLI options
 */
export function getInstallCommand(
  name: string,
  pm?: string,
  automated: boolean = true
): {
  packageManagers: {
    npm: string;
    yarn: string;
    pnpm: string;
    bun: string;
  };
  cliOptions: Record<string, string>;
} {
  const baseCommand = `shadcn-svelte@latest add ${name}`;

  return {
    packageManagers: {
      npm: `npx ${baseCommand}`,
      yarn: `npx ${baseCommand}`, // yarn uses npx
      pnpm: `pnpm dlx ${baseCommand}`,
      bun: `bun x ${baseCommand}`,
    },
    cliOptions: {
      "command-structure": "Use: [package-manager-command] [options] [components...]",
      "-y, --yes": "Skip confirmation prompt (default: false)",
      "-o, --overwrite": "Overwrite existing files (default: false)",
      "-a, --all": "Install all components to your project (default: false)",
      "--no-deps": "Skip adding & installing package dependencies",
      "--skip-preflight": "Ignore preflight checks and continue (default: false)",
      "-c, --cwd <path>": "The working directory (default: current directory)",
      "--proxy <proxy>": "Fetch components from registry using a proxy",
      "-h, --help": "Display help for command",
    },
  };
}

/**
 * Generates an import path for a component
 */
export function getImportPath(name: string): string {
  // Common pattern for shadcn-svelte components
  // Some might be in different subdirs, but this is the primary one
  const capitalized = name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  return `import { ${capitalized} } from "$lib/components/ui/${name}/index.js";`;
}

/**
 * Strips navigation artifacts and "on this page" lists from documentation
 */
export function sanitizeContent(content: string): string {
  if (!content) return content;

  let cleaned = content;

  // Bits UI and Shadcn docs often have a long sidebar/nav before the content
  // Most real content starts with a H1 title (# Title or \# Title)
  // We find the first occurrence and skip everything before it
  const h1Match = cleaned.match(/^(?:#|\\#)\s+[A-Z]/m);
  if (h1Match && h1Match.index !== undefined) {
    cleaned = cleaned.substring(h1Match.index);
  }

  return (
    cleaned
      // Remove Installation sections (## Installation ... code block)
      .replace(/(?:##|\\#+)\s+Installation[\s\S]*?(?=(?:##|\\#+)|$)/gi, "")
      // Remove stray CLI commands in code blocks
      .replace(/```bash\s+npx shadcn-svelte@latest add.*?```/gi, "")
      // Remove "On This Page" lists
      .replace(/(?:##|\\#+)\s+On This Page[\s\S]*?(?=(?:##|\\#+)|$)/gi, "")
      // Remove headers with navigation links
      .replace(/\[Previous\]\([^\)]+\)\s+\[Next\]\([^\)]+\)/g, "")
      // Remove footer links
      .replace(
        /\[Docs\]\([^\)]+\)\s+\[API Reference\]\([^\)]+\)\s+Component Source/g,
        ""
      )
      // Remove common sidebar artifacts (long lists of links)
      .replace(/^(\* \[.+\]\(.+\)\n){3,}/gm, "")
      // Remove "Copy Page" buttons
      .replace(/Copy Page/g, "")
      // Remove multiple newlines
      .replace(/\n{3,}/g, "\n\n")
      // Remove Bits UI specific noise
      .replace(/Copy Page/g, "")
      .trim()
  );
}

/**
 * Extracts the first code block from a markdown string (usually the primary usage example).
 */
export function getFirstCodeBlock(content: string): string | undefined {
  if (!content) return undefined;
  const match = content.match(
    /```(?:svelte|typescript|javascript|bash|json)?\n([\s\S]*?)\n```/
  );
  return match ? match[1].trim() : undefined;
}

// CLI commands information for AI automation
export const CLI_COMMANDS = {
  add: {
    description:
      "Add components and dependencies to your project. Use -y flag for automated, non-interactive installation.",
    usage: [
      "npx shadcn-svelte@latest add <component>",
      "pnpm dlx shadcn-svelte@latest add <component>",
      "yarn dlx shadcn-svelte@latest add <component>",
      "bun x shadcn-svelte@latest add <component>",
    ],
    options: [
      {
        flag: "--no-deps",
        description: "skips adding & installing package dependencies",
      },
      {
        flag: "--skip-preflight",
        description: "ignore preflight checks and continue (default: false)",
      },
      {
        flag: "-y, --yes",
        description:
          "skip confirmation prompt - USE THIS FOR AUTOMATION (default: false)",
      },
      {
        flag: "-o, --overwrite",
        description: "overwrite existing files (default: false)",
      },
      {
        flag: "-a, --all",
        description: "install all components to your project (default: false)",
      },
    ],
  },
};
