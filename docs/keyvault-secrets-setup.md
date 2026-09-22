# Creating Secrets in Azure Key Vault

This guide shows multiple ways to create the required secrets for the TDX MCP Connector in Azure Key Vault.

## Required Secrets

| Secret Name | Description |
|---|---|
| `TdxBaseUrl` | TeamDynamix API base URL |
| `TdxBeid` | Business Entity ID |
| `TdxWebServicesKey` | API authentication key for TeamDynamix |
| `TdxAppId` | Main application ID (Tickets) |
| `TdxAssetsAppId` | Assets/CMDB application ID |
| `TdxKbAppId` | Knowledge Base application ID |
| `McpApiKey` | API key for MCP Server access |

## Method 1: PowerShell Script (Recommended)

Run the interactive script that will prompt you for all values:

```powershell
cd .\deploy\azure-app-service

# Interactive mode
.\create-keyvault-secrets.ps1 `
    -KeyVaultName "TDX-MCP-Vault" `
    -ResourceGroupName "TDX-MCP"

# Automated mode (from secrets.json)
.\create-keyvault-secrets.ps1 `
    -KeyVaultName "TDX-MCP-Vault" `
    -ResourceGroupName "TDX-MCP" `
    -Mode Automated `
    -SecretsFile ".\secrets.json" `
    -Force

# Verify secrets created
.\create-keyvault-secrets.ps1 `
    -KeyVaultName "TDX-MCP-Vault" `
    -ResourceGroupName "TDX-MCP" `
    -VerifyOnly
```

**Note:** When prompted for `McpApiKey`, provide your API key value. You can generate a UUID-format key if needed:
```powershell
[guid]::NewGuid().ToString()
```

## Method 2: Azure CLI Commands

Create each secret individually using the Azure CLI:

```bash
# Set your Key Vault name
export KEYVAULT_NAME="TDX-MCP-Vault"

# Create required secrets
az keyvault secret set \
    --vault-name $KEYVAULT_NAME \
    --name "TdxBaseUrl" \
    --value "https://api.teamdynamix.com"

az keyvault secret set \
    --vault-name $KEYVAULT_NAME \
    --name "TdxBeid" \
    --value "your-beid-value"

az keyvault secret set \
    --vault-name $KEYVAULT_NAME \
    --name "TdxWebServicesKey" \
    --value "your-api-key"

az keyvault secret set \
    --vault-name $KEYVAULT_NAME \
    --name "TdxAppId" \
    --value "115"

az keyvault secret set \
    --vault-name $KEYVAULT_NAME \
    --name "TdxAssetsAppId" \
    --value "116"

az keyvault secret set \
    --vault-name $KEYVAULT_NAME \
    --name "TdxKbAppId" \
    --value "114"

az keyvault secret set \
    --vault-name $KEYVAULT_NAME \
    --name "McpApiKey" \
    --value "your-mcp-api-key"
```

### PowerShell with Azure CLI

```powershell
$KeyVaultName = "TDX-MCP-Vault"

az keyvault secret set --vault-name $KeyVaultName --name "TdxBaseUrl" --value "https://api.teamdynamix.com"
az keyvault secret set --vault-name $KeyVaultName --name "TdxBeid" --value "your-beid-value"
az keyvault secret set --vault-name $KeyVaultName --name "TdxWebServicesKey" --value "your-api-key"
az keyvault secret set --vault-name $KeyVaultName --name "TdxAppId" --value "115"
az keyvault secret set --vault-name $KeyVaultName --name "TdxAssetsAppId" --value "116"
az keyvault secret set --vault-name $KeyVaultName --name "TdxKbAppId" --value "114"
az keyvault secret set --vault-name $KeyVaultName --name "McpApiKey" --value "your-mcp-api-key"
```

## Method 3: Azure Portal

1. Navigate to your Key Vault in the [Azure Portal](https://portal.azure.com)
2. Click **Secrets** in the left menu
3. Click **+ Generate/Import** at the top
4. For each secret:
   - **Name**: Enter the secret name (e.g., `TdxBaseUrl`)
   - **Value**: Enter the secret value
   - Click **Create**
5. Repeat for all 7 required secrets

## Method 4: Using PowerShell Az Module Directly

```powershell
$KeyVaultName = "TDX-MCP-Vault"
$ResourceGroupName = "TDX-MCP"

# Login if needed
Connect-AzAccount

# Create secrets using PowerShell Az cmdlets
$baseUrl = ConvertTo-SecureString -String "https://api.teamdynamix.com" -AsPlainText -Force
Set-AzKeyVaultSecret -VaultName $KeyVaultName -Name "TdxBaseUrl" -SecretValue $baseUrl

$beid = ConvertTo-SecureString -String "your-beid-value" -AsPlainText -Force
Set-AzKeyVaultSecret -VaultName $KeyVaultName -Name "TdxBeid" -SecretValue $beid

$apiKey = ConvertTo-SecureString -String "your-api-key" -AsPlainText -Force
Set-AzKeyVaultSecret -VaultName $KeyVaultName -Name "TdxWebServicesKey" -SecretValue $apiKey

$appId = ConvertTo-SecureString -String "115" -AsPlainText -Force
Set-AzKeyVaultSecret -VaultName $KeyVaultName -Name "TdxAppId" -SecretValue $appId

$assetsAppId = ConvertTo-SecureString -String "116" -AsPlainText -Force
Set-AzKeyVaultSecret -VaultName $KeyVaultName -Name "TdxAssetsAppId" -SecretValue $assetsAppId

$kbAppId = ConvertTo-SecureString -String "114" -AsPlainText -Force
Set-AzKeyVaultSecret -VaultName $KeyVaultName -Name "TdxKbAppId" -SecretValue $kbAppId

$mcpKey = ConvertTo-SecureString -String "your-mcp-api-key" -AsPlainText -Force
Set-AzKeyVaultSecret -VaultName $KeyVaultName -Name "McpApiKey" -SecretValue $mcpKey
```

## Verify Secrets Were Created

After creating the secrets, verify they exist:

```bash
# List all secrets
az keyvault secret list --vault-name TDX-MCP-Vault --query "[].name" -o table

# Get a specific secret (value will be hidden for security)
az keyvault secret show --vault-name TDX-MCP-Vault --name TdxBaseUrl
```

## For Local Development

If running locally, set environment variables:

```bash
# .env file
TDX_BASE_URL=https://api.teamdynamix.com
TDX_BEID=your-beid-value
TDX_WEB_SERVICES_KEY=your-api-key
TDX_APP_ID=115
TDX_ASSETS_APP_ID=116
TDX_KB_APP_ID=114
MCP_API_KEY=your-mcp-api-key
```

The application will use Key Vault when deployed to Azure, otherwise it will use environment variables locally.

## Troubleshooting

### "Access denied" when accessing secrets
- Verify the App Service's managed identity has "Key Vault Secrets User" role on the Key Vault
- Check that the Key Vault's firewall settings allow access (if restricted)

### "Secret not found"
- Ensure the secret name matches exactly
- Verify the secret exists: `az keyvault secret list --vault-name TDX-MCP-Vault`

### PowerShell script says "Secret not found"
- Make sure you ran the create script before the deployment script
- Verify all 7 required secrets are present: `.\create-keyvault-secrets.ps1 -VerifyOnly`

## Understanding the McpApiKey

The `McpApiKey` is an access token that controls who can call your MCP Server. It serves as a simple API authentication mechanism.

### How it works:
1. When the MCP Server receives a request, it validates the `x-mcp-api-key` header
2. The key is stored securely in Azure Key Vault
3. Clients must include the key in their requests to access the server

### Generating an McpApiKey:
You can generate a UUID-format API key in PowerShell:
```powershell
[guid]::NewGuid().ToString()
```

### For users accessing your MCP Server:
Users need to include the API key in their requests. Example with curl:
```bash
curl -H "x-mcp-api-key: YOUR_MCP_API_KEY" https://tdx-mcp-app.azurewebsites.us/tools
```

### Rotating the McpApiKey:
If you need to rotate or regenerate the API key:
1. Generate a new key: `[guid]::NewGuid().ToString()`
2. Update in Key Vault: `az keyvault secret set --vault-name TDX-MCP-Vault --name McpApiKey --value "new-key"`
3. Restart App Service: `az webapp restart --resource-group TDX-MCP --name TDX-MCP-APP`
4. Distribute the new key to all users
