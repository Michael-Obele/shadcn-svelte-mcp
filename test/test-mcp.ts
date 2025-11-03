import { MCPClient } from "@mastra/mcp";

async function testMCPServer() {
  console.log("Testing Shadcn Svelte MCP Server...");

  const client = new MCPClient({
    servers: {
      "test-server": {
        url: new URL("http://localhost:3000/sse"),
      },
    },
  });

  try {
    // Get available tools
    const tools = await client.getTools();
    console.log("Available tools:", Object.keys(tools));

    // Test the shadcn-svelte-docs tool
    const result = await tools.shadcnSvelteDocsTool.execute({
      query: "button component",
    });

    console.log("Test result:");
    console.log(result);
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    // Clean up
    await client.disconnect();
  }
}

testMCPServer();
