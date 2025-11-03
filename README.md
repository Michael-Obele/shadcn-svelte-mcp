# shadcn-svelte-mcp

[![latest release](https://img.shields.io/github/v/tag/Michael-Obele/shadcn-svelte-mcp?sort=semver)](https://github.com/Michael-Obele/shadcn-svelte-mcp/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en-US/install-mcp?name=shadcn-svelte&config=eyJ0eXBlIjoic3NlIiwidXJsIjoiaHR0cHM6Ly9zaGFkY24tc3ZlbHRlLm1hc3RyYS5jbG91ZC9hcGkvbWNwL3NoYWRjbi9zc2UifQ%3D%3D)

Mastra MCP server and tooling that provides real-time access to shadcn-svelte component documentation and developer utilities using web scraping. Now deployed and available at [https://shadcn-svelte.mastra.cloud](https://shadcn-svelte.mastra.cloud)!

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
- ✅ Intelligent caching for performance
- ✅ Always up-to-date documentation
- ✅ Comprehensive testing suite
- ✅ Automated versioning and release management

## Installation in Your Code Editor

Add the **Shadcn Svelte Docs** MCP server to your AI code editor to get instant access to shadcn-svelte component documentation and utilities.

### Cursor

1. Open Cursor Settings (Cmd/Ctrl + ,)
2. Navigate to "MCP" or "Model Context Protocol"
3. Add a new server configuration:

```json
{
  "shadcn-svelte": {
    "type": "sse",
    "url": "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse"
  }
}
```

Or use the HTTP endpoint:

```json
{
  "shadcn-svelte": {
    "type": "http",
    "url": "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp"
  }
}
```

### Windsurf

1. Open `~/.codeium/windsurf/mcp_config.json` in your editor
2. Add the following configuration:

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

3. Save and restart Windsurf

### Visual Studio Code

1. Create or edit `.vscode/mcp.json` in your workspace root
2. Add the server configuration:

```json
{
  "servers": {
    "shadcn-svelte": {
      "type": "sse",
      "url": "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse"
    }
  }
}
```

3. Open VSCode settings and enable "Chat > MCP"
4. In Agent mode, open `mcp.json` and click "start"

Tip: You can also add MCP servers from the Command Palette in VS Code — press Ctrl+Shift+P (or Cmd+Shift+P on macOS), run "MCP: Add server" (or "mcp add server"), then choose:

- "Command (stdio)" to run a local command that implements the MCP protocol (e.g., an `npx` command starting a stdio MCP server)
- "HTTP (HTTP or Server-Sent Events)" to connect directly to a remote HTTP/SSE MCP endpoint (paste the `https://.../mcp` or `.../sse` URL)

This Command Palette flow is the quickest way to add a server without editing files manually.

### Zed

Zed uses a `settings.json` file for MCP server configuration:

1. Open Zed settings (Cmd/Ctrl + ,)
2. Navigate to the JSON settings file (usually `~/.config/zed/settings.json`)
3. Add the MCP server configuration under `context_servers`:

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

Alternatively, for HTTP transport:

```json
{
  "context_servers": {
    "shadcn-svelte": {
      "source": "custom",
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp"
      ],
      "env": {}
    }
  }
}
```

4. Save the file and restart Zed
5. Open the Agent Panel to verify the server is connected (look for a green indicator)
   Note: Zed also exposes a UI form for adding MCP/context servers which is often easier than editing `settings.json` manually — open Zed's Agent/AI settings and use the "Add server" form to paste the HTTP/SSE URL or configure a local command.

### Claude Code CLI

Install using the terminal:

```bash
claude mcp add shadcn-svelte --url https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse
```

### OpenAI Codex CLI

Register from the terminal:

```bash
codex mcp add shadcn-svelte --url https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse
```

Then run `codex mcp list` to confirm it's enabled.

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
- **Intelligent Caching**: 24-hour TTL cache with memory and disk storage
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
- Tests are located in the `test/` directory at the repository root
- AI-generated progress docs are stored in `ai-generated-docs/` folder

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

- **MCP Architecture**: See `ai-generated-docs/MCP_ARCHITECTURE.md` for detailed explanation of MCP server vs client
- **Web scraping services**: See `src/services/` for Crawlee-based real-time documentation fetching implementation
- **Search Enhancement**: See `ai-generated-docs/search-enhancement-summary.md` for details on the advanced search functionality
- **AI assistant guide**: See `.github/copilot-instructions.md`
