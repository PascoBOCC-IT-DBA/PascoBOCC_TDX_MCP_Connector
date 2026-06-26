import { TdxAuth } from "./auth.js";
import { TdxConfig } from "./config.js";

export class TdxClient {
  private auth: TdxAuth;
  private baseUrl: string;
  public appId: number;
  public assetsAppId?: number;
  public kbAppId?: number;

  constructor(config: TdxConfig) {
    this.auth = new TdxAuth(config);
    this.baseUrl = config.baseUrl;
    this.appId = config.appId;
    this.assetsAppId = config.assetsAppId;
    this.kbAppId = config.kbAppId;
  }

  async request(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>
  ): Promise<unknown> {
    console.error(`[TDX Client] ${method} ${path} - getting token...`);
    const startTime = Date.now();
    
    try {
      const token = await this.auth.getToken();
      const authTime = Date.now() - startTime;
      console.error(`[TDX Client] Token obtained in ${authTime}ms`);
      
      let url = `${this.baseUrl}${path}`;

      if (query) {
        const params = new URLSearchParams(query);
        url += `?${params.toString()}`;
      }

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

      if (!res.ok) {
        const text = await res.text();
        console.error(`[TDX Client] ❌ API error: ${text.substring(0, 100)}`);
        throw new Error(`TDX API error ${res.status} ${method} ${path}: ${text}`);
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
