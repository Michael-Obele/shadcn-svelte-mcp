#!/usr/bin/env bun
/**
 * Handshake smoke test.
 *
 * Spawns the real stdio entry point as a subprocess and speaks the actual MCP
 * protocol to it over stdio (newline-delimited JSON-RPC, per the MCP stdio
 * transport). This is the contract local MCP clients depend on: `initialize`
 * then `tools/list`.
 *
 * Deliberately network-free — `initialize` and `tools/list` are served from
 * static registrations, so this test cannot be made flaky by shadcn-svelte.com
 * being slow or down. The live scraping path is exercised by the `#test-mcp`
 * channel, not here.
 */

import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const pkg = JSON.parse(
  readFileSync(path.join(import.meta.dir, "..", "package.json"), "utf8"),
) as { version: string };

/** The tools the server is contracted to expose. */
const EXPECTED_TOOLS = [
  "bits-ui-get",
  "shadcn-svelte-get",
  "shadcn-svelte-icons",
  "shadcn-svelte-list",
  "shadcn-svelte-search",
];

type JsonRpcResponse = {
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

const child = spawn(
  "bun",
  ["run", path.join(import.meta.dir, "..", "src", "stdio.ts")],
  {
    stdio: ["pipe", "pipe", "pipe"],
  },
);

let buffer = "";
const pending = new Map<number, (response: JsonRpcResponse) => void>();

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk: string) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line) as JsonRpcResponse;
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message);
    }
  }
});

/** Send a request and await its response, rejecting on transport errors. */
function request(
  method: string,
  id: number,
  params: Record<string, unknown> = {},
) {
  return new Promise<JsonRpcResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timed out waiting for ${method}`));
    }, 15_000);

    pending.set(id, (response) => {
      clearTimeout(timer);
      resolve(response);
    });

    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
    );
  });
}

/** Fire-and-forget notification (no id, so no response is expected). */
function notify(method: string, params: Record<string, unknown> = {}) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
}

let initResult: Record<string, unknown>;

beforeAll(async () => {
  const response = await request("initialize", 1, {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "0.0.0" },
  });

  expect(response.error).toBeUndefined();
  initResult = response.result ?? {};
  notify("notifications/initialized");
});

afterAll(() => {
  child.stdin.end();
  child.kill();
});

test("initialize returns server info and tool capability", () => {
  const serverInfo = initResult.serverInfo as { name: string; version: string };
  expect(serverInfo.name).toBe("Shadcn Svelte Docs");
  // The advertised version is a real contract: it is what `check-versions`
  // anchors, and what a client sees in its server list.
  expect(serverInfo.version).toBe(pkg.version);
  expect(initResult.capabilities).toHaveProperty("tools");
});

test("tools/list exposes exactly the contracted tool set", async () => {
  const response = await request("tools/list", 2);
  expect(response.error).toBeUndefined();

  const tools = (response.result?.tools ?? []) as { name: string }[];
  expect(tools.map((tool) => tool.name).sort()).toEqual(EXPECTED_TOOLS);
});
