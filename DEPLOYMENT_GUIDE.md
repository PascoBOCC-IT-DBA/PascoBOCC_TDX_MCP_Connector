# PASCO-TDX-MCP Deployment Guide (Simplified)

Simple, manual deployment of the MCP server to Windows Server 2022 IIS 10 in the DMZ QA environment.

## Overview

Deploy directly from your development machine using a PowerShell script that:
- Builds the project locally
- Connects to the QA server via WinRM
- Copies build artifacts
- Installs dependencies
- Configures IIS
- Starts the Node.js application

No CI/CD pipeline needed - just one script to run when you're ready to deploy.

## Prerequisites

### On Your Development Machine
- [ ] PowerShell 7+ or Windows PowerShell 5.1+
- [ ] Node.js LTS (24.x) installed locally
- [ ] npm installed locally
- [ ] Credentials for the QA DMZ server (domain\username and password)

### On the QA DMZ Server
- [ ] Windows Server 2022 with IIS 10 installed
- [ ] Node.js LTS (24.x or later) installed and in PATH
- [ ] npm available in PATH
- [ ] WinRM enabled: `Enable-PSRemoting -Force`
- [ ] Application directory created: `E:\Websites\PASCO-TDX-MCP`
- [ ] Firewall rules:
  - Inbound HTTPS (port 443) from your network
  - WinRM (ports 5985/5986) from your machine's IP
- [ ] Outbound HTTPS access to internal TDX API

### TDX Credentials
Obtain from TDAdmin > Organization Details > API Settings:
- [ ] TDX Web API base URL (e.g., `https://yourorg.teamdynamix.com/TDWebApi/api`)
- [ ] Admin BEID (GUID format)
- [ ] Web Services Key (GUID format)
- [ ] Default Application ID (integer)

## Deployment

### Step 1: Prepare the QA Server (One-Time Setup)

On the QA server, run as Administrator:

```powershell
# Enable WinRM for remote connections
Enable-PSRemoting -Force

# Verify IIS is installed with URL Rewrite
Get-WindowsFeature Web-Server
Get-WindowsFeature Web-Rewrite-Module

# Create application directory
New-Item -ItemType Directory -Path "E:\Websites\PASCO-TDX-MCP" -Force

# Verify Node.js is installed
node --version
npm --version
```

Checklist:
- [ ] WinRM is enabled
- [ ] IIS 10 is installed
- [ ] URL Rewrite module is installed
- [ ] `E:\Websites\PASCO-TDX-MCP` directory exists
- [ ] Node.js 24.x+ is installed
- [ ] Firewall allows WinRM from your machine's IP

### Step 2: Run Deployment Script

From your development machine, in the repository root:

```powershell
# Run the deployment script
.\scripts\deploy-local.ps1
```

You'll be prompted for:
1. QA Server FQDN or IP address
2. DMZ Domain username (DOMAIN\username)
3. DMZ Domain password

The script will automatically load TDX configuration from your local `.env` file.

**Optional: Pre-populate credentials to skip prompts:**

```powershell
.\scripts\deploy-local.ps1 `
    -QAServer "qa-dmz-server.domain.local" `
    -Username "DOMAIN\serviceaccount" `
    -Password "YourPassword"
```

### Step 3: Verify Deployment

Once the script completes, verify on the QA server:

```powershell
# Check IIS Application Pool is running
Get-WebAppPool -Name "PASCO-TDX-MCP" | Select-Object Name, State

# Verify Node.js is listening on localhost:3000
netstat -ano | Select-String ":3000"

# Check Virtual Application is configured
Get-WebApplication -Name "PASCO-TDX-MCP" -Site "BCC"

# Verify .env file exists
Test-Path "E:\Websites\PASCO-TDX-MCP\.env"
```

### Step 4: Test Connectivity

From your machine:

```powershell
# Test HTTPS access to the MCP server
$url = "https://qa-dmz-server.domain.local/PASCO-TDX-MCP/"
Invoke-WebRequest -Uri $url -SkipCertificateCheck -UseBasicParsing
```

Should return HTTP 200 if the server is responding.

## Troubleshooting

### WinRM Connection Failed
- Verify WinRM is enabled on QA server: `Enable-PSRemoting -Force`
- Check firewall allows WinRM (ports 5985/5986) from your machine's IP
- Verify credentials are correct (DOMAIN\username and password)
- Test connectivity: `Test-WSMan -ComputerName qa-dmz-server.domain.local -Credential (Get-Credential)`

### Node.js Not Starting
RDP to QA server and check:

```powershell
# Test npm start manually
cd E:\Websites\PASCO-TDX-MCP
npm start

# Check for errors in console
# If errors appear, fix them and try again
```

### IIS Returns 502 Bad Gateway
Indicates Node.js isn't listening on localhost:3000:

```powershell
# Check Node process is running
Get-Process -Name node

# Check port 3000
netstat -ano | Select-String ":3000"

# If not listening, Node.js may have crashed - check .env file and npm logs
```

### .env File Permissions Error
Check file permissions:

```powershell
icacls "E:\Websites\PASCO-TDX-MCP\.env"

# Should show only admin/system access, NOT world-readable
```

### TDX API Connection Failed
Verify from QA server:

```powershell
# Test connectivity to TDX
Test-NetConnection -ComputerName yourorg.teamdynamix.com -Port 443

# Check .env file has correct credentials
Get-Content "E:\Websites\PASCO-TDX-MCP\.env"

# Check Node logs (may appear in Event Viewer)
Get-EventLog Application -Source "npm*" -Newest 10 -ErrorAction SilentlyContinue
```

## Redeployment

To redeploy after code changes:

1. Commit and push code to repository
2. Run the deployment script again: `.\scripts\deploy-local.ps1`

The script will:
- Rebuild the project locally
- Stop the running Node.js process on QA
- Copy new artifacts
- Restart the service

## Rollback

If something goes wrong, the QA server backup is at `E:\Websites\PASCO-TDX-MCP.backup`:

```powershell
# On QA server:
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Remove-Item "E:\Websites\PASCO-TDX-MCP" -Recurse -Force
Copy-Item "E:\Websites\PASCO-TDX-MCP.backup" -Destination "E:\Websites\PASCO-TDX-MCP" -Recurse
cd E:\Websites\PASCO-TDX-MCP
npm start
```

## Files

- **`scripts/deploy-local.ps1`** — Main deployment script (run from your machine)
- **`.env.example`** — Environment variable template
- **`DEPLOYMENT_GUIDE.md`** — This file
- **`DEPLOYMENT_CHECKLIST.md`** — Quick reference checklist

## Support

For detailed information:
- Check the troubleshooting section above
- Review QA server Event Viewer for application errors
- Check IIS logs: `C:\inetpub\logs\LogFiles\`
- Monitor Node.js console output on the QA server
