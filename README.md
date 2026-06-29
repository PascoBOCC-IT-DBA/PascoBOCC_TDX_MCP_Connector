# TDX MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that wraps the [TeamDynamix (TDX) REST API](https://solutions.teamdynamix.com/TDWebApi/), enabling AI-assisted IT service management through MCP-compatible AI clients, including GitHub Copilot Chat.

This server exposes **43 tools** across **10 domains** — tickets, assets, CMDB, knowledge base, people, projects, accounts, groups, statuses, and custom attributes — allowing natural language interaction with your TDX instance.

## Quick Start

### Local Development Setup

1. **Install dependencies and build**
   ```bash
   npm install
   npm run build
   ```

2. **Configure environment variables** (see [Environment Variables](#environment-variables) below)
   - Copy `.env.example` to `.env` and add your TDX credentials

### Production Deployment

**Recommended**: Deploy to **Azure Container Apps** for production use.

See [docs/AZURE_CONTAINER_APPS_DEPLOYMENT.md](docs/AZURE_CONTAINER_APPS_DEPLOYMENT.md) for:
- Azure Container Apps setup (recommended, managed service)
- API key authentication
- Auto-scaling and monitoring
- Quick start deployment with `azd up`

For other deployment options:
- **Copilot Studio Integration**: [docs/COPILOT_INTEGRATION.md](docs/COPILOT_INTEGRATION.md)
- **Legacy Ubuntu Deployment**: [docs/DEPLOYMENT_UBUNTU.md](docs/DEPLOYMENT_UBUNTU.md)

## Tool Availability & Safety-by-Default Design

The server uses a **safety-by-default architecture** that separates read-only tools from modification tools:

- **Always-Available Tools (21)** — Read-only access by default
  - `get`, `search`, `lookup` operations across all domains
  - No data changes, safe for exploration and analysis
  - Examples: `tdx-ticket-search`, `tdx-asset-get`, `tdx-people-lookup`

- **Modification Tools (22)** — Disabled by default, enable explicitly
  - `create`, `update`, `patch`, `delete`, and `feed-add` operations
  - Require `ALLOW_MODIFICATIONS=true` environment variable to enable
  - Examples: `tdx-ticket-create`, `tdx-asset-update`, `tdx-cmdb-delete`

This design prevents accidental data changes when the server is first deployed. Enable modifications only when you're ready to allow write operations.

## Environment Variables

### TDX API Configuration
| Variable | Required | Description |
|----------|----------|-------------|
| `TDX_BASE_URL` | Yes | TDX Web API base URL (e.g. `https://yourorg.teamdynamix.com/TDWebApi/api`) |
| `TDX_BEID` | Yes | Admin BEID from TDAdmin |
| `TDX_WEB_SERVICES_KEY` | Yes | Web Services Key from TDAdmin |
| `TDX_APP_ID` | Yes | Default TDX application ID (integer) |
| `TDX_ASSETS_APP_ID` | No | TDX application ID for asset operations (integer). If not set, defaults to `TDX_APP_ID` |
| `TDX_KB_APP_ID` | No | TDX application ID for knowledge base operations (integer). If not set, defaults to `TDX_APP_ID` |

### Server Configuration
| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_HTTP_PORT` | No | HTTP port for public deployment mode (e.g. `3000`). Only needed when running as an HTTP server. |
| `MCP_API_KEY` | No | API key for public deployment authentication. Required when `MCP_HTTP_PORT` is set. |
| `MCP_ALLOW_UNAUTH_INITIALIZE` | No | Set to `"true"` only when an MCP client cannot send auth on `initialize`. This allows unauthenticated `initialize` requests, while tool calls still require valid API key. Default is `"false"`. |
| `NODE_ENV` | No | Node environment (`development` or `production`). Default is `production`. |
| `ALLOW_MODIFICATIONS` | No | Enable/disable modification tools. Set to `"true"` to enable 22 modification tools (create, update, delete). Default is `"false"` (safe mode - only 21 always-available tools accessible) |

## Architecture

### Tool Organization

All 43 tools are organized into **10 domains**, each with a separate registration module:

- **Tickets** (`src/tools/tickets.ts`) — 9 tools: ticket management, comments, and asset linking
- **Assets** (`src/tools/assets.ts`) — 8 tools: asset lifecycle, search, and categories
- **CMDB** (`src/tools/cmdb.ts`) — 7 tools: configuration items and relationships
- **Knowledge Base** (`src/tools/kb.ts`) — 5 tools: KB articles and search
- **Projects** (`src/tools/projects.ts`) — 4 tools: project management
- **People** (`src/tools/people.ts`) — 4 tools: user/person lookups and updates
- **Accounts** (`src/tools/accounts.ts`) — 2 tools: account/department lookups
- **Groups** (`src/tools/groups.ts`) — 2 tools: group lookups
- **Statuses** (`src/tools/statuses.ts`) — 1 tool: status definitions
- **Attributes** (`src/tools/attributes.ts`) — 1 tool: custom attribute definitions

### Safety-by-Default Registration Pattern

Each domain module exports two registration functions:

```typescript
// Always registered - read-only tools (get, search, lookup)
export function registerXxxReadOnlyTools(server, client) { ... }

// Conditionally registered - modification tools (create, update, delete)
export function registerXxxTools(server, client) { ... }
```

This split ensures that:
1. **Read-only tools are always available** for safe exploration and analysis
2. **Modification tools require explicit opt-in** via `ALLOW_MODIFICATIONS=true`
3. **New deployments are safe by default** — no accidental data changes until explicitly enabled

In `src/index.ts`, registration calls implement the split:
```typescript
// Always called - read-only tools
registerTicketReadOnlyTools(server, client);
registerAssetReadOnlyTools(server, client);
// ... etc for all domains ...

// Conditionally called - modification tools
registerIfAllowed(() => registerTicketTools(server, client), "registerTicketTools");
registerIfAllowed(() => registerAssetTools(server, client), "registerAssetTools");
// ... etc for all domains ...
```

## Tools (43 Total: 21 Always-Available + 22 Modification)

All tools that operate within an application accept an optional `appId` parameter to override the default from `TDX_APP_ID`.

**Legend:** 🔒 = Always available (read-only access) | ✏️ = Modification (requires `ALLOW_MODIFICATIONS=true`)

### Tickets (9 tools: 3 read-only + 6 modification)

| Tool | Availability | Method | Endpoint | Description |
|------|--------------|--------|----------|-------------|
| `tdx-ticket-get` | 🔒 | GET | `/{appId}/tickets/{id}` | Get a ticket by ID |
| `tdx-ticket-search` | 🔒 | POST | `/{appId}/tickets/search` | Search tickets with filters |
| `tdx-ticket-feed-get` | 🔒 | GET | `/{appId}/tickets/{id}/feed` | Get ticket comments/feed |
| `tdx-ticket-create` | ✏️ | POST | `/{appId}/tickets` | Create a new ticket |
| `tdx-ticket-update` | ✏️ | POST | `/{appId}/tickets/{id}` | Full update of a ticket |
| `tdx-ticket-patch` | ✏️ | PATCH | `/{appId}/tickets/{id}` | Partial update of a ticket |
| `tdx-ticket-feed-add` | ✏️ | POST | `/{appId}/tickets/{id}/feed` | Add a comment to a ticket |
| `tdx-ticket-add-asset` | ✏️ | POST | `/{appId}/tickets/{id}/assets/{assetId}` | Link an asset to a ticket |
| `tdx-ticket-add-contact` | ✏️ | POST | `/{appId}/tickets/{id}/contacts/{uid}` | Add a contact to a ticket |

### Assets (8 tools: 3 read-only + 5 modification)

| Tool | Availability | Method | Endpoint | Description |
|------|--------------|--------|----------|-------------|
| `tdx-asset-get` | 🔒 | GET | `/{appId}/assets/{id}` | Get an asset by ID |
| `tdx-asset-search` | 🔒 | POST | `/{appId}/assets/search` | Search assets with filters |
| `tdx-asset-categories` | 🔒 | GET | `/assets/forms` | Get all available asset categories/forms |
| `tdx-asset-create` | ✏️ | POST | `/{appId}/assets` | Create a new asset |
| `tdx-asset-update` | ✏️ | POST | `/{appId}/assets/{id}` | Full update of an asset |
| `tdx-asset-patch` | ✏️ | PATCH | `/{appId}/assets/{id}` | Partial update of an asset |
| `tdx-asset-delete` | ✏️ | DELETE | `/{appId}/assets/{id}` | Delete an asset |
| `tdx-asset-feed-add` | ✏️ | POST | `/{appId}/assets/{id}/feed` | Add a comment to an asset |

### CMDB / Configuration Items (7 tools: 2 read-only + 5 modification)

| Tool | Availability | Method | Endpoint | Description |
|------|--------------|--------|----------|-------------|
| `tdx-cmdb-get` | 🔒 | GET | `/{appId}/cmdb/{id}` | Get a CI by ID |
| `tdx-cmdb-search` | 🔒 | POST | `/{appId}/cmdb/search` | Search CIs with filters |
| `tdx-cmdb-create` | ✏️ | POST | `/{appId}/cmdb` | Create a new CI |
| `tdx-cmdb-update` | ✏️ | PUT | `/{appId}/cmdb/{id}` | Full update of a CI |
| `tdx-cmdb-delete` | ✏️ | DELETE | `/{appId}/cmdb/{id}` | Delete a CI |
| `tdx-cmdb-feed-add` | ✏️ | POST | `/{appId}/cmdb/{id}/feed` | Add a comment to a CI |
| `tdx-cmdb-add-relationship` | ✏️ | PUT | `/{appId}/cmdb/{id}/relationships` | Add a relationship between CIs |

### Knowledge Base (5 tools: 2 read-only + 3 modification)

| Tool | Availability | Method | Endpoint | Description |
|------|--------------|--------|----------|-------------|
| `tdx-kb-get` | 🔒 | GET | `/{appId}/knowledgebase/{id}` | Get a KB article by ID |
| `tdx-kb-search` | 🔒 | POST | `/{appId}/knowledgebase/search` | Search KB articles |
| `tdx-kb-create` | ✏️ | POST | `/{appId}/knowledgebase` | Create a KB article |
| `tdx-kb-update` | ✏️ | PUT | `/{appId}/knowledgebase/{id}` | Update a KB article |
| `tdx-kb-delete` | ✏️ | DELETE | `/{appId}/knowledgebase/{id}` | Delete a KB article |

### People (4 tools: 3 read-only + 1 modification)

These tools do not require an `appId`.

| Tool | Availability | Method | Endpoint | Description |
|------|--------------|--------|----------|-------------|
| `tdx-people-get` | 🔒 | GET | `/people/{uid}` | Get a person by UID |
| `tdx-people-search` | 🔒 | POST | `/people/search` | Search people with filters |
| `tdx-people-lookup` | 🔒 | GET | `/people/lookup` | Quick lookup by name/email/username |
| `tdx-people-update` | ✏️ | POST | `/people/{uid}` | Update a person |

### Projects (4 tools: 2 read-only + 2 modification)

These tools do not require an `appId`.

| Tool | Availability | Method | Endpoint | Description |
|------|--------------|--------|----------|-------------|
| `tdx-project-get` | 🔒 | GET | `/projects/{id}` | Get a project by ID |
| `tdx-project-search` | 🔒 | POST | `/projects/search` | Search projects with filters |
| `tdx-project-create` | ✏️ | POST | `/projects` | Create a new project |
| `tdx-project-update` | ✏️ | POST | `/projects/{id}` | Update a project |

### Accounts (2 tools: read-only only)

| Tool | Availability | Method | Endpoint | Description |
|------|--------------|--------|----------|-------------|
| `tdx-account-get` | 🔒 | GET | `/accounts/{id}` | Get an account/department by ID |
| `tdx-account-search` | 🔒 | POST | `/accounts/search` | Search accounts/departments |

### Groups (2 tools: read-only only)

| Tool | Availability | Method | Endpoint | Description |
|------|--------------|--------|----------|-------------|
| `tdx-group-get` | 🔒 | GET | `/groups/{id}` | Get a group by ID |
| `tdx-group-search` | 🔒 | POST | `/groups/search` | Search groups |

### Statuses (1 tool: read-only only)

| Tool | Availability | Method | Endpoint | Description |
|------|--------------|--------|----------|-------------|
| `tdx-statuses-get` | 🔒 | GET | `/{componentType}/statuses` | Get available statuses for a component type (tickets, assets, projects, cmdb, knowledgebase) |

### Custom Attributes (1 tool: read-only only)

| Tool | Availability | Method | Endpoint | Description |
|------|--------------|--------|----------|-------------|
| `tdx-attributes-get` | 🔒 | GET | `/attributes/custom` | Get custom attribute definitions for a component type |

Common `componentId` values for `tdx-attributes-get`: `9` = Ticket, `27` = Asset, `63` = CI, `39` = KB Article, `2` = Project.

## Deployment

For deployment instructions, see:
- [docs/AZURE_CONTAINER_APPS_DEPLOYMENT.md](docs/AZURE_CONTAINER_APPS_DEPLOYMENT.md) for Azure Container Apps (recommended)
- [docs/DEPLOYMENT_UBUNTU.md](docs/DEPLOYMENT_UBUNTU.md) for Ubuntu server deployment (legacy)
- [docs/COPILOT_INTEGRATION.md](docs/COPILOT_INTEGRATION.md) for AI client integration

## Documentation

### Main References

| Document | Purpose |
|----------|---------|
| **[docs/TOOLS_REFERENCE.md](docs/TOOLS_REFERENCE.md)** | Complete reference for all 43 tools with parameters, return structures, and usage examples |
| **[docs/AZURE_CONTAINER_APPS_DEPLOYMENT.md](docs/AZURE_CONTAINER_APPS_DEPLOYMENT.md)** | Azure Container Apps setup, deployment automation with `azd`, and production configuration (recommended) |
| **[docs/DEPLOYMENT_UBUNTU.md](docs/DEPLOYMENT_UBUNTU.md)** | Ubuntu server deployment, systemd service setup, and legacy deployment configuration |
| **[docs/COPILOT_INTEGRATION.md](docs/COPILOT_INTEGRATION.md)** | GitHub Copilot Chat and Microsoft Copilot Studio integration instructions |

For complete tool documentation, see [docs/TOOLS_REFERENCE.md](docs/TOOLS_REFERENCE.md).

## Example Usage

With the TDX MCP tools available, you can ask:

- "Search for open tickets assigned to me"
- "Get ticket #12345 and show me the comments"
- "Look up john.doe@example.com in TDX"
- "Search the knowledge base for VPN setup instructions"
- "Find all assets in the IT department"
- "Create a ticket for a new software request"

## TDX API Documentation

- [TeamDynamix Web API Reference](https://solutions.teamdynamix.com/TDWebApi/)
- [API Authentication Guide](https://solutions.teamdynamix.com/TDClient/1965/Portal/KB/ArticleDet?ID=1715)

## Project Structure

```
PascoBOCC_TDX_MCP_Connector/
  package.json
  tsconfig.json
  src/
    index.ts               # Main MCP server entry point
    http-wrapper.ts        # HTTP server wrapper with process pooling
    auth.ts                # TDX authentication (token management)
    config.ts              # Configuration and validation
    tdx-client.ts          # TDX API client
    asset-batcher.ts       # Asset batch processing utility
    tools/
      tickets.ts           # 9 ticket tools
      assets.ts            # 8 asset tools
      cmdb.ts              # 7 CMDB/CI tools
      kb.ts                # 5 knowledge base tools
      people.ts            # 4 people tools
      projects.ts          # 4 project tools
      accounts.ts          # 2 account tools
      groups.ts            # 2 group tools
      statuses.ts          # 1 status tool
      attributes.ts        # 1 custom attributes tool
  deploy/
    deploy-to-azure.sh     # Azure Container Apps deployment script
    deploy-to-azure.ps1    # Azure Container Apps deployment (PowerShell)
    azure-deploy.ps1       # Alternative Azure deployment script
    azure.yaml             # Azure deployment configuration
  infra/
    main.bicep             # Infrastructure as Code template
    main.parameters.json   # Bicep parameters
  docs/
    AZURE_CONTAINER_APPS_DEPLOYMENT.md  # Recommended deployment guide
    DEPLOYMENT_UBUNTU.md   # Legacy Ubuntu deployment guide
    COPILOT_INTEGRATION.md # AI client integration guide
    TOOLS_REFERENCE.md     # Complete tool documentation
  tests/
    *.ps1, *.sh, *.js      # Various test and verification scripts
```

