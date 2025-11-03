import * as cheerio from "cheerio";

async function testFetch() {
  const url = "https://www.shadcn-svelte.com/charts";
  console.log(`\nFetching: ${url}`);

  const response = await fetch(url);
  console.log(`Status: ${response.status}`);
  console.log(`Final URL: ${response.url}`);

  const html = await response.text();
  const $ = cheerio.load(html);

  // Test different selectors
  console.log("\n=== Testing Selectors ===");

  // Current selector (main)
  console.log("\n1. Current selector - $('main').html().length:");
  const mainContent = $("main").html();
  console.log(mainContent?.length || 0);

  // Title
  console.log("\n2. Page title:");
  console.log($("title").text());

  // H1 text
  console.log("\n3. First H1:");
  console.log($("h1").first().text());

  // New selector - main sections
  console.log(
    "\n4. New selector - $('main > section, main > .container-wrapper'):"
  );
  const sections = $("main > section, main > .container-wrapper");
  console.log(`Found ${sections.length} sections`);
  sections.each((i, elem) => {
    const text = $(elem).text().substring(0, 100);
    console.log(`  Section ${i}: ${text}...`);
  });

  // Try more specific
  console.log("\n5. Hero section text:");
  const heroText = $("main > section").first().text().substring(0, 200);
  console.log(heroText);
}

testFetch().catch(console.error);
