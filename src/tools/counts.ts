import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TdxClient } from "../tdx-client.js";
import { loadMaxResultsLimits } from "../config.js";
import { filterByResponsibleUid } from "./ticket-filters.js";

// Ticket count tool (always registered)
export function registerTicketCountTools(server: McpServer, client: TdxClient) {
  console.error("[TDX-MCP] Starting registerTicketCountTools registration...");
  const defaultAppId = client.appId;

  server.tool(
    "tdx-ticket-count",
    "Get count of TDX tickets matching filters, plus a preview of the matches. 'count' always reflects the full match set and is NOT limited by maxSummaryResults, which only controls how many tickets appear in the preview array. Check 'countIsExact' -- if false, the match set exceeded the server scan ceiling and 'count' is a floor. IMPORTANT: For ID-based filters (statusIds, priorityIds, accountIds, responsibleGroupIds), first use metadata lookup tools: tdx-statuses-get for statuses, tdx-account-search for accounts, tdx-group-search for groups, tdx-people-search for person UIDs.",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      searchText: z.string().optional().describe("Full-text search query"),
      statusIds: z.array(z.number()).optional().describe("Filter by status IDs. First call tdx-statuses-get (componentType: 'tickets') to resolve status name (e.g., 'Open') to ID"),
      priorityIds: z.array(z.number()).optional().describe("Filter by priority IDs. Prioritization schemes depend on TDX configuration"),
      typeIds: z.array(z.number()).optional().describe("Filter by type IDs. First call tdx-ticket-types-get to resolve a type name to its ID. NOTE: IT projects are tickets of type 'Projects - IT' - use this filter (not tdx-project-search) to count a person's projects"),
      accountIds: z.array(z.number()).optional().describe("Filter by account/department IDs. First call tdx-account-search to resolve department name to ID"),
      responsibleUids: z.array(z.string()).optional().describe("Filter by responsible person UIDs. Matches the ticket's own 'Primary Responsible' person only (task-level responsibility does not count) unless includeTaskResponsibility is true. First call tdx-people-search to resolve person name to UID"),
      responsibleGroupIds: z.array(z.number()).optional().describe("Filter by responsible group IDs. Matches the ticket's own primary responsible group unless includeTaskResponsibility is true. First call tdx-group-search to resolve group name to ID"),
      includeTaskResponsibility: z.boolean().optional().describe("When true, responsibleUids/responsibleGroupIds also match tickets where the person or group is only responsible for a ticket TASK, not the ticket itself. Default false ('what is this person responsible for')"),
      requestorUids: z.array(z.string()).optional().describe("Filter by requestor UIDs (the person the ticket is FOR). Does NOT match tickets created on someone else's behalf - use createdByUid for that. First call tdx-people-search to resolve person name to UID"),
      createdByUid: z.string().optional().describe("Filter by creator/author UID (the person who physically submitted/opened the ticket). Use this instead of requestorUids when searching for tickets a specific person created, since a person can create tickets on behalf of others. First call tdx-people-search to resolve person name to UID"),
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
      maxSummaryResults: z.number().optional().describe("Max tickets to include in the preview array (default: 200). Does NOT affect the returned count"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      const body: Record<string, unknown> = {};
      if (params.searchText !== undefined) body.SearchText = params.searchText;
      if (params.statusIds !== undefined) body.StatusIDs = params.statusIds;
      if (params.priorityIds !== undefined) body.PriorityIDs = params.priorityIds;
      if (params.typeIds !== undefined) body.TypeIDs = params.typeIds;
      if (params.accountIds !== undefined) body.AccountIDs = params.accountIds;
      const includeTaskResponsibility = params.includeTaskResponsibility === true;
      if (params.responsibleUids !== undefined) {
        body[includeTaskResponsibility ? "ResponsibilityUids" : "PrimaryResponsibilityUids"] = params.responsibleUids;
      }
      if (params.responsibleGroupIds !== undefined) {
        body[includeTaskResponsibility ? "ResponsibilityGroupIDs" : "PrimaryResponsibilityGroupIDs"] = params.responsibleGroupIds;
      }
      if (params.requestorUids !== undefined) body.RequestorUids = params.requestorUids;
      if (params.createdByUid !== undefined) body.CreatedByUid = params.createdByUid;
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

      // Default preview size for the count tool based on environment.
      // Use same date filter detection as search tool for consistency
      const hasDateFilter = params.createdDateStart !== undefined || params.createdDateEnd !== undefined ||
                            params.modifiedDateStart !== undefined || params.modifiedDateEnd !== undefined ||
                            params.respondByDateStart !== undefined || params.respondByDateEnd !== undefined ||
                            params.closeByDateStart !== undefined || params.closeByDateEnd !== undefined ||
                            params.closedDateStart !== undefined || params.closedDateEnd !== undefined ||
                            params.respondedDateStart !== undefined || params.respondedDateEnd !== undefined;
      const limits = loadMaxResultsLimits();
      const previewLimit = params.maxSummaryResults ?? (hasDateFilter ? limits.counts : Math.floor(limits.counts / 2));

      // The count must reflect every match, so the API request is capped by the scan
      // ceiling rather than by how many tickets we echo back in the preview.
      const scanLimit = limits.countScan;
      body.MaxResults = scanLimit;

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

        const scanTruncated = result.length >= scanLimit;
        const { tickets: matched, applied: responsibleFilterApplied } = filterByResponsibleUid(
          result as Record<string, unknown>[],
          includeTaskResponsibility ? undefined : params.responsibleUids
        );

        // Filter to essential fields only for preview (to reduce context window bloat)
        // Keep only fields needed by agent to understand ticket status and drill down
        const previewTickets = matched.slice(0, previewLimit).map((ticket: Record<string, unknown>) => ({
          ID: ticket.ID,
          Title: ticket.Title,
          StatusName: ticket.StatusName,
          PriorityName: ticket.PriorityName,
          CreatedDate: ticket.CreatedDate,
          CreatedFullName: ticket.CreatedFullName,
          ResponsibleUid: ticket.ResponsibleUid,
          ResponsibleFullName: ticket.ResponsibleFullName,
          ResponsibleGroupID: ticket.ResponsibleGroupID,
          ResponsibleGroupName: ticket.ResponsibleGroupName,
          RequestorName: ticket.RequestorName,
          AccountName: ticket.AccountName,
          webLink: client.getTicketWebLink(ticket.ID as number, app),
        }));

        const response: Record<string, unknown> = {
          count: matched.length,
          countIsExact: !scanTruncated,
          previewCount: previewTickets.length,
          tickets: previewTickets,
        };
        if (scanTruncated) {
          response.note = `Match set hit the scan ceiling of ${scanLimit}; count is a floor, not an exact total. Narrow the filters or raise TDX_MAX_RESULTS_COUNT_SCAN.`;
        }
        if (params.responsibleUids !== undefined && !includeTaskResponsibility && !responsibleFilterApplied) {
          response.responsibleFilterWarning = "TDX did not return ResponsibleUid on these results, so the responsibleUids filter could not be narrowed to ticket-level responsibility. Results may include tickets where the person is only task-responsible.";
        }

        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
  console.error("[TDX-MCP] Registered tdx-ticket-count");
}
