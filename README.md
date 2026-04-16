# TDX MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that wraps the [TeamDynamix (TDX) REST API](https://solutions.teamdynamix.com/TDWebApi/), enabling AI-assisted IT service management through Claude Desktop, Claude Code, and other MCP clients.

This server exposes **41 tools** across **9 domains** — tickets, assets, CMDB, knowledge base, people, projects, accounts, groups, and custom attributes — allowing natural language interaction with your TDX instance.

## Quick Start

### macOS

1. Double-click `setup-mac.command`
2. Enter your BEID, Web Services Key, and App ID when prompted
3. Restart Claude Desktop

### Windows

1. Double-click `setup-windows.bat`
2. Enter your BEID, Web Services Key, and App ID when prompted
3. Restart Claude Desktop

### Manual Setup

```bash
npm install
npm run build
```

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "tdx": {
      "command": "node",
      "args": ["/path/to/TDX-MCP/dist/index.js"],
      "env": {
        "TDX_BASE_URL": "https://yourorg.teamdynamix.com/TDWebApi/api",
        "TDX_BEID": "your-beid-guid",
        "TDX_WEB_SERVICES_KEY": "your-web-services-key-guid",
        "TDX_APP_ID": "123"
      }
    }
  }
}
```

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

## Tools (41)

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

### Assets (7 tools)

| Tool | Method | Endpoint | Description |
|------|--------|----------|-------------|
| `tdx-asset-create` | POST | `/{appId}/assets` | Create a new asset |
| `tdx-asset-get` | GET | `/{appId}/assets/{id}` | Get an asset by ID |
| `tdx-asset-update` | POST | `/{appId}/assets/{id}` | Full update of an asset |
| `tdx-asset-patch` | PATCH | `/{appId}/assets/{id}` | Partial update of an asset |
| `tdx-asset-delete` | DELETE | `/{appId}/assets/{id}` | Delete an asset |
| `tdx-asset-search` | POST | `/{appId}/assets/search` | Search assets with filters |
| `tdx-asset-feed-add` | POST | `/{appId}/assets/{id}/feed` | Add a comment to an asset |

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

### Custom Attributes (1 tool)

| Tool | Method | Endpoint | Description |
|------|--------|----------|-------------|
| `tdx-attributes-get` | GET | `/attributes/custom` | Get custom attribute definitions for a component type |

Common `componentId` values for `tdx-attributes-get`: `9` = Ticket, `27` = Asset, `63` = CI, `39` = KB Article, `2` = Project.

## Example Usage

Once configured, you can use natural language in Claude Desktop or Claude Code:

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
  .env.example
  setup-mac.command        # macOS setup wizard
  setup-windows.bat        # Windows setup launcher
  setup-windows.ps1        # Windows setup wizard
  src/
    index.ts               # Entry point
    config.ts              # Environment variable loading
    auth.ts                # Admin token auth with auto-refresh
    tdx-client.ts          # Shared HTTP client
    tools/
      tickets.ts           # 9 ticket tools
      assets.ts            # 7 asset tools
      cmdb.ts              # 7 CMDB/CI tools
      kb.ts                # 5 knowledge base tools
      people.ts            # 4 people tools
      projects.ts          # 4 project tools
      accounts.ts          # 2 account tools
      groups.ts            # 2 group tools
      attributes.ts        # 1 custom attributes tool
```

---

Created by [University of Montana IT](https://www.umt.edu/it/) with [Claude](https://claude.ai)
