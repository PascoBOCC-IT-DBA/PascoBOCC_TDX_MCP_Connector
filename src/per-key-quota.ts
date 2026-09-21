/**
 * Per-key share of the shared upstream TDX budget.
 *
 * The global RateLimiter exists to protect TDX's own limit, so this is deliberately
 * a share of that same budget rather than a second budget: giving each key its own
 * full bucket would let two keys send twice what TDX allows. This only stops one key
 * from consuming the entire window and starving the other tier.
 *
 * Over-share callers wait for their window to roll forward, matching the queue-don't-fail
 * behaviour of the global limiter. They only fail once the queue timeout is exhausted.
 */
export interface QuotaDecision {
  allowed: boolean;
  retryAfterMs: number;
  usage: number;
}

interface PendingWait {
  timer: NodeJS.Timeout;
  reject: (err: Error) => void;
}

export class PerKeyQuota {
  private readonly hits = new Map<string, number[]>();
  private readonly waiting = new Map<string, number>();
  private readonly pending = new Set<PendingWait>();
  private stopped = false;

  constructor(
    private readonly maxCallsPerKey: number,
    private readonly windowMs: number
  ) {}

  private recentHits(keyId: string, now: number): number[] {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(keyId) ?? []).filter((timestamp) => timestamp > cutoff);
    this.hits.set(keyId, recent);
    return recent;
  }

  tryConsume(keyId: string, now: number = Date.now()): QuotaDecision {
    const recent = this.recentHits(keyId, now);

    if (recent.length >= this.maxCallsPerKey) {
      const oldest = recent[0];
      return {
        allowed: false,
        retryAfterMs: Math.max(1, oldest + this.windowMs - now),
        usage: recent.length,
      };
    }

    recent.push(now);
    return { allowed: true, retryAfterMs: 0, usage: recent.length };
  }

  /**
   * Wait until this key has room in its window, then consume a slot.
   * Rejects if the wait would outlast timeoutMs.
   */
  async acquire(keyId: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let queued = false;

    try {
      for (;;) {
        if (this.stopped) {
          throw new Error('Rate limiter is shutting down');
        }

        const decision = this.tryConsume(keyId);
        if (decision.allowed) {
          return;
        }

        if (!queued) {
          queued = true;
          this.waiting.set(keyId, (this.waiting.get(keyId) ?? 0) + 1);
        }

        if (Date.now() + decision.retryAfterMs > deadline) {
          throw new Error(
            `Per-key quota timeout after ${timeoutMs}ms. ` +
            `This key is limited to ${this.maxCallsPerKey} calls per ${this.windowMs}ms.`
          );
        }

        await this.delay(decision.retryAfterMs);
      }
    } finally {
      if (queued) {
        const remaining = (this.waiting.get(keyId) ?? 1) - 1;
        if (remaining > 0) {
          this.waiting.set(keyId, remaining);
        } else {
          this.waiting.delete(keyId);
        }
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const entry: PendingWait = {
        reject,
        timer: setTimeout(() => {
          this.pending.delete(entry);
          resolve();
        }, ms),
      };
      this.pending.add(entry);
    });
  }

  getUsage(keyId: string, now: number = Date.now()): number {
    return this.recentHits(keyId, now).length;
  }

  getWaiting(keyId: string): number {
    return this.waiting.get(keyId) ?? 0;
  }

  get limit(): number {
    return this.maxCallsPerKey;
  }

  shutdown(): void {
    this.stopped = true;
    for (const entry of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Rate limiter is shutting down'));
    }
    this.pending.clear();
  }
}
