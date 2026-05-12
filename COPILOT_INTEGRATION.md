# TDX MCP HTTP Server - Example Copilot Studio Integration

## ⚠️ Example Notice
This is an **example configuration** showing how to integrate with Copilot Studio. It contains placeholder values `[YOUR_*]` that should be replaced with your actual Azure and TDX configuration values when you're ready to deploy.

## Status
✅ **Server ready for Copilot Studio integration**
🔐 **Entra/Azure Authentication: Configurable** (All endpoints except `/health` require authentication)
📊 **Available Tools**: 43 tools across 10 domains (17 read-only by default, 26 modification tools optional)

## Service Details
- **Version**: 1.0.0
- **Deployment Platform**: Azure (App Service/AKS/Container Instances)
- **Private URL**: https://[YOUR_PRIVATE_URL]
- **Authentication**: Entra/Azure OAuth 2.0
- **Service Type**: Managed cloud service or self-hosted
- **Testing**: Comprehensive test suite available in `/tests/` directory

## HTTP Endpoints

### Health Check
```
GET https://[YOUR_PRIVATE_URL]/health
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
GET https://[YOUR_PRIVATE_URL]/status
Authorization: Bearer {ACCESS_TOKEN}
```
Response:
```json
{
  "service": "TDX MCP HTTP Wrapper",
  "version": "1.0.0",
  "uptime": 29.54,
  "timestamp": "2026-05-07T15:22:17.460Z"
}
```

### List Available Tools
```
GET https://[YOUR_PRIVATE_URL]/tools
Authorization: Bearer {ACCESS_TOKEN}
```
Response:
```json
{
  "tools": [
    "tdx-ticket-create",
    "tdx-ticket-search",
    "tdx-ticket-get",
    "tdx-ticket-update",
    "tdx-ticket-patch",
    "tdx-ticket-feed-get",
    "tdx-ticket-feed-add",
    "tdx-asset-create",
    "tdx-asset-search",
    "tdx-asset-get",
    "tdx-cmdb-create",
    "tdx-cmdb-search",
    "tdx-people-get",
    "tdx-projects-create",
    "tdx-account-search",
    "tdx-group-get",
    "tdx-kb-search",
    "... and 26 more tools ..."
  ]
}
```

**Complete tool list** (43 total):
- **Tickets** (9 tools): create, search, get, update, patch, feed-get, feed-add, add-asset, add-contact
- **Assets** (8 tools): create, search, get, update, patch, delete, categories, feed-add
- **CMDB** (7 tools): create, search, get, update, delete, feed-add, add-relationship
- **KB** (5 tools): search, create, get, update, delete
- **People** (4 tools): get, search, lookup, update
- **Projects** (4 tools): create, search, get, update
- **Accounts** (2 tools): get, search
- **Groups** (2 tools): get, search
- **Attributes** (1 tool): get
- **Statuses** (1 tool): get

### MCP Tool Invocation

**POST /mcp** - Direct MCP JSON-RPC endpoint for tool invocation
```
POST https://[YOUR_PRIVATE_URL]/mcp
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tdx-ticket-search",
    "arguments": {
      "statusIds": [896],
      "maxResults": 10
    }
  }
}
```

**Response Format**:
```json
{
  "success": true,
  "results": {
    "success": true,
    "type": "tickets",
    "timestamp": "2026-05-07T18:30:00.123Z",
    "tool": "tdx-ticket-search",
    "data": [ ],
    "meta": {
      "count": 10,
      "resultType": "array",
      "query": { "statusIds": [896], "maxResults": 10 },
      "tool": { "name": "tdx-ticket-search", "type": "tickets" }
    }
  },
  "meta": {
    "executionTimeMs": 1250,
    "timestamp": "2026-05-07T18:30:00.123Z"
  }
}
```

## Entra/Azure Authentication

### OAuth 2.0 Configuration
The MCP service can be secured with Entra/Azure authentication using OAuth 2.0 / OpenID Connect (OIDC).

**To enable authentication:**
1. Create an Azure Entra app registration (see [Azure App Registration Details](#azure-app-registration-details) section)
2. Configure the environment variables with your app credentials
3. All protected endpoints will automatically require valid access tokens

**Protected Endpoints** (require valid Azure AD access token):
- `GET /status`
- `GET /tools`
- `POST /mcp`

**Public Endpoints** (no authentication):
- `GET /health` (for load balancers and health checks)

### Azure App Registration Details
Your application is registered in Azure Entra with the following details:

- **Application Name**: TDX MCP Connector
- **Application ID**: [YOUR_APP_ID]
- **Tenant ID**: [YOUR_TENANT_ID]
- **Resource URI**: https://[YOUR_PRIVATE_URL]
- **Redirect URI**: https://[YOUR_PRIVATE_URL]/auth/callback (if applicable)

### Obtaining an Access Token

#### For Copilot Studio
Copilot Studio will automatically handle token acquisition:
1. Configure the OAuth connection in Copilot Studio settings (see Copilot Studio Configuration section below)
2. Specify your Azure AD application credentials
3. Copilot will request tokens on behalf of your application

#### For Manual API Testing

**Using Azure CLI:**
```bash
az account get-access-token \
  --resource https://[YOUR_PRIVATE_URL] \
  --scope [YOUR_APP_ID]/.default
```

**Using cURL with Client Credentials:**
```bash
curl -X POST \
  "https://login.microsoftonline.com/[TENANT_ID]/oauth2/v2.0/token" \
  -d "client_id=[YOUR_APP_ID]" \
  -d "client_secret=[YOUR_CLIENT_SECRET]" \
  -d "scope=[YOUR_APP_ID]/.default" \
  -d "grant_type=client_credentials"
```

Response includes:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Using Access Token in Requests

Once obtained, include the access token in the `Authorization` header:

**With cURL:**
```bash
curl -H "Authorization: Bearer {ACCESS_TOKEN}" \
  https://[YOUR_PRIVATE_URL]/status
```

**In Copilot Studio:**
The authorization header is automatically added by the OAuth connector you configure.

**Example MCP request with Azure access token:**
```
POST https://[YOUR_PRIVATE_URL]/mcp
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tdx-ticket-search",
    "arguments": {
      "statusIds": [896],
      "maxResults": 10
    }
  }
}
```

### Token Expiration & Refresh
- **Access Token Lifetime**: 1 hour (default)
- **Refresh Token Lifetime**: 24 hours
- **Copilot Studio**: Automatically handles token refresh via the OAuth connection
- **Manual Testing**: Request a new token when your current token expires

### Client Credentials (Application Secrets)

For Copilot Studio to authenticate as your application, you'll need:

1. **Client ID** (Application ID): [YOUR_APP_ID]
2. **Client Secret**: [Create in Azure Portal → App Registration → Certificates & secrets]
3. **Tenant ID**: [YOUR_TENANT_ID]

**⚠️ Security Note**: Keep your Client Secret secure:
- Never commit it to version control
- Store it in Azure Key Vault for production
- Rotate periodically (annually recommended)
- Use managed identities when possible instead of client secrets

### API Permissions

The application requires the following API permissions in Azure Entra:
- **Microsoft Graph API**: User.Read (delegated) - if using user context
- **Custom API** (your TDX MCP service): Access to protected endpoints

Configure these in Azure Portal → App Registration → API Permissions.

## Copilot Studio Configuration

### Step 1: Create OAuth Connection in Copilot Studio
In Copilot Studio:
1. Go to **Connections** (or **Settings** → **Connections**)
2. Click **Create New Connection**
3. Select **Azure AD** or **OAuth 2.0**
4. Fill in the following details:
   - **Connection Name**: `TDX MCP OAuth`
   - **Client ID**: [YOUR_APP_ID]
   - **Client Secret**: [YOUR_CLIENT_SECRET]
   - **Tenant ID**: [YOUR_TENANT_ID]
   - **Authorization URL**: `https://login.microsoftonline.com/[YOUR_TENANT_ID]/oauth2/v2.0/authorize`
   - **Token URL**: `https://login.microsoftonline.com/[YOUR_TENANT_ID]/oauth2/v2.0/token`
   - **Scope**: `[YOUR_APP_ID]/.default`

### Step 2: Add Custom Connector
1. Go to **Plugins**
2. Click **+ Create a plugin**
3. Select **Connect to web service**
4. Configure:
   - **Name**: `TDX MCP Connector`
   - **Base URL**: `https://[YOUR_PRIVATE_URL]`
   - **Authentication**: Select the OAuth connection you created above

### Step 3: Create Actions
Create actions for each tool you need. Example actions:

**Example: Query Tickets**
```
POST /mcp
Content-Type: application/json
Authorization: Bearer {connection.token}

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tdx-ticket-search",
    "arguments": {
      "statusIds": [<status_id>],
      "maxResults": <max_results>
    }
  }
}
```

**Example: Create Ticket**
```
POST /mcp
Content-Type: application/json
Authorization: Bearer {connection.token}

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tdx-ticket-create",
    "arguments": {
      "title": "<title>",
      "description": "<description>",
      "statusId": <status_id>
    }
  }
}
```

## Service Management (Azure Deployment)

### Check Service Health
- **Azure Portal**: Navigate to your App Service → Health Check
- **Health Endpoint**: `GET https://[YOUR_PRIVATE_URL]/health`

### View Application Logs
- **Azure Portal**: App Service → Log stream
- **Azure Monitor**: Application Insights (if enabled)
- **Azure CLI**:
```bash
az webapp log tail --name [APP_NAME] --resource-group [RESOURCE_GROUP]
```

### Restart Service
- **Azure Portal**: App Service → Restart
- **Azure CLI**:
```bash
az webapp restart --name [APP_NAME] --resource-group [RESOURCE_GROUP]
```

### Stop/Start Service
**Stop:**
```bash
az webapp stop --name [APP_NAME] --resource-group [RESOURCE_GROUP]
```

**Start:**
```bash
az webapp start --name [APP_NAME] --resource-group [RESOURCE_GROUP]
```

### Scaling & Performance
- **Azure Portal**: Scale up/out under Settings
- **Auto-scale**: Configure based on CPU, memory, or custom metrics
- **App Service Plan**: Adjust tier if needed for performance requirements

## Network Configuration

### Private URL Access
The service is deployed with a private URL and secured with Entra/Azure authentication:
- **Public endpoint**: Not directly exposed (authentication required)
- **Private URL**: `https://[YOUR_PRIVATE_URL]`
- **HTTPS**: Enforced (automatic certificate management via Azure)
- **Network security**: Azure Private Endpoints (optional, for additional isolation)

### Accessing the Service

**Option 1: Copilot Studio** (Recommended)
- Configure the OAuth connection in Copilot Studio
- Copilot will automatically authenticate and call the private URL
- No manual token management needed

**Option 2: Azure CLI with OAuth**
```bash
az account get-access-token --scope [YOUR_APP_ID]/.default
# Use the returned token in Authorization: Bearer header
```

**Option 3: Azure Private Endpoint** (for additional security)
- Configure a Private Endpoint in Azure Portal
- Restrict access to specific VNets
- Traffic never traverses the public internet

### Firewall & Network Policy
- **Azure Firewall** (optional): Can be configured to control inbound/outbound traffic
- **Network Security Groups (NSG)**: Configure if using VNets
- **CORS**: Configured for Copilot Studio domain
- **TLS/SSL**: Enforced (Azure-managed certificates)

## Troubleshooting

### Service Not Accessible
1. Check Azure Portal: App Service → Health check → Status
2. Verify authentication token is valid
3. Check Application Insights for errors
4. Verify the private URL is correct: `https://[YOUR_PRIVATE_URL]`

```bash
# Test health endpoint (no auth required)
curl https://[YOUR_PRIVATE_URL]/health

# Test protected endpoint (with token)
curl -H "Authorization: Bearer {ACCESS_TOKEN}" \
  https://[YOUR_PRIVATE_URL]/status
```

### Authentication Failures
- **Invalid token**: Obtain a new access token
- **Expired token**: Request a new token (auto-handled by Copilot)
- **Invalid credentials**: Verify Client ID, Client Secret, Tenant ID in Azure Portal
- **Insufficient permissions**: Check API Permissions in App Registration → API Permissions

### Access Token Issues
```bash
# Request a new token
az account get-access-token --scope [YOUR_APP_ID]/.default

# Decode token to check expiration
# Use https://jwt.io and paste your token to inspect claims
```

### MCP Endpoint Not Responding
1. Check Azure Monitor → Application Insights
2. Verify application is running: `az webapp show --name [APP_NAME] --resource-group [RESOURCE_GROUP]`
3. Check logs: `az webapp log tail --name [APP_NAME] --resource-group [RESOURCE_GROUP]`
4. Restart service if needed: `az webapp restart --name [APP_NAME] --resource-group [RESOURCE_GROUP]`

### Network Connectivity Issues
- If using Private Endpoints, verify VNet connectivity
- Check Azure Firewall rules if configured
- Verify Network Security Groups (NSG) allow HTTPS (port 443)
- Confirm Copilot Studio can reach the private URL

### Debugging with Application Insights
Enable Application Insights in Azure Portal for detailed diagnostics:
- **Requests**: See all API calls
- **Failures**: Track errors
- **Exceptions**: Detailed error logs
- **Performance**: Response time analytics

Example query:
```kusto
requests
| where name contains "mcp"
| where tostring(customDimensions.status) != "200"
| project timestamp, name, resultCode, duration
```

## Integration Notes

- **Authentication**: Entra/Azure OAuth 2.0 with OIDC
- **Token lifetime**: 1 hour (access token) / 24 hours (refresh token)
- **Process Pooling**: HTTP wrapper maintains a pool of warm MCP processes for fast response times
- **Process Management**: Each request uses an available process from the pool (max concurrent configurable)
- **Request Timeout**: 10 seconds per request via `/mcp` endpoint
- **CORS**: Configured for Copilot Studio domain
- **Response Format**: All `/mcp` responses transformed into agent-friendly JSON with metadata
- **Deployment**: Azure managed service (App Service/AKS/Containers)
- **Certificates**: Automatic TLS/SSL via Azure
- **Network**: Private URL with authentication-based access control

## HTTP Endpoints Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/health` | GET | No | Health check (returns status, uptime) |
| `/status` | GET | OAuth 2.0 | Service status and version |
| `/tools` | GET | OAuth 2.0 | List all 43 available tools |
| `/mcp` | POST | OAuth 2.0 | Direct MCP JSON-RPC tool invocation |
| `/` | GET | OAuth 2.0 | MCP-over-HTTP SSE connection |
| `/` | POST | OAuth 2.0 | MCP-over-HTTP request/response |

## Environment Variables & Configuration

⚠️ **All placeholder values below must be replaced with your actual configuration before deployment.**

Available environment variables (typically configured in Azure App Settings):

**Deployment Configuration:**
- `NODE_ENV` - Environment mode (default: production)
- `MCP_HTTP_PORT` - HTTP server port (default: 3000, managed by Azure)

**Azure Authentication:**
- `AZURE_TENANT_ID` - Entra/Azure tenant ID
- `AZURE_CLIENT_ID` - Application (client) ID
- `AZURE_CLIENT_SECRET` - Application client secret
- `AZURE_AUTHORITY_URL` - Authorization endpoint (default: https://login.microsoftonline.com)

**TDX API Configuration:**
- `TDX_BASE_URL` - TeamDynamix API base URL
- `TDX_BEID` - TeamDynamix Business Edition ID
- `TDX_WEB_SERVICES_KEY` - TeamDynamix API key
- `TDX_APP_ID` - Default TDX App ID for service requests
- `TDX_ASSETS_APP_ID` - TDX App ID for asset requests
- `TDX_KB_APP_ID` - TDX App ID for knowledge base requests

**Note on credential management:**
- **Azure credentials** (Client ID, Secret, Tenant ID): Stored securely in Azure Key Vault or App Settings
  - Never commit to version control
  - Rotate secrets periodically (annually recommended)
  - Use managed identities when possible
- **TDX API credentials**: Auto-refresh every 24 hours - no manual action needed
- **Access tokens**: Automatically issued and refreshed by Copilot Studio via OAuth flow

### Secure Configuration Best Practices
1. Use Azure Key Vault to store secrets
2. Reference Key Vault secrets in App Settings
3. Enable managed identity for the App Service
4. Use role-based access control (RBAC) for permissions
5. Enable audit logging in Azure Monitor

## Deployment Checklist

Complete these steps in order before going live with Copilot Studio integration:

1. **Local Testing** - Run `tests/test-comprehensive.ps1` and verify all tests pass
2. **Azure App Service Deployed** - Service running on private URL with HTTPS
3. **Environment Variables Configured** - Set all TDX and Azure credentials in App Settings
4. **Entra/Azure Authentication Configured** - OAuth 2.0 app registration complete with credentials
5. **Private URL Secured** - HTTPS enforced with Azure-managed certificate
6. **Application Secrets Stored** - Client ID, Secret, Tenant ID securely in Azure Key Vault
7. **Configure Copilot Studio** - Create OAuth connection and actions (see Copilot Studio Configuration section)
8. **Test Connectivity** - Verify Copilot can authenticate and call the MCP service
9. **Test Tool Invocations** - End-to-end testing of each action (especially CMDB with appId=116)
10. **Monitor & Alert** - Enable Application Insights and config
11. **Documentation** - Update agent prompt documentation with available tools
12. **Go Live** - Publish actions to Copilot agents

## Testing Your Integration

Before deploying to Copilot Studio, test the MCP service locally:

### Run Comprehensive Test Suite
```powershell
cd tests/
.\test-comprehensive.ps1
```

The test suite (`test-comprehensive.ps1`) validates:
- ✅ All 43 tools are properly registered
- ✅ Read-only tools work correctly
- ✅ Modification tools (if enabled) execute successfully
- ✅ Error handling and edge cases
- ✅ CMDB operations with required appId parameter
- ✅ Response format compliance

**Test Results**: Results are saved to `tests/results/` directory with timestamp.

### Key Testing Notes
- **Test Parameters**: Edit `test-params.ps1` to configure your TDX credentials
- **Expected Output**: Tests produce JSON results with pass/fail summary

See `tests/README.md` for detailed testing documentation.

## Next Steps

1. **Local Testing** - Run `test-comprehensive.ps1` to validate your setup
2. **Azure Deployment** - Deploy application to Azure using preferred method (App Service, AKS, Containers)
3. **Azure Entra Setup** - Create app registration and obtain credentials
4. **Configure App Settings** - Set all required environment variables in Azure
5. **Configure Copilot Studio** - Create OAuth connection with Azure credentials
6. **Create Agent Actions** - Add actions for each TDX tool you need
7. **Test Integration** - Verify end-to-end connectivity and token flow
8. **Enable Monitoring** - Set up Application Insights alerts and dashboards

## Support & Documentation

For issues, check:
- **Testing Issues**: See `tests/README.md` for troubleshooting
- **Azure Deployment**: Check `DEPLOYMENT_UBUNTU.md` for server setup
- **Azure Portal**: App Service logs and Application Insights
- **Copilot Studio**: Check connection status and action definitions
- **Entra/Azure AD**: Verify app registration and API permissions
- **Documentation**: Reference [README.md](README.md) for architecture and tools overview
