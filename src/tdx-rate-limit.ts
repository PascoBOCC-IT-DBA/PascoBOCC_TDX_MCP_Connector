/**
 * TDX rate-limit headers and the retry policy built on them.
 *
 * TDX publishes per-endpoint, per-IP limits, but every entry in its OpenAPI document ends
 * with "Additional rate limits may apply based on system configuration" -- so the documented
 * numbers are not authoritative and the X-RateLimit-* response headers are the only reliable
 * signal. TDX's guidance on a 429 is to wait until X-RateLimit-Reset, with a floor of a few
 * seconds because the caller's clock may be ahead of the server's.
 */

export interface RateLimitSnapshot {
  limit?: number;
  remaining?: number;
  /** Epoch ms parsed from X-RateLimit-Reset (RFC 1123), undefined if absent or unparseable. */
  resetAt?: number;
}

/** Floor on any retry wait; TDX explicitly warns that our clock may be ahead of theirs. */
export const MIN_RETRY_WAIT_MS = 5_000;

/** Ceiling on any retry wait; the widest documented TDX window is 60s. */
export const MAX_RETRY_WAIT_MS = 60_000;

interface HeaderSource {
  get(name: string): string | null;
}

function parseCount(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function parseRateLimitHeaders(headers: HeaderSource): RateLimitSnapshot {
  const resetRaw = headers.get("X-RateLimit-Reset");
  const resetAt = resetRaw ? Date.parse(resetRaw) : Number.NaN;

  return {
    limit: parseCount(headers.get("X-RateLimit-Limit")),
    remaining: parseCount(headers.get("X-RateLimit-Remaining")),
    resetAt: Number.isNaN(resetAt) ? undefined : resetAt,
  };
}

/**
 * How long to wait before retrying a 429, clamped into [MIN_RETRY_WAIT_MS, MAX_RETRY_WAIT_MS].
 * A missing, stale, or absurd reset time all collapse to the floor rather than retrying instantly.
 */
export function retryDelayMs(snapshot: RateLimitSnapshot, now: number = Date.now()): number {
  const untilReset = snapshot.resetAt === undefined ? 0 : snapshot.resetAt - now;
  return Math.min(MAX_RETRY_WAIT_MS, Math.max(MIN_RETRY_WAIT_MS, untilReset));
}

export function describeRateLimit(snapshot: RateLimitSnapshot): string {
  const parts: string[] = [];
  if (snapshot.remaining !== undefined) parts.push(`remaining=${snapshot.remaining}`);
  if (snapshot.limit !== undefined) parts.push(`limit=${snapshot.limit}`);
  if (snapshot.resetAt !== undefined) parts.push(`reset=${new Date(snapshot.resetAt).toISOString()}`);
  return parts.length > 0 ? parts.join(" ") : "no X-RateLimit-* headers";
}

/**
 * Thrown when TDX kept returning 429 after the retry budget ran out. Distinct from a generic
 * API error so callers can tell "throttled, try later" apart from "the request was wrong".
 */
export class TdxRateLimitError extends Error {
  readonly status = 429;

  constructor(
    message: string,
    readonly method: string,
    readonly path: string,
    readonly attempts: number,
    readonly snapshot: RateLimitSnapshot
  ) {
    super(message);
    this.name = "TdxRateLimitError";
  }
}
