/**
 * Configuration loader for TDX API Rate Limiter
 * 
 * Parses and validates environment variables for rate limiting.
 * Provides sensible defaults and validation warnings.
 */

export interface RateLimiterConfig {
  callsPerWindow: number; // e.g., 100 calls per window
  windowMs: number; // e.g., 60000 ms (60 seconds)
  burstCapacityMultiplier: number; // e.g., 1.5 for burst up to 150 tokens
  queueTimeoutMs: number; // max time a request waits in queue
  enabled: boolean; // whether rate limiting is enabled
  perKeyShare: number; // fraction of callsPerWindow a single API key may consume
}

/**
 * Load rate limiter configuration from environment variables.
 * 
 * Supported environment variables:
 * - TDX_RATE_LIMIT_ENABLED (true/false, default: true)
 * - TDX_RATE_LIMIT_CALLS (default: 100)
 * - TDX_RATE_LIMIT_WINDOW_MS (default: 60000)
 * - TDX_RATE_LIMIT_BURST_CAPACITY_MULTIPLIER (default: 1.5)
 * - TDX_RATE_LIMIT_QUEUE_TIMEOUT_MS (default: 300000, 5 minutes)
 * - TDX_RATE_LIMIT_PER_KEY_SHARE (0-1, default: 0.8)
 */
export function loadRateLimiterConfig(): RateLimiterConfig {
  const enabled =
    process.env.TDX_RATE_LIMIT_ENABLED !== "false";

  const callsPerWindow = parseInt(
    process.env.TDX_RATE_LIMIT_CALLS || "100",
    10
  );

  const windowMs = parseInt(
    process.env.TDX_RATE_LIMIT_WINDOW_MS || "60000",
    10
  );

  const burstCapacityMultiplier = parseFloat(
    process.env.TDX_RATE_LIMIT_BURST_CAPACITY_MULTIPLIER || "1.5"
  );

  const queueTimeoutMs = parseInt(
    process.env.TDX_RATE_LIMIT_QUEUE_TIMEOUT_MS || "300000",
    10
  );

  const perKeyShare = parseFloat(
    process.env.TDX_RATE_LIMIT_PER_KEY_SHARE || "0.8"
  );

  // Validation
  const errors: string[] = [];

  if (!enabled) {
    console.warn(
      "[Rate Limiter] WARNING: Rate limiting is DISABLED. " +
      "Set TDX_RATE_LIMIT_ENABLED=true to enable it."
    );
  }

  if (callsPerWindow <= 0 || !Number.isInteger(callsPerWindow)) {
    errors.push(
      `TDX_RATE_LIMIT_CALLS must be a positive integer, got: ${callsPerWindow}`
    );
  }

  if (windowMs <= 0) {
    errors.push(
      `TDX_RATE_LIMIT_WINDOW_MS must be positive (ms), got: ${windowMs}`
    );
  }

  if (burstCapacityMultiplier < 1.0 || burstCapacityMultiplier > 3.0) {
    console.warn(
      `[Rate Limiter] WARNING: Burst capacity multiplier ${burstCapacityMultiplier} ` +
      `is outside recommended range [1.0, 3.0]. ` +
      `Using it anyway, but consider values near 1.5.`
    );
  }

  if (queueTimeoutMs <= 0) {
    errors.push(
      `TDX_RATE_LIMIT_QUEUE_TIMEOUT_MS must be positive (ms), got: ${queueTimeoutMs}`
    );
  }

  if (!(perKeyShare > 0) || perKeyShare > 1) {
    errors.push(
      `TDX_RATE_LIMIT_PER_KEY_SHARE must be greater than 0 and at most 1, got: ${perKeyShare}`
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid rate limiter configuration:\n${errors.join("\n")}`
    );
  }

  // Calculate effective rate
  const refillRatePerSec = (callsPerWindow / windowMs) * 1000;

  console.error(
    `[Rate Limiter] Configuration: ` +
    `${callsPerWindow} calls per ${windowMs}ms ` +
    `(~${refillRatePerSec.toFixed(2)} calls/sec), ` +
    `burst capacity: ${Math.ceil(callsPerWindow * burstCapacityMultiplier)} tokens, ` +
    `queue timeout: ${queueTimeoutMs}ms, ` +
    `per-key cap: ${Math.max(1, Math.floor(callsPerWindow * perKeyShare))} calls, ` +
    `enabled: ${enabled}`
  );

  return {
    callsPerWindow,
    windowMs,
    burstCapacityMultiplier,
    queueTimeoutMs,
    enabled,
    perKeyShare,
  };
}
