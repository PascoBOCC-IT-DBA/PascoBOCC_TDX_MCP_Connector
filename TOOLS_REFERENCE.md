# TeamDynamix MCP Server - Tools Reference

**Total Tools:** 43 tools across 10 categories  
**Modification Status:** Modification tools (create, update, delete) are DISABLED by default. Enable via `ALLOW_MODIFICATIONS=true` environment variable only in authorized environments.

---

## Quick Navigation

- [Tickets (9 tools)](#tickets)
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
- `maxResults` (integer, optional) - Max results to return (default: 25)
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Returns:** Array of ticket objects with ID, Title, CreatedDate, StatusID, StatusName, PriorityID, PriorityName, AccountID, AccountName, RequestorID, RequestorFullName, Description, and 40+ additional fields.

**Notes:** Search text does not support filter syntax; case-insensitive. Empty results return empty array without error.

---

## tdx-ticket-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Get

Retrieves full details for a specific ticket by ID.

**Parameters:**
- `id` (integer, required) - Ticket ID
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Returns:** Complete ticket object with 55+ fields including nested data for requestor, responsible party, and account.

---

## tdx-ticket-feed-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Feed

Retrieves the activity feed/comment history for a specific ticket.

**Parameters:**
- `id` (integer, required) - Ticket ID
- `appId` (integer, optional) - Application ID (defaults to TDX_APP_ID)

**Returns:** Array of feed entries with ID, CreatedDate, CreatedBy, UpdateType, Body, IsEdited flag.

**Notes:** Provides complete audit trail and ticket lifecycle tracking.

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

**Returns:** Complete asset object with ID, Name, FormID, FormName, StatusID, StatusName, SerialNumber, ModelID, ModelName, ManufacturerID, ManufacturerName, LocationID, LocationName, OwningDepartmentID, OwningDepartmentName, PurchaseCost, AcquisitionDate, ExpectedReplacementDate, CreatedDate, ModifiedDate, CustomAttributes, and additional fields.

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
- `maxResults` (integer, optional) - Max results to return (default: 25)
- `appId` (integer, optional) - Application ID (defaults to TDX_ASSETS_APP_ID or TDX_APP_ID)

**Returns:** Array of asset objects with complete details matching search criteria.

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

**Returns:** Array of asset form/category objects with ID, Name, Description, IsActive, FormFields, and additional metadata.

**Notes:** Use this to discover available asset types, find FormIDs for creating new assets, and understand asset structure variations.

---

# CMDB

## tdx-cmdb-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Get

Retrieves full details for a specific configuration item (CI) by ID.

**Parameters:**
- `id` (integer, required) - CI ID

**Returns:** Complete CI object with ID, Name, TypeID, TypeName, FormID, FormName, IsActive, OwningDepartmentID, OwningDepartmentName, LocationID, LocationName, CreatedDate, ModifiedDate, CustomAttributes, and additional fields.

**Notes:** CMDB always uses the TDAssets application.

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

**Returns:** Array of CI objects matching search criteria.

**Notes:** CMDB always uses the TDAssets application (no appId parameter needed).

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

**Returns:** Complete KB article object with ID, Subject, Body, Summary, Status, CategoryID, CreatedDate, ModifiedDate, OwnerUID, Tags, CustomAttributes, and additional fields.

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

**Returns:** Array of KB article objects matching search criteria.

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

**Returns:** Complete project object with ID, Name, Description, StatusID, StatusName, PriorityID, PriorityName, AccountID, AccountName, ManagerUID, ManagerName, StartDate, EndDate, BudgetedHours, EstimatedHours, CreatedDate, ModifiedDate, CustomAttributes, and additional fields.

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
- `maxResults` (integer, optional) - Max results to return (default: 25)

**Returns:** Array of project objects matching search criteria.

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

**Returns:** Complete person object with UID, FirstName, LastName, PrimaryEmail, UserName, IsActive, IsEmployee, AccountID, AccountName, CreatedDate, ModifiedDate, and additional fields.

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

**Returns:** Array of person objects matching search criteria.

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

**Returns:** Complete account object with ID, Name, Description, IsActive, ParentAccountID, CreatedDate, ModifiedDate, and additional fields.

---

## tdx-account-search
**Status:** ✅ ENABLED  
**Type:** Read-only / Search

Searches accounts/departments with filter options. All filters combine with AND logic.

**Parameters:**
- `searchText` (string, optional) - Full-text search on account name
- `isActive` (boolean, optional) - Filter by active status
- `maxResults` (integer, optional) - Max results to return (default: 25)

**Returns:** Array of account objects matching search criteria.

---

# GROUPS

## tdx-group-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Get

Retrieves a group by ID.

**Parameters:**
- `id` (integer, required) - Group ID

**Returns:** Complete group object with ID, Name, Description, IsActive, CreatedDate, ModifiedDate, and additional fields.

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

**Returns:** Array of group objects matching search criteria.

---

# STATUSES

## tdx-statuses-get
**Status:** ✅ ENABLED  
**Type:** Read-only / Metadata

Retrieves available statuses for a specific TDX component type.

**Parameters:**
- `componentType` (enum, required) - Component type to get statuses for: "tickets", "assets", "projects", "cmdb", or "knowledgebase"
- `appId` (integer, optional) - Application ID (not applicable for knowledgebase)

**Returns:** Array of status objects with ID, Name, Order, StatusClass, IsActive, RequireGoesOffHold, DoNotReopen, and additional fields.

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

**Returns:** Comprehensive custom attribute schema including attribute IDs, names, types (text, number, dropdown, date, etc.), valid choices for dropdowns, required/optional status, display order, and custom validation rules.

**Notes:** Essential for understanding the custom field structure before creating/updating items. Returns large JSON objects with complete field metadata.

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
- `maxResults` parameter controls pagination (default: 25)
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

---

## tdx-cmdb-get
**Status:** ✅ FULLY TESTED (May 12, 2026, 09:53 UTC)  
**Source:** src/tools/cmdb.ts

### Overview
Retrieves details for a specific CI by ID from the TDAssets application.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | YES | CI ID |
| `appId` | integer | NO | Application ID (auto-defaults to TDAssets) |

### Test Results
✅ PASSED: Successfully retrieved CI data with all attributes
✅ PASSED: Error handling verified for invalid CI IDs
✅ Auto-defaults to TDAssets application (no manual configuration needed)

---

## tdx-cmdb-update
**Status:** 🔴 DISABLED (Modification Tool - ALLOW_MODIFICATIONS=false)  
**Source:** src/tools/cmdb.ts

### Overview
Fully updates a CI.

### Status
🔴 DISABLED: Modification tools disabled for safety. Enable via ALLOW_MODIFICATIONS environment variable only in authorized environments.

---

## tdx-cmdb-delete
**Status:** 🔴 DISABLED (Modification Tool - ALLOW_MODIFICATIONS=false)  
**Source:** src/tools/cmdb.ts

### Overview
Deletes a CI.

### Status
🔴 DISABLED: Modification tools disabled for safety. Enable via ALLOW_MODIFICATIONS environment variable only in authorized environments.

---

## tdx-cmdb-search
**Status:** ✅ FULLY TESTED (May 12, 2026, 09:53 UTC)  
**Source:** src/tools/cmdb.ts

### Overview
Searches and filters Configuration Items with multiple filtering options. Filters combine with AND logic.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchText` | string | NO | Full-text search on name/description |
| `typeIds` | integer[] | NO | Filter by CI type IDs |
| `isActive` | boolean | NO | Filter by active/inactive status |
| `owningDepartmentIds` | integer[] | NO | Filter by owning department |
| `locationIds` | integer[] | NO | Filter by location |
| `maxResults` | integer | NO | Max results to return (default: 25) |
| `appId` | integer | NO | Application ID (auto-defaults to TDAssets) |

### Test Results
✅ PASSED: Successfully searches CIs in TDAssets application
✅ PASSED: Filtering parameters working correctly
✅ PASSED: Auto-defaults to TDAssets application (no manual configuration needed)

---

## tdx-cmdb-feed-add
**Status:** 🔴 DISABLED (Modification Tool - ALLOW_MODIFICATIONS=false)  
**Source:** src/tools/cmdb.ts

### Overview
Adds a note/comment to a CI's feed.

### Status
🔴 DISABLED: Modification tools disabled for safety. Enable via ALLOW_MODIFICATIONS environment variable only in authorized environments.

---

## tdx-cmdb-add-relationship
**Status:** 🔴 DISABLED (Modification Tool - ALLOW_MODIFICATIONS=false)  
**Source:** src/tools/cmdb.ts

### Overview
Adds a relationship between two CIs.

### Status
🔴 DISABLED: Modification tools disabled for safety. Enable via ALLOW_MODIFICATIONS environment variable only in authorized environments.

### Parameters (from source code)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | YES | Source CI ID |
| `otherItemId` | integer | YES | Target CI ID |
| `typeId` | integer | YES | Relationship type ID |
| `isInverse` | boolean | NO | Whether this is inverse relationship |
| `appId` | integer | NO | Application ID |

### Key Feature
Unique capability for managing CMDB relationships and dependencies.

### Status
🔄 PENDING: Needs testing

---

# KNOWLEDGE BASE

## tdx-kb-create
**Status:** 🔴 DISABLED (Modification Tool - ALLOW_MODIFICATIONS=false)  
**Source:** src/tools/kb.ts

### Overview
Creates a new knowledge base article.

### Status
🔴 DISABLED: Modification tools disabled for safety. Enable via ALLOW_MODIFICATIONS environment variable only in authorized environments.

---

## tdx-kb-get
**Status:** ✅ FULLY TESTED (May 12, 2026, 09:53 UTC)  
**Source:** src/tools/kb.ts

### Overview
Retrieves a knowledge base article by ID.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | YES | KB Article ID |
| `appId` | integer | NO | Application ID (defaults to env TDX_KB_APP_ID) |

### Test Results
✅ PASSED: Successfully retrieves KB article details with all content and metadata.

---

## tdx-kb-update
**Status:** 🔴 DISABLED (Modification Tool - ALLOW_MODIFICATIONS=false)  
**Source:** src/tools/kb.ts

### Overview
Updates a knowledge base article.

### Status
🔴 DISABLED: Modification tools disabled for safety. Enable via ALLOW_MODIFICATIONS environment variable only in authorized environments.

---

## tdx-kb-delete
**Status:** 🔴 DISABLED (Modification Tool - ALLOW_MODIFICATIONS=false)  
**Source:** src/tools/kb.ts

### Overview
Deletes a knowledge base article.

### Status
🔴 DISABLED: Modification tools disabled for safety. Enable via ALLOW_MODIFICATIONS environment variable only in authorized environments.

---

## tdx-kb-search
**Status:** ✅ FULLY TESTED (May 12, 2026, 09:53 UTC)  
**Source:** src/tools/kb.ts

### Overview
Searches knowledge base articles with filters.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchText` | string | NO | Full-text search on title/body |
| `categoryIds` | integer[] | NO | Filter by category IDs |
| `status` | integer | NO | Filter by status (1=Draft, 2=Approved, 3=Archived) |
| `maxResults` | integer | NO | Max results to return (default: 25) |
| `appId` | integer | NO | Application ID (defaults to env TDX_KB_APP_ID) |

### Test Results
✅ PASSED: Successfully searches KB articles with multiple filters

---

# PROJECTS

## tdx-project-create
**Status:** 🔴 DISABLED (Modification Tool - ALLOW_MODIFICATIONS=false)  
**Source:** src/tools/projects.ts

### Overview
Creates a new project.

### Status
🔴 DISABLED: Modification tools disabled for safety. Enable via ALLOW_MODIFICATIONS environment variable only in authorized environments.

---

## tdx-project-get
**Status:** ✅ FULLY TESTED (May 12, 2026, 09:53 UTC)  
**Source:** src/tools/projects.ts

### Overview
Retrieves project details by ID.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | YES | Project ID |
| `appId` | integer | NO | Application ID (defaults to env TDX_APP_ID) |

### Test Results
✅ PASSED: Successfully retrieves project details and metadata.

---

## tdx-project-update
**Status:** 🔴 DISABLED (Modification Tool - ALLOW_MODIFICATIONS=false)  
**Source:** src/tools/projects.ts

### Overview
Updates project details.

### Status
🔴 DISABLED: Modification tools disabled for safety. Enable via ALLOW_MODIFICATIONS environment variable only in authorized environments.

---

## tdx-project-search
**Status:** ✅ FULLY TESTED (May 12, 2026, 09:53 UTC)  
**Source:** src/tools/projects.ts

### Overview
Searches projects with filters.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchText` | string | NO | Full-text search on project name/description |
| `statusIds` | integer[] | NO | Filter by project status IDs |
| `priorityIds` | integer[] | NO | Filter by priority IDs |
| `accountIds` | integer[] | NO | Filter by account/department IDs |
| `managerUids` | string[] | NO | Filter by project manager UIDs |
| `isActive` | boolean | NO | Filter by active status |
| `maxResults` | integer | NO | Max results to return (default: 25) |
| `appId` | integer | NO | Application ID (defaults to env TDX_APP_ID) |

### Test Results
✅ PASSED: Successfully searches and filters projects

---

# PEOPLE

## tdx-people-get
**Status:** ✅ FULLY TESTED (May 12, 2026, 09:53 UTC)  
**Source:** src/tools/people.ts

### Overview
Retrieves a person/user by UID.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | YES | Person UID |

### Test Results
✅ PASSED: Successfully retrieves person/user details.

---

## tdx-people-search
**Status:** ✅ FULLY TESTED (May 12, 2026, 09:53 UTC)  
**Source:** src/tools/people.ts

### Overview
Searches for people with filters.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchText` | string | NO | Full-text search on name/email/username |
| `firstName` | string | NO | Filter by first name |
| `lastName` | string | NO | Filter by last name |
| `primaryEmail` | string | NO | Filter by primary email |
| `userName` | string | NO | Filter by username |
| `isActive` | boolean | NO | Filter by active status |
| `isEmployee` | boolean | NO | Filter by employee status |
| `maxResults` | integer | NO | Max results to return (default: 25) |

### Test Results
✅ PASSED: Successfully searches and filters people by multiple criteria.

---

## tdx-people-lookup
**Status:** ✅ FULLY TESTED (May 12, 2026, 09:53 UTC)  
**Source:** src/tools/people.ts

### Overview
Quick lookup of a person by name, email, or username.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchText` | string | YES | Name, email, or username to search for |
| `maxResults` | integer | NO | Max results to return (default: 10) |

### Test Results
✅ PASSED: Successfully performs quick people lookups by name, email, or username.

---

## tdx-people-update
**Status:** 🔴 DISABLED (Modification Tool - ALLOW_MODIFICATIONS=false)  
**Source:** src/tools/people.ts

### Overview
Updates a person/user profile.

### Status
🔴 DISABLED: Modification tools disabled for safety. Enable via ALLOW_MODIFICATIONS environment variable only in authorized environments.

---

# ACCOUNTS

## tdx-account-get
**Status:** ✅ FULLY TESTED (May 12, 2026, 09:53 UTC)  
**Source:** src/tools/accounts.ts

### Overview
Retrieves an account/department by ID.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | YES | Account/Department ID |

### Test Results
✅ PASSED: Successfully retrieves account/department details.

---

## tdx-account-search
**Status:** ✅ FULLY TESTED (May 12, 2026, 09:53 UTC)  
**Source:** src/tools/accounts.ts

### Overview
Searches accounts/departments with filters.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchText` | string | NO | Full-text search on account name |
| `isActive` | boolean | NO | Filter by active status |
| `maxResults` | integer | NO | Max results to return (default: 25) |

### Test Results
✅ PASSED: Successfully searches and filters accounts/departments.

---

# GROUPS

## tdx-group-get
**Status:** ✅ FULLY TESTED (May 12, 2026, 09:53 UTC)  
**Source:** src/tools/groups.ts

### Overview
Retrieves a group by ID.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | YES | Group ID |

### Test Results
✅ PASSED: Successfully retrieves group details.

---

## tdx-group-search
**Status:** ✅ FULLY TESTED (May 12, 2026, 09:53 UTC)  
**Source:** src/tools/groups.ts

### Overview
Searches for groups with filters.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchText` | string | NO | Full-text search on group name |
| `hasAppId` | integer | NO | Filter by associated application ID |
| `isActive` | boolean | NO | Filter by active status |
| `maxResults` | integer | NO | Max results to return (default: 25) |

### Test Results
✅ PASSED: Successfully searches and filters groups.

---

# STATUSES

## tdx-statuses-get
**Status:** ✅ TESTED  
**Source:** src/tools/statuses.ts

### Overview
Retrieves available statuses for a TDX component type.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `componentType` | enum | YES | Component type: "tickets", "assets", "projects", "cmdb", or "knowledgebase" |
| `appId` | integer | NO | Application ID |

### Test Results

**Test 1: Ticket Statuses**
```
Input: componentType="tickets"
Result: ✅ PASS - Returned 5 statuses:
  - 894: New
  - 896: In Process
  - 898: Closed
  - 899: Cancelled
  - 3625: Pending
```

### Return Structure
```json
[
  {
    "ID": 894,
    "Name": "New",
    "Order": 1,
    "StatusClass": "New",
    "IsActive": true,
    "RequireGoesOffHold": false,
    "DoNotReopen": false
  }
]
```

### Key Findings
- ✅ Supports all 5 component types
- ✅ Returns status IDs needed for filtering
- ✅ Includes status ordering and behavioral flags
- ✅ Essential reference for filter parameters

### Usage
Use this to discover valid statusIds for other tools' search/create operations.

---

# CUSTOM ATTRIBUTES

## tdx-attributes-get
**Status:** ✅ TESTED  
**Source:** src/tools/attributes.ts

### Overview
Retrieves custom attribute definitions for a TDX component.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `componentId` | integer | YES | Component ID (9=Ticket, 27=Asset, 63=CI, 39=KBArticle, 2=Project) |
| `appId` | integer | NO | Application ID |
| `associatedTypeId` | integer | NO | Filter by associated type ID |

### Test Results

**Test 1: Ticket Custom Attributes**
```
Input: componentId=9
Result: ✅ PASS - Returned 305KB of attribute definitions
```

### Return Structure
Returns large JSON object with attribute metadata including:
- Attribute ID, name, type (text, number, dropdown, etc.)
- Valid choices for dropdown/multi-select fields
- Required/optional status
- Display order
- Custom validation rules

### Key Findings
- ✅ Provides complete custom field schema
- ✅ Essential for understanding custom attribute structure before creating/updating items
- ✅ Component IDs: 9=Ticket, 27=Asset, 63=CI, 39=KBArticle, 2=Project

### Usage
Use this to discover:
- Available custom fields for each component
- Valid choice values for dropdown fields
- Required vs optional field status
- Field types and validation rules

---

## Key Patterns Across All Tools

### Create/Update Pattern
Most create/update operations follow this pattern:
```
Input: Object with title/name, description, and various ID references
Output: Created/updated object with assigned ID and default values
```

### Search Pattern
All search operations support:
- `searchText` - Full-text search (plain text, no filter syntax)
- Multiple ID-based filters (statusIds, priorityIds, etc.)
- Filter combination with AND logic
- `maxResults` parameter for pagination
- `appId` parameter (optional, defaults to env TDX_APP_ID)

### Feed/Comment Pattern
Most entities (tickets, assets, CIs) support:
- `feed-get` - Retrieve activity history
- `feed-add` - Add new comment/note

### Get/Lookup Pattern
Most entities support:
- `get` - Retrieve by ID
- `lookup` - Quick search (people, some others)

---

## References

- [Testing Report](./TESTING_REPORT.md) - Test results and infrastructure verification
- [Configuration guide](./COPILOT_INTEGRATION.md)
- [Index file](./src/index.ts) - Tool registration
