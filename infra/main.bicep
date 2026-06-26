metadata description = 'Azure Container Apps deployment for TDX MCP Connector with public access and API key authentication'

param location string = resourceGroup().location
param environment string = 'dev'
param containerImage string = ''
param containerPort int = 3000
param apiKey string = newGuid()
@secure()
param tdxApiKey string
@secure()
param tdxApiUrl string

// Generate unique suffix for resource names
var uniqueSuffix = substring(uniqueString(resourceGroup().id), 0, 6)
var containerRegistryName = 'cr${environment}${uniqueSuffix}'
var containerAppEnvironmentName = 'cae-${environment}-${uniqueSuffix}'
var containerAppName = 'tdx-mcp-${environment}-${uniqueSuffix}'
var logAnalyticsName = 'la-${environment}-${uniqueSuffix}'

// Log Analytics Workspace
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2021-12-01-preview' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Container App Environment
resource containerAppEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppEnvironmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
  }
}

// Container App with public ingress and authentication
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: containerPort
        transport: 'auto'
        allowInsecure: false
      }
      dapr: {
        enabled: false
      }
      secrets: [
        {
          name: 'api-key'
          value: apiKey
        }
        {
          name: 'tdx-api-key'
          value: tdxApiKey
        }
        {
          name: 'tdx-api-url'
          value: tdxApiUrl
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'tdx-mcp-server'
          image: containerImage != '' ? containerImage : 'mcr.microsoft.com/azuredocs/containerapp-hello:latest'
          resources: {
            cpu: '0.5'
            memory: '1Gi'
          }
          env: [
            {
              name: 'PORT'
              value: string(containerPort)
            }
            {
              name: 'API_KEY'
              secretRef: 'api-key'
            }
            {
              name: 'TDX_API_KEY'
              secretRef: 'tdx-api-key'
            }
            {
              name: 'TDX_API_URL'
              secretRef: 'tdx-api-url'
            }
            {
              name: 'NODE_ENV'
              value: environment
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 5
        rules: [
          {
            name: 'http-requests'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}

output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output containerAppName string = containerApp.name
output apiKey string = apiKey
output containerAppId string = containerApp.id
