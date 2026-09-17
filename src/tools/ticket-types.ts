import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TdxClient } from "../tdx-client.js";

export function registerTicketTypeTools(server: McpServer, client: TdxClient) {
  server.tool(
    "tdx-ticket-types-get",
    "Look up TDX ticket types (Incident, Service Request, etc.). Use this to resolve a ticket type name to the numeric ID required by the typeIds filter on tdx-ticket-search and tdx-ticket-count. Omit all optional params to list every type.",
    {
      id: z.number().optional().describe("Fetch a single ticket type by its ID"),
      name: z
        .string()
        .optional()
        .describe("Case-insensitive substring filter on the type name (ignored when id is supplied)"),
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
    },
    async (params) => {
      const app = params.appId ?? client.appId;
      const path =
        params.id !== undefined ? `/${app}/tickets/types/${params.id}` : `/${app}/tickets/types`;

      try {
        const result = await client.get(path);

        if (params.id === undefined && params.name && Array.isArray(result)) {
          const needle = params.name.trim().toLowerCase();
          const matches = (result as Array<Record<string, unknown>>).filter((t) =>
            String(t.Name ?? "").toLowerCase().includes(needle)
          );
          return { content: [{ type: "text", text: JSON.stringify(matches, null, 2) }] };
        }

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
}
