import { TdxConfig, loadConfig } from "./config.js";
import { redactSecrets } from "./errors.js";

const TOKEN_LIFETIME_MS = 23 * 60 * 60 * 1000; // 23 hours (1h buffer before 24h expiry)

/** Floor between credential reloads so a burst of 401s cannot storm Key Vault. */
const CREDENTIAL_RELOAD_COOLDOWN_MS = 60 * 1000;

export class TdxAuth {
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private config: TdxConfig;
  private readonly reloadConfig: () => Promise<TdxConfig>;

  private inFlightReload: Promise<void> | null = null;
  private lastReloadAt = 0;

  constructor(config: TdxConfig, reloadConfig: () => Promise<TdxConfig> = loadConfig) {
    this.config = config;
    this.reloadConfig = reloadConfig;
  }

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) {
      console.error(`[TDX Auth] Using cached token (expires in ${Math.round((this.tokenExpiry - Date.now()) / 1000)}s)`);
      return this.token;
    }
    console.error(`[TDX Auth] Token missing or expired, refreshing...`);
    return this.refresh();
  }

  /**
   * Recovery path for a 401. The token is cached for 23h AND the web services key is read
   * once at startup, so a key rotated in Key Vault stays invisible until both are dropped --
   * without this the server 401s on every call until someone restarts it.
   *
   * @param requestStartedAt when the caller's failed request was sent, so a request that was
   *   already in flight during someone else's reload replays instead of forcing another.
   * @returns whether the caller should replay its request.
   */
  async recoverFromUnauthorized(requestStartedAt: number): Promise<boolean> {
    if (this.lastReloadAt > requestStartedAt) {
      return true; // Credentials were already replaced while this request was in flight.
    }
    if (this.inFlightReload) {
      await this.inFlightReload;
      return true;
    }
    if (Date.now() - this.lastReloadAt < CREDENTIAL_RELOAD_COOLDOWN_MS) {
      console.error(`[TDX Auth] 401 again inside the reload cooldown -- credentials look genuinely bad`);
      return false;
    }

    this.inFlightReload = this.reloadCredentials();
    try {
      await this.inFlightReload;
    } finally {
      this.inFlightReload = null;
    }
    return true;
  }

  private async reloadCredentials(): Promise<void> {
    console.error(`[TDX Auth] HTTP 401 from TDX -- discarding cached token and re-reading credentials`);
    this.token = null;
    this.tokenExpiry = 0;

    try {
      this.config = await this.reloadConfig();
      console.error(`[TDX Auth] Credentials re-read`);
    } catch (err) {
      // Keep the old credentials; dropping the token alone may still be enough to recover.
      console.error(`[TDX Auth] Credential reload failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    this.lastReloadAt = Date.now();
  }

  private async refresh(): Promise<string> {
    const controller = new AbortController();
    const authUrl = `${this.config.baseUrl}/auth/loginadmin`;
    console.error(`[TDX Auth] Starting refresh: POST ${authUrl}`);
    
    const timeoutId = setTimeout(() => {
      console.error(`[TDX Auth] ⚠️ TIMEOUT: Auth request exceeded 30s, aborting...`);
      controller.abort();
    }, 30000); // 30s timeout for auth
    
    try {
      console.error(`[TDX Auth] Sending auth request at ${new Date().toISOString()}`);
      const fetchPromise = fetch(authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          BEID: this.config.beid,
          WebServicesKey: this.config.webServicesKey,
        }),
        signal: controller.signal,
      });
      
      const res = await fetchPromise;
      console.error(`[TDX Auth] ✅ Response received at ${new Date().toISOString()}: HTTP ${res.status}`);

      if (!res.ok) {
        // This request carried the BEID and web services key, so the response may quote them back.
        const body = redactSecrets(await res.text(), [this.config.webServicesKey, this.config.beid]);
        console.error(`[TDX Auth] ❌ Auth failed (${res.status}): ${body.slice(0, 200)}`);
        throw new Error(`TDX admin auth failed (${res.status})`);
      }

      this.token = await res.text();
      this.tokenExpiry = Date.now() + TOKEN_LIFETIME_MS;
      console.error(`[TDX Auth] ✅ Token obtained successfully (expires in 23h)`);
      return this.token;
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          console.error(`[TDX Auth] ❌ Request aborted (timeout or manual abort)`);
          throw new Error(`TDX auth timeout after 30s`);
        }
        console.error(`[TDX Auth] ❌ Auth error: ${err.message}`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      console.error(`[TDX Auth] Refresh attempt completed`);
    }
  }
}
