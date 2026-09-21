import { test } from "node:test";
import assert from "node:assert/strict";

import { PerKeyQuota } from "./per-key-quota.js";

test("a key may spend up to its cap and no further", () => {
  const quota = new PerKeyQuota(3, 60_000);
  const now = 1_000_000;

  for (let i = 0; i < 3; i++) {
    assert.equal(quota.tryConsume("key-a", now + i).allowed, true, `call ${i + 1} should be allowed`);
  }

  const denied = quota.tryConsume("key-a", now + 3);
  assert.equal(denied.allowed, false);
  assert.equal(denied.usage, 3);
  assert.ok(denied.retryAfterMs > 0 && denied.retryAfterMs <= 60_000);
});

test("one key exhausting its share does not starve another key", () => {
  const quota = new PerKeyQuota(2, 60_000);
  const now = 1_000_000;

  quota.tryConsume("noisy", now);
  quota.tryConsume("noisy", now + 1);
  assert.equal(quota.tryConsume("noisy", now + 2).allowed, false);

  assert.equal(quota.tryConsume("quiet", now + 3).allowed, true);
  assert.equal(quota.getUsage("quiet", now + 3), 1);
});

test("the window slides so a throttled key recovers", () => {
  const quota = new PerKeyQuota(2, 60_000);
  const now = 1_000_000;

  quota.tryConsume("key-a", now);
  quota.tryConsume("key-a", now + 1);
  assert.equal(quota.tryConsume("key-a", now + 2).allowed, false);

  assert.equal(quota.tryConsume("key-a", now + 60_001).allowed, true);
  assert.equal(quota.getUsage("key-a", now + 60_001), 1);
});

test("an over-share caller queues instead of failing", async () => {
  const quota = new PerKeyQuota(1, 120);
  await quota.acquire("key-a", 5_000);

  const started = Date.now();
  await quota.acquire("key-a", 5_000);
  const waited = Date.now() - started;

  assert.ok(waited >= 100, `expected the second call to wait for the window, waited ${waited}ms`);
});

test("a queued caller gives up once the queue timeout is exhausted", async () => {
  const quota = new PerKeyQuota(1, 60_000);
  await quota.acquire("key-a", 5_000);

  await assert.rejects(
    () => quota.acquire("key-a", 100),
    /Per-key quota timeout after 100ms/
  );
});

test("waiting on one key does not block another", async () => {
  const quota = new PerKeyQuota(1, 60_000);
  await quota.acquire("noisy", 5_000);

  const blocked = assert.rejects(() => quota.acquire("noisy", 100));
  await quota.acquire("quiet", 100);
  await blocked;

  assert.equal(quota.getUsage("quiet"), 1);
});
