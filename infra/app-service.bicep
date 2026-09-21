// App Service Infrastructure for TDX MCP Connector
// Provisions: App Service Plan, App Service with Managed Identity, and Key Vault configuration

metadata description = 'Azure App Service for TDX MCP Connector'

param location string = resourceGroup().location
param environment string = 'dev'
param appServiceName string = 'pasco-tdx-mcp'
param appServicePlanName string = 'asp-tdx-mcp'

// Cloud parameters
@allowed([
  'Commercial'
  'GCC'
])
param cloud string = 'Commercial'

// Key Vault parameters
param keyVaultName string = ''

// Determine Key Vault domain based on cloud
var keyVaultDomain = cloud == 'GCC' ? 'vault.usgovcloudapi.net' : 'vault.azure.net'

// Create App Service Plan (Linux, Node.js)
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  kind: 'Linux'
  sku: {
    name: 'B2'
    tier: 'Basic'
    // Must stay 1: the TDX rate limiter and per-key quota hold their counters in process
    // memory, so each extra instance multiplies the calls sent to TDX's 100/60s budget.
    capacity: 1
  }
  properties: {
    reserved: true // Required for Linux
  }
}

// Create App Service
resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: appServiceName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      http20Enabled: true
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      // Node.js startup command
      appCommandLine: 'npm run start'
      // Application settings - Sensitive values fetched from Key Vault at runtime
      appSettings: [
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'PORT'
          value: '3000'
        }
        {
          name: 'NODE_ENV'
          value: environment
        }
        // Key Vault Configuration - App uses Managed Identity to fetch secrets programmatically
        {
          name: 'KEYVAULT_URL'
          value: keyVaultName != '' ? 'https://${keyVaultName}.${keyVaultDomain}/' : ''
        }
      ]
    }
    httpsOnly: true
  }
}

// Grant App Service Managed Identity access to Key Vault
// The app fetches TDX credentials programmatically at runtime using DefaultAzureCredential
resource keyVaultAccessPolicy 'Microsoft.KeyVault/vaults/accessPolicies@2023-02-01' = if (keyVaultName != '') {
  name: '${keyVaultName}/add'
  properties: {
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: appService.identity.principalId
        permissions: {
          secrets: ['get', 'list']
        }
      }
    ]
  }
}

// Configure continuous deployment from Git if needed
resource webAppSourceControl 'Microsoft.Web/sites/sourcecontrols@2023-12-01' = {
  parent: appService
  name: 'web'
  properties: {
    repoUrl: ''
    branch: 'main'
    isManualIntegration: true
  }
}

output appServiceName string = appService.name
output appServiceId string = appService.id
output appServiceDefaultHostName string = appService.properties.defaultHostName
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output managedIdentityPrincipalId string = appService.identity.principalId
