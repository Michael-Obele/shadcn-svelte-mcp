import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { shadcnSvelteAgent } from "./mastra/agents/shadcn-svelte-agent";
import { shadcn } from "./mastra/mcp-server";

// MCP Client is used directly in agents, not registered here
// See src/mastra/mcp-client.ts for usage examples

export const mastra = new Mastra({
  workflows: {},
  agents: { shadcnSvelteAgent },
  mcpServers: { shadcn },
  storage: new LibSQLStore({
    id: "mastra",
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  telemetry: {
    enabled: false,
  },
  bundler: {
    externals: ["crawlee", "fuse.js"],
  },
});
