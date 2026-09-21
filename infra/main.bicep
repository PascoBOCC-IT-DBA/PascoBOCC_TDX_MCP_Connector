// Main infrastructure template for TDX MCP Connector on Azure App Service
// Orchestrates Key Vault and App Service deployment

targetScope = 'resourceGroup'

metadata description = 'Main infrastructure orchestration for TDX MCP Connector'

@minLength(1)
@maxLength(64)
@description('Name of the Azure environment for resource naming')
param environmentName string

@description('Azure region for resource deployment')
param location string = resourceGroup().location

@description('App Service name')
param appServiceName string = 'pasco-tdx-mcp'

@description('App Service Plan name')
param appServicePlanName string = 'asp-tdx-mcp'

@allowed([
  'Commercial'
  'GCC'
])
@description('Azure cloud environment (Commercial or GCC)')
param cloud string = 'Commercial'

// TDX Configuration Parameters (marked as secure)
@secure()
@description('TDX Base URL (e.g., https://org.teamdynamix.com/TDWebApi/api)')
param tdxBaseUrl string

@secure()
@description('TDX Business Entity ID (BEID)')
param tdxBeid string

@secure()
@description('TDX Web Services API Key')
param tdxWebServicesKey string

@secure()
@description('TDX Default App ID (Tickets)')
param tdxAppId string

@secure()
@description('TDX Assets App ID')
param tdxAssetsAppId string = ''

@secure()
@description('TDX Knowledge Base App ID')
param tdxKbAppId string = ''

@description('Unique deployment identifier to avoid Key Vault name conflicts')
param deploymentId string = substring(uniqueString(utcNow('u')), 0, 8)

// Deploy Key Vault
module keyVaultModule './keyvault-only.bicep' = {
  name: 'keyVaultDeployment'
  params: {
    location: location
    deploymentId: deploymentId
    tdxBeid: tdxBeid
    tdxWebServicesKey: tdxWebServicesKey
    tdxBaseUrl: tdxBaseUrl
    tdxAppId: tdxAppId
    tdxAssetsAppId: tdxAssetsAppId
    tdxKbAppId: tdxKbAppId
  }
}

// Deploy App Service (referencing Key Vault module outputs)
module appServiceModule './app-service.bicep' = {
  name: 'appServiceDeployment'
  params: {
    location: location
    environment: environmentName
    appServiceName: appServiceName
    appServicePlanName: appServicePlanName
    cloud: cloud
    keyVaultName: keyVaultModule.outputs.keyVaultName
  }
}

// Output critical resource information
output appServiceUrl string = appServiceModule.outputs.appServiceUrl
output appServiceName string = appServiceModule.outputs.appServiceName
output appServiceId string = appServiceModule.outputs.appServiceId
output keyVaultName string = keyVaultModule.outputs.keyVaultName
output keyVaultUrl string = keyVaultModule.outputs.keyVaultUrl
output managedIdentityPrincipalId string = appServiceModule.outputs.managedIdentityPrincipalId
