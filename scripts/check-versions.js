#!/usr/bin/env node
/**
 * Version check script
 *
 * This script checks if package.json and mcp-server.ts versions match.
 * If they don't match, it fails with an error (exit code 1).
 *
 * Use this script when you want strict version checking that fails on mismatch.
 * For auto-syncing versions, use sync-versions-auto.js instead.
 *
 * Usage:
 * - npm run check-versions (strict check, fails on mismatch)
 * - npm run sync-versions-auto (auto-sync and continue)
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
  console.error(
    `Version mismatch: package.json has ${packageVersion}, ${targetPath} has ${codeVersion}`
  );
  process.exit(1);
}

console.log(`Versions match: ${packageVersion}`);
