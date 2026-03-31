# MCP Workflow

Use the MCP to ground every component, block, chart, icon, and low-level API choice.

## Tool Order

1. Use `shadcn-svelte-search` when the user describes what they want but not the exact component name.
2. Use `shadcn-svelte-list` when you need a broader inventory of available components, blocks, charts, docs, or Bits UI primitives.
3. Use `shadcn-svelte-get` as the source of truth before you write install commands, component code, theming guidance, or file structure.
4. Use `bits-ui-get` only after `shadcn-svelte-get` when you need lower-level API details for the underlying primitive.
  - Pass the exact value from `tooling.bitsUi.exactName` or `docs.bitsuiName`.
  - Do not use `bits-ui-get` for normal shadcn-svelte wrapper usage, installation, or page composition.
5. Use `shadcn-svelte-icons` only for Lucide icon discovery and import examples.

## CLI-First Component Rule

- If a component exists in shadcn-svelte, add it with the official CLI instead of hand-writing the vendor component source.
- Prefer getting the exact CLI command from the MCP first. Use official web docs only as a fallback.
- The official CLI docs live at `https://www.shadcn-svelte.com/docs/cli`.
- The documented command shapes are:
  - `bunx shadcn-svelte@latest init`
  - `bunx shadcn-svelte@latest add [component]`
- Adapt the launcher to the user's package manager only after verifying the docs or using MCP output that already rendered the install command.
- If the task requires modifying the project and tool execution is available, run the verified CLI command yourself rather than pushing that step onto the user.
- Writing wrappers and page-level composition around installed components is good. Recreating upstream library files from scratch is not.

## Anti-Hallucination Rules

- If the MCP cannot find a component, say that directly.
- Suggest the closest verified alternative rather than inventing a component name.
- Never answer CLI questions from memory. Fetch the relevant docs first.
- When a user asks how to install a component or use the CLI, verify with `shadcn-svelte-get` using the appropriate docs target before giving a command.
- If the MCP confirms the component exists, prefer running the CLI `add` flow rather than drafting the component internals manually.
- If the MCP is unavailable and you must research online, verify that the source is official shadcn-svelte documentation before using the command.

## Installation Guidance

- Prefer the documented install snippets returned by the MCP.
- If the user has a preferred package manager, use the `packageManager` option so the returned snippet matches their environment.
- Do not rewrite CLI syntax from memory.
- If the project is not initialized yet, run or guide the `init` flow before `add`, depending on whether command execution is available in the environment.

## Component Selection Heuristics

- Blocks are best for large, opinionated sections such as dashboards, sidebars, or auth screens.
- Components are best for reusable primitives or controlled composition.
- Charts should be verified as charts, not guessed from generic component names.
- Bits UI is for lower-level behavior or API depth, not your first stop for page composition.
- If a shadcn component maps to a different Bits UI primitive name, keep using the shadcn wrapper in app code unless the user explicitly asks for the primitive internals.
- Use installed shadcn-svelte primitives as the foundation, then customize them with layout, variants, Tailwind classes, tokens, and scoped CSS only where the design requires it.

## Reporting Back To The User

When helpful, briefly tell the user what was verified. Good examples:

- "I verified `button`, `card`, and `dialog` in the MCP before composing this flow."
- "The MCP did not surface a native date range picker, so I used verified alternatives instead."

This keeps the work grounded and makes the reasoning auditable.
