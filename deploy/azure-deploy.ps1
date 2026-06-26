#!/usr/bin/env pwsh

<#
.SYNOPSIS
    One-command Azure deployment for TDX MCP Container App

.DESCRIPTION
    Automates the complete Azure deployment process including:
    - Azure authentication
    - Resource group creation
    - Docker image build and push
    - Container registry setup
    - Bicep deployment
#>

param(
    [string]$EnvironmentName = "dev",
    [string]$Location = "eastus"
)

# Color codes
$ErrorColor = "Red"
$SuccessColor = "Green"
$InfoColor = "Cyan"
$WarningColor = "Yellow"

function Write-Header {
    param([string]$Message)
    Write-Host "`n`n========================================" -ForegroundColor $InfoColor
    Write-Host $Message -ForegroundColor $InfoColor
    Write-Host "========================================`n" -ForegroundColor $InfoColor
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor $SuccessColor
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor $ErrorColor
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor $InfoColor
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor $WarningColor
}

function Exit-WithError {
    param([string]$Message)
    Write-ErrorMsg $Message
    exit 1
}

# =======================
# STEP 1: Check Prerequisites
# =======================
Write-Header "Step 1: Checking Prerequisites"

# Check Azure CLI
Write-Info "Checking Azure CLI..."
$azPath = Get-Command az -ErrorAction SilentlyContinue
if (-not $azPath) {
    Exit-WithError "Azure CLI not found. Please install from: https://docs.microsoft.com/cli/azure/install-azure-cli"
}
Write-Success "Azure CLI found"

# Check Docker
Write-Info "Checking Docker..."
$dockerPath = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerPath) {
    Exit-WithError "Docker not found. Please install from: https://www.docker.com/products/docker-desktop"
}
Write-Success "Docker found"

# Check .env file
Write-Info "Checking .env configuration..."
if (-not (Test-Path ".env")) {
    Exit-WithError ".env file not found in current directory"
}
Write-Success ".env file found"

# =======================
# STEP 2: Load Configuration
# =======================
Write-Header "Step 2: Loading Configuration from .env"

$envContent = Get-Content ".env" -Raw
$envVars = @{}

foreach ($line in $envContent -split "`n") {
    $line = $line.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line -like "*=*") {
        $parts = $line -split "=", 2
        $envVars[$parts[0].Trim()] = $parts[1].Trim()
    }
}

# Validate required variables
$requiredVars = @(
    "TDX_BASE_URL",
    "TDX_BEID",
    "TDX_WEB_SERVICES_KEY",
    "TDX_APP_ID",
    "TDX_ASSETS_APP_ID",
    "TDX_KB_APP_ID"
)

$missingVars = @()
foreach ($var in $requiredVars) {
    if (-not $envVars.ContainsKey($var) -or -not $envVars[$var]) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Exit-WithError "Missing environment variables: $($missingVars -join ', ')"
}

Write-Success "All TDX credentials configured"
Write-Info "TDX URL: $($envVars['TDX_BASE_URL'])"

# =======================
# STEP 3: Azure Authentication
# =======================
Write-Header "Step 3: Azure Authentication"

Write-Info "Checking Azure CLI login status..."
$currentAccount = az account show 2>$null | ConvertFrom-Json

if (-not $currentAccount) {
    Write-Info "You need to log in to Azure..."
    Write-Info "Opening browser for authentication (check for popup)..."
    az login --use-device-code
    
    $currentAccount = az account show 2>$null | ConvertFrom-Json
    
    if (-not $currentAccount) {
        Exit-WithError "Failed to authenticate with Azure"
    }
}

Write-Success "Authenticated as: $($currentAccount.user.name)"
Write-Success "Subscription: $($currentAccount.name)"

$subscriptionId = $currentAccount.id

# =======================
# STEP 4: Set Up Resource Names
# =======================
Write-Header "Step 4: Configuring Resource Names"

$timestamp = Get-Date -Format "yyyyMMddHHmm"
$resourceGroupName = "rg-tdx-mcp-$EnvironmentName-$timestamp"
$registryName = "crctdxmcp$EnvironmentName$(Get-Random -Minimum 1000 -Maximum 9999)"
$containerAppName = "tdx-mcp-$EnvironmentName"
$containerAppEnvName = "cae-$EnvironmentName"
$logAnalyticsName = "la-tdx-mcp-$EnvironmentName"

Write-Info "Resource Group: $resourceGroupName"
Write-Info "Container Registry: $registryName"
Write-Info "Container App: $containerAppName"
Write-Info "Location: $Location"

# =======================
# STEP 5: Create or Reuse Resource Group
# =======================
Write-Header "Step 5: Setting up Resource Group"

Write-Info "Checking resource group: $resourceGroupName..."
$rgExists = az group exists --name $resourceGroupName

if ($rgExists -eq "true") {
    Write-Success "Resource group already exists: $resourceGroupName"
} else {
    Write-Info "Creating new resource group: $resourceGroupName..."
    $rgResult = az group create `
        --name $resourceGroupName `
        --location $Location `
        --query "id" -o tsv

    if (-not $rgResult) {
        Exit-WithError "Failed to create resource group"
    }
    Write-Success "Resource group created: $resourceGroupName"
}

# =======================
# STEP 5.5: Clean up Failed Container Registries
# =======================
Write-Header "Step 5.5: Cleaning Up Failed Registries"

Write-Info "Checking for failed container registries..."
$failedRegistries = az acr list --resource-group $resourceGroupName --output json 2>$null | ConvertFrom-Json

if ($failedRegistries -and $failedRegistries.Count -gt 0) {
    Write-Warning "Found $($failedRegistries.Count) existing registry/registries. Cleaning up..."
    
    foreach ($registry in $failedRegistries) {
        Write-Info "Deleting registry: $($registry.name)..."
        az acr delete --resource-group $resourceGroupName --name $registry.name --yes
        Write-Success "Deleted: $($registry.name)"
    }
} else {
    Write-Success "No failed registries to clean up"
}

# =======================
# STEP 7: Build Docker Image
# =======================
Write-Header "Step 7: Building Docker Image"

Write-Info "Building Docker image (this may take 2-5 minutes)..."
docker build -t tdx-mcp:latest .

if ($LASTEXITCODE -ne 0) {
    Exit-WithError "Docker build failed"
}

Write-Success "Docker image built successfully"

# =======================
# STEP 7: Create Container Registry
# =======================
Write-Header "Step 7: Creating Azure Container Registry"

Write-Info "Creating container registry: $registryName..."
$acrResult = az acr create `
    --resource-group $resourceGroupName `
    --name $registryName `
    --sku Basic `
    --admin-enabled true `
    --query "loginServer" -o tsv

if (-not $acrResult) {
    Exit-WithError "Failed to create container registry"
}

Write-Success "Container Registry created: $registryName"
Write-Info "Login server: $acrResult"

# =======================
# STEP 8: Push Image to Registry
# =======================
Write-Header "Step 8: Pushing Docker Image to Registry"

Write-Info "Logging in to container registry..."
az acr login --name $registryName

if ($LASTEXITCODE -ne 0) {
    Exit-WithError "Failed to log in to container registry"
}

Write-Success "Logged in to registry"

$imageName = "$acrResult/tdx-mcp:latest"

Write-Info "Tagging image: $imageName..."
docker tag tdx-mcp:latest $imageName

Write-Info "Pushing image to registry (this may take 2-3 minutes)..."
docker push $imageName

if ($LASTEXITCODE -ne 0) {
    Exit-WithError "Failed to push Docker image"
}

Write-Success "Image pushed to registry: $imageName"

# Get registry credentials for Bicep deployment
Write-Info "Retrieving registry credentials..."
$registryPassword = az acr credential show --resource-group $resourceGroupName --name $registryName --query passwords[0].value -o tsv
$registryUsername = az acr credential show --resource-group $resourceGroupName --name $registryName --query username -o tsv

if (-not $registryPassword -or -not $registryUsername) {
    Exit-WithError "Failed to retrieve registry credentials"
}

Write-Success "Registry credentials retrieved"

# =======================
# STEP 10: Deploy with Bicep
# =======================
Write-Header "Step 10: Deploying to Azure Container Apps"

# =======================
# STEP 7: Create Container Registry
# =======================
Write-Header "Step 7: Creating Azure Container Registry"

Write-Info "Creating container registry: $registryName..."
$acrResult = az acr create `
    --resource-group $resourceGroupName `
    --name $registryName `
    --sku Basic `
    --admin-enabled true `
    --query "loginServer" -o tsv

if (-not $acrResult) {
    Exit-WithError "Failed to create container registry"
}

Write-Success "Container Registry created: $registryName"
Write-Info "Login server: $acrResult"

# =======================
# STEP 8: Push Image to Registry
# =======================
Write-Header "Step 8: Pushing Docker Image to Registry"

Write-Info "Logging in to container registry..."
az acr login --name $registryName

if ($LASTEXITCODE -ne 0) {
    Exit-WithError "Failed to log in to container registry"
}

Write-Success "Logged in to registry"

$imageName = "$acrResult/tdx-mcp:latest"

Write-Info "Tagging image: $imageName..."
docker tag tdx-mcp:latest $imageName

Write-Info "Pushing image to registry (this may take 2-3 minutes)..."
docker push $imageName

if ($LASTEXITCODE -ne 0) {
    Exit-WithError "Failed to push Docker image"
}

Write-Success "Image pushed to registry: $imageName"

# Get registry credentials for Bicep deployment
Write-Info "Retrieving registry credentials..."
$registryPassword = az acr credential show --resource-group $resourceGroupName --name $registryName --query passwords[0].value -o tsv
$registryUsername = az acr credential show --resource-group $resourceGroupName --name $registryName --query username -o tsv

if (-not $registryPassword -or -not $registryUsername) {
    Exit-WithError "Failed to retrieve registry credentials"
}

Write-Success "Registry credentials retrieved"

Write-Info "Validating Bicep template..."
$bicepValidation = az deployment group validate `
    --resource-group $resourceGroupName `
    --template-file infra/main.bicep `
    --parameters infra/main.parameters.json `
    --parameters location=$Location `
    --parameters containerImage=$imageName `
    --parameters registryUsername=$registryUsername `
    --parameters registryPassword=$registryPassword `
    --parameters tdxApiKey=$($envVars['TDX_WEB_SERVICES_KEY']) `
    --parameters tdxApiUrl=$($envVars['TDX_BASE_URL']) `
    2>&1

if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Bicep template validation failed:"
    Write-Host $bicepValidation
    Exit-WithError "Template validation error"
}

Write-Success "Bicep template validated"

Write-Info "Deploying Bicep template (this may take 3-5 minutes)..."
$deploymentResult = az deployment group create `
    --resource-group $resourceGroupName `
    --template-file infra/main.bicep `
    --parameters infra/main.parameters.json `
    --parameters location=$Location `
    --parameters containerImage=$imageName `
    --parameters registryUsername=$registryUsername `
    --parameters registryPassword=$registryPassword `
    --parameters tdxApiKey=$($envVars['TDX_WEB_SERVICES_KEY']) `
    --parameters tdxApiUrl=$($envVars['TDX_BASE_URL']) `
    --query "properties.outputs" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Deployment failed:"
    Write-Host $deploymentResult
    Exit-WithError "Bicep deployment error"
}

Write-Success "Bicep deployment completed"

# =======================
# STEP 11: Display Results
# =======================
Write-Header "🎉 Deployment Complete!"

$outputs = $deploymentResult | ConvertFrom-Json

Write-Success "Your TDX MCP Connector is now deployed to Azure!"
Write-Host ""
Write-Info "📋 Deployment Information:"
Write-Host "  Resource Group: $resourceGroupName" -ForegroundColor $SuccessColor
Write-Host "  Container App: $containerAppName" -ForegroundColor $SuccessColor
Write-Host "  Registry: $registryName" -ForegroundColor $SuccessColor
Write-Host "  Region: $Location" -ForegroundColor $SuccessColor

if ($outputs.containerAppUrl) {
    Write-Host ""
    Write-Info "🌐 Public URL:"
    Write-Host "  $($outputs.containerAppUrl.value)" -ForegroundColor $SuccessColor
}

if ($outputs.apiKey) {
    Write-Host ""
    Write-Info "🔐 API Key (for Bearer authentication):"
    Write-Host "  $($outputs.apiKey.value)" -ForegroundColor $SuccessColor
}

Write-Host ""
Write-Info "📝 Next Steps:"
Write-Host "  1. Use the URL above to access your MCP server"
Write-Host "  2. Include API key in Authorization header: Bearer [KEY]"
Write-Host "  3. Test health endpoint: curl -H 'Authorization: Bearer [KEY]' [URL]/health"
Write-Host ""
Write-Info "📚 Documentation:"
Write-Host "  - API Reference: API_REFERENCE.md"
Write-Host "  - Deployment Guide: AZURE_CONTAINER_APPS_DEPLOYMENT.md"
Write-Host "  - View logs: az containerapp logs show --resource-group $resourceGroupName --name $containerAppName"
Write-Host ""

Write-Warning "Important: Save your API key in a secure location. You'll need it for all API calls."

Write-Host "`nPress Enter to exit..." -ForegroundColor $InfoColor
Read-Host
