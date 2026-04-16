import { TdxAuth } from "./auth.js";
import { TdxConfig } from "./config.js";

export class TdxClient {
  private auth: TdxAuth;
  private baseUrl: string;
  public appId: number;

  constructor(config: TdxConfig) {
    this.auth = new TdxAuth(config);
    this.baseUrl = config.baseUrl;
    this.appId = config.appId;
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
}
