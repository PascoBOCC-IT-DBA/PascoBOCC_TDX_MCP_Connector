#
# TDX MCP Server Setup for Windows
# Right-click and "Run with PowerShell" to execute
#

# Change to the script's directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Clear-Host
Write-Host "=============================================="
Write-Host "  TDX MCP Server Setup for Claude Desktop"
Write-Host "=============================================="
Write-Host ""
Write-Host "This script will:"
Write-Host "  1. Collect your TDX admin API keys"
Write-Host "  2. Install dependencies"
Write-Host "  3. Build the MCP server"
Write-Host "  4. Configure Claude Desktop to use it"
Write-Host ""
Write-Host "You'll need your BEID and Web Services Key from"
Write-Host "TDAdmin > Organization Details > API Settings."
Write-Host ""

# Check for Node.js
$nodeVersion = $null
try {
    $nodeVersion = node --version
} catch {
    Write-Host "ERROR: Node.js is not installed." -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/ and try again."
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Node.js version: $nodeVersion"
Write-Host ""

# Get TDX Base URL
Write-Host "=============================================="
Write-Host "  Step 1: TDX API Configuration"
Write-Host "=============================================="
Write-Host ""
Write-Host "Enter the TDX Web API base URL (no trailing slash)."
Write-Host ""
Write-Host "Default: https://yourorg.teamdynamix.com/TDWebApi/api"
Write-Host ""
$TdxBaseUrl = Read-Host "TDX Base URL (press Enter for default)"

if ([string]::IsNullOrWhiteSpace($TdxBaseUrl)) {
    $TdxBaseUrl = "https://yourorg.teamdynamix.com/TDWebApi/api"
}

Write-Host ""
Write-Host "Using Base URL: $TdxBaseUrl"
Write-Host ""

# Get BEID
$TdxBeid = Read-Host "BEID (from TDAdmin)"
if ([string]::IsNullOrWhiteSpace($TdxBeid)) {
    Write-Host "ERROR: BEID is required." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Get Web Services Key
Write-Host ""
$TdxWebServicesKey = Read-Host "Web Services Key (from TDAdmin)"
if ([string]::IsNullOrWhiteSpace($TdxWebServicesKey)) {
    Write-Host "ERROR: Web Services Key is required." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Get TDX App ID
Write-Host ""
$TdxAppId = Read-Host "TDX Application ID (integer)"
if ([string]::IsNullOrWhiteSpace($TdxAppId)) {
    Write-Host "ERROR: App ID is required." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "=============================================="
Write-Host "  Step 2: Installing dependencies..."
Write-Host "=============================================="
Write-Host ""

npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: npm install failed." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "=============================================="
Write-Host "  Step 3: Building MCP server..."
Write-Host "=============================================="
Write-Host ""

npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Build failed." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "=============================================="
Write-Host "  Step 4: Configuring Claude Desktop..."
Write-Host "=============================================="
Write-Host ""

# Get the absolute path to the dist/index.js
$McpPath = Join-Path $ScriptDir "dist\index.js"
$ConfigDir = Join-Path $env:APPDATA "Claude"
$ConfigFile = Join-Path $ConfigDir "claude_desktop_config.json"

# Create config directory if it doesn't exist
if (-not (Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
}

# Load existing config or create new one
$config = @{}
if (Test-Path $ConfigFile) {
    try {
        $config = Get-Content $ConfigFile -Raw | ConvertFrom-Json -AsHashtable
    } catch {
        $config = @{}
    }
}

# Ensure mcpServers exists
if (-not $config.ContainsKey('mcpServers')) {
    $config['mcpServers'] = @{}
}

# Add/update tdx config
$config['mcpServers']['tdx'] = @{
    'command' = 'node'
    'args' = @($McpPath)
    'env' = @{
        'TDX_BASE_URL' = $TdxBaseUrl
        'TDX_BEID' = $TdxBeid
        'TDX_WEB_SERVICES_KEY' = $TdxWebServicesKey
        'TDX_APP_ID' = $TdxAppId
    }
}

# Write config back
$config | ConvertTo-Json -Depth 10 | Set-Content $ConfigFile -Encoding UTF8

Write-Host "Configuration saved to: $ConfigFile"

Write-Host ""
Write-Host "=============================================="
Write-Host "  Setup Complete!"
Write-Host "=============================================="
Write-Host ""
Write-Host "The TDX MCP server has been configured."
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Quit Claude Desktop completely"
Write-Host "  2. Reopen Claude Desktop"
Write-Host "  3. You should see 'tdx' in the MCP tools"
Write-Host ""
Write-Host "You can now use commands like:"
Write-Host "  - 'Search for open tickets assigned to me'"
Write-Host "  - 'Look up person john.doe@example.com'"
Write-Host "  - 'Get ticket #12345'"
Write-Host "  - 'Search the knowledge base for VPN setup'"
Write-Host "  - 'Find all assets in the IT department'"
Write-Host ""
Read-Host "Press Enter to exit"
