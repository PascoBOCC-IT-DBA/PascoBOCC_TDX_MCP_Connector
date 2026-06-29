metadata description = 'Azure Container Apps deployment for TDX MCP Connector with public access and API key authentication'

param location string = resourceGroup().location
param environment string = 'dev'
param containerImage string = ''
param containerPort int = 3000
param apiKey string = newGuid()
@secure()
param tdxBaseUrl string
@secure()
param tdxBeid string
@secure()
param tdxWebServicesKey string
param tdxAppId string = '115'
param tdxAssetsAppId string = '116'
param tdxKbAppId string = '114'
@secure()
param registryUsername string = ''
@secure()
param registryPassword string = ''

// Generate unique suffix for resource names
var uniqueSuffix = substring(uniqueString(resourceGroup().id), 0, 6)
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
      registries: registryUsername != '' ? [
        {
          server: substring(containerImage, 0, indexOf(containerImage, '/'))
          username: registryUsername
          passwordSecretRef: 'registry-password'
        }
      ] : []
      secrets: concat([
        {
          name: 'api-key'
          value: apiKey
        }
        {
          name: 'tdx-base-url'
          value: tdxBaseUrl
        }
        {
          name: 'tdx-beid'
          value: tdxBeid
        }
        {
          name: 'tdx-web-services-key'
          value: tdxWebServicesKey
        }
      ], registryUsername != '' ? [
        {
          name: 'registry-username'
          value: registryUsername
        }
        {
          name: 'registry-password'
          value: registryPassword
        }
      ] : [])
    }
    template: {
      containers: [
        {
          name: 'tdx-mcp-server'
          image: containerImage != '' ? containerImage : 'mcr.microsoft.com/azuredocs/containerapp-hello:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: environment
            }
            {
              name: 'MCP_API_KEY'
              secretRef: 'api-key'
            }
            {
              name: 'TDX_BASE_URL'
              secretRef: 'tdx-base-url'
            }
            {
              name: 'TDX_BEID'
              secretRef: 'tdx-beid'
            }
            {
              name: 'TDX_WEB_SERVICES_KEY'
              secretRef: 'tdx-web-services-key'
            }
            {
              name: 'TDX_APP_ID'
              value: tdxAppId
            }
            {
              name: 'TDX_ASSETS_APP_ID'
              value: tdxAssetsAppId
            }
            {
              name: 'TDX_KB_APP_ID'
              value: tdxKbAppId
            }
            {
              name: 'MCP_HTTP_PORT'
              value: string(containerPort)
            }
            {
              name: 'ALLOW_MODIFICATIONS'
              value: 'false'
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
