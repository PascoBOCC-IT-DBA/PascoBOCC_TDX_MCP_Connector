# TDX MCP API Reference - Public Deployment

## Base URL

```
https://tdx-mcp-<environment>-<suffix>.azurecontainer.io
```

## Authentication

All requests (except `/health`, `/status`, `/tools`) require Bearer token:

```
Authorization: Bearer <API_KEY>
```

## Endpoints

### Health & Status (No Auth Required)

#### GET /health
Health check endpoint
```bash
curl https://<base-url>/health

# Response
{
  "status": "healthy",
  "uptime": 1234.56,
  "timestamp": "2026-06-26T10:00:00.000Z"
}
```

#### GET /status
Service status information
```bash
curl https://<base-url>/status

# Response
{
  "service": "TDX MCP HTTP Wrapper",
  "version": "1.0.0",
  "port": 3000,
  "uptime": 1234.56,
  "timestamp": "2026-06-26T10:00:00.000Z"
}
```

#### GET /tools
List available MCP tools
```bash
curl https://<base-url>/tools

# Response
{
  "tools": [
    "tdx-ticket-search",
    "tdx-ticket-get",
    "tdx-asset-search",
    "tdx-asset-get",
    // ... more tools
  ]
}
```

### MCP Tool Calls (Auth Required)

#### POST /mcp
Execute MCP tools using JSON-RPC format

```bash
curl -X POST \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "call_tool",
    "params": {
      "name": "tdx-ticket-search",
      "arguments": {
        "description": "connection issues",
        "statusID": "1"
      }
    }
  }' \
  https://<base-url>/mcp

# Response
{
  "success": true,
  "type": "tickets",
  "timestamp": "2026-06-26T10:00:00.000Z",
  "tool": "tdx-ticket-search",
  "data": [
    {
      "ID": 12345,
      "Title": "Connection Issues",
      "CreatedDate": "2026-06-20T10:00:00.000Z",
      // ... ticket fields
    }
  ],
  "meta": {
    "count": 1,
    "resultType": "array",
    "query": {
      "description": "connection issues",
      "statusID": "1"
    }
  }
}
```

## Common Tools

### Tickets

**Search tickets:**
```bash
curl -X POST \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "call_tool",
    "params": {
      "name": "tdx-ticket-search",
      "arguments": {
        "description": "network error",
        "statusID": "1"
      }
    }
  }' \
  https://<base-url>/mcp
```

**Get ticket details:**
```bash
curl -X POST \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "call_tool",
    "params": {
      "name": "tdx-ticket-get",
      "arguments": {
        "ticketID": 12345
      }
    }
  }' \
  https://<base-url>/mcp
```

### Assets

**Search assets:**
```bash
curl -X POST \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "call_tool",
    "params": {
      "name": "tdx-asset-search",
      "arguments": {
        "assetName": "Laptop"
      }
    }
  }' \
  https://<base-url>/mcp
```

**Get asset details:**
```bash
curl -X POST \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "call_tool",
    "params": {
      "name": "tdx-asset-get",
      "arguments": {
        "assetID": 54321
      }
    }
  }' \
  https://<base-url>/mcp
```

### CMDB (Configuration Items)

**Search CMDB:**
```bash
curl -X POST \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "call_tool",
    "params": {
      "name": "tdx-cmdb-search",
      "arguments": {
        "name": "web-server"
      }
    }
  }' \
  https://<base-url>/mcp
```

## Request/Response Format

### Request Format
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "call_tool",
  "params": {
    "name": "tool-name",
    "arguments": {
      "arg1": "value1",
      "arg2": "value2"
    }
  }
}
```

### Response Format
```json
{
  "success": true,
  "type": "entity-type",
  "timestamp": "2026-06-26T10:00:00.000Z",
  "tool": "tool-name",
  "data": [
    // Result data
  ],
  "meta": {
    "count": 1,
    "resultType": "array",
    "query": {
      // Original query parameters
    }
  },
  "_raw": {
    // Raw MCP response
  }
}
```

## Error Responses

### 401 Unauthorized
Missing or invalid API key
```json
{
  "error": "Unauthorized: Invalid or missing API key"
}
```

### 400 Bad Request
Invalid JSON or malformed request
```json
{
  "error": "Invalid JSON",
  "details": "error message"
}
```

### 500 Server Error
Server-side error during tool execution
```json
{
  "error": "Tool execution error",
  "details": "error message"
}
```

## Implementation Examples

### JavaScript/Node.js
```javascript
const apiKey = process.env.MCP_API_KEY;
const baseUrl = process.env.MCP_BASE_URL;

async function searchTickets(searchTerm) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'call_tool',
      params: {
        name: 'tdx-ticket-search',
        arguments: { description: searchTerm }
      }
    })
  });
  
  return response.json();
}
```

### Python
```python
import requests
import os

api_key = os.getenv('MCP_API_KEY')
base_url = os.getenv('MCP_BASE_URL')

def search_tickets(search_term):
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'jsonrpc': '2.0',
        'id': 1,
        'method': 'call_tool',
        'params': {
            'name': 'tdx-ticket-search',
            'arguments': {'description': search_term}
        }
    }
    
    response = requests.post(f'{base_url}/mcp', json=payload, headers=headers)
    return response.json()
```

### PowerShell
```powershell
$apiKey = $env:MCP_API_KEY
$baseUrl = $env:MCP_BASE_URL

function Search-TDXTickets {
    param($SearchTerm)
    
    $headers = @{
        'Authorization' = "Bearer $apiKey"
        'Content-Type' = 'application/json'
    }
    
    $body = @{
        jsonrpc = '2.0'
        id = 1
        method = 'call_tool'
        params = @{
            name = 'tdx-ticket-search'
            arguments = @{ description = $SearchTerm }
        }
    } | ConvertTo-Json
    
    Invoke-RestMethod -Uri "$baseUrl/mcp" -Method Post -Headers $headers -Body $body
}
```

## Rate Limiting

- **Max concurrent requests**: 100 per replica
- **Default replicas**: 1-5 (auto-scaling)
- **Timeout**: 60 seconds per request

## Available Tools

See `/tools` endpoint or [TOOLS_REFERENCE.md](TOOLS_REFERENCE.md) for complete tool documentation.

Common categories:
- **Tickets**: Create, search, get, update, feed operations
- **Assets**: Search, get, categories
- **CMDB**: Search, get, relationships
- **Knowledge Base**: Search, get
- **Projects**: Search, get
- **People**: Search, get
- **Groups**: Search, get
- **Accounts**: Get
- **Statuses**: Get
- **Attributes**: Get

## Debugging

Enable verbose logging in the request:

```bash
# Using curl -v for request/response details
curl -v \
  -H "Authorization: Bearer <API_KEY>" \
  https://<base-url>/health

# Using curl -X with detailed output
curl -X GET \
  -H "Authorization: Bearer <API_KEY>" \
  -w "\nHTTP Status: %{http_code}\n" \
  https://<base-url>/health
```

Check server logs:
```bash
# Via Azure CLI
az containerapp logs show \
  --resource-group <rg-name> \
  --name tdx-mcp-<suffix>
```

## Support

For issues:
1. Check `/health` endpoint status
2. Verify API key is correct
3. Review error messages in response
4. Check server logs via Azure Container Apps
5. Verify TDX API credentials and network connectivity
