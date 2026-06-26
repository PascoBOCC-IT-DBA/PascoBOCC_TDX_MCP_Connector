#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Deploy TDX MCP Connector to Azure Container Apps with public access and authentication

.DESCRIPTION
    This script automates the deployment process for the TDX MCP Connector to Azure Container Apps.
    It handles environment setup, authentication, and deployment.

.EXAMPLE
    .\deploy-to-azure.ps1
#>

param(
    [string]$SubscriptionId,
    [string]$EnvironmentName = "dev",
    [string]$Location = "eastus",
    [string]$ResourceGroupName
)

# Colors for output
$ErrorColor = "Red"
$SuccessColor = "Green"
$InfoColor = "Cyan"

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

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor $ErrorColor
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor $InfoColor
}

# Check prerequisites
Write-Header "Checking Prerequisites"

# Check if azd is installed
$azdPath = Get-Command azd -ErrorAction SilentlyContinue
if (-not $azdPath) {
    Write-Error "Azure Developer CLI (azd) is not installed"
    Write-Info "Install from: https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd"
    exit 1
}
Write-Success "Azure Developer CLI (azd) found"

# Check if docker is available
$dockerPath = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerPath) {
    Write-Error "Docker is not installed or not in PATH"
    Write-Info "Install Docker from: https://www.docker.com/products/docker-desktop"
    exit 1
}
Write-Success "Docker found"

# Check if .env.example exists
if (-not (Test-Path ".env.example")) {
    Write-Error ".env.example not found in current directory"
    Write-Info "Please run this script from the project root directory"
    exit 1
}
Write-Success "Project files found"

# Check for .env file
Write-Header "Environment Configuration"

if (Test-Path ".env") {
    Write-Info ".env file already exists, skipping creation"
} else {
    Write-Info ".env file not found, creating from template..."
    Copy-Item ".env.example" ".env"
    Write-Success ".env file created"
    
    Write-Info "Please edit .env with your TDX credentials:"
    Write-Info "  - TDX_BASE_URL: Your TeamDynamix instance URL"
    Write-Info "  - TDX_BEID: Your Business Entity ID"
    Write-Info "  - TDX_WEB_SERVICES_KEY: Your Web Services API Key"
    Write-Info "  - TDX_APP_ID, TDX_ASSETS_APP_ID, TDX_KB_APP_ID: Your application IDs"
    Write-Info "  - MCP_API_KEY: Will be auto-generated if empty"
    
    Write-Host "`nPress Enter to continue after updating .env..." -ForegroundColor $InfoColor
    Read-Host
}

# Load .env variables
Write-Info "Loading environment configuration..."
$envContent = Get-Content ".env" -Raw
$envVars = @{}
foreach ($line in $envContent -split "`n") {
    if ($line -match "^([^=]+)=(.*)$") {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
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
    $value = $envVars[$var]
    if (-not $value -or $value -eq "your-*") {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Error "Missing or invalid required environment variables:"
    foreach ($var in $missingVars) {
        Write-Error "  - $var"
    }
    exit 1
}

Write-Success "All required TDX credentials configured"

# Generate API key if not set
if (-not $envVars["MCP_API_KEY"] -or $envVars["MCP_API_KEY"] -eq "your-secure-api-key-here") {
    Write-Info "Generating secure API key..."
    $apiKey = [guid]::NewGuid().ToString().Replace("-", "").Substring(0, 32)
    
    # Update .env file
    (Get-Content ".env") -replace "MCP_API_KEY=.*", "MCP_API_KEY=$apiKey" | Set-Content ".env"
    Write-Success "API key generated and saved to .env"
}

# Azure authentication
Write-Header "Azure Authentication"

$azAccount = azd auth list 2>$null
if (-not $azAccount) {
    Write-Info "Logging in to Azure..."
    azd auth login
}
Write-Success "Authenticated with Azure"

# Get subscription
if ($SubscriptionId) {
    azd env set AZURE_SUBSCRIPTION_ID $SubscriptionId
} else {
    Write-Info "Available subscriptions:"
    $subscriptions = az account list --query "[].{Name:name, SubscriptionId:id}" -o table
    Write-Host $subscriptions
    
    $SubscriptionId = Read-Host "Enter your Azure Subscription ID (or press Enter for default)"
    if ($SubscriptionId) {
        azd env set AZURE_SUBSCRIPTION_ID $SubscriptionId
    }
}

# Initialize azd (if needed)
if (-not (Test-Path ".azure")) {
    Write-Header "Initializing Azure Developer CLI"
    Write-Info "Setting up Azure Developer CLI infrastructure..."
    azd env new $EnvironmentName
}

# Set environment configuration
Write-Header "Configuring Deployment"

azd env set AZURE_ENV_NAME $EnvironmentName
azd env set AZURE_LOCATION $Location

Write-Success "Environment: $EnvironmentName"
Write-Success "Location: $Location"

# Deploy
Write-Header "Deploying to Azure"

Write-Info "Starting deployment (this may take 5-10 minutes)..."
Write-Info "Building and pushing container image..."
Write-Info "Provisioning Azure resources..."

azd up

# Post-deployment info
Write-Header "Deployment Complete!"

Write-Success "Your TDX MCP Connector is now live!"

Write-Info "Next steps:"
Write-Info "1. The container app URL is displayed above"
Write-Info "2. Your API key is stored in .env (MCP_API_KEY)"
Write-Info "3. Use Bearer token authentication for all API calls"
Write-Info ""
Write-Info "Example curl command:"
Write-Info "  curl -H 'Authorization: Bearer <API_KEY>' https://<YOUR_URL>/health"
Write-Info ""
Write-Info "For more information, see: AZURE_CONTAINER_APPS_DEPLOYMENT.md"

Write-Host "`nPress Enter to exit..." -ForegroundColor $InfoColor
Read-Host
