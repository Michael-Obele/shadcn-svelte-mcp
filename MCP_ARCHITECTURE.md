# MCP Architecture

This document provides detailed technical information about the Model Context Protocol (MCP) implementation in the shadcn-svelte-mcp project.

## Overview

This project implements an **MCP Server** that provides shadcn-svelte component documentation and development tools to AI-powered code editors and assistants.

## MCP Concepts

### Server vs Client

- **MCP Server**: Provides tools and resources to clients (like AI editors). This project IS an MCP server.
- **MCP Client**: Consumes tools and resources from servers. AI editors like Cursor, VS Code, etc. are MCP clients.

This project does NOT implement an MCP client - it only provides tools to external MCP clients.

### Transport Protocols

The server supports two transport protocols:

#### Streamable HTTP Transport (recommended)

- **Endpoint**: `/mcp` (`src/index.ts`, Node/Bun)
- **Method**: HTTP POST (Streamable HTTP per the MCP spec)
- **Use case**: One-off requests, CLI tools, remote clients, serverless deployments
- **Example**: `curl -X POST http://localhost:3000/mcp`

#### STDIO Transport

- **Entry**: `src/stdio.ts`
- **Protocol**: JSON-RPC over stdin/stdout
- **Use case**: Local MCP clients (Claude Desktop, Cursor, VS Code, etc.)
- **Example**: `bun run src/stdio.ts`

## Architecture

### Core Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AI Editor     │────│   MCP Transport  │────│  MCP Server     │
│   (Client)      │    │  (HTTP / STDIO)  │    │  (tmcp)         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                       │
                                               ┌───────┴───────┐
                                               │  McpServer    │
                                               │  (tmcp)       │
                                               └───────┬───────┘
                                                       │
                                               ┌───────┴───────┐
                                               │  Tools (5) +  │
                                               │  Prompts (4)  │
                                               └───────────────┘
```

### tmcp Framework Integration

The server is built using [tmcp](https://tmcp.io) — a lightweight, schema-agnostic
MCP SDK — with the Valibot adapter (`@tmcp/adapter-valibot`):

- **`McpServer` assembly**: `src/mcp/server.ts` (name, version, description, capabilities)
- **Tool registration**: `defineTool` from `tmcp/tool` + `server.tools([...])`
- **Prompt registration**: `definePrompt` from `tmcp/prompt` + `server.prompts([...])`
- **HTTP transport**: `HttpTransport` from `@tmcp/transport-http` (`respond(request) → Response | null`)
- **STDIO transport**: `StdioTransport` from `@tmcp/transport-stdio` (`.listen()`)
- **Runtime-agnostic**: Web `Request`/`Response` based — runs on Node and Bun

### Tool Implementation

Tools are implemented using tmcp's `defineTool` with Valibot schemas, and return
content blocks via the `tool.text(...)` / `tool.error(...)` helpers from `tmcp/utils`:

```typescript
import { defineTool } from "tmcp/tool";
import { tool } from "tmcp/utils";
import * as v from "valibot";

export const myTool = defineTool(
  {
    name: "tool-name",
    description: "Tool description",
    schema: v.object({
      param: v.string(),
    }),
  },
  async ({ param }) => {
    return tool.text(`Received: ${param}`);
  },
);
```

## Available Tools

### 1. shadcnSvelteListTool

- **Purpose**: Lists all available shadcn-svelte components
- **Input**: None
- **Output**: Array of component metadata
- **Caching**: 3-day TTL

### 2. shadcnSvelteGetTool

- **Purpose**: Retrieves detailed documentation for a specific component
- **Input**: Component name
- **Output**: Installation instructions, usage examples, props
- **Caching**: 3-day TTL with real-time fallback

### 3. shadcnSvelteSearchTool

- **Purpose**: Concept-aware search across components, blocks, charts, docs, and Bits UI primitives, with typo tolerance
- **Input**: `query?` or `queries?` (multi-query), `type?`, `category?`, `limit?`, `packageManager?`
- **Output**: Ranked matches grouped by type, with category, description, install command, and the exact get call per match
- **Technology**: BM25 (@orama/orama, k1 1.2 / b 0.75) over a multi-field index (name/keywords/title/category/description), with per-field boost, a function-word filter on the query, and a sort key that keeps Bits UI primitives behind components

### 4. shadcnSvelteIconsTool

- **Purpose**: Lucide Svelte icon browsing and search
- **Input**: `query?`, `limit?`, `packageManager?`
- **Output**: Markdown list with icon names, tag summaries, and usage snippet for `@lucide/svelte`

## Web Scraping Architecture

The server uses multi-strategy web scraping to fetch documentation:

### Strategies

1. **Direct Markdown Fetching**
   - Fetches `.md` files directly from shadcn-svelte.com
   - Used for component documentation
   - Fastest and most reliable

2. **Crawlee + Playwright**
   - Browser automation for JavaScript-heavy pages
   - Used for charts, themes, and interactive content
   - Handles SPA routing and dynamic content

3. **Cheerio + Turndown**
   - HTML parsing fallback
   - Converts HTML to Markdown
   - Used when other strategies fail

### Caching Strategy

- **Memory Cache**: Fast in-memory LRU (50 entries) for hot docs
- **Disk Cache**: Persistent `.cache/` storage on Node/Bun (3-day TTL)
- **Cache Keys**: URL hash → `cache_<hash>.json`
- **Fallback**: Real-time fetching when cache misses

## Deployment Architecture

### Production Hosts

#### Hosted endpoint (primary)

- **URL**: `https://shadcnmcp.svelte-apps.me/mcp`
- **Protocol**: Streamable HTTP at `/mcp`; health check at
  `https://shadcnmcp.svelte-apps.me/health`
- **Characteristics**: Always-on hosted instance of the same `src/index.ts`
  (Node/Bun) entry; no SSE path — clients connect via the `http` transport

#### Fly.io

- **URL**: `https://shadcn-svelte-mcp.fly.dev/mcp`
- **Characteristics**: Long-running bun container (`Dockerfile`), 1-2s cold start
- **Config**: `fly.toml` with `/health` checks — deploy with `fly deploy`

#### Render

- **URL**: `https://shadcn-svelte-mcp.onrender.com/mcp`
- **Config**: `render.yaml` (bun build + start, `healthCheckPath: /health`)

### Cold Start Behavior

- **Fly.io / Render**: ~1-2 second cold start on first request
- **Mitigation**: Automatic retry logic in client implementations

## Client Integration Examples

### Remote (Streamable HTTP — Cursor, Claude, etc.)

```json
{
  "shadcn-svelte": {
    "type": "http",
    "url": "https://shadcnmcp.svelte-apps.me/mcp"
  }
}
```

### Local (STDIO — Claude Desktop, VS Code, Cursor)

```json
{
  "mcpServers": {
    "shadcn-svelte": {
      "command": "bun",
      "args": ["run", "src/stdio.ts"]
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add shadcn-svelte --url https://shadcnmcp.svelte-apps.me/mcp
```

## Error Handling

### Transport Errors

- **HTTP 5xx**: Server errors - retry with backoff
- **Connection timeouts**: SSE reconnection logic
- **Cold start failures**: Automatic retry (Railway only)

### Tool Errors

- **Component not found**: Graceful fallback with suggestions
- **Scraping failures**: Cached content fallback
- **Rate limiting**: Exponential backoff

## Performance Considerations

### Response Times

- **Cached content**: <100ms
- **Fresh scraping**: 1-3 seconds
- **Cold start (Railway)**: +1-2 seconds

### Scaling

- **Concurrent requests**: tmcp `HttpTransport` is stateless
- **Cache efficiency**: 3-day TTL reduces external API calls
- **Resource limits**: Configurable timeouts and rate limits

## Security

### Data Handling

- **No user data storage**: Stateless server
- **External API access**: Read-only web scraping
- **CORS policies**: Configured for allowed origins

### Authentication

- **Public access**: No authentication required
- **Rate limiting**: IP-based request throttling
- **Monitoring**: Request logging and metrics

## Development

### Local Setup

```bash
bun run dev  # Development server with watch on http://localhost:3000
bun run build  # Production bundle to dist/
bun run mcp  # STDIO transport for local MCP clients
```

### Testing

```bash
npm test  # Run test suite
npm run test:integration  # Integration tests
```

### Tool Development

1. Create tool in `src/mcp/tools/`
2. Use `defineTool` with Valibot schema
3. Register in `src/mcp/server.ts`
4. Test with MCP client

## Troubleshooting

### Common Issues

#### Tools not appearing in editor

- **Fly/Render**: Refresh the MCP connection; wait for cold start, retry if needed
- **Check**: Verify endpoint URLs are correct (`/mcp`)

#### Slow responses

- **Check**: Cache status and TTL
- **Mitigation**: Clear `.cache/` (local)

#### Connection failures

- **HTTP**: Check network connectivity
- **Retry**: Use an alternative host

### Debug Commands

```bash
# Health check
curl http://localhost:3000/health

# Test MCP endpoint
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Test with MCP Inspector
npx @modelcontextprotocol/inspector
```

## Contributing

When contributing MCP-related changes:

1. **Test both transports**: HTTP and STDIO
2. **Test all hosts**: Fly.io, Render
3. **Update documentation**: Keep this file current
4. **Follow patterns**: Use existing tool implementation patterns
5. **Add tests**: Cover new functionality

## Related Documentation

- [tmcp Documentation](https://tmcp.io)
- [MCP Specification](https://modelcontextprotocol.io)
- [shadcn-svelte Documentation](https://shadcn-svelte.com)
