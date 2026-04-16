import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TdxClient } from "../tdx-client.js";

export function registerKbTools(server: McpServer, client: TdxClient) {
  const defaultAppId = client.appId;

  server.tool(
    "tdx-kb-create",
    "Create a new TDX knowledge base article",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      categoryId: z.number().describe("KB category ID"),
      subject: z.string().describe("Article subject/title"),
      body: z.string().describe("Article body (HTML)"),
      summary: z.string().optional().describe("Article summary"),
      status: z.number().optional().describe("Article status (0=None, 1=Draft, 2=Approved, 3=Archived)"),
      order: z.number().optional().describe("Sort order"),
      reviewDate: z.string().optional().describe("Review date (ISO)"),
      ownerUid: z.string().optional().describe("Owner person UID"),
      ownerGroupId: z.number().optional().describe("Owner group ID"),
      tags: z.array(z.string()).optional().describe("Tags"),
      attributes: z.array(z.object({
        id: z.number().describe("Custom attribute ID"),
        value: z.union([z.string(), z.number(), z.boolean()]).describe("Attribute value"),
      })).optional().describe("Custom attributes"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      const body: Record<string, unknown> = {
        CategoryID: params.categoryId,
        Subject: params.subject,
        Body: params.body,
      };
      if (params.summary !== undefined) body.Summary = params.summary;
      if (params.status !== undefined) body.Status = params.status;
      if (params.order !== undefined) body.Order = params.order;
      if (params.reviewDate !== undefined) body.ReviewDate = params.reviewDate;
      if (params.ownerUid !== undefined) body.OwnerUid = params.ownerUid;
      if (params.ownerGroupId !== undefined) body.OwnerGroupID = params.ownerGroupId;
      if (params.tags !== undefined) body.Tags = params.tags;
      if (params.attributes) {
        body.Attributes = params.attributes.map((a) => ({ ID: a.id, Value: String(a.value) }));
      }
      try {
        const result = await client.post(`/${app}/knowledgebase`, body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-kb-get",
    "Get a TDX knowledge base article by ID",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      id: z.number().describe("KB article ID"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      try {
        const result = await client.get(`/${app}/knowledgebase/${params.id}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-kb-update",
    "Update a TDX knowledge base article",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      id: z.number().describe("KB article ID"),
      data: z.record(z.unknown()).describe("Article data (PascalCase TDX field names)"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      try {
        const result = await client.put(`/${app}/knowledgebase/${params.id}`, params.data);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-kb-delete",
    "Delete a TDX knowledge base article",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      id: z.number().describe("KB article ID"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      try {
        await client.delete(`/${app}/knowledgebase/${params.id}`);
        return { content: [{ type: "text", text: "KB article deleted successfully" }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-kb-search",
    "Search TDX knowledge base articles",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      searchText: z.string().optional().describe("Full-text search query"),
      categoryIds: z.array(z.number()).optional().describe("Filter by category IDs"),
      status: z.number().optional().describe("Filter by status (0=None, 1=Draft, 2=Approved, 3=Archived)"),
      ownerUids: z.array(z.string()).optional().describe("Filter by owner UIDs"),
      maxResults: z.number().optional().describe("Max results to return (default 25)"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      const body: Record<string, unknown> = {};
      if (params.searchText !== undefined) body.SearchText = params.searchText;
      if (params.categoryIds !== undefined) body.CategoryIDs = params.categoryIds;
      if (params.status !== undefined) body.Status = params.status;
      if (params.ownerUids !== undefined) body.OwnerUids = params.ownerUids;
      if (params.maxResults !== undefined) body.MaxResults = params.maxResults;
      try {
        const result = await client.post(`/${app}/knowledgebase/search`, body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
}
