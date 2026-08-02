/**
 * Cloudflare Worker entry point.
 *
 * Deploys the same MCP server over Streamable HTTP at `/mcp` using the
 * edge runtime. Sessions are persisted in Cloudflare KV (via the tmcp
 * session manager) so stateless requests work across isolates.
 *
 * Requires the `TMCP_KV` KV namespace binding (see wrangler.jsonc):
 *   wrangler kv:namespace create TMCP_KV
 *
 * If the binding is missing, the server still runs — it degrades to
 * in-memory sessions (fine for single-isolate dev).
 */

import { HttpTransport } from "@tmcp/transport-http";
import { server } from "./mcp/server.js";
import { configureCache } from "./services/cache-manager.js";

const TRANSPORT_OPTIONS = { path: "/mcp" } as const;

let transport: HttpTransport | null = null;
let initialized = false;

function getTransport(): HttpTransport {
  if (transport) return transport;
  transport = new HttpTransport(server, TRANSPORT_OPTIONS);
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

    const response = await getTransport().respond(request);
    if (response) return response;

    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "shadcn-svelte-mcp" });
    }
    return new Response(null, { status: 404 });
  },
};
