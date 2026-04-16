import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TdxClient } from "../tdx-client.js";

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
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-project-get",
    "Get a TDX project by ID",
    {
      id: z.number().describe("Project ID"),
    },
    async (params) => {
      try {
        const result = await client.get(`/projects/${params.id}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
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
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-project-search",
    "Search TDX projects with filters",
    {
      searchText: z.string().optional().describe("Full-text search query"),
      statusIds: z.array(z.number()).optional().describe("Filter by status IDs"),
      priorityIds: z.array(z.number()).optional().describe("Filter by priority IDs"),
      accountIds: z.array(z.number()).optional().describe("Filter by account IDs"),
      managerUids: z.array(z.string()).optional().describe("Filter by project manager UIDs"),
      isActive: z.boolean().optional().describe("Filter by active status"),
      maxResults: z.number().optional().describe("Max results to return (default 25)"),
    },
    async (params) => {
      const body: Record<string, unknown> = {};
      if (params.searchText !== undefined) body.SearchText = params.searchText;
      if (params.statusIds !== undefined) body.StatusIDs = params.statusIds;
      if (params.priorityIds !== undefined) body.PriorityIDs = params.priorityIds;
      if (params.accountIds !== undefined) body.AccountIDs = params.accountIds;
      if (params.managerUids !== undefined) body.ManagerUids = params.managerUids;
      if (params.isActive !== undefined) body.IsActive = params.isActive;
      if (params.maxResults !== undefined) body.MaxResults = params.maxResults;
      try {
        const result = await client.post("/projects/search", body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
}
