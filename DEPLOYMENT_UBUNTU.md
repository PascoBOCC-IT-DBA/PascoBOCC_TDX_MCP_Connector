# Ubuntu Deployment Guide - TDX MCP Connector

## Overview
This guide walks you through deploying the TDX MCP Connector to Ubuntu 26.04 LTS with systemd service management.

## Prerequisites
- Ubuntu 26.04 LTS server with SSH access
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

### Step 6: Create Systemd Service
```bash
# Create service file
sudo tee /etc/systemd/system/tdx-mcp.service > /dev/null << 'EOF'
[Unit]
Description=TDX MCP Connector Server
After=network.target

[Service]
Type=simple
User=tdx-mcp
WorkingDirectory=/opt/tdx-mcp
ExecStart=/usr/bin/node /opt/tdx-mcp/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tdx-mcp
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF
```

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

### View Service File
```bash
sudo systemctl cat tdx-mcp
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs for errors
sudo journalctl -u tdx-mcp -n 100

# Verify .env file exists and has correct permissions
ls -la /opt/tdx-mcp/.env

# Test Node.js manually
sudo -u tdx-mcp /usr/bin/node /opt/tdx-mcp/dist/index.js
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
- Service will auto-restart if it crashes (with 10-second delay)
- Node.js 22 LTS is specified for long-term stability
- .env file contains sensitive credentials - keep permissions restricted (600)
