# QA Deployment Checklist (Simplified)

Quick reference for deploying PASCO-TDX-MCP to Windows Server 2022 IIS 10 using the local deployment script.

## Pre-Deployment: One-Time Setup

### Step 1: Gather Information
- [ ] QA DMZ server FQDN or IP: `_______________________________`
- [ ] DMZ domain account: `_______________________________`
- [ ] DMZ domain password: `_______________________________`
- [ ] TDX configuration in local `.env` file (BEID, Web Services Key, Base URL, App ID)

### Step 2: Prepare QA Server (Administrator)

Run on QA server as Administrator:

```powershell
Enable-PSRemoting -Force
New-Item -ItemType Directory -Path "E:\Websites\PASCO-TDX-MCP" -Force
Get-WindowsFeature Web-Server, Web-Rewrite-Module
node --version && npm --version
```

**Checklist:**
- [ ] WinRM enabled
- [ ] IIS 10 + URL Rewrite installed
- [ ] `E:\Websites\PASCO-TDX-MCP` exists
- [ ] Node.js 24.x+ installed
- [ ] Firewall allows WinRM (5985/5986) from your IP
- [ ] Firewall allows HTTPS (443) inbound
- [ ] Server can reach TDX API outbound

## Deployment

### Step 3: Run Deployment Script

From your machine in the repository root:

```powershell
.\scripts\deploy-local.ps1
```

Or with pre-populated server credentials:

```powershell
.\scripts\deploy-local.ps1 `
    -QAServer "qa-dmz-server.domain.local" `
    -Username "DOMAIN\serviceaccount" `
    -Password "password"
```

**Checklist:**
- [ ] Script runs without errors
- [ ] Build succeeded locally
- [ ] WinRM connection established
- [ ] Files copied to QA server
- [ ] npm install completed
- [ ] IIS configured
- [ ] Node.js started

## Post-Deployment Verification

### Step 4: Verify on QA Server

```powershell
Get-WebAppPool -Name "PASCO-TDX-MCP" | Select-Object Name, State
netstat -ano | Select-String ":3000"
Test-Path "E:\Websites\PASCO-TDX-MCP\.env"
```

**Checklist:**
- [ ] Application Pool "PASCO-TDX-MCP" is Started
- [ ] Node.js listening on 127.0.0.1:3000
- [ ] .env file exists

### Step 5: Test HTTPS Access

From your machine:

```powershell
Invoke-WebRequest -Uri "https://qa-dmz-server/PASCO-TDX-MCP/" -SkipCertificateCheck
```

**Checklist:**
- [ ] HTTP 200 response
- [ ] No SSL errors (or self-signed is acceptable)
- [ ] MCP server responding

## Troubleshooting

| Issue | Solution |
|-------|----------|
| WinRM connection fails | Enable on QA: `Enable-PSRemoting -Force`; Check firewall ports 5985/5986 |
| npm install fails | Verify Node.js is installed: `node -v`; Check npm: `npm -v` |
| Node.js won't start | RDP to QA, test: `cd E:\Websites\PASCO-TDX-MCP && npm start` |
| 502 Bad Gateway | Verify: `netstat -ano \| findstr 3000`; Check if Node crashed |
| .env not accessible | Check permissions: `icacls E:\Websites\PASCO-TDX-MCP\.env` |
| TDX API errors | Test connectivity: `Test-NetConnection yourorg.teamdynamix.com -Port 443` |

## Files

- **`scripts/deploy-local.ps1`** — Main deployment script
- **`.env.example`** — Environment template
- **`DEPLOYMENT_GUIDE.md`** — Full deployment guide
- **`DEPLOYMENT_CHECKLIST.md`** — This file

## Quick Redeployment

```powershell
# Run deployment script again after code changes
.\scripts\deploy-local.ps1
```

Script handles: build → stop Node → copy files → npm install → restart

## Support

See DEPLOYMENT_GUIDE.md for detailed troubleshooting and documentation.
