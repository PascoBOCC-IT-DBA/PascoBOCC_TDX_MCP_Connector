#Requires -Version 5.1
<#
.SYNOPSIS
Complete GCC deployment with Service Principal authentication

.DESCRIPTION
Uses service principal (app registration) for authentication, which bypasses
GCC security restrictions and allows automated deployments. Assumes secrets
are already created in Azure Key Vault via create-keyvault-secrets.ps1.

This script handles:
  - Building and deploying the application
  - Verifying secrets exist in Key Vault
  - Granting App Service managed identity access to Key Vault
  - Configuring App Service environment variables
  - Restarting the App Service

.PARAMETER ClientId
Service Principal Client ID

.PARAMETER ClientSecret
Service Principal Client Secret

.PARAMETER TenantId
GCC Tenant ID

.PARAMETER SubscriptionId
GCC Subscription ID

.PARAMETER ResourceGroup
Azure resource group name

.PARAMETER AppName
App Service name

.PARAMETER KeyVaultName
Key Vault name (must have secrets already created)

.EXAMPLE
# First, create secrets in Key Vault:
PS> .\create-keyvault-secrets.ps1 -KeyVaultName "my-kv" -ResourceGroupName "my-rg"

# Then deploy:
PS> ./deploy-gcc-with-sp.ps1 `
  -ClientId "<your-client-id>" `
  -ClientSecret "<your-client-secret>" `
  -TenantId "<your-tenant-id>" `
  -SubscriptionId "<your-subscription-id>" `
  -ResourceGroup "TDX-MCP" `
  -AppName "TDX-MCP-APP" `
  -KeyVaultName "TDX-MCP-Vault"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$ClientId,
    
    [Parameter(Mandatory=$true)]
    [string]$ClientSecret,
    
    [Parameter(Mandatory=$true)]
    [string]$TenantId,
    
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup,
    
    [Parameter(Mandatory=$true)]
    [string]$AppName,
    
    [Parameter(Mandatory=$true)]
    [string]$KeyVaultName
)

$ErrorActionPreference = 'Stop'

# Required secrets that should exist in Key Vault
$RequiredSecrets = @(
    "TdxBaseUrl",
    "TdxBeid",
    "TdxWebServicesKey",
    "TdxAppId",
    "TdxAssetsAppId",
    "TdxKbAppId",
    "McpApiKey"
)

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   TDX MCP Connector - GCC Deployment with Service Principal    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Client ID: $($ClientId.Substring(0,8))..." -ForegroundColor Gray
Write-Host "  Tenant: $($TenantId.Substring(0,8))..." -ForegroundColor Gray
Write-Host "  Subscription: $SubscriptionId" -ForegroundColor Gray
Write-Host "  Resource Group: $ResourceGroup" -ForegroundColor Gray
Write-Host "  App Service: $AppName" -ForegroundColor Gray
Write-Host "  Key Vault: $KeyVaultName" -ForegroundColor Gray
Write-Host ""

# ============================================================================
# STEP 1: Authenticate with Service Principal
# ============================================================================
Write-Host "[1/7] Authenticating with Service Principal..." -ForegroundColor Yellow

try {
    Write-Host "  Logging out from any existing session..." -ForegroundColor Gray
    az logout 2>$null | Out-Null
    
    Write-Host "  Setting cloud to AzureUSGovernment..." -ForegroundColor Gray
    az cloud set --name AzureUSGovernment
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set Azure Cloud to GCC"
    }
    
    Write-Host "  Authenticating with service principal..." -ForegroundColor Gray
    az login --service-principal `
        -u $ClientId `
        -p $ClientSecret `
        --tenant $TenantId
    if ($LASTEXITCODE -ne 0) {
        throw "Service principal authentication failed"
    }
    
    # Set subscription
    Write-Host "  Setting subscription..." -ForegroundColor Gray
    az account set --subscription $SubscriptionId
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set subscription"
    }
    
    # Verify
    $accountInfo = az account show | ConvertFrom-Json
    Write-Host "  ✓ Authenticated as: $($accountInfo.name)" -ForegroundColor Green
}
catch {
    Write-Host "✗ Step 1 failed: $_" -ForegroundColor Red
    exit 1
}

# ============================================================================
# STEP 2: Build & Deploy
# ============================================================================
Write-Host "`n[2/7] Building and deploying to App Service..." -ForegroundColor Yellow

try {
    $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $deployFolder = Join-Path $repoRoot "deploy" "azure-app-service"
    
    Write-Host "  Building TypeScript..." -ForegroundColor Gray
    Push-Location $repoRoot
    npm ci
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    Pop-Location
    
    Write-Host "  Creating deployment package..." -ForegroundColor Gray
    $zipPath = Join-Path $deployFolder "tdx-mcp-deploy.zip"
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }
    
    $itemsToZip = @(
        (Join-Path $repoRoot "dist"),
        (Join-Path $repoRoot "package.json"),
        (Join-Path $repoRoot "package-lock.json")
    )
    
    # Include node_modules
    $nodeModulesPath = Join-Path $repoRoot "node_modules"
    if (Test-Path $nodeModulesPath) {
        $itemsToZip += $nodeModulesPath
        Write-Host "  Including node_modules..." -ForegroundColor Gray
    }
    
    Push-Location $repoRoot
    Compress-Archive -Path $itemsToZip -DestinationPath $zipPath -Force
    Pop-Location
    
    $zipSize = (Get-Item $zipPath).Length / 1MB
    Write-Host "  Deployment package: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Gray
    
    Write-Host "  Deploying to Azure App Service..." -ForegroundColor Gray
    az webapp deploy `
        --resource-group $ResourceGroup `
        --name $AppName `
        --src-path $zipPath `
        --type zip `
        --async true
    if ($LASTEXITCODE -ne 0) {
        throw "Deployment failed"
    }
    
    Write-Host "  ✓ Deployment initiated (async mode)" -ForegroundColor Green
    Write-Host "  Waiting 10 seconds for build to start..." -ForegroundColor Gray
    Start-Sleep -Seconds 10
}
catch {
    Write-Host "✗ Step 2 failed: $_" -ForegroundColor Red
    exit 1
}

# ============================================================================
# STEP 3: Grant Service Principal Access to Key Vault (for deployment)
# ============================================================================
Write-Host "`n[3/7] Granting service principal access to Key Vault..." -ForegroundColor Yellow

try {
    Write-Host "  Setting Key Vault access policy for service principal..." -ForegroundColor Gray
    
    # Grant service principal permissions to manage secrets (needed for deployment)
    az keyvault set-policy `
        --name $KeyVaultName `
        --spn $ClientId `
        --secret-permissions set delete get list `
        --output none
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set Key Vault policy for service principal"
    }
    
    Write-Host "  ✓ Service principal granted Key Vault access" -ForegroundColor Green
}
catch {
    Write-Host "✗ Step 3 failed: $_" -ForegroundColor Red
    exit 1
}

# ============================================================================
# STEP 4: Verify Secrets Exist in Key Vault
# ============================================================================
Write-Host "`n[4/6] Verifying secrets in Key Vault..." -ForegroundColor Yellow

try {
    Write-Host "  Checking for required secrets..." -ForegroundColor Gray
    $missingSecrets = @()
    
    foreach ($secretName in $RequiredSecrets) {
        $secretExists = az keyvault secret show `
            --vault-name $KeyVaultName `
            --name $secretName `
            --query "id" `
            --output tsv 2>$null
        
        if ($secretExists) {
            Write-Host "  ✓ $secretName found" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $secretName NOT found" -ForegroundColor Red
            $missingSecrets += $secretName
        }
    }
    
    if ($missingSecrets.Count -gt 0) {
        throw "Missing required secrets in Key Vault: $($missingSecrets -join ', '). Run create-keyvault-secrets.ps1 first."
    }
    
    Write-Host "  ✓ All required secrets verified in Key Vault" -ForegroundColor Green
}
catch {
    Write-Host "✗ Step 4 failed: $_" -ForegroundColor Red
    exit 1
}

# ============================================================================
# STEP 5: Grant App Service Access to Key Vault
# ============================================================================
Write-Host "`n[5/6] Granting App Service access to Key Vault..." -ForegroundColor Yellow

try {
    Write-Host "  Getting App Service Managed Identity..." -ForegroundColor Gray
    $appServiceId = az webapp identity show `
        --resource-group $ResourceGroup `
        --name $AppName `
        --query "principalId" `
        --output tsv
    
    if ([string]::IsNullOrWhiteSpace($appServiceId)) {
        throw "Could not retrieve App Service principal ID"
    }
    
    Write-Host "  Principal ID: $appServiceId" -ForegroundColor Gray
    Write-Host "  Setting Key Vault access policy..." -ForegroundColor Gray
    
    az keyvault set-policy `
        --name $KeyVaultName `
        --object-id $appServiceId `
        --secret-permissions get list `
        --output none
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set Key Vault policy"
    }
    
    Write-Host "  ✓ Key Vault access granted" -ForegroundColor Green
}
catch {
    Write-Host "✗ Step 5 failed: $_" -ForegroundColor Red
    exit 1
}

# ============================================================================
# STEP 6: Configure App Service Settings
# ============================================================================
Write-Host "`n[6/6] Configuring App Service settings..." -ForegroundColor Yellow

try {
    Write-Host "  Applying settings via ARM REST API (bypasses cmd.exe parsing issues)..." -ForegroundColor Gray
    
    # Direct values, NOT Key Vault references: GCC App Service silently drops KV references
    # before container startup, and SCM_DO_BUILD_DURING_DEPLOYMENT=true interferes with env
    # var injection. See /memories/repo/azure-deployment-troubleshooting.md for the incident.
    $settingsBody = @{
        kind = "app"
        properties = @{
            WEBSITES_PORT                           = "3000"
            SCM_DO_BUILD_DURING_DEPLOYMENT          = "false"
            NODE_ENV                                = "production"
            ALLOW_MODIFICATIONS                     = "false"
            WEBSITE_NODE_DEFAULT_VERSION            = "24-lts"
            TDX_BASE_URL                            = $tdxBaseUrl
            TDX_BEID                                = $tdxBeid
            TDX_WEB_SERVICES_KEY                    = $tdxWebServicesKey
            TDX_APP_ID                              = $tdxAppId
            TDX_ASSETS_APP_ID                       = $tdxAssetsAppId
            TDX_KB_APP_ID                           = $tdxKbAppId
            MCP_API_KEY                             = $mcpApiKey
            TDX_RATE_LIMIT_ENABLED                  = "true"
            TDX_RATE_LIMIT_CALLS                    = "60"
            TDX_RATE_LIMIT_WINDOW_MS                = "60000"
            TDX_RATE_LIMIT_BURST_CAPACITY_MULTIPLIER = "1.5"
            TDX_RATE_LIMIT_QUEUE_TIMEOUT_MS         = "300000"
        }
    }
    
    $armUrl = "https://management.usgovcloudapi.net/subscriptions/${SubscriptionId}/resourceGroups/${ResourceGroup}/providers/Microsoft.Web/sites/${AppName}/config/appsettings?api-version=2022-03-01"
    $bodyJson = $settingsBody | ConvertTo-Json -Depth 5 -Compress
    
    # Write JSON to temp file - avoids cmd.exe mangling quotes in the body string
    $tmpBodyFile = "$env:TEMP\tdx-appsettings-$([guid]::NewGuid()).json"
    $bodyJson | Out-File -FilePath $tmpBodyFile -Encoding UTF8 -NoNewline
    
    az rest `
        --method PUT `
        --url $armUrl `
        --headers "Content-Type=application/json" `
        --body "@${tmpBodyFile}" `
        --output none
    
    Remove-Item -Path $tmpBodyFile -Force -ErrorAction SilentlyContinue
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set application settings via ARM API"
    }
    
    Write-Host "  ✓ Application settings configured ($($settingsBody.properties.Count) settings)" -ForegroundColor Green
}
catch {
    Write-Host "✗ Step 6 failed: $_" -ForegroundColor Red
    exit 1
}

# ============================================================================
# STEP 7: Restart & Verify
# ============================================================================
Write-Host "`n[7/7] Restarting App Service and verifying..." -ForegroundColor Yellow

try {
    Write-Host "  Restarting App Service..." -ForegroundColor Gray
    az webapp restart `
        --resource-group $ResourceGroup `
        --name $AppName `
        --output none
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to restart App Service"
    }
    
    Write-Host "  Waiting 30 seconds for startup..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
    
    Write-Host "  Testing health endpoint..." -ForegroundColor Gray
    $appUrl = "https://${AppName}.azurewebsites.us/health"
    
    try {
        $response = Invoke-WebRequest -Uri $appUrl -SkipCertificateCheck -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✓ Health check passed (HTTP 200)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ Unexpected status code: $($response.StatusCode)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "  ⚠ Health check failed (may need more time)" -ForegroundColor Yellow
        Write-Host "     Try in 1-2 minutes: $appUrl" -ForegroundColor Gray
    }
    
    Write-Host "  ✓ App Service restarted" -ForegroundColor Green
}
catch {
    Write-Host "✗ Step 7 failed: $_" -ForegroundColor Red
    exit 1
}

# ============================================================================
# Success Summary
# ============================================================================
Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    ✓ Deployment Complete!                      ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  ✓ Service principal authenticated" -ForegroundColor Green
Write-Host "  ✓ Application built and deployed" -ForegroundColor Green
Write-Host "  ✓ Secrets verified in Key Vault" -ForegroundColor Green
Write-Host "  ✓ App Service granted Key Vault access" -ForegroundColor Green
Write-Host "  ✓ Application settings configured" -ForegroundColor Green
Write-Host "  ✓ App Service restarted" -ForegroundColor Green

Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "  1. Verify the app: https://${AppName}.azurewebsites.us/health" -ForegroundColor Gray
Write-Host "  2. Check logs: az webapp log tail --resource-group $ResourceGroup --name $AppName" -ForegroundColor Gray
Write-Host "  3. Test tools: https://${AppName}.azurewebsites.us/tools" -ForegroundColor Gray
Write-Host ""
