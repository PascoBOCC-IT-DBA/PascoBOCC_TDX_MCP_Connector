import { test } from "node:test";
import assert from "node:assert/strict";

import { TdxConfig } from "./config.js";
import { TdxClient } from "./tdx-client.js";
import { TdxRateLimitError } from "./tdx-rate-limit.js";

const config: TdxConfig = {
  baseUrl: "https://tdx.example.test/TDWebApi/api",
  beid: "beid",
  webServicesKey: "key",
  appId: 1,
};

interface Scripted {
  status: number;
  body?: string;
  headers?: Record<string, string>;
}

/**
 * Replaces global fetch for the duration of fn. TdxAuth uses global fetch too, so the auth
 * call is answered here as well and only the scripted responses reach the client under test.
 */
async function withFetch(
  script: Scripted[],
  fn: (calls: { count: number }) => Promise<void>
): Promise<void> {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const calls = { count: 0 };

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/auth/loginadmin")) {
      return new Response("token", { status: 200 });
    }
    const next = script[Math.min(calls.count, script.length - 1)];
    calls.count++;
    return new Response(next.body ?? "", { status: next.status, headers: next.headers });
  }) as typeof fetch;
  console.error = () => {};

  try {
    await fn(calls);
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
  }
}

function throttled(resetAt: number): Scripted {
  return {
    status: 429,
    body: "Rate limit exceeded",
    headers: {
      "X-RateLimit-Limit": "30",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": new Date(resetAt).toUTCString(),
    },
  };
}

test("a throttled request is retried after TDX's reset time and then succeeds", async () => {
  const waits: number[] = [];
  const client = new TdxClient(config, { sleep: async (ms) => void waits.push(ms) });

  await withFetch(
    [throttled(Date.now() + 12_000), { status: 200, body: '[{"ID":1}]' }],
    async (calls) => {
      const result = await client.post("/1/tickets/search", {});

      assert.deepEqual(result, [{ ID: 1 }]);
      assert.equal(calls.count, 2, "the call should have been replayed once");
      assert.equal(waits.length, 1);
      // RFC 1123 has whole-second precision, so the wait lands just under the 12s target.
      assert.ok(
        waits[0] > 10_500 && waits[0] <= 12_000,
        `expected a wait near the advertised reset, got ${waits[0]}ms`
      );
    }
  );
});

test("sustained throttling fails with a typed error once the retries run out", async () => {
  const client = new TdxClient(config, {
    maxRateLimitRetries: 2,
    sleep: async () => {},
  });

  await withFetch([throttled(Date.now() + 1_000)], async (calls) => {
    await assert.rejects(
      () => client.post("/1/tickets/search", {}),
      (err: unknown) => {
        assert.ok(err instanceof TdxRateLimitError, `expected TdxRateLimitError, got ${err}`);
        assert.equal(err.status, 429);
        assert.equal(err.path, "/1/tickets/search");
        assert.equal(err.snapshot.remaining, 0);
        return true;
      }
    );

    assert.equal(calls.count, 3, "one initial attempt plus two retries");
  });
});

test("a wait that would outlast the request budget fails fast instead of hanging the tool call", async () => {
  const waits: number[] = [];
  const client = new TdxClient(config, {
    retryBudgetMs: 1_000,
    sleep: async (ms) => void waits.push(ms),
  });

  await withFetch([throttled(Date.now() + 45_000)], async (calls) => {
    await assert.rejects(
      () => client.post("/1/tickets/search", {}),
      (err: unknown) => err instanceof TdxRateLimitError
    );

    assert.equal(calls.count, 1, "no point replaying a call we cannot wait out");
    assert.equal(waits.length, 0);
  });
});

test("a 5xx is never retried, because the write may already have landed", async () => {
  const client = new TdxClient(config, { sleep: async () => {} });

  await withFetch([{ status: 500, body: "boom" }], async (calls) => {
    await assert.rejects(
      () => client.post("/1/tickets", { Title: "x" }),
      (err: unknown) => {
        assert.ok(!(err instanceof TdxRateLimitError));
        assert.match((err as Error).message, /TDX API error 500/);
        return true;
      }
    );

    assert.equal(calls.count, 1);
  });
});

test("an app ID this server was not configured for never reaches TDX", async () => {
  const client = new TdxClient({ ...config, appId: 1, assetsAppId: 2 });

  await withFetch([{ status: 200, body: "[]" }], async (calls) => {
    await assert.rejects(
      () => client.get("/99/tickets/123"),
      (err: unknown) => {
        assert.match((err as Error).message, /appId 99 is not a configured TDX application/);
        return true;
      }
    );

    assert.equal(calls.count, 0, "the request must be refused before it is sent");
  });
});

test("every configured app ID is reachable", async () => {
  const client = new TdxClient({ ...config, appId: 1, assetsAppId: 2, kbAppId: 3 });

  await withFetch([{ status: 200, body: "{}" }], async () => {
    for (const appId of [1, 2, 3]) {
      await client.get(`/${appId}/tickets/1`);
    }
  });
});

test("paths that are not app-scoped are left alone", async () => {
  const client = new TdxClient(config);

  await withFetch([{ status: 200, body: "[]" }], async (calls) => {
    await client.post("/people/search", {});
    assert.equal(calls.count, 1);
  });
});

