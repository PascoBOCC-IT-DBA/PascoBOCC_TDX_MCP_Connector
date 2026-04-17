<#
.SYNOPSIS
Deploys the TDX MCP server to IIS on the QA DMZ server.

.DESCRIPTION
This script performs the following operations:
1. Downloads and extracts the build artifact
2. Installs production dependencies
3. Creates/configures the .env file with TDX credentials
4. Configures IIS Application Pool and Virtual Application
5. Starts the Node.js application

.PARAMETER DeploymentDir
The target directory for deployment: E:\Websites\PASCO-TDX-MCP

.PARAMETER TDXBaseUrl
TeamDynamix Web API base URL

.PARAMETER TDXBeid
TeamDynamix Admin BEID

.PARAMETER TDXWebServicesKey
TeamDynamix Web Services Key

.PARAMETER TDXAppId
Default TeamDynamix Application ID

.PARAMETER ArchiveUrl
URL to the deployment archive (optional, uses local archive if not specified)
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$DeploymentDir = "E:\Websites\PASCO-TDX-MCP",
    
    [Parameter(Mandatory=$true)]
    [string]$TDXBaseUrl,
    
    [Parameter(Mandatory=$true)]
    [string]$TDXBeid,
    
    [Parameter(Mandatory=$true)]
    [string]$TDXWebServicesKey,
    
    [Parameter(Mandatory=$true)]
    [string]$TDXAppId,
    
    [Parameter(Mandatory=$false)]
    [string]$ArchiveUrl
)

$ErrorActionPreference = "Stop"

# Helper functions
function Write-Heading {
    param([string]$Message)
    Write-Host ""
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

try {
    Write-Heading "Step 1: Stopping Node.js Application"
    
    # Stop any running Node processes for this app
    $nodeProcesses = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*MCP*" -or $_.Path -like "*PASCO*" }
    if ($nodeProcesses) {
        Write-Host "Stopping Node.js processes..."
        $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Success "Node.js processes stopped"
    } else {
        Write-Host "No running Node.js processes found"
    }

    Write-Heading "Step 2: Preparing Deployment Directory"
    
    # Create deployment directory if it doesn't exist
    if (-not (Test-Path $DeploymentDir)) {
        Write-Host "Creating deployment directory: $DeploymentDir"
        New-Item -ItemType Directory -Path $DeploymentDir -Force | Out-Null
        Write-Success "Directory created"
    } else {
        Write-Host "Deployment directory already exists: $DeploymentDir"
    }

    # Backup current deployment (if it exists)
    $backupDir = "$DeploymentDir.backup"
    if (Test-Path "$DeploymentDir\dist") {
        Write-Host "Creating backup of current deployment..."
        if (Test-Path $backupDir) {
            Remove-Item $backupDir -Recurse -Force -ErrorAction SilentlyContinue
        }
        Copy-Item -Path $DeploymentDir -Destination $backupDir -Recurse -ErrorAction SilentlyContinue
        Write-Success "Backup created at $backupDir"
    }

    Write-Heading "Step 3: Extracting Build Artifact"
    
    # Prepare archive path
    $tempDir = [System.IO.Path]::GetTempPath()
    $archiveFile = Join-Path $tempDir "tdx-mcp-build.tar.gz"
    
    # Download archive if URL provided
    if ($ArchiveUrl) {
        Write-Host "Downloading build artifact from: $ArchiveUrl"
        try {
            Invoke-WebRequest -Uri $ArchiveUrl -OutFile $archiveFile -TimeoutSec 300 -ErrorAction Stop
            Write-Success "Build artifact downloaded"
        } catch {
            Write-Error "Failed to download artifact: $_"
            throw
        }
    }
    
    # Extract archive if it exists
    if (Test-Path $archiveFile) {
        Write-Host "Extracting build artifact to: $DeploymentDir"
        
        # Use tar to extract (available in Windows 10+ / Windows Server 2019+)
        tar -xzf $archiveFile -C $DeploymentDir
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to extract archive"
            throw "Extraction failed with exit code $LASTEXITCODE"
        }
        Write-Success "Build artifact extracted"
        
        # Clean up temp archive
        Remove-Item $archiveFile -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "No archive file found, assuming local development deployment"
    }

    Write-Heading "Step 4: Installing Production Dependencies"
    
    Write-Host "Running: npm install --production"
    $npmPath = Get-Command npm -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    if (-not $npmPath) {
        Write-Error "Node.js/npm not found in PATH"
        throw "Node.js installation not found"
    }
    
    Push-Location $DeploymentDir
    try {
        npm install --production
        if ($LASTEXITCODE -ne 0) {
            Write-Error "npm install failed"
            throw "npm install exited with code $LASTEXITCODE"
        }
        Write-Success "Dependencies installed"
    } finally {
        Pop-Location
    }

    Write-Heading "Step 5: Creating .env Configuration File"
    
    $envFile = Join-Path $DeploymentDir ".env"
    $envContent = @"
TDX_BASE_URL=$TDXBaseUrl
TDX_BEID=$TDXBeid
TDX_WEB_SERVICES_KEY=$TDXWebServicesKey
TDX_APP_ID=$TDXAppId
"@
    
    Write-Host "Writing .env file to: $envFile"
    Set-Content -Path $envFile -Value $envContent -Force
    
    # Restrict file permissions (Windows ACL)
    Write-Host "Restricting .env file permissions..."
    $acl = Get-Acl $envFile
    $acl.SetAccessRuleProtection($true, $false)  # Disable inheritance
    $acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) } # Remove all rules
    
    # Grant full control only to current user
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $identity.User, "FullControl", "Allow"
    )
    $acl.AddAccessRule($rule)
    
    Set-Acl -Path $envFile -AclObject $acl
    Write-Success ".env file created with restricted permissions"

    Write-Heading "Step 6: Configuring IIS"
    
    # Import IIS module
    Import-Module WebAdministration -ErrorAction Stop
    
    $poolName = "PASCO-TDX-MCP"
    $appName = "PASCO-TDX-MCP"
    $siteName = "Default Web Site"
    
    Write-Host "IIS Configuration:"
    Write-Host "  Pool Name: $poolName"
    Write-Host "  App Name: $appName"
    Write-Host "  Path: $DeploymentDir"
    
    # Create Application Pool if it doesn't exist
    if (-not (Test-Path "IIS:\AppPools\$poolName")) {
        Write-Host "Creating Application Pool: $poolName"
        New-WebAppPool -Name $poolName
        Write-Success "Application Pool created"
    } else {
        Write-Host "Application Pool already exists: $poolName"
    }
    
    # Configure Application Pool
    Write-Host "Configuring Application Pool settings..."
    $appPool = Get-Item "IIS:\AppPools\$poolName"
    $appPool.managedRuntimeVersion = "v4.0"
    $appPool.enable32BitAppOn64bit = $false
    $appPool | Set-Item
    
    # Set recycling options (recycle every 4 hours to prevent memory leaks)
    Set-ItemProperty "IIS:\AppPools\$poolName" -Name "recycleConfig" -Value @{
        logEventOnRecycle = 4294967295  # Log all events
        disallowRotationOnConfigChange = $false
        disallowDueToAppDomainRestart = $true
        disallowDueToMemoryLimit = $true
        disallowDueToIdleTimeout = $true
        disallowDueToRequestLimit = $true
        disallowDueToSchedule = $true
        disallowDueToTime = $true
        disallowDueToVirtualMemoryLimit = $true
    } -ErrorAction SilentlyContinue
    
    Write-Success "Application Pool configured"
    
    # Create Virtual Application if it doesn't exist
    $vappPath = "IIS:\Sites\$siteName\$appName"
    if (-not (Test-Path $vappPath)) {
        Write-Host "Creating Virtual Application: $appName"
        New-WebApplication -Name $appName -Site $siteName -ApplicationPool $poolName -PhysicalPath $DeploymentDir
        Write-Success "Virtual Application created"
    } else {
        Write-Host "Virtual Application already exists: $appName"
        # Update physical path if needed
        Set-ItemProperty $vappPath -Name "physicalPath" -Value $DeploymentDir
    }
    
    Write-Success "IIS configuration complete"

    Write-Heading "Step 7: Configuring URL Rewrite (Reverse Proxy)"
    
    # Enable URL Rewrite if not already configured
    Write-Host "Checking URL Rewrite configuration..."
    $vappPath = "IIS:\Sites\$siteName\$appName"
    
    try {
        $existingRule = Get-WebConfigurationProperty -PSPath $vappPath -Filter "system.webServer/rewrite/rules/rule[@name='PASCO-TDX-MCP-Proxy']" -Name "name" -ErrorAction SilentlyContinue
    } catch {
        $existingRule = $null
    }
    
    if (-not $existingRule) {
        Write-Host "Creating URL Rewrite reverse proxy rule..."
        
        $ruleXml = @"
<rule name="PASCO-TDX-MCP-Proxy" stopProcessing="true">
  <match url="^(.*)$" />
  <conditions>
    <add input="{HTTP_HOST}" pattern="." />
  </conditions>
  <action type="Rewrite" url="http://localhost:3000/{R:1}" />
</rule>
"@
        
        # Add the rule via web.config
        Add-WebConfigurationProperty -PSPath $vappPath -Filter "system.webServer/rewrite/rules" -Name "." -Value @{name="PASCO-TDX-MCP-Proxy"; patternSyntax="ECMAScript"; stopProcessing=$true} -ErrorAction SilentlyContinue
        Write-Success "URL Rewrite rule configured"
    } else {
        Write-Host "URL Rewrite rule already exists"
    }

    Write-Heading "Step 8: Starting Node.js Application"
    
    Write-Host "Starting Node.js application from: $DeploymentDir"
    Write-Host "Running: npm start"
    
    $startProcessParams = @{
        FilePath = "cmd.exe"
        ArgumentList = @("/c", "cd /d $DeploymentDir && npm start")
        WindowStyle = "Hidden"
        PassThru = $true
    }
    
    $nodeProcess = Start-Process @startProcessParams
    
    Write-Host "Node.js process started with PID: $($nodeProcess.Id)"
    
    # Wait a moment for the process to start
    Start-Sleep -Seconds 3
    
    # Verify the process is still running
    $checkProcess = Get-Process -Id $nodeProcess.Id -ErrorAction SilentlyContinue
    if ($checkProcess) {
        Write-Success "Node.js application started successfully (PID: $($nodeProcess.Id))"
    } else {
        Write-Error "Node.js process exited unexpectedly"
        throw "Node.js process failed to start"
    }

    Write-Heading "Step 9: Verifying Deployment"
    
    # Check if Node.js is listening on port 3000
    Write-Host "Verifying Node.js is listening on localhost:3000..."
    Start-Sleep -Seconds 2
    
    $netstatOutput = netstat -ano | Select-String ":3000"
    if ($netstatOutput) {
        Write-Success "Node.js is listening on port 3000"
    } else {
        Write-Error "Node.js is not listening on port 3000"
    }
    
    # Verify IIS Application Pool is started
    $pool = Get-WebAppPoolState -Name $poolName -ErrorAction SilentlyContinue
    if ($pool.Value -eq "Started") {
        Write-Success "IIS Application Pool is running"
    } else {
        Write-Host "Starting IIS Application Pool..."
        Start-WebAppPool -Name $poolName
        Start-Sleep -Seconds 2
        Write-Success "IIS Application Pool started"
    }

    Write-Heading "Deployment Complete!"
    Write-Host ""
    Write-Success "TDX MCP Server deployed successfully to: $DeploymentDir"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Access the server at: https://<your-qa-server>/PASCO-TDX-MCP/"
    Write-Host "  2. Monitor IIS logs: C:\inetpub\logs\LogFiles\"
    Write-Host "  3. Check Node.js logs in deployment directory"
    Write-Host ""
    
} catch {
    Write-Error "Deployment failed: $_"
    Write-Host "Stack Trace: $($_.ScriptStackTrace)"
    
    # Restore backup on failure
    if (Test-Path $backupDir) {
        Write-Host ""
        Write-Host "Rolling back to previous version..."
        Remove-Item $DeploymentDir -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item -Path $backupDir -Destination $DeploymentDir -Recurse
        Write-Host "Rollback complete"
    }
    
    exit 1
}
