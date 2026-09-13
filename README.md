# shadcn-svelte-mcp

[![latest release](https://img.shields.io/github/v/tag/Michael-Obele/shadcn-svelte-mcp?sort=semver)](https://github.com/Michael-Obele/shadcn-svelte-mcp/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en-US/install-mcp?name=shadcn-svelte&config=eyJ0eXBlIjoiaHR0cCIsInVybCI6Imh0dHBzOi8vc2hhZGNuLnN2ZWx0ZS1hcHBzLm1lL21jcCJ9)

> [!WARNING]
> **Help keep the hosted server online:** the hosted endpoint at
> `https://shadcn.svelte-apps.me/mcp` costs money to run. If running costs are
> not covered by donations within ~30 days, the hosted instance may go down.
> The server keeps working via self-host — `npx -y shadcn-svelte-mcp`, or deploy
> it yourself to Fly.io / Render / Cloudflare Workers.
> [❤️ Sponsor @Michael-Obele](https://github.com/sponsors/Michael-Obele) to keep it hosted.

> [!IMPORTANT]
> **URL Update Notification:** This MCP server is now hosted at
> `https://shadcn.svelte-apps.me/mcp`. Earlier configs pointing at the
> `*.workers.dev` / `*.server.mastra.cloud` `/api/mcp/shadcn/...` endpoints should
> be updated to the new URL below (health check: `https://shadcn.svelte-apps.me/health`).

Real-time shadcn-svelte docs for AI editors, via [tmcp](https://tmcp.io). Scrapes shadcn-svelte.com and bits-ui.com live — no stale docs.

**Hosted:** `https://shadcn.svelte-apps.me/mcp` (Streamable HTTP) · Health: `https://shadcn.svelte-apps.me/health` · Local: `bun run src/stdio.ts`

## What you get

- Live shadcn-svelte + [Bits UI](https://bits-ui.com) docs (no stale bundles)
- 5 tools: list, get, search, icons, Bits UI API
- Fuzzy search with typo tolerance + install snippets per package manager
- ~1,600 Lucide icons with import snippets
- 3-day cache (memory / disk / KV) for fast repeats

## Connect (30 seconds)

**Hosted (recommended):** `https://shadcn.svelte-apps.me/mcp`

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

### NPM fallback (if hosted is down)

Run locally via npm — same tools, no server:

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

<details>
<summary>Editor-specific notes</summary>

- Cursor: Settings → MCP → add `http` server with the hosted URL.
- Windsurf: `~/.codeium/windsurf/mcp_config.json` → `mcpServers`, restart.
- Zed: Settings → Agent, or `npx -y mcp-remote https://shadcn.svelte-apps.me/mcp`.
- Gemini CLI: `~/.gemini/settings.json` → `httpUrl`, or use `mcp-remote` variant.

</details>

## Tools

| Tool                   | Use for                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `shadcn-svelte-get`    | Details + install snippet for a known component / block / doc (`packageManager` supported) |
| `shadcn-svelte-search` | Fuzzy find when you don't know the exact name                                              |
| `shadcn-svelte-list`   | Full inventory of components, blocks, charts, docs                                         |
| `shadcn-svelte-icons`  | Lucide icons (`names`, `limit`, `importLimit`)                                             |
| `bits-ui-get`          | Low-level Bits UI API (props, events, data attributes)                                     |

Start with `get`, fall back to `search`, use `bits-ui-get` only for primitive internals.

Try: "Install button", "List all components", "Find date-picker-like components", "Icons for settings", "Bits UI Dialog API".

## Skill

Polished SvelteKit UI skill at `skills/shadcn-sveltekit-design/SKILL.md`:

```bash
npx skills add Michael-Obele/shadcn-svelte-mcp --skill shadcn-sveltekit-design
```

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
