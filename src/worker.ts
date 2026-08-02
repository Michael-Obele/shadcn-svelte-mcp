/**
 * Cloudflare Worker entry point.
 *
 * Deploys the same MCP server over Streamable HTTP at `/mcp` using the
 * edge runtime. Sessions are persisted in Cloudflare KV (via tmcp's
 * `KVInfoSessionManager`) so stateless requests work across isolates,
 * and the documentation cache uses the same KV namespace.
 *
 * Requires the `TMCP_KV` KV namespace binding (see wrangler.jsonc):
 *   wrangler kv:namespace create TMCP_KV
 *
 * If the binding is missing, the server still runs — it degrades to
 * in-memory sessions and cache (fine for single-isolate dev).
 */

import { HttpTransport } from "@tmcp/transport-http";
import { KVInfoSessionManager } from "@tmcp/session-manager-durable-objects";
import { server } from "./mcp/server.js";
import { configureCache } from "./services/cache-manager.js";

const TRANSPORT_OPTIONS = { path: "/mcp" } as const;

let transport: HttpTransport | null = null;
let initialized = false;

function getTransport(env: Record<string, unknown>): HttpTransport {
  if (transport) return transport;

  // When the KV binding exists, persist session info (client capabilities,
  // client info, log levels) so any isolate can serve any session. Streams
  // stay in-memory — this server never emits notifications, so an SSE stream
  // manager is unnecessary.
  const sessionManager = env.TMCP_KV
    ? { info: new KVInfoSessionManager("TMCP_KV") }
    : undefined;

  transport = new HttpTransport(server, {
    ...TRANSPORT_OPTIONS,
    ...(sessionManager ? { sessionManager } : {}),
  });
  return transport;
}

export default {
  async fetch(
    request: Request,
    env: Record<string, unknown>,
  ): Promise<Response> {
    if (!initialized) {
      // Wire the cache to the same KV namespace when available
      configureCache({ kv: env.TMCP_KV as never });
      initialized = true;
    }

    const response = await getTransport(env).respond(request);
    if (response) return response;

    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "shadcn-svelte-mcp" });
    }
    return new Response(null, { status: 404 });
  },
};
