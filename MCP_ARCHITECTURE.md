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

#### HTTP Transport

- **Endpoint**: `/api/mcp/shadcn/mcp`
- **Method**: HTTP POST
- **Use case**: One-off requests, CLI tools, simple integrations
- **Example**: `curl -X POST https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp`

#### Server-Sent Events (SSE) Transport

- **Endpoint**: `/api/mcp/shadcn/sse`
- **Protocol**: HTTP with SSE for bidirectional communication
- **Use case**: Long-lived connections, real-time updates, editor integrations
- **Example**: Persistent connection for editor plugins

## Architecture

### Core Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AI Editor     │────│   MCP Transport  │────│  MCP Server     │
│   (Client)      │    │   (HTTP/SSE)     │    │  (This Project) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                       │
                                               ┌───────┴───────┐
                                               │   Mastra      │
                                               │   Framework   │
                                               └───────┬───────┘
                                                       │
                                               ┌───────┴───────┐
                                               │   Tools       │
                                               │   (4 total)   │
                                               └───────────────┘
```

### Mastra Framework Integration

The server is built using the [Mastra](https://mastra.ai) framework, which provides:

- **Agent orchestration**: Manages AI agent workflows
- **Tool registration**: Exposes tools to MCP clients
- **MCP protocol handling**: Manages HTTP/SSE transport
- **Configuration management**: Environment and deployment settings

### Tool Implementation

Tools are implemented using Mastra's `createTool` function with Zod schemas:

```typescript
export const myTool = createTool({
  id: "tool-name",
  description: "Tool description",
  inputSchema: z.object({
    param: z.string(),
  }),
  execute: async ({ context }) => {
    // Tool implementation
    return result;
  },
});
```

## Available Tools

### 1. shadcnSvelteListTool

- **Purpose**: Lists all available shadcn-svelte components
- **Input**: None
- **Output**: Array of component metadata
- **Caching**: 24-hour TTL

### 2. shadcnSvelteGetTool

- **Purpose**: Retrieves detailed documentation for a specific component
- **Input**: Component name
- **Output**: Installation instructions, usage examples, props
- **Caching**: 24-hour TTL with real-time fallback

### 3. shadcnSvelteSearchTool

- **Purpose**: Fuzzy search across components with typo tolerance
- **Input**: Search query
- **Output**: Ranked list of matching components
- **Technology**: Fuse.js for fuzzy matching

### 4. shadcnSvelteUtilityTool

- **Purpose**: Installation guides, theming, CLI help, icon search
- **Input**: Action type and parameters
- **Output**: Context-specific help and utilities

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

- **Memory Cache**: Fast in-memory storage for active sessions
- **Disk Cache**: Persistent storage with 24-hour TTL
- **Cache Keys**: URL + content hash for invalidation
- **Fallback**: Real-time fetching when cache misses

## Deployment Architecture

### Production Hosts

#### Mastra Cloud (Primary)

- **URL**: `https://shadcn-svelte.mastra.cloud`
- **Characteristics**: Zero cold start, high responsiveness
- **Limitation**: Occasional tool visibility issues (4 tools may hide)
- **Use case**: Fastest response times, acceptable tool visibility quirks

#### Railway (Fallback)

- **URL**: `https://shadcn-svelte-mcp.up.railway.app`
- **Characteristics**: Split-second cold start, consistent tool visibility
- **Limitation**: Initial request may fail and need retry
- **Use case**: Guaranteed tool access, reliable fallbacks

### Cold Start Behavior

- **Mastra Cloud**: No cold start - always warm
- **Railway**: ~1-2 second cold start on first request
- **Mitigation**: Automatic retry logic in client implementations

## Client Integration Examples

### Cursor (HTTP Transport)

```json
{
  "shadcn-svelte": {
    "type": "http",
    "url": "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp"
  }
}
```

### VS Code (SSE Transport)

```json
{
  "shadcn-svelte": {
    "type": "sse",
    "url": "https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse"
  }
}
```

### Claude Code CLI

```bash
claude mcp add shadcn-svelte --url https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp
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

- **Concurrent requests**: Mastra framework handles load balancing
- **Cache efficiency**: 24-hour TTL reduces external API calls
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
npm run dev  # Development server with hot reload
npm run build  # Production build
npm run start  # Production server
```

### Testing

```bash
npm test  # Run test suite
npm run test:integration  # Integration tests
```

### Tool Development

1. Create tool in `src/mastra/tools/`
2. Use `createTool` with Zod schema
3. Register in `src/mastra/index.ts`
4. Test with MCP client

## Troubleshooting

### Common Issues

#### Tools not appearing in editor

- **Mastra Cloud**: Refresh the MCP connection
- **Railway**: Wait for cold start, retry if needed
- **Check**: Verify endpoint URLs are correct

#### Slow responses

- **Check**: Cache status and TTL
- **Mitigation**: Clear cache or use alternative host

#### Connection failures

- **HTTP**: Check network connectivity
- **SSE**: Verify WebSocket support
- **Retry**: Use alternative transport or host

### Debug Commands

```bash
# Test HTTP endpoint
curl -I https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp

# Test SSE endpoint
curl -N https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/sse

# Test with MCP client
npx mcp-remote https://shadcn-svelte.mastra.cloud/api/mcp/shadcn/mcp
```

## Contributing

When contributing MCP-related changes:

1. **Test both transports**: HTTP and SSE
2. **Test both hosts**: Mastra Cloud and Railway
3. **Update documentation**: Keep this file current
4. **Follow patterns**: Use existing tool implementation patterns
5. **Add tests**: Cover new functionality

## Related Documentation

- [Mastra Framework Documentation](https://mastra.ai)
- [MCP Specification](https://modelcontextprotocol.io)
- [shadcn-svelte Documentation](https://shadcn-svelte.com)
