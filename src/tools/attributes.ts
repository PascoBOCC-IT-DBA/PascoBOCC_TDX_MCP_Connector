import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TdxClient } from "../tdx-client.js";

export function registerAttributeTools(server: McpServer, client: TdxClient) {
  server.tool(
    "tdx-attributes-get",
    "Get custom attribute definitions for a TDX component (e.g. tickets, assets, CIs). Returns attribute IDs, names, types, and choices needed for creating/updating items with custom attributes.",
    {
      componentId: z.number().describe("Component ID (e.g. 9=Ticket, 27=Asset, 63=CI, 39=KBArticle, 2=Project)"),
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      associatedTypeId: z.number().optional().describe("Filter by associated type ID"),
    },
    async (params) => {
      const app = params.appId ?? client.appId;
      const query: Record<string, string> = {};
      if (params.associatedTypeId !== undefined) {
        query.associatedTypeId = String(params.associatedTypeId);
      }
      try {
        const result = await client.get(`/attributes/custom?componentId=${params.componentId}&appId=${app}`, query);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
}
