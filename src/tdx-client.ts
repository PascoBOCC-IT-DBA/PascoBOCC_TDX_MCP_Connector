import { TdxAuth } from "./auth.js";
import { TdxConfig } from "./config.js";

export class TdxClient {
  private auth: TdxAuth;
  private baseUrl: string;
  public appId: number;
  public assetsAppId?: number;

  constructor(config: TdxConfig) {
    this.auth = new TdxAuth(config);
    this.baseUrl = config.baseUrl;
    this.appId = config.appId;
    this.assetsAppId = config.assetsAppId;
  }

  async request(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>
  ): Promise<unknown> {
    const token = await this.auth.getToken();
    let url = `${this.baseUrl}${path}`;

    if (query) {
      const params = new URLSearchParams(query);
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`TDX API error ${res.status} ${method} ${path}: ${text}`);
    }

    const text = await res.text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return text;
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
