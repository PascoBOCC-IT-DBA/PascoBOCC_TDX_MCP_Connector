import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TdxClient } from "../tdx-client.js";
import { clampMaxResults } from "../config.js";
import { toToolError } from "../errors.js";

export function registerGroupTools(server: McpServer, client: TdxClient) {
  server.tool(
    "tdx-group-get",
    "Get a TDX group by ID",
    {
      id: z.number().describe("Group ID"),
    },
    async (params) => {
      try {
        const result = await client.get(`/groups/${params.id}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return toToolError(e);
      }
    }
  );

  server.tool(
    "tdx-group-search",
    "Search TDX groups",
    {
      searchText: z.string().optional().describe("Full-text search query"),
      isActive: z.boolean().optional().describe("Filter by active status"),
      hasAppId: z.number().optional().describe("Filter by associated app ID"),
      maxResults: z.number().int().min(1).optional().describe("Max results to return (default 25, capped by server limit)"),
    },
    async (params) => {
      const body: Record<string, unknown> = {};
      if (params.searchText !== undefined) body.NameLike = params.searchText;
      if (params.isActive !== undefined) body.IsActive = params.isActive;
      if (params.hasAppId !== undefined) body.HasAppID = params.hasAppId;
      // Always cap MaxResults - TDX returns the entire unfiltered set if a filter is ignored/unmatched
      body.MaxResults = clampMaxResults(params.maxResults, 25);
      try {
        const result = await client.post("/groups/search", body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return toToolError(e);
      }
    }
  );
}
