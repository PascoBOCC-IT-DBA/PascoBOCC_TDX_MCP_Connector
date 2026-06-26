import { TdxConfig } from "./config.js";

const TOKEN_LIFETIME_MS = 23 * 60 * 60 * 1000; // 23 hours (1h buffer before 24h expiry)

export class TdxAuth {
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private config: TdxConfig;

  constructor(config: TdxConfig) {
    this.config = config;
  }

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) {
      console.error(`[TDX Auth] Using cached token (expires in ${Math.round((this.tokenExpiry - Date.now()) / 1000)}s)`);
      return this.token;
    }
    console.error(`[TDX Auth] Token missing or expired, refreshing...`);
    return this.refresh();
  }

  private async refresh(): Promise<string> {
    const controller = new AbortController();
    const authUrl = `${this.config.baseUrl}/auth/loginadmin`;
    console.error(`[TDX Auth] Starting refresh: POST ${authUrl}`);
    console.error(`[TDX Auth] BEID: ${this.config.beid}`);
    
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
        const body = await res.text();
        console.error(`[TDX Auth] ❌ Auth failed: ${body}`);
        throw new Error(`TDX admin auth failed (${res.status}): ${body}`);
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
