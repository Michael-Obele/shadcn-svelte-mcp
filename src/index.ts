#!/usr/bin/env node

/**
 * HTTP entry point (Node & Bun) — deploy on Fly.io, Render, or any
 * long-running JS host. Serves the MCP server over Streamable HTTP at
 * `/mcp`, plus a `/health` endpoint for load balancers.
 *
 * Port: `PORT` env var (default 3000)
 */

import { serve } from "srvx";
import { HttpTransport } from "@tmcp/transport-http";
import { server } from "./mcp/server.js";
import { initializeCache, getCacheStats } from "./services/cache-manager.js";

const port = Number(process.env.PORT) || 3000;

// Best-effort disk cache setup — never blocks startup
await initializeCache();

const transport = new HttpTransport(server, { path: "/mcp" });

serve({
  port,
  fetch(request: Request) {
    return (async () => {
      const response = await transport.respond(request);
      if (response) return response;

      const url = new URL(request.url);
      if (url.pathname === "/health") {
        return Response.json({
          status: "ok",
          service: "shadcn-svelte-mcp",
          cache: await getCacheStats(),
        });
      }
      return new Response(null, { status: 404 });
    })();
  },
});

console.log(`Shadcn Svelte MCP server listening on port ${port}`);
console.log(`MCP endpoint: http://localhost:${port}/mcp`);
console.log(`Health check: http://localhost:${port}/health`);
