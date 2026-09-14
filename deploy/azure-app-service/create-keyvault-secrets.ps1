#Requires -Version 7.0
#Requires -Modules Az.KeyVault, Az.Accounts

<#
.SYNOPSIS
    Creates and manages Azure Key Vault secrets for the TDX MCP Connector application.

.DESCRIPTION
    This script creates all required and optional secrets in an Azure Key Vault for the
    TDX MCP Connector. It supports both interactive and parameter-driven modes, includes
    comprehensive error handling, and validates all secrets after creation.

.PARAMETER KeyVaultName
    The name of the Azure Key Vault (required).

.PARAMETER ResourceGroupName
    The name of the resource group containing the Key Vault (required).

.PARAMETER SubscriptionId
    The Azure subscription ID (optional, uses current context if not specified).

.PARAMETER Mode
    Execution mode: 'Interactive' (default) or 'Automated'.
    - Interactive: Prompts for all secret values
    - Automated: Requires all parameters via secrets JSON file

.PARAMETER SecretsFile
    Path to JSON file containing secrets (required for Automated mode).
    JSON format:
    {
        "TdxBaseUrl": "https://api.teamdynamix.com",
        "TdxBeid": "12345",
        "TdxWebServicesKey": "your-api-key",
        "TdxAppId": "1",
        "TdxAssetsAppId": "2",
        "TdxKbAppId": "3"
    }

.PARAMETER Force
    Skip confirmation prompts and overwrite existing secrets.

.PARAMETER VerifyOnly
    Only verify that secrets exist; do not create them.

.EXAMPLE
    # Interactive mode
    .\create-keyvault-secrets.ps1 -KeyVaultName "my-kv" -ResourceGroupName "my-rg"

.EXAMPLE
    # Automated mode with secrets file
    .\create-keyvault-secrets.ps1 -KeyVaultName "my-kv" -ResourceGroupName "my-rg" `
        -Mode Automated -SecretsFile "secrets.json" -Force

.EXAMPLE
    # Verify only
    .\create-keyvault-secrets.ps1 -KeyVaultName "my-kv" -ResourceGroupName "my-rg" -VerifyOnly

.NOTES
    Author: TDX MCP Connector Team
    Version: 1.0
    Requires: Azure CLI or Az PowerShell modules installed
#>

param(
    [Parameter(Mandatory = $true, HelpMessage = "Name of the Azure Key Vault")]
    [ValidateNotNullOrEmpty()]
    [string]$KeyVaultName,

    [Parameter(Mandatory = $true, HelpMessage = "Name of the resource group")]
    [ValidateNotNullOrEmpty()]
    [string]$ResourceGroupName,

    [Parameter(Mandatory = $false, HelpMessage = "Azure subscription ID")]
    [string]$SubscriptionId,

    [Parameter(Mandatory = $false, HelpMessage = "Execution mode: Interactive or Automated")]
    [ValidateSet("Interactive", "Automated")]
    [string]$Mode = "Interactive",

    [Parameter(Mandatory = $false, HelpMessage = "Path to JSON file with secrets (for Automated mode)")]
    [string]$SecretsFile,

    [Parameter(Mandatory = $false, HelpMessage = "Skip confirmation prompts")]
    [switch]$Force,

    [Parameter(Mandatory = $false, HelpMessage = "Only verify secrets exist")]
    [switch]$VerifyOnly
)

# Script configuration
$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"
$WarningPreference = "Continue"

# Required secrets
$RequiredSecrets = @(
    @{ Name = "TdxBaseUrl"; Description = "TeamDynamix API base URL" },
    @{ Name = "TdxBeid"; Description = "Business Entity ID" },
    @{ Name = "TdxWebServicesKey"; Description = "API authentication key"; Sensitive = $true },
    @{ Name = "TdxAppId"; Description = "Main application ID" },
    @{ Name = "TdxAssetsAppId"; Description = "Assets application ID" },
    @{ Name = "TdxKbAppId"; Description = "Knowledge Base application ID" },
    @{ Name = "McpApiKey"; Description = "API key for MCP Server access"; Sensitive = $true }
)

# Optional secrets
$OptionalSecrets = @()

# Utility functions
function Write-Log {
    param([string]$Message, [ValidateSet("Info", "Success", "Warning", "Error")]$Level = "Info")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = @{
        Info    = "Cyan"
        Success = "Green"
        Warning = "Yellow"
        Error   = "Red"
    }[$Level]
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

function Test-AzContext {
    try {
        $context = Get-AzContext
        if (-not $context) {
            Write-Log "No Azure context found. Attempting to login..." "Warning"
            Connect-AzAccount -ErrorAction Stop | Out-Null
            return $true
        }
        return $true
    }
    catch {
        Write-Log "Failed to establish Azure context: $_" "Error"
        return $false
    }
}

function Test-KeyVault {
    param([string]$VaultName, [string]$ResourceGroup)
    try {
        $kv = Get-AzKeyVault -Name $VaultName -ResourceGroupName $ResourceGroup -ErrorAction Stop
        Write-Log "Key Vault found: $($kv.VaultUri)" "Success"
        return $true
    }
    catch {
        Write-Log "Key Vault not found: $_" "Error"
        return $false
    }
}

function Test-SecretExists {
    param([string]$VaultName, [string]$SecretName)
    try {
        Get-AzKeyVaultSecret -VaultName $VaultName -Name $SecretName -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

function Read-SecretValue {
    param(
        [string]$Name,
        [string]$Description,
        [bool]$Sensitive = $false,
        [bool]$Optional = $false
    )

    $suffix = if ($Optional) { " (optional, press Enter to skip)" } else { " (required)" }
    $prompt = "$Name - $Description$suffix"

    if ($Sensitive) {
        $value = Read-Host -Prompt $prompt -AsSecureString
        if ($value.Length -eq 0 -and $Optional) {
            return $null
        }
        return $value
    }
    else {
        $value = Read-Host -Prompt $prompt
        if ([string]::IsNullOrWhiteSpace($value) -and $Optional) {
            return $null
        }
        return $value
    }
}

function Load-SecretsFromFile {
    param([string]$FilePath)
    try {
        if (-not (Test-Path $FilePath)) {
            throw "Secrets file not found: $FilePath"
        }
        $secrets = Get-Content $FilePath -Raw | ConvertFrom-Json
        Write-Log "Loaded secrets from file: $FilePath" "Success"
        return $secrets
    }
    catch {
        Write-Log "Failed to load secrets file: $_" "Error"
        exit 1
    }
}

function Create-KeyVaultSecret {
    param(
        [string]$VaultName,
        [string]$SecretName,
        [object]$SecretValue,
        [bool]$Force = $false
    )

    try {
        $exists = Test-SecretExists -VaultName $VaultName -SecretName $SecretName

        if ($exists -and -not $Force) {
            Write-Log "Secret '$SecretName' already exists. Use -Force to overwrite." "Warning"
            return $false
        }

        if ($exists) {
            Write-Log "Overwriting existing secret: $SecretName" "Warning"
        }

        # Convert to SecureString if it's a plain string
        if ($SecretValue -is [string]) {
            $SecretValue = ConvertTo-SecureString $SecretValue -AsPlainText -Force
        }

        Set-AzKeyVaultSecret -VaultName $VaultName -Name $SecretName -SecretValue $SecretValue -ErrorAction Stop | Out-Null
        Write-Log "Created secret: $SecretName" "Success"
        return $true
    }
    catch {
        Write-Log "Failed to create secret '$SecretName': $_" "Error"
        return $false
    }
}

function Verify-Secrets {
    param(
        [string]$VaultName,
        [hashtable[]]$Secrets
    )

    Write-Log "Verifying secrets in Key Vault..." "Info"
    $results = @()

    foreach ($secret in $Secrets) {
        $exists = Test-SecretExists -VaultName $VaultName -SecretName $secret.Name
        $status = if ($exists) { "✓ Present" } else { "✗ Missing" }
        $results += @{ Name = $secret.Name; Status = $status; Required = $true }
        Write-Log "$status - $($secret.Name)" "Info"
    }

    $missing = $results | Where-Object { $_.Status -like "✗*" }
    if ($missing) {
        Write-Log "WARNING: $($missing.Count) required secret(s) are missing" "Warning"
        return $false
    }

    Write-Log "All required secrets are present" "Success"
    return $true
}

# ============================================================================
# Main script
# ============================================================================

Write-Log "TDX MCP Connector - Azure Key Vault Secrets Setup" "Info"
Write-Log "=================================================" "Info"
Write-Log "Key Vault: $KeyVaultName" "Info"
Write-Log "Resource Group: $ResourceGroupName" "Info"
Write-Log "Mode: $Mode" "Info"

# Verify Azure context
if (-not (Test-AzContext)) {
    exit 1
}

# Set subscription if provided
if ($SubscriptionId) {
    try {
        Set-AzContext -SubscriptionId $SubscriptionId -ErrorAction Stop | Out-Null
        Write-Log "Switched to subscription: $SubscriptionId" "Success"
    }
    catch {
        Write-Log "Failed to set subscription: $_" "Error"
        exit 1
    }
}

# Verify Key Vault exists
if (-not (Test-KeyVault -VaultName $KeyVaultName -ResourceGroup $ResourceGroupName)) {
    exit 1
}

# Verify only mode
if ($VerifyOnly) {
    Write-Log "Running in verification-only mode..." "Info"
    $allSecretsValid = Verify-Secrets -VaultName $KeyVaultName -Secrets $RequiredSecrets
    exit $(if ($allSecretsValid) { 0 } else { 1 })
}

# Load secrets based on mode
$secretValues = @{}

if ($Mode -eq "Interactive") {
    Write-Log "Starting interactive secret collection..." "Info"
    Write-Host ""

    # Collect required secrets
    Write-Host "=== REQUIRED SECRETS ===" -ForegroundColor Cyan
    foreach ($secret in $RequiredSecrets) {
        $value = Read-SecretValue -Name $secret.Name -Description $secret.Description -Sensitive $secret.Sensitive
        if ([string]::IsNullOrWhiteSpace($value)) {
            Write-Log "ERROR: $($secret.Name) is required" "Error"
            exit 1
        }
        $secretValues[$secret.Name] = $value
    }
}
else {
    # Automated mode: load from file
    if ([string]::IsNullOrWhiteSpace($SecretsFile)) {
        Write-Log "ERROR: SecretsFile parameter required for Automated mode" "Error"
        exit 1
    }

    $fileSecrets = Load-SecretsFromFile -FilePath $SecretsFile
    
    # Validate required secrets are present
    foreach ($secret in $RequiredSecrets) {
        if (-not $fileSecrets.PSObject.Properties[$secret.Name]) {
            Write-Log "ERROR: Required secret '$($secret.Name)' missing from secrets file" "Error"
            exit 1
        }
        $secretValues[$secret.Name] = $fileSecrets.$($secret.Name)
    }

    Write-Log "Loaded $($secretValues.Count) secrets from file" "Success"
}

# Confirmation
Write-Host ""
Write-Log "Ready to create the following secrets in Key Vault:" "Info"
foreach ($name in $secretValues.Keys) {
    Write-Log "  - $name" "Info"
}

if (-not $Force) {
    Write-Host ""
    $confirmation = Read-Host "Continue? (yes/no)"
    if ($confirmation -ne "yes") {
        Write-Log "Operation cancelled by user" "Warning"
        exit 0
    }
}

# Create secrets
Write-Host ""
Write-Log "Creating secrets..." "Info"
$successCount = 0
foreach ($name in $secretValues.Keys) {
    if (Create-KeyVaultSecret -VaultName $KeyVaultName -SecretName $name -SecretValue $secretValues[$name] -Force $Force) {
        $successCount++
    }
}

# Verify all secrets
Write-Host ""
$allValid = Verify-Secrets -VaultName $KeyVaultName -Secrets $RequiredSecrets

# Summary
Write-Host ""
Write-Log "=== SUMMARY ===" "Info"
Write-Log "Secrets created: $successCount / $($secretValues.Count)" "Info"
Write-Log "Verification: $(if ($allValid) { 'PASSED' } else { 'FAILED' })" $(if ($allValid) { "Success" } else { "Error" })

# Post-configuration instructions
Write-Host ""
Write-Log "=== NEXT STEPS ===" "Info"
Write-Host "1. Configure App Service environment variable:" -ForegroundColor Cyan
Write-Host "   KEYVAULT_URL=https://$KeyVaultName.vault.azure.net/" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Grant App Service managed identity access:" -ForegroundColor Cyan
Write-Host "   - Go to Key Vault > Access Control (IAM)" -ForegroundColor Yellow
Write-Host "   - Add role assignment: 'Key Vault Secrets User'" -ForegroundColor Yellow
Write-Host "   - Assign to App Service managed identity" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Restart your App Service to pick up changes" -ForegroundColor Cyan
Write-Host ""

exit $(if ($allValid) { 0 } else { 1 })
