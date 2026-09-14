# Creating Secrets in Azure Key Vault

This guide shows multiple ways to create the required secrets for the TDX MCP Connector in Azure Key Vault.

## Required Secrets

| Secret Name | Description | Example |
|---|---|---|
| `TdxBaseUrl` | TeamDynamix API base URL | `https://api.teamdynamix.com` |
| `TdxBeid` | Business Entity ID | `12345` |
| `TdxWebServicesKey` | API authentication key for TeamDynamix | Your API key |
| `TdxAppId` | Main application ID | `1` |
| `McpApiKey` | API key for MCP Server access (auto-generated) | UUID format |
| `TdxAssetsAppId` | Assets app ID (optional) | `2` |
| `TdxKbAppId` | Knowledge base app ID (optional) | `3` |

## Method 1: PowerShell Script (Recommended)

Run the interactive script that will prompt you for all values:

```powershell
./scripts/create-keyvault-secrets.ps1 `
    -KeyVaultName "your-keyvault-name" `
    -ResourceGroupName "your-resource-group"
```

**Note:** When prompted for `McpApiKey`, provide your API key value. You can generate a UUID-format key if needed:
```powershell
[guid]::NewGuid().ToString()
```

## Method 2: Azure CLI Commands

Create each secret individually using the Azure CLI:

```bash
# Set your Key Vault name
export KEYVAULT_NAME="your-keyvault-name"

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
    --value "your-app-id"

# Optional secrets
az keyvault secret set \
    --vault-name $KEYVAULT_NAME \
    --name "TdxAssetsAppId" \
    --value "your-assets-app-id"

az keyvault secret set \
    --vault-name $KEYVAULT_NAME \
    --name "TdxKbAppId" \
    --value "your-kb-app-id"
```

### PowerShell with Azure CLI

```powershell
$KeyVaultName = "your-keyvault-name"

az keyvault secret set --vault-name $KeyVaultName --name "TdxBaseUrl" --value "https://api.teamdynamix.com"
az keyvault secret set --vault-name $KeyVaultName --name "TdxBeid" --value "your-beid-value"
az keyvault secret set --vault-name $KeyVaultName --name "TdxWebServicesKey" --value "your-api-key"
az keyvault secret set --vault-name $KeyVaultName --name "TdxAppId" --value "your-app-id"
```

## Method 3: Azure Portal

1. Navigate to your Key Vault in the [Azure Portal](https://portal.azure.com)
2. Click **Secrets** in the left menu
3. Click **+ Generate/Import** at the top
4. For each secret:
   - **Name**: Enter the secret name (e.g., `TdxBaseUrl`)
   - **Value**: Enter the secret value
   - Click **Create**
5. Repeat for all required secrets

## Method 4: Using PowerShell Az Module Directly

```powershell
$KeyVaultName = "your-keyvault-name"
$ResourceGroupName = "your-resource-group"

# Login if needed
Connect-AzAccount

# Create secrets using PowerShell Az cmdlets
$baseUrl = ConvertTo-SecureString -String "https://api.teamdynamix.com" -AsPlainText -Force
Set-AzKeyVaultSecret -VaultName $KeyVaultName -Name "TdxBaseUrl" -SecretValue $baseUrl

$beid = ConvertTo-SecureString -String "your-beid-value" -AsPlainText -Force
Set-AzKeyVaultSecret -VaultName $KeyVaultName -Name "TdxBeid" -SecretValue $beid

$apiKey = ConvertTo-SecureString -String "your-api-key" -AsPlainText -Force
Set-AzKeyVaultSecret -VaultName $KeyVaultName -Name "TdxWebServicesKey" -SecretValue $apiKey

$appId = ConvertTo-SecureString -String "your-app-id" -AsPlainText -Force
Set-AzKeyVaultSecret -VaultName $KeyVaultName -Name "TdxAppId" -SecretValue $appId
```

## Verify Secrets Were Created

After creating the secrets, verify they exist:

```bash
# List all secrets
az keyvault secret list --vault-name your-keyvault-name --query "[].name" -o table

# Get a specific secret (value will be hidden for security)
az keyvault secret show --vault-name your-keyvault-name --name TdxBaseUrl
```

## Configure App Service

After creating the secrets in Key Vault, configure your App Service:

1. Go to your App Service in the Azure Portal
2. Navigate to **Configuration** → **Application settings**
3. Add a new application setting:
   - **Name**: `KEYVAULT_URL`
   - **Value**: `https://your-keyvault-name.vault.azure.net/`
   - Click **OK** and **Save**

4. Ensure your App Service's managed identity has access to the Key Vault:
   - Go to your Key Vault → **Access Control (IAM)**
   - Click **+ Add** → **Add role assignment**
   - Select role: **Key Vault Secrets User**
   - Select the App Service's managed identity
   - Click **Review + assign**

## For Local Development

If running locally, set environment variables:

```bash
# .env file
TDX_BASE_URL=https://api.teamdynamix.com
TDX_BEID=your-beid-value
TDX_WEB_SERVICES_KEY=your-api-key
TDX_APP_ID=your-app-id
TDX_ASSETS_APP_ID=your-assets-app-id  # optional
TDX_KB_APP_ID=your-kb-app-id           # optional
```

The application will use Key Vault when `KEYVAULT_URL` is set, otherwise it will fall back to environment variables.

## Troubleshooting

### "Access denied" when accessing secrets
- Verify the App Service's managed identity has "Key Vault Secrets User" role on the Key Vault
- Check that the Key Vault's firewall settings allow access (if restricted)

### "Secret not found"
- Ensure the secret name matches exactly (case-sensitive for some scenarios)
- Verify the secret exists: `az keyvault secret list --vault-name your-keyvault-name`

### Local development showing "KEYVAULT_URL not set"
- This is normal and expected - the app falls back to environment variables
- Set environment variables in your `.env` file or terminal session

## Understanding the McpApiKey

The `McpApiKey` is an access token that controls who can call your MCP Server. It serves as a simple API authentication mechanism.

### How it works:
1. When the MCP Server receives a request, it validates the `McpApiKey` header
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
curl -H "Authorization: Bearer YOUR_MCP_API_KEY" https://your-mcp-server.azurewebsites.net/
```

### Rotating the McpApiKey:
If you need to rotate or regenerate the API key:
1. Generate a new key: `[guid]::NewGuid().ToString()`
2. Run the script again: `./deploy/azure-app-service/create-keyvault-secrets.ps1`
3. Use `-Force` flag to overwrite the existing key
4. Distribute the new key to all users

### Environment variable for local development:
```bash
MCP_API_KEY=your-api-key-value
```
