# TeamDynamix MCP Server - Tools Reference

**Total Tools:** 44 tools across 10 categories  
**Modification Status:** Modification tools (create, update, delete) are DISABLED by default. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## Quick Navigation

- [Tickets (10 tools)](#tickets)
- [Assets (8 tools)](#assets)
- [CMDB/Configuration Items (8 tools)](#cmdb)
- [Knowledge Base (5 tools)](#knowledge-base)
- [Projects (4 tools)](#projects)
- [People (4 tools)](#people)
- [Accounts (2 tools)](#accounts)
- [Groups (2 tools)](#groups)
- [Statuses (1 tool)](#statuses)
- [Custom Attributes (1 tool)](#custom-attributes)

---

# TICKETS

## tdx-ticket-search
**Status:** ✅ ENABLED  
**Type:** Read-only / Search

Searches and filters TeamDynamix tickets. All filters combine with AND logic.

**Parameters:**
- `searchText` (string, optional) - Full-text search on title/description
- `statusIds` (integer[], optional) - Filter by status IDs
- `priorityIds` (integer[], optional) - Filter by priority IDs
- `typeIds` (integer[], optional) - Filter by ticket type IDs
- `accountIds` (integer[], optional) - Filter by account/department IDs
- `requestorUids` (string[], optional) - Filter by requestor person UIDs
- `responsibleUids` (string[], optional) - Filter by responsible person UIDs
- `responsibleGroupIds` (integer[], optional) - Filter by responsible group IDs
- `createdDateStart` (string, optional) - Filter by creation date start (ISO 8601 format)
- `createdDateEnd` (string, optional) - Filter by creation date end (ISO 8601 format)
- `modifiedDateStart` (string, optional) - Filter by modification date start (ISO 8601 format)
- `modifiedDateEnd` (string, optional) - Filter by modification date end (ISO 8601 format)
- `respondByDateStart` (string, optional) - Filter by respond by date start (ISO 8601 format)
- `respondByDateEnd` (string, optional) - Filter by respond by date end (ISO 8601 format)
- `closeByDateStart` (string, optional) - Filter by resolve by date start (ISO 8601 format)
- `closeByDateEnd` (string, optional) - Filter by resolve by date end (ISO 8601 format)
- `closedDateStart` (string, optional) - Filter by closed date start (ISO 8601 format)
- `closedDateEnd` (string, optional) - Filter by closed date end (ISO 8601 format)
- `respondedDateStart` (string, optional) - Filter by responded date start (ISO 8601 format)
- `respondedDateEnd` (string, optional) - Filter by responded date end (ISO 8601 format)
- `maxResults` (integer, optional) - Max results to return (smart default: 5000 when date filters used, 100 otherwise)
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Returns:** Array of ticket objects. Example ticket:
```json
{
  "ID": 4709555,
  "Title": "Fire Station 2 Shared Account Creations",
  "AccountID": 3870,
  "AccountName": "Fire Suppression",
  "StatusID": 898,
  "StatusName": "Closed",
  "StatusClass": 3,
  "TypeID": 866,
  "TypeName": "Accounts & Access",
  "Classification": 46,
  "ClassificationName": "Service Request",
  "PriorityID": 329,
  "PriorityName": "P3",
  "PriorityOrder": 3,
  "CreatedDate": "2026-05-01T19:55:46.927Z",
  "CreatedFullName": "Joshua Taylor",
  "CreatedEmail": "",
  "ModifiedDate": "2026-05-01T20:00:43.693Z",
  "ModifiedFullName": "Patrick Macaraeg",
  "RequestorName": "Joshua Taylor",
  "RequestorEmail": "jtaylor@pascocountyfl.net",
  "RequestorPhone": "727-353-2967",
  "ResponsibleGroupID": 388,
  "ResponsibleGroupName": "INOSC",
  "CompletedDate": "2026-05-01T20:00:43.693Z",
  "ServiceID": 1967,
  "ServiceName": "Account Update / Name Change",
  "ServiceCategoryName": "Accounts & Access",
  "webLink": "https://service.pascocountyfl.net/TDNext/Apps/115/Tickets/TicketDet?TicketID=4709555"
}
```

**Notes:** Search text does not support filter syntax; case-insensitive. Empty results return empty array without error.

---

## tdx-ticket-count
**Status:** ✅ ENABLED  
**Type:** Read-only / Count + Preview

Gets count of tickets matching filters and returns a preview of matching tickets (up to 200). Efficient for aggregate queries without retrieving full result sets.

**Parameters:**
All parameters match `tdx-ticket-search`:
- `searchText` (string, optional) - Full-text search on title/description
- `statusIds` (integer[], optional) - Filter by status IDs
- `priorityIds` (integer[], optional) - Filter by priority IDs
- `typeIds` (integer[], optional) - Filter by ticket type IDs
- `accountIds` (integer[], optional) - Filter by account/department IDs
- `requestorUids` (string[], optional) - Filter by requestor person UIDs
- `responsibleUids` (string[], optional) - Filter by responsible person UIDs
- `responsibleGroupIds` (integer[], optional) - Filter by responsible group IDs
- `createdDateStart` (string, optional) - Filter by creation date start (ISO 8601 format)
- `createdDateEnd` (string, optional) - Filter by creation date end (ISO 8601 format)
- `modifiedDateStart` (string, optional) - Filter by modification date start (ISO 8601 format)
- `modifiedDateEnd` (string, optional) - Filter by modification date end (ISO 8601 format)
- `respondByDateStart` (string, optional) - Filter by respond by date start (ISO 8601 format)
- `respondByDateEnd` (string, optional) - Filter by respond by date end (ISO 8601 format)
- `closeByDateStart` (string, optional) - Filter by resolve by date start (ISO 8601 format)
- `closeByDateEnd` (string, optional) - Filter by resolve by date end (ISO 8601 format)
- `closedDateStart` (string, optional) - Filter by closed date start (ISO 8601 format)
- `closedDateEnd` (string, optional) - Filter by closed date end (ISO 8601 format)
- `respondedDateStart` (string, optional) - Filter by responded date start (ISO 8601 format)
- `respondedDateEnd` (string, optional) - Filter by responded date end (ISO 8601 format)
- `maxSummaryResults` (integer, optional) - Max tickets to include in response (default: 200)
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Returns:** Object with count and preview tickets:
```json
{
  "count": 1247,
  "tickets": [
    {
      "ID": 12345,
      "Title": "Network outage",
      "StatusID": 1,
      "PriorityID": 2,
      "CreatedDate": "2026-07-22T10:00:00Z",
      "webLink": "https://service.pascocountyfl.net/TDNext/Apps/115/Tickets/TicketDet?TicketID=12345"
    }
  ]
}
```

**Lookup Pattern (Important):**
Since parameters require IDs, use these metadata tools to resolve human-readable names → IDs:
- **Status lookup**: `tdx-statuses-get` (componentType: "tickets") → returns ID for "Open", "Closed", etc.
- **Account/Department lookup**: `tdx-account-search` (searchText: "group name") → returns ID
- **Group lookup**: `tdx-group-search` (searchText: "group name") → returns ID
- **Person lookup**: `tdx-people-search` (searchText: "person name") → returns UID
- **Priority/Type lookup**: Use `tdx-ticket-search` with empty filters to explore available options

**Example Workflow:**
User asks: "How many open tickets assigned to group IT Support?"
1. Call `tdx-group-search` with searchText "IT Support" → get group ID 42
2. Call `tdx-statuses-get` with componentType "tickets" → find "Open" status ID 1
3. Call `tdx-ticket-count` with statusIds: [1], responsibleGroupIds: [42]
4. Response: { "count": 87, "tickets": [...] }

**Use Cases:**
- "How many open tickets?" - Resolve status first, then count
- "How many tickets closed today?" - Use closedDateStart/closedDateEnd
- "How many tickets by priority?" - Resolve priority IDs, then count
- "How many open tickets for group XYZ?" - Resolve status + group, then count
- Agent can use returned ticket IDs with tdx-ticket-get or tdx-ticket-search for details

**Notes:** Efficient for Copilot agent queries to reduce context window usage vs. full search. Returns all fields from matching tickets (up to preview limit). Always resolve ID-based parameters via metadata tools first.

---

## tdx-ticket-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Get

Retrieves full details for a specific ticket by ID.

**Parameters:**
- `id` (integer, required) - Ticket ID
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Returns:** Complete single ticket object (includes attachments, tasks, feed entries, and custom attributes). Example structure (same as tdx-ticket-search result format with 55+ fields).

---

## tdx-ticket-feed-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Feed

Retrieves the activity feed/comment history for a specific ticket.

**Parameters:**
- `id` (integer, required) - Ticket ID
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Returns:** Array of feed entry objects. Example feed entry:
```json
{
  "ID": 51547063,
  "CreatedFullName": "System",
  "CreatedDate": "2026-05-12T17:35:54.547Z",
  "ItemType": 25,
  "ItemID": 802693,
  "ItemTitle": "FY27 Public Services - PRNR - Fiscal & Support Services Neat Order",
  "Body": "Added this ticket task to workspace \"IT Management\" via rule \"Open Task for IT Management\" owned by \"Steven Basak\".",
  "IsRichHtml": false,
  "UpdateType": 3,
  "IsPrivate": true,
  "RepliesCount": 0,
  "LikesCount": 0,
  "IsCommunication": false,
  "HasAttachment": false,
  "Uri": "api/feed/51547063"
}
```

**Notes:** Provides complete audit trail and ticket lifecycle tracking with all updates and comments in chronological order. UpdateType indicates the nature of the feed entry.

---

## tdx-ticket-create
**Status:** 🔴 DISABLED  
**Type:** Create

Creates a new ticket in TeamDynamix.

**Parameters:**
- `typeId` (integer, required) - Ticket type ID
- `title` (string, required) - Ticket title
- `description` (string, optional) - Ticket description (HTML supported)
- `accountId` (integer, optional) - Account/department ID
- `priorityId` (integer, optional) - Priority ID
- `statusId` (integer, optional) - Status ID
- `requestorUid` (string, optional) - Requestor person UID
- `responsibleUid` (string, optional) - Responsible person UID
- `responsibleGroupId` (integer, optional) - Responsible group ID
- `formId` (integer, optional) - Form ID
- `sourceId` (integer, optional) - Source ID
- `serviceId` (integer, optional) - Service ID
- `goesOffHoldDate` (string, optional) - ISO date when ticket goes off hold
- `attributes` (array, optional) - Custom attributes with id and value
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-ticket-update
**Status:** 🔴 DISABLED  
**Type:** Update (Full)

Fully updates a ticket (all fields must be provided).

**Parameters:**
- `id` (integer, required) - Ticket ID
- `data` (object, required) - Full ticket data with PascalCase TDX field names
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-ticket-patch
**Status:** 🔴 DISABLED  
**Type:** Update (Partial)

Partially updates a ticket (only specified fields are updated).

**Parameters:**
- `id` (integer, required) - Ticket ID
- `data` (object, required) - Partial ticket data with PascalCase TDX field names
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-ticket-feed-add
**Status:** 🔴 DISABLED  
**Type:** Feed/Comment

Adds a comment/note to a ticket's activity feed.

**Parameters:**
- `id` (integer, required) - Ticket ID
- `comments` (string, required) - Comment text (HTML supported)
- `isPrivate` (boolean, optional) - Whether the comment is private (default: false)
- `notify` (string[], optional) - UIDs of people to notify
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-ticket-add-asset
**Status:** 🔴 DISABLED  
**Type:** Link/Association

Links an asset to a ticket.

**Parameters:**
- `id` (integer, required) - Ticket ID
- `assetId` (integer, required) - Asset ID to link
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-ticket-add-contact
**Status:** 🔴 DISABLED  
**Type:** Link/Association

Adds a contact/person to a ticket.

**Parameters:**
- `id` (integer, required) - Ticket ID
- `uid` (string, required) - Person UID to add as contact
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

# ASSETS

## tdx-asset-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Get

Retrieves full details for a specific asset by ID.

**Parameters:**
- `id` (integer, required) - Asset ID
- `appId` (integer, optional) - Application ID (defaults to TDX_ASSETS_APP_ID or TDX_APP_ID)

**Returns:** Complete single asset object (includes custom attributes and attachments). Example structure:
```json
{
  "ID": 33103,
  "AppID": 116,
  "AppName": "Assets/CIs",
  "FormID": 1773,
  "FormName": "Computer Asset Form",
  "ProductModelID": 2310,
  "ProductModelName": "S08J00",
  "ManufacturerID": 1169,
  "ManufacturerName": "Lenovo",
  "SupplierID": 969,
  "SupplierName": "Computers at Work d/b/a vTech io",
  "StatusID": 1032,
  "StatusName": "Lottery",
  "LocationID": 12008,
  "LocationName": "ISB Annex - Information Technology",
  "Tag": "PW02RB2P",
  "SerialNumber": "PW02RB2P",
  "Name": "BCCIT171L",
  "PurchaseCost": 0,
  "AcquisitionDate": "2022-07-21T04:00:00Z",
  "OwningDepartmentID": 2356,
  "OwningDepartmentName": "Information Technology",
  "CreatedDate": "2022-12-22T17:58:23.087Z",
  "CreatedFullName": "Samantha Grahn",
  "ModifiedDate": "2025-12-02T17:16:21.267Z",
  "ModifiedFullName": "Rosalyn Padilla",
  "ConfigurationItemID": 38407,
  "Uri": "api/116/assets/33103"
}
```

---

## tdx-asset-search
**Status:** ✅ ENABLED  
**Type:** Read-only / Search

Searches and filters assets with multiple filter options. All filters combine with AND logic.

**Parameters:**
- `searchText` (string, optional) - Full-text search on name/serial number
- `statusIds` (integer[], optional) - Filter by status IDs
- `owningDepartmentIds` (integer[], optional) - Filter by owning department IDs
- `owningCustomerIds` (string[], optional) - Filter by owning customer UIDs
- `locationIds` (integer[], optional) - Filter by location IDs
- `modelIds` (integer[], optional) - Filter by asset model IDs
- `manufacturerIds` (integer[], optional) - Filter by manufacturer IDs
- `createdDateStart` (string, optional) - Filter by creation date start (ISO 8601 format, e.g., "2026-04-01T00:00:00Z")
- `createdDateEnd` (string, optional) - Filter by creation date end (ISO 8601 format, e.g., "2026-04-30T23:59:59Z")
- `modifiedDateStart` (string, optional) - Filter by modification date start (ISO 8601 format)
- `modifiedDateEnd` (string, optional) - Filter by modification date end (ISO 8601 format)
- `acquisitionDateStart` (string, optional) - Filter by acquisition date start (ISO 8601 format)
- `acquisitionDateEnd` (string, optional) - Filter by acquisition date end (ISO 8601 format)
- `maxResults` (integer, optional) - Max results to return (smart default: 5000 when any date filter is used, 100 otherwise)
- `appId` (integer, optional) - Application ID (defaults to TDX_ASSETS_APP_ID or TDX_APP_ID)

**Returns:** Array of asset objects. Example asset:
```json
{
  "ID": 33103,
  "AppID": 116,
  "AppName": "Assets/CIs",
  "FormID": 1773,
  "FormName": "Computer Asset Form",
  "ProductModelID": 2310,
  "ProductModelName": "S08J00",
  "ManufacturerID": 1169,
  "ManufacturerName": "Lenovo",
  "SupplierID": 969,
  "SupplierName": "Computers at Work d/b/a vTech io",
  "StatusID": 1032,
  "StatusName": "Lottery",
  "LocationID": 12008,
  "LocationName": "ISB Annex - Information Technology",
  "Tag": "PW02RB2P",
  "SerialNumber": "PW02RB2P",
  "Name": "BCCIT171L",
  "PurchaseCost": 0,
  "AcquisitionDate": "2022-07-21T04:00:00Z",
  "OwningDepartmentID": 2356,
  "OwningDepartmentName": "Information Technology",
  "CreatedDate": "2022-12-22T17:58:23.087Z",
  "CreatedFullName": "Samantha Grahn",
  "ModifiedDate": "2025-12-02T17:16:21.267Z",
  "ModifiedFullName": "Rosalyn Padilla",
  "ConfigurationItemID": 38407,
  "Uri": "api/116/assets/33103"
}
```

---

## tdx-asset-create
**Status:** 🔴 DISABLED  
**Type:** Create

Creates a new asset in inventory.

**Parameters:**
- `statusId` (integer, required) - Status ID
- `name` (string, required) - Asset name
- `formId` (integer, optional) - Form ID
- `serialNumber` (string, optional) - Serial number
- `modelId` (integer, optional) - Model ID
- `manufacturerId` (integer, optional) - Manufacturer ID
- `supplierId` (integer, optional) - Supplier ID
- `locationId` (integer, optional) - Location ID
- `locationRoomId` (integer, optional) - Location room ID
- `owningDepartmentId` (integer, optional) - Owning department ID
- `owningCustomerId` (string, optional) - Owning customer UID
- `requestingCustomerId` (string, optional) - Requesting customer UID
- `requestingDepartmentId` (integer, optional) - Requesting department ID
- `purchaseCost` (number, optional) - Purchase cost
- `acquisitionDate` (string, optional) - Acquisition date (ISO)
- `expectedReplacementDate` (string, optional) - Expected replacement date (ISO)
- `externalId` (string, optional) - External ID
- `attributes` (array, optional) - Custom attributes with id and value
- `appId` (integer, optional) - Application ID (defaults to TDX_ASSETS_APP_ID or TDX_APP_ID)

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-asset-update
**Status:** 🔴 DISABLED  
**Type:** Update (Full)

Fully updates an asset (all fields must be provided).

**Parameters:**
- `id` (integer, required) - Asset ID
- `data` (object, required) - Full asset data with PascalCase TDX field names
- `appId` (integer, optional) - Application ID (defaults to TDX_ASSETS_APP_ID or TDX_APP_ID)

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-asset-patch
**Status:** 🔴 DISABLED  
**Type:** Update (Partial)

Partially updates an asset (only specified fields are updated).

**Parameters:**
- `id` (integer, required) - Asset ID
- `data` (object, required) - Partial asset data with PascalCase TDX field names
- `appId` (integer, optional) - Application ID (defaults to TDX_ASSETS_APP_ID or TDX_APP_ID)

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-asset-delete
**Status:** 🔴 DISABLED  
**Type:** Delete

Deletes an asset.

**Parameters:**
- `id` (integer, required) - Asset ID
- `appId` (integer, optional) - Application ID (defaults to TDX_ASSETS_APP_ID or TDX_APP_ID)

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-asset-feed-add
**Status:** 🔴 DISABLED  
**Type:** Feed/Comment

Adds a comment/note to an asset's activity feed.

**Parameters:**
- `id` (integer, required) - Asset ID
- `comments` (string, required) - Comment text (HTML supported)
- `isPrivate` (boolean, optional) - Whether the comment is private (default: false)
- `notify` (string[], optional) - UIDs of people to notify
- `appId` (integer, optional) - Application ID (defaults to TDX_ASSETS_APP_ID or TDX_APP_ID)

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-asset-categories
**Status:** ✅ ENABLED  
**Type:** Read-only / Metadata

Retrieves all available asset categories/forms in TeamDynamix.

**Parameters:** None - metadata-only retrieval tool.

**Returns:** Array of asset form/category objects with metadata.

```json
[
  {
    "ID": 1773,
    "Name": "Computer Asset Form",
    "AppID": 116,
    "AppName": "Assets/CIs",
    "ComponentID": 27,
    "IsActive": true,
    "IsConfigured": true,
    "IsDefaultForApp": true,
    "IsPinned": true,
    "ShouldExpandHelp": false,
    "CreatedDate": "2022-11-04T13:32:59.803Z",
    "CreatedUid": "e2d6cba3-d51a-ed11-bd6e-0050f2f4ae01",
    "CreatedFullName": "Steven Basak",
    "ModifiedDate": "2025-07-31T12:34:45.83Z",
    "ModifiedUid": "e2d6cba3-d51a-ed11-bd6e-0050f2f4ae01",
    "ModifiedFullName": "Steven Basak",
    "AssetsCount": -1,
    "ConfigurationItemsCount": -1
  },
  {
    "ID": 1772,
    "Name": "DUO Asset Form",
    "AppID": 116,
    "AppName": "Assets/CIs",
    "ComponentID": 27,
    "IsActive": true,
    "IsConfigured": true,
    "IsDefaultForApp": false,
    "IsPinned": true,
    "ShouldExpandHelp": false,
    "CreatedDate": "2022-11-04T13:13:01.3Z",
    "CreatedUid": "e2d6cba3-d51a-ed11-bd6e-0050f2f4ae01",
    "CreatedFullName": "Steven Basak",
    "ModifiedDate": "2022-11-04T14:46:28.177Z",
    "ModifiedUid": "e2d6cba3-d51a-ed11-bd6e-0050f2f4ae01",
    "ModifiedFullName": "Steven Basak",
    "AssetsCount": -1,
    "ConfigurationItemsCount": -1
  }
]
```

**Notes:** Use this to discover available asset types, find FormIDs for creating new assets, and understand asset structure variations.

---

# CMDB

## tdx-cmdb-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Get

Retrieves full details for a specific configuration item (CI) by ID.

**Parameters:**
- `id` (integer, required) - CI ID
- `appId` (integer, optional) - Application ID (defaults to TDX_ASSETS_APP_ID)

**Returns:** Complete single CI object. Example structure:
```json
{
  "ID": 39309,
  "AppID": 116,
  "AppName": "Assets/CIs",
  "Name": "PCCKIT04W",
  "TypeID": 1,
  "TypeName": "Asset",
  "FormID": 1773,
  "FormName": "Computer Asset Form",
  "IsSystemMaintained": true,
  "BackingItemID": 33982,
  "OwningDepartmentID": 2339,
  "OwningDepartmentName": "Corrections",
  "LocationID": 13457,
  "LocationName": "PCDC - Kitchen",
  "IsActive": true,
  "CreatedDateUtc": "2022-12-27T03:20:33.5333333Z",
  "CreatedFullName": "Samantha Grahn",
  "ModifiedDateUtc": "2026-05-12T17:13:10.3766667Z",
  "ModifiedFullName": "David Cecere",
  "Uri": "api/116/cmdb/39309"
}
```

**Notes:** CMDB uses the configured assets application via TDX_ASSETS_APP_ID environment variable.

---

## tdx-cmdb-search
**Status:** ✅ ENABLED  
**Type:** Read-only / Search

Searches and filters configuration items with multiple filter options. All filters combine with AND logic.

**Parameters:**
- `searchText` (string, optional) - Full-text search on name/description
- `typeIds` (integer[], optional) - Filter by CI type IDs
- `isActive` (boolean, optional) - Filter by active/inactive status
- `owningDepartmentIds` (integer[], optional) - Filter by owning department IDs
- `locationIds` (integer[], optional) - Filter by location IDs
- `maxResults` (integer, optional) - Max results to return (default: 25)
- `appId` (integer, optional) - Application ID (defaults to TDX_ASSETS_APP_ID)

**Returns:** Array of CI objects. Example CI structure:
```json
{
  "ID": 39309,
  "AppID": 116,
  "AppName": "Assets/CIs",
  "Name": "PCCKIT04W",
  "TypeID": 1,
  "TypeName": "Asset",
  "FormID": 1773,
  "FormName": "Computer Asset Form",
  "IsSystemMaintained": true,
  "BackingItemID": 33982,
  "OwningDepartmentID": 2339,
  "OwningDepartmentName": "Corrections",
  "LocationID": 13457,
  "LocationName": "PCDC - Kitchen",
  "IsActive": true,
  "CreatedDateUtc": "2022-12-27T03:20:33.5333333Z",
  "CreatedFullName": "Samantha Grahn",
  "ModifiedDateUtc": "2026-05-12T17:13:10.3766667Z",
  "ModifiedFullName": "David Cecere",
  "Uri": "api/116/cmdb/39309"
}
```

**Notes:** CMDB uses the configured assets application via TDX_ASSETS_APP_ID environment variable. Large result sets may timeout; use specific filters to narrow results.

---

## tdx-cmdb-create
**Status:** 🔴 DISABLED  
**Type:** Create

Creates a new configuration item (CI).

**Parameters:**
- `typeId` (integer, required) - CI type ID
- `name` (string, required) - CI name
- `formId` (integer, optional) - Form ID
- `isActive` (boolean, optional) - Whether CI is active
- `owningDepartmentId` (integer, optional) - Owning department ID
- `owningCustomerId` (string, optional) - Owning customer UID
- `locationId` (integer, optional) - Location ID
- `locationRoomId` (integer, optional) - Location room ID
- `maintenanceScheduleId` (integer, optional) - Maintenance schedule ID
- `externalId` (string, optional) - External ID
- `attributes` (array, optional) - Custom attributes with id and value

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-cmdb-update
**Status:** 🔴 DISABLED  
**Type:** Update (Full)

Fully updates a configuration item (all fields must be provided).

**Parameters:**
- `id` (integer, required) - CI ID
- `data` (object, required) - Full CI data with PascalCase TDX field names

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-cmdb-delete
**Status:** 🔴 DISABLED  
**Type:** Delete

Deletes a configuration item.

**Parameters:**
 - `id` (integer, required) - CI ID

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-cmdb-feed-add
**Status:** 🔴 DISABLED  
**Type:** Feed/Comment

Adds a comment/note to a CI's activity feed.

**Parameters:**
- `id` (integer, required) - CI ID
- `comments` (string, required) - Comment text (HTML supported)
- `isPrivate` (boolean, optional) - Whether the comment is private (default: false)
- `notify` (string[], optional) - UIDs of people to notify

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-cmdb-add-relationship
**Status:** 🔴 DISABLED  
**Type:** Link/Association

Adds a relationship/dependency between two configuration items.

**Parameters:**
- `id` (integer, required) - Source CI ID
- `otherItemId` (integer, required) - Target CI ID
- `typeId` (integer, required) - Relationship type ID
- `isInverse` (boolean, optional) - Whether this is an inverse relationship

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

# KNOWLEDGE BASE

## tdx-kb-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Get

Retrieves a knowledge base article by ID.

**Parameters:**
- `id` (integer, required) - KB article ID
- `appId` (integer, optional) - Application ID (defaults to TDX_KB_APP_ID or TDX_APP_ID)

**Returns:** Complete single KB article object. Example structure:
```json
{
  "ID": 6153,
  "AppID": 114,
  "AppName": "Client Portal",
  "CategoryID": 711,
  "CategoryName": "Accounts & Access",
  "Subject": "How to Reset Your Password in Pasco365",
  "Body": "<div class=\"gutter-top break-word...\">HTML content...</div>",
  "Summary": "This document will help those who need to reset their County password...",
  "Status": 3,
  "StatusName": "Approved",
  "Order": 1,
  "IsPublished": true,
  "IsPublic": true,
  "CreatedDate": "2023-07-10T20:21:23.79Z",
  "CreatedFullName": "Alexis Garton",
  "ModifiedDate": "2023-07-11T12:46:30.067Z",
  "ModifiedFullName": "Alexis Garton",
  "OwningGroupID": 370,
  "OwningGroupName": "Desktop Support",
  "Tags": null,
  "RevisionNumber": 2
}
```

---

## tdx-kb-search
**Status:** ✅ ENABLED  
**Type:** Read-only / Search

Searches knowledge base articles with multiple filter options. All filters combine with AND logic.

**Parameters:**
- `searchText` (string, optional) - Full-text search on title/body
- `categoryIds` (integer[], optional) - Filter by category IDs
- `status` (integer, optional) - Filter by status (0=None, 1=Draft, 2=Approved, 3=Archived)
- `ownerUids` (string[], optional) - Filter by owner person UIDs
- `maxResults` (integer, optional) - Max results to return (default: 25)
- `appId` (integer, optional) - Application ID (defaults to TDX_KB_APP_ID or TDX_APP_ID)

**Returns:** Array of KB article objects. Example structure of a single article:
```json
{
  "ID": 6153,
  "AppID": 114,
  "AppName": "Client Portal",
  "CategoryID": 711,
  "CategoryName": "Accounts & Access",
  "Subject": "How to Reset Your Password in Pasco365",
  "Body": "<div class=\"gutter-top break-word...\">HTML content...</div>",
  "Summary": "This document will help those who need to reset their County password...",
  "Status": 3,
  "StatusName": "Approved",
  "Order": 1,
  "IsPublished": true,
  "IsPublic": true,
  "CreatedDate": "2023-07-10T20:21:23.79Z",
  "CreatedFullName": "Alexis Garton",
  "ModifiedDate": "2023-07-11T12:46:30.067Z",
  "ModifiedFullName": "Alexis Garton",
  "OwningGroupID": 370,
  "OwningGroupName": "Desktop Support",
  "Tags": null,
  "RevisionNumber": 2
}
```

---

## tdx-kb-create
**Status:** 🔴 DISABLED  
**Type:** Create

Creates a new knowledge base article.

**Parameters:**
- `categoryId` (integer, required) - KB category ID
- `subject` (string, required) - Article subject/title
- `body` (string, required) - Article body (HTML supported)
- `summary` (string, optional) - Article summary
- `status` (integer, optional) - Article status (0=None, 1=Draft, 2=Approved, 3=Archived)
- `order` (integer, optional) - Sort order
- `reviewDate` (string, optional) - Review date (ISO)
- `ownerUid` (string, optional) - Owner person UID
- `ownerGroupId` (integer, optional) - Owner group ID
- `tags` (string[], optional) - Tags
- `attributes` (array, optional) - Custom attributes with id and value
- `appId` (integer, optional) - Application ID (defaults to TDX_KB_APP_ID or TDX_APP_ID)

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-kb-update
**Status:** 🔴 DISABLED  
**Type:** Update (Full)

Fully updates a knowledge base article.

**Parameters:**
- `id` (integer, required) - KB article ID
- `data` (object, required) - Article data with PascalCase TDX field names
- `appId` (integer, optional) - Application ID (defaults to TDX_KB_APP_ID or TDX_APP_ID)

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-kb-delete
**Status:** 🔴 DISABLED  
**Type:** Delete

Deletes a knowledge base article.

**Parameters:**
- `id` (integer, required) - KB article ID
- `appId` (integer, optional) - Application ID (defaults to TDX_KB_APP_ID or TDX_APP_ID)

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

# PROJECTS

## tdx-project-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Get

Retrieves project details by ID.

**Parameters:**
- `id` (integer, required) - Project ID

**Returns:** Complete single project object. Example structure:
```json
{
  "ID": 927,
  "Name": "Enterprise Credit Card Processing",
  "AccountID": 2356,
  "AccountName": "Information Technology",
  "StatusID": 873,
  "StatusName": "In Process",
  "PriorityID": 1127,
  "PriorityName": "P5",
  "Description": "",
  "AdminUID": "763e3bc1-5322-ed11-bd6e-0050f2f4ae01",
  "AdminName": "Samantha Grahn",
  "AdminEmail": "sgrahn@pascocountyfl.net",
  "CreatedDate": "2022-11-29T14:21:11.313Z",
  "ModifiedDate": "2025-07-21T12:56:12.57Z",
  "PercentComplete": 100,
  "IsActive": true,
  "StartDate": "2021-11-02T00:00:00Z",
  "EndDate": "2023-03-31T00:00:00Z",
  "TypeID": 758,
  "TypeName": "Software Implementation",
  "EstimatedHours": 0,
  "BudgetedHours": 0
}
```

---

## tdx-project-search
**Status:** ✅ ENABLED  
**Type:** Read-only / Search

Searches projects with multiple filter options. All filters combine with AND logic.

**Parameters:**
- `searchText` (string, optional) - Full-text search on project name/description
- `statusIds` (integer[], optional) - Filter by project status IDs
- `priorityIds` (integer[], optional) - Filter by priority IDs
- `accountIds` (integer[], optional) - Filter by account/department IDs
- `managerUids` (string[], optional) - Filter by project manager UIDs
- `isActive` (boolean, optional) - Filter by active status
- `createdDateStart` (string, optional) - Filter by created date start (ISO 8601 format)
- `createdDateEnd` (string, optional) - Filter by created date end (ISO 8601 format)
- `startsDateStart` (string, optional) - Filter by project start date start (ISO 8601 format)
- `startsDateEnd` (string, optional) - Filter by project start date end (ISO 8601 format)
- `maxResults` (integer, optional) - Max results to return (smart default: 5000 when date filters used, 100 otherwise)

**Returns:** Array of project objects. Example structure of a single project:
```json
{
  "ID": 927,
  "Name": "Enterprise Credit Card Processing",
  "AccountID": 2356,
  "AccountName": "Information Technology",
  "StatusID": 873,
  "StatusName": "In Process",
  "PriorityID": 1127,
  "PriorityName": "P5",
  "Description": "",
  "AdminUID": "763e3bc1-5322-ed11-bd6e-0050f2f4ae01",
  "AdminName": "Samantha Grahn",
  "AdminEmail": "sgrahn@pascocountyfl.net",
  "CreatedDate": "2022-11-29T14:21:11.313Z",
  "ModifiedDate": "2025-07-21T12:56:12.57Z",
  "PercentComplete": 100,
  "IsActive": true,
  "StartDate": "2021-11-02T00:00:00Z",
  "EndDate": "2023-03-31T00:00:00Z",
  "TypeID": 758,
  "TypeName": "Software Implementation",
  "EstimatedHours": 0,
  "BudgetedHours": 0
}
```

---

## tdx-project-create
**Status:** 🔴 DISABLED  
**Type:** Create

Creates a new project.

**Parameters:**
- `name` (string, required) - Project name
- `description` (string, optional) - Project description
- `accountId` (integer, optional) - Account/department ID
- `priorityId` (integer, optional) - Priority ID
- `statusId` (integer, optional) - Status ID
- `managerId` (string, optional) - Project manager UID
- `startDate` (string, optional) - Start date (ISO)
- `endDate` (string, optional) - End date (ISO)
- `budgetedHours` (number, optional) - Budgeted hours
- `estimatedHours` (number, optional) - Estimated hours
- `attributes` (array, optional) - Custom attributes with id and value

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## tdx-project-update
**Status:** 🔴 DISABLED  
**Type:** Update (Full)

Fully updates a project.

**Parameters:**
- `id` (integer, required) - Project ID
- `data` (object, required) - Project data with PascalCase TDX field names

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

# PEOPLE

## tdx-people-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Get

Retrieves a person/user by UID.

**Parameters:**
- `uid` (string, required) - Person UID

**Returns:** Complete single person object. Example structure:
```json
{
  "UID": "37b3743f-adf0-f011-93dc-dac58e0fb9ad",
  "FullName": "a test4",
  "FirstName": "a",
  "LastName": "test4",
  "UserName": "atest4@pascocountyfl.net",
  "PrimaryEmail": "atest4@pascocountyfl.net",
  "IsActive": true,
  "IsEmployee": true,
  "DefaultAccountID": 2356,
  "DefaultAccountName": "Information Technology",
  "Company": "Information Technology",
  "Title": "",
  "WorkPhone": "",
  "MobilePhone": "",
  "CreatedDate": "2023-07-10T20:21:23.79Z",
  "TZID": 2,
  "TZName": "(GMT-05:00)Eastern Time(US and Canada)",
  "SecurityRoleName": "Client",
  "ReportsToUID": "37b3743f-adf0-f011-93dc-dac58e0fb9ad",
  "ReportsToFullName": "a test4"
}
```

---

## tdx-people-search
**Status:** ✅ ENABLED  
**Type:** Read-only / Search

Searches for people with multiple filter options. All filters combine with AND logic.

**Parameters:**
- `searchText` (string, optional) - Full-text search on name/email/username
- `firstName` (string, optional) - Filter by first name
- `lastName` (string, optional) - Filter by last name
- `primaryEmail` (string, optional) - Filter by primary email
- `userName` (string, optional) - Filter by username
- `isActive` (boolean, optional) - Filter by active status
- `isEmployee` (boolean, optional) - Filter by employee status
- `accountIds` (integer[], optional) - Filter by account IDs
- `maxResults` (integer, optional) - Max results to return (default: 25)

**Returns:** Array of person objects. Example structure of a single person:
```json
{
  "UID": "37b3743f-adf0-f011-93dc-dac58e0fb9ad",
  "FullName": "a test4",
  "FirstName": "a",
  "LastName": "test4",
  "UserName": "atest4@pascocountyfl.net",
  "PrimaryEmail": "atest4@pascocountyfl.net",
  "IsActive": true,
  "IsEmployee": true,
  "DefaultAccountID": 2356,
  "DefaultAccountName": "Information Technology",
  "Company": "Information Technology",
  "Title": "",
  "WorkPhone": "",
  "MobilePhone": "",
  "CreatedDate": "2023-07-10T20:21:23.79Z",
  "TZID": 2,
  "TZName": "(GMT-05:00)Eastern Time(US and Canada)",
  "SecurityRoleName": "Client",
  "ReportsToUID": "37b3743f-adf0-f011-93dc-dac58e0fb9ad",
  "ReportsToFullName": "a test4"
}
```

---

## tdx-people-lookup
**Status:** ✅ ENABLED  
**Type:** Read-only / Quick Lookup

Quick lookup of a person by name, email, or username.

**Parameters:**
- `searchText` (string, required) - Name, email, or username to search for
- `maxResults` (integer, optional) - Max results to return (default: 10)

**Returns:** Array of person objects matching the lookup criteria.

**Notes:** Optimized for quick user lookups; simpler than full search.

---

## tdx-people-update
**Status:** 🔴 DISABLED  
**Type:** Update (Full)

Fully updates a person/user profile.

**Parameters:**
- `uid` (string, required) - Person UID
- `data` (object, required) - Person data with PascalCase TDX field names

**Status:** Modification tools disabled for safety. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

# ACCOUNTS

## tdx-account-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Get

Retrieves an account/department by ID.

**Parameters:**
- `id` (integer, required) - Account/Department ID

**Returns:** Complete single account object. Example structure:
```json
{
  "ID": 2388,
  "Name": "6th Judicial",
  "ParentID": 2330,
  "ParentName": "External",
  "IsActive": true,
  "Address1": "",
  "City": "",
  "StateName": "",
  "PostalCode": "",
  "Country": "",
  "Phone": "",
  "Fax": "",
  "Url": "",
  "Notes": "",
  "CreatedDate": "2022-09-15T14:49:00Z",
  "ModifiedDate": "2022-09-15T14:49:00Z",
  "Code": "",
  "IndustryID": 0,
  "IndustryName": null,
  "ManagerUID": "00000000-0000-0000-0000-000000000000",
  "ManagerFullName": null,
  "Attributes": ""
}
```

---

## tdx-account-search
**Status:** ✅ ENABLED  
**Type:** Read-only / Search

Searches accounts/departments with filter options. All filters combine with AND logic.

**Parameters:**
- `searchText` (string, optional) - Full-text search on account name
- `isActive` (boolean, optional) - Filter by active status
- `maxResults` (integer, optional) - Max results to return (default: 25)

**Returns:** Array of account objects. Example account:
```json
{
  "ID": 2388,
  "Name": "6th Judicial",
  "ParentID": 2330,
  "ParentName": "External",
  "IsActive": true,
  "Address1": "",
  "City": "",
  "StateName": "",
  "PostalCode": "",
  "Country": "",
  "Phone": "",
  "Fax": "",
  "Url": "",
  "Notes": "",
  "CreatedDate": "2022-09-15T14:49:00Z",
  "ModifiedDate": "2022-09-15T14:49:00Z",
  "Code": "",
  "IndustryID": 0,
  "IndustryName": null,
  "ManagerUID": "00000000-0000-0000-0000-000000000000",
  "ManagerFullName": null,
  "Attributes": ""
}
```

---

# GROUPS

## tdx-group-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Get

Retrieves a group by ID.

**Parameters:**
- `id` (integer, required) - Group ID

**Returns:** Complete single group object. Example structure:
```json
{
  "ID": 371,
  "Name": "Accela Support",
  "Description": "Accela Support group for ticketing",
  "IsActive": true,
  "ExternalID": "",
  "CreatedDate": "2022-09-13T19:36:01.69Z",
  "ModifiedDate": "2022-09-15T15:15:02.83Z",
  "PlatformApplications": ""
}
```

---

## tdx-group-search
**Status:** ✅ ENABLED  
**Type:** Read-only / Search

Searches for groups with filter options. All filters combine with AND logic.

**Parameters:**
- `searchText` (string, optional) - Full-text search on group name
- `isActive` (boolean, optional) - Filter by active status
- `hasAppId` (integer, optional) - Filter by associated application ID
- `maxResults` (integer, optional) - Max results to return (default: 25)

**Returns:** Array of group objects. Example group:
```json
{
  "ID": 371,
  "Name": "Accela Support",
  "Description": "Accela Support group for ticketing",
  "IsActive": true,
  "ExternalID": "",
  "CreatedDate": "2022-09-13T19:36:01.69Z",
  "ModifiedDate": "2022-09-15T15:15:02.83Z",
  "PlatformApplications": ""
}
```

---

# STATUSES

## tdx-statuses-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Metadata

Retrieves available statuses for a specific TDX component type.

**Parameters:**
- `componentType` (enum, required) - Component type to get statuses for: "tickets", "assets", "projects", "cmdb", or "knowledgebase"
- `appId` (integer, optional) - Application ID (not applicable for knowledgebase)

**Returns:** Array of status objects. Example status:
```json
{
  "ID": 894,
  "AppID": 115,
  "AppName": "IT Tickets",
  "Name": "New",
  "Description": "",
  "Order": 1,
  "StatusClass": 1,
  "IsActive": true,
  "RequireGoesOffHold": false,
  "DoNotReopen": false,
  "IsDefault": true
}
```

**Notes:** Use this tool to discover valid `statusIds` for filtering and creating items. Status IDs are required for many search and creation operations.

---

# CUSTOM ATTRIBUTES

## tdx-attributes-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Metadata

Retrieves custom attribute definitions for a TDX component type.

**Parameters:**
- `componentId` (integer, required) - Component ID: 9=Ticket, 27=Asset, 63=CI, 39=KBArticle, 2=Project
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)
- `associatedTypeId` (integer, optional) - Filter by associated type ID

**Returns:** Array of custom attribute definition objects. Example attribute:
```json
{
  "ID": 4424,
  "Name": "800 Number you tried to call",
  "Order": 0,
  "Description": "",
  "SectionID": 0,
  "FieldType": "textbox",
  "DataType": "String",
  "Choices": [],
  "IsRequired": false,
  "IsUpdatable": false,
  "Value": "",
  "ValueText": "",
  "ChoicesText": "",
  "AssociatedItemIDs": [0]
}
```

**Notes:** Returns comprehensive attribute schema with field types (textbox, textarea, dropdown, datefield, etc.), required/optional status, display order, and choice options for dropdowns. Essential for understanding custom field structure before creating/updating items.

---

## General Usage Notes

### Environment Variables
- `TDX_APP_ID` - Default application ID for tickets, projects, and knowledge base
- `TDX_ASSETS_APP_ID` - Application ID for assets and CMDB (if different from TDX_APP_ID)
- `TDX_KB_APP_ID` - Application ID for knowledge base (if different from TDX_APP_ID)
- `ALLOW_MODIFICATIONS` - Set to "true" to enable create/update/delete operations (disabled by default)

### Common Patterns

**Search Pattern:**
- All search tools support full-text `searchText` (plain text, no filter syntax)
- Multiple filters combine with AND logic
- `maxResults` parameter controls pagination: Tickets/Assets/Projects default to 100 (5000 with date filters); other tools default to 25
- Empty results return empty array without error

**Get Pattern:**
- `tdx-*-get` tools retrieve single items by ID
- Return complete object with all fields and metadata
- Return single object (not array)

**Feed Pattern:**
- `tdx-*-feed-get` tools retrieve activity history/comments
- `tdx-*-feed-add` tools add new comments (disabled by default)
- Useful for audit trails and change tracking

**Metadata Pattern:**
- `tdx-statuses-get` and `tdx-attributes-get` return schema/configuration data
- Use these to discover valid values for other operations
- Essential for building dynamic UIs or validating input

### Data Types

- **UIDs (User IDs):** String format, unique identifiers for people
- **IDs:** Integer format, unique identifiers for most objects
- **Dates:** ISO 8601 format (e.g., "2026-05-11T14:47:31.68Z")
- **Status/Priority/Type IDs:** Use `tdx-statuses-get` to discover valid values

