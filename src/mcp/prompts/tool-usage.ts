import { definePrompt } from "tmcp/prompt";
import * as v from "valibot";

/**
 * Prompt: Which shadcn-svelte MCP tool to use, and when.
 *
 * Centralizes the cross-tool routing guidance so individual tool
 * descriptions can stay short (they are always in context, while this
 * prompt is only fetched on demand via prompts/get).
 */
export const toolUsagePrompt = definePrompt(
  {
    name: "tool-usage",
    title: "Tool Usage Guide",
    description:
      "Which shadcn-svelte MCP tool to use for a given task, including the get -> bits-ui-get chaining flow",
    schema: v.object({}),
  },
  async () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Explain how to choose between the shadcn-svelte MCP tools and the order in which they should be used.",
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: `Here is the complete tool-routing guide for this MCP server.

## Tool hierarchy

1. **shadcn-svelte-get** — PRIMARY. Use FIRST for any shadcn-svelte question:
   components (UI primitives), blocks (pre-built sections like dashboards/sidebars),
   charts, documentation sections, or Svelte Sonner. Returns structured JSON with
   content, metadata, code blocks, install commands, and warnings.
2. **shadcn-svelte-search** — Fuzzy discovery by keyword or phrase. Use when you are
   not sure of the exact name, or to find components to install. Typo-tolerant,
   returns links, install commands, and similarity scores, plus suggestions when
   nothing matches.
3. **shadcn-svelte-list** — Enumerate available resources: components, blocks,
   charts, docs, or Bits UI primitives discovered from the live websites.
4. **shadcn-svelte-icons** — ONLY for Lucide icons used with lucide-svelte.
   Never use it for component information. Accepts comma- or space-separated
   icon names (e.g. 'truck, package') or tag searches. Returns only real icons.
5. **bits-ui-get** — SECONDARY. Bits UI primitive internals ONLY. Use it ONLY after
   shadcn-svelte-get returns \`docs.bitsuiName\` or \`tooling.bitsUi.exactName\`, and
   ONLY when you need the underlying headless primitive API rather than the standard
   shadcn-svelte wrapper. Accepts canonical Bits UI names, PascalCase names,
   component URLs, or some shadcn component names.

## Chaining flow (most common pattern)

1. Call **shadcn-svelte-get** with the shadcn-svelte component name.
2. If the response includes \`tooling.bitsUi.exactName\` (or \`docs.bitsuiName\`),
   that exact value is what you may pass to **bits-ui-get** — and only if you need
   lower-level primitive behavior.
3. For standard app code, always use the shadcn-svelte wrapper returned by
   **shadcn-svelte-get**; do not reach for bits-ui-get.

## Hard rules

- This server is for **SVELTE only**. Never use React-specific props like
  \`asChild\` or React patterns.
- shadcn-svelte component names can differ from Bits UI primitive names — always
  resolve through shadcn-svelte-get before using bits-ui-get.
- When a tool reports "not found", fall back to shadcn-svelte-list to see what
  actually exists, then retry with the correct name.`,
        },
      },
    ],
  }),
);
