# Azure Container Apps Deployment Guide

**Status**: Ready for deployment  
**Date**: 2026-07-20  
**Platform**: Azure Container Apps  
**Region**: eastus2  

## Overview

This guide walks through migrating the TDX MCP Connector from Azure App Service to **Azure Container Apps** for improved scaling, performance, and cost efficiency.

### Why Container Apps?

| Feature | App Service (B1) | Container Apps |
|---------|------------------|-----------------|
| **Auto-Scaling** | ❌ Manual | ✅ 0-10 instances |
| **Idle Cost** | Always running ($15/mo) | Zero when idle |
| **Startup Time** | 3+ minutes | 20-30 seconds |
| **Load Balancing** | ❌ Single instance | ✅ Automatic |
| **Estimated Cost** | $15/mo | $5-40/mo (consumption) |
| **Container Support** | Limited | ✅ Native |

---

## Prerequisites

### Required Tools
- **Azure CLI** (v2.50+)
- **Docker Desktop** (or Docker CLI)
- **PowerShell 7+** (or Windows PowerShell 5.1)
- **Git** (for cloning the repo)

### Azure Resources (Must Exist)
- ✅ Subscription with `TDX_MCP` resource group
- ✅ Key Vault in `TDX_MCP` with TDX credentials
- ✅ Managed Identity (85e7b869-1f87-4008-ae99-b5fe55d7573f)
- ✅ Required secrets in Key Vault:
  - `tdx-base-url` (e.g., https://service.pascocountyfl.net/TDXWebApi/api)
  - `tdx-beid`
  - `tdx-web-services-key`
  - `tdx-app-id`
  - `tdx-assets-app-id`
  - `tdx-kb-app-id`
  - `mcp-api-key`

### Verify Prerequisites

```powershell
# Check Azure subscription
az account list --output table

# Verify resource group
az group show --name "TDX_MCP" --query "id" --output tsv

# Verify Key Vault
az keyvault list --resource-group "TDX_MCP" --query "[0].name" --output tsv

# Verify secrets exist
$kv = (az keyvault list --resource-group "TDX_MCP" --query "[0].name" --output tsv)
az keyvault secret list --vault-name $kv --query "[].name" --output table
```

---

## Deployment Steps

### 1. Build TypeScript

```powershell
cd c:\_repos\PascoBOCC-IT-DBA\PascoBOCC_TDX_MCP_Connector
npm run build
```

**Expected Output**: No errors, `dist/` folder created/updated with `.js` files.

### 2. Verify Docker Image (Optional - Local Test)

```powershell
# Build locally to verify
docker build -t tdx-mcp-connector:test -f deploy/Dockerfile .

# Run local test
docker run -p 3000:3000 `
  -e TDX_BASE_URL="https://test.service.com" `
  -e TDX_BEID="test-beid" `
  -e TDX_WEB_SERVICES_KEY="test-key" `
  -e TDX_APP_ID="test-app-id" `
  -e TDX_ASSETS_APP_ID="test-assets" `
  -e TDX_KB_APP_ID="test-kb" `
  -e MCP_API_KEY="test-api-key" `
  tdx-mcp-connector:test

# In another terminal, test health check
curl http://localhost:3000/health
```

### 3. Deploy to Azure Container Apps

Run the deployment PowerShell script:

```powershell
$subscriptionId = "YOUR_SUBSCRIPTION_ID"  # Get from: az account list --query "[?isDefault].id" -o tsv

.\deploy\deploy-container-app.ps1 `
    -SubscriptionId $subscriptionId `
    -ResourceGroup "TDX_MCP" `
    -Location "eastus2" `
    -ContainerAppName "tdx-mcp-app" `
    -ContainerAppEnvName "tdx-mcp-env" `
    -AcrName "tdxmcpacr"
```

**Script Actions**:
1. ✅ Verifies resource group and subscription
2. ✅ Creates/verifies Azure Container Registry (ACR)
3. ✅ Builds Docker image
4. ✅ Pushes image to ACR
5. ✅ Grants managed identity Key Vault access
6. ✅ Creates Container Apps environment
7. ✅ Creates/updates container app
8. ✅ Configures auto-scaling (0-10 replicas)
9. ✅ Outputs the public URL

**Script Output Example**:
```
[2026-07-20 14:30:22] [INFO] Container App deployed successfully
[2026-07-20 14:30:23] [INFO] Access URL: https://tdx-mcp-app.red123.eastus2.azurecontainerapps.io
[2026-07-20 14:30:23] [INFO] Next steps:
[2026-07-20 14:30:23] [INFO] 1. Wait 2-3 minutes for container to start
[2026-07-20 14:30:23] [INFO] 2. Test health endpoint: curl https://tdx-mcp-app.red123.eastus2.azurecontainerapps.io/health
```

### 4. Verify Deployment

```powershell
$appUrl = "https://YOUR_APP_URL_FROM_SCRIPT_OUTPUT"

# Test health check
curl "$appUrl/health"
# Expected: 200 OK

# Get tools list
curl "$appUrl/tools"
# Expected: JSON array of 43 tools

# Test MCP status
curl "$appUrl/status"
# Expected: Server info JSON
```

### 5. Monitor Container App

```powershell
# View real-time logs
az containerapp logs show --name "tdx-mcp-app" --resource-group "TDX_MCP" --follow

# View replica status
az containerapp replica list --name "tdx-mcp-app" --resource-group "TDX_MCP" --output table

# Get current replicas
az containerapp show --name "tdx-mcp-app" --resource-group "TDX_MCP" --query "properties.template.scale"

# View revisions
az containerapp revision list --name "tdx-mcp-app" --resource-group "TDX_MCP" --output table
```

### 6. Update Client Applications

Once verified:
1. Update any hardcoded references from old App Service URL to new Container Apps URL
2. Update documentation/README with new endpoint
3. Test all tool integrations with new URL

### 7. (Optional) Delete Old App Service

When confident Container Apps is stable:

```powershell
# Delete the old App Service
az webapp delete --resource-group "TDX_MCP" --name "TDX-MCP" --yes

# Delete the old App Service Plan (to save cost)
az appservice plan delete --resource-group "TDX_MCP" --name "ASP-TDXMCP-8003" --yes

# Verify deletions
az webapp list --resource-group "TDX_MCP"  # Should be empty
az appservice plan list --resource-group "TDX_MCP"  # Should be empty
```

---

## Configuration Reference

### Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `PORT` | Static: 3000 | HTTP server port |
| `WEBSITES_PORT` | Static: 3000 | Azure port mapping |
| `NODE_ENV` | Static: production | Node.js environment |
| `ALLOW_MODIFICATIONS` | Static: false | Disable write operations |
| `TDX_BASE_URL` | Key Vault | TDX API base URL |
| `TDX_BEID` | Key Vault | TDX Business Entity ID |
| `TDX_WEB_SERVICES_KEY` | Key Vault | TDX Web Services auth key |
| `TDX_APP_ID` | Key Vault | TDX Application ID |
| `TDX_ASSETS_APP_ID` | Key Vault | TDX Assets app ID |
| `TDX_KB_APP_ID` | Key Vault | TDX Knowledge Base app ID |
| `MCP_API_KEY` | Key Vault | MCP server API key |

### Scaling Configuration

```yaml
Min Replicas: 0          # Scale down to zero when idle
Max Replicas: 10         # Maximum concurrent instances
CPU per instance: 0.5 CPU
Memory per instance: 1 GB
Scale trigger: HTTP concurrency (100 concurrent requests per replica)
```

### Health Probe

```yaml
Endpoint: /health
Type: HTTP GET (port 3000)
Initial delay: 10 seconds
Interval: 10 seconds
Timeout: 5 seconds
Failure threshold: 3 failed checks
```

---

## Troubleshooting

### Container won't start

1. **Check logs**:
   ```powershell
   az containerapp logs show --name "tdx-mcp-app" --resource-group "TDX_MCP"
   ```

2. **Verify Docker image**:
   ```powershell
   az acr repository show --name tdxmcpacr --repository tdx-mcp-connector
   ```

3. **Check environment variables**:
   ```powershell
   az containerapp show --name "tdx-mcp-app" --resource-group "TDX_MCP" --query "properties.template.containers[0].env"
   ```

### Health probe failing

1. **Increase initial delay**:
   ```powershell
   az containerapp update --name "tdx-mcp-app" --resource-group "TDX_MCP" \
     --set "properties.template.containers[0].probes[0].initialDelaySeconds=30"
   ```

2. **Check if service is actually running**:
   ```powershell
   curl https://YOUR_APP_URL/health -v
   ```

### Key Vault access denied

1. **Verify managed identity permissions**:
   ```powershell
   az role assignment list --resource-group "TDX_MCP" --query "[?principalType=='ServicePrincipal']" --output table
   ```

2. **Re-grant permissions** (if needed):
   ```powershell
   $kv = (az keyvault list --resource-group "TDX_MCP" --query "[0].id" --output tsv)
   $identity = "85e7b869-1f87-4008-ae99-b5fe55d7573f"
   az role assignment create --role "Key Vault Secrets User" --assignee $identity --scope $kv
   ```

### Container Apps still expensive?

Check for:
1. Unnecessary replicas running: `az containerapp replica list --name "tdx-mcp-app" --resource-group "TDX_MCP"`
2. High CPU: `az containerapp show --name "tdx-mcp-app" --resource-group "TDX_MCP" --query "properties.template.containers[0].resources"`
3. Reduce `maxReplicas` or scale-down threshold if costs are high

---

## Rollback Plan

If issues occur:

1. **Switch traffic back to App Service**:
   ```powershell
   az webapp start --resource-group "TDX_MCP" --name "TDX-MCP"
   ```

2. **Update clients to old URL** if already switched

3. **Keep Container Apps for parallel testing** (costs minimal when idle)

4. **Delete when confirmed stable**:
   ```powershell
   az containerapp delete --name "tdx-mcp-app" --resource-group "TDX_MCP"
   az containerapp env delete --name "tdx-mcp-env" --resource-group "TDX_MCP"
   ```

---

## Performance Expectations

### Startup Time
- **First request**: 20-30 seconds (container cold start)
- **Warm replicas**: <1 second response time
- **Idle timeout**: 15 minutes (then scales to 0)

### Concurrent Load
- **Per replica**: ~100 concurrent requests
- **10 replicas**: ~1000 concurrent requests
- **Auto-scale**: New replicas add within 10-30 seconds of spike

### Cost Estimate
- **Idle (0 replicas)**: $0/month
- **1 replica 24/7**: ~$15/month
- **Average usage** (2-5 replicas): ~$30-60/month
- **Peak load** (10 replicas): ~$150/month

---

## References

- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Container Apps Scaling](https://learn.microsoft.com/en-us/azure/container-apps/scale-app)
- [Key Vault Integration](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets)
- [Health Probes](https://learn.microsoft.com/en-us/azure/container-apps/health-probes)
- [Dockerfile Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)

---

## Support

For deployment issues:
1. Check the troubleshooting section above
2. Review Container Apps logs: `az containerapp logs show --name "tdx-mcp-app" --resource-group "TDX_MCP"`
3. Verify Key Vault secrets are accessible
4. Test local Docker image before deploying
