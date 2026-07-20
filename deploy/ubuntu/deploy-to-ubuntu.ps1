<#
.SYNOPSIS
    Deploy TDX MCP Connector to Ubuntu server from Windows
    
.DESCRIPTION
    This PowerShell script automates deployment of the TDX MCP Connector 
    to a remote Ubuntu server using SSH and SCP.
    
    Supports both:
    - Initial setup (fresh deployment)
    - Update (pull latest code to existing deployment)

.PARAMETER ServerIP
    IP address or hostname of the Ubuntu server
    Example: 10.210.1.38

.PARAMETER Username
    SSH username for the Ubuntu server
    Example: ubuntu, admin, root

.PARAMETER Port
    SSH port (default: 22)

.PARAMETER SourcePath
    Local path to the project (default: current directory)

.PARAMETER Mode
    "setup" for initial deployment, "update" for code update
    Default: update

.PARAMETER PrivateKeyPath
    Path to SSH private key (optional, uses default ~/.ssh/id_rsa if not provided)

.EXAMPLE
    # Initial setup on new server
    .\deploy-to-ubuntu.ps1 -ServerIP 10.210.1.38 -Username ubuntu -Mode setup

.EXAMPLE
    # Update existing deployment with new code
    .\deploy-to-ubuntu.ps1 -ServerIP 10.210.1.38 -Username ubuntu -Mode update

.EXAMPLE
    # Using custom SSH key
    .\deploy-to-ubuntu.ps1 -ServerIP 10.210.1.38 -Username ubuntu `
        -PrivateKeyPath "C:\Users\username\.ssh\id_rsa" -Mode update

#>

param(
    [Parameter(Mandatory = $true)]
    [string]$ServerIP,
    
    [Parameter(Mandatory = $true)]
    [string]$Username,
    
    [int]$Port = 22,
    
    [string]$SourcePath = (Get-Location).Path,
    
    [ValidateSet("setup", "update")]
    [string]$Mode = "update",
    
    [string]$PrivateKeyPath = $null
)

# Configuration
$APP_HOME = "/opt/tdx-mcp"
$TempRemotePath = "/tmp/tdx-mcp-source"
$ScriptStart = Get-Date

# Helper function for colored output
function Write-ColorOutput {
    param(
        [string]$Message,
        [ValidateSet("Green", "Red", "Yellow", "Blue")]
        [string]$Color = "White"
    )
    
    $colors = @{
        "Green"  = "`e[32m"
        "Red"    = "`e[31m"
        "Yellow" = "`e[33m"
        "Blue"   = "`e[34m"
        "White"  = "`e[37m"
        "Reset"  = "`e[0m"
    }
    
    Write-Host "$($colors[$Color])$Message$($colors['Reset'])"
}

function Test-SSHConnection {
    param([string]$Server, [int]$Port, [string]$User)
    
    Write-ColorOutput "Testing SSH connection to $Server..." "Yellow"
    
    $sshTest = ssh -p $Port $User@$Server "echo 'SSH OK'" 2>&1
    
    if ($sshTest -match "SSH OK") {
        Write-ColorOutput "✓ SSH connection successful" "Green"
        return $true
    } else {
        Write-ColorOutput "✗ SSH connection failed" "Red"
        Write-Host $sshTest
        return $false
    }
}

function Test-CommandExists {
    param(
        [string]$Command,
        [string]$Server,
        [int]$Port,
        [string]$User
    )
    
    $result = ssh -p $Port $User@$Server "which $Command" 2>&1
    return $result -notmatch "not found"
}

function Deploy-Files {
    param(
        [string]$LocalPath,
        [string]$Server,
        [int]$Port,
        [string]$User,
        [string]$RemotePath
    )
    
    Write-ColorOutput "`nStep: Copy project files to server" "Yellow"
    
    # Build SCP command
    $excludePatterns = @(
        "node_modules",
        ".git",
        "dist",
        ".env",
        ".DS_Store",
        "*.log"
    )
    
    $scpExclude = $excludePatterns | ForEach-Object { "--exclude='$_'" } | Join-String -Separator " "
    
    Write-Host "  Copying from: $LocalPath"
    Write-Host "  Copying to:   $User@$Server:$RemotePath"
    
    # Use rsync if available, otherwise scp
    $hasRsync = Test-CommandExists "rsync" $Server $Port $User
    
    if ($hasRsync) {
        Write-Host "  Using rsync for transfer..."
        rsync -avz -e "ssh -p $Port" $scpExclude "$LocalPath/" "$User@$Server`:$RemotePath/" --delete
    } else {
        Write-Host "  Using scp for transfer..."
        # Simpler SCP approach - copy everything and let setup handle cleanup
        & scp -P $Port -r "$LocalPath\*" "$User@$Server`:$RemotePath\" 2>&1 | Select-Object -Skip 2
    }
    
    Write-ColorOutput "✓ Files copied successfully" "Green"
}

function Run-RemoteScript {
    param(
        [string]$Server,
        [int]$Port,
        [string]$User,
        [string]$Script,
        [string]$Description
    )
    
    Write-ColorOutput "`n$Description" "Yellow"
    
    ssh -p $Port $User@$Server "sudo bash -s" << EOF
$Script
EOF
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ Operation completed successfully" "Green"
    } else {
        Write-ColorOutput "✗ Operation failed with exit code $LASTEXITCODE" "Red"
        throw "Remote operation failed"
    }
}

function Invoke-SetupMode {
    param(
        [string]$Server,
        [int]$Port,
        [string]$User
    )
    
    Write-ColorOutput "`n========================================" "Blue"
    Write-ColorOutput "TDX MCP Connector - Initial Setup" "Blue"
    Write-ColorOutput "========================================`n" "Blue"
    
    # Copy setup script first
    Write-ColorOutput "Copying setup script..." "Yellow"
    Write-Host "  From: $(Join-Path $SourcePath 'deploy\ubuntu\setup-ubuntu.sh')"
    Write-Host "  To:   $User@$Server:/tmp/setup-ubuntu.sh"
    
    & scp -P $Port "$(Join-Path $SourcePath 'deploy\ubuntu\setup-ubuntu.sh')" "$User@$Server`:/tmp/setup-ubuntu.sh"
    
    Write-ColorOutput "✓ Setup script copied" "Green"
    
    # Deploy source files
    Deploy-Files $SourcePath $Server $Port $User $TempRemotePath
    
    # Run setup script
    $setupScript = @"
#!/bin/bash
set -e

echo "Running initial setup script..."
chmod +x /tmp/setup-ubuntu.sh
/tmp/setup-ubuntu.sh

echo ""
echo "Post-setup configuration..."

# Copy project files to deployment directory
cp -r $TempRemotePath/* $APP_HOME/ 2>/dev/null || true
chown -R tdx-mcp:tdx-mcp $APP_HOME
chmod 750 $APP_HOME

# Check for .env file
if [ ! -f "$APP_HOME/.env" ]; then
    echo "Creating .env file..."
    cat > $APP_HOME/.env << 'EOFENV'
# TDX API Configuration
TDX_BASE_URL=https://service.pascocountyfl.net/TDXWebApi/api
TDX_BEID=1
TDX_WEB_SERVICES_KEY=your_web_services_key_here
TDX_APP_ID=your_app_id_here
TDX_ASSETS_APP_ID=your_assets_app_id_here
TDX_KB_APP_ID=your_kb_app_id_here

# HTTP Server Configuration
MCP_HTTP_PORT=3000
NODE_ENV=production

# API Security (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
MCP_API_KEY=your_secure_api_key_here

# Tool Access Control
ALLOW_MODIFICATIONS=false

# Optional: Request Timeouts (milliseconds)
MCP_REQUEST_TIMEOUT_MS=60000
MCP_INIT_TIMEOUT_MS=30000
MCP_TOOLS_LIST_TIMEOUT_MS=30000
MCP_TOOLS_CALL_TIMEOUT_MS=180000
EOFENV
    
    chown tdx-mcp:tdx-mcp $APP_HOME/.env
    chmod 600 $APP_HOME/.env
fi

echo "Setup complete!"
"@
    
    Run-RemoteScript $Server $Port $User $setupScript "Step: Run setup and configuration"
}

function Invoke-UpdateMode {
    param(
        [string]$Server,
        [int]$Port,
        [string]$User
    )
    
    Write-ColorOutput "`n========================================" "Blue"
    Write-ColorOutput "TDX MCP Connector - Code Update" "Blue"
    Write-ColorOutput "========================================`n" "Blue"
    
    # Deploy updated source files (excluding node_modules, dist, .env)
    Deploy-Files $SourcePath $Server $Port $User $TempRemotePath
    
    # Run update script
    $updateScript = @"
#!/bin/bash
set -e

echo "Running update script..."
chmod +x $TempRemotePath/deploy/ubuntu/update-ubuntu.sh

# Copy updated files (preserve .env and node_modules)
cp -r $TempRemotePath/src $APP_HOME/
cp -r $TempRemotePath/tsconfig.json $APP_HOME/ 2>/dev/null || true
cp -r $TempRemotePath/package*.json $APP_HOME/ 2>/dev/null || true

chown -R tdx-mcp:tdx-mcp $APP_HOME

# Run update
$TempRemotePath/deploy/ubuntu/update-ubuntu.sh
"@
    
    Run-RemoteScript $Server $Port $User $updateScript "Step: Deploy updated code"
}

# Main execution
try {
    Write-ColorOutput "`n========================================" "Blue"
    Write-ColorOutput "TDX MCP Connector - Windows Deployment" "Blue"
    Write-ColorOutput "========================================`n" "Blue"
    
    # Validate source path
    if (-not (Test-Path $SourcePath)) {
        throw "Source path not found: $SourcePath"
    }
    
    if (-not (Test-Path "$SourcePath\package.json")) {
        throw "package.json not found in $SourcePath"
    }
    
    Write-ColorOutput "Configuration:" "Blue"
    Write-Host "  Server:      $ServerIP:$Port"
    Write-Host "  User:        $Username"
    Write-Host "  Source:      $SourcePath"
    Write-Host "  Mode:        $Mode"
    Write-Host ""
    
    # Test SSH connection
    if (-not (Test-SSHConnection $ServerIP $Port $Username)) {
        throw "Cannot connect to server. Check SSH configuration."
    }
    
    # Verify required tools
    Write-ColorOutput "`nVerifying required tools..." "Yellow"
    if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
        throw "SSH not found in PATH. Install OpenSSH or Git for Windows."
    }
    if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
        throw "SCP not found in PATH. Install OpenSSH or Git for Windows."
    }
    Write-ColorOutput "✓ Required tools available" "Green"
    
    # Execute deployment
    if ($Mode -eq "setup") {
        Invoke-SetupMode $ServerIP $Port $Username
    } else {
        Invoke-UpdateMode $ServerIP $Port $Username
    }
    
    Write-ColorOutput "`n========================================" "Blue"
    Write-ColorOutput "✓ Deployment Complete!" "Green"
    Write-ColorOutput "========================================`n" "Blue"
    
    Write-ColorOutput "Next Steps:" "Blue"
    Write-Host "  1. SSH to server:"
    Write-Host "     ssh $Username@$ServerIP"
    Write-Host ""
    Write-Host "  2. Edit .env file:"
    Write-Host "     sudo nano /opt/tdx-mcp/.env"
    Write-Host ""
    Write-Host "  3. Restart service:"
    Write-Host "     sudo systemctl restart tdx-mcp"
    Write-Host ""
    Write-Host "  4. Check status:"
    Write-Host "     sudo systemctl status tdx-mcp"
    Write-Host "     sudo journalctl -u tdx-mcp -f"
    Write-Host ""
    Write-Host "  5. Test endpoints:"
    Write-Host "     curl http://$ServerIP`:3000/health"
    Write-Host "     curl http://$ServerIP`:3000/tools"
    
    $elapsed = (Get-Date) - $ScriptStart
    Write-ColorOutput "`nCompleted in $($elapsed.TotalSeconds) seconds" "Green"
}
catch {
    Write-ColorOutput "`n✗ Deployment failed!" "Red"
    Write-ColorOutput $_.Exception.Message "Red"
    exit 1
}
