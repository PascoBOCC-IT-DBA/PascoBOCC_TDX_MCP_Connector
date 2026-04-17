<#
.SYNOPSIS
Simple local deployment script for PASCO-TDX-MCP to QA DMZ server via WinRM.

.DESCRIPTION
This script handles the complete deployment process:
1. Builds the project locally
2. Connects to QA server via WinRM using your provided credentials
3. Copies build artifacts to E:\Websites\PASCO-TDX-MCP
4. Installs npm production dependencies
5. Creates .env file with TDX credentials
6. Configures IIS Application Pool and Virtual Application
7. Starts the Node.js application

Run this script locally from your machine. You'll be prompted for QA server details and credentials.

.EXAMPLE
.\scripts\deploy-local.ps1

.EXAMPLE
.\scripts\deploy-local.ps1 -QAServer "qa-dmz-server.domain.local" -Username "DOMAIN\serviceaccount"
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$QAServer,
    
    [Parameter(Mandatory=$false)]
    [string]$Username,
    
    [Parameter(Mandatory=$false)]
    [string]$Password,
    
    [Parameter(Mandatory=$false)]
    [string]$TDXBaseUrl,
    
    [Parameter(Mandatory=$false)]
    [string]$TDXBEID,
    
    [Parameter(Mandatory=$false)]
    [string]$TDXWebServicesKey,
    
    [Parameter(Mandatory=$false)]
    [int]$TDXAppId
)

$ErrorActionPreference = "Stop"

function Write-Heading {
    param([string]$Message)
    Write-Host ""
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Read-EnvFile {
    param([string]$Path = ".env")
    $env = @{}
    if (Test-Path $Path) {
        Get-Content $Path | Where-Object { $_ -and -not $_.StartsWith('#') } | ForEach-Object {
            if ($_ -match '^([^=]+)=(.*)$') {
                $env[$matches[1].Trim()] = $matches[2].Trim()
            }
        }
    }
    return $env
}

try {
    Write-Heading "PASCO-TDX-MCP Local Deployment"
    
    # Load TDX configuration from local .env file
    $envVars = Read-EnvFile ".env"
    if ($envVars.Count -gt 0) {
        Write-Host "Loaded TDX configuration from .env file"
        if (-not $TDXBaseUrl -and $envVars['TDX_BASE_URL']) { $TDXBaseUrl = $envVars['TDX_BASE_URL'] }
        if (-not $TDXBEID -and $envVars['TDX_BEID']) { $TDXBEID = $envVars['TDX_BEID'] }
        if (-not $TDXWebServicesKey -and $envVars['TDX_WEB_SERVICES_KEY']) { $TDXWebServicesKey = $envVars['TDX_WEB_SERVICES_KEY'] }
        if (-not $TDXAppId -and $envVars['TDX_APP_ID']) { $TDXAppId = [int]$envVars['TDX_APP_ID'] }
    }
    
    # Collect credentials if not provided
    if (-not $QAServer) {
        $QAServer = Read-Host "QA DMZ Server (FQDN or IP)"
    }
    
    if (-not $Username) {
        $Username = Read-Host "DMZ Domain Username (DOMAIN\username)"
    }
    
    if (-not $Password) {
        $secPassword = Read-Host "DMZ Password" -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPassword)
        $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    }
    
    # Prompt for TDX config only if not already loaded from .env
    if (-not $TDXBaseUrl) {
        Write-Host "TDX configuration not found in .env file. Please enter manually."
        $TDXBaseUrl = Read-Host "TDX Base URL"
    }
    
    if (-not $TDXBEID) {
        $TDXBEID = Read-Host "TDX BEID"
    }
    
    if (-not $TDXWebServicesKey) {
        $TDXWebServicesKey = Read-Host "TDX Web Services Key"
    }
    
    if (-not $TDXAppId) {
        $TDXAppId = [int](Read-Host "TDX App ID")
    }
    
    Write-Host ""
    Write-Host "Configuration Summary:"
    Write-Host "  QA Server: $QAServer"
    Write-Host "  Username: $Username"
    Write-Host "  TDX Base URL: $TDXBaseUrl"
    Write-Host ""
    $confirm = Read-Host "Proceed with deployment? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Deployment cancelled"
        exit 0
    }
    
    Write-Heading "Step 1: Build Project Locally"
    
    Write-Host "Running: npm install"
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed"
    }
    
    Write-Host "Running: npm run build"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm build failed"
    }
    
    Write-Success "Project built successfully"
    
    Write-Heading "Step 2: Connect to QA Server"
    
    $secPassword = ConvertTo-SecureString $Password -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential ($Username, $secPassword)
    
    Write-Host "Establishing WinRM connection to: $QAServer"
    $session = New-PSSession -ComputerName $QAServer -Credential $credential -ErrorAction Stop
    Write-Success "Connected to QA server"
    
    try {
        Write-Heading "Step 3: Copy Build Artifacts"
        
        $sourceDir = ".\dist"
        $targetDir = "E:\Websites\PASCO-TDX-MCP"
        
        Write-Host "Copying dist folder to: $targetDir"
        Copy-Item -Path "$sourceDir\*" -Destination "$targetDir\" -ToSession $session -Recurse -Force
        
        Write-Host "Copying package.json"
        Copy-Item -Path ".\package.json" -Destination "$targetDir\package.json" -ToSession $session -Force
        
        Write-Host "Copying package-lock.json"
        Copy-Item -Path ".\package-lock.json" -Destination "$targetDir\package-lock.json" -ToSession $session -Force
        
        Write-Success "Build artifacts copied"
        
        Write-Heading "Step 4: Configure and Deploy on QA Server"
        
        Invoke-Command -Session $session -ScriptBlock {
            param($DeployDir, $BaseUrl, $Beid, $WebServicesKey, $AppId)
            
            $ErrorActionPreference = "Stop"
            
            # Stop running Node processes
            Write-Host "Stopping any running Node.js processes..."
            Stop-Process -Name node -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
            
            # Install production dependencies
            Write-Host "Installing production dependencies..."
            Push-Location $DeployDir
            npm install --production
            if ($LASTEXITCODE -ne 0) {
                throw "npm install --production failed"
            }
            
            # Create .env file
            Write-Host "Creating .env configuration file..."
            $envContent = @"
TDX_BASE_URL=$BaseUrl
TDX_BEID=$Beid
TDX_WEB_SERVICES_KEY=$WebServicesKey
TDX_APP_ID=$AppId
"@
            
            Set-Content -Path ".env" -Value $envContent -Force
            
            # Restrict .env permissions
            $acl = Get-Acl ".env"
            $acl.SetAccessRuleProtection($true, $false)
            $acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) }
            
            # Get current user for permissions
            $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
            $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                $identity.User, "FullControl", "Allow"
            )
            $acl.AddAccessRule($rule)
            Set-Acl ".env" -AclObject $acl
            
            Pop-Location
            Write-Host "✓ .env file created with restricted permissions"
            
            # Configure IIS
            Write-Host "Configuring IIS..."
            Import-Module WebAdministration -ErrorAction SilentlyContinue
            
            $poolName = "PASCO-TDX-MCP"
            $appName = "PASCO-TDX-MCP"
            $siteName = "BCC"
            
            # Create or update Application Pool
            if (-not (Test-Path "IIS:\AppPools\$poolName")) {
                Write-Host "  Creating Application Pool: $poolName"
                New-WebAppPool -Name $poolName
            }
            
            # Configure Application Pool
            $pool = Get-Item "IIS:\AppPools\$poolName"
            $pool.managedRuntimeVersion = "v4.0"
            $pool.enable32BitAppOn64bit = $false
            $pool | Set-Item
            
            Write-Host "  Application Pool configured"
            
            # Create or update Virtual Application
            $vappPath = "IIS:\Sites\$siteName\$appName"
            if (-not (Test-Path $vappPath)) {
                Write-Host "  Creating Virtual Application: $appName"
                New-WebApplication -Name $appName -Site $siteName -ApplicationPool $poolName -PhysicalPath $DeployDir
            } else {
                Write-Host "  Updating Virtual Application path"
                Set-ItemProperty -PSPath $vappPath -Name "physicalPath" -Value $DeployDir
            }
            
            # Create web.config for reverse proxy
            Write-Host "  Configuring URL Rewrite (reverse proxy to localhost:3000)"
            $webConfigPath = Join-Path $DeployDir "web.config"
            
            if (-not (Test-Path $webConfigPath)) {
                $webConfigContent = @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="PASCO-TDX-MCP-Proxy" stopProcessing="true">
          <match url="^(.*)$" ignoreCase="false" />
          <conditions>
            <add input="{HTTP_HOST}" pattern="." />
          </conditions>
          <action type="Rewrite" url="http://localhost:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
    <security>
      <requestFiltering>
        <fileExtensions>
          <add fileExtension=".env" allowed="false" />
          <add fileExtension=".config" allowed="false" />
        </fileExtensions>
      </requestFiltering>
    </security>
    <directoryBrowse enabled="false" />
  </system.webServer>
</configuration>
"@
                Set-Content -Path $webConfigPath -Value $webConfigContent -Force
                Write-Host "  URL Rewrite configured"
            }
            
            # Start Application Pool if stopped
            $poolState = Get-WebAppPoolState -Name $poolName
            if ($poolState.Value -ne "Started") {
                Write-Host "  Starting Application Pool"
                Start-WebAppPool -Name $poolName
                Start-Sleep -Seconds 2
            }
            
            Write-Host "✓ IIS configured"
            
        } -ArgumentList $targetDir, $TDXBaseUrl, $TDXBEID, $TDXWebServicesKey, $TDXAppId
        
        Write-Heading "Step 5: Start Application"
        
        Invoke-Command -Session $session -ScriptBlock {
            param($DeployDir)
            
            Write-Host "Starting Node.js application..."
            Push-Location $DeployDir
            
            $nodeProcess = Start-Process -FilePath "cmd.exe" `
                -ArgumentList "/c npm start" `
                -WindowStyle Hidden `
                -PassThru
            
            Start-Sleep -Seconds 3
            
            if (Get-Process -Id $nodeProcess.Id -ErrorAction SilentlyContinue) {
                Write-Host "✓ Node.js started (PID: $($nodeProcess.Id))"
            } else {
                throw "Node.js process failed to start"
            }
            
            Pop-Location
        } -ArgumentList $targetDir
        
        Write-Heading "Deployment Complete!"
        Write-Host ""
        Write-Host "✓ PASCO-TDX-MCP deployed successfully to QA"
        Write-Host ""
        Write-Host "Access the server at:"
        Write-Host "  https://$QAServer/PASCO-TDX-MCP/"
        Write-Host ""
        Write-Host "Next steps:"
        Write-Host "  1. Verify Node.js is running: netstat -ano | findstr 3000"
        Write-Host "  2. Check IIS Application Pool: Get-WebAppPool"
        Write-Host "  3. Monitor logs: C:\inetpub\logs\LogFiles\"
        Write-Host ""
        
    } finally {
        Remove-PSSession -Session $session -ErrorAction SilentlyContinue
    }
    
} catch {
    Write-Error-Custom "Deployment failed: $_"
    Write-Host "Stack Trace: $($_.ScriptStackTrace)"
    exit 1
}
