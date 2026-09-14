# TDX MCP Connector - Azure Deployment Guide

This guide covers deploying the TDX MCP Connector to **Azure App Service in GCC** (Azure Government Cloud).

---

## 📋 Prerequisites

### Required Tools
- **Azure CLI 2.50+** - https://aka.ms/azure-cli
- **PowerShell 5.1+** or **PowerShell 7+** - https://github.com/PowerShell/PowerShell
- **Node.js 20+** - https://nodejs.org

Verify installations:
```powershell
az --version              # Should be 2.50+
pwsh --version            # or powershell --version
node --version            # Should be 20.x or higher
npm --version
```

### Azure Requirements
- **Azure Subscription** in GCC (Azure Government Cloud)
- **Service Principal** with Contributor role (for automated deployment)
- **Resource Group** created in GCC (e.g., `TDX-MCP`)
- **App Service Plan** created in GCC (e.g., `ASP-TDXMCP`)
- **Key Vault** created in GCC (e.g., `TDX-MCP-Vault`)

### TDX Credentials
Obtain from your TDX Administrator:
- `TdxBaseUrl` - API endpoint
- `TdxBeid` - Business Entity ID
- `TdxWebServicesKey` - Web Services API Key
- `TdxAppId` - Tickets application ID
- `TdxAssetsAppId` - Assets/CMDB application ID
- `TdxKbAppId` - Knowledge Base application ID
- `McpApiKey` - MCP server access key (generate a secure random string)

---

## 🚀 Deployment Workflow

### Phase 1: Create Secrets in Key Vault

Secrets must exist in Key Vault **before** deploying the application.

**Step 1: Prepare secrets file**

```powershell
# Copy the example template
cd .\deploy\azure-app-service
Copy-Item secrets.example.json secrets.json

# Edit secrets.json with your actual values
notepad secrets.json
```

**secrets.json structure:**
```json
{
  "TdxBaseUrl": "https://api.teamdynamix.com",
  "TdxBeid": "your-beid-value",
  "TdxWebServicesKey": "your-api-key",
  "TdxAppId": "115",
  "TdxAssetsAppId": "116",
  "TdxKbAppId": "114",
  "McpApiKey": "your-mcp-api-key"
}
```

**Step 2: Create Key Vault secrets**

Run the interactive script or use automated mode:

**Interactive mode** (prompts for each secret):
```powershell
.\create-keyvault-secrets.ps1 `
    -KeyVaultName "TDX-MCP-Vault" `
    -ResourceGroupName "TDX-MCP"
```

**Automated mode** (from secrets.json):
```powershell
.\create-keyvault-secrets.ps1 `
    -KeyVaultName "TDX-MCP-Vault" `
    -ResourceGroupName "TDX-MCP" `
    -Mode Automated `
    -SecretsFile ".\secrets.json" `
    -Force
```

**Verify secrets created:**
```powershell
.\create-keyvault-secrets.ps1 `
    -KeyVaultName "TDX-MCP-Vault" `
    -ResourceGroupName "TDX-MCP" `
    -VerifyOnly
```

---

### Phase 2: Deploy Application

**Prerequisites for deployment script:**
- Azure CLI authenticated with service principal
- Secrets already created in Key Vault
- App Service and App Service Plan already exist in Azure

**Step 1: Obtain service principal credentials**

You need:
- `ClientId` - Service Principal Client ID
- `ClientSecret` - Service Principal Client Secret
- `TenantId` - GCC Tenant ID
- `SubscriptionId` - GCC Subscription ID

**Step 2: Deploy to App Service**

```powershell
# Navigate to deploy folder
cd .\deploy\azure-app-service

# Run deployment script
.\deploy-gcc-with-sp.ps1 `
    -ClientId "<your-client-id>" `
    -ClientSecret "<your-client-secret>" `
    -TenantId "<your-tenant-id>" `
    -SubscriptionId "<your-subscription-id>" `
    -ResourceGroup "TDX-MCP" `
    -AppName "TDX-MCP-APP" `
    -KeyVaultName "TDX-MCP-Vault"
```

**What the deployment script does:**
1. ✅ Authenticates with service principal to GCC
2. ✅ Builds TypeScript (`npm run build`)
3. ✅ Creates deployment ZIP package
4. ✅ Deploys to Azure App Service
5. ✅ Verifies secrets exist in Key Vault
6. ✅ Grants App Service managed identity access to Key Vault
7. ✅ Configures App Service environment settings
8. ✅ Restarts App Service
9. ✅ Verifies health endpoint

**Step 3: Verify deployment**

```powershell
# Check App Service status
az webapp show --resource-group TDX-MCP --name TDX-MCP-APP --query "state"

# View recent logs
az webapp log tail --resource-group TDX-MCP --name TDX-MCP-APP

# Test health endpoint
# Note: .azurewebsites.us may be blocked by firewall; use Kudu or ARM API instead
```

---

## 🔍 Verification Checklist

After deployment, verify:

- [ ] App Service status is "Running"
- [ ] Health endpoint responds (via Kudu console)
- [ ] Application logs show no errors
- [ ] All 7 secrets present in Key Vault
- [ ] App Service managed identity has Key Vault access
- [ ] MCP tools endpoint returns tool list
- [ ] API key authentication is enforced

### Test the API

```powershell
# Via Kudu console or from inside the network:
$url = "https://tdx-mcp-app.azurewebsites.us/tools"
$headers = @{ "x-mcp-api-key" = "your-mcp-api-key" }
Invoke-WebRequest -Uri $url -Headers $headers
```

---

## 🔧 Troubleshooting

### Deployment script fails at secret verification

**Error:** `Missing required secrets in Key Vault`

**Solution:**
1. Verify secrets exist: `.\create-keyvault-secrets.ps1 -KeyVaultName "..." -VerifyOnly`
2. Create missing secrets: `.\create-keyvault-secrets.ps1 -KeyVaultName "..." -Mode Automated -SecretsFile ".\secrets.json" -Force`

### App Service can't access Key Vault

**Error:** App logs show `Access denied to Key Vault`

**Solution:**
1. Verify App Service managed identity has Key Vault access:
   ```powershell
   az keyvault set-policy --name TDX-MCP-Vault `
       --object-id <app-service-principal-id> `
       --secret-permissions get list
   ```

### Deployment package size too large

**Error:** `Request content was too large`

**Solution:**
- Ensure `node_modules/` is NOT in the deployment ZIP
- The deployment script handles this automatically
- Oryx will run `npm install` at deploy time on Azure

### Service principal authentication fails

**Error:** `AADSTS700277` or similar auth error

**Solution:**
1. Verify service principal is in the GCC tenant
2. Verify service principal has Contributor role on subscription
3. Verify credentials are correct:
   ```powershell
   az login --service-principal -u <client-id> -p "<client-secret>" --tenant <tenant-id>
   ```

### Can't access azurewebsites.us endpoint

**Issue:** `.azurewebsites.us` is blocked by corporate firewall/OpenDNS

**Solutions:**
- Use **Kudu console** to access logs and run commands
- Access via **Azure Portal** → App Service
- Create private endpoint if on corporate network
- Test from inside allowed network

---

## 📁 File Structure

```
docs/
├── DEPLOYMENT.md                   # Comprehensive deployment guide (this file)
├── KEYVAULT_SECRETS_SETUP.md       # Detailed Key Vault setup guide
├── API_REFERENCE.md
└── TOOLS_REFERENCE.md

deploy/azure-app-service/
├── create-keyvault-secrets.ps1    # Create/manage secrets in Key Vault
├── deploy-gcc-with-sp.ps1         # Deploy to App Service with Service Principal
├── secrets.json                    # Your actual secrets (⚠️ gitignored)
└── secrets.example.json            # Template (safe to commit)
```

---

## ⚙️ Manual Azure CLI Commands

If you prefer manual deployment instead of scripts:

```powershell
# 1. Authenticate
az cloud set --name AzureUSGovernment
az login --service-principal -u <client-id> -p "<client-secret>" --tenant <tenant-id>
az account set --subscription <subscription-id>

# 2. Create secrets in Key Vault
az keyvault secret set --vault-name TDX-MCP-Vault --name TdxBaseUrl --value "<url>"
az keyvault secret set --vault-name TDX-MCP-Vault --name TdxBeid --value "<beid>"
# ... repeat for all 7 secrets

# 3. Grant App Service access to Key Vault
$appServicePrincipalId = az webapp identity show --resource-group TDX-MCP --name TDX-MCP-APP --query "principalId" -o tsv
az keyvault set-policy --vault-name TDX-MCP-Vault --object-id $appServicePrincipalId --secret-permissions get list

# 4. Build and deploy
cd path/to/repo
npm run build
$zipPath = ".\tdx-mcp-deploy.zip"
Compress-Archive -Path .\dist, .\package.json, .\package-lock.json -DestinationPath $zipPath
az webapp deploy --resource-group TDX-MCP --name TDX-MCP-APP --src-path $zipPath --type zip

# 5. Restart
az webapp restart --resource-group TDX-MCP --name TDX-MCP-APP
```

---

## 📚 Additional Documentation

- [Key Vault Secrets Setup](./KEYVAULT_SECRETS_SETUP.md)
- [API Reference](./API_REFERENCE.md)
- [Tools Reference](./TOOLS_REFERENCE.md)

---

## ❓ Support

For issues:
1. Check [Troubleshooting](#troubleshooting) section above
2. Review application logs in Azure Portal
3. Run deployment script with `-Verbose` flag for detailed output
4. Check deployment script comments for step-by-step details
