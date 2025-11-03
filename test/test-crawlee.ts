/**
 * Test script for Crawlee-based documentation fetching
 * Tests connection and basic functionality with the multi-strategy fetcher
 */

import {
  testConnection,
  fetchComponentDocs,
  discoverUrls,
  config,
} from "../src/services/doc-fetcher.js";
import { getCacheStats, clearCache } from "../src/services/cache-manager.js";

async function main() {
  console.log("=".repeat(60));
  console.log("Testing Crawlee-Based Documentation Fetcher");
  console.log("=".repeat(60));
  console.log(`\nConfiguration:`);
  console.log(`  Base URL: ${config.SHADCN_BASE_URL}`);
  console.log(`  Fetch Timeout: ${config.FETCH_TIMEOUT}ms`);
  console.log();

  // Test 1: Connection
  console.log("Test 1: Testing connection...");
  const connectionResult = await testConnection();
  console.log(
    `  Status: ${connectionResult.success ? "✓ SUCCESS" : "✗ FAILED"}`
  );
  console.log(`  Message: ${connectionResult.message}`);
  console.log();

  if (!connectionResult.success) {
    console.error("Connection failed. Please check:");
    console.error("  1. Network connectivity");
    console.error("  2. shadcn-svelte.com is accessible");
    console.error("  3. No firewall or proxy issues");
    process.exit(1);
  }

  // Test 2: Fetch component documentation
  console.log("Test 2: Fetching Button component documentation...");
  const buttonDocs = await fetchComponentDocs("button");
  console.log(`  Status: ${buttonDocs.success ? "✓ SUCCESS" : "✗ FAILED"}`);
  if (buttonDocs.success) {
    const previewLength = 200;
    const preview =
      buttonDocs.markdown?.slice(0, previewLength) || "No content";
    console.log(`  Preview: ${preview}...`);
    console.log(
      `  Total length: ${buttonDocs.markdown?.length || 0} characters`
    );
  } else {
    console.log(`  Error: ${buttonDocs.error}`);
  }
  console.log();

  // Test 3: Discover URLs from website
  console.log("Test 3: Discovering URLs from website...");
  const discoverResult = await discoverUrls(config.SHADCN_BASE_URL, {
    search: "components",
    limit: 20,
  });
  console.log(`  Status: ${discoverResult.success ? "✓ SUCCESS" : "✗ FAILED"}`);
  if (discoverResult.success) {
    console.log(`  Found ${discoverResult.urls.length} URLs`);
    const componentUrls = discoverResult.urls.filter((url: string) =>
      url.includes("/components/")
    );
    console.log(`  Component URLs: ${componentUrls.length}`);
    if (componentUrls.length > 0) {
      console.log(`  Sample URLs:`);
      componentUrls.slice(0, 5).forEach((url: string) => {
        console.log(`    - ${url}`);
      });
    }
  } else {
    console.log(`  Error: ${discoverResult.error}`);
  }
  console.log();

  // Test 4: Cache statistics
  console.log("Test 4: Cache statistics...");
  const stats = await getCacheStats();
  console.log(`  Memory cache: ${stats.memorySize} entries`);
  console.log(`  Disk cache: ${stats.diskSize} entries`);
  console.log();

  console.log("=".repeat(60));
  console.log("All tests completed!");
  console.log("=".repeat(60));
  console.log("\nNext steps:");
  console.log("  1. Review the test results above");
  console.log("  2. If successful, the MCP tools are ready to use");
  console.log("  3. Run: bun run mcp:dev to test the MCP server");
  console.log("  4. Run: bun run dev to start the full Mastra dev environment");
  console.log();
}

main().catch(console.error);
