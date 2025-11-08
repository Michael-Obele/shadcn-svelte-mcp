# shadcn-svelte-mcp

[![latest release](https://img.shields.io/github/v/tag/Michael-Obele/shadcn-svelte-mcp?sort=semver)](https://github.com/Michael-Obele/shadcn-svelte-mcp/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en-US/install-mcp?name=shadcn-svelte&config=eyJ0eXBlIjoic3NlIiwidXJsIjoiaHR0cHM6Ly9zaGFkY24tc3ZlbHRlLm1hc3RyYS5jbG91ZC9hcGkvbWNwL3NoYWRjbi9zc2UifQ%3D%3D)

Mastra MCP server and tooling that provides real-time access to shadcn-svelte component documentation and developer utilities using web scraping.

## Production Deployments

Choose the base host that fits your workflow — both expose the same toolset, but their runtime characteristics differ:

| Host         | Base URL                                 | Highlights                                                                                                                                                                                                         |
| ------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mastra Cloud | https://shadcn-svelte.mastra.cloud       | **Primary choice** - Zero cold start, maximum responsiveness, and consistently reliable performance. Tool discovery issue has been fixed.                                                                          |
| Railway      | https://shadcn-svelte-mcp.up.railway.app | Backup option with consistent tool visibility. Expect a split-second cold start; the very first request might fail and then succeed on retry. Alternate base host: `https://shadcn-svelte-mcp-api.up.railway.app`. |

- Append `/api/mcp/shadcn/sse` for the SSE transport (best for editors that keep long-lived connections).
- Append `/api/mcp/shadcn/mcp` for the HTTP transport (handy for CLIs and quick one-off calls).
- **Mastra Cloud is the recommended primary deployment** - it offers zero cold start and maximum responsiveness. Tool discovery issue has been fixed and it can be used reliably. Railway serves as a backup when Mastra Cloud is unavailable.

<details>
<summary>Endpoint reference & alternates</summary>

- **Mastra Cloud SSE**: https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse
- **Mastra Cloud HTTP**: https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp
- **Railway SSE**: https://shadcn-svelte-mcp.up.railway.app/api/mcp/shadcn/sse
- **Railway HTTP**: https://shadcn-svelte-mcp.up.railway.app/api/mcp/shadcn/mcp
- **Railway alternate host**: replace the host with `https://shadcn-svelte-mcp-api.up.railway.app` and append the same `/api/mcp/shadcn/{sse|mcp}` path.
- If the very first Railway call returns an error, wait a second and retry — the cold start is short-lived.

</details>

> [!NOTE]
> This project follows our [Code of Conduct](CODE_OF_CONDUCT.md) and welcomes contributions! See our [Contributing Guidelines](CONTRIBUTING.md) for details.

This repository contains a Mastra-based MCP server that provides real-time access to shadcn-svelte component documentation using web scraping. Use it in your AI-powered code editor to get instant access to the latest shadcn-svelte component information directly from the official website.

## 🎉 What's New

- ✅ Production deployment on Mastra Cloud
- ✅ Four powerful MCP tools for component discovery and documentation
- ✅ Advanced fuzzy search with typo tolerance and intelligent suggestions
- ✅ **Lucide Svelte icon search** - Browse and search 1400+ icons with smart filtering
- ✅ Support for all major AI code editors (Cursor, Windsurf, VS Code, Zed, Claude Code, Codex)
- ✅ HTTP and SSE transport protocols
- ✅ Real-time web scraping from shadcn-svelte.com

## Editor Setup

**Mastra Cloud is the recommended primary deployment** for all editors. It offers zero cold start and maximum responsiveness. SSE works best for editors that keep a persistent connection, while HTTP is handy for one-off requests and scripts. VS Code users can open the Command Palette (`Cmd/Ctrl+Shift+P`) and run `MCP: Add server` to paste either URL.

<details>
<summary>Cursor</summary>

1. Open Cursor Settings (`Cmd/Ctrl` + `,`).
2. Navigate to "MCP" / "Model Context Protocol" and add a new server configuration.
3. **Mastra Cloud is recommended** for zero cold start and maximum responsiveness. Append the SSE or HTTP path as shown in the examples below.

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

You can swap in the Railway host if you prefer guaranteed tool visibility:

```diff
- "url": "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse"
+ "url": "https://shadcn-svelte-mcp.up.railway.app/api/mcp/shadcn/sse"
```

</details>

<details>
<summary>Windsurf</summary>

1. Edit `~/.codeium/windsurf/mcp_config.json`.
2. **Mastra Cloud is recommended** for zero cold start and maximum responsiveness. Add the SSE transport as shown:

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

You can swap in the Railway host if you prefer guaranteed tool visibility:

```diff
- "url": "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse"
+ "url": "https://shadcn-svelte-mcp.up.railway.app/api/mcp/shadcn/sse"
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

3. Swap the host and path if you prefer the Railway endpoint or HTTP transport:

```json
{
  "context_servers": {
    "shadcn-svelte": {
      "source": "custom",
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://shadcn-svelte-mcp.up.railway.app/api/mcp/shadcn/mcp"
      ],
      "env": {}
    }
  }
}
```

4. Save, restart Zed, and confirm the server shows a green indicator in the Agent panel. Zed also offers a UI flow via Settings → Agent to paste either endpoint without editing JSON.

You can swap in the Railway host if you prefer guaranteed tool visibility:

```diff
- "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse"
+ "https://shadcn-svelte-mcp.up.railway.app/api/mcp/shadcn/sse"
```

</details>

## CLI & Agent Configuration

The same base URLs work across CLIs. **Mastra Cloud is the recommended primary deployment** for the fastest responses with zero cold start. Railway serves as a reliable backup option.

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
  claude mcp add shadcn-svelte --url https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp
  claude mcp add shadcn-svelte --url https://shadcn-svelte-mcp.up.railway.app/api/mcp/shadcn/mcp
  ```

- Use `/permissions` inside Claude Code to grant tool access if prompted.

You can swap in the Railway host if you prefer guaranteed tool visibility:

```diff
- "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp"
+ "https://shadcn-svelte-mcp.up.railway.app/api/mcp/shadcn/mcp"
```

</details>

<details>
<summary>OpenAI Codex CLI</summary>

Register either endpoint:

```bash
codex mcp add shadcn-svelte --url https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse
codex mcp list
```

Swap in the Railway host if you prefer guaranteed tool visibility:

```diff
- --url https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse
+ --url https://shadcn-svelte-mcp.up.railway.app/api/mcp/shadcn/sse
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

4. **Mastra Cloud is recommended** for zero cold start and maximum responsiveness. Restart the CLI to apply changes. Railway serves as a backup option.

You can swap in the Railway host if you prefer guaranteed tool visibility:

```diff
- "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp"
+ "https://shadcn-svelte-mcp.up.railway.app/api/mcp/shadcn/mcp"
```

</details>

## Verification & Quick Tests

- `claude mcp list`
- `codex mcp list`
- `npx mcp-remote https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp`
- `curl -I https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp`
- `curl -N https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse`

If the Railway check fails on the first attempt, wait a moment and retry; the cold start clears almost immediately. Claude Code may prompt for tool permissions — use `/permissions` or set `allowedTools` in `~/.claude.json`. Editors that maintain long-lived connections should use the SSE URL; quick scripts can stick with HTTP.

## Backup Server Configuration

<details>
<summary>⚠️ Backup URL (Use only if Mastra Cloud is unavailable)</summary>

The tool discovery issue has been fixed for Mastra Cloud (`https://shadcn-svelte.mastra.cloud`), which can now be used reliably as the primary deployment. Use the Railway host below only as a backup when Mastra Cloud is experiencing downtime. The toolset is identical; only the host name differs. Expect a split-second cold start for the Railway deployment.

```json
{
  "shadcn-svelte-backup": {
    "url": "https://shadcn-svelte-mcp.up.railway.app/api/mcp/shadcn/sse",
    "type": "http"
  }
}
```

Use this backup when:

- Mastra Cloud (`https://shadcn-svelte.mastra.cloud`) is experiencing downtime.
- You need a fallback during rare maintenance windows.
- You want to route traffic through Railway for redundancy.

</details>

## Available Tools

Once installed, your AI assistant will have access to these tools:

1. **shadcnSvelteListTool** - List all available shadcn-svelte components, blocks, charts, and documentation sections
2. **shadcnSvelteGetTool** - Get detailed documentation for a specific component (installation, usage, props, examples)
3. **shadcnSvelteUtilityTool** - Access installation guides, theming help, CLI usage, migration assistance, and **Lucide Svelte icon search** (1400+ icons with smart filtering)
4. **shadcnSvelteSearchTool** ⭐ NEW - Search for components, blocks, charts, and documentation by keyword or phrase with advanced fuzzy matching, typo tolerance, and intelligent suggestions

## Example Usage

After installing the MCP server in your editor, you can ask your AI assistant:

- "Show me how to install the shadcn-svelte button component"
- "List all available shadcn-svelte components"
- "Search for date picker components in shadcn-svelte"
- "Find all chart components with 'line' in the name"
- "How do I customize the theme for shadcn-svelte?"
- "What are the props for the Dialog component?"
- "Help me migrate from shadcn-svelte v0.x to v1.x"
- "Search for Lucide icons related to 'user profile'"
- "Find all arrow icons in Lucide Svelte"

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

## Useful scripts

- `npm run dev` - Start Mastra in development mode (recommended smoke-test).
- `npm run build` - Build the Mastra project for production.
- `npm run start` - Start the built Mastra server.
- `npm run check-versions` - Check if package.json and mcp-server.ts versions match (fails if mismatched).
- `npm run sync-versions-auto` - Check versions and auto-sync if mismatched (package.json is source of truth).
- `npm run sync-versions` - Sync versions from latest git tag to both files.

## MCP Architecture

This project exposes a **production-ready MCP Server** that makes shadcn-svelte documentation and tools available to AI code editors.

**What this means:**

- **MCP Server** (`src/mastra/mcp-server.ts`) - Exposes four shadcn-svelte tools to external MCP clients (Cursor, Windsurf, VS Code, etc.)
- **No MCP Client needed** - This project only _provides_ tools, it doesn't consume tools from other servers

The server is deployed at `https://shadcn-svelte.mastra.cloud` and exposes tools via HTTP and SSE transports.

For a detailed explanation of MCP concepts, see `MCP_ARCHITECTURE.md`.

## Project Architecture

### Core Components

- **Mastra Framework**: Orchestrates agents, workflows, and MCP servers
- **MCP Server**: Exposes tools to AI code editors via HTTP/SSE protocols
- **Web Scraping Services**: Multi-strategy approach for fetching documentation:
  - Direct `.md` endpoint fetching for components
  - Crawlee (Playwright) for JavaScript-heavy pages (charts, themes, blocks)
  - Cheerio + Turndown for simple HTML pages
- **Intelligent Caching**: 3-day TTL cache with memory and disk storage
- **Component Discovery**: Dynamic scraping of component registry from shadcn-svelte.com
- **Advanced Search**: Fuse.js-powered fuzzy search with typo tolerance

### Key Features

- **Real-time Documentation**: Always fetches latest content from shadcn-svelte.com
- **Multi-strategy Fetching**: Handles different page types (SPA, static, JS-heavy)
- **Intelligent Caching**: Reduces API calls while ensuring freshness
- **Lucide Icon Search**: Browse and search 1400+ Lucide Svelte icons with smart filtering by name and tags
- **Comprehensive Testing**: Edge case coverage and integration tests
- **Automated Versioning**: Semantic release with version synchronization
- **Production Deployment**: Mastra Cloud hosting with monitoring

## Conventions & notes

- Tools are implemented under `src/mastra/tools` and should use `zod` for input validation
- Web scraping services are implemented under `src/services/` and use Crawlee (with Playwright) for real-time documentation fetching from JavaScript-heavy pages
- Intelligent caching is used to improve performance and reduce API calls
- Tools follow Mastra patterns using `createTool` with proper input/output schemas

## Testing

The project includes a comprehensive test suite covering:

- **Tool Integration Tests**: Verify all MCP tools work correctly
- **Service Tests**: Test web scraping and caching functionality
- **Edge Case Tests**: Fuzzy search, typos, and error handling
- **Package Manager Tests**: Cross-platform compatibility
- **Crawlee Tests**: Web scraping reliability

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

---

For more details:

- **MCP Prompts and Course System**: See [`MCP_Prompts_and_Course_System.md`](MCP_Prompts_and_Course_System.md) for comprehensive documentation on the MCP prompt system and Mastra course integration
- **MCP Architecture**: See [`MCP_ARCHITECTURE.md`](MCP_ARCHITECTURE.md) for detailed explanation of MCP server vs client
- **Web scraping services**: See `src/services/` for Crawlee-based real-time documentation fetching implementation
- **AI assistant guide**: See `.github/copilot-instructions.md`
