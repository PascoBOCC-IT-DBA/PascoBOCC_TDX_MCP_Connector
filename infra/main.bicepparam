using './main.bicep'

// Azure Environment Name (used for resource naming and tagging)
param environmentName = 'dev'

// Azure Region
param location = 'eastus'

// Azure Cloud Environment
// Set to 'GCC' for Government Community Cloud deployment
// Set to 'Commercial' for commercial Azure cloud (default)
param cloud = 'Commercial'

// App Service Configuration
param appServiceName = 'pasco-tdx-mcp'
param appServicePlanName = 'asp-tdx-mcp'

// TDX API Configuration
// ⚠️ IMPORTANT: These values should come from:
// 1. Azure Key Vault (recommended for production)
// 2. Azure App Configuration
// 3. Environment variables set during deployment
// 4. Local .env file (development only, NEVER commit to git)

// Example values (REPLACE WITH YOUR ACTUAL CREDENTIALS):
// - tdxBaseUrl: 'https://service.pascocountyfl.net/TDWebApi/api'
// - tdxBeid: '<your-beid>'
// - tdxWebServicesKey: '<your-api-key>'
// - tdxAppId: '<ticket-app-id>'
// - tdxAssetsAppId: '<assets-app-id>'
// - tdxKbAppId: '<kb-app-id>'

// NOTE: During 'azd provision', you will be prompted to provide these values
// OR set them in your local .env file or AZD environment

param tdxBaseUrl = ''
param tdxBeid = ''
param tdxWebServicesKey = ''
param tdxAppId = ''
param tdxAssetsAppId = ''
param tdxKbAppId = ''

// Unique deployment ID (auto-generated from timestamp if not provided)
param deploymentId = ''
