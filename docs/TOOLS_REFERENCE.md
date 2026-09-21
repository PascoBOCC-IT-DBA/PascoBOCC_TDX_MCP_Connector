# TeamDynamix MCP Server - Tools Reference

**Total Tools:** 45 tools across 11 categories  
**Modification Status:** Modification tools (create, update, delete) require a read-write API key (`MCP_API_KEY_READWRITE`). They are filtered out of tool listings for read-only keys and rejected with `403` on direct calls.

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
- [Ticket Types (1 tool)](#ticket-types)
- [Custom Attributes (1 tool)](#custom-attributes)

---

# TICKETS

## tdx-ticket-search
**Type:** Read-only / Search

Searches and filters TeamDynamix tickets. All filters combine with AND logic.

**Parameters:**
- `searchText` (string, optional) - Full-text search on title/description
- `statusIds` (integer[], optional) - Filter by status IDs
- `priorityIds` (integer[], optional) - Filter by priority IDs
- `typeIds` (integer[], optional) - Filter by ticket type IDs
- `accountIds` (integer[], optional) - Filter by account/department IDs
- `requestorUids` (string[], optional) - Filter by requestor person UIDs (the person the ticket is FOR, not necessarily who submitted it)
- `createdByUid` (string, optional) - Filter by creator/author UID (the person who physically submitted/opened the ticket). Use this instead of `requestorUids` when searching for tickets a person **created**, since a person can create a ticket on behalf of someone else (in which case `requestorUids` would not match)
- `responsibleUids` (string[], optional) - Filter by responsible person UIDs. Sent to TDX as `PrimaryResponsibilityUids`, which matches the ticket's own "Primary Responsible" person. TDX's `ResponsibilityUids` parameter also matches task-level responsibility, so it is only used when `includeTaskResponsibility` is true; results are additionally post-filtered on the ticket's `ResponsibleUid` as a safety net
- `responsibleGroupIds` (integer[], optional) - Filter by responsible group IDs. Sent as `PrimaryResponsibilityGroupIDs` unless `includeTaskResponsibility` is true
- `includeTaskResponsibility` (boolean, optional) - When true, `responsibleUids`/`responsibleGroupIds` also match tickets where the person or group is only responsible for a ticket **task**. Default false
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
**Type:** Read-only / Count + Preview

Gets count of tickets matching filters and returns a preview of matching tickets. `count` always reflects the full match set; `maxSummaryResults` only limits the preview array. Efficient for aggregate queries without retrieving full result sets.

**Parameters:**
All parameters match `tdx-ticket-search`:
- `searchText` (string, optional) - Full-text search on title/description
- `statusIds` (integer[], optional) - Filter by status IDs
- `priorityIds` (integer[], optional) - Filter by priority IDs
- `typeIds` (integer[], optional) - Filter by ticket type IDs
- `accountIds` (integer[], optional) - Filter by account/department IDs
- `requestorUids` (string[], optional) - Filter by requestor person UIDs (the person the ticket is FOR, not necessarily who submitted it)
- `createdByUid` (string, optional) - Filter by creator/author UID (the person who physically submitted/opened the ticket). Use this instead of `requestorUids` when counting tickets a person **created**, since a person can create a ticket on behalf of someone else
- `responsibleUids` (string[], optional) - Filter by responsible person UIDs. Matches the ticket's own primary responsible person only (see note under `tdx-ticket-search`)
- `includeTaskResponsibility` (boolean, optional) - When true, also match task-level responsibility. Default false
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
- `maxSummaryResults` (integer, optional) - Max tickets to include in the preview array (default: 200). **Does not affect `count`.**
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Returns:** Object with count and preview tickets:
```json
{
  "count": 1247,
  "countIsExact": true,
  "previewCount": 100,
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

**Count accuracy:** The server queries TDX with a scan ceiling (`TDX_MAX_RESULTS_COUNT_SCAN`, default 10000) that is independent of `maxSummaryResults`. If the match set hits that ceiling, `countIsExact` is `false`, `count` is a floor rather than a total, and a `note` field explains it. Always check `countIsExact` before reporting a number.

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
**Type:** Read-only / Get

Retrieves full details for a specific ticket by ID.

**Parameters:**
- `id` (integer, required) - Ticket ID
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Returns:** Complete single ticket object (includes attachments, tasks, feed entries, and custom attributes). Example structure (same as tdx-ticket-search result format with 55+ fields).

---

## tdx-ticket-feed-get
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
**Status:** Requires read-write key  
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

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-ticket-update
**Status:** Requires read-write key  
**Type:** Update (Full)

Fully updates a ticket (all fields must be provided).

**Parameters:**
- `id` (integer, required) - Ticket ID
- `data` (object, required) - Full ticket data with PascalCase TDX field names
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-ticket-patch
**Status:** Requires read-write key  
**Type:** Update (Partial)

Partially updates a ticket (only specified fields are updated).

**Parameters:**
- `id` (integer, required) - Ticket ID
- `data` (object, required) - Partial ticket data with PascalCase TDX field names
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-ticket-feed-add
**Status:** Requires read-write key  
**Type:** Feed/Comment

Adds a comment/note to a ticket's activity feed.

**Parameters:**
- `id` (integer, required) - Ticket ID
- `comments` (string, required) - Comment text (HTML supported)
- `isPrivate` (boolean, optional) - Whether the comment is private (default: false)
- `notify` (string[], optional) - UIDs of people to notify
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-ticket-add-asset
**Status:** Requires read-write key  
**Type:** Link/Association

Links an asset to a ticket.

**Parameters:**
- `id` (integer, required) - Ticket ID
- `assetId` (integer, required) - Asset ID to link
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-ticket-add-contact
**Status:** Requires read-write key  
**Type:** Link/Association

Adds a contact/person to a ticket.

**Parameters:**
- `id` (integer, required) - Ticket ID
- `uid` (string, required) - Person UID to add as contact
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

# ASSETS

## tdx-asset-get
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
**Status:** Requires read-write key  
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

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-asset-update
**Status:** Requires read-write key  
**Type:** Update (Full)

Fully updates an asset (all fields must be provided).

**Parameters:**
- `id` (integer, required) - Asset ID
- `data` (object, required) - Full asset data with PascalCase TDX field names
- `appId` (integer, optional) - Application ID (defaults to TDX_ASSETS_APP_ID or TDX_APP_ID)

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-asset-patch
**Status:** Requires read-write key  
**Type:** Update (Partial)

Partially updates an asset (only specified fields are updated).

**Parameters:**
- `id` (integer, required) - Asset ID
- `data` (object, required) - Partial asset data with PascalCase TDX field names
- `appId` (integer, optional) - Application ID (defaults to TDX_ASSETS_APP_ID or TDX_APP_ID)

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-asset-delete
**Status:** Requires read-write key  
**Type:** Delete

Deletes an asset.

**Parameters:**
- `id` (integer, required) - Asset ID
- `appId` (integer, optional) - Application ID (defaults to TDX_ASSETS_APP_ID or TDX_APP_ID)

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-asset-feed-add
**Status:** Requires read-write key  
**Type:** Feed/Comment

Adds a comment/note to an asset's activity feed.

**Parameters:**
- `id` (integer, required) - Asset ID
- `comments` (string, required) - Comment text (HTML supported)
- `isPrivate` (boolean, optional) - Whether the comment is private (default: false)
- `notify` (string[], optional) - UIDs of people to notify
- `appId` (integer, optional) - Application ID (defaults to TDX_ASSETS_APP_ID or TDX_APP_ID)

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-asset-categories
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
**Status:** Requires read-write key  
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

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-cmdb-update
**Status:** Requires read-write key  
**Type:** Update (Full)

Fully updates a configuration item (all fields must be provided).

**Parameters:**
- `id` (integer, required) - CI ID
- `data` (object, required) - Full CI data with PascalCase TDX field names

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-cmdb-delete
**Status:** Requires read-write key  
**Type:** Delete

Deletes a configuration item.

**Parameters:**
 - `id` (integer, required) - CI ID

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-cmdb-feed-add
**Status:** Requires read-write key  
**Type:** Feed/Comment

Adds a comment/note to a CI's activity feed.

**Parameters:**
- `id` (integer, required) - CI ID
- `comments` (string, required) - Comment text (HTML supported)
- `isPrivate` (boolean, optional) - Whether the comment is private (default: false)
- `notify` (string[], optional) - UIDs of people to notify

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-cmdb-add-relationship
**Status:** Requires read-write key  
**Type:** Link/Association

Adds a relationship/dependency between two configuration items.

**Parameters:**
- `id` (integer, required) - Source CI ID
- `otherItemId` (integer, required) - Target CI ID
- `typeId` (integer, required) - Relationship type ID
- `isInverse` (boolean, optional) - Whether this is an inverse relationship

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

# KNOWLEDGE BASE

## tdx-kb-get
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
**Status:** Requires read-write key  
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

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-kb-update
**Status:** Requires read-write key  
**Type:** Update (Full)

Fully updates a knowledge base article.

**Parameters:**
- `id` (integer, required) - KB article ID
- `data` (object, required) - Article data with PascalCase TDX field names
- `appId` (integer, optional) - Application ID (defaults to TDX_KB_APP_ID or TDX_APP_ID)

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-kb-delete
**Status:** Requires read-write key  
**Type:** Delete

Deletes a knowledge base article.

**Parameters:**
- `id` (integer, required) - KB article ID
- `appId` (integer, optional) - Application ID (defaults to TDX_KB_APP_ID or TDX_APP_ID)

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

# PROJECTS

## tdx-project-get
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
**Status:** Requires read-write key  
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

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

## tdx-project-update
**Status:** Requires read-write key  
**Type:** Update (Full)

Fully updates a project.

**Parameters:**
- `id` (integer, required) - Project ID
- `data` (object, required) - Project data with PascalCase TDX field names

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

# PEOPLE

## tdx-people-get
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
**Type:** Read-only / Quick Lookup

Quick lookup of a person by name, email, or username.

**Parameters:**
- `searchText` (string, required) - Name, email, or username to search for
- `maxResults` (integer, optional) - Max results to return (default: 10)

**Returns:** Array of person objects matching the lookup criteria.

**Notes:** Optimized for quick user lookups; simpler than full search.

---

## tdx-people-update
**Status:** Requires read-write key  
**Type:** Update (Full)

Fully updates a person/user profile.

**Parameters:**
- `uid` (string, required) - Person UID
- `data` (object, required) - Person data with PascalCase TDX field names

**Status:** Requires a read-write API key (`MCP_API_KEY_READWRITE`). Hidden from read-only keys and rejected with `403`.

---

# ACCOUNTS

## tdx-account-get
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

# TICKET TYPES

## tdx-ticket-types-get
**Type:** Read-only / Metadata

Looks up ticket types for a ticketing application. Call with no parameters to list all types, with `id` to fetch one type, or with `name` to filter the list by a case-insensitive name substring.

**Parameters:**
- `id` (integer, optional) - Fetch a single ticket type by its ID
- `name` (string, optional) - Case-insensitive substring filter on the type name (ignored when `id` is supplied)
- `appId` (integer, optional) - Application ID (defaults to `TDX_APP_ID`)

**Returns:** Array of ticket type objects (or a single object when `id` is supplied). Example:
```json
{
  "ID": 3252,
  "AppID": 115,
  "AppName": "IT Tickets",
  "CategoryID": 412,
  "CategoryName": "Support",
  "FullName": "Support / Incident",
  "Name": "Incident",
  "Description": "",
  "IsActive": true
}
```

**Notes:** Use this tool to resolve a ticket type name to the numeric ID required by the `typeIds` filter on `tdx-ticket-search` and `tdx-ticket-count`.

---

# CUSTOM ATTRIBUTES

## tdx-attributes-get
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
- `MCP_API_KEY_READONLY` - API key granting access to read-only tools only
- `MCP_API_KEY_READWRITE` - API key granting access to all tools, including create/update/delete

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
- `tdx-*-feed-add` tools add new comments (require a read-write key)
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

