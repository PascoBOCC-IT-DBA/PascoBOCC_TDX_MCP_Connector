import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerAllTools } from "./register-tools.js";
import { TOOL_ACCESS_MAP, getToolAccessLevel } from "./tool-access-config.js";
import type { TdxClient } from "./tdx-client.js";

/**
 * Tool names that perform a modification. Kept independent of TOOL_ACCESS_MAP so the
 * two can be cross-checked -- if they ever disagree, one of them is wrong.
 */
const WRITE_VERB = /-(create|update|patch|delete|add|remove|set)(-|$)/;

/**
 * Ask a real MCP client what tools the server exposes, rather than trusting a
 * hand-maintained list. Registration only reads app IDs off the client, so a stub
 * is enough -- no tool handler runs and no TDX call is made.
 */
async function listRegisteredToolNames(): Promise<string[]> {
  const server = new McpServer({ name: "tdx-mcp-test", version: "0.0.0" });
  registerAllTools(server, { appId: 1, assetsAppId: 2, kbAppId: 3 } as unknown as TdxClient);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "access-control-test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const { tools } = await client.listTools();
    return tools.map((tool) => tool.name).sort();
  } finally {
    await client.close();
    await server.close();
  }
}

let cachedToolNames: Promise<string[]> | null = null;

function registeredToolNames(): Promise<string[]> {
  cachedToolNames ??= listRegisteredToolNames();
  return cachedToolNames;
}

test("every registered tool has an explicit access level", async () => {
  const registered = await registeredToolNames();
  const unmapped = registered.filter((name) => !(name in TOOL_ACCESS_MAP));

  assert.deepEqual(
    unmapped,
    [],
    `Tools missing from TOOL_ACCESS_MAP. They fail closed as 'readwrite' and are hidden ` +
      `from read-only keys, so add them to src/tool-access-config.ts: ${unmapped.join(", ")}`
  );
});

test("access map has no entries for tools that no longer exist", async () => {
  const registered = new Set(await registeredToolNames());
  const stale = Object.keys(TOOL_ACCESS_MAP).filter((name) => !registered.has(name));

  assert.deepEqual(stale, [], `Stale TOOL_ACCESS_MAP entries: ${stale.join(", ")}`);
});

test("tools named for a write verb are classified readwrite", async () => {
  const registered = await registeredToolNames();
  const misclassified = registered.filter(
    (name) => WRITE_VERB.test(name) && getToolAccessLevel(name) !== "readwrite"
  );

  assert.deepEqual(
    misclassified,
    [],
    `These modify data but are reachable with a read-only key: ${misclassified.join(", ")}`
  );
});

test("tools not named for a write verb are classified readonly", async () => {
  const registered = await registeredToolNames();
  const misclassified = registered.filter(
    (name) => !WRITE_VERB.test(name) && getToolAccessLevel(name) !== "readonly"
  );

  assert.deepEqual(
    misclassified,
    [],
    `These look read-only but are hidden from read-only keys: ${misclassified.join(", ")}`
  );
});
