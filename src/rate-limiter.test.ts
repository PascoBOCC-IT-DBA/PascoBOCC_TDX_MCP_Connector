import test from "node:test";
import assert from "node:assert/strict";

import { RateLimiter } from "./rate-limiter.js";

/**
 * Assertions here inspect queue state synchronously rather than observing the order in which
 * promises resolve: acquire() is an async function, so when several inner promises settle in
 * the same tick the adoption step re-serialises their .then callbacks into call order, which
 * would make ordering assertions pass regardless of the queue's actual behaviour.
 */

/** Queue an acquire we never await; shutdown() rejects these, so swallow it. */
function enqueue(limiter: RateLimiter, priority = 0): void {
  limiter.acquire(priority).catch(() => {});
}

/** Drain the bucket so subsequent acquires have to queue. */
function exhaust(limiter: RateLimiter): void {
  while (limiter.getStats().tokensAvailable >= 1) {
    enqueue(limiter);
  }
}

function queuedPriorities(limiter: RateLimiter): number[] {
  return (limiter["queue"] as Array<{ priority: number }>).map((r) => r.priority);
}

function queuedIds(limiter: RateLimiter): string[] {
  return (limiter["queue"] as Array<{ id: string }>).map((r) => r.id);
}

test("an arriving request queues behind a waiter instead of taking the free token", () => {
  const limiter = new RateLimiter(100, 60000, 1.5);
  try {
    exhaust(limiter);

    enqueue(limiter);
    const waiterId = queuedIds(limiter)[0];

    // A token frees up, but someone is already waiting for it.
    limiter["tokens"] = 1;
    enqueue(limiter);

    assert.equal(queuedIds(limiter).includes(waiterId), false, "the waiter should have been served");
    assert.equal(limiter.getStats().queueDepth, 1, "the newcomer should now be the one waiting");
  } finally {
    limiter.shutdown();
  }
});

test("an arriving write queues behind an already-waiting write", () => {
  const limiter = new RateLimiter(100, 60000, 1.5);
  try {
    exhaust(limiter);

    enqueue(limiter, 1);
    const waiterId = queuedIds(limiter)[0];

    limiter["tokens"] = 1;
    enqueue(limiter, 1);

    assert.equal(queuedIds(limiter).includes(waiterId), false, "equal priority must not grant queue-skipping");
    assert.equal(limiter.getStats().queueDepth, 1);
  } finally {
    limiter.shutdown();
  }
});

test("a queued high-priority request is dequeued before a queued low-priority one", () => {
  const limiter = new RateLimiter(100, 60000, 1.5);
  try {
    exhaust(limiter);

    enqueue(limiter, 0);
    enqueue(limiter, 1);

    assert.deepEqual(queuedPriorities(limiter), [1, 0], "writes sort ahead of reads");

    // Release exactly one token; the high-priority waiter must be the one served.
    limiter["tokens"] = 1;
    limiter["processQueue"]();

    assert.deepEqual(queuedPriorities(limiter), [0], "the read should still be waiting");
  } finally {
    limiter.shutdown();
  }
});

test("equal-priority requests are served first-in, first-out", () => {
  const limiter = new RateLimiter(100, 60000, 1.5);
  try {
    exhaust(limiter);

    for (let i = 0; i < 3; i++) enqueue(limiter, 0);
    const before = queuedIds(limiter);

    limiter["tokens"] = 1;
    limiter["processQueue"]();

    assert.deepEqual(queuedIds(limiter), before.slice(1), "the earliest waiter should have been served");
  } finally {
    limiter.shutdown();
  }
});

test("the fast path still applies when nothing is queued", async () => {
  const limiter = new RateLimiter(100, 60000, 1.5);
  try {
    const before = limiter.getStats();
    await limiter.acquire();
    const after = limiter.getStats();

    assert.equal(after.totalQueued, before.totalQueued, "should not have queued");
    assert.ok(after.tokensAvailable < before.tokensAvailable, "should have spent a token");
  } finally {
    limiter.shutdown();
  }
});

test("queue timeout rejects and removes the waiter", async () => {
  const limiter = new RateLimiter(100, 60000, 1.5);
  try {
    exhaust(limiter);

    await assert.rejects(limiter.acquire(0, 10), /queue timeout/i);
    assert.equal(limiter.getStats().queueDepth, 0, "timed-out waiters must not leak");
  } finally {
    limiter.shutdown();
  }
});

test("shutdown rejects everything still queued", async () => {
  const limiter = new RateLimiter(100, 60000, 1.5);
  exhaust(limiter);

  const waiters = [limiter.acquire(), limiter.acquire()];
  limiter.shutdown();

  for (const waiter of waiters) {
    await assert.rejects(waiter, /shutting down/i);
  }
  assert.equal(limiter.getStats().queueDepth, 0);
});
