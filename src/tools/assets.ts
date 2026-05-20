import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TdxClient } from "../tdx-client.js";

export function registerAssetReadOnlyTools(server: McpServer, client: TdxClient) {
  const defaultAppId = client.assetsAppId ?? client.appId;

  server.tool(
    "tdx-asset-get",
    "Get a TDX asset by ID",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      id: z.number().describe("Asset ID"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      try {
        const result = await client.get(`/${app}/assets/${params.id}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-asset-search",
    "Search TDX assets with filters",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      searchText: z.string().optional().describe("Full-text search query"),
      statusIds: z.array(z.number()).optional().describe("Filter by status IDs"),
      owningDepartmentIds: z.array(z.number()).optional().describe("Filter by owning department IDs"),
      owningCustomerIds: z.array(z.string()).optional().describe("Filter by owning customer UIDs"),
      locationIds: z.array(z.number()).optional().describe("Filter by location IDs"),
      modelIds: z.array(z.number()).optional().describe("Filter by model IDs"),
      manufacturerIds: z.array(z.number()).optional().describe("Filter by manufacturer IDs"),
      createdDateStart: z.string().optional().describe("Filter by creation date start (ISO 8601 format)"),
      createdDateEnd: z.string().optional().describe("Filter by creation date end (ISO 8601 format)"),
      modifiedDateStart: z.string().optional().describe("Filter by modification date start (ISO 8601 format)"),
      modifiedDateEnd: z.string().optional().describe("Filter by modification date end (ISO 8601 format)"),
      acquisitionDateStart: z.string().optional().describe("Filter by acquisition date start (ISO 8601 format)"),
      acquisitionDateEnd: z.string().optional().describe("Filter by acquisition date end (ISO 8601 format)"),
      maxResults: z.number().optional().describe("Max results to return (smart default: 5000 with date filters, 25 otherwise)"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      const body: Record<string, unknown> = {};
      if (params.searchText !== undefined) body.SearchText = params.searchText;
      if (params.statusIds !== undefined) body.StatusIDs = params.statusIds;
      if (params.owningDepartmentIds !== undefined) body.OwningDepartmentIDs = params.owningDepartmentIds;
      if (params.owningCustomerIds !== undefined) body.OwningCustomerIDs = params.owningCustomerIds;
      if (params.locationIds !== undefined) body.LocationIDs = params.locationIds;
      if (params.modelIds !== undefined) body.ModelIDs = params.modelIds;
      if (params.manufacturerIds !== undefined) body.ManufacturerIDs = params.manufacturerIds;
      if (params.createdDateStart !== undefined) body.CreatedDateStart = params.createdDateStart;
      if (params.createdDateEnd !== undefined) body.CreatedDateEnd = params.createdDateEnd;
      if (params.modifiedDateStart !== undefined) body.ModifiedDateStart = params.modifiedDateStart;
      if (params.modifiedDateEnd !== undefined) body.ModifiedDateEnd = params.modifiedDateEnd;
      if (params.acquisitionDateStart !== undefined) body.AcquisitionDateStart = params.acquisitionDateStart;
      if (params.acquisitionDateEnd !== undefined) body.AcquisitionDateEnd = params.acquisitionDateEnd;
      const hasDateFilter = params.createdDateStart !== undefined || params.createdDateEnd !== undefined || params.modifiedDateStart !== undefined || params.modifiedDateEnd !== undefined || params.acquisitionDateStart !== undefined || params.acquisitionDateEnd !== undefined;
      const defaultMaxResults = hasDateFilter ? 5000 : 100;
      body.MaxResults = params.maxResults ?? defaultMaxResults;
      try {
        const result = await client.post(`/${app}/assets/search`, body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-asset-categories",
    "Get all available asset categories/forms in TDX",
    {},
    async () => {
      const app = defaultAppId;
      try {
        const result = await client.get(`/${app}/assets/forms`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
}

export function registerAssetTools(server: McpServer, client: TdxClient) {
  const defaultAppId = client.assetsAppId ?? client.appId;

  server.tool(
    "tdx-asset-create",
    "Create a new TDX asset",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      formId: z.number().optional().describe("Form ID"),
      statusId: z.number().describe("Status ID"),
      name: z.string().describe("Asset name"),
      serialNumber: z.string().optional().describe("Serial number"),
      modelId: z.number().optional().describe("Model ID"),
      manufacturerId: z.number().optional().describe("Manufacturer ID"),
      supplierId: z.number().optional().describe("Supplier ID"),
      locationId: z.number().optional().describe("Location ID"),
      locationRoomId: z.number().optional().describe("Location room ID"),
      owningDepartmentId: z.number().optional().describe("Owning department ID"),
      owningCustomerId: z.string().optional().describe("Owning customer UID"),
      requestingCustomerId: z.string().optional().describe("Requesting customer UID"),
      requestingDepartmentId: z.number().optional().describe("Requesting department ID"),
      purchaseCost: z.number().optional().describe("Purchase cost"),
      acquisitionDate: z.string().optional().describe("Acquisition date (ISO)"),
      expectedReplacementDate: z.string().optional().describe("Expected replacement date (ISO)"),
      externalId: z.string().optional().describe("External ID"),
      attributes: z.array(z.object({
        id: z.number().describe("Custom attribute ID"),
        value: z.union([z.string(), z.number(), z.boolean()]).describe("Attribute value"),
      })).optional().describe("Custom attributes"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      const body: Record<string, unknown> = {
        StatusID: params.statusId,
        Name: params.name,
      };
      if (params.formId !== undefined) body.FormID = params.formId;
      if (params.serialNumber !== undefined) body.SerialNumber = params.serialNumber;
      if (params.modelId !== undefined) body.ModelID = params.modelId;
      if (params.manufacturerId !== undefined) body.ManufacturerID = params.manufacturerId;
      if (params.supplierId !== undefined) body.SupplierID = params.supplierId;
      if (params.locationId !== undefined) body.LocationID = params.locationId;
      if (params.locationRoomId !== undefined) body.LocationRoomID = params.locationRoomId;
      if (params.owningDepartmentId !== undefined) body.OwningDepartmentID = params.owningDepartmentId;
      if (params.owningCustomerId !== undefined) body.OwningCustomerID = params.owningCustomerId;
      if (params.requestingCustomerId !== undefined) body.RequestingCustomerID = params.requestingCustomerId;
      if (params.requestingDepartmentId !== undefined) body.RequestingDepartmentID = params.requestingDepartmentId;
      if (params.purchaseCost !== undefined) body.PurchaseCost = params.purchaseCost;
      if (params.acquisitionDate !== undefined) body.AcquisitionDate = params.acquisitionDate;
      if (params.expectedReplacementDate !== undefined) body.ExpectedReplacementDate = params.expectedReplacementDate;
      if (params.externalId !== undefined) body.ExternalID = params.externalId;
      if (params.attributes) {
        body.Attributes = params.attributes.map((a) => ({ ID: a.id, Value: String(a.value) }));
      }
      try {
        const result = await client.post(`/${app}/assets`, body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-asset-update",
    "Full update of a TDX asset",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      id: z.number().describe("Asset ID"),
      data: z.record(z.unknown()).describe("Full asset data (PascalCase TDX field names)"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      try {
        const result = await client.post(`/${app}/assets/${params.id}`, params.data);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-asset-patch",
    "Partial update of a TDX asset",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      id: z.number().describe("Asset ID"),
      data: z.record(z.unknown()).describe("Partial asset data (PascalCase TDX field names)"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      try {
        const result = await client.patch(`/${app}/assets/${params.id}`, params.data);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-asset-delete",
    "Delete a TDX asset",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      id: z.number().describe("Asset ID"),
    },
    async (params) => {
      const app = params.appId ?? defaultAppId;
      try {
        await client.delete(`/${app}/assets/${params.id}`);
        return { content: [{ type: "text", text: "Asset deleted successfully" }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );

  server.tool(
    "tdx-asset-feed-add",
    "Add a comment/feed entry to a TDX asset",
    {
      appId: z.number().optional().describe("TDX app ID (defaults to env TDX_APP_ID)"),
      id: z.number().describe("Asset ID"),
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
        const result = await client.post(`/${app}/assets/${params.id}/feed`, body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: String(e) }], isError: true };
      }
    }
  );
}
