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

const transport = new StdioTransport(server);
transport.listen();
