# Azure App Service Deployment Guide - TDX MCP Connector

This guide walks through deploying the TDX MCP Connector to Azure App Service using **Azure CLI (az)** — the modern, non-deprecated deployment approach.

## Prerequisites

### 1. Install Required Tools
- **Azure CLI 2.50+**: https://aka.ms/azure-cli
- **Node.js 20+**: https://nodejs.org
- **PowerShell 7+** (recommended) or PowerShell 5.1

Verify installations:
```powershell
az --version          # Should be 2.50+
node --version        # Should be 20.x or higher
pwsh --version        # PowerShell version
```

### 2. Azure Subscription Requirements
- **Subscription ID**: `b0c08d7e-0820-4b4f-bc4b-2d2b5f6ad085`
- **Region**: `eastus2`
- **Role Required**: Contributor or Owner on the subscription
- **Existing Resource Group**: `TDX_MCP` (created separately)

### 3. TDX API Credentials
Obtain these values from your TDX Administrator:
- `TDX_BASE_URL` - TeamDynamix API endpoint (e.g., `https://service.pascocountyfl.net/TDWebApi/api`)
- `TDX_BEID` - Business Entity ID
- `TDX_WEB_SERVICES_KEY` - Web Services API Key
- `TDX_APP_ID` - Default Application ID (Tickets)
- `TDX_ASSETS_APP_ID` - Assets/CMDB Application ID
- `TDX_KB_APP_ID` - Knowledge Base Application ID
- `MCP_API_KEY` - API key for MCP server access (generate a secure random string)

## Deployment Steps

### Step 1: Prepare Local Environment

```powershell
# Navigate to project directory
cd c:\_repos\PascoBOCC-IT-DBA\PascoBOCC_TDX_MCP_Connector

# Install dependencies
npm install

# Build TypeScript (creates dist/ folder)
npm run build

# Verify build succeeds
dir dist/
# Should show: http-wrapper.js, index.js, config.js, auth.js, tdx-client.js, tools/ folder
```

### Step 2: Authenticate with Azure

```powershell
# Login to Azure
az login

# Set the subscription
az account set --subscription "b0c08d7e-0820-4b4f-bc4b-2d2b5f6ad085"

# Verify you're on the correct subscription
az account show --query "name"
```

### Step 3: Create/Configure Secrets in Azure Key Vault

The App Service needs access to TDX credentials via Key Vault. These must be created **before deployment**.

```powershell
# Get the Key Vault resource ID (created separately or from existing resource)
$keyVaultName = "tdx-mcp-kv"  # Must already exist in TDX_MCP resource group
$resourceGroup = "TDX_MCP"

# Set secrets in Key Vault (replace values with actual credentials)
az keyvault secret set --vault-name $keyVaultName --name "TDX-BASE-URL" `
  --value "https://service.pascocountyfl.net/TDWebApi/api"

az keyvault secret set --vault-name $keyVaultName --name "TDX-BEID" `
  --value "<your-beid>"

az keyvault secret set --vault-name $keyVaultName --name "TDX-WEB-SERVICES-KEY" `
  --value "<your-web-services-key>"

az keyvault secret set --vault-name $keyVaultName --name "TDX-APP-ID" `
  --value "<your-tickets-app-id>"

az keyvault secret set --vault-name $keyVaultName --name "TDX-ASSETS-APP-ID" `
  --value "<your-assets-app-id>"

az keyvault secret set --vault-name $keyVaultName --name "TDX-KB-APP-ID" `
  --value "<your-kb-app-id>"

az keyvault secret set --vault-name $keyVaultName --name "MCP-API-KEY" `
  --value "$(New-Guid)"  # Generate secure random string
```

### Step 4: Configure App Service Settings

Configure the App Service to use Key Vault references for secrets:

```powershell
$appName = "TDX-MCP"
$resourceGroup = "TDX_MCP"
$keyVaultName = "tdx-mcp-kv"
$keyVaultId = az keyvault show --name $keyVaultName --query id --output tsv

# Set app configuration settings (Key Vault references for secrets)
az webapp config appsettings set --resource-group $resourceGroup --name $appName `
  --settings `
    "WEBSITES_PORT=3000" `
    "NODE_ENV=production" `
    "ALLOW_MODIFICATIONS=false" `
    "SCM_DO_BUILD_DURING_DEPLOYMENT=true" `
    "TDX_BASE_URL=@Microsoft.KeyVault(SecretUri=https://$keyVaultName.vault.azure.net/secrets/TDX-BASE-URL/)" `
    "TDX_BEID=@Microsoft.KeyVault(SecretUri=https://$keyVaultName.vault.azure.net/secrets/TDX-BEID/)" `
    "TDX_WEB_SERVICES_KEY=@Microsoft.KeyVault(SecretUri=https://$keyVaultName.vault.azure.net/secrets/TDX-WEB-SERVICES-KEY/)" `
    "TDX_APP_ID=@Microsoft.KeyVault(SecretUri=https://$keyVaultName.vault.azure.net/secrets/TDX-APP-ID/)" `
    "TDX_ASSETS_APP_ID=@Microsoft.KeyVault(SecretUri=https://$keyVaultName.vault.azure.net/secrets/TDX-ASSETS-APP-ID/)" `
    "TDX_KB_APP_ID=@Microsoft.KeyVault(SecretUri=https://$keyVaultName.vault.azure.net/secrets/TDX-KB-APP-ID/)" `
    "MCP_API_KEY=@Microsoft.KeyVault(SecretUri=https://$keyVaultName.vault.azure.net/secrets/MCP-API-KEY/)"

# Set the startup command (explicit Node entry point - don't let Oryx auto-generate)
az webapp config set --resource-group $resourceGroup --name $appName `
  --startup-file "node /home/site/wwwroot/dist/http-wrapper.js"
```

### Step 5: Configure Managed Identity Access to Key Vault

The App Service uses Managed Identity to access Key Vault. Ensure it has permission:

```powershell
$appName = "TDX-MCP"
$resourceGroup = "TDX_MCP"
$keyVaultName = "tdx-mcp-kv"

# Get the App Service's Managed Identity principal ID
$principalId = az webapp identity show --resource-group $resourceGroup --name $appName `
  --query principalId --output tsv

# Grant Key Vault secret read permissions to the Managed Identity
az keyvault set-policy --name $keyVaultName --object-id $principalId `
  --secret-permissions get list
```

### Step 6: Build and Package the Application

Create the deployment ZIP with ONLY the necessary files (dist/ + package.json + package-lock.json):

```powershell
# Build TypeScript
npm run build

# Create deployment package
$zipPath = "deploy/azure-app-service/tdx-mcp-deploy.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }

# Create minimal ZIP (Oryx will run npm ci at deploy time)
Compress-Archive -Path @("dist", "package.json", "package-lock.json") `
  -DestinationPath $zipPath

# Verify ZIP was created (should be < 500 KB)
Get-Item $zipPath | Select-Object Name, @{Name="SizeMB"; Expression={[math]::Round($_.Length/1MB, 2)}}
```

### Step 7: Deploy to Azure App Service

Deploy the ZIP file using the modern `az webapp deploy` command:

```powershell
$appName = "TDX-MCP"
$resourceGroup = "TDX_MCP"
$zipPath = "deploy/azure-app-service/tdx-mcp-deploy.zip"

# Deploy the application
# Oryx will automatically run: npm ci --production && npm run build
az webapp deploy --resource-group $resourceGroup --name $appName `
  --src-path $zipPath --type zip --async false

Write-Host "Deployment complete. Oryx automatically ran npm ci and npm run build."
Write-Host "App Service should be starting now..."
```

### Step 8: Verify Deployment

Test the application endpoints:

```powershell
$appName = "TDX-MCP"
$resourceGroup = "TDX_MCP"

# Get the app hostname
$hostname = az webapp show --resource-group $resourceGroup --name $appName `
  --query defaultHostName --output tsv

$baseUrl = "https://$hostname"

# Test health endpoint
Write-Host "Testing /health endpoint..."
$health = curl -s "$baseUrl/health" | ConvertFrom-Json
$health

# Test /tools endpoint (should respect ALLOW_MODIFICATIONS=false)
Write-Host "`nTesting /tools endpoint..."
$tools = curl -s "$baseUrl/tools" | ConvertFrom-Json
Write-Host "Number of tools registered: $($tools.tools.Count)"
# Should show 21 tools (read-only only) since ALLOW_MODIFICATIONS=false
```

### Optional: Configure Rate Limiting

Rate limiting is **enabled by default** with values matching TDX's API limits. Customize if needed:

```powershell
az webapp config appsettings set --resource-group $resourceGroup --name $appName `
  --settings `
    "TDX_RATE_LIMIT_ENABLED=true" `
    "TDX_RATE_LIMIT_CALLS=60" `
    "TDX_RATE_LIMIT_WINDOW_MS=60000" `
    "TDX_RATE_LIMIT_BURST_CAPACITY_MULTIPLIER=1.5" `
    "TDX_RATE_LIMIT_QUEUE_TIMEOUT_MS=300000"
```

## Monitoring & Troubleshooting

### View Application Logs

```powershell
$appName = "TDX-MCP"
$resourceGroup = "TDX_MCP"

# Stream real-time logs from App Service (tail last 50 lines)
az webapp log tail --resource-group $resourceGroup --name $appName --lines 50

# View deployment logs
az webapp deployment log show --resource-group $resourceGroup --name $appName
```

### Test Endpoints

```powershell
$appName = "TDX-MCP"
$resourceGroup = "TDX_MCP"

$hostname = az webapp show --resource-group $resourceGroup --name $appName `
  --query defaultHostName --output tsv

$baseUrl = "https://$hostname"

# Health check
curl "$baseUrl/health"

# List available tools (should be 21 since ALLOW_MODIFICATIONS=false)
curl "$baseUrl/tools"

# Call a read-only tool (example: search tickets)
curl -X POST "$baseUrl/mcp" `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"tdx-ticket-search","arguments":{"maxResults":5}}}'
```

### Check App Service Configuration

```powershell
$appName = "TDX-MCP"
$resourceGroup = "TDX_MCP"

# View all app settings
az webapp config appsettings list --resource-group $resourceGroup --name $appName

# Check startup command
az webapp config show --resource-group $resourceGroup --name $appName `
  --query "appCommandLine" --output tsv

# View Key Vault secret references
az webapp config appsettings list --resource-group $resourceGroup --name $appName `
  | Select-Object -ExpandProperty appSettings `
  | Where-Object { $_.name -match "TDX_|MCP_API_KEY" } `
  | Format-Table name, value
```

### Verify Key Vault Access

```powershell
$appName = "TDX-MCP"
$resourceGroup = "TDX_MCP"
$keyVaultName = "tdx-mcp-kv"

# Get App Service Managed Identity
$principalId = az webapp identity show --resource-group $resourceGroup --name $appName `
  --query principalId --output tsv

Write-Host "App Service Principal ID: $principalId"

# Check Key Vault access policies
az keyvault show --name $keyVaultName `
  --query "properties.accessPolicies[] | [?objectId=='$principalId'].permissions"

# Verify secrets exist in Key Vault
az keyvault secret list --vault-name $keyVaultName
```

### Common Issues & Solutions

#### Application Won't Start (Check Logs)

```powershell
# Tail logs immediately after restarting
az webapp restart --resource-group $resourceGroup --name $appName
Start-Sleep -Seconds 5
az webapp log tail --resource-group $resourceGroup --name $appName --lines 100
```

**Common error messages:**
- `require is not defined` → Oryx auto-generated start.js (FIX: Verify explicit startup command is set)
- `Cannot find module` → npm ci didn't run (FIX: Verify SCM_DO_BUILD_DURING_DEPLOYMENT=true)
- `Key Vault reference not resolved` → Managed Identity permission issue (FIX: Verify Key Vault access policy)
- `ECONNREFUSED` on TDX API → TDX credentials invalid or network unreachable

#### Slow Deployment or Startup

**Problem**: Deployment takes >3 minutes or app takes >1 minute to start
**Causes**: 
1. npm ci running on every startup (should only run once at deploy time)
2. MCP subprocess initializing (creates child processes, may take 10-30s first time)

**Solution**:
- Verify `SCM_DO_BUILD_DURING_DEPLOYMENT=true`
- Verify startup command is just `node /home/site/wwwroot/dist/http-wrapper.js` (NOT with npm ci)
- Check logs for MCP subprocess initialization: `[MCP Child] Spawning subprocess...`

#### /tools Endpoint Returns Wrong Count

**Problem**: Returns 43 tools when ALLOW_MODIFICATIONS=false (should be 21)

**Cause**: /tools endpoint is hardcoded instead of dynamic
**Verify Fix**: Check src/http-wrapper.ts lines 501-530 have the dynamic endpoint implementation

**Solution**:
1. Rebuild locally: `npm run build`
2. Recreate ZIP: `Compress-Archive -Path dist,package.json,package-lock.json -DestinationPath deploy/azure-app-service/tdx-mcp-deploy.zip`
3. Redeploy: `az webapp deploy --resource-group TDX_MCP --name TDX-MCP --src-path deploy/azure-app-service/tdx-mcp-deploy.zip --type zip`

#### Key Vault References Not Resolving

**Problem**: Environment variables show `@Microsoft.KeyVault(...)` instead of actual values

**Cause**: Managed Identity doesn't have permissions or Key Vault reference syntax is wrong

**Solution**:
```powershell
# 1. Verify Managed Identity has permissions
$principalId = az webapp identity show --resource-group $resourceGroup --name $appName --query principalId --output tsv
az keyvault set-policy --name $keyVaultName --object-id $principalId --secret-permissions get list

# 2. Restart app service to reload references
az webapp restart --resource-group $resourceGroup --name $appName
```

## Deployment Checklist

Before deploying, verify:

- [ ] `npm run build` completes without errors
- [ ] `dist/` folder contains compiled files (http-wrapper.js, index.js, tools/)
- [ ] `deploy/azure-app-service/tdx-mcp-deploy.zip` is < 500 KB (NOT > 8 MB)
- [ ] Secrets exist in Key Vault (TDX_BASE_URL, TDX_BEID, etc.)
- [ ] Managed Identity has Key Vault secret read permissions
- [ ] Startup command is: `node /home/site/wwwroot/dist/http-wrapper.js`
- [ ] `SCM_DO_BUILD_DURING_DEPLOYMENT=true`
- [ ] `ALLOW_MODIFICATIONS=false` (for read-only tools only)

## Deployment Success Indicators

After deployment, you should see:

1. **Azure Portal**: App Service status = "Running" (green)
2. **Health endpoint**: `curl https://.../health` returns `{"status":"ok"}`
3. **Tools endpoint**: `curl https://.../tools` returns array with 21 tools
4. **Logs**: No error messages, clean startup sequence
5. **Response time**: /health responds in < 100ms, /tools in < 500ms

## Rollback Procedure

If deployment goes wrong, revert to previous version:

```powershell
# List recent deployments
az webapp deployment list --resource-group $resourceGroup --name $appName --query "[].{id:id, created:deploymentTime}"

# Deploy previous ZIP (backup location)
az webapp deploy --resource-group $resourceGroup --name $appName `
  --src-path deploy/azure-app-service/tdx-mcp-deploy-backup.zip --type zip
```

