/**
 * Shared utilities for shadcn-svelte MCP tools: naming, install commands,
 * URL builders, markdown rendering, registry fetching, and doc parsing.
 */

import { fetchJson } from "../../../services/http.js";

/** Supported package managers for install commands. */
export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

/** Detects if a component name is a block/chart (registry-sourced item). */
export function isBlock(name: string): boolean {
  return /^(chart|dashboard|sidebar|demo|new-components|login|signup|otp|calendar)-/i.test(
    name,
  );
}

/** CLI prefix for one-off commands: npx / yarn dlx / pnpm dlx / bun x. */
function getInstallPrefix(pm?: string): string {
  if (!pm) return "npx";
  if (pm === "npm") return "npx";
  if (pm === "yarn") return "yarn dlx";
  if (pm === "pnpm") return "pnpm dlx";
  if (pm === "bun") return "bun x";
  return "npx";
}

/* ------------------------------------------------------------------ */
/* Shared kernel: naming, install lines, envelopes, registry fetching  */
/* ------------------------------------------------------------------ */

const SHADCN_WWW = "https://www.shadcn-svelte.com";
const BITS_WWW = "https://bits-ui.com";

/** Canonical kebab-case normalization shared by all tools. */
export function normalizeName(input: string): string {
  return input
    .trim()
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** Extracts a Bits UI primitive name from a docs URL. */
export function extractBitsUiName(input?: string): string | undefined {
  if (!input) return undefined;
  try {
    const parts = new URL(input.trim()).pathname.split("/").filter(Boolean);
    if (parts.length >= 3 && parts[0] === "docs" && parts[1] === "components") {
      return parts[2].toLowerCase();
    }
  } catch {
    // Not a URL — nothing to extract.
  }
  return undefined;
}

const capitalize = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1);

/** Title Case: "chart-area-default" -> "Chart Area Default". */
export function titleCase(name: string): string {
  return name.split("-").map(capitalize).join(" ");
}

/** PascalCase for icon imports: "message-circle" -> "MessageCircle". */
export function pascalCase(name: string): string {
  return name.split("-").map(capitalize).join("");
}

/** JSON envelope — one call site instead of repeated stringify. */
export function toJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

/** npm client binary for a package manager choice. */
function npmClient(pm?: string): string {
  if (pm === "yarn") return "yarn";
  if (pm === "pnpm") return "pnpm";
  if (pm === "bun") return "bun";
  return "npm";
}

/** `install` (npm) vs `add` (everyone else). */
function addVerb(pm?: string): string {
  return pm === "npm" ? "install" : "add";
}

/** Single-line shadcn-svelte CLI install command for markdown output. */
export function buildInstallLine(name: string, pm?: PackageManager): string {
  return `${getInstallPrefix(pm)} shadcn-svelte@latest add ${name}`;
}

/** Single-line package install command: `bun add @lucide/svelte`. */
export function packageInstallLine(pkg: string, pm?: PackageManager): string {
  return `${npmClient(pm)} ${addVerb(pm)} ${pkg}`;
}

export function shadcnComponentUrl(name: string): string {
  return `${SHADCN_WWW}/docs/components/${name}`;
}

export function registryBlockUrl(name: string): string {
  return `https://shadcn-svelte.com/blocks/${name}`;
}

export function bitsUiComponentUrl(name: string): string {
  return `${BITS_WWW}/docs/components/${name}`;
}

/** Anchor link into a listing page: `.../blocks#login-01`. */
export function sectionAnchorUrl(section: string, name: string): string {
  return `${SHADCN_WWW}/${section}#${name}`;
}

/** Docs page URL; category refines the root (installation, darkMode, migration). */
export function shadcnDocUrl(name: string, category?: string): string {
  if (category === "installation")
    return `${SHADCN_WWW}/docs/installation/${name}`;
  if (category === "darkMode") return `${SHADCN_WWW}/docs/dark-mode/${name}`;
  if (category === "migration") return `${SHADCN_WWW}/docs/migration/${name}`;
  return `${SHADCN_WWW}/docs/${name}`;
}

/** Shared guidance: discover via list/get before reaching for bits-ui-get. */
export const DISCOVER_STEPS = [
  "1. Use the shadcn-svelte-list tool to see all available components, blocks, and charts",
  "2. Check the correct spelling - component names are case-sensitive",
  "3. Visit https://shadcn-svelte.com to browse available components",
  "4. Only use bits-ui-get after shadcn-svelte-get exposes docs.bitsuiName for an underlying primitive",
];

export const BITS_UI_STEPS = [
  "1. Use shadcn-svelte-get with the shadcn-svelte component name you actually plan to use",
  "2. If that response includes docs.bitsuiName, pass that exact value to bits-ui-get",
  "3. Do not use bits-ui-get for standard shadcn-svelte installation or wrapper usage",
  "4. Or visit https://bits-ui.com/docs/components to browse the canonical Bits UI primitive names",
];

export const SVELTE_RULES = [
  "Do NOT use React-specific props like 'asChild'.",
  "Use standard Svelte slot patterns or snippets where applicable.",
  "Always follow the Svelte examples shown in the documentation.",
];

export const BLOCK_CHART_RULES = [
  "This is a SVELTE block/chart. Do NOT use React-specific props or patterns.",
  "Note: Project should already be initialized with shadcn-svelte before adding components.",
];

/**
 * Groups registry item names by category prefix for display.
 * Charts group by second segment (chart-area-*, chart-bar-*, ...).
 * Blocks group by first segment, except known multi-word prefixes.
 */
export function groupByPrefix(
  names: string[],
  isChart: boolean,
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const name of names) {
    let category: string;
    if (isChart) {
      const parts = name.split("-");
      category = parts.length > 2 ? parts[1] : "other";
    } else if (name.startsWith("demo-sidebar")) {
      category = "demo-sidebar";
    } else if (name.startsWith("new-components")) {
      category = "new-components";
    } else {
      category = name.split("-")[0];
    }
    const list = groups.get(category) ?? [];
    list.push(name);
    groups.set(category, list);
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** Fenced code block: ` ```lang\ncode\n``` `. */
export function codeBlock(language: string, code: string): string {
  return `\`\`\`${language}\n${code}\n\`\`\``;
}

/** Bullet list of backticked names, one per line. */
export function bulletList(names: string[]): string {
  return names.map((name) => `- \`${name}\`\n`).join("");
}

/** Renders names in backtick columns for list output. */
export function renderColumns(names: string[], columns = 3): string {
  let out = "";
  for (let i = 0; i < names.length; i += columns) {
    out += `${names
      .slice(i, i + columns)
      .map((n) => `\`${n}\``)
      .join(" · ")}\n`;
  }
  return `${out}\n`;
}


/** Renders grouped registry items (`### Category` + bullets per group). */
export function renderGroupedSection(
  names: string[],
  isChart: boolean,
  headingSuffix = "",
): string {
  let out = "";
  for (const [category, items] of groupByPrefix(names, isChart)) {
    const title = category.charAt(0).toUpperCase() + category.slice(1);
    out += `### ${title}${headingSuffix}\n`;
    out += bulletList(items);
    out += "\n";
  }
  return out;
}

export const LIST_FOOTER = [
  "## Additional Resources",
  "",
  "### Themes",
  "Interactive theme generator available at `/themes`. Themes are not individual components but CSS configurations you can copy and paste.",
  "",
  "### Colors",
  "Tailwind color palette reference available at `/colors`. Shows colors in HEX, RGB, HSL, OKLCH, and CSS variable formats.",
  "",
  "### Icons",
  "Lucide Svelte icons documentation and search available via the `icons` tool. Browse 1600+ Lucide icons with search and usage examples.",
  "",
].join("\n");

export const LIST_USAGE = [
  "---",
  "",
  "**Usage:** Use the `get` tool with `name` and `type` to retrieve detailed information.",
  "",
  "**Examples:**",
  "- Get button component: `{ name: 'button', type: 'component' }`",
  "- Get chart: `{ name: 'chart-tooltip-default', type: 'component' }`",
  "- Get block: `{ name: 'dashboard-01', type: 'component' }`",
  "- Get installation docs: `{ name: 'sveltekit', type: 'doc' }`",
  "",
].join("\n");

/* ------------------------- registry fetching ------------------------- */

export interface RegistryFetchResult {
  success: boolean;
  code?: string;
  error?: string;
  registryType?: string;
}

interface RegistryFile {
  target?: string;
  path?: string;
  type?: string;
  content?: string;
  highlightedContent?: string;
}

interface RegistryItem {
  name?: string;
  description?: string;
  type?: string;
  registryDependencies?: string[];
  files?: RegistryFile[];
}

/** Detects code language from a registry file target path. */
function detectLanguage(fileName: string): string {
  if (fileName.endsWith(".svelte")) return "svelte";
  if (fileName.endsWith(".ts")) return "typescript";
  if (fileName.endsWith(".js")) return "javascript";
  if (fileName.endsWith(".css")) return "css";
  return "typescript";
}

/** Decodes Shiki-highlighted HTML back to raw source. */
function decodeHighlighted(highlighted: string): string | undefined {
  const match = highlighted.match(
    /<pre[^>]*>.*?<code[^>]*>(.*?)<\/code>.*?<\/pre>/s,
  );
  if (!match) return undefined;
  return match[1]
    .replace(/<span[^>]*>/g, "")
    .replace(/<\/span>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x3C;/g, "<")
    .replace(/&#x3E;/g, ">")
    .replace(/\\n/g, "\n");
}

/**
 * Renders a registry item to markdown: header, install command, then one
 * fenced code block per file (raw `content` or decoded `highlightedContent`).
 */
function renderRegistryMarkdown(
  item: RegistryItem,
  name: string,
  packageManager?: PackageManager,
): string {
  let out = `# ${item.name}\n\n`;
  if (item.description) out += `**Description:** ${item.description}\n\n`;
  out += `**Type:** ${item.type}\n\n`;
  if (
    Array.isArray(item.registryDependencies) &&
    item.registryDependencies.length > 0
  ) {
    out += `**Registry dependencies:** ${item.registryDependencies.join(", ")}\n\n`;
  }
  out += `**Installation:**\n${codeBlock("bash", buildInstallLine(name, packageManager))}\n\n`;

  for (const file of item.files ?? []) {
    const fileName = file.target || file.path || "unknown";
    out += `## File: ${fileName}\n\n**Type:** ${file.type}\n\n`;
    const source =
      !file.highlightedContent &&
      typeof file.content === "string" &&
      file.content.length > 0
        ? file.content
        : file.highlightedContent
          ? decodeHighlighted(file.highlightedContent)
          : undefined;
    if (source !== undefined) {
      out += `${codeBlock(detectLanguage(fileName), source)}\n\n`;
    }
  }
  return out;
}

async function fetchRegistryData(url: string): Promise<{
  data?: RegistryItem;
  error?: string;
}> {
  try {
    return { data: await fetchJson<RegistryItem>(url) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Fetches a registry item by name: tries /api/block first, falls back to
 * raw /registry/{name}.json. Accepts registry:block and registry:ui.
 */
export async function fetchRegistryItem(
  name: string,
  packageManager?: PackageManager,
): Promise<RegistryFetchResult> {
  console.log(`[Fetcher] Fetching registry item: ${name}`);
  const block = await fetchRegistryData(
    `https://shadcn-svelte.com/api/block/${name}`,
  );
  if (
    block.data &&
    (block.data.type === "registry:block" || block.data.type === "registry:ui")
  ) {
    return {
      success: true,
      code: renderRegistryMarkdown(block.data, name, packageManager),
      registryType: block.data.type,
    };
  }
  // /api/block 404s for some items (demo-sidebar, new-components-01,
  // registry-only UI like form) — fall back to raw registry JSON.
  const raw = await fetchRegistryData(
    `https://shadcn-svelte.com/registry/${name}.json`,
  );
  if (!raw.data) {
    return {
      success: false,
      error: raw.error || block.error || `Registry item "${name}" not found`,
    };
  }
  return {
    success: true,
    code: renderRegistryMarkdown(raw.data, name, packageManager),
    registryType: raw.data.type,
  };
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

    // One example per section; multiple code blocks are joined in order.
    const codes = extractCodeBlocks(sectionContent);
    if (codes.length > 0) {
      examples.push({
        title,
        code: codes.map((c) => c.code).join("\n\n"),
        language: codes[0].lang || "svelte",
      });
    }
  }

  return examples;
}

/** Extracts fenced code blocks (language + trimmed source) from markdown. */
function extractCodeBlocks(
  text: string,
): Array<{ lang?: string; code: string }> {
  const blocks: Array<{ lang?: string; code: string }> = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({ lang: match[1], code: match[2].trim() });
  }
  return blocks;
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
 * Gets installation command details: one line per package manager plus CLI
 * options. Derived from the single `buildInstallLine` source.
 */
export function getInstallCommand(name: string): {
  packageManagers: {
    npm: string;
    yarn: string;
    pnpm: string;
    bun: string;
  };
  cliOptions: Record<string, string>;
} {
  return {
    packageManagers: {
      npm: buildInstallLine(name, "npm"),
      yarn: buildInstallLine(name, "yarn"),
      pnpm: buildInstallLine(name, "pnpm"),
      bun: buildInstallLine(name, "bun"),
    },
    cliOptions: {
      "command-structure":
        "Use: [package-manager-command] [options] [components...]",
      "-y, --yes": "Skip confirmation prompt (default: false)",
      "-o, --overwrite": "Overwrite existing files (default: false)",
      "-a, --all": "Install all components to your project (default: false)",
      "--no-deps": "Skip adding & installing package dependencies",
      "--skip-preflight":
        "Ignore preflight checks and continue (default: false)",
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
  // Common pattern for shadcn-svelte components — primary barrel import.
  return `import { ${pascalCase(name)} } from "$lib/components/ui/${name}/index.js";`;
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
        "",
      )
      // Remove common sidebar artifacts (long lists of links)
      .replace(/^(\* \[.+\]\(.+\)\n){3,}/gm, "")
      // Remove "Copy Page" buttons
      .replace(/Copy Page/g, "")
      // Remove multiple newlines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Extracts the first code block from a markdown string (usually the primary usage example).
 */
export function getFirstCodeBlock(content: string): string | undefined {
  if (!content) return undefined;
  const match = content.match(
    /```(?:svelte|typescript|javascript|bash|json)?\n([\s\S]*?)\n```/,
  );
  return match ? match[1].trim() : undefined;
}
