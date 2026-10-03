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
  /** Raw registry payload, so callers can read real deps/exports/variants. */
  item?: RegistryItem;
}

interface RegistryFile {
  target?: string;
  path?: string;
  type?: string;
  content?: string;
  highlightedContent?: string;
}

export interface RegistryItem {
  name?: string;
  description?: string;
  type?: string;
  registryDependencies?: string[];
  dependencies?: string[];
  devDependencies?: string[];
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
      item: block.data,
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
    item: raw.data,
  };
}

/**
 * Raw registry payload only, without rendering markdown.
 *
 * The registry is the authoritative record of what a component actually
 * installs (packages, exported names, variant axes). Deriving those from the
 * slug or from prose in the docs produces confidently wrong answers, so
 * structured tool fields are read from here instead.
 */
export async function fetchRegistryItemData(
  name: string,
): Promise<RegistryItem | undefined> {
  const raw = await fetchRegistryData(
    `https://shadcn-svelte.com/registry/${name}.json`,
  );
  return raw.data;
}

/** Strips a version range, keeping scoped packages intact (`@lucide/svelte@^1` -> `@lucide/svelte`). */
function packageName(spec: string): string {
  return spec.trim().replace(/@[^@/]*$/, "");
}

/**
 * The package a module specifier belongs to, or undefined when it is not one.
 *
 * A specifier is only a package when it is neither relative (`./x`) nor a
 * path alias (`$lib/x`, `$UTILS$.js`). Subpaths collapse to their package so
 * `@lucide/svelte/icons/check` counts as `@lucide/svelte`.
 */
function packageOfSpecifier(specifier: string): string | undefined {
  const spec = specifier.trim();
  if (!spec || spec.startsWith(".") || spec.startsWith("/")) return undefined;
  if (spec.startsWith("$")) return undefined;
  const segments = spec.split("/");
  const name = spec.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : segments[0];
  return name && name !== "@" ? name : undefined;
}

/** Every package imported by an item's own source files. */
function importedPackages(item: RegistryItem): Set<string> {
  const packages = new Set<string>();
  for (const file of item.files ?? []) {
    if (typeof file.content !== "string") continue;
    for (const match of file.content.matchAll(
      /(?:from|import|require)\s*\(?\s*["']([^"']+)["']/g,
    )) {
      const name = packageOfSpecifier(match[1]);
      if (name) packages.add(name);
    }
  }
  return packages;
}

/**
 * Packages this item actually installs, taken from the registry.
 *
 * Both fields are considered (`dependencies` and `devDependencies`), then each
 * candidate is checked against the item's own import statements. The registry's
 * devDependency list carries copy-paste boilerplate — `bits-ui` is currently
 * declared alongside `@internationalized/date` on every primitive-based
 * component (toggle, checkbox, avatar), and nothing in those files imports it.
 * Reporting it verbatim told an agent to add a date library to install a Toggle.
 *
 * The import statements are the ground truth for what the code needs, so they
 * decide. If a payload carries no readable file content there is nothing to
 * check against, and the declared list is returned unfiltered rather than
 * silently emptied.
 */
export function registryDependenciesOf(item?: RegistryItem): string[] {
  if (!item) return [];
  const specs = [
    ...(Array.isArray(item.dependencies) ? item.dependencies : []),
    ...(Array.isArray(item.devDependencies) ? item.devDependencies : []),
  ];

  const declared: string[] = [];
  const seen = new Set<string>();
  for (const spec of specs) {
    const name = packageName(String(spec));
    if (name && !seen.has(name)) {
      seen.add(name);
      declared.push(name);
    }
  }

  const imported = importedPackages(item);
  if (imported.size === 0) return declared;

  return declared.filter((name) => imported.has(name));
}

/** Value exports declared by a registry item's files (type-only exports excluded). */
export function registryExports(item?: RegistryItem): string[] {
  const names = new Set<string>();
  for (const file of item?.files ?? []) {
    if (typeof file.content !== "string") continue;
    for (const block of file.content.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const part of block[1].split(",")) {
        const segment = part
          .trim()
          .replace(/^\/\/.*$/, "")
          .trim();
        if (!segment) continue;
        // `type ButtonProps as Props` is type-only: it cannot appear in a
        // value import, so it is not part of the runtime surface.
        if (/^type\s+[A-Za-z0-9_$]/.test(segment)) continue;
        // `Root as Button` -> the exported name is what follows `as`.
        const aliased = segment.match(/\bas\s+([A-Za-z0-9_$]+)\s*$/);
        if (aliased) {
          names.add(aliased[1]);
          continue;
        }
        const plain = segment.match(/^([A-Za-z0-9_$]+)\s*$/);
        if (plain) names.add(plain[1]);
      }
    }
  }
  return [...names];
}

/**
 * The real import statement for a registry item.
 *
 * Read from the barrel file's own `export` list rather than guessed from the
 * slug — `sonner` exports `Toaster`, not `Sonner`, and `card` exports several
 * parts. Returns undefined when the barrel can't be identified, so callers
 * can fall back deliberately rather than emit a broken import.
 */
export function registryImportPath(
  item?: RegistryItem,
  fallbackName?: string,
): string | undefined {
  const barrel = (item?.files ?? []).find((file) =>
    /(^|\/)index\.(ts|js)$/.test(file.target || file.path || ""),
  );
  const barrelPath = barrel?.target || barrel?.path || "";
  const dir = barrelPath
    .replace(/(^|\/)index\.(ts|js)$/, "")
    .replace(/\/$/, "");
  if (!dir) return undefined;

  const exported = registryExports(item);
  if (exported.length === 0) return undefined;

  // Prefer an export named after the component; otherwise use the whole
  // public surface (namespaces like `import * as Card` are common).
  const componentName = pascalCase(fallbackName || item?.name || "");
  const preferred = componentName
    ? exported.filter((n) => n === componentName)
    : [];
  const names = preferred.length > 0 ? preferred : exported;

  return `import { ${names.join(", ")} } from "$lib/components/ui/${dir}/index.js";`;
}

/**
 * Blanks out string-literal values while preserving object keys, quotes and
 * newlines.
 *
 * Needed before scanning for keys: tailwind class values contain colons
 * (`hover:bg-accent`, `focus-visible:ring-...`) and some start on their own
 * line, so an unmasked scan reports them as variant keys. Quoted *keys*
 * (`"icon-sm":`) must survive, which is why a string is only blanked when it
 * is not followed by `:`.
 */
function maskStrings(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch !== '"' && ch !== "'" && ch !== "`") {
      out += ch;
      i++;
      continue;
    }

    const quote = ch;
    let j = i + 1;
    let closeAt = -1;
    while (j < source.length) {
      const inner = source[j];
      if (inner === "\\") {
        j += 2;
        continue;
      }
      if (inner === quote) {
        closeAt = j;
        j++;
        break;
      }
      j++;
    }
    if (closeAt < 0) {
      out += source.slice(i);
      break;
    }

    const content = source.slice(i + 1, closeAt);
    let after = j;
    while (after < source.length && /\s/.test(source[after])) after++;
    const isKey = source[after] === ":";
    // Blank values but keep the length, so offsets stay comparable.
    const blanked = content.replace(/[^\n]/g, " ");
    out += quote + (isKey ? content : blanked) + quote;
    i = j;
  }
  return out;
}

/** Contents of the `{...}` block whose opening brace is at `open`. */
function blockAt(source: string, open: number): string | undefined {
  if (source[open] !== "{") return undefined;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return undefined;
}

/**
 * Variant axes declared by a component's own source.
 *
 * Parses the `tv({...})` / `cva({...})` config that shadcn-svelte components
 * ship, which is the authoritative list of accepted prop values. Docs prose is
 * deliberately not used as a fallback source here: it drifts from the
 * installed code (the button docs advertise `xs`/`icon-xs`, which the registry
 * does not define) and it leaks other components' attributes (sonner's page
 * shows `<Button variant="outline">`, which is not a Sonner variant).
 */
export function extractVariantAxes(item?: RegistryItem): {
  variants?: string[];
  sizes?: string[];
} {
  const source = (item?.files ?? [])
    .map((file) => (typeof file.content === "string" ? file.content : ""))
    .join("\n");

  const variantsAt = source.search(/\bvariants\s*:\s*\{/);
  if (variantsAt < 0) return {};
  const variantsBody = blockAt(source, source.indexOf("{", variantsAt));
  if (!variantsBody) return {};

  const axes: Record<string, string[]> = {};
  const axisPattern = /(\w+)\s*:\s*\{/g;
  let axis: RegExpExecArray | null;
  while ((axis = axisPattern.exec(variantsBody)) !== null) {
    const body = blockAt(variantsBody, axis.index + axis[0].length - 1);
    if (!body) continue;
    const keys = new Set<string>();
    const masked = maskStrings(body);
    for (const key of masked.matchAll(/(?:^|\n)\s*"?([A-Za-z][\w-]*)"?\s*:/g)) {
      keys.add(key[1]);
    }
    if (keys.size > 0) axes[axis[1]] = [...keys];
  }

  const result: { variants?: string[]; sizes?: string[] } = {};
  if (axes.variant?.length) result.variants = axes.variant;
  if (axes.size?.length) result.sizes = axes.size;
  return result;
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

  // Split on any doc heading level. Previously this matched only `###`, which
  // on the current site meant the run split on the sponsor `### [Epicenter]`
  // heading and swallowed the entire page into a single "example".
  const exampleSections = content.split(DOC_HEADING);

  for (let i = 1; i < exampleSections.length; i += 2) {
    const title = cleanHeading(exampleSections[i]);
    const sectionContent = exampleSections[i + 1] || "";

    // Skip guidance sections rather than examples.
    if (NON_EXAMPLE_SECTIONS.has(title.toLowerCase())) {
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
 * Docs headings are emitted at level 2-4 and carry a link label, e.g.
 * `## [Default](#default)`. Matching only `###` silently found nothing on the
 * current site and made both example and variant extraction fall back to
 * whole-document scraping.
 */
const DOC_HEADING = /^#{2,4}\s+(.+)$/m;

/** `## [Default](#default)` -> `Default`; strips emphasis and list markers. */
function cleanHeading(raw: string): string {
  return raw
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[-*\d.\s]+/, "")
    .replace(/[*_`]/g, "")
    .trim();
}

/** Section titles that are guidance rather than a runnable example. */
const NON_EXAMPLE_SECTIONS = new Set([
  "installation",
  "usage",
  "changelog",
  "api reference",
  "examples",
  "about",
  "cursor",
  "resources",
  "contributing",
  "dark mode",
  "installation notes",
]);

/** All cleaned doc headings in the page. */
function docHeadings(content: string): string[] {
  return [...content.matchAll(new RegExp(DOC_HEADING.source, "gm"))].map((m) =>
    cleanHeading(m[1]),
  );
}

/**
 * Values a prop takes on the component's own tag, e.g. `<Button variant="ghost">`.
 *
 * Scoping to the tag matters: component pages routinely demo sibling
 * components, and an unscoped `variant="..."` scan reports Button's variants
 * as Sonner's.
 */
function ownPropValues(
  content: string,
  tag: string | undefined,
  prop: string,
): string[] {
  if (!tag) return [];
  const values = new Set<string>();
  const pattern = new RegExp(
    `<${tag}\\b[^>]*?\\b${prop}=["']([^"']+)["']`,
    "g",
  );
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const value = match[1];
    if (
      value &&
      !value.includes("$") &&
      !value.includes("(") &&
      value.length < 30
    ) {
      values.add(value);
    }
  }
  return [...values];
}

/**
 * Extracts component variants from documentation.
 *
 * Docs-derived fallback only — prefer `extractVariantAxes`, which reads the
 * registry source and is authoritative. Used when a component has no registry
 * entry, or to supplement it with values the docs demonstrate.
 */
export function extractVariants(
  content: string,
  componentName?: string,
): Array<{
  name: string;
  description?: string;
}> {
  const found = new Set<string>();
  const tag = componentName ? pascalCase(componentName) : undefined;

  // Section headings such as `## [Default](#default)` name the variants, and
  // document order is the order an agent should expect to read them in.
  const headings = docHeadings(content).map((h) => h.toLowerCase());
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
  const headingSet = new Set(headings);
  for (const name of commonVariantNames) {
    if (headingSet.has(name)) found.add(name);
  }

  // Then anything the examples demonstrate on the component's own tag.
  for (const value of ownPropValues(content, tag, "variant")) {
    found.add(value);
  }

  return [...found].map((variant) => ({
    name: variant,
    description: getVariantDescription(variant),
  }));
}

/** Values the `size` prop takes on the component's own tag. */
export function extractSizes(
  content: string,
  componentName?: string,
): string[] {
  const tag = componentName ? pascalCase(componentName) : undefined;
  return ownPropValues(content, tag, "size");
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
 * Removes the API Reference section from a docs page.
 *
 * `parseBitsUiApi` already lifts that section into `api.raw`, so leaving it in
 * the body means every response ships it twice — measured at 40-70% of the body
 * on Bits UI pages, which are already the largest responses this server
 * produces. Removing it makes the two fields disjoint: `api.raw` is the
 * reference, `rawContent` is everything around it.
 *
 * Returns the content unchanged when there is no API Reference section, or when
 * stripping would consume all of it (a body that is only a reference table
 * carries no information the caller would not still have).
 */
export function stripApiReference(content: string): string {
  if (!content) return content;

  const marker = /(?:^|\n)(?:##|#|\\#+)\s*API Reference/i;
  const match = content.match(marker);
  if (!match || match.index === undefined) return content;

  const start = match.index + (match[0].startsWith("\n") ? 1 : 0);
  const before = content.slice(0, start).trim();
  const after = content
    .slice(start)
    .replace(/^(?:##|#|\\#+)\s*API Reference[\s\S]*?(?=\[Previous\s|$)/i, "")
    .trim();

  const remainder = [before, after].filter(Boolean).join("\n\n");
  return remainder.length > 40 ? remainder : content;
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
