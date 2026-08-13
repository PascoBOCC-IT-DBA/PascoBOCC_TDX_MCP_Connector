# TDX MCP Connector - OAuth Scopes Reference

## Executive Summary

The TDX MCP Connector exposes **48 tools total**:
- **30 read-only tools** (always enabled)
- **18 write/modification tools** (conditional - disabled by default, require `ALLOW_MODIFICATIONS=true`)

This document defines recommended OAuth scopes for fine-grained authorization in the upcoming OAuth migration.

---

## Permission Model

### Current Implementation
The connector implements a **module-level toggle** via environment variable:
- **`ALLOW_MODIFICATIONS=true`** — Enables all write/modification tools
- **Not set or `false`** — Disables all write/modification tools (default/safe mode)

**Status:** Safe default mode is production-ready. All modification tools are gated.

### Recommended OAuth Scopes Architecture
For fine-grained OAuth 2.0 scopes:

```
Scope Pattern: api://tdx-mcp/{resource}.{operation}

READ SCOPES:
api://tdx-mcp/tickets.read
api://tdx-mcp/assets.read
api://tdx-mcp/cmdb.read
api://tdx-mcp/kb.read
api://tdx-mcp/projects.read
api://tdx-mcp/people.read
api://tdx-mcp/accounts.read
api://tdx-mcp/groups.read
api://tdx-mcp/metadata.read        # attributes, statuses, categories

WRITE SCOPES:
api://tdx-mcp/tickets.write
api://tdx-mcp/assets.write
api://tdx-mcp/cmdb.write
api://tdx-mcp/kb.write
api://tdx-mcp/projects.write
api://tdx-mcp/people.write
api://tdx-mcp/tickets.feed         # comment operations
api://tdx-mcp/assets.feed
api://tdx-mcp/cmdb.feed
```

---

## Tools by Category

### TICKETS (9 tools)

#### Read-Only (3 tools) — Always Enabled
| Tool | Description | Operation |
|------|-------------|-----------|
| **tdx-ticket-get** | Retrieve a single ticket by ID | GET |
| **tdx-ticket-search** | Search tickets with comprehensive filtering | POST |
| **tdx-ticket-feed-get** | Get comments/feed entries for a ticket | GET |

#### Write Operations (6 tools) — Conditional
| Tool | Description | Operation | Scope |
|------|-------------|-----------|-------|
| **tdx-ticket-create** | Create a new ticket | POST | `tickets.write` |
| **tdx-ticket-update** | Full replacement update of a ticket | POST | `tickets.write` |
| **tdx-ticket-patch** | Partial update (only specified fields) | PATCH | `tickets.write` |
| **tdx-ticket-feed-add** | Add comment/feed entry to ticket | POST | `tickets.feed` |
| **tdx-ticket-add-asset** | Link an asset to a ticket | POST | `tickets.write` |
| **tdx-ticket-add-contact** | Add a contact person to a ticket | POST | `tickets.write` |

**Tickets Count Tool:**
| Tool | Description |
|------|-------------|
| **tdx-ticket-count** | Get count + preview of tickets matching filters (up to 200 results) |

---

### ASSETS (8 tools)

#### Read-Only (3 tools) — Always Enabled
| Tool | Description | Operation |
|------|-------------|-----------|
| **tdx-asset-get** | Retrieve a single asset by ID | GET |
| **tdx-asset-search** | Search assets with filtering (status, location, department, etc.) | POST |
| **tdx-asset-categories** | Get all asset forms/categories available | GET |

#### Write Operations (5 tools) — Conditional
| Tool | Description | Operation | Scope |
|------|-------------|-----------|-------|
| **tdx-asset-create** | Create a new asset | POST | `assets.write` |
| **tdx-asset-update** | Full replacement update of an asset | POST | `assets.write` |
| **tdx-asset-patch** | Partial update (only specified fields) | PATCH | `assets.write` |
| **tdx-asset-delete** | Delete an asset | DELETE | `assets.write` |
| **tdx-asset-feed-add** | Add comment/feed entry to asset | POST | `assets.feed` |

---

### CMDB - Configuration Items (8 tools)

#### Read-Only (2 tools) — Always Enabled
| Tool | Description | Operation |
|------|-------------|-----------|
| **tdx-cmdb-get** | Retrieve a single CI by ID | GET |
| **tdx-cmdb-search** | Search CIs with filtering (type, department, location, etc.) | POST |

#### Write Operations (6 tools) — Conditional
| Tool | Description | Operation | Scope |
|------|-------------|-----------|-------|
| **tdx-cmdb-create** | Create a new configuration item | POST | `cmdb.write` |
| **tdx-cmdb-update** | Full replacement update of a CI | PUT | `cmdb.write` |
| **tdx-cmdb-delete** | Delete a configuration item | DELETE | `cmdb.write` |
| **tdx-cmdb-feed-add** | Add comment/feed entry to CI | POST | `cmdb.feed` |
| **tdx-cmdb-add-relationship** | Create relationship between two CIs | PUT | `cmdb.write` |

---

### KNOWLEDGE BASE (5 tools)

#### Read-Only (2 tools) — Always Enabled
| Tool | Description | Operation |
|------|-------------|-----------|
| **tdx-kb-get** | Retrieve a single KB article by ID | GET |
| **tdx-kb-search** | Search KB articles by text, category, status, owner | POST |

#### Write Operations (3 tools) — Conditional
| Tool | Description | Operation | Scope |
|------|-------------|-----------|-------|
| **tdx-kb-create** | Create a new KB article | POST | `kb.write` |
| **tdx-kb-update** | Full update of a KB article | PUT | `kb.write` |
| **tdx-kb-delete** | Delete a KB article | DELETE | `kb.write` |

---

### PROJECTS (4 tools)

#### Read-Only (2 tools) — Always Enabled
| Tool | Description | Operation |
|------|-------------|-----------|
| **tdx-project-get** | Retrieve a single project by ID | GET |
| **tdx-project-search** | Search projects with filtering (status, manager, dates, etc.) | POST |

#### Write Operations (2 tools) — Conditional
| Tool | Description | Operation | Scope |
|------|-------------|-----------|-------|
| **tdx-project-create** | Create a new project | POST | `projects.write` |
| **tdx-project-update** | Update a project | POST | `projects.write` |

---

### PEOPLE (4 tools)

#### Read-Only (3 tools) — Always Enabled
| Tool | Description | Operation |
|------|-------------|-----------|
| **tdx-people-get** | Retrieve a person by UID | GET |
| **tdx-people-search** | Search people by name, email, username, department, etc. | POST |
| **tdx-people-lookup** | Quick lookup by name/email/username (simplified search) | GET |

#### Write Operations (1 tool) — Conditional
| Tool | Description | Operation | Scope |
|------|-------------|-----------|-------|
| **tdx-people-update** | Update person record | POST | `people.write` |

---

### METADATA LOOKUPS (4 tools)

#### Read-Only (4 tools) — Always Enabled
All of these are reference/metadata tools supporting filtering operations in other tools.

| Tool | Description | Use Case |
|------|-------------|----------|
| **tdx-account-get** | Get a department/account by ID | Resolve account IDs for ticket/asset filtering |
| **tdx-account-search** | Search accounts/departments | Find department IDs before using in filters |
| **tdx-group-search** | Search work groups | Find group IDs for responsible group filters |
| **tdx-group-get** | Get a group by ID | Retrieve full group details |
| **tdx-statuses-get** | Get available statuses for a component type | Resolve status names (e.g., "Open", "Closed") to IDs |
| **tdx-attributes-get** | Get custom attribute definitions for a component | List available custom fields for create/update operations |

---

## Read vs. Write Summary

### Read-Only Tools (30 total)
- **Retrieval:** 16 "get" operations (single item by ID)
- **Search:** 10 "search" operations (filtered queries)
- **Metadata:** 4 reference/lookup operations

**These are ALWAYS ENABLED and safe for public consumption.**

### Write Tools (18 total)
- **Create:** 6 tools
- **Update/Patch:** 7 tools
- **Delete:** 3 tools
- **Relationships:** 1 tool (cmdb-add-relationship)
- **Comments:** 3 tools (feed-add operations)
- **Linking:** 2 tools (ticket-add-asset, ticket-add-contact)

**These are CONDITIONALLY ENABLED via `ALLOW_MODIFICATIONS` environment variable.**

---

## Modification Control Details

### Current Implementation (Checked in index.ts)
```typescript
const allowModifications = process.env.ALLOW_MODIFICATIONS === "true";

const registerIfAllowed = (allowFunc: () => void, name: string) => {
  if (allowModifications) {
    allowFunc();
    console.error(`[TDX-MCP] Enabled modification tool: ${name}`);
  } else {
    console.error(`[TDX-MCP] Skipped modification tool: ${name}`);
  }
};
```

### Modules Behind the Gate
1. `registerTicketTools()` — 6 ticket write tools
2. `registerAssetTools()` — 5 asset write tools
3. `registerCmdbTools()` — 5 CMDB write tools
4. `registerKbTools()` — 3 KB write tools
5. `registerProjectTools()` — 2 project write tools
6. `registerPeopleTools()` — 1 people write tool

### Always-Enabled Modules
- All `registerXxxReadOnlyTools()` functions
- `registerTicketCountTools()`
- `registerAccountTools()`
- `registerGroupTools()`
- `registerAttributeTools()`
- `registerStatusTools()`

---

## API Operation Types

### GET Operations (Single Item Retrieval)
Used for retrieving individual records by ID:
- ticket, asset, cmdb, kb, project, people, account, group, etc.

### POST Operations
Used for:
- **Search:** `POST /{app}/tickets/search`, `POST /{app}/assets/search`, etc.
- **Create:** `POST /{app}/tickets`, `POST /{app}/assets`, etc.
- **Update:** `POST /{app}/tickets/{id}` (full update)
- **Feed/Comments:** `POST /{app}/tickets/{id}/feed`
- **Linking:** `POST /{app}/tickets/{id}/assets/{assetId}`, `POST /{app}/tickets/{id}/contacts/{uid}`

### PUT Operations
Used for:
- **CMDB Update:** `PUT /{app}/cmdb/{id}` (full update)
- **KB Update:** `PUT /{app}/knowledgebase/{id}`
- **CMDB Relationships:** `PUT /{app}/cmdb/{id}/relationships`

### PATCH Operations
Used for partial/incremental updates (only specified fields):
- `PATCH /{app}/tickets/{id}`
- `PATCH /{app}/assets/{id}`

### DELETE Operations
Permanent record deletion:
- `DELETE /{app}/cmdb/{id}`
- `DELETE /{app}/assets/{id}`
- `DELETE /{app}/knowledgebase/{id}`

---

## Filter & Search Capabilities

### Universal Filters Across Most Tools
| Filter | Tools |
|--------|-------|
| **SearchText** | Tickets, Assets, CMDB, KB, Projects, People, Accounts, Groups |
| **StatusIds** | Tickets, Assets, CMDB, Projects |
| **Date Range Filters** | Tickets (5 date types), Assets (3 types), Projects (2 types) |
| **DepartmentIds** | Tickets, Assets, CMDB, Projects |
| **LocationIds** | Assets, CMDB |
| **Person/UID Filters** | Tickets (requestor, responsible), People, KB (owner) |
| **Priority/Type** | Tickets, Projects |
| **MaxResults** | Most search tools (with smart defaults: 100-5000) |

### Smart Defaults
The connector implements **context-aware pagination limits**:
- With date filters: `maxResults` defaults to higher limit (5000 for tickets)
- Without date filters: defaults to lower limit (100 for tickets)
- Per-tool overrides available via environment: `MAX_RESULTS_WITH_FILTER`, `MAX_RESULTS_WITHOUT_FILTER`

---

## Custom Attributes Support

### Supported on These Write Operations
- **Tickets:** `tdx-ticket-create`
- **Assets:** `tdx-asset-create`, `tdx-asset-update`, `tdx-asset-patch`
- **CMDB:** `tdx-cmdb-create`, `tdx-cmdb-update`
- **KB Articles:** `tdx-kb-create`, `tdx-kb-update`
- **Projects:** `tdx-project-create`, `tdx-project-update`

### Usage
Query `tdx-attributes-get` first to discover available attributes and their IDs, then include in the `attributes` array parameter.

---

## Application ID Handling

### Multi-App Configuration
Different tool categories may use different TDX applications:
- **Tickets:** `client.appId` (default)
- **Assets:** `client.assetsAppId ?? client.appId`
- **CMDB:** Always `client.assetsAppId`
- **Knowledge Base:** `client.kbAppId ?? client.appId`
- **Projects, People:** Shared/global endpoints (no app ID isolation)

### Per-Tool Override
Most tools accept optional `appId` parameter to override the configured default.

---

## Security Implications

### Read-Only Attack Surface
- **Low risk** — Limited to data retrieval
- **Rate limiting recommended** — Prevent bulk exports via search operations
- **No authentication needed beyond base TDX API token** — All read-only tools use same credentials

### Write Operation Attack Surface
- **Medium-High risk** — Can modify/delete production data
- **Protected by:** Environment variable gate (`ALLOW_MODIFICATIONS`)
- **No per-operation RBAC** — Either all modifications enabled or none
- **Recommended addition:** Per-user/per-scope authorization layer on top of this global toggle

### Future Improvements
1. **Per-operation rate limits** — Especially for create/update/delete
2. **Audit logging** — Track who (user/service) modified what
3. **Fine-grained scopes** — Migrate from binary toggle to OAuth-style scopes
4. **Resource-level RBAC** — Different permissions per department/account
5. **Operation approvals** — Require approval for destructive operations (delete)

---

## Tool Count Summary Table

| Category | Read-Only | Write | Total |
|----------|-----------|-------|-------|
| **Tickets** | 3 + count | 6 | **10** |
| **Assets** | 3 | 5 | **8** |
| **CMDB** | 2 | 6 | **8** |
| **KB** | 2 | 3 | **5** |
| **Projects** | 2 | 2 | **4** |
| **People** | 3 | 1 | **4** |
| **Metadata** | 4 | 0 | **4** |
| **Counts** | 1 | 0 | **1** |
| **TOTAL** | **20** | **23** | **48** |

---

## Recommended OAuth Scope Mapping

### Tier 1: Read-Only Access
```
api://tdx-mcp/tickets.read
api://tdx-mcp/assets.read
api://tdx-mcp/cmdb.read
api://tdx-mcp/kb.read
api://tdx-mcp/projects.read
api://tdx-mcp/people.read
api://tdx-mcp/metadata.read
```

### Tier 2: Write Access (Individual Resources)
```
api://tdx-mcp/tickets.write
api://tdx-mcp/assets.write
api://tdx-mcp/cmdb.write
api://tdx-mcp/kb.write
api://tdx-mcp/projects.write
api://tdx-mcp/people.write
```

### Tier 3: Sensitive Operations
```
api://tdx-mcp/assets.delete
api://tdx-mcp/cmdb.delete
api://tdx-mcp/kb.delete
```

### Tier 4: Collaborative Features
```
api://tdx-mcp/tickets.feed
api://tdx-mcp/assets.feed
api://tdx-mcp/cmdb.feed
```

### Tier 5: Linking Operations
```
api://tdx-mcp/tickets.link
```
