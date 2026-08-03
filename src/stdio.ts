#!/usr/bin/env node

/**
 * STDIO entry point for local MCP clients (Claude Desktop, Cursor, etc.).
 *
 * Usage:
 *   bun run mcp
 *   or reference this file directly in your MCP client config:
 *     { "command": "bun", "args": ["run", "src/stdio.ts"] }
 */

import { StdioTransport } from "@tmcp/transport-stdio";
import { server } from "./mcp/server.js";

// The stdio transport owns stdout — it carries the JSON-RPC protocol.
// Any console.* output would corrupt the stream for MCP clients, so
// redirect all logging to stderr (visible in the client's logs but
// never mixed into the protocol).
console.log = (...args) => console.error("[log]", ...args);
console.info = (...args) => console.error("[info]", ...args);
console.debug = (...args) => console.error("[debug]", ...args);

const transport = new StdioTransport(server);
transport.listen();
