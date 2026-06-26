# TDX MCP HTTP Server - Azure Container Apps Integration

## Deployment Note
This server is deployed to **Azure Container Apps** and accessible via public HTTPS endpoints. For deployment instructions, see [AZURE_CONTAINER_APPS_DEPLOYMENT.md](AZURE_CONTAINER_APPS_DEPLOYMENT.md).

This configuration shows how to integrate with Copilot Studio. Placeholder values `[YOUR_*]` should be replaced with your actual Azure and TDX configuration values.

## Status
✅ **Server ready for Copilot Studio integration**
🔐 **Entra/Azure Authentication: Configurable** (All endpoints except `/health` require authentication)
📊 **Available Tools**: 43 tools across 10 domains (17 read-only by default, 26 modification tools optional)

## Service Details
- **Version**: 1.0.0
- **Deployment Platform**: Azure Container Apps (recommended)
- **Public URL**: https://[YOUR_CONTAINER_APP_NAME].azurecontainerapps.io
- **Authentication**: Bearer token (API key)
- **Service Type**: Managed Azure Container Apps service
- **Testing**: Comprehensive test suite available in `/tests/` directory
- **Deployment**: See [AZURE_CONTAINER_APPS_DEPLOYMENT.md](AZURE_CONTAINER_APPS_DEPLOYMENT.md)

## HTTP Endpoints

All endpoints are accessible via your Azure Container App URL: `https://your-container-app-name.azurecontainerapps.io`

### Health Check (Public - No Auth)
```
GET https://your-container-app-name.azurecontainerapps.io/health
```
Response:
```json
{
  "status": "healthy",
  "uptime": 29.54,
  "timestamp": "2026-05-07T15:22:09.310Z"
}
```

### Service Status (Protected - Requires API Key)
```
GET https://your-container-app-name.azurecontainerapps.io/status
Authorization: Bearer {API_KEY}
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

### List Available Tools (Protected - Requires API Key)
```
GET https://your-container-app-name.azurecontainerapps.io/tools
Authorization: Bearer {API_KEY}
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
POST https://your-container-app-name.azurecontainerapps.io/mcp
Content-Type: application/json
Authorization: Bearer {API_KEY}

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

## Authentication - Azure Container Apps Deployment

### API Key Authentication (Recommended for Azure Container Apps)

The deployed Azure Container Apps instance uses **Bearer token (API key) authentication**. All protected endpoints require an API key:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-container-app.azurecontainerapps.io/status
```

**Public Endpoints (no authentication required):**
- `GET /health` - Health check

**Protected Endpoints (API key required):**
- All other endpoints require `Authorization: Bearer <API_KEY>` header

Your API key is generated during deployment and stored securely. See [AZURE_CONTAINER_APPS_DEPLOYMENT.md](AZURE_CONTAINER_APPS_DEPLOYMENT.md) for deployment details.

### Entra/Azure OAuth 2.0 (Alternative Configuration)

If you need to implement Entra/Azure authentication instead of API key authentication, the MCP service can be secured with OAuth 2.0 / OpenID Connect (OIDC).

**To enable Entra authentication (alternative):**
1. Create an Azure Entra app registration (see [Azure App Registration Details](#azure-app-registration-details) section)
2. Configure the environment variables with your app credentials
3. Update the HTTP wrapper to validate Entra access tokens instead of API keys
4. All protected endpoints will require valid Azure AD access tokens

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

### API Key Usage (Azure Container Apps Deployment)

For the default Azure Container Apps deployment, simply use your API key:

**In manual API testing:**
```bash
# Get your API key from the deployment output
API_KEY="your-api-key-from-deployment"

# Use it in requests
curl -H "Authorization: Bearer $API_KEY" \
  https://your-container-app.azurecontainerapps.io/status

# Make an MCP call
curl -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"tdx-ticket-search","arguments":{"maxResults":5}}}' \
  https://your-container-app.azurecontainerapps.io/mcp
```

**Obtaining your API Key:**
1. Your API key is generated during deployment with `azd up`
2. It's displayed in the deployment output
3. It's stored in the Container App environment variables
4. Retrieve it anytime with: `azd env get-values | grep MCP_API_KEY`

### Entra/Azure OAuth 2.0 (Alternative Configuration)

If you need to implement Entra/Azure authentication instead of API key authentication:

**To enable Entra authentication:**
1. Create an Azure Entra app registration
2. Configure environment variables with your app credentials
3. Update the HTTP wrapper to validate Entra access tokens instead of API keys
4. All protected endpoints will require valid Azure AD access tokens

**Obtaining an Access Token (Entra/OAuth alternative):**

For manual API testing with Entra authentication:

**Using Azure CLI:**
```bash
az account get-access-token \
  --resource https://your-container-app.azurecontainerapps.io \
  --scope <YOUR_APP_ID>/.default
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

**Using Access Token in Requests:**
```bash
curl -H "Authorization: Bearer {ACCESS_TOKEN}" \
  https://your-container-app.azurecontainerapps.io/status
```

### Azure App Registration Details (Entra/OAuth Alternative)

If using Entra/OAuth authentication instead of API keys, your application is registered in Azure Entra with:

- **Application Name**: TDX MCP Connector
- **Application ID**: [YOUR_APP_ID]
- **Tenant ID**: [YOUR_TENANT_ID]
- **Resource URI**: https://your-container-app.azurecontainerapps.io
- **Redirect URI**: https://your-container-app.azurecontainerapps.io/auth/callback (if applicable)

### Client Credentials (Application Secrets)

For Copilot Studio to authenticate as your application with Entra/OAuth, you'll need:

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

1. **Azure App Service Deployed** - Service running on private URL with HTTPS
2. **Environment Variables Configured** - Set all TDX and Azure credentials in App Settings
3. **Entra/Azure Authentication Configured** - OAuth 2.0 app registration complete with credentials
4. **Private URL Secured** - HTTPS enforced with Azure-managed certificate
5. **Application Secrets Stored** - Client ID, Secret, Tenant ID securely in Azure Key Vault
6. **Configure Copilot Studio** - Create OAuth connection and actions (see Copilot Studio Configuration section)
7. **Test Connectivity** - Verify Copilot can authenticate and call the MCP service
8. **Test Tool Invocations** - End-to-end testing of each action (especially CMDB with appId=116)
9. **Monitor & Alert** - Enable Application Insights and config
10. **Documentation** - Update agent prompt documentation with available tools
11. **Go Live** - Publish actions to Copilot agents