import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TdxClient } from "../tdx-client.js";
import { clampMaxResults } from "../config.js";

export function registerPeopleReadOnlyTools(server: McpServer, client: TdxClient) {
  server.tool(
    "tdx-people-get",
    "Get a TDX person by UID",
    {
      uid: z.string().describe("Person UID"),
    },
    async (params) => {
      try {
        const result = await client.get(`/people/${params.uid}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-people-search",
    "Search TDX people with filters",
    {
      searchText: z.string().optional().describe("Full-text search query"),
      lastName: z.string().optional().describe("Filter by last name"),
      firstName: z.string().optional().describe("Filter by first name"),
      primaryEmail: z.string().optional().describe("Filter by primary email"),
      userName: z.string().optional().describe("Filter by username"),
      isActive: z.boolean().optional().describe("Filter by active status"),
      isEmployee: z.boolean().optional().describe("Filter by employee status"),
      accountIds: z.array(z.number()).optional().describe("Filter by account IDs"),
      maxResults: z.number().int().min(1).optional().describe("Max results to return (default 25, capped by server limit)"),
    },
    async (params) => {
      const body: Record<string, unknown> = {};
      if (params.searchText !== undefined) body.SearchText = params.searchText;
      if (params.lastName !== undefined) body.LastName = params.lastName;
      if (params.firstName !== undefined) body.FirstName = params.firstName;
      if (params.primaryEmail !== undefined) body.PrimaryEmail = params.primaryEmail;
      if (params.userName !== undefined) body.UserName = params.userName;
      if (params.isActive !== undefined) body.IsActive = params.isActive;
      if (params.isEmployee !== undefined) body.IsEmployee = params.isEmployee;
      if (params.accountIds !== undefined) body.AccountIDs = params.accountIds;
      // Always cap MaxResults - if TDX ignores/ misapplies a filter (observed with
      // primaryEmail), an uncapped request returns the entire people directory (10MB+).
      body.MaxResults = clampMaxResults(params.maxResults, 25);
      try {
        const result = await client.post("/people/search", body);
        // Trim to essential fields - full person records carry dozens of unused fields
        const people = Array.isArray(result)
          ? result.map((p: Record<string, unknown>) => ({
              UID: p.UID,
              FullName: p.FullName,
              PrimaryEmail: p.PrimaryEmail,
              UserName: p.UserName,
              IsActive: p.IsActive,
              IsEmployee: p.IsEmployee,
              DefaultAccountName: p.DefaultAccountName,
              Title: p.Title,
              ReportsToFullName: p.ReportsToFullName,
            }))
          : result;
        return { content: [{ type: "text", text: JSON.stringify(people, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-people-lookup",
    "Quick lookup of TDX people by search string (name, email, or username)",
    {
      searchText: z.string().describe("Search string (name, email, or username)"),
      maxResults: z.number().int().min(1).optional().describe("Max results to return (default 10, capped by server limit)"),
    },
    async (params) => {
      const query: Record<string, string> = {
        searchText: params.searchText,
        maxResults: String(clampMaxResults(params.maxResults, 10)),
      };
      try {
        const result = await client.get("/people/lookup", query);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
}

export function registerPeopleTools(server: McpServer, client: TdxClient) {
  server.tool(
    "tdx-people-update",
    "Update a TDX person",
    {
      uid: z.string().describe("Person UID"),
      data: z.record(z.unknown()).describe("Person data (PascalCase TDX field names)"),
    },
    async (params) => {
      try {
        const result = await client.post(`/people/${params.uid}`, params.data);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
}
