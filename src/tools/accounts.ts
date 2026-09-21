import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TdxClient } from "../tdx-client.js";
import { clampMaxResults } from "../config.js";

export function registerAccountTools(server: McpServer, client: TdxClient) {
  server.tool(
    "tdx-account-get",
    "Get a TDX account/department by ID",
    {
      id: z.number().describe("Account ID"),
    },
    async (params) => {
      try {
        const result = await client.get(`/accounts/${params.id}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-account-search",
    "Search TDX accounts/departments",
    {
      searchText: z.string().optional().describe("Full-text search query"),
      isActive: z.boolean().optional().describe("Filter by active status"),
      maxResults: z.number().int().min(1).optional().describe("Max results to return (default 25, capped by server limit)"),
    },
    async (params) => {
      const body: Record<string, unknown> = {};
      if (params.searchText !== undefined) body.SearchText = params.searchText;
      if (params.isActive !== undefined) body.IsActive = params.isActive;
      // Always cap MaxResults - TDX returns the entire unfiltered set if a filter is ignored/unmatched
      body.MaxResults = clampMaxResults(params.maxResults, 25);
      try {
        const result = await client.post("/accounts/search", body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
}
