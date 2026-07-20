# Azure App Service Deployment Guide - TDX MCP Connector

This guide walks through deploying the TDX MCP Connector to Azure App Service using Azure Developer CLI (azd).

## Prerequisites

### 1. Install Required Tools
- **Azure CLI**: https://aka.ms/azure-cli
- **Node.js 20+**: https://nodejs.org
- **Azure Developer CLI (azd)**: https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd

Verify installations:
```bash
az --version
node --version
azd --version
npm --version
```

### 2. Azure Subscription Requirements
- **Subscription ID**: `b0c08d7e-0820-4b4f-bc4b-2d2b5f6ad085`
- **Region**: `eastus`
- **Role Required**: Contributor or Owner on the subscription
- **Resource Group**: Will create `rg-mcp-dev` during provisioning

### 3. TDX API Credentials
Obtain these values from your TDX Administrator:
- `TDX_BASE_URL` - TeamDynamix API endpoint (e.g., `https://service.pascocountyfl.net/TDWebApi/api`)
- `TDX_BEID` - Business Entity ID
- `TDX_WEB_SERVICES_KEY` - Web Services API Key
- `TDX_APP_ID` - Default Application ID (Tickets)
- `TDX_ASSETS_APP_ID` - Assets/CMDB Application ID (optional)
- `TDX_KB_APP_ID` - Knowledge Base Application ID (optional)

## Deployment Steps

### Step 1: Prepare Local Environment

```bash
# Navigate to project directory
cd c:\_repos\PascoBOCC-IT-DBA\PascoBOCC_TDX_MCP_Connector

# Install dependencies
npm install

# Build TypeScript
npm run build

# Verify build succeeds (should create dist/ folder)
ls dist/
```

### Step 2: Authenticate with Azure

```bash
# Login to Azure
azd auth login

# Select subscription (if prompted)
az account set --subscription "b0c08d7e-0820-4b4f-bc4b-2d2b5f6ad085"
```

### Step 3: Create AZD Environment

```bash
# Initialize AZD environment
azd env new

# When prompted for environment name, use: mcp-dev
# Region: eastus
```

### Step 4: Configure Secrets

Create a `.env` file in the project root (DO NOT COMMIT to git):

```bash
# .env (local only, never commit)
TDX_BASE_URL="https://service.pascocountyfl.net/TDWebApi/api"
TDX_BEID="<your-beid>"
TDX_WEB_SERVICES_KEY="<your-web-services-key>"
TDX_APP_ID="<your-tickets-app-id>"
TDX_ASSETS_APP_ID="<your-assets-app-id>"
TDX_KB_APP_ID="<your-kb-app-id>"
```

Then set environment variables for AZD:
```bash
azd env set TDX_BASE_URL "https://service.pascocountyfl.net/TDWebApi/api"
azd env set TDX_BEID "<your-beid>"
azd env set TDX_WEB_SERVICES_KEY "<your-web-services-key>"
azd env set TDX_APP_ID "<your-tickets-app-id>"
azd env set TDX_ASSETS_APP_ID "<your-assets-app-id>"
azd env set TDX_KB_APP_ID "<your-kb-app-id>"
```

### Step 5: Preview Deployment (Recommended)

```bash
# Preview what will be created (no actual provisioning)
azd provision --preview

# Review the what-if analysis output
```

### Step 6: Provision Azure Resources

```bash
# Create Azure resources (App Service Plan, App Service, Key Vault)
azd provision

# This will:
# - Create resource group: rg-mcp-dev
# - Create App Service Plan (B2 Linux)
# - Create App Service (pasco-tdx-mcp)
# - Create Key Vault with credentials
# - Grant App Service Managed Identity access to Key Vault
```

### Step 7: Deploy Application

```bash
# Deploy application code to App Service
azd deploy

# This will:
# - Build the application
# - Package as deployment artifact
# - Deploy to App Service
# - Start the application
```

### Step 8: Verify Deployment

```bash
# Get deployment information
azd env show

# Test the application endpoint
$url = az webapp show --resource-group rg-mcp-dev --name pasco-tdx-mcp --query defaultHostName --output tsv
curl "https://$url/mcp"
```

## Monitoring & Troubleshooting

### View Application Logs

```bash
# Stream real-time logs from App Service
az webapp log tail --resource-group rg-mcp-dev --name pasco-tdx-mcp

# View deployment logs
az webapp deployment log show --resource-group rg-mcp-dev --name pasco-tdx-mcp
```

### Check App Service Status

```bash
# View App Service properties
az webapp show --resource-group rg-mcp-dev --name pasco-tdx-mcp

# List app configuration settings
az webapp config appsettings list --resource-group rg-mcp-dev --name pasco-tdx-mcp
```

### Verify Key Vault Secrets

```bash
# List secrets in Key Vault
az keyvault secret list --resource-group rg-mcp-dev --vault-name <keyvault-name>

# Get Key Vault name
$kvName = az resource list --resource-group rg-mcp-dev --resource-type "Microsoft.KeyVault/vaults" --query "[0].name" --output tsv
echo $kvName
```

### Common Issues

#### Application Won't Start
```bash
# Check application logs
az webapp log tail --resource-group rg-mcp-dev --name pasco-tdx-mcp --lines 100

# Verify environment variables are set
az webapp config appsettings list --resource-group rg-mcp-dev --name pasco-tdx-mcp

# Restart App Service
az webapp restart --resource-group rg-mcp-dev --name pasco-tdx-mcp
```

#### Key Vault Access Issues
```bash
# Verify Managed Identity has Key Vault access
$principalId = az webapp identity show --resource-group rg-mcp-dev --name pasco-tdx-mcp --query principalId --output tsv

# List Key Vault access policies
az keyvault show --resource-group rg-mcp-dev --name <keyvault-name>

# Check if principal has secret permissions
az keyvault secret list --resource-group rg-mcp-dev --vault-name <keyvault-name>
```

## Scaling & Performance

### Change App Service Plan

```bash
# Upgrade to Standard plan (better performance)
az appservice plan update --resource-group rg-mcp-dev --name asp-tdx-mcp --sku S1

# View available SKUs
az appservice list-locations --query "[0].availableLinuxSkus[]" --output table
```

### Enable Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --resource-group rg-mcp-dev \
  --application-type web \
  --kind web \
  --app tdx-mcp-insights

# Link to App Service (requires manual configuration in Azure Portal)
```

## Cleanup

### Delete All Resources

```bash
# Delete entire resource group (removes all resources)
az group delete --resource-group rg-mcp-dev

# Or use AZD cleanup
azd down
```

## Support

For issues or questions:
- Review application logs: `az webapp log tail --resource-group rg-mcp-dev --name pasco-tdx-mcp`
- Check Azure Portal: https://portal.azure.com
- Review Bicep templates: `infra/main.bicep`, `infra/app-service.bicep`, `infra/keyvault-only.bicep`

