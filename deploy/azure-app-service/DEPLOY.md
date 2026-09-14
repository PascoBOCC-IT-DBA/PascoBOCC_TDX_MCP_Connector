# Azure App Service Deployment Guide

**Current Date:** 2026-08-06  
**Status:** ✅ Running and operational

---

## 📋 Current Deployment Information

### Azure Environment (AzureUSGovernment - GCC)

```
Cloud:                  AzureUSGovernment
Subscription ID:        <your-subscription-id>
Tenant ID:              <your-tenant-id>
Service Principal:      <your-service-principal-client-id>
ARM Endpoint:           https://management.usgovcloudapi.net/
```

### Active App Service (GCC)

```
Resource Group:         TDX-MCP (usgovvirginia)
App Service Name:       TDX-MCP-APP
App Service Plan:       ASP-TDXMCP-8c0e (Premium0V3)
Runtime:                Node.js 24-lts (linux)
Startup Command:        node dist/http-wrapper.js
Public URL:             https://tdx-mcp-app.azurewebsites.us
```

⚠️ **WARNING:** `azurewebsites.us` blocked by OpenDNS on user network. Access via Kudu or ARM API instead.

### Key Vault

```
Name:                   TDX-MCP-Vault
Endpoint:               https://tdx-mcp-vault.vault.usgovcloudapi.net/
Managed Identity:       System-assigned (ObjectId: <your-managed-identity-object-id>)
Access Mode:            Access Policies (NOT RBAC)
```

### App Settings (15 configured)

| Setting | Value |
|---------|-------|
| WEBSITES_PORT | 3000 |
| SCM_DO_BUILD_DURING_DEPLOYMENT | false |
| WEBSITE_NODE_DEFAULT_VERSION | 24-lts |
| NODE_ENV | production |
| ALLOW_MODIFICATIONS | false |
| MCP_API_KEY | `<loaded from Key Vault>` |
| TDX_BASE_URL | `<loaded from Key Vault>` |
| TDX_BEID | `<loaded from Key Vault>` |
| TDX_WEB_SERVICES_KEY | `<loaded from Key Vault>` |
| TDX_APP_ID | `<loaded from Key Vault>` |
| TDX_ASSETS_APP_ID | `<loaded from Key Vault>` |
| TDX_KB_APP_ID | `<loaded from Key Vault>` |
| TDX_RATE_LIMIT_ENABLED | true |
| TDX_RATE_LIMIT_CALLS | 60 |
| TDX_RATE_LIMIT_WINDOW_MS | 60000 |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /status | Server info |
| GET | /tools | List available tools (21 read-only) |
| POST | /mcp | JSON-RPC MCP requests |

### Authentication

```
API Key:                <loaded from Key Vault>
Header:                 x-mcp-api-key: <your-api-key>
Initialize Unauthenticated: DISABLED
```

### Deployment Status ✅

```
Status:                 Running and operational
Last Deployment:        2026-08-03 13:54:46 UTC
App State:              Running
Environment Variables:  ✅ Verified injected correctly
MCP Tools:             ✅ All 21 read-only tools registered
HTTP Wrapper:           ✅ Listening on port 8080
```

---

## 🚀 Quick Deploy

From the repository root, run:

```powershell
# Commercial Azure (default)
.\deploy\azure-app-service\deploy.ps1

# GCC endpoint
.\deploy\azure-app-service\deploy.ps1 -Cloud GCC
```

This script will:
1. ✅ Build TypeScript (`npm run build`)
2. ✅ Create deployment ZIP (dist/, package.json, package-lock.json)
3. ✅ Deploy to Azure App Service (TDX-MCP-APP)
4. ✅ Verify health endpoint

---

## 📖 Usage

### Basic deployment (Commercial Azure)
```powershell
.\deploy\azure-app-service\deploy.ps1
```

### Deploy to GCC endpoint
```powershell
.\deploy\azure-app-service\deploy.ps1 -Cloud GCC
```

### Deploy asynchronously (return immediately)
```powershell
.\deploy\azure-app-service\deploy.ps1 -Cloud GCC -Async $true
```

### Deploy to different resource group/app
```powershell
.\deploy\azure-app-service\deploy.ps1 -ResourceGroup "MY_RG" -AppName "MY_APP" -Cloud GCC
```

### Parameters

- **ResourceGroup** (default: `TDX_MCP`) — Azure resource group name
- **AppName** (default: `TDX-MCP-APP`) — Azure App Service name
- **Async** (default: `$false`) — Deploy asynchronously without waiting
- **Cloud** (default: `Commercial`) — Azure cloud: `Commercial` or `GCC`

---

## 📋 Prerequisites

- PowerShell 5.1 or later
- Node.js and npm installed
- Azure CLI (`az`) installed and authenticated
- Repository cloned locally

---

## ⚙️ GCC Configuration

If deploying to GCC endpoints (`.azurewebsites.us`):

1. **Authenticate to GCC Azure:**
   ```powershell
   az cloud set --name AzureUSGovernment
   az login --service-principal -u <your-client-id> -p "<your-client-secret>" --tenant <your-tenant-id>
   az account set --subscription <your-subscription-id>
   ```

2. **Deploy with GCC flag:**
   ```powershell
   .\deploy\azure-app-service\deploy-gcc-with-sp.ps1 `
     -ClientId "<your-client-id>" `
     -ClientSecret "<your-client-secret>" `
     -TenantId "<your-tenant-id>" `
     -SubscriptionId "<your-subscription-id>" `
     -ResourceGroup "TDX-MCP" `
     -AppName "TDX-MCP-APP" `
     -KeyVaultName "TDX-MCP-Vault"
   ```

3. **Switch back to Commercial Azure (if needed):**
   ```powershell
   az cloud set --name AzureCloud
   ```

**Note:** Your application registration and tenant must be configured for GCC. Cross-cloud federation (mixing Commercial and GCC) is not supported and will result in AADSTS700277 errors.

---

## 📦 Deployment Package

The ZIP contains:
- `dist/` — Compiled JavaScript
- `package.json` — Dependencies manifest
- `package-lock.json` — Locked versions

**NOT included:** `node_modules/` (Oryx handles npm install at deploy time)

---

## 🔧 Troubleshooting

### Build fails
```powershell
npm run build  # Run manually to see error details
```

### Azure CLI not authenticated
```powershell
az login  # Authenticate to Azure
```

### Deployment hangs
Press `Ctrl+C` to cancel. Try with `-Async $true` to skip waiting.

### Health check fails
The app may still be starting. Check logs with:
```powershell
az webapp log tail --resource-group TDX-MCP --name TDX-MCP-APP
```

### View app logs
```powershell
az webapp log download --name TDX-MCP-APP --resource-group TDX-MCP --log-file ./logs.zip
Expand-Archive ./logs.zip ./logs
```

---

## 🔗 Links

- **GCC App URL:** https://tdx-mcp-app.azurewebsites.us
- **Kudu URL:** https://tdx-mcp-app.scm.azurewebsites.us
- **Endpoints:**
  - `/health` — Health check
  - `/tools` — List MCP tools
  - `/status` — Server info
  - `/mcp` — MCP JSON-RPC endpoint

---

## ⚠️ Critical Constraints

### 🚫 DO NOT CREATE NEW AZURE RESOURCES
- Only 3 existing GCC resources allowed (App Service, App Service Plan, Key Vault)
- Verify resource exists BEFORE any operation

### 📁 DEPLOYMENT FILES IN deploy/ FOLDER
- Never create ZIP in root directory
- Keep all deployment artifacts in `deploy/`

### Windows Only - Use PowerShell
- NO Linux/Bash commands
- Use PowerShell cmdlets (Compress-Archive, Copy-Item, etc.)

---

## ✅ Root Cause Fix (2026-08-03)

**Issue:** App was using wrong startup entry point (MCP stdio only, not HTTP wrapper)

**Fix:** Set appCommandLine to `node dist/http-wrapper.js`

**Result:**
- ✅ Environment variables now injected correctly
- ✅ App running and responding to requests
- ✅ All 21 read-only tools registered and available
