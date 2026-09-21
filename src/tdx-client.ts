import { TdxAuth } from "./auth.js";
import { TdxConfig } from "./config.js";
import { TdxApiError, ToolSafeError } from "./errors.js";
import {
  RateLimitSnapshot,
  TdxRateLimitError,
  describeRateLimit,
  parseRateLimitHeaders,
  retryDelayMs,
} from "./tdx-rate-limit.js";

const DEFAULT_MAX_RATE_LIMIT_RETRIES = 3;
const DEFAULT_RETRY_BUDGET_MS = 180_000;

export interface TdxClientOptions {
  /** How many times a 429 may be retried before giving up. */
  maxRateLimitRetries?: number;
  /** Ceiling on the whole request including retry waits; defaults to MCP_TOOLS_CALL_TIMEOUT_MS. */
  retryBudgetMs?: number;
  /** Injected by tests so retry waits cost no wall-clock time. */
  sleep?: (ms: number) => Promise<void>;
  /** Re-reads credentials after a 401; defaults to loadConfig. Injected by tests. */
  reloadConfig?: () => Promise<TdxConfig>;
}

export class TdxClient {
  private auth: TdxAuth;
  private baseUrl: string;
  public appId: number;
  public assetsAppId?: number;
  public kbAppId?: number;

  private readonly allowedAppIds: Set<number>;

  private readonly maxRateLimitRetries: number;
  private readonly retryBudgetMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(config: TdxConfig, options: TdxClientOptions = {}) {
    this.auth = new TdxAuth(config, options.reloadConfig);
    this.baseUrl = config.baseUrl;
    this.appId = config.appId;
    this.assetsAppId = config.assetsAppId;
    this.kbAppId = config.kbAppId;

    this.allowedAppIds = new Set(
      [config.appId, config.assetsAppId, config.kbAppId].filter(
        (id): id is number => typeof id === "number"
      )
    );

    this.maxRateLimitRetries =
      options.maxRateLimitRetries ?? DEFAULT_MAX_RATE_LIMIT_RETRIES;
    this.retryBudgetMs =
      options.retryBudgetMs ??
      parseInt(process.env.MCP_TOOLS_CALL_TIMEOUT_MS || String(DEFAULT_RETRY_BUDGET_MS), 10);
    this.sleep =
      options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /**
   * Every tool takes a caller-supplied appId and the TDX admin token can reach any application
   * in the instance, so without this a read-only key could read apps this server was never
   * configured to expose. Enforced here rather than per-tool so a new tool cannot omit it.
   */
  private assertAppIdAllowed(path: string): void {
    const firstSegment = path.split("/")[1];
    if (!firstSegment || !/^\d+$/.test(firstSegment)) {
      return; // Not an app-scoped path (e.g. /people/search)
    }
    const requestedAppId = Number(firstSegment);
    if (!this.allowedAppIds.has(requestedAppId)) {
      throw new ToolSafeError(
        `appId ${requestedAppId} is not a configured TDX application for this server. ` +
        `Allowed app IDs: ${[...this.allowedAppIds].join(", ")}.`
      );
    }
  }

  async request(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>
  ): Promise<unknown> {
    this.assertAppIdAllowed(path);
    console.error(`[TDX Client] ${method} ${path} - getting token...`);
    const startTime = Date.now();
    const deadline = startTime + this.retryBudgetMs;
    
    try {
      let url = `${this.baseUrl}${path}`;

      if (query) {
        const params = new URLSearchParams(query);
        url += `?${params.toString()}`;
      }

      const res = await this.fetchWithRateLimitRetry(method, path, url, body, startTime, deadline);

      if (!res.ok) {
        // The body stays on the error and is logged once by toToolError, never returned.
        throw new TdxApiError(res.status, method, path, await res.text());
      }

      const text = await res.text();
      if (!text) {
        console.error(`[TDX Client] ✅ Empty response (${Date.now() - startTime}ms total)`);
        return null;
      }

      try {
        const result = JSON.parse(text);
        console.error(`[TDX Client] ✅ Parsed JSON (${text.length} chars, ${Date.now() - startTime}ms total)`);
        return result;
      } catch {
        console.error(`[TDX Client] ✅ Returned raw text (${text.length} chars, ${Date.now() - startTime}ms total)`);
        return text;
      }
    } catch (err) {
      const totalTime = Date.now() - startTime;
      if (err instanceof Error) {
        console.error(`[TDX Client] ❌ Error after ${totalTime}ms: ${err.message}`);
      }
      throw err;
    }
  }

  /**
   * Performs the call, retrying only on 429 and once on 401.
   *
   * A 429 means TDX rejected the request without executing it, so replaying it is safe even
   * for writes. A 401 is the same -- TDX never reached the handler. Every other failure --
   * including 5xx -- is returned untouched: the server may well have applied the change, and
   * retrying it could duplicate a ticket or an asset.
   */
  private async fetchWithRateLimitRetry(
    method: string,
    path: string,
    url: string,
    body: unknown,
    startTime: number,
    deadline: number
  ): Promise<Response> {
    let snapshot: RateLimitSnapshot = {};
    let attempt = 1;
    let triedReauth = false;

    for (;;) {
      const token = await this.auth.getToken();
      console.error(`[TDX Client] Token obtained in ${Date.now() - startTime}ms`);

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      console.error(`[TDX Client] Making request to ${url}`);
      const fetchStart = Date.now();
      const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const fetchTime = Date.now() - fetchStart;
      console.error(`[TDX Client] Response received in ${fetchTime}ms: HTTP ${res.status}`);

      snapshot = parseRateLimitHeaders(res.headers);
      if (snapshot.remaining !== undefined && snapshot.remaining <= 2) {
        console.error(`[TDX Client] ⚠️ Approaching TDX limit: ${describeRateLimit(snapshot)}`);
      }

      // Deliberately does not consume an attempt: re-auth is orthogonal to the throttle budget.
      if (res.status === 401 && !triedReauth) {
        triedReauth = true;
        if (await this.auth.recoverFromUnauthorized(fetchStart)) {
          await res.text().catch(() => ""); // Drain so the socket can be reused for the replay.
          console.error(`[TDX Client] 🔑 HTTP 401 on ${method} ${path}; re-authenticated, replaying once`);
          continue;
        }
      }

      if (res.status !== 429) {
        return res;
      }

      // Drain the body so the socket can be reused for the retry.
      await res.text().catch(() => "");

      if (attempt > this.maxRateLimitRetries) {
        throw new TdxRateLimitError(
          `TDX throttled ${method} ${path} and did not recover after ${this.maxRateLimitRetries} ` +
          `retries (${describeRateLimit(snapshot)}). Retry later or reduce request volume.`,
          method,
          path,
          attempt,
          snapshot
        );
      }

      const waitMs = retryDelayMs(snapshot);
      if (Date.now() + waitMs > deadline) {
        throw new TdxRateLimitError(
          `TDX throttled ${method} ${path} and the ${Math.round(waitMs / 1000)}s wait until its ` +
          `limit resets exceeds the ${Math.round(this.retryBudgetMs / 1000)}s request budget ` +
          `(${describeRateLimit(snapshot)}). Retry later or reduce request volume.`,
          method,
          path,
          attempt,
          snapshot
        );
      }

      console.error(
        `[TDX Client] ⏳ HTTP 429 on ${method} ${path} (attempt ${attempt}/${this.maxRateLimitRetries + 1}); ` +
        `waiting ${waitMs}ms -- ${describeRateLimit(snapshot)}`
      );
      await this.sleep(waitMs);
      attempt++;
    }
  }

  get(path: string, query?: Record<string, string>) {
    return this.request("GET", path, undefined, query);
  }

  post(path: string, body?: unknown) {
    return this.request("POST", path, body);
  }

  put(path: string, body?: unknown) {
    return this.request("PUT", path, body);
  }

  patch(path: string, body?: unknown) {
    return this.request("PATCH", path, body);
  }

  delete(path: string) {
    return this.request("DELETE", path);
  }

  /**
   * Generate a TDNext web URL for a ticket
   * Pattern: https://{domain}/TDNext/Apps/{appId}/Tickets/TicketDet?TicketID={ticketId}
   */
  getTicketWebLink(ticketId: number, appId?: number): string {
    const app = appId ?? this.appId;
    // Extract domain from baseUrl (e.g., "https://service.pascocountyfl.net/TDWebApi/api" -> "https://service.pascocountyfl.net")
    const urlObj = new URL(this.baseUrl);
    const domain = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}`;
    return `${domain}/TDNext/Apps/${app}/Tickets/TicketDet?TicketID=${ticketId}`;
  }
}
