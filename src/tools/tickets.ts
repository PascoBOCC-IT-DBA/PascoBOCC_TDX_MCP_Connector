import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TdxClient } from "../tdx-client.js";

// Read-only ticket tools (always registered)
export function registerTicketReadOnlyTools(server: McpServer, client: TdxClient) {
  console.error("[TDX-MCP] Starting registerTicketReadOnlyTools registration...");
  const defaultAppId = client.appId;
  console.error(`[TDX-MCP] defaultAppId: ${defaultAppId}`);
  console.error(`[TDX-MCP] server type: ${typeof server}`);
  console.error(`[TDX-MCP] About to register tdx-ticket-get...`);
  
  try {
    server.tool(
      "tdx-ticket-get",
      "Get a TDX ticket by ID",
      {
        appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
        id: z.number().describe("Ticket ID"),
      },
      async (params) => {
        const app = params.appId ?? defaultAppId;
        try {
          const result = await client.get(`/${app}/tickets/${params.id}`);
          const ticket = typeof result === 'object' && result !== null ? result as Record<string, unknown> : {};
          ticket.webLink = client.getTicketWebLink(params.id, app);
          return { content: [{ type: "text", text: JSON.stringify(ticket, null, 2) }] };
        } catch (e: unknown) {
          return { content: [{ type: "text", text: String(e) }], isError: true };
        }
      }
    );
    console.error("[TDX-MCP] Registered tdx-ticket-get successfully");
  } catch (err: unknown) {
    console.error(`[TDX-MCP] ERROR registering tdx-ticket-get: ${String(err)}`);
  }

  server.tool(
    "tdx-ticket-search",
    "Search TDX tickets with filters",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      searchText: z.string().optional().describe("Full-text search query"),
      statusIds: z.array(z.number()).optional().describe("Filter by status IDs"),
      priorityIds: z.array(z.number()).optional().describe("Filter by priority IDs"),
      typeIds: z.array(z.number()).optional().describe("Filter by type IDs"),
      accountIds: z.array(z.number()).optional().describe("Filter by account IDs"),
      responsibleUids: z.array(z.string()).optional().describe("Filter by responsible person UIDs"),
      responsibleGroupIds: z.array(z.number()).optional().describe("Filter by responsible group IDs"),
      requestorUids: z.array(z.string()).optional().describe("Filter by requestor UIDs"),
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
      maxResults: z.number().optional().describe("Max results to return (smart default: 5000 with date filters, 100 otherwise)"),
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
      
      // Smart maxResults default: 5000 if date filters present, 100 otherwise
      const hasDateFilter = params.createdDateStart !== undefined || params.createdDateEnd !== undefined ||
                            params.modifiedDateStart !== undefined || params.modifiedDateEnd !== undefined ||
                            params.respondByDateStart !== undefined || params.respondByDateEnd !== undefined ||
                            params.closeByDateStart !== undefined || params.closeByDateEnd !== undefined ||
                            params.closedDateStart !== undefined || params.closedDateEnd !== undefined ||
                            params.respondedDateStart !== undefined || params.respondedDateEnd !== undefined;
      const defaultMaxResults = hasDateFilter ? 5000 : 100;
      body.MaxResults = params.maxResults ?? defaultMaxResults;
      try {
        const result = await client.post(`/${app}/tickets/search`, body);
        // Add webLinks to each ticket in the results
        if (Array.isArray(result)) {
          result.forEach((ticket) => {
            if (typeof ticket === 'object' && ticket !== null && 'ID' in ticket) {
              (ticket as Record<string, unknown>).webLink = client.getTicketWebLink((ticket as Record<string, unknown>).ID as number, app);
            }
          });
        }
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
  console.error("[TDX-MCP] Registered tdx-ticket-search");

  server.tool(
    "tdx-ticket-feed-get",
    "Get the feed/comments for a TDX ticket",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      id: z.number().describe("Ticket ID"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      try {
        const result = await client.get(`/${app}/tickets/${params.id}/feed`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
}

// Modification ticket tools (conditional registration)
export function registerTicketTools(server: McpServer, client: TdxClient) {
  const defaultAppId = client.appId;

  server.tool(
    "tdx-ticket-create",
    "Create a new TDX ticket",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      typeId: z.number().describe("Ticket type ID"),
      title: z.string().describe("Ticket title"),
      description: z.string().optional().describe("Ticket description (HTML)"),
      accountId: z.number().optional().describe("Account/department ID"),
      priorityId: z.number().optional().describe("Priority ID"),
      statusId: z.number().optional().describe("Status ID"),
      requestorUid: z.string().optional().describe("Requestor person UID"),
      responsibleUid: z.string().optional().describe("Responsible person UID"),
      responsibleGroupId: z.number().optional().describe("Responsible group ID"),
      formId: z.number().optional().describe("Form ID"),
      sourceId: z.number().optional().describe("Source ID"),
      serviceId: z.number().optional().describe("Service ID"),
      goesOffHoldDate: z.string().optional().describe("ISO date when ticket goes off hold"),
      attributes: z.array(z.object({
        id: z.number().describe("Custom attribute ID"),
        value: z.union([z.string(), z.number(), z.boolean()]).describe("Attribute value"),
      })).optional().describe("Custom attributes"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      const body: Record<string, unknown> = {
        TypeID: params.typeId,
        Title: params.title,
      };
      if (params.description !== undefined) body.Description = params.description;
      if (params.accountId !== undefined) body.AccountID = params.accountId;
      if (params.priorityId !== undefined) body.PriorityID = params.priorityId;
      if (params.statusId !== undefined) body.StatusID = params.statusId;
      if (params.requestorUid !== undefined) body.RequestorUid = params.requestorUid;
      if (params.responsibleUid !== undefined) body.ResponsibleUid = params.responsibleUid;
      if (params.responsibleGroupId !== undefined) body.ResponsibleGroupID = params.responsibleGroupId;
      if (params.formId !== undefined) body.FormID = params.formId;
      if (params.sourceId !== undefined) body.SourceID = params.sourceId;
      if (params.serviceId !== undefined) body.ServiceID = params.serviceId;
      if (params.goesOffHoldDate !== undefined) body.GoesOffHoldDate = params.goesOffHoldDate;
      if (params.attributes) {
        body.Attributes = params.attributes.map((a) => ({ ID: a.id, Value: String(a.value) }));
      }
      try {
        const result = await client.post(`/${app}/tickets`, body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-ticket-update",
    "Full update of a TDX ticket (replaces all fields)",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      id: z.number().describe("Ticket ID"),
      data: z.record(z.unknown()).describe("Full ticket data (PascalCase TDX field names)"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      try {
        const result = await client.post(`/${app}/tickets/${params.id}`, params.data);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-ticket-patch",
    "Partial update of a TDX ticket (only specified fields)",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      id: z.number().describe("Ticket ID"),
      data: z.record(z.unknown()).describe("Partial ticket data (PascalCase TDX field names)"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      try {
        const result = await client.patch(`/${app}/tickets/${params.id}`, params.data);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-ticket-feed-add",
    "Add a comment/feed entry to a TDX ticket",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      id: z.number().describe("Ticket ID"),
      comments: z.string().describe("Comment text (HTML supported)"),
      isPrivate: z.boolean().optional().describe("Whether the comment is private (default false)"),
      notify: z.array(z.string()).optional().describe("UIDs to notify"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      const body: Record<string, unknown> = {
        Comments: params.comments,
      };
      if (params.isPrivate !== undefined) body.IsPrivate = params.isPrivate;
      if (params.notify !== undefined) body.Notify = params.notify;
      try {
        const result = await client.post(`/${app}/tickets/${params.id}/feed`, body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-ticket-add-asset",
    "Link an asset to a TDX ticket",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      id: z.number().describe("Ticket ID"),
      assetId: z.number().describe("Asset ID to link"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      try {
        const result = await client.post(`/${app}/tickets/${params.id}/assets/${params.assetId}`);
        return { content: [{ type: "text", text: JSON.stringify(result ?? "Asset linked successfully", null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-ticket-add-contact",
    "Add a contact to a TDX ticket",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      id: z.number().describe("Ticket ID"),
      uid: z.string().describe("Person UID to add as contact"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      try {
        const result = await client.post(`/${app}/tickets/${params.id}/contacts/${params.uid}`);
        return { content: [{ type: "text", text: JSON.stringify(result ?? "Contact added successfully", null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
}
