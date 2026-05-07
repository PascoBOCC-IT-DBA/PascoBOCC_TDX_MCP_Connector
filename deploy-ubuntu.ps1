# PowerShell Script to Deploy TDX MCP to Ubuntu Server
# Run this from your Windows machine to transfer files and run setup

# Configuration
$ServerIP = "10.210.1.38"          # Change this to your server IP
$ServerUser = "itmcp"         # Change this to your SSH username
$LocalProjectPath = "c:\_repos\PascoBOCC-JasonBoswell\PascoBOCC_TDX_MCP_Connector"
$EnvFilePath = "c:\_repos\PascoBOCC-JasonBoswell\PascoBOCC_TDX_MCP_Connector\.env" # Change this to your .env location

# Check if plink/pscp are available (part of PuTTY)
# If using built-in OpenSSH, use scp instead

function Test-SSH {
    Write-Host "Testing SSH connection..." -ForegroundColor Yellow
    
    # Try connecting with timeout
    $result = ssh -o ConnectTimeout=5 "${ServerUser}@${ServerIP}" "echo 'SSH connection successful'" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ SSH connection successful" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ SSH connection failed. Please check:" -ForegroundColor Red
        Write-Host "  - Server IP: $ServerIP"
        Write-Host "  - Username: $ServerUser"
        Write-Host "  - SSH access is enabled on the server"
        return $false
    }
}

function Copy-ProjectToServer {
    Write-Host "`nCopying project files to server..." -ForegroundColor Yellow
    
    # Copy entire project directory
    scp -r "$LocalProjectPath" "${ServerUser}@${ServerIP}:/tmp/tdx-mcp-source"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Project files copied successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to copy project files" -ForegroundColor Red
        return $false
    }
    
    return $true
}

function Copy-EnvToServer {
    Write-Host "`nCopying .env file to server..." -ForegroundColor Yellow
    
    if (-not (Test-Path $EnvFilePath)) {
        Write-Host "✗ .env file not found at $EnvFilePath" -ForegroundColor Red
        Write-Host "  Please update `$EnvFilePath in this script" -ForegroundColor Yellow
        return $false
    }
    
    scp "$EnvFilePath" "${ServerUser}@${ServerIP}:/tmp/tdx-mcp.env"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ .env file copied successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to copy .env file" -ForegroundColor Red
        return $false
    }
    
    return $true
}

function Run-SetupScript {
    Write-Host "`nRunning setup script on server..." -ForegroundColor Yellow
    
    $setupCommands = @"
#!/bin/bash
set -e

# Copy setup script
cp /tmp/tdx-mcp-source/setup-ubuntu.sh ~/
chmod +x ~/setup-ubuntu.sh

# Run setup
sudo ~/setup-ubuntu.sh

# Copy project files
sudo cp -r /tmp/tdx-mcp-source/* /opt/tdx-mcp/
sudo chown -R tdx-mcp:tdx-mcp /opt/tdx-mcp

# Copy .env file
sudo cp /tmp/tdx-mcp.env /opt/tdx-mcp/.env
sudo chown tdx-mcp:tdx-mcp /opt/tdx-mcp/.env
sudo chmod 600 /opt/tdx-mcp/.env

echo "✓ Setup complete!"
echo "Start service with: sudo systemctl start tdx-mcp"
echo "Check status with: sudo systemctl status tdx-mcp"
echo "View logs with: sudo journalctl -u tdx-mcp -f"
"@
    
    # Create temp script on server and run it
    $setupCommands | ssh "${ServerUser}@${ServerIP}" "bash"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Setup completed successfully" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ Setup script failed" -ForegroundColor Red
        return $false
    }
}

function Show-NextSteps {
    Write-Host "`n" -ForegroundColor Green
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║         Deployment Complete - Next Steps                   ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    
    Write-Host "`nConnect to your server:"
    Write-Host "  ssh ${ServerUser}@${ServerIP}" -ForegroundColor Cyan
    
    Write-Host "`nStart the service:"
    Write-Host "  sudo systemctl start tdx-mcp" -ForegroundColor Cyan
    
    Write-Host "`nCheck service status:"
    Write-Host "  sudo systemctl status tdx-mcp" -ForegroundColor Cyan
    
    Write-Host "`nView real-time logs:"
    Write-Host "  sudo journalctl -u tdx-mcp -f" -ForegroundColor Cyan
    
    Write-Host "`nEnable auto-start on boot:"
    Write-Host "  sudo systemctl enable tdx-mcp" -ForegroundColor Cyan
}

# Main execution
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║    TDX MCP Connector - Deploy to Ubuntu Server             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host "`nConfiguration:" -ForegroundColor Yellow
Write-Host "  Server: ${ServerUser}@${ServerIP}"
Write-Host "  Project: $LocalProjectPath"
Write-Host "  Env File: $EnvFilePath"

# Execute deployment
if (-not (Test-SSH)) {
    exit 1
}

if (-not (Copy-ProjectToServer)) {
    exit 1
}

if (-not (Copy-EnvToServer)) {
    exit 1
}

if (-not (Run-SetupScript)) {
    exit 1
}

Show-NextSteps

Write-Host "`n✓ All done! Your MCP server is ready for deployment.`n" -ForegroundColor Green
