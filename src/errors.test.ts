import { test } from "node:test";
import assert from "node:assert/strict";
import { TdxApiError, ToolSafeError, redactSecrets, toToolError } from "./errors.js";
import { TdxRateLimitError } from "./tdx-rate-limit.js";

/**
 * toToolError() is the only thing standing between a TDX response body and an MCP client,
 * so these tests are mostly about what does NOT come back.
 */

/** Runs fn with console.error captured, returning what it logged. */
function captureStderr<T>(fn: () => T): { result: T; logged: string } {
  const original = console.error;
  const lines: string[] = [];
  console.error = (...args: unknown[]) => { lines.push(args.map(String).join(" ")); };
  try {
    return { result: fn(), logged: lines.join("\n") };
  } finally {
    console.error = original;
  }
}

function textOf(result: { content: { text: string }[] }): string {
  return result.content[0].text;
}

test("a TDX error body never reaches the caller but is logged", () => {
  const body = '{"Message":"Object reference not set","StackTrace":"TDX.Internal.Secret"}';
  const { result, logged } = captureStderr(() =>
    toToolError(new TdxApiError(500, "POST", "/1/tickets", body))
  );

  assert.equal(result.isError, true);
  assert.ok(!textOf(result).includes("StackTrace"), "stack trace leaked to caller");
  assert.ok(!textOf(result).includes("Object reference"), "upstream message leaked to caller");
  assert.match(textOf(result), /TDX API error 500 on POST \/1\/tickets/);
  assert.ok(logged.includes(body), "body should still be available server-side");
});

test("the correlation id in the message matches the one in the log", () => {
  const { result, logged } = captureStderr(() => toToolError(new Error("boom")));
  const ref = /ref ([0-9a-f]{8})/.exec(textOf(result))?.[1];
  assert.ok(ref, `no correlation id in ${textOf(result)}`);
  assert.ok(logged.includes(`[ToolError ${ref}]`));
});

test("an unrecognised error is replaced with a generic message", () => {
  const { result } = captureStderr(() =>
    toToolError(new Error("connect ECONNREFUSED 10.1.2.3:443"))
  );
  assert.ok(!textOf(result).includes("ECONNREFUSED"));
  assert.ok(!textOf(result).includes("10.1.2.3"));
  assert.match(textOf(result), /could not be completed/);
});

test("an error this server authored keeps its message", () => {
  const { result } = captureStderr(() =>
    toToolError(new ToolSafeError("appId 99 is not a configured TDX application for this server."))
  );
  assert.match(textOf(result), /appId 99 is not a configured TDX application/);
});

test("throttling stays distinguishable from a failure", () => {
  const { result } = captureStderr(() =>
    toToolError(new TdxRateLimitError("throttled", "GET", "/1/tickets/1", 4, {}))
  );
  assert.match(textOf(result), /throttled GET \/1\/tickets\/1 after 4 attempts/);
});

test("a non-Error throw is still handled", () => {
  const { result } = captureStderr(() => toToolError("a bare string"));
  assert.equal(result.isError, true);
  assert.ok(!textOf(result).includes("a bare string"));
});

test("redactSecrets masks configured credentials", () => {
  const key = "super-secret-web-services-key";
  const masked = redactSecrets(`rejected key ${key} for BEID abcd-1234-efgh`, [key, "abcd-1234-efgh"]);
  assert.ok(!masked.includes(key));
  assert.ok(!masked.includes("abcd-1234-efgh"));
  assert.equal(masked, "rejected key [redacted] for BEID [redacted]");
});

test("redactSecrets ignores short or missing values so it cannot blank out normal text", () => {
  assert.equal(redactSecrets("no change here", [undefined, "", "abc"]), "no change here");
});
