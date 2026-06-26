# ⚠️ Ubuntu Deployment Guide (Legacy) - TDX MCP Connector

> **Deprecated**: This guide is maintained for reference only. **New deployments should use [Azure Container Apps](AZURE_CONTAINER_APPS_DEPLOYMENT.md)**, which is the recommended production deployment method.
>
> For local development or if you have specific infrastructure requirements for self-hosted Ubuntu deployment, you may use this guide. Azure Container Apps provides better scalability, security, and reduced operational overhead.

## Overview
This guide walks you through deploying the TDX MCP Connector to Ubuntu 24.04 LTS with systemd service management (legacy method).

## Prerequisites
- Ubuntu 24.04 LTS server with SSH access
- sudo privileges on the server
- Your project files and .env configuration

## Quick Start (Automated)

### 1. Prepare Your Project on Windows
```bash
# In your local workspace, copy the setup script
setup-ubuntu.sh
```

### 2. Copy Project to Ubuntu Server via SCP
```powershell
# From PowerShell on Windows:
scp -r "c:\_repos\PascoBOCC-JasonBoswell\PascoBOCC_TDX_MCP_Connector" username@your-server-ip:/tmp/tdx-mcp-source
```

### 3. Run Setup Script on Server
```bash
# SSH into your server
ssh username@your-server-ip

# Copy setup script to home directory
cp /tmp/tdx-mcp-source/setup-ubuntu.sh ~/

# Make it executable
chmod +x ~/setup-ubuntu.sh

# Run with sudo
sudo ~/setup-ubuntu.sh
```

### 4. Complete Setup
```bash
# Copy your project files to deployment directory
sudo cp -r /tmp/tdx-mcp-source/* /opt/tdx-mcp/

# Ensure permissions are correct
sudo chown -R tdx-mcp:tdx-mcp /opt/tdx-mcp

# Copy your .env file
sudo cp /path/to/your/.env /opt/tdx-mcp/.env
sudo chown tdx-mcp:tdx-mcp /opt/tdx-mcp/.env
sudo chmod 600 /opt/tdx-mcp/.env
```

## Manual Setup (Step by Step)

### Step 1: Update System
```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### Step 2: Install Node.js 22
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 3: Create Service User and Directory
```bash
sudo useradd -r -s /bin/bash -d /opt/tdx-mcp tdx-mcp
sudo mkdir -p /opt/tdx-mcp
sudo chown -R tdx-mcp:tdx-mcp /opt/tdx-mcp
```

### Step 4: Deploy Project Files
```bash
# Copy project files to /opt/tdx-mcp
# Then install dependencies as the service user
cd /opt/tdx-mcp
sudo -u tdx-mcp npm install --production
sudo -u tdx-mcp npm run build
```

### Step 5: Configure Environment
```bash
# Copy your .env file
sudo cp /your/local/.env /opt/tdx-mcp/.env
sudo chown tdx-mcp:tdx-mcp /opt/tdx-mcp/.env
sudo chmod 600 /opt/tdx-mcp/.env
```

### Configuration: Tool Availability (ALLOW_MODIFICATIONS)

The server operates in **safe mode by default**, enabling only read-only tools. To enable modification tools (create, update, delete), add this to your `.env` file:

```bash
# Default behavior (safe): only read-only tools available (17 tools)
# ALLOW_MODIFICATIONS=false

# To enable modification tools (26 additional tools)
ALLOW_MODIFICATIONS=true
```

**Recommendation**: Deploy with `ALLOW_MODIFICATIONS=false` initially. Enable modifications only after testing read-only operations.

### Step 6: Create Systemd Service (HTTP Wrapper Mode)
```bash
# Create service file for HTTP wrapper (persistent service mode)
sudo tee /etc/systemd/system/tdx-mcp.service > /dev/null << 'EOF'
[Unit]
Description=TDX MCP HTTP Server
After=network.target

[Service]
Type=simple
User=tdx-mcp
WorkingDirectory=/opt/tdx-mcp
Environment="NODE_ENV=production"
Environment="MCP_HTTP_PORT=3000"
Environment="MCP_API_KEY=your-secure-api-key-here"
Environment="ALLOW_MODIFICATIONS=false"
ExecStart=/usr/bin/node /opt/tdx-mcp/dist/http-wrapper.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tdx-mcp

[Install]
WantedBy=multi-user.target
EOF
```

**Important Notes**:
- Replace `your-secure-api-key-here` with a strong API key (see COPILOT_INTEGRATION.md for key generation)
- Set `ALLOW_MODIFICATIONS=false` for safe-mode (default)
- Change to `ALLOW_MODIFICATIONS=true` to enable 26 modification tools (create, update, delete)

### Step 7: Enable and Start Service
```bash
# Reload systemd configuration
sudo systemctl daemon-reload

# Start the service
sudo systemctl start tdx-mcp

# Enable auto-start on boot
sudo systemctl enable tdx-mcp

# Check status
sudo systemctl status tdx-mcp
```

## Service Management Commands

### Check Status
```bash
sudo systemctl status tdx-mcp
```

### View Logs (Real-time)
```bash
sudo journalctl -u tdx-mcp -f
```

### View Recent Logs
```bash
sudo journalctl -u tdx-mcp -n 50
```

### Restart Service
```bash
sudo systemctl restart tdx-mcp
```

### Stop Service
```bash
sudo systemctl stop tdx-mcp
```

## Tool Availability & Modification Control

### Understanding Tool Modes

The server includes **43 tools** split into two categories:

| Category | Count | Availability | Operations |
|----------|-------|--------------|------------|
| **Read-Only Tools** | 17 | Always enabled | `get`, `search`, `lookup` — safe exploration |
| **Modification Tools** | 26 | Requires `ALLOW_MODIFICATIONS=true` | `create`, `update`, `patch`, `delete` — data changes |

### Enabling Modifications

To allow modification tools, update the systemd service environment:

```bash
# Edit the service file
sudo nano /etc/systemd/system/tdx-mcp.service

# Change this line:
# Environment="ALLOW_MODIFICATIONS=false"
# To:
# Environment="ALLOW_MODIFICATIONS=true"

# Save and reload
sudo systemctl daemon-reload
sudo systemctl restart tdx-mcp
```

Or modify the `.env` file:
```bash
sudo nano /opt/tdx-mcp/.env
# Add or change: ALLOW_MODIFICATIONS=true
sudo systemctl restart tdx-mcp
```

### Verifying Tool Availability

Check which tools are registered:
```bash
# View service logs for tool registration
sudo journalctl -u tdx-mcp --since='5 minutes ago' | grep -E 'Registering|registered'
```

Look for output like:
```
[TDX-MCP] Registering ticket read-only tools...
[TDX-MCP] Ticket read-only tools registered successfully!
[TDX-MCP] Registering ticket modification tools...
```

### Safety Recommendations

1. **Initial Deployment**: Always start with `ALLOW_MODIFICATIONS=false`
2. **Test Phase**: Verify read-only tools work correctly (ticket search, asset lookup, etc.)
3. **Enable Modifications**: Only enable after confirming read-only tools are functional
4. **Monitor Changes**: Keep audit logs when modifications are enabled

### View Service File
```bash
sudo systemctl cat tdx-mcp
```

## High Availability & Auto-Restart

The TDX MCP service is configured for automatic restart on both failure and server reboot.

### Auto-Restart on Failure
- **Enabled via**: `Restart=on-failure` in systemd service file
- **Behavior**: If the service crashes or exits unexpectedly, systemd will automatically restart it
- **Delay**: 10-second delay between restart attempts (`RestartSec=10`)
- **Benefit**: Transient errors won't require manual intervention

### Auto-Start on Server Reboot
- **Enabled via**: `WantedBy=multi-user.target` in systemd service file AND `systemctl enable tdx-mcp`
- **Behavior**: When the Ubuntu server reboots, the service will automatically start
- **Timing**: Service starts after network is available (`After=network.target`)
- **Benefit**: Zero-downtime server maintenance and automated recovery

### Verify Auto-Start Configuration
```bash
# Check if service is enabled (should return "enabled")
sudo systemctl is-enabled tdx-mcp

# View the service dependencies and status
sudo systemctl list-dependencies --all | grep tdx-mcp
```

### Enable Auto-Start (if needed)
```bash
# Enable the service for auto-start on boot
sudo systemctl enable tdx-mcp

# Verify it's enabled
sudo systemctl is-enabled tdx-mcp
```

### Disable Auto-Start (if needed)
```bash
# If you need to prevent auto-start (e.g., for maintenance)
sudo systemctl disable tdx-mcp

# Verify it's disabled
sudo systemctl is-enabled tdx-mcp  # Should return "disabled"

# You can still start it manually
sudo systemctl start tdx-mcp
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs for errors
sudo journalctl -u tdx-mcp -n 100

# Verify .env file exists and has correct permissions
ls -la /opt/tdx-mcp/.env

# Verify the HTTP wrapper file exists
ls -la /opt/tdx-mcp/src/http-wrapper.js

# Test Node.js manually
sudo -u tdx-mcp /usr/bin/node /opt/tdx-mcp/src/http-wrapper.js
```

### Permission Denied Errors
```bash
# Fix file ownership
sudo chown -R tdx-mcp:tdx-mcp /opt/tdx-mcp

# Fix permissions on .env
sudo chmod 600 /opt/tdx-mcp/.env
```

### Node Modules Issues
```bash
# Reinstall dependencies
cd /opt/tdx-mcp
sudo -u tdx-mcp rm -rf node_modules package-lock.json
sudo -u tdx-mcp npm install --production
sudo -u tdx-mcp npm run build
```

## Updating Deployment

When deploying a new version:

```bash
# Stop the service
sudo systemctl stop tdx-mcp

# Update files
cd /opt/tdx-mcp
sudo cp -r /new/source/files/* .

# Reinstall dependencies (if package.json changed)
sudo -u tdx-mcp npm install --production
sudo -u tdx-mcp npm run build

# Start service
sudo systemctl start tdx-mcp

# Verify
sudo systemctl status tdx-mcp
```

## Notes

- Service runs as non-root user `tdx-mcp` for security
- Logs are managed by journald (systemd logging)
- **Auto-restart enabled**: Service will automatically restart if it crashes (with 10-second delay)
- **Auto-start enabled**: Service will automatically start on server reboot
- **HTTP wrapper mode**: Service runs as HTTP wrapper (`src/http-wrapper.js`) for persistent availability, not stdio mode
- Node.js 22 LTS is specified for long-term stability
- .env file contains sensitive credentials - keep permissions restricted (600)
- API key authentication is configured via `MCP_API_KEY` environment variable in the systemd service file
