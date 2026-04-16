import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TdxClient } from "../tdx-client.js";

export function registerStatusTools(server: McpServer, client: TdxClient) {
  const defaultAppId = client.appId;

  server.tool(
    "tdx-statuses-get",
    "Get available statuses for a TDX component type (tickets, assets, projects, CIs, etc.)",
    {
      componentType: z
        .enum(["tickets", "assets", "projects", "cmdb", "knowledgebase"])
        .describe("Component type to get statuses for: tickets, assets, projects, cmdb, or knowledgebase"),
      appId: z
        .number()
        .optional()
        .describe("TDX app ID (defaults to env TDX_APP_ID). Not applicable for knowledgebase."),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      let path: string;

      // Build the appropriate path based on component type
      switch (params.componentType) {
        case "tickets":
          path = `/${app}/tickets/statuses`;
          break;
        case "assets":
          path = `/${app}/assets/statuses`;
          break;
        case "projects":
          path = `/projects/statuses`;
          break;
        case "cmdb":
          path = `/${app}/cmdb/statuses`;
          break;
        case "knowledgebase":
          path = `/${app}/knowledgebase/statuses`;
          break;
        default:
          return {
            content: [
              {
                type: "text",
                text: `Unknown component type: ${params.componentType}`,
              },
            ],
            isError: true,
          };
      }

      try {
        const result = await client.get(path);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
}
