import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TdxClient } from "../tdx-client.js";

// Ticket count tool (always registered)
export function registerTicketCountTools(server: McpServer, client: TdxClient) {
  console.error("[TDX-MCP] Starting registerTicketCountTools registration...");
  const defaultAppId = client.appId;

  server.tool(
    "tdx-ticket-count",
    "Get count of TDX tickets matching filters with optional preview (returns count + up to 200 matching tickets). IMPORTANT: For ID-based filters (statusIds, priorityIds, accountIds, responsibleGroupIds), first use metadata lookup tools: tdx-statuses-get for statuses, tdx-account-search for accounts, tdx-group-search for groups, tdx-people-search for person UIDs.",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      searchText: z.string().optional().describe("Full-text search query"),
      statusIds: z.array(z.number()).optional().describe("Filter by status IDs. First call tdx-statuses-get (componentType: 'tickets') to resolve status name (e.g., 'Open') to ID"),
      priorityIds: z.array(z.number()).optional().describe("Filter by priority IDs. Prioritization schemes depend on TDX configuration"),
      typeIds: z.array(z.number()).optional().describe("Filter by type IDs. Ticket types depend on TDX configuration"),
      accountIds: z.array(z.number()).optional().describe("Filter by account/department IDs. First call tdx-account-search to resolve department name to ID"),
      responsibleUids: z.array(z.string()).optional().describe("Filter by responsible person UIDs. First call tdx-people-search to resolve person name to UID"),
      responsibleGroupIds: z.array(z.number()).optional().describe("Filter by responsible group IDs. First call tdx-group-search to resolve group name to ID"),
      requestorUids: z.array(z.string()).optional().describe("Filter by requestor UIDs. First call tdx-people-search to resolve person name to UID"),
      createdDateStart: z.string().optional().describe("Filter by creation date start (ISO 8601 format)"),
      createdDateEnd: z.string().optional().describe("Filter by creation date end (ISO 8601 format)"),
      modifiedDateStart: z.string().optional().describe("Filter by modification date start (ISO 8601 format)"),
      modifiedDateEnd: z.string().optional().describe("Filter by modification date end (ISO 8601 format)"),
      respondByDateStart: z.string().optional().describe("Filter by respond by date start (ISO 8601 format)"),
      respondByDateEnd: z.string().optional().describe("Filter by respond by date end (ISO 8601 format)"),
      closeByDateStart: z.string().optional().describe("Filter by resolve by date start (ISO 8601 format)"),
      closeByDateEnd: z.string().optional().describe("Filter by resolve by date end (ISO 8601 format)"),
      closedDateStart: z.string().optional().describe("Filter by closed date start (ISO 8601 format)"),
      closedDateEnd: z.string().optional().describe("Filter by closed date end (ISO 8601 format)"),
      respondedDateStart: z.string().optional().describe("Filter by responded date start (ISO 8601 format)"),
      respondedDateEnd: z.string().optional().describe("Filter by responded date end (ISO 8601 format)"),
      maxSummaryResults: z.number().optional().describe("Max tickets to include in response (default: 200)"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      const body: Record<string, unknown> = {};
      if (params.searchText !== undefined) body.SearchText = params.searchText;
      if (params.statusIds !== undefined) body.StatusIDs = params.statusIds;
      if (params.priorityIds !== undefined) body.PriorityIDs = params.priorityIds;
      if (params.typeIds !== undefined) body.TypeIDs = params.typeIds;
      if (params.accountIds !== undefined) body.AccountIDs = params.accountIds;
      if (params.responsibleUids !== undefined) body.ResponsibilityUids = params.responsibleUids;
      if (params.responsibleGroupIds !== undefined) body.ResponsibilityGroupIDs = params.responsibleGroupIds;
      if (params.requestorUids !== undefined) body.RequestorUids = params.requestorUids;
      if (params.createdDateStart !== undefined) body.CreatedDateFrom = params.createdDateStart;
      if (params.createdDateEnd !== undefined) body.CreatedDateTo = params.createdDateEnd;
      if (params.modifiedDateStart !== undefined) body.ModifiedDateFrom = params.modifiedDateStart;
      if (params.modifiedDateEnd !== undefined) body.ModifiedDateTo = params.modifiedDateEnd;
      if (params.respondByDateStart !== undefined) body.RespondByDateFrom = params.respondByDateStart;
      if (params.respondByDateEnd !== undefined) body.RespondByDateTo = params.respondByDateEnd;
      if (params.closeByDateStart !== undefined) body.CloseByDateFrom = params.closeByDateStart;
      if (params.closeByDateEnd !== undefined) body.CloseByDateTo = params.closeByDateEnd;
      if (params.closedDateStart !== undefined) body.ClosedDateFrom = params.closedDateStart;
      if (params.closedDateEnd !== undefined) body.ClosedDateTo = params.closedDateEnd;
      if (params.respondedDateStart !== undefined) body.RespondedDateFrom = params.respondedDateStart;
      if (params.respondedDateEnd !== undefined) body.RespondedDateTo = params.respondedDateEnd;

      // Default maxResults to 200 for count tool (to include preview tickets)
      // Use same date filter detection as search tool for consistency
      const hasDateFilter = params.createdDateStart !== undefined || params.createdDateEnd !== undefined ||
                            params.modifiedDateStart !== undefined || params.modifiedDateEnd !== undefined ||
                            params.respondByDateStart !== undefined || params.respondByDateEnd !== undefined ||
                            params.closeByDateStart !== undefined || params.closeByDateEnd !== undefined ||
                            params.closedDateStart !== undefined || params.closedDateEnd !== undefined ||
                            params.respondedDateStart !== undefined || params.respondedDateEnd !== undefined;
      const defaultMaxResults = hasDateFilter ? 5000 : 200;
      body.MaxResults = params.maxSummaryResults ?? defaultMaxResults;

      try {
        const result = await client.post(`/${app}/tickets/search`, body);
        
        if (!Array.isArray(result)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: "Unexpected response format from TDX API", count: 0, tickets: [] }, null, 2),
              },
            ],
            isError: true,
          };
        }

        // Filter to essential fields only for preview (to reduce context window bloat)
        // Keep only fields needed by agent to understand ticket status and drill down
        const previewTickets = result.map((ticket: Record<string, unknown>) => ({
          ID: ticket.ID,
          Title: ticket.Title,
          StatusName: ticket.StatusName,
          PriorityName: ticket.PriorityName,
          CreatedDate: ticket.CreatedDate,
          ResponsibleFullName: ticket.ResponsibleFullName,
          ResponsibleGroupName: ticket.ResponsibleGroupName,
          RequestorName: ticket.RequestorName,
          AccountName: ticket.AccountName,
          webLink: client.getTicketWebLink(ticket.ID as number, app),
        }));

        // Return count + filtered preview tickets
        const response = {
          count: result.length,
          tickets: previewTickets,
        };

        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
  console.error("[TDX-MCP] Registered tdx-ticket-count");
}
