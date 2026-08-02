import { createServer } from "http";
import { shadcn } from "./mastra/mcp-server.js";

const server = createServer(async (req, res) => {
  // Add CORS headers for development
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    await shadcn.startSSE({
      url: new URL(req.url || "", `http://localhost:3000`),
      ssePath: "/sse",
      messagePath: "/message",
      req,
      res,
    });
  } catch (error) {
    console.error("MCP Server error:", error);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Shadcn Svelte MCP Server running on http://localhost:${port}`);
  console.log(`SSE endpoint: http://localhost:${port}/sse`);
  console.log(`Message endpoint: http://localhost:${port}/message`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down MCP server...");
  await shadcn.close();
  server.close();
});
