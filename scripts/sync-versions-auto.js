#!/usr/bin/env node
/**
 * Auto-sync version script
 *
 * This script checks if package.json and mcp-server.ts versions match.
 * If they don't match, it automatically syncs mcp-server.ts to match package.json
 * (using package.json as the source of truth).
 *
 * Use this script when you want the build to continue even if versions are out of sync.
 * For strict checking that fails on mismatch, use check-versions.js instead.
 *
 * Usage:
 * - npm run sync-versions-auto (auto-sync and continue)
 * - npm run check-versions (strict check, fails on mismatch)
 * - npm run sync-versions (sync from git tags)
 */

import fs from "fs";
import path from "path";

const pkgPath = path.resolve(process.cwd(), "package.json");
const targetPath = path.resolve(process.cwd(), "src/mastra/mcp-server.ts");

if (!fs.existsSync(pkgPath)) {
  console.error("package.json not found");
  process.exit(1);
}
if (!fs.existsSync(targetPath)) {
  console.error("target file not found:", targetPath);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const packageVersion = pkg.version;

const code = fs.readFileSync(targetPath, "utf8");
const match = code.match(/version:\s*"([^"]+)"/);
if (!match) {
  console.error("Version not found in", targetPath);
  process.exit(1);
}
const codeVersion = match[1];

if (packageVersion !== codeVersion) {
  console.log(`🔄 Version mismatch detected:`);
  console.log(`   package.json: ${packageVersion}`);
  console.log(`   ${targetPath}: ${codeVersion}`);
  console.log(`🔧 Auto-syncing versions...`);

  // Use package.json as the source of truth (standard practice)
  const syncedCode = code.replace(/version:\s*"[^"]+",/, `version: "${packageVersion}",`);
  fs.writeFileSync(targetPath, syncedCode);

  console.log(`✅ Synced ${targetPath} to version ${packageVersion}`);
  console.log(`🎉 Versions are now synchronized!`);
} else {
  console.log(`✅ Versions match: ${packageVersion}`);
}