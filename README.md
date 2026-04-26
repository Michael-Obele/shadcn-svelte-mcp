# shadcn-svelte-mcp

[![latest release](https://img.shields.io/github/v/tag/Michael-Obele/shadcn-svelte-mcp?sort=semver)](https://github.com/Michael-Obele/shadcn-svelte-mcp/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en-US/install-mcp?name=shadcn-svelte&config=eyJ0eXBlIjoic3NlIiwidXJsIjoiaHR0cHM6Ly9zaGFkY24tc3ZlbHRlLm1hc3RyYS5jbG91ZC9hcGkvbWNwL3NoYWRjbi9zc2UifQ%3D%3D)

Mastra MCP server and tooling that provides real-time access to shadcn-svelte component documentation and developer utilities using web scraping.

## Production Deployments

Mastra Cloud is the primary deployment: zero cold start, fast tool discovery, and the same toolset over both transports.

| Transport | URL                                                   | Best for                                 |
| --------- | ----------------------------------------------------- | ---------------------------------------- |
| SSE       | https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse | Editors that keep long-lived connections |
| HTTP      | https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp | CLIs, scripts, and one-off calls         |

> [!NOTE]
> This project follows our [Code of Conduct](CODE_OF_CONDUCT.md) and welcomes contributions! See our [Contributing Guidelines](CONTRIBUTING.md) for details.

This repository contains a Mastra-based MCP server that provides real-time access to shadcn-svelte component documentation using web scraping. Use it in your AI-powered code editor to get instant access to the latest shadcn-svelte component information directly from the official website.

## Table of Contents

- [Production Deployments](#production-deployments)
- [Features](#-features)
- [Bits UI Integration](#bits-ui-integration)
- [Observations & Minor UX Suggestions](#-observations--minor-ux-suggestions)
- [Editor Setup](#editor-setup)
- [CLI & Agent Configuration](#cli--agent-configuration)
- [Skills.sh Skill](#skillssh-skill)
- [Verification & Quick Tests](#verification--quick-tests)
- [Available Tools](#available-tools)
- [Example Usage](#example-usage)

- [Local Development](#local-development)
- [Developer Scripts](#developer-scripts)
- [MCP Architecture](#mcp-architecture)
- [Project Architecture](#project-architecture)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## 🎉 Features

- ✅ Production deployment on Mastra Cloud
- ✅ **Five main MCP tools** for comprehensive shadcn-svelte ecosystem support (see 'Available Tools')
- ✅ **Bits UI API documentation** - Direct access to underlying component library API docs with AI-optimized content
- ✅ Advanced fuzzy search with typo tolerance and intelligent suggestions
- ✅ **Lucide Svelte icon search** - Browse and search ~1,600 icons (dynamic) with smart filtering
- ✅ Support for all major AI code editors (Cursor, Windsurf, VS Code, Zed, Claude Code, Codex)
- ✅ HTTP and SSE transport protocols
- ✅ Real-time web scraping from shadcn-svelte.com and bits-ui.com

## Bits UI Integration

shadcn-svelte components are built on top of [Bits UI](https://bits-ui.com), the underlying component library that provides the core functionality. This MCP server provides direct access to Bits UI's comprehensive API documentation through AI-optimized content endpoints.

### AI-Optimized Content

The `bits-ui-get` tool fetches content from Bits UI's dedicated `/llms.txt` endpoints, which provide:

- **Structured API reference tables** with Property/Type/Description/Details columns
- **Clean markdown formatting** optimized for AI consumption
- **Implementation details** and usage examples
- **Data attributes and event handlers** documentation
- **Navigation links** to related components

This ensures that AI assistants receive the most relevant and well-structured information for implementing shadcn-svelte components correctly.

## 🔧 UX Observations & Suggestions

- The `shadcn-svelte-icons` tool previously showed an awkward message "No icons found matching \"undefined\"" when explicit `names` were requested and none were found — this has been fixed so the response now shows `No icons found for names: ...` instead. ✅
- Imports in the `icons` tool are intentionally limited to the first 10 names in the response to keep usage snippets tidy; increase the `limit` if you need more icons returned (the snippet still only imports the first 10). 💡
- The icons tool now supports `importLimit` (default 10) and `limit` (default 100) to control how many icons are returned, and how many are included in `import` statements.
- The `shadcn-svelte-get` tool now respects an optional `packageManager` parameter and adjusts the installation snippet accordingly (`pnpm dlx`, `yarn dlx`, `npx`, `bunx`). ✅
- If you notice any remaining odd messages or install command inconsistencies, please file an issue — we keep the MCP server behavior stable but will gladly refine UX in following pull requests.

## Editor Setup

Mastra Cloud is the recommended deployment for all editors. Use SSE for persistent editor connections and HTTP for one-off requests or scripts. VS Code users can open the Command Palette (`Cmd/Ctrl+Shift+P`) and run `MCP: Add server` to paste either URL.

<details>
<summary>Cursor</summary>

1. Open Cursor Settings (`Cmd/Ctrl` + `,`).
2. Navigate to "MCP" / "Model Context Protocol" and add a new server configuration.
3. Add either the SSE or HTTP endpoint shown below.

Mastra Cloud — SSE example:

```json
{
  "shadcn-svelte": {
    "type": "sse",
    "url": "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse"
  }
}
```

Mastra Cloud — HTTP example:

```json
{
  "shadcn-svelte": {
    "type": "http",
    "url": "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp"
  }
}
```

</details>

<details>
<summary>Windsurf</summary>

1. Edit `~/.codeium/windsurf/mcp_config.json`.
2. Add the SSE transport as shown:

```json
{
  "mcpServers": {
    "shadcn-svelte": {
      "url": "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse",
      "transport": "sse"
    }
  }
}
```

3. Save, restart Windsurf, then open `mcp.json` in Agent mode and click "start".

Use the HTTP variant if you need it:

```json
{
  "servers": {
    "shadcn-svelte": {
      "type": "http",
      "url": "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp"
    }
  }
}
```

</details>

<details>
<summary>Zed</summary>

1. Open Zed settings (`Cmd/Ctrl` + `,`).
2. Edit `~/.config/zed/settings.json` and add an entry under `context_servers`:

```json
{
  "context_servers": {
    "shadcn-svelte": {
      "source": "custom",
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse"
      ],
      "env": {}
    }
  }
}
```

4. Save, restart Zed, and confirm the server shows a green indicator in the Agent panel. Zed also offers a UI flow via Settings → Agent to paste either endpoint without editing JSON.

</details>

<details>
<summary>VS Code</summary>

Two supported workflows (both work for either user/global settings or workspace/project settings):

- **Option A — Command Palette (quick):** Run `MCP: Add Server` (Ctrl/Cmd+Shift+P) and paste the SSE or HTTP URL. This is the simplest interactive flow and can be used from the global (user) or workspace context.

  Examples to paste:
  - SSE: `https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse`
  - HTTP: `https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp`

- **Option B — mcp-remote JSON (scriptable):** Create or update `.vscode/mcp.json` (or your user-level MCP config) to use the `mcp-remote` helper. This works equally well as a workspace or global config and is handy for reproducible setups.

  Example `.vscode/mcp.json` using `mcp-remote` (SSE):

  ```json
  {
    "mcpServers": {
      "shadcn-svelte": {
        "command": "npx",
        "args": [
          "-y",
          "mcp-remote",
          "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse"
        ]
      }
    }
  }
  ```

  And for the HTTP transport replace the URL with the `/mcp` endpoint:

  ```json
  {
    "mcpServers": {
      "shadcn-svelte": {
        "command": "npx",
        "args": [
          "-y",
          "mcp-remote",
          "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp"
        ]
      }
    }
  }
  ```

### Verification

- Use the Command Palette and run `MCP: List Servers` to view configured servers.
- Use `MCP: List Servers > Configure Model Access` to manage which models can use MCP servers.

</details>

## CLI & Agent Configuration

The same base URLs work across CLIs. **Mastra Cloud is the recommended primary deployment** for the fastest responses with zero cold start.

<details>
<summary>Claude Code CLI (Anthropic)</summary>

- **Global settings** (`~/.claude/settings.json`):

  ```json
  {
    "mcpServers": {
      "shadcn-svelte": {
        "command": "npx",
        "args": [
          "-y",
          "mcp-remote",
          "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp"
        ]
      }
    }
  }
  ```

- **Project-scoped override** (`.mcp.json`):

  ```json
  {
    "mcpServers": {
      "shadcn-svelte": {
        "command": "npx",
        "args": [
          "-y",
          "mcp-remote",
          "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp"
        ]
      }
    }
  }
  ```

  Enable project servers with:

  ```json
  {
    "enableAllProjectMcpServers": true
  }
  ```

- **Command palette alternative:**

  ```bash
  claude mcp add --transport http shadcn-svelte https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp
  ```

- Use `/permissions` inside Claude Code to grant tool access if prompted.

<!-- Alternative hosts are not required in most cases; Mastra Cloud is the recommended default. -->

<!-- Mastra Cloud is recommended; an organization-hosted endpoint may be used if needed. -->

</details>

<details>
<summary>OpenAI Codex CLI</summary>

Register the Mastra Cloud endpoint for codex or use your own privately hosted MCP endpoint.

```bash
codex mcp add shadcn-svelte --url https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse
codex mcp list
```

</details>

<details>
<summary>Gemini CLI (Google)</summary>

1. Create or edit `~/.gemini/settings.json`:

   ```bash
   mkdir -p ~/.gemini
   nano ~/.gemini/settings.json
   ```

2. Add a configuration. Mastra Cloud example:

   ```json
   {
     "mcpServers": {
       "shadcn-svelte": {
         "httpUrl": "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp"
       }
     }
   }
   ```

3. Prefer the `npx mcp-remote` command variant if your CLI version expects a command:

   ```json
   {
     "mcpServers": {
       "shadcn-svelte": {
         "command": "npx",
         "args": [
           "mcp-remote",
           "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp"
         ]
       }
     }
   }
   ```

4. Restart the CLI to apply changes.

</details>

## Skills.sh Skill

This repository includes a publishable agent skill at `skills/shadcn-sveltekit-design/SKILL.md` for designing and implementing polished SvelteKit pages and reusable components with shadcn-svelte while grounding component choices in this MCP.

### Install from GitHub

```bash
npx skills add Michael-Obele/shadcn-svelte-mcp --skill shadcn-sveltekit-design
```

For GitHub Copilot specifically:

```bash
npx skills add Michael-Obele/shadcn-svelte-mcp --skill shadcn-sveltekit-design --agent github-copilot -g -y
```

### Local validation

```bash
npx skills add . --list
```

### Expected skills.sh page

Once this repository change is pushed to the public GitHub repository and indexed by the `skills` ecosystem, the skill should resolve at:

```text
https://skills.sh/Michael-Obele/shadcn-svelte-mcp/shadcn-sveltekit-design
```

The skill assumes the `shadcn-svelte` MCP server is already configured in the agent environment.

## Verification & Quick Tests

Use these checks after configuration. Prefer SSE for editor connections and HTTP for CLI probing.

- `claude mcp list`
- `codex mcp list`
- `npx mcp-remote https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp`
- `curl -I https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp`
- `curl -N https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse`

Claude Code may prompt for tool permissions. Use `/permissions` or set `allowedTools` in `~/.claude.json` if needed.

## Available Tools

These are the tool IDs exposed by the MCP server:

| Tool                   | Use for                                                                    | Returns                                                |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------ |
| `shadcn-svelte-list`   | Inventory of components, blocks, charts, docs, and Bits UI primitives      | Markdown list                                          |
| `shadcn-svelte-get`    | Detailed lookup for components, blocks, charts, docs, and install snippets | Structured JSON; supports `packageManager`             |
| `shadcn-svelte-search` | Fuzzy discovery when you do not know the exact component or docs name      | Markdown summary plus structured results               |
| `shadcn-svelte-icons`  | Lucide icon discovery with install and import snippets                     | Markdown; supports `names`, `limit`, and `importLimit` |
| `bits-ui-get`          | Lower-level Bits UI API reference and implementation details               | Structured JSON from Bits UI `llms.txt` endpoints      |

Use `shadcn-svelte-get` first for known components or docs, `shadcn-svelte-search` when the exact name is unknown, and `bits-ui-get` only when you need lower-level primitive details.

## Example Usage

After installing the MCP server in your editor, you can ask your AI assistant:

- "Show me how to install the shadcn-svelte button component"
- "List all available shadcn-svelte components"
- "Find components similar to a date picker and tell me which ones actually exist"
- "List the available chart components"
- "How do I customize themes in shadcn-svelte?"
- "Find Lucide icons for user profile and settings"
- "Show me the Bits UI API details for Dialog"
- "Give me the install steps for dashboard-01 using yarn"

## Local Development

Want to run the MCP server locally or contribute to the project?

### Contents

- `src/` - Mastra bootstrap, MCP servers, tools, and agents
- `src/services/` - Web scraping services for real-time documentation fetching
- `src/mastra/tools/` - Tools that expose component discovery, fetching and utilities
- `src/mastra/agents/` - Specialized AI agent for shadcn-svelte assistance
- `scripts/` - Version management and automation scripts

### Quick start (development smoke-test)

1. Install dependencies (using your preferred package manager).

```bash
# npm
npm install

# or bun
bun install

# or pnpm
pnpm install
```

2. Run the development smoke-test (recommended):

```bash
# Starts Mastra in dev mode; this repo's smoke-test expects a short run to detect runtime errors
npm run dev
```

## Developer Scripts

- `npm run dev` - Start Mastra in development mode (recommended smoke-test).
- `npm run build` - Build the Mastra project for production.
- `npm run start` - Start the built Mastra server.
- `npm run check-versions` - Check if package.json and mcp-server.ts versions match (fails if mismatched).
- `npm run sync-versions-auto` - Check versions and auto-sync if mismatched (package.json is source of truth).
- `npm run sync-versions` - Sync versions from latest git tag to both files.

## Project Architecture

### Core Components

- **Mastra Framework**: Orchestrates agents, workflows, and MCP servers
- **MCP Server**: Exposes tools to AI code editors via HTTP/SSE protocols
- **Web Scraping Services**: Multi-strategy approach for fetching documentation:
  - Direct `.md` endpoint fetching for shadcn-svelte components
  - AI-optimized `/llms.txt` endpoint fetching for Bits UI API documentation
  - Crawlee (Playwright) for JavaScript-heavy pages (charts, themes, blocks)
  - Cheerio + Turndown for simple HTML pages
- **Intelligent Caching**: 3-day TTL cache with memory and disk storage
- **Component Discovery**: Dynamic scraping of component registry from shadcn-svelte.com
- **Advanced Search**: Fuse.js-powered fuzzy search with typo tolerance

### Key Features

The project combines real-time documentation fetching, Bits UI API access, multi-strategy scraping, intelligent caching, Lucide icon search, semantic version synchronization, and production deployment on Mastra Cloud.

## Conventions & notes

- Tools are implemented under `src/mastra/tools` and should use `zod` for input validation
- Web scraping services are implemented under `src/services/` and use Crawlee (with Playwright) for real-time documentation fetching from JavaScript-heavy pages
- Intelligent caching is used to improve performance and reduce API calls
- Tools follow Mastra patterns using `createTool` with proper input/output schemas

## Development tips

- Node >= 20.9.0 is recommended (see `package.json` engines)
- When adding tools, follow the patterns in `src/mastra/tools/shadcn-svelte-get.ts` and `shadcn-svelte-list.ts`
- After making changes, run the 10–15s smoke-test via `npm run dev` to surface runtime integration issues early
- Set up proper Firecrawl API credentials for web scraping functionality
- The system uses intelligent caching - clear cache if you need fresh data during development

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions! Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before getting started.

## Contact

- **Issues & Support**: support@svelte-apps.me
- **Contributions**: contrib@svelte-apps.me
- **Maintainer**: Michael Obele (michael@svelte-apps.me)
