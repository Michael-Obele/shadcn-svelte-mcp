import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { CloudflareDeployer } from "@mastra/deployer-cloudflare";
import { shadcn } from "./mastra/mcp-server";

// MCP Client is used directly in agents, not registered here
// See src/mastra/mcp-client.ts for usage examples

export const mastra = new Mastra({
  workflows: {},
  mcpServers: { shadcn },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  bundler: {
    externals: ["crawlee", "fuse.js"],
  },
  deployer: new CloudflareDeployer({
    name: "shadcn-svelte-mcp",
  }),
});
