import { MCPServer } from "@mastra/mcp";
import { shadcnSvelteListTool } from "./tools/shadcn-svelte-list";
import { shadcnSvelteGetTool } from "./tools/shadcn-svelte-get";
import { shadcnSvelteUtilityTool } from "./tools/shadcn-svelte-utility";
import { shadcnSvelteSearchTool } from "./tools/shadcn-svelte-search";

export const shadcn = new MCPServer({
  name: "Shadcn Svelte Docs",
  version: "1.0.15",
  description:
    "Access shadcn-svelte component documentation and guides. IMPORTANT: This is for SVELTE components only, NOT React. Do not confuse with shadcn/ui (React version).",
  tools: {
    shadcnSvelteListTool,
    shadcnSvelteGetTool,
    shadcnSvelteUtilityTool,
    shadcnSvelteSearchTool,
  },
});
