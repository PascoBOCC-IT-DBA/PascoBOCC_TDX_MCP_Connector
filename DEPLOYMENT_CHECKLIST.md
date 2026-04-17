# QA Deployment Checklist

Quick reference for deploying PASCO-TDX-MCP to Windows Server 2022 IIS 10.

## Pre-Deployment: One-Time Setup

### Step 1: Gather QA Server Information
- [ ] QA DMZ server FQDN or IP address: `_______________________________`
- [ ] DMZ domain account username: `_______________________________`
- [ ] DMZ domain account password: `_______________________________` (securely stored)
- [ ] TDX Base URL: `_______________________________`
- [ ] TDX BEID: `_______________________________`
- [ ] TDX Web Services Key: `_______________________________`
- [ ] TDX App ID: `_______________________________`
- [ ] QA Server HTTPS URL: `_______________________________`

### Step 2: Prepare QA DMZ Server (One-Time, Before First Deployment)

On the QA server, run (as Administrator):

```powershell
# Enable WinRM for remote deployment
Enable-PSRemoting -Force

# Verify IIS is installed with URL Rewrite
Get-WindowsFeature Web-Server, Web-Rewrite-Module

# Create application directory
New-Item -ItemType Directory -Path "E:\Websites\PASCO-TDX-MCP" -Force

# Verify Node.js is installed
node --version
npm --version

# Optional: Test WinRM connectivity from your machine
$cred = Get-Credential
Test-WSMan -ComputerName <qa-server-fqdn> -Credential $cred
```

**Checklist:**
- [ ] WinRM is enabled on QA server
- [ ] IIS 10 is installed
- [ ] URL Rewrite module is installed
- [ ] `E:\Websites\PASCO-TDX-MCP` directory exists
- [ ] Node.js LTS (22.x+) is installed
- [ ] Firewall allows inbound HTTPS (443) and WinRM (5985/5986)
- [ ] Outbound HTTPS to TDX API is allowed

### Step 3: Configure GitHub Secrets

1. Go to GitHub Repository → **Settings** → **Secrets and variables** → **Actions**
2. Add these 8 secrets:

| Secret Name | Value |
|-------------|-------|
| `DMZ_WINRM_HOST` | QA DMZ server FQDN (e.g., `qa-server.domain.local`) |
| `DMZ_WINRM_USERNAME` | DMZ domain user (e.g., `DOMAIN\serviceaccount`) |
| `DMZ_WINRM_PASSWORD` | DMZ domain password |
| `TDX_BASE_URL` | TDX API base URL |
| `TDX_BEID` | TDX Admin BEID |
| `TDX_WEB_SERVICES_KEY` | TDX Web Services Key |
| `TDX_APP_ID` | TDX Application ID |
| `QA_SERVER_URL` | QA server HTTPS base URL (e.g., `https://qa-server.domain.local`) |

**Checklist:**
- [ ] All 8 GitHub Secrets are configured
- [ ] Secrets are properly formatted (no extra spaces/quotes)
- [ ] Credentials are correct (test with WinRM if possible)

## Deployment

### Step 4: Trigger Deployment

**Option A: Automatic (Push to main)**
```bash
git push origin main
```

**Option B: Manual (Actions Tab)**
1. Go to GitHub **Actions** → **Deploy to QA**
2. Click **Run workflow**
3. Select branch and confirm

**Checklist:**
- [ ] Workflow triggered successfully
- [ ] Build succeeded (check Actions logs)
- [ ] WinRM connection succeeded
- [ ] Deployment script executed without errors
- [ ] Node.js started successfully
- [ ] Smoke tests passed

## Post-Deployment Verification

### Step 5: Verify Deployment on QA Server

RDP to QA server and run:

```powershell
# Verify IIS Application Pool is running
Get-WebAppPool -Name "PASCO-TDX-MCP" | Select-Object Name, State

# Verify Node.js is listening on localhost:3000
netstat -ano | Select-String ":3000"

# Verify .env file exists with restricted permissions
Test-Path "E:\Websites\PASCO-TDX-MCP\.env"
icacls "E:\Websites\PASCO-TDX-MCP\.env"
```

**Checklist:**
- [ ] IIS Application Pool `PASCO-TDX-MCP` exists and is **Started**
- [ ] `.env` file exists at `E:\Websites\PASCO-TDX-MCP\.env`
- [ ] `.env` file is readable only by app pool (ACL restricted)
- [ ] Node.js process is listening on `127.0.0.1:3000`

### Step 6: Test HTTPS Connectivity

From your dev machine:

```powershell
# Test HTTPS access to MCP server
$url = "https://qa-server.domain.local/PASCO-TDX-MCP/"
$response = Invoke-WebRequest -Uri $url -SkipCertificateCheck -UseBasicParsing
Write-Host "Status: $($response.StatusCode)"  # Should be 200
```

**Checklist:**
- [ ] HTTPS request returns HTTP 200 (not 502, 404, etc.)
- [ ] Response indicates MCP server is responding
- [ ] No SSL/TLS certificate errors (after accepting self-signed if needed)

### Step 7: Test MCP Functionality

In your MCP client (GitHub Copilot Chat, etc.):

1. Configure client to use: `https://qa-server.domain.local/PASCO-TDX-MCP/`
2. Test a TDX tool call, e.g., `tdx-ticket-search`
3. Verify the tool returns data from TDX

**Checklist:**
- [ ] MCP client connects to server without errors
- [ ] MCP tools are available and listed
- [ ] Test tool call returns expected TDX data
- [ ] API token authentication works

## Monitoring & Maintenance

### Daily (If in Use)
- [ ] Monitor for HTTP 502 errors (Node.js crashed)
- [ ] Check IIS logs for unusual patterns
- [ ] Verify Node.js process is running: `Get-Process node`

### Weekly
- [ ] Review Windows Application Event Log
- [ ] Monitor disk space on `E:\` drive
- [ ] Check that deployments are completing successfully

### Monthly
- [ ] Update Node.js to latest LTS if available: `nvm install 22`
- [ ] Review GitHub Actions workflow runs for failures
- [ ] Verify TDX API credentials haven't changed

## Rollback (If Needed)

If deployment causes issues:

```powershell
# Stop Node.js
Stop-Process -Name node -Force -ErrorAction SilentlyContinue

# Restore backup
Remove-Item "E:\Websites\PASCO-TDX-MCP" -Recurse -Force
Copy-Item "E:\Websites\PASCO-TDX-MCP.backup" -Destination "E:\Websites\PASCO-TDX-MCP" -Recurse

# Restart Node.js
cd "E:\Websites\PASCO-TDX-MCP"
npm start
```

## Troubleshooting Quick Links

See **DEPLOYMENT_GUIDE.md** for detailed troubleshooting:
- Deployment Fails - GitHub Actions Workflow Error
- Node.js Not Starting
- IIS Returns 502 Bad Gateway
- HTTPS Certificate Issues
- .env File Not Accessible
- TDX API Not Responding

## Files Created

- `.github/workflows/deploy-qa.yml` — GitHub Actions workflow
- `scripts/deploy.ps1` — Main deployment script (runs on QA server via WinRM)
- `scripts/iis-setup.ps1` — IIS configuration script (reference/manual use)
- `.env.example` — Environment variable template
- `DEPLOYMENT_GUIDE.md` — Comprehensive deployment documentation
- `DEPLOYMENT_CHECKLIST.md` — This file

## Support

For detailed information, see:
- **DEPLOYMENT_GUIDE.md** — Complete deployment instructions
- **GitHub Actions Logs** — Real-time deployment status
- **QA Server Event Viewer** — Application logs
- **IIS Logs** — Request/response logs (`C:\inetpub\logs\LogFiles\`)
