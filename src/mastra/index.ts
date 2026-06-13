import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { shadcnSvelteAgent } from "./agents/shadcn-svelte-agent";
import { shadcn } from "./mcp-server";

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
  bundler: {
    externals: ["crawlee", "fuse.js"],
  },
});
