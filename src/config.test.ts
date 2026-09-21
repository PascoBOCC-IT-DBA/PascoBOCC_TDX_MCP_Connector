import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { clampMaxResults } from "./config.js";

const ABSOLUTE = "TDX_MAX_RESULTS_ABSOLUTE";
let original: string | undefined;

beforeEach(() => {
  original = process.env[ABSOLUTE];
  process.env[ABSOLUTE] = "100";
});

afterEach(() => {
  if (original === undefined) {
    delete process.env[ABSOLUTE];
  } else {
    process.env[ABSOLUTE] = original;
  }
});

test("a caller cannot ask for more than the absolute ceiling", () => {
  assert.equal(clampMaxResults(1_000_000, 25), 100);
});

test("a caller request under the ceiling is honoured", () => {
  assert.equal(clampMaxResults(40, 25), 40);
});

test("an operator-configured fallback is trusted even above the ceiling", () => {
  assert.equal(clampMaxResults(undefined, 5_000), 5_000);
});

test("nonsense values fall back rather than reaching TDX", () => {
  assert.equal(clampMaxResults(0, 25), 25);
  assert.equal(clampMaxResults(-1, 25), 25);
  assert.equal(clampMaxResults(Number.NaN, 25), 25);
  assert.equal(clampMaxResults(Number.POSITIVE_INFINITY, 25), 25);
});

test("a fractional request is floored to a whole page size", () => {
  assert.equal(clampMaxResults(10.9, 25), 10);
});
