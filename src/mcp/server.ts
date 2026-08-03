import { McpServer } from "tmcp";
import { ValibotJsonSchemaAdapter } from "@tmcp/adapter-valibot";
import { shadcnSvelteListTool } from "./tools/shadcn-svelte-list.js";
import { shadcnSvelteGetTool } from "./tools/shadcn-svelte-get.js";
import { shadcnSvelteIconsTool } from "./tools/shadcn-svelte-icons.js";
import { shadcnSvelteSearchTool } from "./tools/shadcn-svelte-search.js";
import { bitsUiGetTool } from "./tools/bits-ui-get.js";
import { installComponentPrompt } from "./prompts/install-component.js";
import { setupThemingPrompt } from "./prompts/setup-theming.js";
import { cliUsagePrompt } from "./prompts/cli-usage.js";
import { projectInitPrompt } from "./prompts/project-init.js";
import { toolUsagePrompt } from "./prompts/tool-usage.js";

export const serverVersion = "1.10.0";

/**
 * The shadcn-svelte MCP server.
 *
 * Registered with the Valibot adapter — all tools/prompts use `valibot` schemas
 * which are converted to JSON Schema at registration time.
 */
export const server = new McpServer(
  {
    name: "Shadcn Svelte Docs",
    version: "1.10.0",
    description:
      "Access shadcn-svelte component documentation, Bits UI API docs, and guides. IMPORTANT: This is for SVELTE components only, NOT React. Do not confuse with shadcn/ui (React version). Bits UI provides the underlying components for shadcn-svelte.",
  },
  {
    adapter: new ValibotJsonSchemaAdapter(),
    capabilities: {
      tools: { listChanged: true },
      prompts: { listChanged: true },
    },
    instructions:
      "Tool routing: shadcn-svelte-get FIRST for any shadcn-svelte query (components, blocks, charts, docs, Sonner). shadcn-svelte-search for fuzzy discovery, shadcn-svelte-list to enumerate resources, shadcn-svelte-icons ONLY for Lucide icons. bits-ui-get ONLY after shadcn-svelte-get returns docs.bitsuiName or tooling.bitsUi.exactName, and only for lower-level primitive internals. SVELTE only — never use React-specific props like 'asChild'. For the full guide, use the tool-usage prompt.",
  },
);

server.tools([
  shadcnSvelteListTool,
  shadcnSvelteGetTool,
  shadcnSvelteIconsTool,
  shadcnSvelteSearchTool,
  bitsUiGetTool,
]);

server.prompts([
  installComponentPrompt,
  setupThemingPrompt,
  cliUsagePrompt,
  projectInitPrompt,
  toolUsagePrompt,
]);
