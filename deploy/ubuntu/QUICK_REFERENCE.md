# Ubuntu Deployment - Quick Reference

## Files & Locations

| File | Location | Purpose |
|------|----------|---------|
| setup-ubuntu.sh | deploy/ubuntu/ | Initial server setup |
| update-ubuntu.sh | deploy/ubuntu/ | Code updates |
| deploy-to-ubuntu.ps1 | deploy/ubuntu/ | Windows deployment (PowerShell) |
| .env.example | deploy/ubuntu/ | Configuration template |
| Service file | /etc/systemd/system/tdx-mcp.service | Systemd service |
| Application | /opt/tdx-mcp/ | Installation directory |
| Configuration | /opt/tdx-mcp/.env | Runtime configuration |
| Documentation | deploy/ubuntu/README.md | Full deployment guide |

---

## One-Liners

### Deployment (Windows PowerShell)

```powershell
# Update code on existing server
.\deploy\ubuntu\deploy-to-ubuntu.ps1 -ServerIP 10.210.1.38 -Username ubuntu -Mode update

# Fresh deployment on new server
.\deploy\ubuntu\deploy-to-ubuntu.ps1 -ServerIP 10.210.1.38 -Username ubuntu -Mode setup

# With custom SSH port
.\deploy\ubuntu\deploy-to-ubuntu.ps1 -ServerIP 10.210.1.38 -Username ubuntu -Port 2222 -Mode update
```

### Service Management (On Ubuntu)

```bash
# Check status
sudo systemctl status tdx-mcp

# Restart service
sudo systemctl restart tdx-mcp

# Start service
sudo systemctl start tdx-mcp

# Stop service
sudo systemctl stop tdx-mcp

# Enable on boot
sudo systemctl enable tdx-mcp

# View real-time logs
sudo journalctl -u tdx-mcp -f

# View last 50 log lines
sudo journalctl -u tdx-mcp -n 50

# Clear logs
sudo journalctl -u tdx-mcp --vacuum-time=1d
```

### Configuration Management

```bash
# Edit environment configuration
sudo nano /opt/tdx-mcp/.env

# View current .env (showing values)
sudo cat /opt/tdx-mcp/.env

# View specific config value
sudo grep "TDX_BASE_URL" /opt/tdx-mcp/.env

# Backup .env
sudo cp /opt/tdx-mcp/.env /opt/tdx-mcp/.env.backup-$(date +%Y%m%d)
```

### Testing & Verification

```bash
# Health check
curl http://10.210.1.38:3000/health

# List tools
curl http://10.210.1.38:3000/tools

# Get server status
curl http://10.210.1.38:3000/status

# Test with API key (replace YOUR_API_KEY)
curl -H "X-API-Key: YOUR_API_KEY" http://10.210.1.38:3000/tools

# Verbose curl (see response headers)
curl -v http://10.210.1.38:3000/health
```

### System Information

```bash
# Node.js version
node --version

# npm version
npm --version

# Disk usage
df -h /opt/tdx-mcp

# Directory size
du -sh /opt/tdx-mcp

# Memory usage
free -h

# Check if port 3000 is in use
sudo lsof -i :3000
sudo netstat -tlnp | grep 3000
```

### Build & Dependencies

```bash
# Install/update dependencies
cd /opt/tdx-mcp && sudo -u tdx-mcp npm ci --production

# Build TypeScript
cd /opt/tdx-mcp && sudo -u tdx-mcp npm run build

# Check build artifacts
ls -la /opt/tdx-mcp/dist/

# Rebuild everything
cd /opt/tdx-mcp && sudo -u tdx-mcp npm run build && sudo systemctl restart tdx-mcp
```

### Troubleshooting

```bash
# Show service errors
systemctl status tdx-mcp

# Full service unit file
sudo cat /etc/systemd/system/tdx-mcp.service

# Check if process is running
ps aux | grep "node.*http-wrapper"

# Test TDX API connectivity
curl -v https://service.pascocountyfl.net/TDXWebApi/api/

# Monitor service in real-time
watch -n 1 'systemctl status tdx-mcp | head -10'

# Full diagnostics
echo "=== OS ===" && uname -a && echo "=== Node ===" && node -v && echo "=== Service ===" && sudo systemctl status tdx-mcp && echo "=== Logs ===" && sudo journalctl -u tdx-mcp -n 20
```

### Generate API Key

```bash
# One-time API key generation
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate and copy to .env
KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") && \
  echo "MCP_API_KEY=$KEY" | sudo tee -a /opt/tdx-mcp/.env && \
  echo "Generated API key: $KEY"
```

---

## Command Aliases (Optional)

Add to `~/.bashrc` on Ubuntu for shortcuts:

```bash
# Tail service logs
alias log-tdx='sudo journalctl -u tdx-mcp -f'

# Service status
alias status-tdx='sudo systemctl status tdx-mcp'

# Restart service
alias restart-tdx='sudo systemctl restart tdx-mcp'

# Go to app directory
alias app-tdx='cd /opt/tdx-mcp'

# Health check
alias health-tdx='curl http://localhost:3000/health'

# List tools
alias tools-tdx='curl http://localhost:3000/tools'

# Edit config
alias config-tdx='sudo nano /opt/tdx-mcp/.env'

# Service diagnostics
alias diag-tdx='echo "Status:" && sudo systemctl status tdx-mcp --no-pager && echo "" && echo "Disk:" && du -sh /opt/tdx-mcp && echo "" && echo "Port:" && sudo lsof -i :3000'
```

Load aliases:
```bash
source ~/.bashrc
```

Then use: `log-tdx`, `status-tdx`, `restart-tdx`, etc.

---

## Firewall Quick Commands

```bash
# Check firewall status
sudo ufw status

# Enable firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow port 3000
sudo ufw allow 3000/tcp

# Restrict port 3000 to specific network
sudo ufw allow from 192.168.1.0/24 to any port 3000

# View all rules
sudo ufw status verbose

# Delete a rule
sudo ufw delete allow 3000/tcp
```

---

## Monitoring & Alerts

### Simple Health Check Script

Create `/opt/tdx-mcp/health-check.sh`:

```bash
#!/bin/bash

ENDPOINT="http://localhost:3000/health"
RESPONSE=$(curl -s "$ENDPOINT")

if [[ $RESPONSE == *"ok"* ]]; then
  echo "✓ Service is healthy"
  exit 0
else
  echo "✗ Service health check failed: $RESPONSE"
  exit 1
fi
```

Run periodically with cron:

```bash
# Every 5 minutes
*/5 * * * * /opt/tdx-mcp/health-check.sh >> /var/log/tdx-mcp-health.log 2>&1

# Every hour
0 * * * * /opt/tdx-mcp/health-check.sh >> /var/log/tdx-mcp-health.log 2>&1
```

---

## SSH Commands (From Windows)

```powershell
# SSH to server
ssh ubuntu@10.210.1.38

# Execute remote command
ssh ubuntu@10.210.1.38 "sudo systemctl status tdx-mcp"

# SCP file from server
scp ubuntu@10.210.1.38:/opt/tdx-mcp/.env ./backup.env

# SCP file to server
scp ./local-file.txt ubuntu@10.210.1.38:/tmp/

# SSH with port
ssh -p 2222 ubuntu@10.210.1.38

# SSH with specific key
ssh -i "C:\Users\username\.ssh\id_rsa" ubuntu@10.210.1.38

# SSH tunnel (forward port)
ssh -L 3000:localhost:3000 ubuntu@10.210.1.38
# Then access at http://localhost:3000
```

---

## Deployment Pipeline (CI/CD Ready)

```powershell
# Deploy function for automation
function Deploy-TDXToUbuntu {
  param(
    [string]$ServerIP,
    [string]$Username = "ubuntu"
  )
  
  Write-Host "Deploying TDX MCP to $ServerIP..."
  .\deploy\ubuntu\deploy-to-ubuntu.ps1 -ServerIP $ServerIP -Username $Username -Mode update
  
  # Wait for service to be ready
  Start-Sleep -Seconds 2
  
  # Verify deployment
  $health = curl "http://$ServerIP`:3000/health" -ErrorAction SilentlyContinue
  if ($health -match "ok") {
    Write-Host "✓ Deployment successful!" -ForegroundColor Green
  } else {
    Write-Host "✗ Health check failed" -ForegroundColor Red
  }
}

# Usage
Deploy-TDXToUbuntu -ServerIP 10.210.1.38
```

---

## Backup & Recovery

```bash
# Backup everything
sudo tar -czf tdx-mcp-backup-$(date +%Y%m%d-%H%M%S).tar.gz /opt/tdx-mcp/

# Backup to Windows (from Windows PowerShell)
scp ubuntu@10.210.1.38:/opt/tdx-mcp/.env ./backups/env-backup-$(Get-Date -f "yyyyMMdd").env

# Restore from backup
sudo tar -xzf tdx-mcp-backup-20260720-120000.tar.gz -C /

# Copy .env from backup
sudo cp /opt/tdx-mcp/.env.backup /opt/tdx-mcp/.env
```

---

**Last Updated**: 2026-07-20  
**Current Server**: 10.210.1.38  
**Status**: ✓ Running
