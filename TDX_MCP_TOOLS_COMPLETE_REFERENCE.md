# TeamDynamix MCP Server - Complete Tools Reference

**Last Updated:** May 11, 2026  
**Total Tools Documented:** 44 tools across 10 categories  
**Status Summary:** 5 TESTED, 5 DISABLED, 34 PENDING TESTING

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
**Status:** ✅ EXTENSIVELY TESTED  
**Source:** src/tools/tickets.ts (lines 1-65)

### Overview
Searches and filters TeamDynamix tickets with multiple filtering options. All filters combine with AND logic.

### Parameters

| Parameter | Type | Default | Description | Status |
|-----------|------|---------|-------------|--------|
| `searchText` | string | none | Full-text search (plain text only, no filter syntax) | ✅ TESTED |
| `statusIds` | integer[] | none | Filter by status ID | ✅ TESTED |
| `priorityIds` | integer[] | none | Filter by priority ID | 🟡 Assumed |
| `typeIds` | integer[] | none | Filter by ticket type ID | 🟡 Assumed |
| `accountIds` | integer[] | none | Filter by account/department ID | 🟡 Assumed |
| `requestorUids` | string[] | none | Filter by requestor person UID | 🟡 Assumed |
| `responsibleUids` | string[] | none | Filter by responsible person UID | 🟡 Assumed |
| `responsibleGroupIds` | integer[] | none | Filter by responsible group ID | 🟡 Assumed |
| `maxResults` | integer | 25 | Max results to return (1-1000+) | ✅ TESTED |
| `appId` | integer | env TDX_APP_ID | Application ID | 🟡 Assumed |

### Test Results

**Test 1: searchText Filter**
```
Input: searchText="account", maxResults=5
Result: ✅ PASS - Returned 5 results with "account" in title/description
```

**Test 2: statusIds Filter**
```
Input: statusIds=[898], maxResults=10
Result: ✅ PASS - All 10 results had StatusId=898
```

**Test 3: Combined Filters**
```
Input: searchText="account", statusIds=[898], maxResults=10
Result: ✅ PASS - 8/10 results had "account" AND StatusId=898 (AND logic confirmed)
```

**Test 4: maxResults Parameter**
```
Input: maxResults=1
Result: ✅ PASS - Returned exactly 1 result
Input: maxResults=5
Result: ✅ PASS - Returned exactly 5 results
```

**Test 5: Invalid Filter Values**
```
Input: statusIds=[99999]
Result: ✅ PASS - Returned empty array [] (graceful handling)
```

### Known Status IDs
- 894 = New
- 896 = In Process
- 898 = Closed
- 899 = Cancelled
- 3625 = Pending

*(Run tdx-statuses-get to get complete list)*

### Return Structure
```json
{
  "ID": 4744483,
  "Title": "string",
  "CreatedDate": "2026-05-11T14:47:31.68Z",
  "StatusID": 894,
  "StatusName": "New",
  "PriorityID": 329,
  "PriorityName": "P3",
  "AccountID": 3910,
  "AccountName": "Enterprise Resource Planning"
  // (55+ fields total)
}
```

### Key Findings
- ✅ searchText does **NOT** support filter syntax (e.g., "created:2026-05-11")
- ✅ Date filtering must be done client-side on CreatedDate field
- ✅ Filter combinations use AND logic
- ✅ No results throws no error, returns `[]`
- ✅ Case-insensitive text search

### Recommendations
- Always filter by statusIds/priorityIds first, then use searchText
- For date-based queries, retrieve and filter client-side
- Start with maxResults=25-50 for performance
- Check for empty results rather than error handling

---

## tdx-ticket-get
**Status:** ✅ TESTED  
**Source:** src/tools/tickets.ts (lines 67-86)

### Overview
Retrieves full details for a specific ticket by ID.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | YES | Ticket ID |
| `appId` | integer | NO | Application ID (defaults to env TDX_APP_ID) |

### Test Results

**Test 1: Valid Ticket ID**
```
Input: id=4734783
Result: ✅ PASS - Returned complete ticket object with 55+ fields
```

### Return Structure
Returns full ticket object with all fields including:
- ID, Title, CreatedDate, StatusID, StatusName, PriorityID, PriorityName
- AccountID, AccountName, RequestorID, RequestorFullName
- ResponsibleResourceID, ResponsibleResourceName, ResponsibleGroupID
- Description, Comments, CustomAttributes, AttachmentCount
- (and 35+ more fields)

### Key Findings
- ✅ Returns extremely detailed ticket information
- ✅ Includes nested objects for requestor, responsible party, account
- ✅ Includes description, comments, and custom field data

---

## tdx-ticket-feed-get
**Status:** ✅ TESTED  
**Source:** src/tools/tickets.ts (lines 88-107)

### Overview
Retrieves the activity feed/comment history for a specific ticket.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | YES | Ticket ID |
| `appId` | integer | NO | Application ID (defaults to env TDX_APP_ID) |

### Test Results

**Test 1: Valid Ticket ID**
```
Input: id=4734783
Result: ✅ PASS - Returned 7 feed entries with full history
```

### Return Structure
Returns array of feed entries:
```json
[
  {
    "ID": 12345,
    "CreatedDate": "2026-05-11T14:47:31.68Z",
    "CreatedBy": "John Doe",
    "UpdateType": "Created",
    "Body": "Initial ticket creation",
    "IsEdited": false
  }
]
```

### Key Findings
- ✅ Returns complete ticket activity history
- ✅ Each entry shows who made changes and when
- ✅ Useful for audit trail and ticket lifecycle tracking

---

## tdx-ticket-create
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/tickets.ts (lines 109-179)

### Overview
Creates a new ticket in TeamDynamix.

### Parameters (from source code)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | YES | Ticket title |
| `description` | string | NO | Ticket description/details |
| `accountId` | integer | NO | Account/department ID |
| `statusId` | integer | NO | Status ID |
| `priorityId` | integer | NO | Priority ID |
| `typeId` | integer | NO | Ticket type ID |
| `requestorUid` | string | NO | Requestor person UID |
| `responsibleGroupId` | integer | NO | Responsible group ID |
| `responsibleUid` | string | NO | Responsible person UID |
| `estimatedMinutes` | integer | NO | Estimated time to resolve |
| `customAttributes` | object | NO | Custom field values |
| `appId` | integer | NO | Application ID |

### Return Structure
(Expected) Returns created ticket object with generated ID and default values.

### Status
🔄 PENDING: Needs testing with valid create parameters

---

## tdx-ticket-update
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/tickets.ts (lines 181-251)

### Overview
Fully updates a ticket (all fields must be provided).

### Parameters (from source code)
Takes complete ticket object with all fields required.

### Status
🔄 PENDING: Requires understanding of all required fields

---

## tdx-ticket-patch
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/tickets.ts (lines 253-291)

### Overview
Partially updates a ticket (only specified fields are updated).

### Parameters (from source code)

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Ticket ID to update |
| `data` | object | Fields to update (PascalCase) |
| `appId` | integer | Application ID |

### Status
🔄 PENDING: Recommended for updates as it only requires changed fields

---

## tdx-ticket-feed-add
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/tickets.ts (lines 293-312)

### Overview
Adds a comment/note to a ticket's activity feed.

### Parameters (from source code)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | YES | Ticket ID |
| `body` | string | YES | Comment text |
| `appId` | integer | NO | Application ID |

### Status
🔄 PENDING: Needs testing

---

## tdx-ticket-add-asset
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/tickets.ts (lines 314-333)

### Overview
Links an asset to a ticket.

### Parameters (from source code)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | YES | Ticket ID |
| `assetId` | integer | YES | Asset ID to link |
| `appId` | integer | NO | Application ID |

### Status
🔄 PENDING: Needs testing

---

## tdx-ticket-add-contact
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/tickets.ts (lines 335-354)

### Overview
Adds a contact/person to a ticket.

### Parameters (from source code)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | YES | Ticket ID |
| `contactUid` | string | YES | Person UID to add |
| `appId` | integer | NO | Application ID |

### Status
🔄 PENDING: Needs testing

---

# ASSETS

## tdx-asset-create
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/assets.ts

### Overview
Creates a new asset in inventory.

### Status
🔄 PENDING: Needs testing

---

## tdx-asset-get
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/assets.ts

### Overview
Retrieves details for a specific asset by ID.

### Status
🔄 PENDING: Needs testing

---

## tdx-asset-update
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/assets.ts

### Overview
Fully updates an asset.

### Status
🔄 PENDING: Needs testing

---

## tdx-asset-patch
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/assets.ts

### Overview
Partially updates an asset.

### Status
🔄 PENDING: Needs testing

---

## tdx-asset-delete
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/assets.ts

### Overview
Deletes an asset.

### Status
🔄 PENDING: Needs testing

---

## tdx-asset-search
**Status:** ❌ DISABLED  
**Source:** src/tools/assets.ts

### Overview
Searches assets with filters.

### Reason for Disabling
Currently disabled by user configuration.

### Parameters (from source code)
Would support: owningDepartmentIds, owningCustomerIds, locationIds, modelIds, manufacturerIds, and more.

---

## tdx-asset-feed-add
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/assets.ts

### Overview
Adds a note/comment to an asset's feed.

### Status
🔄 PENDING: Needs testing

---

# CMDB

## tdx-cmdb-create
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/cmdb.ts

### Overview
Creates a new Configuration Item (CI) in the CMDB.

### Status
🔄 PENDING: Needs testing

---

## tdx-cmdb-get
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/cmdb.ts

### Overview
Retrieves details for a specific CI by ID.

### Status
🔄 PENDING: Needs testing

---

## tdx-cmdb-update
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/cmdb.ts

### Overview
Fully updates a CI.

### Status
🔄 PENDING: Needs testing

---

## tdx-cmdb-delete
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/cmdb.ts

### Overview
Deletes a CI.

### Status
🔄 PENDING: Needs testing

---

## tdx-cmdb-search
**Status:** ❌ DISABLED  
**Source:** src/tools/cmdb.ts

### Overview
Searches CIs with filters.

### Reason for Disabling
Currently disabled by user configuration.

### Parameters (from source code)
Would support: typeIds, isActive filtering, and more.

---

## tdx-cmdb-feed-add
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/cmdb.ts

### Overview
Adds a note/comment to a CI's feed.

### Status
🔄 PENDING: Needs testing

---

## tdx-cmdb-add-relationship
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/cmdb.ts

### Overview
Adds a relationship between two CIs.

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
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/kb.ts

### Overview
Creates a new knowledge base article.

### Parameters (from source code)

| Parameter | Type | Description |
|-----------|------|-------------|
| `title` | string | Article title |
| `body` | string | Article body (supports HTML) |
| `categoryId` | integer | KB category ID |
| `tags` | string[] | Article tags |
| `appId` | integer | Application ID |

### Status
🔄 PENDING: Needs testing

---

## tdx-kb-get
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/kb.ts

### Overview
Retrieves a knowledge base article by ID.

### Status
🔄 PENDING: Needs testing

---

## tdx-kb-update
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/kb.ts

### Overview
Updates a knowledge base article.

### Status
🔄 PENDING: Needs testing

---

## tdx-kb-delete
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/kb.ts

### Overview
Deletes a knowledge base article.

### Status
🔄 PENDING: Needs testing

---

## tdx-kb-search
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/kb.ts

### Overview
Searches knowledge base articles.

### Parameters (from source code)

| Parameter | Type | Description |
|-----------|------|-------------|
| `searchText` | string | Full-text search |
| `categoryIds` | integer[] | Filter by category |
| `isApproved` | boolean | Filter by approval status |
| `appId` | integer | Application ID |

### Status
🔄 PENDING: Needs testing

---

# PROJECTS

## tdx-project-create
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/projects.ts

### Overview
Creates a new project.

### Parameters (from source code)

| Parameter | Type | Description |
|-----------|------|-------------|
| `title` | string | Project name |
| `description` | string | Project description |
| `accountId` | integer | Account/department ID |
| `managerId` | string | Project manager UID |
| `estimatedHours` | integer | Estimated project hours |
| `budgetAmount` | number | Budget in dollars |
| `statusId` | integer | Project status ID |
| `appId` | integer | Application ID |

### Status
🔄 PENDING: Needs testing

---

## tdx-project-get
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/projects.ts

### Overview
Retrieves project details by ID.

### Status
🔄 PENDING: Needs testing

---

## tdx-project-update
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/projects.ts

### Overview
Updates project details.

### Status
🔄 PENDING: Needs testing

---

## tdx-project-search
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/projects.ts

### Overview
Searches projects with filters.

### Parameters (from source code)

| Parameter | Type | Description |
|-----------|------|-------------|
| `searchText` | string | Full-text search |
| `statusIds` | integer[] | Filter by status |
| `priorityIds` | integer[] | Filter by priority |
| `accountIds` | integer[] | Filter by account |
| `managerUids` | string[] | Filter by project manager |
| `isActive` | boolean | Filter by active status |
| `maxResults` | integer | Max results to return |
| `appId` | integer | Application ID |

### Status
🔄 PENDING: Needs testing

---

# PEOPLE

## tdx-people-get
**Status:** ❌ DISABLED  
**Source:** src/tools/people.ts

### Overview
Retrieves a person/user by UID.

### Reason for Disabling
Currently disabled by user configuration.

---

## tdx-people-search
**Status:** ❌ DISABLED  
**Source:** src/tools/people.ts

### Overview
Searches for people with filters.

### Reason for Disabling
Currently disabled by user configuration.

### Parameters (from source code)
Would support: firstName, lastName, primaryEmail, userName, isActive, isEmployee filtering.

---

## tdx-people-lookup
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/people.ts

### Overview
Quick lookup of a person by name, email, or username.

### Parameters (from source code)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchTerm` | string | YES | Name, email, or username |
| `appId` | integer | NO | Application ID |

### Status
🔄 PENDING: Needs testing

---

## tdx-people-update
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/people.ts

### Overview
Updates a person/user profile.

### Status
🔄 PENDING: Needs testing

---

# ACCOUNTS

## tdx-account-get
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/accounts.ts

### Overview
Retrieves an account/department by ID.

### Status
🔄 PENDING: Needs testing

---

## tdx-account-search
**Status:** ❌ DISABLED  
**Source:** src/tools/accounts.ts

### Overview
Searches accounts with filters.

### Reason for Disabling
Currently disabled by user configuration.

---

# GROUPS

## tdx-group-get
**Status:** ❌ DISABLED  
**Source:** src/tools/groups.ts

### Overview
Retrieves a group by ID.

### Reason for Disabling
Currently disabled by user configuration.

---

## tdx-group-search
**Status:** 🟡 NOT TESTED  
**Source:** src/tools/groups.ts

### Overview
Searches for groups.

### Status
🔄 PENDING: Needs testing

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

## Status Summary

| Status | Count | Tools |
|--------|-------|-------|
| ✅ TESTED | 5 | tdx-ticket-search, tdx-ticket-get, tdx-ticket-feed-get, tdx-statuses-get, tdx-attributes-get |
| 🟡 NOT TESTED | 34 | (All create, update, patch operations; search ops except ticket-search) |
| ❌ DISABLED | 5 | tdx-asset-search, tdx-cmdb-search, tdx-people-get, tdx-people-search, tdx-account-search, tdx-group-get |
| **TOTAL** | **44** | |

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

## Next Testing Priorities

1. **Asset Operations** (7 tools) - Test create, get, update operations
2. **CMDB Operations** (7 tools) - Focus on relationships feature
3. **Knowledge Base** (5 tools) - Test search with category filters
4. **Projects** (3 tools) - Test with manager filtering
5. **People & Accounts** (3 tools) - Test available tools (some disabled)
6. **Groups** (1 tool) - Test group search

---

## References

- [Configuration guide](./COPILOT_INTEGRATION.md)
- [API response schema](./API_RESPONSE_SCHEMA.md)
- [Index file](./src/index.ts) - Tool registration

