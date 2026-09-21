/**
 * Crash budget for the supervised MCP child process.
 *
 * Counts crashes inside a sliding window rather than for the life of the container: a
 * lifetime counter means five crashes spread over months permanently bricks the server,
 * because nothing ever decrements it.
 */
export class RestartPolicy {
  private crashes: number[] = [];

  constructor(
    private readonly maxRestarts: number,
    private readonly windowMs: number,
    private readonly baseDelayMs: number,
    private readonly maxDelayMs: number,
    private readonly now: () => number = Date.now
  ) {}

  recordCrash(): void {
    this.prune();
    this.crashes.push(this.now());
  }

  /** A clean exit proves the process was healthy, so the budget starts over. */
  reset(): void {
    this.crashes = [];
  }

  get recentCrashes(): number {
    this.prune();
    return this.crashes.length;
  }

  exhausted(): boolean {
    return this.recentCrashes >= this.maxRestarts;
  }

  /** Backoff so a tight crash loop cannot burn the whole window in a few seconds. */
  nextDelayMs(): number {
    const consecutive = Math.max(0, this.recentCrashes - 1);
    return Math.min(this.baseDelayMs * 2 ** consecutive, this.maxDelayMs);
  }

  private prune(): void {
    const cutoff = this.now() - this.windowMs;
    while (this.crashes.length > 0 && this.crashes[0] <= cutoff) {
      this.crashes.shift();
    }
  }
}
