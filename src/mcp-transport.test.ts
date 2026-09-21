import test from "node:test";
import assert from "node:assert/strict";

import { McpTransport, RequestTimeoutError, type McpProcessLike } from "./mcp-transport.js";

type DataListener = (chunk: Buffer | string) => void;

class FakeProcess implements McpProcessLike {
  readonly written: string[] = [];
  private listeners: DataListener[] = [];
  writeError: Error | null = null;
  throwOnWrite: Error | null = null;

  constructor(public readonly pid = 1234, public killed = false) {}

  stdin = {
    write: (chunk: string, callback?: (err?: Error | null) => void) => {
      if (this.throwOnWrite) throw this.throwOnWrite;
      this.written.push(chunk);
      callback?.(this.writeError);
      return true;
    },
  };

  stdout = {
    on: (_event: "data", listener: DataListener) => {
      this.listeners.push(listener);
      return this.stdout;
    },
  };

  /** Number of stdout listeners attached, to detect leaks across restarts. */
  get listenerCount(): number {
    return this.listeners.length;
  }

  emit(text: string): void {
    for (const listener of [...this.listeners]) listener(text);
  }

  /** Echo a JSON-RPC reply for the Nth message this process received. */
  replyTo(index: number, result: unknown): void {
    const sent = JSON.parse(this.written[index]);
    this.emit(JSON.stringify({ jsonrpc: "2.0", id: sent.id, result }) + "\n");
  }

  sentId(index: number): unknown {
    return JSON.parse(this.written[index]).id;
  }
}

const quiet = { log: () => {} };

test("concurrent callers reusing the same client id get their own responses", async () => {
  const transport = new McpTransport(quiet);
  const proc = new FakeProcess();

  // Both callers pick id 1, which is what real MCP clients do.
  const first = transport.send(proc, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "a" } }, 5000);
  const second = transport.send(proc, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "b" } }, 5000);

  assert.equal(transport.pendingCount, 2, "both requests should be tracked separately");
  assert.notDeepEqual(proc.sentId(0), proc.sentId(1), "subprocess must see distinct ids");

  // Reply out of order to prove correlation is not positional.
  proc.replyTo(1, { who: "b" });
  proc.replyTo(0, { who: "a" });

  assert.deepEqual((await first).result, { who: "a" });
  assert.deepEqual((await second).result, { who: "b" });
  assert.equal(transport.pendingCount, 0);
});

test("the client's original id is restored on the response", async () => {
  const transport = new McpTransport(quiet);
  const proc = new FakeProcess();

  const pending = transport.send(proc, { jsonrpc: "2.0", id: 42, method: "tools/list" }, 5000);
  assert.notEqual(proc.sentId(0), 42, "internal id should not leak to the subprocess as the client's");

  proc.replyTo(0, { tools: [] });
  assert.equal((await pending).id, 42);
});

test("a string client id round-trips unchanged", async () => {
  const transport = new McpTransport(quiet);
  const proc = new FakeProcess();

  const pending = transport.send(proc, { jsonrpc: "2.0", id: "abc", method: "tools/list" }, 5000);
  proc.replyTo(0, { tools: [] });
  assert.equal((await pending).id, "abc");
});

test("a replacement subprocess gets its own stdout listener", async () => {
  const transport = new McpTransport(quiet);
  const first = new FakeProcess(1);

  transport.send(first, { jsonrpc: "2.0", id: 1, method: "tools/list" }, 5000).catch(() => {});
  assert.equal(first.listenerCount, 1);

  // Subprocess dies and is replaced without detach() ever being called.
  transport.failAllPending(new Error("process exited"));
  const replacement = new FakeProcess(2);

  const pending = transport.send(replacement, { jsonrpc: "2.0", id: 1, method: "tools/list" }, 5000);
  assert.equal(replacement.listenerCount, 1, "replacement must be listened to");

  replacement.replyTo(0, { tools: [{ name: "t" }] });
  assert.deepEqual((await pending).result, { tools: [{ name: "t" }] });
});

test("repeated sends to the same process attach only one listener", () => {
  const transport = new McpTransport(quiet);
  const proc = new FakeProcess();

  for (let i = 0; i < 5; i++) {
    transport.send(proc, { jsonrpc: "2.0", id: i, method: "tools/list" }, 5000).catch(() => {});
  }

  assert.equal(proc.listenerCount, 1);
});

test("a dead process's listener cannot resolve requests belonging to its replacement", async () => {
  const transport = new McpTransport(quiet);
  const dead = new FakeProcess(1);
  transport.send(dead, { jsonrpc: "2.0", id: 1, method: "tools/list" }, 5000).catch(() => {});
  transport.failAllPending(new Error("process exited"));

  const replacement = new FakeProcess(2);
  const pending = transport.send(replacement, { jsonrpc: "2.0", id: 7, method: "tools/list" }, 5000);

  // The old process emits a reply carrying the replacement's internal id.
  dead.emit(JSON.stringify({ jsonrpc: "2.0", id: replacement.sentId(0), result: { stale: true } }) + "\n");
  assert.equal(transport.pendingCount, 1, "stale listener must be ignored");

  replacement.replyTo(0, { fresh: true });
  assert.deepEqual((await pending).result, { fresh: true });
});

test("failAllPending rejects every in-flight request", async () => {
  const transport = new McpTransport(quiet);
  const proc = new FakeProcess();

  const requests = [1, 2, 3].map((id) =>
    transport.send(proc, { jsonrpc: "2.0", id, method: "tools/list" }, 5000)
  );

  transport.failAllPending(new Error("MCP process exited with code 1"));

  assert.equal(transport.pendingCount, 0);
  for (const request of requests) {
    await assert.rejects(request, /MCP process exited with code 1/);
  }
});

test("a timed-out request rejects and is removed from the pending map", async () => {
  const transport = new McpTransport(quiet);
  const proc = new FakeProcess();

  const pending = transport.send(proc, { jsonrpc: "2.0", id: 1, method: "tools/call" }, 5);
  await assert.rejects(pending, (err: Error) => {
    assert.ok(err instanceof RequestTimeoutError, "callers map this to 504");
    assert.equal(err.method, "tools/call");
    return true;
  });

  assert.equal(transport.pendingCount, 0, "timed-out entries must not leak");
});

test("a late reply after a timeout is discarded", async () => {
  const transport = new McpTransport(quiet);
  const proc = new FakeProcess();

  await assert.rejects(transport.send(proc, { jsonrpc: "2.0", id: 1, method: "tools/list" }, 5));
  proc.replyTo(0, { tools: [] }); // must not throw or resurrect the entry
  assert.equal(transport.pendingCount, 0);
});

test("a write error rejects the request immediately", async () => {
  const transport = new McpTransport(quiet);
  const proc = new FakeProcess();
  proc.writeError = new Error("EPIPE");

  await assert.rejects(
    transport.send(proc, { jsonrpc: "2.0", id: 1, method: "tools/list" }, 5000),
    /Failed to write to MCP: EPIPE/
  );
  assert.equal(transport.pendingCount, 0);
});

test("a throwing write rejects rather than escaping", async () => {
  const transport = new McpTransport(quiet);
  const proc = new FakeProcess();
  proc.throwOnWrite = new Error("stream destroyed");

  await assert.rejects(
    transport.send(proc, { jsonrpc: "2.0", id: 1, method: "tools/list" }, 5000),
    /Failed to write to MCP: stream destroyed/
  );
  assert.equal(transport.pendingCount, 0);
});

test("responses split across stdout chunks are reassembled", async () => {
  const transport = new McpTransport(quiet);
  const proc = new FakeProcess();

  const pending = transport.send(proc, { jsonrpc: "2.0", id: 1, method: "tools/list" }, 5000);
  const full = JSON.stringify({ jsonrpc: "2.0", id: proc.sentId(0), result: { tools: [] } }) + "\n";

  proc.emit(full.slice(0, 12));
  assert.equal(transport.pendingCount, 1, "partial line must not resolve anything");
  proc.emit(full.slice(12));

  assert.deepEqual((await pending).result, { tools: [] });
});

test("interleaved subprocess logging does not disturb correlation", async () => {
  const transport = new McpTransport(quiet);
  const proc = new FakeProcess();

  const pending = transport.send(proc, { jsonrpc: "2.0", id: 1, method: "tools/list" }, 5000);

  proc.emit("[MCP Server Ready]\n");
  proc.emit("{ not valid json\n");
  proc.replyTo(0, { tools: [] });

  assert.deepEqual((await pending).result, { tools: [] });
});

test("an unknown response id is ignored rather than throwing", () => {
  const transport = new McpTransport(quiet);
  const proc = new FakeProcess();

  transport.send(proc, { jsonrpc: "2.0", id: 1, method: "tools/list" }, 5000).catch(() => {});
  proc.emit(JSON.stringify({ jsonrpc: "2.0", id: "srv-never-issued", result: {} }) + "\n");

  assert.equal(transport.pendingCount, 1);
});
