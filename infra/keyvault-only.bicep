metadata description = 'Azure Key Vault for TDX MCP Connector credentials'

param location string = resourceGroup().location

@secure()
param tdxBeid string

@secure()
param tdxWebServicesKey string

@secure()
param tdxBaseUrl string

@secure()
@description('TDX Default App ID (Tickets)')
param tdxAppId string = ''

@secure()
@description('TDX Assets App ID')
param tdxAssetsAppId string = ''

@secure()
@description('TDX Knowledge Base App ID')
param tdxKbAppId string = ''

@description('Unique deployment identifier to avoid Key Vault name conflicts')
param deploymentId string = substring(uniqueString(utcNow('u')), 0, 8)

// Generate unique suffix for Key Vault name
var uniqueSuffix = deploymentId
var keyVaultName = 'kv-tdx-mcp-${uniqueSuffix}'

// Key Vault for secure credential storage
resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: keyVaultName
  location: location
  properties: {
    enabledForDeployment: true
    enabledForTemplateDeployment: true
    enabledForDiskEncryption: false
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: []
  }
}

// Key Vault Secret - TDX BEID
resource tdxBeidSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'TdxBeid'
  properties: {
    value: tdxBeid
  }
}

// Key Vault Secret - TDX Web Services Key
resource tdxWebServicesKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'TdxWebServicesKey'
  properties: {
    value: tdxWebServicesKey
  }
}

// Key Vault Secret - TDX Base URL
resource tdxBaseUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'TdxBaseUrl'
  properties: {
    value: tdxBaseUrl
  }
}

// Key Vault Secret - TDX App ID (Tickets)
resource tdxAppIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = if (tdxAppId != '') {
  parent: keyVault
  name: 'TdxAppId'
  properties: {
    value: tdxAppId
  }
}

// Key Vault Secret - TDX Assets App ID
resource tdxAssetsAppIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = if (tdxAssetsAppId != '') {
  parent: keyVault
  name: 'TdxAssetsAppId'
  properties: {
    value: tdxAssetsAppId
  }
}

// Key Vault Secret - TDX Knowledge Base App ID
resource tdxKbAppIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = if (tdxKbAppId != '') {
  parent: keyVault
  name: 'TdxKbAppId'
  properties: {
    value: tdxKbAppId
  }
}

output keyVaultName string = keyVault.name
output keyVaultUrl string = keyVault.properties.vaultUri
output tdxBeidSecretUrl string = '${keyVault.properties.vaultUri}secrets/TdxBeid'
output tdxWebServicesKeySecretUrl string = '${keyVault.properties.vaultUri}secrets/TdxWebServicesKey'
output tdxBaseUrlSecretUrl string = '${keyVault.properties.vaultUri}secrets/TdxBaseUrl'
output tdxAppIdSecretUrl string = tdxAppId != '' ? '${keyVault.properties.vaultUri}secrets/TdxAppId' : ''
output tdxAssetsAppIdSecretUrl string = tdxAssetsAppId != '' ? '${keyVault.properties.vaultUri}secrets/TdxAssetsAppId' : ''
output tdxKbAppIdSecretUrl string = tdxKbAppId != '' ? '${keyVault.properties.vaultUri}secrets/TdxKbAppId' : ''
