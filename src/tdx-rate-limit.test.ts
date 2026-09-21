import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_RETRY_WAIT_MS,
  MIN_RETRY_WAIT_MS,
  parseRateLimitHeaders,
  retryDelayMs,
} from "./tdx-rate-limit.js";

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

test("rate limit headers are read off the response", () => {
  const snapshot = parseRateLimitHeaders(
    headers({
      "X-RateLimit-Limit": "60",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": "Sun, 21 Sep 2026 14:30:00 GMT",
    })
  );

  assert.equal(snapshot.limit, 60);
  assert.equal(snapshot.remaining, 0);
  assert.equal(snapshot.resetAt, Date.parse("Sun, 21 Sep 2026 14:30:00 GMT"));
});

test("a response without rate limit headers yields an empty snapshot", () => {
  const snapshot = parseRateLimitHeaders(headers({}));

  assert.equal(snapshot.limit, undefined);
  assert.equal(snapshot.remaining, undefined);
  assert.equal(snapshot.resetAt, undefined);
});

test("a remaining of zero is kept, not mistaken for a missing header", () => {
  assert.equal(parseRateLimitHeaders(headers({ "X-RateLimit-Remaining": "0" })).remaining, 0);
});

test("an unparseable reset header is ignored rather than producing NaN", () => {
  assert.equal(parseRateLimitHeaders(headers({ "X-RateLimit-Reset": "whenever" })).resetAt, undefined);
});

test("the wait runs until the advertised reset time", () => {
  const now = Date.parse("Sun, 21 Sep 2026 14:30:00 GMT");
  assert.equal(retryDelayMs({ resetAt: now + 12_000 }, now), 12_000);
});

test("a reset that is already in the past still waits out the clock-skew floor", () => {
  const now = Date.parse("Sun, 21 Sep 2026 14:30:00 GMT");
  assert.equal(retryDelayMs({ resetAt: now - 30_000 }, now), MIN_RETRY_WAIT_MS);
});

test("a missing reset header falls back to the clock-skew floor", () => {
  assert.equal(retryDelayMs({}, Date.now()), MIN_RETRY_WAIT_MS);
});

test("an absurd reset time is capped instead of stalling the request", () => {
  const now = Date.now();
  assert.equal(retryDelayMs({ resetAt: now + 86_400_000 }, now), MAX_RETRY_WAIT_MS);
});
