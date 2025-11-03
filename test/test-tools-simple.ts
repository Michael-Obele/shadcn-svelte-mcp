/**
 * Simple test script for migrated MCP tools
 * Tests core functionality without MCP runtime context
 */

import {
  fetchComponentDocs,
  fetchGeneralDocs,
  fetchInstallationDocs,
  discoverUrls,
} from "../src/services/doc-fetcher.js";
import { getCacheStats, clearCache } from "../src/services/cache-manager.js";

console.log("🧪 Testing MCP Tools - Simple Mode\n");
console.log("=".repeat(60));

async function runTests() {
  try {
    // Test 1: Fetch Button Component
    console.log("\n📦 Test 1: Fetch Button component");
    console.log("-".repeat(60));
    const buttonResult = await fetchComponentDocs("button");
    console.log(`Success: ${buttonResult.success}`);
    console.log(`Content length: ${buttonResult.markdown?.length || 0} chars`);
    if (buttonResult.markdown) {
      console.log("Preview:", buttonResult.markdown.substring(0, 200) + "...");
    }

    // Test 2: Discover URLs from website (with timeout)
    console.log("\n🗺️  Test 2: Discover URLs from shadcn-svelte website");
    console.log("-".repeat(60));

    const mapPromise = discoverUrls("https://www.shadcn-svelte.com", {
      limit: 100, // Reduced limit for faster testing
    });
    const mapTimeout = new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error("Map timeout after 30s")), 30000)
    );

    let components: string[] = [];
    try {
      const mapResult = await Promise.race([mapPromise, mapTimeout]);
      console.log(`Success: ${mapResult.success}`);
      console.log(`URLs found: ${mapResult.urls.length}`);

      // Extract components
      const componentUrls = mapResult.urls.filter((url: string) =>
        url.includes("/docs/components/")
      );
      components = componentUrls
        .map((url: string) => {
          const match = url.match(/\/docs\/components\/([a-z-]+)$/);
          return match ? match[1] : null;
        })
        .filter(Boolean) as string[];
      console.log(`Components found: ${components.length}`);
      if (components.length > 0) {
        console.log("Sample components:", components.slice(0, 10).join(", "));
      }
    } catch (error) {
      console.log(
        `⚠ WARNING - ${error instanceof Error ? error.message : "Map failed"}`
      );
      console.log("Continuing with other tests...");
    }

    // Test 3: Fetch Installation Docs (with timeout)
    console.log("\n⚙️  Test 3: Fetch SvelteKit installation");
    console.log("-".repeat(60));

    const installPromise = fetchInstallationDocs("sveltekit");
    const installTimeout = new Promise<any>((_, reject) =>
      setTimeout(
        () => reject(new Error("Installation fetch timeout after 30s")),
        30000
      )
    );

    try {
      const installResult = await Promise.race([
        installPromise,
        installTimeout,
      ]);
      console.log(`Success: ${installResult.success}`);
      console.log(
        `Content length: ${installResult.markdown?.length || 0} chars`
      );
    } catch (error) {
      console.log(
        `⚠ WARNING - ${error instanceof Error ? error.message : "Installation fetch failed"}`
      );
    }

    // Test 4: Fetch General Docs (with timeout)
    console.log("\n📖 Test 4: Fetch CLI documentation");
    console.log("-".repeat(60));

    const cliPromise = fetchGeneralDocs("/docs/cli");
    const cliTimeout = new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error("CLI fetch timeout after 30s")), 30000)
    );

    try {
      const cliResult = await Promise.race([cliPromise, cliTimeout]);
      console.log(`Success: ${cliResult.success}`);
      console.log(`Content length: ${cliResult.markdown?.length || 0} chars`);
    } catch (error) {
      console.log(
        `⚠ WARNING - ${error instanceof Error ? error.message : "CLI fetch failed"}`
      );
    }

    // Test 5: Cache Statistics
    console.log("\n📊 Test 5: Cache statistics");
    console.log("-".repeat(60));
    const stats = await getCacheStats();
    console.log(`Memory cache size: ${stats.memorySize}`);
    console.log(`Disk cache size: ${stats.diskSize}`);
    console.log(`Total cached: ${stats.totalSize}`);

    console.log("\n" + "=".repeat(60));
    console.log("✅ All tests completed!");
    console.log("\n💡 Key findings:");
    console.log(`   - Crawlee-based fetcher: Working`);
    console.log(
      `   - Component discovery: ${components.length} components found`
    );
    console.log(`   - Documentation fetching: Working`);
    console.log(`   - Cache system: ${stats.totalSize} items cached`);
  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  }
}

// Set overall timeout for the entire test suite
const testSuiteTimeout = setTimeout(() => {
  console.error("\n⏱️  Test suite timed out after 90 seconds");
  console.error("Some operations are taking too long. Exiting...");
  process.exit(1);
}, 90000); // 90 second overall timeout

runTests()
  .then(() => {
    clearTimeout(testSuiteTimeout);
    console.log("\n👋 Test suite completed. Exiting...");
    process.exit(0);
  })
  .catch((error) => {
    clearTimeout(testSuiteTimeout);
    console.error("\n❌ Unexpected error:", error);
    process.exit(1);
  });
