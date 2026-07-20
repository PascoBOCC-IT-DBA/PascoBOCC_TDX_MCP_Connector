/**
 * Token Bucket Rate Limiter for TDX API
 * 
 * Enforces TDX API rate limit: 100 calls per 60 seconds
 * Uses a token bucket algorithm to allow fair queuing of requests
 * with burst capacity for spikes.
 */

interface QueuedRequest {
  id: string;
  resolve: () => void;
  reject: (err: Error) => void;
  createdAt: number;
  priority: number;
}

interface RateLimiterStats {
  tokensAvailable: number;
  queueDepth: number;
  totalRequests: number;
  totalQueued: number;
  avgWaitTimeMs: number;
  lastRefillMs: number;
}

export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per millisecond
  private lastRefillTime: number;
  private queue: QueuedRequest[] = [];
  private requestCounter: number = 0;
  private totalWaitTime: number = 0;
  private totalQueued: number = 0;
  private refillInterval: NodeJS.Timeout | null = null;

  constructor(
    callsPerWindow: number = 100,
    windowMs: number = 60000,
    burstCapacityMultiplier: number = 1.5
  ) {
    this.refillRate = callsPerWindow / windowMs; // tokens per ms
    this.maxTokens = Math.ceil(callsPerWindow * burstCapacityMultiplier);
    this.tokens = this.maxTokens; // start with full capacity
    this.lastRefillTime = Date.now();

    // Periodically refill tokens
    this.refillInterval = setInterval(() => {
      this.refill();
    }, 1000); // check every second
  }

  /**
   * Acquire a token, waiting if necessary until one becomes available.
   * Respects queue timeout and handles priority.
   * 
   * @param priority - Higher priority requests are processed first (default: 0)
   * @param timeoutMs - Max time to wait for a token (default: 5 minutes)
   * @returns Promise that resolves when token is acquired
   */
  async acquire(priority: number = 0, timeoutMs: number = 300000): Promise<void> {
    const queuedRequestId = `req-${++this.requestCounter}`;

    // Check if token immediately available
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return Promise.resolve();
    }

    // Token not available, queue the request
    this.totalQueued++;
    const createdAt = Date.now();

    return new Promise<void>((resolve, reject) => {
      const request: QueuedRequest = {
        id: queuedRequestId,
        resolve,
        reject,
        createdAt,
        priority,
      };

      // Insert by priority (higher priority = earlier in queue)
      const insertIndex = this.queue.findIndex(
        (r) => r.priority < priority
      );
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      // Set timeout to reject if waiting too long
      const timeoutHandle = setTimeout(() => {
        const idx = this.queue.indexOf(request);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
        }
        reject(
          new Error(
            `Rate limiter queue timeout after ${timeoutMs}ms. ` +
            `Queue depth: ${this.queue.length}. ` +
            `Consider reducing request rate or increasing timeout.`
          )
        );
      }, timeoutMs);

      // Store timeout handle to clear if request succeeds
      (request as any).timeoutHandle = timeoutHandle;

      // Try to process queue
      this.processQueue();
    });
  }

  /**
   * Process queued requests if tokens are available.
   */
  private processQueue(): void {
    while (this.queue.length > 0 && this.tokens >= 1) {
      this.tokens -= 1;
      const request = this.queue.shift()!;
      const waitTime = Date.now() - request.createdAt;
      this.totalWaitTime += waitTime;

      // Clear timeout and resolve
      clearTimeout((request as any).timeoutHandle);
      request.resolve();
    }
  }

  /**
   * Refill tokens based on elapsed time since last refill.
   */
  private refill(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillTime;
    const tokensToAdd = elapsedMs * this.refillRate;

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.tokens + tokensToAdd, this.maxTokens);
      this.lastRefillTime = now;

      // Try to process any queued requests now that tokens are available
      this.processQueue();
    }
  }

  /**
   * Get current rate limiter statistics.
   */
  getStats(): RateLimiterStats {
    return {
      tokensAvailable: Math.floor(this.tokens * 100) / 100, // round to 2 decimals
      queueDepth: this.queue.length,
      totalRequests: this.requestCounter,
      totalQueued: this.totalQueued,
      avgWaitTimeMs:
        this.totalQueued > 0
          ? Math.round(this.totalWaitTime / this.totalQueued)
          : 0,
      lastRefillMs: Date.now() - this.lastRefillTime,
    };
  }

  /**
   * Shutdown the rate limiter and clear intervals.
   */
  shutdown(): void {
    if (this.refillInterval) {
      clearInterval(this.refillInterval);
      this.refillInterval = null;
    }

    // Reject all pending requests
    const error = new Error("Rate limiter is shutting down");
    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      clearTimeout((request as any).timeoutHandle);
      request.reject(error);
    }
  }

  /**
   * Reset to initial state (useful for testing).
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
    this.requestCounter = 0;
    this.totalWaitTime = 0;
    this.totalQueued = 0;
    // Don't clear queue here, let pending requests timeout naturally
  }
}
