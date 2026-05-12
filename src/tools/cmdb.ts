import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TdxClient } from "../tdx-client.js";

export function registerCmdbReadOnlyTools(server: McpServer, client: TdxClient) {
  // CMDB always uses TDAssets application
  const appId = client.assetsAppId;

  server.tool(
    "tdx-cmdb-get",
    "Get a TDX configuration item by ID",
    {
      id: z.number().describe("CI ID"),
    },
    async (params) => {
      try {
        const result = await client.get(`/${appId}/cmdb/${params.id}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-cmdb-search",
    "Search TDX configuration items with filters",
    {
      searchText: z.string().optional().describe("Full-text search query"),
      typeIds: z.array(z.number()).optional().describe("Filter by CI type IDs"),
      isActive: z.boolean().optional().describe("Filter by active status"),
      owningDepartmentIds: z.array(z.number()).optional().describe("Filter by owning department IDs"),
      locationIds: z.array(z.number()).optional().describe("Filter by location IDs"),
      maxResults: z.number().optional().describe("Max results to return (default 25)"),
    },
    async (params) => {
      const body: Record<string, unknown> = {};
      if (params.searchText !== undefined) body.SearchText = params.searchText;
      if (params.typeIds !== undefined) body.TypeIDs = params.typeIds;
      if (params.isActive !== undefined) body.IsActive = params.isActive;
      if (params.owningDepartmentIds !== undefined) body.OwningDepartmentIDs = params.owningDepartmentIds;
      if (params.locationIds !== undefined) body.LocationIDs = params.locationIds;
      if (params.maxResults !== undefined) body.MaxResults = params.maxResults;
      try {
        const result = await client.post(`/${appId}/cmdb/search`, body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
}

export function registerCmdbTools(server: McpServer, client: TdxClient) {
  // CMDB always uses TDAssets application
  const appId = client.assetsAppId;

  server.tool(
    "tdx-cmdb-create",
    "Create a new TDX configuration item (CI)",
    {
      typeId: z.number().describe("CI type ID"),
      name: z.string().describe("CI name"),
      formId: z.number().optional().describe("Form ID"),
      isActive: z.boolean().optional().describe("Whether CI is active"),
      owningDepartmentId: z.number().optional().describe("Owning department ID"),
      owningCustomerId: z.string().optional().describe("Owning customer UID"),
      locationId: z.number().optional().describe("Location ID"),
      locationRoomId: z.number().optional().describe("Location room ID"),
      maintenanceScheduleId: z.number().optional().describe("Maintenance schedule ID"),
      externalId: z.string().optional().describe("External ID"),
      attributes: z.array(z.object({
        id: z.number().describe("Custom attribute ID"),
        value: z.union([z.string(), z.number(), z.boolean()]).describe("Attribute value"),
      })).optional().describe("Custom attributes"),
    },
    async (params) => {
      const body: Record<string, unknown> = {
        TypeID: params.typeId,
        Name: params.name,
      };
      if (params.formId !== undefined) body.FormID = params.formId;
      if (params.isActive !== undefined) body.IsActive = params.isActive;
      if (params.owningDepartmentId !== undefined) body.OwningDepartmentID = params.owningDepartmentId;
      if (params.owningCustomerId !== undefined) body.OwningCustomerID = params.owningCustomerId;
      if (params.locationId !== undefined) body.LocationID = params.locationId;
      if (params.locationRoomId !== undefined) body.LocationRoomID = params.locationRoomId;
      if (params.maintenanceScheduleId !== undefined) body.MaintenanceScheduleID = params.maintenanceScheduleId;
      if (params.externalId !== undefined) body.ExternalID = params.externalId;
      if (params.attributes) {
        body.Attributes = params.attributes.map((a) => ({ ID: a.id, Value: String(a.value) }));
      }
      try {
        const result = await client.post(`/${appId}/cmdb`, body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-cmdb-update",
    "Full update of a TDX configuration item",
    {
      id: z.number().describe("CI ID"),
      data: z.record(z.unknown()).describe("Full CI data (PascalCase TDX field names)"),
    },
    async (params) => {
      try {
        const result = await client.put(`/${appId}/cmdb/${params.id}`, params.data);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-cmdb-delete",
    "Delete a TDX configuration item",
    {
      id: z.number().describe("CI ID"),
    },
    async (params) => {
      try {
        await client.delete(`/${appId}/cmdb/${params.id}`);
        return { content: [{ type: "text", text: "CI deleted successfully" }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-cmdb-feed-add",
    "Add a comment/feed entry to a TDX configuration item",
    {
      id: z.number().describe("CI ID"),
      comments: z.string().describe("Comment text (HTML supported)"),
      isPrivate: z.boolean().optional().describe("Whether the comment is private (default false)"),
      notify: z.array(z.string()).optional().describe("UIDs to notify"),
    },
    async (params) => {
      const body: Record<string, unknown> = {
        Comments: params.comments,
      };
      if (params.isPrivate !== undefined) body.IsPrivate = params.isPrivate;
      if (params.notify !== undefined) body.Notify = params.notify;
      try {
        const result = await client.post(`/${appId}/cmdb/${params.id}/feed`, body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-cmdb-add-relationship",
    "Add a relationship between two TDX configuration items",
    {
      id: z.number().describe("Source CI ID"),
      otherItemId: z.number().describe("Target CI ID"),
      typeId: z.number().describe("Relationship type ID"),
      isInverse: z.boolean().optional().describe("Whether this is an inverse relationship"),
    },
    async (params) => {
      const body: Record<string, unknown> = {
        OtherItemID: params.otherItemId,
        TypeID: params.typeId,
      };
      if (params.isInverse !== undefined) body.IsInverse = params.isInverse;
      try {
        const result = await client.put(`/${appId}/cmdb/${params.id}/relationships`, body);
        return { content: [{ type: "text", text: JSON.stringify(result ?? "Relationship added successfully", null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
}
