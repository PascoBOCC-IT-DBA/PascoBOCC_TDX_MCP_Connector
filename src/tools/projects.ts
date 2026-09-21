import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TdxClient } from "../tdx-client.js";
import { clampMaxResults, loadMaxResultsLimits } from "../config.js";
import { toToolError } from "../errors.js";

export function registerProjectReadOnlyTools(server: McpServer, client: TdxClient) {
  server.tool(
    "tdx-project-get",
    "Get a record from the TDX Projects module by ID. WARNING: this module is nearly empty in this organization. IT project work is tracked as TICKETS of type 'Projects - IT', not here. For 'what projects is <person> working on / responsible for', use tdx-ticket-search instead (resolve the type via tdx-ticket-types-get with name 'Projects', then pass typeIds + responsibleUids).",
    {
      id: z.number().describe("Project ID"),
    },
    async (params) => {
      try {
        const result = await client.get(`/projects/${params.id}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return toToolError(e);
      }
    }
  );

  server.tool(
    "tdx-project-search",
    "Search the TDX Projects module. WARNING: this module is nearly empty in this organization and is almost never the right tool. IT project work is tracked as TICKETS of type 'Projects - IT'. For questions like 'what projects is <person> responsible for / assigned to / managing', use tdx-ticket-search: call tdx-ticket-types-get with name 'Projects' to get the type ID, then search with typeIds + responsibleUids. Only use this tool when the user explicitly means TDX Projects/portfolios/project plans.",
    {
      searchText: z.string().optional().describe("Full-text search query"),
      statusIds: z.array(z.number()).optional().describe("Filter by status IDs"),
      priorityIds: z.array(z.number()).optional().describe("Filter by priority IDs"),
      accountIds: z.array(z.number()).optional().describe("Filter by account IDs"),
      managerUids: z.array(z.string()).optional().describe("Filter by project manager UIDs. This is the project's AdminUID (project manager), NOT ticket responsibility"),
      isActive: z.boolean().optional().describe("Filter by active status"),
      createdDateStart: z.string().optional().describe("Filter by created date start (ISO 8601)"),
      createdDateEnd: z.string().optional().describe("Filter by created date end (ISO 8601)"),
      startsDateStart: z.string().optional().describe("Filter by project start date start (ISO 8601)"),
      startsDateEnd: z.string().optional().describe("Filter by project start date end (ISO 8601)"),
      maxResults: z.number().int().min(1).optional().describe("Max results to return (smart default: 300 with date filters, 50 otherwise; capped by server limit)"),
    },
    async (params) => {
      const body: Record<string, unknown> = {};
      if (params.searchText !== undefined) body.SearchText = params.searchText;
      if (params.statusIds !== undefined) body.StatusIDs = params.statusIds;
      if (params.priorityIds !== undefined) body.PriorityIDs = params.priorityIds;
      if (params.accountIds !== undefined) body.AccountIDs = params.accountIds;
      if (params.managerUids !== undefined) body.ManagerUids = params.managerUids;
      if (params.isActive !== undefined) body.IsActive = params.isActive;
      if (params.createdDateStart !== undefined) body.CreatedDateFrom = params.createdDateStart;
      if (params.createdDateEnd !== undefined) body.CreatedDateTo = params.createdDateEnd;
      if (params.startsDateStart !== undefined) body.Starts = params.startsDateStart;
      if (params.startsDateEnd !== undefined) body.Ends = params.startsDateEnd;
      const hasDateFilter = params.createdDateStart !== undefined || params.createdDateEnd !== undefined || params.startsDateStart !== undefined || params.startsDateEnd !== undefined;
      const limits = loadMaxResultsLimits();
      const defaultMaxResults = hasDateFilter ? limits.withFilter : limits.withoutFilter;
      body.MaxResults = clampMaxResults(params.maxResults, defaultMaxResults);
      try {
        const result = await client.post("/projects/search", body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return toToolError(e);
      }
    }
  );
}

export function registerProjectTools(server: McpServer, client: TdxClient) {
  server.tool(
    "tdx-project-create",
    "Create a new TDX project",
    {
      name: z.string().describe("Project name"),
      description: z.string().optional().describe("Project description"),
      accountId: z.number().optional().describe("Account/department ID"),
      priorityId: z.number().optional().describe("Priority ID"),
      statusId: z.number().optional().describe("Status ID"),
      managerId: z.string().optional().describe("Project manager UID"),
      startDate: z.string().optional().describe("Start date (ISO)"),
      endDate: z.string().optional().describe("End date (ISO)"),
      budgetedHours: z.number().optional().describe("Budgeted hours"),
      estimatedHours: z.number().optional().describe("Estimated hours"),
      attributes: z.array(z.object({
        id: z.number().describe("Custom attribute ID"),
        value: z.union([z.string(), z.number(), z.boolean()]).describe("Attribute value"),
      })).optional().describe("Custom attributes"),
    },
    async (params) => {
      const body: Record<string, unknown> = {
        Name: params.name,
      };
      if (params.description !== undefined) body.Description = params.description;
      if (params.accountId !== undefined) body.AccountID = params.accountId;
      if (params.priorityId !== undefined) body.PriorityID = params.priorityId;
      if (params.statusId !== undefined) body.StatusID = params.statusId;
      if (params.managerId !== undefined) body.ManagerUID = params.managerId;
      if (params.startDate !== undefined) body.StartDate = params.startDate;
      if (params.endDate !== undefined) body.EndDate = params.endDate;
      if (params.budgetedHours !== undefined) body.BudgetedHours = params.budgetedHours;
      if (params.estimatedHours !== undefined) body.EstimatedHours = params.estimatedHours;
      if (params.attributes) {
        body.Attributes = params.attributes.map((a) => ({ ID: a.id, Value: String(a.value) }));
      }
      try {
        const result = await client.post("/projects", body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return toToolError(e);
      }
    }
  );

  server.tool(
    "tdx-project-update",
    "Update a TDX project",
    {
      id: z.number().describe("Project ID"),
      data: z.record(z.unknown()).describe("Project data (PascalCase TDX field names)"),
    },
    async (params) => {
      try {
        const result = await client.post(`/projects/${params.id}`, params.data);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return toToolError(e);
      }
    }
  );
}
