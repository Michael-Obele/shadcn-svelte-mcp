#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Get version from command line argument (semantic release), environment variable, or git tag
let version;
if (process.argv[2]) {
  // Use version from semantic release command line argument
  version = process.argv[2];
  console.log(`Using semantic release version: ${version}`);
} else if (process.env.NEXT_RELEASE_VERSION) {
  // Use version from semantic release environment variable
  version = process.env.NEXT_RELEASE_VERSION;
  console.log(`Using semantic release version: ${version}`);
} else {
  // Fallback to git tag (for manual runs)
  const latestTag = execSync("git tag --sort=-version:refname | head -1", {
    encoding: "utf8",
  }).trim();
  version = latestTag.startsWith("v") ? latestTag.slice(1) : latestTag;
  console.log(`Latest tag: ${latestTag}, version: ${version}`);
}

// Update package.json
const pkgPath = path.resolve(process.cwd(), "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`Updated ${pkgPath} to ${version}`);

// Update mcp-server.ts
const targetPath = path.resolve(process.cwd(), "src/mastra/mcp-server.ts");
let code = fs.readFileSync(targetPath, "utf8");
code = code.replace(/version:\s*"[^"]+",/, `version: "${version}",`);
fs.writeFileSync(targetPath, code);
console.log(`Updated ${targetPath} to ${version}`);

// Run version check
execSync("node scripts/check-versions.js", { stdio: "inherit" });
