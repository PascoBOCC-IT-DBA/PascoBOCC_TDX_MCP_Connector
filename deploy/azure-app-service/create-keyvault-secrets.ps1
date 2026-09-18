#Requires -Version 7.0

<#
.SYNOPSIS
    Creates and manages Azure Key Vault secrets for the TDX MCP Connector application.

.DESCRIPTION
    This script creates all required secrets in an Azure Key Vault for the
    TDX MCP Connector. It supports both interactive and parameter-driven modes, includes
    comprehensive error handling, and validates all secrets after creation.
    
    In Automated mode, the script uses Azure CLI by default (recommended) for better
    automation support, falling back to Az PowerShell modules if needed.
    
    Requirements:
    - Automated mode: Azure CLI installed and authenticated
    - Interactive mode: Azure CLI OR Az.KeyVault + Az.Accounts modules

.PARAMETER KeyVaultName
    The name of the Azure Key Vault (required).

.PARAMETER ResourceGroupName
    The name of the resource group containing the Key Vault (required).

.PARAMETER SubscriptionId
    The Azure subscription ID (optional, uses current context if not specified).

.PARAMETER Mode
    Execution mode: 'Interactive' (default) or 'Automated'.
    - Interactive: Prompts for all secret values (supports both CLI and PowerShell)
    - Automated: Reads from secrets JSON file (uses CLI by default, PowerShell fallback)

.PARAMETER SecretsFile
    Path to JSON file containing secrets (required for Automated mode).
    JSON format:
    {
        "TdxBaseUrl": "https://api.teamdynamix.com",
        "TdxBeid": "12345",
        "TdxWebServicesKey": "your-api-key",
        "TdxAppId": "1",
        "TdxAssetsAppId": "2",
        "TdxKbAppId": "3",
        "McpApiKey": "your-mcp-api-key"
    }

.PARAMETER Force
    Skip confirmation prompts and overwrite existing secrets (useful in CI/CD).

.PARAMETER VerifyOnly
    Only verify that secrets exist; do not create them.

.PARAMETER UseCli
    Force use of Azure CLI instead of Az PowerShell modules (recommended for automation).

.EXAMPLE
    # Interactive mode (prompts for values)
    .\create-keyvault-secrets.ps1 -KeyVaultName "my-kv" -ResourceGroupName "my-rg"

.EXAMPLE
    # Automated mode with secrets file (uses CLI by default)
    .\create-keyvault-secrets.ps1 -KeyVaultName "my-kv" -ResourceGroupName "my-rg" `
        -Mode Automated -SecretsFile "secrets.json" -Force

.EXAMPLE
    # Verify secrets exist without creating
    .\create-keyvault-secrets.ps1 -KeyVaultName "my-kv" -ResourceGroupName "my-rg" -VerifyOnly

.EXAMPLE
    # Force Azure CLI usage for automation
    .\create-keyvault-secrets.ps1 -KeyVaultName "my-kv" -ResourceGroupName "my-rg" `
        -Mode Automated -SecretsFile "secrets.json" -UseCli -Force

.NOTES
    Author: TDX MCP Connector Team
    Version: 2.0 (Updated for Azure CLI-first automation support)
    Requires: Azure CLI 2.50+ (recommended) or Az PowerShell modules
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
    [switch]$VerifyOnly,

    [Parameter(Mandatory = $false, HelpMessage = "Use Azure CLI instead of Az PowerShell (recommended)")]
    [switch]$UseCli
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
    @{ Name = "McpApiKeyReadonly"; Description = "MCP API key for read-only access"; Sensitive = $true },
    @{ Name = "McpApiKeyReadwrite"; Description = "MCP API key for read-write access"; Sensitive = $true }
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

function Test-CliAvailable {
    try {
        $cliVersion = az --version 2>&1 | Select-Object -First 1
        return $?
    }
    catch {
        return $false
    }
}

function Test-AzContext {
    # In Automated mode, skip interactive login - assume already authenticated
    if ($Mode -eq "Automated") {
        Write-Log "Automated mode: skipping authentication prompt" "Info"
        return $true
    }

    try {
        $context = Get-AzContext
        if (-not $context) {
            Write-Log "No Azure context found. Please authenticate first." "Error"
            Write-Log "Run: Connect-AzAccount" "Info"
            return $false
        }
        return $true
    }
    catch {
        Write-Log "Failed to check Azure context: $_" "Error"
        return $false
    }
}

function Test-KeyVault-Cli {
    param([string]$VaultName, [string]$ResourceGroup)
    try {
        $kv = az keyvault show --name $VaultName --resource-group $ResourceGroup 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Key Vault found: $VaultName" "Success"
            return $true
        }
        else {
            Write-Log "Key Vault not found: $kv" "Error"
            return $false
        }
    }
    catch {
        Write-Log "Error checking Key Vault: $_" "Error"
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

function Test-SecretExists-Cli {
    param([string]$VaultName, [string]$SecretName)
    try {
        $secret = az keyvault secret show --vault-name $VaultName --name $SecretName 2>&1
        return $LASTEXITCODE -eq 0
    }
    catch {
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

function Create-KeyVaultSecret-Cli {
    param(
        [string]$VaultName,
        [string]$SecretName,
        [string]$SecretValue,
        [bool]$Force = $false
    )

    try {
        $exists = Test-SecretExists-Cli -VaultName $VaultName -SecretName $SecretName

        if ($exists -and -not $Force) {
            Write-Log "Secret '$SecretName' already exists. Use -Force to overwrite." "Warning"
            return $false
        }

        if ($exists) {
            Write-Log "Overwriting existing secret: $SecretName" "Warning"
        }

        $result = az keyvault secret set --vault-name $VaultName --name $SecretName --value $SecretValue 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Created secret: $SecretName" "Success"
            return $true
        }
        else {
            Write-Log "Failed to create secret '$SecretName': $result" "Error"
            return $false
        }
    }
    catch {
        Write-Log "Failed to create secret '$SecretName': $_" "Error"
        return $false
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

function Verify-Secrets-Cli {
    param(
        [string]$VaultName,
        [hashtable[]]$Secrets
    )

    Write-Log "Verifying secrets in Key Vault (using CLI)..." "Info"
    $results = @()

    foreach ($secret in $Secrets) {
        $exists = Test-SecretExists-Cli -VaultName $VaultName -SecretName $secret.Name
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

# Determine whether to use CLI or PowerShell
$useCliMethod = $UseCli
if (-not $UseCli -and $Mode -eq "Automated") {
    # In Automated mode, default to CLI if available
    $useCliMethod = Test-CliAvailable
    if ($useCliMethod) {
        Write-Log "Detected Azure CLI - using CLI method for better automation support" "Info"
    }
}

# Verify authentication based on method
if ($useCliMethod) {
    Write-Log "Using Azure CLI" "Info"
    if (-not (Test-CliAvailable)) {
        Write-Log "ERROR: Azure CLI is not available. Please install it or use -UsePowerShell" "Error"
        exit 1
    }
    # CLI doesn't require explicit context check - it uses current login
}
else {
    Write-Log "Using Azure PowerShell (Az modules)" "Info"
    if (-not (Test-AzContext)) {
        Write-Log "Please authenticate first: Connect-AzAccount" "Error"
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
}

# Verify Key Vault exists
Write-Log "Checking Key Vault availability..." "Info"
if ($useCliMethod) {
    if (-not (Test-KeyVault-Cli -VaultName $KeyVaultName -ResourceGroup $ResourceGroupName)) {
        exit 1
    }
}
else {
    if (-not (Test-KeyVault -VaultName $KeyVaultName -ResourceGroup $ResourceGroupName)) {
        exit 1
    }
}

# Verify only mode
if ($VerifyOnly) {
    Write-Log "Running in verification-only mode..." "Info"
    Write-Host ""
    
    if ($useCliMethod) {
        $allSecretsValid = Verify-Secrets-Cli -VaultName $KeyVaultName -Secrets $RequiredSecrets
    }
    else {
        $allSecretsValid = Verify-Secrets -VaultName $KeyVaultName -Secrets $RequiredSecrets
    }
    
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

# Confirmation (skip in Automated mode with Force)
if (-not ($Mode -eq "Automated" -and $Force)) {
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
}

# Create secrets
Write-Host ""
Write-Log "Creating secrets..." "Info"
$successCount = 0

if ($useCliMethod) {
    foreach ($name in $secretValues.Keys) {
        $value = $secretValues[$name]
        if ($value -is [System.Security.SecureString]) {
            $value = [System.Net.NetworkCredential]::new("", $value).Password
        }
        
        if (Create-KeyVaultSecret-Cli -VaultName $KeyVaultName -SecretName $name -SecretValue $value -Force $Force) {
            $successCount++
        }
    }
}
else {
    foreach ($name in $secretValues.Keys) {
        if (Create-KeyVaultSecret -VaultName $KeyVaultName -SecretName $name -SecretValue $secretValues[$name] -Force $Force) {
            $successCount++
        }
    }
}

# Verify all secrets
Write-Host ""
if ($useCliMethod) {
    $allValid = Verify-Secrets-Cli -VaultName $KeyVaultName -Secrets $RequiredSecrets
}
else {
    $allValid = Verify-Secrets -VaultName $KeyVaultName -Secrets $RequiredSecrets
}

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
