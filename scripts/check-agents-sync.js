#!/usr/bin/env node
/**
 * Agent body sync check
 *
 * The per-editor agent files in `agents/` are one agent body stamped with five
 * different frontmatters. Nothing in the toolchain enforced that, so the copies
 * silently drifted. This script verifies rather than generates: it strips the
 * frontmatter off every packaged agent, normalizes line endings and trailing
 * whitespace, and requires each body to be byte-identical to the canonical one.
 *
 * Deliberate variants are declared in EXEMPT_VARIANTS with a reason. A new file
 * that is neither frontmatter-carrying nor exempt is a hard failure, so adding
 * an editor can never be a silent third copy.
 *
 * Usage:
 * - bun run check:agents (or node scripts/check-agents-sync.js) — exits 1 on drift
 */

import fs from "fs";
import path from "path";

const agentsDir = path.resolve(process.cwd(), "agents");

/** The body every packaged frontmatter agent must match. */
const CANONICAL = "claude-shadcn-svelte.md";

/** Documentation in the folder, not a packaged agent. */
const NOT_AGENTS = new Set(["README.md"]);

/** Files that intentionally do NOT share the canonical body, and why. */
const EXEMPT_VARIANTS = new Map([
  [
    "agents-md-snippet.md",
    "deliberate task-scoped AGENTS.md section (### headings, no frontmatter) — not a packaged frontmatter agent",
  ],
]);

if (!fs.existsSync(agentsDir)) {
  console.error("agents/ directory not found:", agentsDir);
  process.exit(1);
}

/**
 * Strip a leading YAML frontmatter block, if there is one.
 *
 * The block ends at the FIRST line that is exactly `---`, so a `---` that
 * appears inside the body is left alone.
 */
function splitFrontmatter(raw) {
  const text = raw.replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return { frontmatter: null, body: text };

  const close = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  if (close === -1) return { frontmatter: null, body: text };

  return {
    frontmatter: lines.slice(1, close).join("\n"),
    body: lines.slice(close + 1).join("\n"),
  };
}

/** CRLF -> LF, strip trailing whitespace per line, drop trailing blank lines. */
function normalize(body) {
  return body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

/** Longest-common-subsequence table, used to render a minimal diff. */
function lcsTable(a, b) {
  const table = Array.from(
    { length: a.length + 1 },
    () => new Uint32Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

/** Render a unified diff of the body against the canonical body. */
function diffBody(expectedLines, actualFile, actualLines) {
  const table = lcsTable(expectedLines, actualLines);
  const out = [`--- agents/${CANONICAL}`, `+++ agents/${actualFile}`];
  let i = 0;
  let j = 0;
  while (i < expectedLines.length && j < actualLines.length) {
    if (expectedLines[i] === actualLines[j]) {
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      out.push(`-${expectedLines[i]}`);
      i++;
    } else {
      out.push(`+${actualLines[j]}`);
      j++;
    }
  }
  while (i < expectedLines.length) out.push(`-${expectedLines[i++]}`);
  while (j < actualLines.length) out.push(`+${actualLines[j++]}`);
  return out.join("\n");
}

const files = fs
  .readdirSync(agentsDir)
  .filter((name) => /\.(md|mdc)$/.test(name))
  .sort();

if (!files.includes(CANONICAL)) {
  console.error(`Canonical agent body not found: agents/${CANONICAL}`);
  process.exit(1);
}

const { frontmatter: canonicalFrontmatter, body: canonicalBody } =
  splitFrontmatter(fs.readFileSync(path.join(agentsDir, CANONICAL), "utf8"));

if (canonicalFrontmatter === null) {
  console.error(
    `Canonical agent agents/${CANONICAL} has no frontmatter block.`,
  );
  process.exit(1);
}

const expected = normalize(canonicalBody).split("\n");
const checked = [];
const exempted = [];
const drifted = [];

for (const file of files) {
  if (NOT_AGENTS.has(file)) continue;

  const { frontmatter, body } = splitFrontmatter(
    fs.readFileSync(path.join(agentsDir, file), "utf8"),
  );

  if (frontmatter === null) {
    const reason = EXEMPT_VARIANTS.get(file);
    if (reason) {
      exempted.push(`  agents/${file} — exempt: ${reason}`);
      continue;
    }
    console.error(
      `Agent drift: agents/${file} has no frontmatter block and is not a declared variant.\n` +
        `  Either give it a frontmatter block (it will then be diffed against ${CANONICAL}),\n` +
        `  or record it in EXEMPT_VARIANTS in scripts/check-agents-sync.js with a reason.`,
    );
    process.exit(1);
  }

  if (file === CANONICAL) {
    checked.push(`  agents/${file} — canonical`);
    continue;
  }

  const actualLines = normalize(body).split("\n");
  if (actualLines.join("\n") !== expected.join("\n")) {
    drifted.push({ file, lines: actualLines });
    continue;
  }

  checked.push(`  agents/${file} — in sync`);
}

if (drifted.length > 0) {
  console.error(
    `Agent body drift: ${drifted.length} file(s) no longer match agents/${CANONICAL}.\n` +
      `Edit the canonical body, then copy it into every packaged agent (frontmatter may differ).\n`,
  );
  for (const { file, lines } of drifted) {
    console.error(`\n${diffBody(expected, file, lines)}\n`);
  }
  process.exit(1);
}

console.log(`Agent bodies in sync with agents/${CANONICAL}:`);
for (const line of checked) console.log(line);
for (const line of exempted) console.log(line);
