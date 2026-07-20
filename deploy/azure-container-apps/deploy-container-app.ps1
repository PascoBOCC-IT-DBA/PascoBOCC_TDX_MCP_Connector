# Azure Container Apps Deployment Script
# Deploys TDX MCP Connector to Azure Container Apps

param(
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup = "TDX_MCP",
    
    [Parameter(Mandatory=$true)]
    [string]$Location = "eastus2",
    
    [string]$ContainerAppName = "tdx-mcp-app",
    [string]$ContainerAppEnvName = "tdx-mcp-env",
    [string]$AcrName = "tdxmcpacr",
    [string]$ImageName = "tdx-mcp-connector",
    [string]$ImageTag = "latest",
    [string]$ManagedIdentityId = ""
)

# Error handling
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [$Level] $Message"
}

# Verify resource group exists
Write-Log "Verifying resource group '$ResourceGroup' exists in subscription '$SubscriptionId'..."
$rg = az group list --query "[?name=='$ResourceGroup']" --output json | ConvertFrom-Json
if (-not $rg -or $rg.Count -eq 0) {
    Write-Log "ERROR: Resource group '$ResourceGroup' not found in subscription '$SubscriptionId'" "ERROR"
    exit 1
}
Write-Log "Resource group verified: $($rg[0].id)"

# Set subscription context
Write-Log "Setting Azure subscription to '$SubscriptionId'..."
az account set --subscription $SubscriptionId

# Check if ACR exists, create if needed
Write-Log "Checking Azure Container Registry '$AcrName'..."
$acrCheck = az acr show --resource-group $ResourceGroup --name $AcrName --query "id" --output tsv 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Log "Creating Azure Container Registry '$AcrName'..."
    az acr create `
        --resource-group $ResourceGroup `
        --name $AcrName `
        --sku Basic `
        --admin-enabled true
    Write-Log "ACR created successfully"
} else {
    Write-Log "ACR already exists: $acrCheck"
}

# Get ACR login credentials
Write-Log "Getting ACR login credentials..."
$acrLoginServer = az acr show --resource-group $ResourceGroup --name $AcrName --query "loginServer" --output tsv
$acrUsername = az acr credential show --resource-group $ResourceGroup --name $AcrName --query "username" --output tsv
$acrPassword = az acr credential show --resource-group $ResourceGroup --name $AcrName --query "passwords[0].value" --output tsv

Write-Log "ACR Login Server: $acrLoginServer"

# Build Docker image
Write-Log "Building Docker image '${ImageName}:${ImageTag}'..."
$imagePath = "$acrLoginServer/${ImageName}:${ImageTag}"
$dockerfilePath = Join-Path $PSScriptRoot "Dockerfile"
docker build -t $imagePath -f $dockerfilePath ../../
if ($LASTEXITCODE -ne 0) {
    Write-Log "Docker build failed" "ERROR"
    exit 1
}
Write-Log "Docker image built successfully"

# Push to ACR
Write-Log "Pushing image to ACR..."
docker login -u $acrUsername -p $acrPassword $acrLoginServer
docker push $imagePath
if ($LASTEXITCODE -ne 0) {
    Write-Log "Docker push failed" "ERROR"
    exit 1
}
Write-Log "Image pushed to ACR successfully"

# Get Managed Identity
Write-Log "Getting Managed Identity..."
if (-not [string]::IsNullOrEmpty($ManagedIdentityId)) {
    Write-Log "Using provided Managed Identity: $ManagedIdentityId"
} else {
    # Try to find managed identity in resource group
    $ManagedIdentityId = az identity list --resource-group $ResourceGroup --query "[0].principalId" --output tsv
    if (-not $ManagedIdentityId) {
        Write-Log "ERROR: No managed identity provided and none found in resource group" "ERROR"
        Write-Log "Pass -ManagedIdentityId parameter or create a managed identity in $ResourceGroup" "ERROR"
        exit 1
    }
}
Write-Log "Managed Identity Principal ID: $ManagedIdentityId"

# Get Key Vault name
Write-Log "Getting Key Vault..."
$keyVaultName = az keyvault list --resource-group $ResourceGroup --query "[0].name" --output tsv
if (-not $keyVaultName) {
    Write-Log "ERROR: No Key Vault found in resource group" "ERROR"
    exit 1
}
Write-Log "Key Vault: $keyVaultName"

# Grant managed identity access to Key Vault
Write-Log "Granting managed identity access to Key Vault..."
az role assignment create `
    --role "Key Vault Secrets User" `
    --assignee $ManagedIdentityId `
    --scope "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.KeyVault/vaults/$keyVaultName" `
    --output none 2>&1 | Out-Null

# Check if Container Apps Environment exists, create if needed
Write-Log "Checking Container Apps Environment '$ContainerAppEnvName'..."
$envCheck = az containerapp env show --resource-group $ResourceGroup --name $ContainerAppEnvName --query "id" --output tsv 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Log "Creating Container Apps Environment '$ContainerAppEnvName'..."
    az containerapp env create `
        --resource-group $ResourceGroup `
        --name $ContainerAppEnvName `
        --location $Location
    Write-Log "Container Apps Environment created"
} else {
    Write-Log "Environment already exists: $envCheck"
}

# Create or update Container App
Write-Log "Creating/updating Container App '$ContainerAppName'..."
$keyvaultId = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.KeyVault/vaults/$keyVaultName"

# Build secrets from Key Vault (referenced in env vars)
Write-Log "Configuring Key Vault secret references..."

$containerAppConfig = @{
    name = $ContainerAppName
    resourceGroup = $ResourceGroup
    environment = $ContainerAppEnvName
    image = $imagePath
    registry = @{
        server = $acrLoginServer
        username = $acrUsername
        passwordSecureReference = "acr-password"
    }
    registryPassword = $acrPassword
    env = @(
        @{ name = "PORT"; value = "3000" },
        @{ name = "WEBSITES_PORT"; value = "3000" },
        @{ name = "NODE_ENV"; value = "production" },
        @{ name = "ALLOW_MODIFICATIONS"; value = "false" },
        @{ name = "TDX_BASE_URL"; secretRef = "tdx-base-url" },
        @{ name = "TDX_BEID"; secretRef = "tdx-beid" },
        @{ name = "TDX_WEB_SERVICES_KEY"; secretRef = "tdx-web-services-key" },
        @{ name = "TDX_APP_ID"; secretRef = "tdx-app-id" },
        @{ name = "TDX_ASSETS_APP_ID"; secretRef = "tdx-assets-app-id" },
        @{ name = "TDX_KB_APP_ID"; secretRef = "tdx-kb-app-id" },
        @{ name = "MCP_API_KEY"; secretRef = "mcp-api-key" }
    )
    cpu = "0.5"
    memory = "1Gi"
    minReplicas = 0
    maxReplicas = 10
    healthProbe = @{
        type = "HTTP"
        httpGet = @{
            path = "/health"
            port = 3000
        }
        initialDelaySeconds = 10
        periodSeconds = 10
        failureThreshold = 3
    }
}

# Use Azure CLI directly for container app creation
Write-Log "Deploying to Azure Container Apps..."

$yamlConfig = @"
location: $Location
name: $ContainerAppName
properties:
  environmentId: /subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.App/managedEnvironments/$ContainerAppEnvName
  template:
    containers:
    - name: tdx-mcp
      image: $imagePath
      resources:
        cpu: '0.5'
        memory: 1Gi
      ports:
      - containerPort: 3000
        name: http
      env:
      - name: PORT
        value: '3000'
      - name: WEBSITES_PORT
        value: '3000'
      - name: NODE_ENV
        value: production
      - name: ALLOW_MODIFICATIONS
        value: 'false'
      - name: TDX_BASE_URL
        secretRef: tdx-base-url
      - name: TDX_BEID
        secretRef: tdx-beid
      - name: TDX_WEB_SERVICES_KEY
        secretRef: tdx-web-services-key
      - name: TDX_APP_ID
        secretRef: tdx-app-id
      - name: TDX_ASSETS_APP_ID
        secretRef: tdx-assets-app-id
      - name: TDX_KB_APP_ID
        secretRef: tdx-kb-app-id
      - name: MCP_API_KEY
        secretRef: mcp-api-key
    scale:
      minReplicas: 0
      maxReplicas: 10
      rules:
      - name: http-scaling
        http:
          metadata:
            concurrentRequests: '100'
    ingress:
      external: true
      targetPort: 3000
      traffic:
      - label: latest
        latestRevision: true
        weight: 100
  registries:
  - passwordSecretRef: acr-password
    server: $acrLoginServer
    username: $acrUsername
  secrets:
  - name: acr-password
    value: $acrPassword
  - name: tdx-base-url
    keyVaultUrl: https://${keyVaultName}.vault.azure.net/secrets/tdx-base-url
    identity: /subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.ManagedIdentity/userAssignedIdentities/
  - name: tdx-beid
    keyVaultUrl: https://${keyVaultName}.vault.azure.net/secrets/tdx-beid
    identity: /subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.ManagedIdentity/userAssignedIdentities/
  - name: tdx-web-services-key
    keyVaultUrl: https://${keyVaultName}.vault.azure.net/secrets/tdx-web-services-key
    identity: /subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.ManagedIdentity/userAssignedIdentities/
  - name: tdx-app-id
    keyVaultUrl: https://${keyVaultName}.vault.azure.net/secrets/tdx-app-id
    identity: /subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.ManagedIdentity/userAssignedIdentities/
  - name: tdx-assets-app-id
    keyVaultUrl: https://${keyVaultName}.vault.azure.net/secrets/tdx-assets-app-id
    identity: /subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.ManagedIdentity/userAssignedIdentities/
  - name: tdx-kb-app-id
    keyVaultUrl: https://${keyVaultName}.vault.azure.net/secrets/tdx-kb-app-id
    identity: /subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.ManagedIdentity/userAssignedIdentities/
  - name: mcp-api-key
    keyVaultUrl: https://${keyVaultName}.vault.azure.net/secrets/mcp-api-key
    identity: /subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.ManagedIdentity/userAssignedIdentities/
"@

# Save YAML and deploy
$yamlPath = Join-Path $PSScriptRoot "container-app-deploy.yaml"
Set-Content -Path $yamlPath -Value $yamlConfig -Encoding UTF8

# Deploy using YAML
Write-Log "Deploying to Azure Container Apps using YAML configuration..."
az containerapp create --resource-group $ResourceGroup --name $ContainerAppName --yaml $yamlPath --output none
if ($LASTEXITCODE -ne 0) {
    Write-Log "ERROR: Container App creation failed" "ERROR"
    exit 1
}

# Get the FQDN
Write-Log "Retrieving Container App URL..."
$appUrl = az containerapp show --resource-group $ResourceGroup --name $ContainerAppName --query "properties.configuration.ingress.fqdn" --output tsv 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Log "Container App deployed successfully"
    Write-Log "Access URL: https://$appUrl"
    Write-Log ""
    Write-Log "Next steps:"
    Write-Log "1. Wait 2-3 minutes for container to start"
    Write-Log "2. Test health endpoint: curl https://$appUrl/health"
    Write-Log "3. Verify tools: curl https://$appUrl/tools"
    Write-Log "4. Update client applications with new URL"
    Write-Log "5. When confirmed working, delete old App Service:"
    Write-Log "   az webapp delete --resource-group TDX_MCP --name TDX-MCP"
} else {
    Write-Log "ERROR: Failed to retrieve Container App URL" "ERROR"
    exit 1
}

Write-Log "Deployment script completed successfully"
