# TDX MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that wraps the [TeamDynamix (TDX) REST API](https://solutions.teamdynamix.com/TDWebApi/), enabling AI-assisted IT service management through MCP-compatible AI clients, including GitHub Copilot Chat.

This server exposes **43 tools** across **10 domains** — tickets, assets, CMDB, knowledge base, people, projects, accounts, groups, statuses, and custom attributes — allowing natural language interaction with your TDX instance.

## Quick Start

### Production Server Status

✅ **Server:** Deployed and running  
✅ **Status:** Stable & Operational  
✅ **Tools:** 43 total (17 read-only enabled, 26 modification disabled)  
✅ **Auth:** Bearer token required

> **Note:** Server address and API key are maintained separately. Contact your system administrator for access credentials.  

### Verify Server is Working

```powershell
# Health check (no auth needed)
Invoke-WebRequest http://<SERVER_ADDRESS>:3000/health

# Get tool list (requires auth - replace placeholders with your values)
$serverAddress = "<SERVER_ADDRESS>:3000"
$apiKey = "<YOUR_API_KEY>"
$h = @{"Authorization"="Bearer $apiKey"}
Invoke-WebRequest http://$serverAddress/tools -Headers $h
```

> **Note:** Replace `<SERVER_ADDRESS>` and `<YOUR_API_KEY>` with values from your system administrator.

### Quick Testing Examples

```powershell
# Create reusable test function
function Test-TdxTool {
    param([string]$ToolName, [hashtable]$Params = @{})
    $serverAddress = "<SERVER_ADDRESS>:3000"  # Replace with your server
    $apiKey = "<YOUR_API_KEY>"                # Replace with your API key
    $headers = @{"Authorization"="Bearer $apiKey";"Content-Type"="application/json"}
    $body = @{jsonrpc="2.0";method=$ToolName;params=$Params;id=1} | ConvertTo-Json -Depth 10
    try {
        Invoke-RestMethod -Uri "http://$serverAddress/mcp" -Method POST -Headers $headers -Body $body -TimeoutSec 90
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Examples (after setting server address and API key above):
Test-TdxTool -ToolName "tdx-ticket-search" -Params @{maxResults=3}
Test-TdxTool -ToolName "tdx-ticket-get" -Params @{id=4734783}
Test-TdxTool -ToolName "tdx-statuses-get" -Params @{componentType="tickets"}
Test-TdxTool -ToolName "tdx-asset-search" -Params @{maxResults=5}
Test-TdxTool -ToolName "tdx-people-lookup" -Params @{uID="j.boswell"}
```

### Local Development Setup

1. **Install dependencies and build**
   ```bash
   npm install
   npm run build
   ```

2. **Configure environment variables** (see [Environment Variables](#environment-variables) below)
   - Copy `.env.example` to `.env` and add your TDX credentials

3. **For production deployment**, see [DEPLOYMENT_UBUNTU.md](DEPLOYMENT_UBUNTU.md) for Ubuntu server setup and [COPILOT_INTEGRATION.md](COPILOT_INTEGRATION.md) for Copilot Studio integration

## Authentication

This server uses TDX **admin token authentication** (`POST /auth/loginadmin`) with a BEID and Web Services Key — not username/password. These are API-specific service account keys that are:

- Not tied to SSO or any user's credentials
- Generated in **TDAdmin > Organization Details > API Settings**
- Revocable independently without affecting user accounts
- Accessible to any admin with the "Add BE Administrators" permission

Tokens are fetched lazily on the first tool call and auto-refreshed after 23 hours (1-hour buffer before the 24-hour TDX expiry).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TDX_BASE_URL` | Yes | TDX Web API base URL (e.g. `https://yourorg.teamdynamix.com/TDWebApi/api`) |
| `TDX_BEID` | Yes | Admin BEID from TDAdmin |
| `TDX_WEB_SERVICES_KEY` | Yes | Web Services Key from TDAdmin |
| `TDX_APP_ID` | Yes | Default TDX application ID (integer) |
| `TDX_ASSETS_APP_ID` | No | TDX application ID for asset operations (integer). If not set, defaults to `TDX_APP_ID` |
| `TDX_KB_APP_ID` | No | TDX application ID for knowledge base operations (integer). If not set, defaults to `TDX_APP_ID` |
| `ALLOW_MODIFICATIONS` | No | Enable/disable modification tools (create, update, delete). Set to `"true"` to enable 26 modification tools. Default is `"false"` (safe mode - read-only) |

## Tools (43)

All tools that operate within an application accept an optional `appId` parameter to override the default from `TDX_APP_ID`.

### Tickets (9 tools)

| Tool | Method | Endpoint | Description |
|------|--------|----------|-------------|
| `tdx-ticket-create` | POST | `/{appId}/tickets` | Create a new ticket |
| `tdx-ticket-get` | GET | `/{appId}/tickets/{id}` | Get a ticket by ID |
| `tdx-ticket-update` | POST | `/{appId}/tickets/{id}` | Full update of a ticket |
| `tdx-ticket-patch` | PATCH | `/{appId}/tickets/{id}` | Partial update of a ticket |
| `tdx-ticket-search` | POST | `/{appId}/tickets/search` | Search tickets with filters |
| `tdx-ticket-feed-get` | GET | `/{appId}/tickets/{id}/feed` | Get ticket comments/feed |
| `tdx-ticket-feed-add` | POST | `/{appId}/tickets/{id}/feed` | Add a comment to a ticket |
| `tdx-ticket-add-asset` | POST | `/{appId}/tickets/{id}/assets/{assetId}` | Link an asset to a ticket |
| `tdx-ticket-add-contact` | POST | `/{appId}/tickets/{id}/contacts/{uid}` | Add a contact to a ticket |

### Assets (8 tools)

| Tool | Method | Endpoint | Description |
|------|--------|----------|-------------|
| `tdx-asset-create` | POST | `/{appId}/assets` | Create a new asset |
| `tdx-asset-get` | GET | `/{appId}/assets/{id}` | Get an asset by ID |
| `tdx-asset-update` | POST | `/{appId}/assets/{id}` | Full update of an asset |
| `tdx-asset-patch` | PATCH | `/{appId}/assets/{id}` | Partial update of an asset |
| `tdx-asset-delete` | DELETE | `/{appId}/assets/{id}` | Delete an asset |
| `tdx-asset-search` | POST | `/{appId}/assets/search` | Search assets with filters |
| `tdx-asset-feed-add` | POST | `/{appId}/assets/{id}/feed` | Add a comment to an asset |
| `tdx-asset-categories` | GET | `/assets/forms` | Get all available asset categories/forms |

### CMDB / Configuration Items (7 tools)

| Tool | Method | Endpoint | Description |
|------|--------|----------|-------------|
| `tdx-cmdb-create` | POST | `/{appId}/cmdb` | Create a new CI |
| `tdx-cmdb-get` | GET | `/{appId}/cmdb/{id}` | Get a CI by ID |
| `tdx-cmdb-update` | PUT | `/{appId}/cmdb/{id}` | Full update of a CI |
| `tdx-cmdb-delete` | DELETE | `/{appId}/cmdb/{id}` | Delete a CI |
| `tdx-cmdb-search` | POST | `/{appId}/cmdb/search` | Search CIs with filters |
| `tdx-cmdb-feed-add` | POST | `/{appId}/cmdb/{id}/feed` | Add a comment to a CI |
| `tdx-cmdb-add-relationship` | PUT | `/{appId}/cmdb/{id}/relationships` | Add a relationship between CIs |

### Knowledge Base (5 tools)

| Tool | Method | Endpoint | Description |
|------|--------|----------|-------------|
| `tdx-kb-create` | POST | `/{appId}/knowledgebase` | Create a KB article |
| `tdx-kb-get` | GET | `/{appId}/knowledgebase/{id}` | Get a KB article by ID |
| `tdx-kb-update` | PUT | `/{appId}/knowledgebase/{id}` | Update a KB article |
| `tdx-kb-delete` | DELETE | `/{appId}/knowledgebase/{id}` | Delete a KB article |
| `tdx-kb-search` | POST | `/{appId}/knowledgebase/search` | Search KB articles |

### People (4 tools)

These tools do not require an `appId`.

| Tool | Method | Endpoint | Description |
|------|--------|----------|-------------|
| `tdx-people-get` | GET | `/people/{uid}` | Get a person by UID |
| `tdx-people-search` | POST | `/people/search` | Search people with filters |
| `tdx-people-lookup` | GET | `/people/lookup` | Quick lookup by name/email/username |
| `tdx-people-update` | POST | `/people/{uid}` | Update a person |

### Projects (4 tools)

These tools do not require an `appId`.

| Tool | Method | Endpoint | Description |
|------|--------|----------|-------------|
| `tdx-project-create` | POST | `/projects` | Create a new project |
| `tdx-project-get` | GET | `/projects/{id}` | Get a project by ID |
| `tdx-project-update` | POST | `/projects/{id}` | Update a project |
| `tdx-project-search` | POST | `/projects/search` | Search projects with filters |

### Accounts (2 tools)

| Tool | Method | Endpoint | Description |
|------|--------|----------|-------------|
| `tdx-account-get` | GET | `/accounts/{id}` | Get an account/department by ID |
| `tdx-account-search` | POST | `/accounts/search` | Search accounts/departments |

### Groups (2 tools)

| Tool | Method | Endpoint | Description |
|------|--------|----------|-------------|
| `tdx-group-get` | GET | `/groups/{id}` | Get a group by ID |
| `tdx-group-search` | POST | `/groups/search` | Search groups |

### Statuses (1 tool)

| Tool | Method | Endpoint | Description |
|------|--------|----------|-------------|
| `tdx-statuses-get` | GET | `/{componentType}/statuses` | Get available statuses for a component type (tickets, assets, projects, cmdb, knowledgebase) |

### Custom Attributes (1 tool)

| Tool | Method | Endpoint | Description |
|------|--------|----------|-------------|
| `tdx-attributes-get` | GET | `/attributes/custom` | Get custom attribute definitions for a component type |

Common `componentId` values for `tdx-attributes-get`: `9` = Ticket, `27` = Asset, `63` = CI, `39` = KB Article, `2` = Project.

## Deployment

### Production (Ubuntu Server)

For deploying as a persistent HTTP service with API key authentication:

1. See [DEPLOYMENT_UBUNTU.md](DEPLOYMENT_UBUNTU.md) for Ubuntu server setup
2. See [COPILOT_INTEGRATION.md](COPILOT_INTEGRATION.md) for Copilot Studio integration

The HTTP wrapper (`src/http-wrapper.js`) spawns MCP server processes on-demand and exposes them via REST endpoints, allowing:
- Persistent service with systemd auto-restart
- API key authentication support
- Integration with Microsoft Copilot Studio

## Documentation

### Main References

| Document | Purpose |
|----------|---------|
| **[TDX_MCP_TOOLS_COMPLETE_REFERENCE.md](TDX_MCP_TOOLS_COMPLETE_REFERENCE.md)** | Complete reference for all 43 tools with parameters, test cases, and infrastructure verification results |
| **[DEPLOYMENT_UBUNTU.md](DEPLOYMENT_UBUNTU.md)** | Ubuntu server deployment, systemd service setup, and production configuration |
| **[COPILOT_INTEGRATION.md](COPILOT_INTEGRATION.md)** | GitHub Copilot Chat and Microsoft Copilot Studio integration instructions |

### Testing Status

✅ **5 Tools Extensively Tested:** tdx-ticket-search, tdx-ticket-get, tdx-ticket-feed-get, tdx-statuses-get, tdx-attributes-get  
✅ **17 Read-Only Tools:** All enabled and ready for use  
✅ **26 Modification Tools:** Safely disabled (set `ALLOW_MODIFICATIONS=true` in .env to enable)  
✅ **Infrastructure:** Verified stable (5+ minute uptime, no concurrency errors)

See [TDX_MCP_TOOLS_COMPLETE_REFERENCE.md](TDX_MCP_TOOLS_COMPLETE_REFERENCE.md) for complete testing results and all tool documentation.
- Process pooling for efficiency

### Local Development (Stdio Mode)

For local development, build and run directly:

```bash
npm run build
npm start
```

The stdio server will be available for integration with VS Code, Cline, or other MCP clients.

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
TDX-MCP/
  package.json
  tsconfig.json
  setup-windows.ps1        # Windows setup wizard
  .vscode/
    mcp.json               # GitHub Copilot Chat MCP configuration
    settings.json          # VS Code input variable definitions
  src/
    index.ts               # Main MCP server entry point
    auth.ts                # TDX authentication (token management)
    config.ts              # Configuration and validation
    tdx-client.ts          # TDX API client
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
```

