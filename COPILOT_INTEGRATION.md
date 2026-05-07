# TDX MCP HTTP Server - Copilot Studio Integration

## Status
✅ **Server is running and ready for Copilot Studio integration**
🔐 **API Key Authentication: ACTIVE** (All endpoints except `/health` require authentication)

## Service Details
- **Status**: Active (running)
- **Port**: 3000
- **Server**: 10.210.1.38
- **User**: tdx-mcp
- **Service**: systemd (tdx-mcp.service)

## HTTP Endpoints

### Health Check
```
GET http://10.210.1.38:3000/health
```
Response:
```json
{
  "status": "healthy",
  "uptime": 29.54,
  "timestamp": "2026-05-07T15:22:09.310Z"
}
```

### Service Status
```
GET http://10.210.1.38:3000/status
```
Response:
```json
{
  "service": "TDX MCP HTTP Wrapper",
  "version": "1.0.0",
  "port": "3000",
  "uptime": 29.54,
  "timestamp": "2026-05-07T15:22:17.460Z"
}
```

### List Available Tools
```
GET http://10.210.1.38:3000/tools
```
Response:
```json
{
  "tools": [
    "tickets_create",
    "tickets_query",
    "tickets_update",
    "assets_create",
    "assets_query",
    "assets_update",
    "cmdb_create",
    "cmdb_query",
    "people_get",
    "projects_create",
    "accounts_list",
    "groups_list",
    "kb_search"
  ]
}
```

### MCP Tool Invocation
```
POST http://10.210.1.38:3000/mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "invoke_tool",
  "params": {
    "name": "tickets_query",
    "arguments": {
      "query": "status:open"
    }
  }
}
```

## API Key Authentication

### Current Configuration
✅ **API Key is ACTIVE and deployed**

**Your API Key:**
```
226ee1edd38aea72c27c62e44d0d4edb101a97922568db6db77036f83fbcebde
```

**Protected Endpoints** (require API key):
- `GET /status`
- `GET /tools`
- `POST /mcp`

**Public Endpoints** (no authentication):
- `GET /health` (for load balancers and health checks)

### To Change the API Key
If you need to update or change the API key:

1. **Update the service file:**
```bash
ssh itmcp@10.210.1.38 "sudo nano /etc/systemd/system/tdx-mcp.service"
```

2. **Find and update this line in the `[Service]` section:**
```ini
Environment="MCP_API_KEY=your-new-key-here"
```

3. **Restart the service:**
```bash
ssh itmcp@10.210.1.38 "sudo systemctl daemon-reload && sudo systemctl restart tdx-mcp"
```

### Use API Key in Requests

Once enabled, all authenticated endpoints require the API key in the `Authorization` header:

**With curl:**
```bash
curl -H "Authorization: Bearer 226ee1edd38aea72c27c62e44d0d4edb101a97922568db6db77036f83fbcebde" \
  http://10.210.1.38:3000/status
```

**In Copilot Studio:**
Add this header to all authenticated requests:
```
Authorization: Bearer 226ee1edd38aea72c27c62e44d0d4edb101a97922568db6db77036f83fbcebde
```

**Example MCP request with API key:**
```
POST http://10.210.1.38:3000/mcp
Content-Type: application/json
Authorization: Bearer 226ee1edd38aea72c27c62e44d0d4edb101a97922568db6db77036f83fbcebde

{
  "method": "tickets_query",
  "params": {
    "query": "status:open"
  }
}
```

### Generate a New API Key

If you need to generate a new secure API key for rotation or security reasons:

**On Ubuntu:**
```bash
openssl rand -hex 32
```

**Example output:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

Then update your service file with the new key (see "To Change the API Key" section above).

## Copilot Studio Configuration

### Step 1: Add Custom Connector
In Copilot Studio:
1. Go to **Plugins**
2. Click **+ Create a plugin**
3. Select **Connect to web service**
4. Name: `TDX MCP Connector`

### Step 2: Configure Authentication (if needed)
- Auth type: `API Key` (if adding auth layer)
- Endpoint base URL: `http://10.210.1.38:3000`

### Step 3: Create Actions
Create actions for each tool:

**Example: Query Tickets**
```
POST /mcp
{
  "method": "tickets_query",
  "params": {
    "query": "<user_input>"
  }
}
```

**Example: Create Ticket**
```
POST /mcp
{
  "method": "tickets_create",
  "params": {
    "title": "<title>",
    "description": "<description>",
    "status": "<status>"
  }
}
```

## Service Management

### Check Service Status
```bash
ssh itmcp@10.210.1.38 "sudo systemctl status tdx-mcp"
```

### View Logs
```bash
ssh itmcp@10.210.1.38 "sudo journalctl -u tdx-mcp -f"
```

### Restart Service
```bash
ssh itmcp@10.210.1.38 "sudo systemctl restart tdx-mcp"
```

### Stop Service
```bash
ssh itmcp@10.210.1.38 "sudo systemctl stop tdx-mcp"
```

### Start Service
```bash
ssh itmcp@10.210.1.38 "sudo systemctl start tdx-mcp"
```

## Network Configuration

### Port 3000 Access
If accessing from remote machines:

**Option 1: SSH Tunnel (Secure)**
```bash
ssh -L 3000:localhost:3000 itmcp@10.210.1.38
```

**Option 2: Open Firewall (if needed)**
```bash
sudo ufw allow 3000/tcp
```

## Troubleshooting

### Service Not Starting
```bash
ssh itmcp@10.210.1.38 "sudo journalctl -u tdx-mcp -n 50"
```

### Health Check Fails
```bash
ssh itmcp@10.210.1.38 "curl -v http://localhost:3000/health"
```

### MCP Endpoint Not Responding
```bash
ssh itmcp@10.210.1.38 "sudo systemctl restart tdx-mcp && sleep 2 && curl http://localhost:3000/health"
```

## Integration Notes

- The HTTP wrapper spawns MCP server processes on demand
- Each request creates a subprocess that processes the tool invocation
- Processes are pooled for efficiency (max 5 concurrent)
- Timeouts after 10 seconds per request
- CORS enabled for cross-origin requests

## Environment Variables

Available environment variables:
- `MCP_HTTP_PORT` - HTTP server port (default: 3000)
- `MCP_API_KEY` - API key for request authentication (optional, if set all endpoints except /health require this key)
- `NODE_ENV` - Set to "production" for the service

## Next Steps

1. ✅ **API Key Authentication** - Already configured and active
2. **Configure Copilot Studio** with the HTTP endpoints (see Copilot Studio Configuration section above)
3. **Test connectivity** from Copilot to the MCP service using the API key
4. **Create agent actions** for each tool you need
5. **Test tool invocations** end-to-end from Copilot Studio

## Support

For issues, check:
- Service logs: `sudo journalctl -u tdx-mcp -f`
- Configuration: `/opt/tdx-mcp/.env`
- HTTP wrapper source: `/opt/tdx-mcp/src/http-wrapper.js`
