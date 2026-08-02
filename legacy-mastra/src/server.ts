import { createServer } from "http";
import { shadcn } from "./mastra/mcp-server.js";

const server = createServer(async (req, res) => {
  // Add CORS headers for production
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    await shadcn.startHTTP({
      url: new URL(
        req.url || "",
        process.env.BASE_URL || "http://localhost:3000"
      ),
      httpPath: "/mcp",
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
  console.log(`Shadcn Svelte MCP Server running on port ${port}`);
  console.log(`MCP endpoint: http://localhost:${port}/mcp`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down MCP server...");
  await shadcn.close();
  server.close();
});
