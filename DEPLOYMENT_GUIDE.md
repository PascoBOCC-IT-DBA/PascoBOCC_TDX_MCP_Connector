# PASCO-TDX-MCP Deployment Guide

Complete guide for deploying the MCP server to Windows Server 2022 IIS 10 in the DMZ QA environment.

## Overview

This deployment uses:
- **GitHub Actions** to build and orchestrate deployment
- **WinRM PowerShell remoting** to execute deployment scripts on the QA DMZ server
- **IIS 10 reverse proxy** to forward HTTPS traffic to Node.js running locally
- **Node.js** running on `localhost:3000` as the MCP server process

## Prerequisites

### On Your Development Machine
- [ ] GitHub repository with this code
- [ ] Access to GitHub Actions (workflow will run in cloud)
- [ ] Credentials for the QA DMZ server (domain\username and password)

### On the QA DMZ Server
- [ ] Windows Server 2022 with IIS 10 installed
- [ ] Node.js LTS (22.x or later) installed and in PATH
- [ ] npm available in PATH
- [ ] **WinRM enabled** (check: `Enable-PSRemoting -Force` if not already enabled)
- [ ] Application directory created: `E:\Websites\PASCO-TDX-MCP`
- [ ] Outbound HTTPS access to internal TDX API
- [ ] Firewall rules allowing:
  - Inbound HTTPS (port 443) from authorized sources
  - WinRM traffic (ports 5985/5986) from GitHub Actions runners or your network

### TDX Credentials
Obtain these from TDAdmin > Organization Details > API Settings:
- [ ] TDX Web API base URL (e.g., `https://yourorg.teamdynamix.com/TDWebApi/api`)
- [ ] Admin BEID (GUID format)
- [ ] Web Services Key (GUID format)
- [ ] Default Application ID (integer)

## Setup Steps

### Step 1: Configure GitHub Secrets

GitHub Actions needs credentials and configuration to deploy to your QA server.

1. Go to your GitHub repository
2. Click **Settings** (gear icon in the top right)
3. In the left sidebar under **Security**, click **Secrets and variables**
4. Click the **Actions** tab (to scope secrets to GitHub Actions)
5. Click the **Secrets** tab at the top
6. Click **New repository secret** and add the following secrets:

#### WinRM/DMZ Server Credentials
- **Name:** `DMZ_WINRM_HOST`  
  **Value:** FQDN or IP of your QA DMZ server (e.g., `qa-dmz-server.domain.local` or `192.168.x.x`)

- **Name:** `DMZ_WINRM_USERNAME`  
  **Value:** DMZ domain user (format: `DOMAIN\username`)

- **Name:** `DMZ_WINRM_PASSWORD`  
  **Value:** Password for the DMZ domain user

#### TDX API Configuration
- **Name:** `TDX_BASE_URL`  
  **Value:** Your TDX Web API base URL (e.g., `https://yourorg.teamdynamix.com/TDWebApi/api`)

- **Name:** `TDX_BEID`  
  **Value:** Your TDX Admin BEID

- **Name:** `TDX_WEB_SERVICES_KEY`  
  **Value:** Your TDX Web Services Key

- **Name:** `TDX_APP_ID`  
  **Value:** Your default TDX Application ID

#### Post-Deployment Testing
- **Name:** `QA_SERVER_URL`  
  **Value:** Base HTTPS URL of your QA server (e.g., `https://qa-dmz-server.domain.local`)

### Step 2: Prepare QA DMZ Server

#### 2.1 Verify Prerequisites

SSH/RDP to the QA server and verify:

```powershell
# Check Node.js is installed
node --version
npm --version

# Verify IIS is installed
Get-WindowsFeature Web-Server

# Check IIS URL Rewrite is installed
Get-WindowsFeature Web-Rewrite-Module

# Verify WinRM is enabled
winrm quickconfig -q

# Create application directory
New-Item -ItemType Directory -Path "E:\Websites\PASCO-TDX-MCP" -Force
```

#### 2.2 Configure WinRM for Remote Deployment

If WinRM is not yet configured for remote connections:

```powershell
# Enable WinRM
Enable-PSRemoting -Force

# Add GitHub Actions runner IPs to TrustedHosts (if needed)
# Option 1: Allow all internal network
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "*" -Force

# Option 2: Allow specific IP
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "203.0.113.0" -Concatenate -Force

# Verify WinRM is listening
Get-PSSessionConfiguration

# Test WinRM connectivity (from your machine or GitHub runner)
# From PowerShell: $cred = Get-Credential; Test-WSMan -ComputerName qa-dmz-server.domain.local -Credential $cred
```

#### 2.3 Create DMZ Service Account (if not already created)

The IIS Application Pool will run under a DMZ domain service account for auditing and credential management.

```powershell
# This is typically done by your domain admin
# Account should have permissions to:
#  - Read/write to E:\Websites\PASCO-TDX-MCP
#  - Log on as a service
#  - Be used by IIS
```

### Step 3: Deploy the MCP Server

The deployment is fully automated via GitHub Actions. There are two ways to trigger it:

#### Option A: Automatic Deployment (On Push)

Push code to the `main` branch to trigger automatic deployment:

```bash
git push origin main
```

The `.github/workflows/deploy-qa.yml` workflow will automatically:
1. Build the project
2. Create a deployment archive
3. Connect to the QA server via WinRM
4. Execute the deployment script
5. Run smoke tests

#### Option B: Manual Deployment (Workflow Dispatch)

1. Go to GitHub repository
2. Click **Actions** tab
3. Select **"Deploy to QA"** workflow
4. Click **"Run workflow"**
5. Select branch (typically `main`)
6. Click **"Run workflow"**

Watch the workflow run in real-time for logs and any errors.

### Step 4: Verify Deployment

Once the workflow completes successfully, verify the deployment:

#### 4.1 Check IIS Configuration

RDP to the QA server and verify:

```powershell
# Verify Application Pool exists and is running
Get-WebAppPool -Name "PASCO-TDX-MCP" | Select-Object Name, State

# Verify Virtual Application exists
Get-WebApplication -Name "PASCO-TDX-MCP" -Site "Default Web Site" | Select-Object Name, PhysicalPath

# Verify .env file exists with restricted permissions
icacls "E:\Websites\PASCO-TDX-MCP\.env"
```

#### 4.2 Check Node.js is Running

```powershell
# Verify Node.js is listening on localhost:3000
netstat -ano | Select-String ":3000"

# Expected output should show something like:
#   TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       <PID>

# Optional: Get Node.js process details
Get-Process -Name node | Select-Object Name, ID, WorkingSet
```

#### 4.3 Test IIS Reverse Proxy

From your development machine or the QA server, test HTTPS access:

```powershell
# Test with PowerShell
$url = "https://qa-dmz-server.domain.local/PASCO-TDX-MCP/"
$response = Invoke-WebRequest -Uri $url -UseBasicParsing -SkipCertificateCheck

# Check response status
Write-Host "Status: $($response.StatusCode)"
Write-Host "Response length: $($response.Content.Length) bytes"
```

#### 4.4 Check Logs

Monitor deployment and runtime logs:

```powershell
# IIS Access Logs (requests to the reverse proxy)
Get-Content "C:\inetpub\logs\LogFiles\W3SVC1\*.log" -Wait

# Windows Event Viewer
Get-EventLog Application -Source IIS-AspNetCore -Newest 20

# Check for Node.js process startup errors
Get-EventLog Application -Newest 50 | Select-Object TimeGenerated, Source, Message
```

### Step 5: Initial Testing

Once verified, test that the MCP server is functional:

#### 5.1 Simple Connectivity Test

```powershell
# From your dev machine
$url = "https://qa-dmz-server.domain.local/PASCO-TDX-MCP/"
Invoke-WebRequest -Uri $url -SkipCertificateCheck
```

#### 5.2 Test MCP Protocol

The MCP server should respond to MCP protocol requests. Check with your MCP client (e.g., GitHub Copilot Chat configured to use the MCP server).

#### 5.3 Test TDX API Integration

Via your MCP client, call one of the TDX tools to verify API connectivity:
- Try: `tdx-ticket-search` with a simple filter
- Verify the server can authenticate to TDX and retrieve data

## Troubleshooting

### Deployment Fails - GitHub Actions Workflow Error

Check the workflow logs in GitHub Actions:

1. Go to repository **Actions** tab
2. Select the failed "Deploy to QA" workflow run
3. Click the failed job for detailed logs
4. Common issues:
   - **WinRM connection timeout:** Verify firewall allows WinRM from GitHub Actions IPs
   - **Invalid credentials:** Double-check DMZ_WINRM_PASSWORD and DMZ_WINRM_USERNAME in secrets
   - **Path not found:** Verify `E:\Websites\PASCO-TDX-MCP` exists on QA server

### Node.js Not Starting

RDP to QA server and run deployment script manually for more details:

```powershell
# Stop any running processes
Stop-Process -Name node -Force -ErrorAction SilentlyContinue

# Run deploy script manually
cd "E:\Websites\PASCO-TDX-MCP"
npm install --production
npm start

# Check for errors
Get-EventLog Application -Newest 20
```

### IIS Returns 502 Bad Gateway

Indicates IIS reverse proxy can't reach Node.js on localhost:3000:

```powershell
# Check Node.js is running
Get-Process -Name node

# Check port 3000 is listening
netstat -ano | Select-String ":3000"

# Restart Node.js if not running
cd "E:\Websites\PASCO-TDX-MCP"
npm start

# Check IIS logs for more details
Get-Content "C:\inetpub\logs\LogFiles\W3SVC1\*.log" -Wait
```

### HTTPS Certificate Issues

If SSL certificate errors occur:

1. Verify the SSL certificate is installed on the QA server
2. Confirm the certificate is bound to the correct IIS site
3. Check certificate expiration: `Get-ChildItem Cert:\LocalMachine\My | Select-Object Thumbprint, Subject, NotAfter`
4. Add certificate to IIS binding if needed (manual step in IIS Manager)

### .env File Not Accessible

Verify file permissions:

```powershell
# Check .env is readable only by app pool
icacls "E:\Websites\PASCO-TDX-MCP\.env"

# Verify it's NOT readable from web
curl "https://qa-dmz-server.domain.local/PASCO-TDX-MCP/.env" -SkipCertificateCheck
# Should return 403 Forbidden
```

### TDX API Not Responding

Check TDX connectivity from QA server:

```powershell
# Verify outbound connectivity to TDX
Test-NetConnection -ComputerName yourorg.teamdynamix.com -Port 443

# Check .env file has correct TDX credentials
Get-Content "E:\Websites\PASCO-TDX-MCP\.env" -Verbose

# Monitor Node.js logs for API errors
# Check Windows Event Viewer for any exceptions
```

## Rollback Deployment

If deployment fails or causes issues:

1. The deployment script automatically creates a backup at `E:\Websites\PASCO-TDX-MCP.backup`
2. To rollback manually:

```powershell
# Stop Node.js
Stop-Process -Name node -Force -ErrorAction SilentlyContinue

# Restore backup
Remove-Item "E:\Websites\PASCO-TDX-MCP" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "E:\Websites\PASCO-TDX-MCP.backup" -Destination "E:\Websites\PASCO-TDX-MCP" -Recurse

# Restart Node.js
cd "E:\Websites\PASCO-TDX-MCP"
npm start
```

## Security Considerations

✓ **Implemented:**
- `.env` file with restricted permissions (readable only by app pool identity)
- IIS reverse proxy hides Node.js internals
- HTTPS termination at IIS boundary
- Application Pool runs under DMZ domain service account
- Secrets stored in GitHub Secrets (not in code)

⚠ **Additional Recommendations:**
- Regularly rotate TDX Web Services Key
- Monitor IIS logs for suspicious activity
- Configure centralized logging (Azure Monitor, Splunk, etc.)
- Use SSL/TLS certificate pinning in production
- Implement network-level access controls
- Restrict MCP endpoint access by IP/domain

## Maintenance

### Regular Tasks

- **Weekly:** Monitor IIS and Application Event logs for errors
- **Monthly:** Review firewall rules and network connectivity
- **Quarterly:** Update Node.js LTS version
- **Annually:** Renew SSL/TLS certificate before expiration

### Updating the Deployment

To deploy new code:

1. Push code to `main` branch (automatic) or
2. Run workflow manually via Actions tab

The deployment script will:
- Back up current deployment
- Extract new build
- Install dependencies
- Restart Node.js
- Rollback on failure

## Support & Documentation

- **MCP Protocol:** https://modelcontextprotocol.io/
- **TeamDynamix API:** https://solutions.teamdynamix.com/TDWebApi/
- **IIS URL Rewrite:** https://learn.microsoft.com/en-us/iis/extensions/url-rewrite-module/url-rewrite-module-configuration-reference
- **PowerShell WinRM:** https://learn.microsoft.com/en-us/windows/win32/winrm/installation-and-configuration-for-windows-remote-management

## Questions?

For issues or questions:
1. Check GitHub Actions workflow logs
2. Review this troubleshooting section
3. Check QA server Application Event Viewer
4. Review IIS logs in `C:\inetpub\logs\LogFiles\`
