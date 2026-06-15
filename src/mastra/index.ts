import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { CloudflareDeployer } from "@mastra/deployer-cloudflare";
import { shadcn } from "./mcp-server";

export const mastra = new Mastra({
  workflows: {},
  mcpServers: { shadcn },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  bundler: {
    externals: ["fuse.js"],
  },
  deployer: new CloudflareDeployer({
    name: "shadcn-svelte-mcp",
  }),
});
