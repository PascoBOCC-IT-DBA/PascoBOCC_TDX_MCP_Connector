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
      return this.token;
    }
    return this.refresh();
  }

  private async refresh(): Promise<string> {
    const res = await fetch(`${this.config.baseUrl}/auth/loginadmin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        BEID: this.config.beid,
        WebServicesKey: this.config.webServicesKey,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`TDX admin auth failed (${res.status}): ${body}`);
    }

    this.token = await res.text();
    this.tokenExpiry = Date.now() + TOKEN_LIFETIME_MS;
    return this.token;
  }
}
