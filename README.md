# shadcn-svelte-mcp

[![latest release](https://img.shields.io/github/v/tag/Michael-Obele/shadcn-svelte-mcp?sort=semver)](https://github.com/Michael-Obele/shadcn-svelte-mcp/releases)
[![npm version](https://img.shields.io/npm/v/shadcn-svelte-mcp)](https://www.npmjs.com/package/shadcn-svelte-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en-US/install-mcp?name=shadcn-svelte&config=eyJ0eXBlIjoiaHR0cCIsInVybCI6Imh0dHBzOi8vc2hhZGNuLnN2ZWx0ZS1hcHBzLm1lL21jcCJ9)

> [!IMPORTANT]
> **The hosted server goes down in a few days.** I pay for
> `https://shadcn.svelte-apps.me/mcp` out of pocket and I'm turning it off soon.
> **Switch to the npm package:** `npx -y shadcn-svelte-mcp`. It runs the same
> server on your machine, so the shutdown doesn't affect you.
> Want an HTTP endpoint instead? Deploy it yourself to Fly.io or Render.
> [❤️ Sponsor @Michael-Obele](https://github.com/sponsors/Michael-Obele) if you want to chip in. Thank you!

Real-time shadcn-svelte docs for AI editors, via [tmcp](https://tmcp.io). Scrapes shadcn-svelte.com and bits-ui.com live — no stale docs.

**npm (recommended):** `npx -y shadcn-svelte-mcp` · Hosted (shutting down soon): `https://shadcn.svelte-apps.me/mcp` · Local dev: `bun run src/stdio.ts`

## What you get

- Live shadcn-svelte + [Bits UI](https://bits-ui.com) docs (no stale bundles)
- 5 tools: list, get, search, icons, Bits UI API
- 5 guided prompts: install a component, set up theming, CLI usage, project init, and which tool to use when
- Intent-aware search (concept queries, categories, multi-query) with typo tolerance + install snippets per package manager
- 1,800+ Lucide icons with import snippets
- 3-day cache (memory + disk) for fast repeats
- Optional: a [design skill](#skill) and a [per-editor agent](#agent) on top of the server

## Connect (30 seconds)

**npm (recommended):** runs on your machine; this is the setup to use once the hosted server is off.

```json
{
  "mcpServers": {
    "shadcn-svelte": { "command": "npx", "args": ["-y", "shadcn-svelte-mcp"] }
  }
}
```

CLI (stdio):

```bash
claude mcp add shadcn-svelte -- npx -y shadcn-svelte-mcp
codex mcp add shadcn-svelte -- npx -y shadcn-svelte-mcp
```

Needs Node >= 20.9. Bun users: swap `npx` for `bunx`.

**Hosted (shutting down in a few days):** `https://shadcn.svelte-apps.me/mcp` still works for now, but I'm turning it off soon. If your config points here, switch to npm above.

VS Code: `MCP: Add Server` → paste the URL. Cursor / Windsurf: add an `http` server with the same URL. Zed: use `npx -y mcp-remote https://shadcn.svelte-apps.me/mcp`. Verify: `MCP: List Servers`.

```json
{
  "mcpServers": {
    "shadcn-svelte": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://shadcn.svelte-apps.me/mcp"]
    }
  }
}
```

CLIs:

```bash
claude mcp add --transport http shadcn-svelte https://shadcn.svelte-apps.me/mcp
codex mcp add shadcn-svelte --url https://shadcn.svelte-apps.me/mcp
```

<details>
<summary>Editor-specific notes</summary>

- Cursor: Settings → MCP → add a stdio server running `npx -y shadcn-svelte-mcp`.
- Windsurf: `~/.codeium/windsurf/mcp_config.json` → `mcpServers`, restart.
- Zed: Settings → Agent → add command `npx -y shadcn-svelte-mcp`.
- Gemini CLI: `~/.gemini/settings.json` → `command` / `args` with `npx -y shadcn-svelte-mcp`.

</details>

## Tools

| Tool                   | Use for                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `shadcn-svelte-get`    | Details + install snippet for a known component / block / doc (`packageManager` supported) |
| `shadcn-svelte-search` | Intent/keyword or multi-query search (`queries`, `category`) when you don't know the exact name |
| `shadcn-svelte-list`   | Full inventory of components, blocks, charts, docs                                         |
| `shadcn-svelte-icons`  | Lucide icons (`names`, `limit`, `importLimit`)                                             |
| `bits-ui-get`          | Low-level Bits UI API (props, events, data attributes)                                     |

Start with `get`, fall back to `search`, use `bits-ui-get` only for primitive internals.

Try: "Install button", "List all components", "Find date-picker-like components", "Find a dark mode theme toggle button", "Icons for settings", "Bits UI Dialog API".

## Skill

Polished SvelteKit UI skill at `skills/shadcn-sveltekit-design/SKILL.md`:

```bash
npx skills add Michael-Obele/shadcn-svelte-mcp --skill shadcn-sveltekit-design
```

The skill lands in `.agents/skills/`, which Zed, Claude Code, OpenCode, and other skills-capable tools all read.

> [!WARNING]
> **Zed users:** use the `npx skills add` command above, not Zed's built-in `agent: create skill from url`. That command imports a single `SKILL.md` from a GitHub URL — it does not fetch the skill's `references/` folder, so the two reference files this skill links to (`references/mcp-workflow.md` and `references/ui-rules.md`) will be missing and the skill will run degraded. To use Zed's URL import anyway, follow it with the [agent snippet](#agent) in your `AGENTS.md`.

## Agent

A ready-made **Shadcn Svelte agent** ships in [`agents/`](agents/) — the same MCP-grounded workflow as the skill, packaged per editor with the correct frontmatter for each format. Full matrix: [`agents/README.md`](agents/README.md).

```bash
BASE=https://raw.githubusercontent.com/Michael-Obele/shadcn-svelte-mcp/main/agents

# VS Code (Copilot custom agent — appears in the chat agent picker)
mkdir -p .github/agents
curl -fsSL "$BASE/vscode-shadcn-svelte.agent.md" -o .github/agents/shadcn-svelte.agent.md

# Claude Code (VS Code also reads .claude/agents/)
mkdir -p .claude/agents
curl -fsSL "$BASE/claude-shadcn-svelte.md" -o .claude/agents/shadcn-svelte.md

# Cursor
mkdir -p .cursor/rules
curl -fsSL "$BASE/cursor-shadcn-svelte.mdc" -o .cursor/rules/shadcn-svelte.mdc

# Windsurf / Devin
mkdir -p .windsurf/rules
curl -fsSL "$BASE/windsurf-shadcn-svelte.md" -o .windsurf/rules/shadcn-svelte.md

# OpenCode
mkdir -p .opencode/agents
curl -fsSL "$BASE/opencode-shadcn-svelte.md" -o .opencode/agents/shadcn-svelte.md

# Zed / Codex / Gemini CLI — append the snippet instead
curl -fsSL "$BASE/agents-md-snippet.md" >> AGENTS.md   # Zed + AGENTS.md readers
curl -fsSL "$BASE/agents-md-snippet.md" >> GEMINI.md   # Gemini CLI
```

| Editor                                          | Install to                                           | Source file                     |
| ----------------------------------------------- | ---------------------------------------------------- | ------------------------------- |
| VS Code (Copilot)                               | `.github/agents/` or your profile's `agents/` folder | `vscode-shadcn-svelte.agent.md` |
| Claude Code                                     | `.claude/agents/` or `~/.claude/agents/`             | `claude-shadcn-svelte.md`       |
| Cursor                                          | `.cursor/rules/`                                     | `cursor-shadcn-svelte.mdc`      |
| Windsurf / Devin                                | `.windsurf/rules/` or `.devin/rules/`                | `windsurf-shadcn-svelte.md`     |
| OpenCode                                        | `.opencode/agents/` or `~/.config/opencode/agents/`  | `opencode-shadcn-svelte.md`     |
| Zed                                             | project `AGENTS.md` or `~/.config/zed/AGENTS.md`     | `agents-md-snippet.md`          |
| Codex, Amp, Gemini CLI, other AGENTS.md readers | `AGENTS.md` / `GEMINI.md`                            | `agents-md-snippet.md`          |

Notes:

- Keep the MCP server named `shadcn-svelte` (as in [Connect](#connect-30-seconds)) so the agent's `shadcn-svelte/*` tool bindings resolve.
- Without the MCP, the agent says so and falls back to official shadcn-svelte docs instead of guessing.

## Verify

```bash
claude mcp list
codex mcp list
curl -I https://shadcn.svelte-apps.me/health
```

## Local development

```bash
bun install
bun run dev # http://localhost:3000/mcp, health at /health
bun run check # type check
```

Stdio for local clients: `bun run src/stdio.ts`. Layout: `src/index.ts` (HTTP), `src/stdio.ts`, `src/worker.ts`, `src/mcp/tools/`, `src/mcp/prompts/`, `src/services/`.

## Contributing

MIT — see [LICENSE](LICENSE). Please read [Contributing](CONTRIBUTING.md) + [Code of Conduct](CODE_OF_CONDUCT.md).

Contact: support@svelte-apps.me · Maintainer: Michael Obele
