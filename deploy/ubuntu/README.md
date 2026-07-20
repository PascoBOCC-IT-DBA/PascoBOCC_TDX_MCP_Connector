# Ubuntu Deployment Guide - TDX MCP Connector

## Overview

This folder contains scripts for deploying the TDX MCP Connector to Ubuntu 24.04 LTS servers. Supports both initial setup and ongoing updates.

**Current Deployment**: http://10.210.1.38:3000/tools ✓ Running

## Quick Start

### From Windows (Recommended)

Deploy to an existing Ubuntu server from Windows PowerShell:

```powershell
# Initial setup on new server
.\deploy-to-ubuntu.ps1 -ServerIP 10.210.1.38 -Username ubuntu -Mode setup

# Update existing deployment
.\deploy-to-ubuntu.ps1 -ServerIP 10.210.1.38 -Username ubuntu -Mode update
```

### From Ubuntu Server (Direct)

For deployment directly on the Ubuntu server:

```bash
# Initial setup
sudo bash setup-ubuntu.sh

# Code updates
sudo bash update-ubuntu.sh
```

## Scripts

### 1. `setup-ubuntu.sh` - Initial Deployment

**Purpose**: Automated initial setup of the TDX MCP Connector on a new Ubuntu server.

**What it does**:
- Updates system packages
- Installs Node.js 22 (via NodeSource repository)
- Creates `tdx-mcp` service user and `/opt/tdx-mcp` directory
- Installs npm dependencies
- Builds TypeScript to JavaScript
- Creates systemd service file
- Starts the service on boot

**Requirements**:
- Ubuntu 24.04 LTS
- Root/sudo access
- Internet connectivity

**Usage**:
```bash
# Method 1: Direct execution on server
sudo bash setup-ubuntu.sh

# Method 2: Via Windows PowerShell
.\deploy-to-ubuntu.ps1 -ServerIP 10.210.1.38 -Username ubuntu -Mode setup
```

**Post-Setup**:
After running setup, you must configure the `.env` file:

```bash
sudo nano /opt/tdx-mcp/.env
```

Update these values with your actual TDX credentials:
- `TDX_BASE_URL` — TDX API endpoint
- `TDX_WEB_SERVICES_KEY` — API authentication key
- `TDX_APP_ID` — TeamDynamix application ID
- `MCP_API_KEY` — Secure API key for HTTP access

Then restart the service:
```bash
sudo systemctl restart tdx-mcp
```

---

### 2. `update-ubuntu.sh` - Code Updates

**Purpose**: Deploy updated code to an existing deployment.

**What it does**:
- Stops the systemd service
- Pulls/updates source files (if git repository)
- Installs updated dependencies with `npm ci --production`
- Rebuilds TypeScript
- Restarts the service

**Requirements**:
- Existing deployment via `setup-ubuntu.sh`
- Root/sudo access

**Usage**:
```bash
# Method 1: Direct execution on server
sudo bash update-ubuntu.sh

# Method 2: Via SSH from Windows
ssh user@10.210.1.38 "sudo bash /opt/tdx-mcp/deploy/ubuntu/update-ubuntu.sh"

# Method 3: Via Windows PowerShell
.\deploy-to-ubuntu.ps1 -ServerIP 10.210.1.38 -Username ubuntu -Mode update
```

---

### 3. `deploy-to-ubuntu.ps1` - Windows Deployment Script

**Purpose**: Automate deployment from Windows using SSH/SCP.

**What it does**:
- Tests SSH connectivity
- Copies project files to server
- Executes setup or update scripts remotely
- Provides progress feedback and logs

**Requirements**:
- Windows with PowerShell 5.1+
- SSH client (OpenSSH or Git for Windows)
- SCP/rsync for file transfer
- SSH access to Ubuntu server

**Usage**:

```powershell
# Initial deployment (fresh server)
.\deploy-to-ubuntu.ps1 `
    -ServerIP 10.210.1.38 `
    -Username ubuntu `
    -Mode setup

# Update existing deployment
.\deploy-to-ubuntu.ps1 `
    -ServerIP 10.210.1.38 `
    -Username ubuntu `
    -Mode update

# Using custom port and SSH key
.\deploy-to-ubuntu.ps1 `
    -ServerIP 10.210.1.38 `
    -Username ubuntu `
    -Port 2222 `
    -PrivateKeyPath "C:\Users\username\.ssh\id_rsa" `
    -Mode update
```

**Parameters**:
- `-ServerIP` (required) — Ubuntu server IP or hostname
- `-Username` (required) — SSH username (e.g., `ubuntu`, `admin`)
- `-Mode` — `setup` (initial) or `update` (code updates). Default: `update`
- `-Port` — SSH port. Default: `22`
- `-SourcePath` — Local project path. Default: current directory
- `-PrivateKeyPath` — SSH private key path (optional)

---

## Deployment Architecture

### Directory Structure
```
/opt/tdx-mcp/
├── dist/                      # Compiled JavaScript
│   ├── index.js              # MCP server
│   └── http-wrapper.js       # HTTP wrapper
├── src/                      # TypeScript source
├── node_modules/             # Dependencies
├── package.json
├── package-lock.json
├── tsconfig.json
├── .env                      # Configuration (git-ignored)
└── deploy/
    └── ubuntu/
        ├── setup-ubuntu.sh
        ├── update-ubuntu.sh
        └── deploy-to-ubuntu.ps1
```

### Service Configuration
```
Service: tdx-mcp
SystemD: /etc/systemd/system/tdx-mcp.service
User: tdx-mcp
Home: /opt/tdx-mcp
Port: 3000
Entry: node /opt/tdx-mcp/dist/http-wrapper.js
```

### Environment Variables

The `.env` file configures the application. Key variables:

| Variable | Purpose | Example |
|----------|---------|---------|
| `TDX_BASE_URL` | TDX API endpoint | `https://service.pascocountyfl.net/TDXWebApi/api` |
| `TDX_BEID` | Business Environment ID | `1` |
| `TDX_WEB_SERVICES_KEY` | TDX API authentication | (from Key Vault) |
| `TDX_APP_ID` | MCP tools app ID | (from Key Vault) |
| `MCP_HTTP_PORT` | HTTP server port | `3000` |
| `MCP_API_KEY` | Optional API key for HTTP access | (generated) |
| `ALLOW_MODIFICATIONS` | Enable/disable write tools | `false` (default) |

---

## Service Management

### View Status
```bash
sudo systemctl status tdx-mcp
```

### Start Service
```bash
sudo systemctl start tdx-mcp
```

### Stop Service
```bash
sudo systemctl stop tdx-mcp
```

### Restart Service
```bash
sudo systemctl restart tdx-mcp
```

### View Logs (Real-time)
```bash
sudo journalctl -u tdx-mcp -f
```

### View Recent Logs
```bash
sudo journalctl -u tdx-mcp -n 50
```

### Check Resource Usage
```bash
ps aux | grep "node.*http-wrapper"
```

---

## Testing & Verification

### Health Check
```bash
curl http://10.210.1.38:3000/health
```

Expected response:
```json
{ "status": "ok" }
```

### List Available Tools
```bash
curl http://10.210.1.38:3000/tools
```

### Get Server Info
```bash
curl http://10.210.1.38:3000/status
```

### Test Tool Call (with API key)
```bash
curl -X POST http://10.210.1.38:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "assets_search",
      "arguments": { "filter": "status:Active" }
    },
    "id": 1
  }'
```

---

## Tool Access Modes

### Read-Only Mode (Default - Safe)
```bash
ALLOW_MODIFICATIONS=false
```
Enables 17 read-only tools:
- Search, list, get operations
- No write/delete operations
- Safe for public/untrusted access

**Available Tools**: `assets_search`, `kb_search`, `tickets_search`, `people_search`, `groups_search`, etc.

### Modification Mode (Advanced)
```bash
ALLOW_MODIFICATIONS=true
```
Enables additional 26 modification tools:
- Create, update, patch, delete operations
- Requires API key authentication
- Restricted access recommended

**Available Tools**: `ticket_create`, `asset_update`, `kb_delete`, etc.

---

## Troubleshooting

### Service Won't Start

**Check the logs**:
```bash
sudo journalctl -u tdx-mcp -n 50
```

**Common causes**:
- Port 3000 already in use: `sudo lsof -i :3000`
- `.env` file missing or incorrect permissions: `sudo cat /opt/tdx-mcp/.env | head -5`
- TypeScript build failed: `cd /opt/tdx-mcp && npm run build`

### HTTP Server Not Responding

**Test connectivity**:
```bash
curl -v http://localhost:3000/health
```

**If port is open but server not responding**:
```bash
# Verify service is running
sudo systemctl status tdx-mcp

# Check recent logs
sudo journalctl -u tdx-mcp -n 100

# Restart service
sudo systemctl restart tdx-mcp
```

### TDX API Connection Issues

**Verify credentials in .env**:
```bash
sudo cat /opt/tdx-mcp/.env | grep TDX_
```

**Test connectivity to TDX API**:
```bash
curl -v https://service.pascocountyfl.net/TDXWebApi/api/
```

### High Memory Usage

**Check memory**:
```bash
free -h
ps aux --sort=-%mem | head -10
```

**Restart to free memory**:
```bash
sudo systemctl restart tdx-mcp
```

---

## Maintenance

### Regular Updates

```bash
# Update source code
cd /path/to/local/repo
git pull origin main

# Deploy to Ubuntu
.\deploy-to-ubuntu.ps1 -ServerIP 10.210.1.38 -Username ubuntu -Mode update
```

### Backup Configuration

```bash
# Backup .env file
scp ubuntu@10.210.1.38:/opt/tdx-mcp/.env ./backup/.env-backup-$(date +%Y%m%d)
```

### Check Disk Space

```bash
df -h /opt/tdx-mcp
du -sh /opt/tdx-mcp
```

### Update Node.js

```bash
# Check current version
node --version

# Update if needed
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version

# Restart service
sudo systemctl restart tdx-mcp
```

---

## Security Best Practices

### 1. SSH Access
- Use key-based authentication (disable password SSH)
- Restrict SSH to specific IP addresses with firewall rules
- Use non-standard SSH port if exposed to internet

### 2. API Key Management
- Generate strong API keys: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Store in `.env` with restricted file permissions (`600`)
- Rotate keys periodically
- Use different keys for different clients

### 3. Service User Isolation
- Service runs as unprivileged `tdx-mcp` user
- `.env` file readable only by service user
- Application cannot modify system files

### 4. Firewall Configuration
```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP access (if needed)
sudo ufw allow 3000/tcp

# Restrict to specific networks
sudo ufw allow from 192.168.1.0/24 to any port 3000
```

### 5. TDX Credentials
- Never commit `.env` to git (add to `.gitignore`)
- Rotate TDX API keys regularly
- Use unique credentials per environment (dev, staging, prod)

---

## Firewall & Network

### Ubuntu Firewall Setup
```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP port 3000
sudo ufw allow 3000/tcp

# View rules
sudo ufw status verbose
```

### Port Access

| Port | Service | Access |
|------|---------|--------|
| 22 | SSH | Admin only |
| 3000 | HTTP (MCP) | Application clients |

### If Behind Reverse Proxy
Port 3000 can be private (internal only), with reverse proxy on port 80/443:
- nginx, Apache, or cloud load balancer
- Handle HTTPS termination
- Apply rate limiting and authentication

---

## Related Documentation

- [DEPLOYMENT_CONTAINER_APPS.md](../docs/DEPLOYMENT_CONTAINER_APPS.md) — Azure Container Apps (recommended for production)
- [DEPLOYMENT_AZURE_APPSERVICE.md](../docs/DEPLOYMENT_AZURE_APPSERVICE.md) — Azure App Service
- [API_REFERENCE.md](../docs/API_REFERENCE.md) — MCP tools and endpoints
- [COPILOT_INTEGRATION.md](../docs/COPILOT_INTEGRATION.md) — Integration guide

---

## Support & Debugging

### Collect Diagnostic Information

```bash
#!/bin/bash
echo "=== System Info ==="
uname -a

echo "=== Node.js Version ==="
node --version

echo "=== Service Status ==="
sudo systemctl status tdx-mcp

echo "=== Recent Logs ==="
sudo journalctl -u tdx-mcp -n 50

echo "=== Disk Space ==="
df -h /opt/tdx-mcp

echo "=== Memory ==="
free -h

echo "=== Port 3000 ==="
sudo netstat -tlnp | grep 3000
```

### Enable Debug Logging

Add to `.env`:
```bash
DEBUG=*
NODE_DEBUG=http
```

Restart:
```bash
sudo systemctl restart tdx-mcp
```

View logs:
```bash
sudo journalctl -u tdx-mcp -f
```

---

## Deployment Checklist

- [ ] Server: Ubuntu 24.04 LTS, SSH access, sudo privileges
- [ ] Network: DNS resolves, TDX API reachable
- [ ] Run `setup-ubuntu.sh` or `deploy-to-ubuntu.ps1 -Mode setup`
- [ ] Edit `.env` with actual TDX credentials
- [ ] Restart service: `sudo systemctl restart tdx-mcp`
- [ ] Verify health: `curl http://SERVER:3000/health`
- [ ] List tools: `curl http://SERVER:3000/tools`
- [ ] Test tool call with API key
- [ ] Configure firewall rules
- [ ] Document server IP and access method
- [ ] Schedule regular backups of `.env` file

---

**Last Updated**: 2026-07-20  
**Deployment Version**: 1.0  
**Status**: ✓ Active (10.210.1.38:3000)
