import { test } from "node:test";
import assert from "node:assert/strict";

import { RestartPolicy } from "./restart-policy.js";

const MAX = 5;
const WINDOW_MS = 10 * 60 * 1000;
const BASE_DELAY = 2000;
const MAX_DELAY = 30_000;

function policyWithClock() {
  let now = 1_000_000;
  const policy = new RestartPolicy(MAX, WINDOW_MS, BASE_DELAY, MAX_DELAY, () => now);
  return { policy, advance: (ms: number) => void (now += ms) };
}

test("crashes inside the window exhaust the budget", () => {
  const { policy } = policyWithClock();

  for (let i = 0; i < MAX; i++) {
    assert.equal(policy.exhausted(), false, `should still have budget after ${i} crashes`);
    policy.recordCrash();
  }

  assert.equal(policy.exhausted(), true);
});

test("crashes spread beyond the window never brick the server", () => {
  const { policy, advance } = policyWithClock();

  // Twice the lifetime budget, but spaced out -- this is the case the old counter got wrong.
  for (let i = 0; i < MAX * 2; i++) {
    policy.recordCrash();
    advance(WINDOW_MS + 1);
    assert.equal(policy.exhausted(), false, `crash ${i + 1} should have aged out`);
  }

  assert.equal(policy.recentCrashes, 0);
});

test("an exhausted budget recovers once the window clears", () => {
  const { policy, advance } = policyWithClock();

  for (let i = 0; i < MAX; i++) {
    policy.recordCrash();
  }
  assert.equal(policy.exhausted(), true);

  advance(WINDOW_MS + 1);

  assert.equal(policy.exhausted(), false, "the server must not stay bricked forever");
  assert.equal(policy.recentCrashes, 0);
});

test("a crash exactly at the window edge is aged out", () => {
  const { policy, advance } = policyWithClock();

  policy.recordCrash();
  advance(WINDOW_MS);

  assert.equal(policy.recentCrashes, 0);
});

test("a clean exit clears the budget", () => {
  const { policy } = policyWithClock();

  for (let i = 0; i < MAX - 1; i++) {
    policy.recordCrash();
  }
  policy.reset();

  assert.equal(policy.recentCrashes, 0);
  assert.equal(policy.exhausted(), false);
});

test("backoff grows with each crash and is capped", () => {
  const { policy } = policyWithClock();

  const delays: number[] = [];
  for (let i = 0; i < 6; i++) {
    policy.recordCrash();
    delays.push(policy.nextDelayMs());
  }

  assert.deepEqual(delays.slice(0, 5), [2000, 4000, 8000, 16_000, 30_000]);
  assert.ok(
    delays.every((d) => d <= MAX_DELAY),
    `no delay may exceed the ${MAX_DELAY}ms cap, got ${delays.join(", ")}`
  );
});

test("backoff cannot outlast the window, or crashes could never accumulate", () => {
  const { policy } = policyWithClock();

  for (let i = 0; i < MAX; i++) {
    policy.recordCrash();
  }

  assert.ok(
    policy.nextDelayMs() * MAX < WINDOW_MS,
    "a full crash budget must fit inside the window, otherwise the cap never trips"
  );
});
