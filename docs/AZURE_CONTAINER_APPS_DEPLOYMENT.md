# Azure Container Apps Deployment Guide - Public with Authentication

This guide walks through deploying the TDX MCP Connector to **Azure Container Apps** with **public HTTP access** and **API key authentication**.

## Overview

- **Public Access**: The MCP server is accessible via HTTPS on the public internet
- **Authentication**: Requires a single API key, which can be sent as a Bearer token or in a direct header
- **Infrastructure as Code**: Uses Bicep for infrastructure management
- **Secure Credential Storage**: TDX credentials stored in Azure Key Vault, accessed via Managed Identity
- **Azure CLI Deployment**: Direct deployment using Azure CLI (no azd dependency)

## Table of Contents

- [Quick Start (5 minutes)](#quick-start-5-minutes) - Deploy in minutes
- [After Deployment](#after-deployment) - What you'll get
- [Making API Requests](#making-api-requests) - Call your service
- [Architecture](#architecture) - How it works
- [Environment Variables](#environment-variables) - Configuration reference
- [Post-Deployment Operations](#post-deployment-operations--maintenance) - Update, monitor, scale
- [Security Best Practices](#security-best-practices) - Production hardening
- [Advanced Configuration](#advanced-configuration) - Custom domains, CI/CD, etc.
- [Troubleshooting](#troubleshooting) - Common issues

## Prerequisites

1. **Azure Subscription** - with appropriate permissions
2. **Azure CLI** installed (`az` command)
3. **TDX Credentials** - Business Entity ID, Web Services API Key, Base URL
4. **Docker** - optional, only if building custom container images

## Quick Start (5 minutes)

### 1. Prepare Environment Variables

Set your TDX credentials as environment variables (do NOT commit to git):

```powershell
$env:TDX_BASE_URL = "https://<YOUR_TDX_API_DOMAIN>/TDWebApi/api"
$env:TDX_BEID = "your-business-entity-id"
$env:TDX_WEB_SERVICES_KEY = "your-web-services-api-key"
```

**Security Note**: 
- These credentials need to be stored in Azure Key Vault
- Credentials are never stored in source control

### 2. Deploy with Azure CLI

```powershell
# Authenticate with Azure
az login

# Set your subscription
az account set --subscription <subscription-id>

# Create resource group
az group create --name <YOUR_RESOURCE_GROUP_NAME> --location eastus

# Deploy Bicep template (creates Key Vault and Container App)
az deployment group create `
  --resource-group <YOUR_RESOURCE_GROUP_NAME> `
  --template-file infra/main.bicep `
  --parameters `
    location=eastus `
    environment=dev `
    tdxBaseUrl=$env:TDX_BASE_URL `
    tdxBeid=$env:TDX_BEID `
    tdxWebServicesKey=$env:TDX_WEB_SERVICES_KEY
```

### 3. Get Your Public URL

```powershell
az containerapp show `
  --name <CONTAINER_APP_NAME> `
  --resource-group <YOUR_RESOURCE_GROUP_NAME> `
  --query "properties.configuration.ingress.fqdn" -o tsv
```

✅ **Deployment complete!** Your MCP server is now running.

## After Deployment

**What you have:**
- ✓ Public HTTPS endpoint (Container App FQDN)
- ✓ API key for authentication (auto-generated in Bicep output)
- ✓ TDX credentials secured in Azure Key Vault
- ✓ Log Analytics workspace for monitoring
- ✓ Auto-scaling configured (1-5 replicas)

**Next steps:**
1. Test your service with API requests (see below)
2. Monitor performance in Azure Portal
3. Integrate with Copilot or other MCP clients

## Making API Requests

### Using curl

```bash
# Using x-api-key header (recommended - simpler)
curl -H "x-api-key: YOUR_API_KEY" \
  https://<CONTAINER_APP_FQDN>/tools

# Using Bearer token (HTTP standard format)
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://<CONTAINER_APP_FQDN>/tools

# Call an MCP tool
curl -X POST \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"call_tool","params":{"name":"tdx-ticket-search","arguments":{"description":"test"}}}' \
  https://<CONTAINER_APP_FQDN>/mcp
```

**Note:** Both methods send the same API key; Bearer is just the standard HTTP formatting convention.

### Health Check (No Auth Required)

```bash
curl https://<CONTAINER_APP_FQDN>/health
```

## Architecture

### Infrastructure (Bicep)

The `infra/main.bicep` file defines:

- **Azure Key Vault** - secure storage for TDX credentials (BEID, Web Services Key)
- **Log Analytics Workspace** - for application logging
- **Container App Environment** - managed container runtime
- **Container App** - publicly accessible MCP server with Managed Identity
- **Access Policy** - grants Container App permission to read Key Vault secrets

### Credential Management

**Azure Key Vault Integration**:
1. TDX credentials stored securely in Azure Key Vault (encrypted at rest)
2. Container App uses **Managed Identity** (no keys to manage)
3. Container App authenticates to Key Vault automatically
4. Environment variables (`TDX_BEID`, `TDX_WEB_SERVICES_KEY`) are injected from Key Vault at runtime
5. Credentials never appear in configuration files or `.env`

### Public Access

The Container App is configured with:
- `ingress.external: true` - publicly accessible HTTPS
- `ingress.targetPort: 3000` - internal HTTP port
- Automatic HTTPS with platform-managed certificates
- System-assigned Managed Identity for Key Vault access

### Authentication

The HTTP wrapper validates a single API key using the `MCP_API_KEY` environment variable. The key can be sent using any of these header formats (all are equivalent):

1. **Direct headers** (simpler):
   - `x-api-key: <key>` (recommended)
   - `api-key: <key>`
   - `x-functions-key: <key>`

2. **Bearer token** (HTTP standard RFC 6750):
   - `Authorization: Bearer <key>`

**Validation logic:**
- Extracts API key from any of the above formats
- Compares against `MCP_API_KEY` environment variable
- Returns 401 Unauthorized if missing or invalid
- No difference in security — all methods transmit the same key over HTTPS

**Exception endpoints (no auth required):**
   - `/health` - health check
   - `/status` - service status
   - `/tools` - list available tools

## Environment Variables

### At Deployment Time

Pass these to the Bicep template (via `az deployment group create`):

| Variable | Required | Source | Description |
|----------|----------|--------|-------------|
| `TDX_BASE_URL` | Yes | Parameter | TeamDynamix API base URL |
| `TDX_BEID` | Yes | Parameter | Business Entity ID (stored in Key Vault) |
| `TDX_WEB_SERVICES_KEY` | Yes | Parameter | Web Services API Key (stored in Key Vault) |

### At Runtime (in Container App)

These are injected by the Container App from various sources:

| Variable | Source | Description |
|----------|--------|-------------|
| `TDX_BEID` | Key Vault secret | Automatically injected from Key Vault |
| `TDX_WEB_SERVICES_KEY` | Key Vault secret | Automatically injected from Key Vault |
| `TDX_BASE_URL` | Container App secret | Deployed value |
| `TDX_APP_ID` | Bicep (hardcoded) | Ticket application ID (115) |
| `TDX_ASSETS_APP_ID` | Bicep (hardcoded) | Assets application ID (116) |
| `TDX_KB_APP_ID` | Bicep (hardcoded) | Knowledge Base application ID (114) |
| `MCP_HTTP_PORT` | Bicep (hardcoded) | HTTP server port (3000) |
| `MCP_API_KEY` | Container App secret | API key for authentication |
| `NODE_ENV` | Bicep (parameter) | Environment mode ('dev' by default, 'production' if explicitly set). Set via `--parameters environment=production` at deployment time |
| `ALLOW_MODIFICATIONS` | Bicep (hardcoded) | Enable create/update/delete operations (false) |

### Local Development (.env)

For local development, you can use `.env` with test values (excluded from git):

```bash
TDX_BASE_URL=https://<YOUR_TDX_API_DOMAIN>/TDWebApi/api
TDX_BEID=your-business-entity-id-for-local-testing
TDX_WEB_SERVICES_KEY=your-api-key-for-local-testing
TDX_APP_ID=115
TDX_ASSETS_APP_ID=116
TDX_KB_APP_ID=114
MCP_HTTP_PORT=3000
MCP_API_KEY=your-local-api-key
NODE_ENV=development
ALLOW_MODIFICATIONS=false
```

**Production**:
- Credentials are passed via `--parameters` flag at deployment time
- In production, all credentials come from Azure Key Vault only

## Deployment Files

```
infra/
├── main.bicep                    # Main infrastructure template (Container App + Key Vault integration)
├── keyvault-only.bicep          # Standalone Key Vault deployment (for existing Container Apps)

deploy/
├── AZURE_DEPLOYMENT_GUIDE.md    # Deployment details and endpoints
├── azure-deploy.ps1             # PowerShell deployment script (reference)

Dockerfile                         # Multi-stage Docker build (uses http-wrapper)
package.json                       # Node.js dependencies and scripts
.env.example                       # Example environment variables (non-sensitive only)
.gitignore                         # Excludes .env and infra/ folder
```

### Bicep Templates

**`main.bicep`** - Complete infrastructure deployment:
- Azure Key Vault for credential storage
- Container App Environment
- Container App with Managed Identity
- Access Policy granting Container App permission to read Key Vault secrets
- Log Analytics Workspace for monitoring
- Automatically creates all resources in one deployment

**`keyvault-only.bicep`** - For existing Container Apps:
- Standalone Key Vault deployment
- Use if you have an existing Container App and need to add Key Vault integration
- After deployment, grant Container App access via `az keyvault set-policy`
- Update Container App secrets with `az containerapp secret set`
- Map environment variables with `az containerapp update`

## Post-Deployment Operations & Maintenance

### Monitoring and Logs

View logs in Azure Portal:

```bash
# Or via Azure CLI
az containerapp logs show \
  --resource-group <rg-name> \
  --name tdx-mcp-dev-<suffix>
```

View application metrics:
- CPU and memory usage
- Request count and latency
- Container restart events

### Scaling Configuration

The Container App automatically scales based on:

- **Min Replicas**: 1 (always running)
- **Max Replicas**: 5 (scales under load)
- **Scale Rule**: HTTP requests (max 100 concurrent per replica)

Adjust in `infra/main.bicep` under `template.scale`.

### Cost Considerations

**Typical monthly cost** (dev environment):

- **Container App**: ~$40 (1 vCPU, 2 GB memory)
- **Log Analytics**: ~$10-20 (data ingestion)
- **Storage**: minimal
- **Data Transfer**: varies by usage

**Cost Optimization**:
- Reduce max replicas for lower environments
- Use smaller container specifications (0.25 vCPU / 512 MB)
- Implement request rate limiting

### Updating Deployment

To update after code changes:

```powershell
# Rebuild Docker image and redeploy Container App
$env:TDX_BEID = "your-beid"
$env:TDX_WEB_SERVICES_KEY = "your-key"
$env:TDX_BASE_URL = "your-url"

az deployment group create `
  --resource-group <YOUR_RESOURCE_GROUP_NAME> `
  --template-file infra/main.bicep `
  --parameters `
    location=eastus `
    environment=dev `
    tdxBaseUrl=$env:TDX_BASE_URL `
    tdxBeid=$env:TDX_BEID `
    tdxWebServicesKey=$env:TDX_WEB_SERVICES_KEY
```

### Removing Deployment

To delete all Azure resources:

```powershell
# Delete the entire resource group
az group delete --name <YOUR_RESOURCE_GROUP_NAME> --yes
```

This removes the resource group and all associated resources (Container App, Key Vault, Log Analytics).

## Security Best Practices

✅ **Already Implemented**:
- **Azure Key Vault** for credential storage (encrypted at rest)
- **Managed Identity** for authentication (no keys to manage)
- **HTTPS-only** communication (TLS/SSL enforced)
- **API key authentication** required for all endpoints
- **Non-root** container user
- **Health checks** for resilience and security
- **Access Policy** restricts Key Vault access to Container App only
- **No hardcoded credentials** in code, configuration, or git

🔐 **Credential Security**:
- `TDX_BEID` and `TDX_WEB_SERVICES_KEY` stored in Azure Key Vault
- Credentials injected at runtime via Managed Identity
- Credentials never written to logs or exposed in error messages
- `.env` file excluded from git (`infra/` in `.gitignore`)

📋 **Monitoring & Audit**:
- Azure Key Vault logs all access attempts
- Container App logs all requests
- Log Analytics captures performance metrics
- Set alerts for failed authentication attempts

🔄 **Credential Rotation**:
```powershell
# To rotate credentials:
az keyvault secret set --vault-name kv-tdx-mcp-XXXXX --name TdxWebServicesKey --value <new-value>

# Container App will automatically use the new secret on next request
# No restart required
```

✅ **Recommended Additions**:
- Implement rate limiting
- Enable Network Security Groups for additional filtering
- Implement request logging/auditing
- Rotate API keys regularly

## Advanced Configuration

### Updating an Existing Container App to Use Key Vault

If you have an existing Container App running without Key Vault, follow these steps:

### 1. Deploy Key Vault

```powershell
$env:TDX_BEID = "your-beid"
$env:TDX_WEB_SERVICES_KEY = "your-key"
$env:TDX_BASE_URL = "your-url"

az deployment group create `
  --resource-group <your-rg> `
  --template-file infra/keyvault-only.bicep `
  --parameters `
    tdxBeid=$env:TDX_BEID `
    tdxWebServicesKey=$env:TDX_WEB_SERVICES_KEY `
    tdxBaseUrl=$env:TDX_BASE_URL
```

### 2. Grant Container App Access to Key Vault

```powershell
# Get Container App principal ID
$appPrincipalId = az containerapp show `
  --name <container-app-name> `
  --resource-group <rg-name> `
  --query identity.principalId -o tsv

# Grant access to Key Vault
az keyvault set-policy `
  --name <key-vault-name> `
  --object-id $appPrincipalId `
  --secret-permissions get list
```

### 3. Add Key Vault Secrets to Container App

```powershell
$kvUrl = "https://<key-vault-name>.vault.azure.net"

az containerapp secret set `
  --name <container-app-name> `
  --resource-group <rg-name> `
  --secrets `
    "kv-tdx-beid=$kvUrl/secrets/TdxBeid" `
    "kv-tdx-web-services-key=$kvUrl/secrets/TdxWebServicesKey"
```

### 4. Update Environment Variables

```powershell
az containerapp update `
  --name <container-app-name> `
  --resource-group <rg-name> `
  --replace-env-vars `
    TDX_BEID=secretref:kv-tdx-beid `
    TDX_WEB_SERVICES_KEY=secretref:kv-tdx-web-services-key
```

The Container App automatically redeploys with the new configuration.

### Custom Domain Name

To use a custom domain with your Container App:

1. Update your DNS provider with the Container App FQDN
2. Configure custom domain in Container App settings
3. Update client applications with new URL

### VNet Integration

For private network connectivity, modify `infra/main.bicep`:

```bicep
managedEnvironmentId: containerAppEnvironment.id
// Add vnetConfiguration for private network
```

### CI/CD Pipeline

Integrate with GitHub Actions or Azure Pipelines:

```yaml
# .github/workflows/deploy.yml
- name: Deploy to Azure Container Apps
  env:
    TDX_BEID: ${{ secrets.TDX_BEID }}
    TDX_WEB_SERVICES_KEY: ${{ secrets.TDX_WEB_SERVICES_KEY }}
    TDX_BASE_URL: ${{ secrets.TDX_BASE_URL }}
  run: |
    az deployment group create \
      --resource-group <YOUR_RESOURCE_GROUP_NAME> \
      --template-file infra/main.bicep \
      --parameters \
        location=eastus \
        environment=dev \
        tdxBaseUrl=$TDX_BASE_URL \
        tdxBeid=$TDX_BEID \
        tdxWebServicesKey=$TDX_WEB_SERVICES_KEY
```

**Important**: Store TDX credentials as repository secrets, never commit them to git.

## Troubleshooting

### Container won't start
```bash
# Check container app logs
az containerapp logs show \
  --resource-group <rg-name> \
  --name tdx-mcp-dev-<suffix>
```

### 401 Unauthorized responses
- Verify `MCP_API_KEY` environment variable is set
- Try using `x-api-key: <key>` header instead of Bearer token
- Ensure API key matches exactly (case-sensitive)

### Container App fails to start after Key Vault integration
- Verify Container App has Managed Identity enabled
- Check Key Vault access policy: `az keyvault show --vault-name <name> --query "properties.accessPolicies" -o table`
- Verify Key Vault secrets exist: `az keyvault secret list --vault-name <name>`
- Check Container App logs for Key Vault errors

### 403 Forbidden from Key Vault
```powershell
# Verify access policy
az keyvault show --name <key-vault-name> `
  --query "properties.accessPolicies" -o table

# Re-grant access if needed
az keyvault set-policy --name <key-vault-name> `
  --object-id <container-app-principal-id> `
  --secret-permissions get list
```

### Can't retrieve secrets from Key Vault
- Container App revision may need to restart (automatic after update)
- Check Azure Activity Log for access denied events
- Verify secret names are correct (case-sensitive): `TdxBeid`, `TdxWebServicesKey`
- Ensure key matches in both code and Container App secrets

### 403 Forbidden on TDX API
- Verify TDX API key and URL are correct
- Check Business Entity ID and App IDs
- Ensure service account has appropriate permissions in TDX

### High latency or timeouts
- Check Container App resource allocation (CPU/memory)
- Review TDX API response times
- Consider increasing max replicas for scale-out

## Next Steps

After deployment:
1. ✅ [Test API Requests](#making-api-requests) - Verify connectivity
2. ✅ [Monitor & Scale](#post-deployment-operations--maintenance) - Watch performance
3. ✅ [Integrate with Copilot](../docs/COPILOT_INTEGRATION.md) - Connect to AI clients
4. ✅ [Review Security](security-best-practices) - Harden for production

## Support

For issues:
1. Check Azure Container App logs
2. Verify environment variables are set correctly
3. Test TDX API connectivity independently
4. Review Azure service health status
5. See [Troubleshooting](#troubleshooting) section above
