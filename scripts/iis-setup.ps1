<#
.SYNOPSIS
Manual IIS configuration script for PASCO-TDX-MCP Application Pool and Virtual Application.

.DESCRIPTION
This script can be run separately to configure IIS if needed for debugging or manual setup.
It handles:
- Creating the PASCO-TDX-MCP Application Pool with DMZ service account identity
- Creating the PASCO-TDX-MCP Virtual Application
- Configuring URL Rewrite for reverse proxy
- Setting SSL binding

.PARAMETER DeploymentDir
The physical path to the application: E:\Websites\PASCO-TDX-MCP

.PARAMETER ServiceAccount
Optional service account for Application Pool identity (format: DOMAIN\username)

.PARAMETER CertificateThumbprint
Optional SSL certificate thumbprint for HTTPS binding

.EXAMPLE
.\iis-setup.ps1 -DeploymentDir "E:\Websites\PASCO-TDX-MCP"
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$DeploymentDir = "E:\Websites\PASCO-TDX-MCP",
    
    [Parameter(Mandatory=$false)]
    [string]$ServiceAccount,
    
    [Parameter(Mandatory=$false)]
    [string]$CertificateThumbprint,
    
    [Parameter(Mandatory=$false)]
    [string]$SiteName = "Default Web Site"
)

$ErrorActionPreference = "Stop"

# Configuration constants
$poolName = "PASCO-TDX-MCP"
$appName = "PASCO-TDX-MCP"
$port = 443
$protocol = "https"

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

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

try {
    # Verify deployment directory exists
    if (-not (Test-Path $DeploymentDir)) {
        throw "Deployment directory not found: $DeploymentDir"
    }
    
    Write-Heading "IIS Configuration for PASCO-TDX-MCP"
    
    # Import IIS module
    Write-Host "Importing IIS WebAdministration module..."
    Import-Module WebAdministration -ErrorAction Stop
    Write-Success "IIS module imported"

    Write-Heading "Step 1: Create Application Pool"
    
    # Check if pool exists
    if (Test-Path "IIS:\AppPools\$poolName") {
        Write-Host "Application Pool '$poolName' already exists"
        Write-Host "Reconfiguring..."
    } else {
        Write-Host "Creating Application Pool: $poolName"
        New-WebAppPool -Name $poolName
        Write-Success "Application Pool created"
    }
    
    # Configure Application Pool settings
    Write-Host "Configuring Application Pool settings..."
    $pool = Get-Item "IIS:\AppPools\$poolName"
    
    # Set .NET runtime version
    $pool.managedRuntimeVersion = "v4.0"
    $pool.enable32BitAppOn64bit = $false
    
    # Set process model to use specific identity if provided
    if ($ServiceAccount) {
        Write-Host "Setting Application Pool identity to: $ServiceAccount"
        $pool.processModel.identityType = 3  # SpecificUser
        $pool.processModel.userName = $ServiceAccount
        # NOTE: Password must be set separately via AppCmd.exe or UI
        Write-Warning-Custom "If using service account, set password via IIS Manager or AppCmd.exe"
    } else {
        $pool.processModel.identityType = 2  # ApplicationPoolIdentity (default)
        Write-Host "Using default ApplicationPoolIdentity"
    }
    
    # Recycling settings
    $pool.recycleConfig.logEventOnRecycle = 4294967295
    $pool.recycleConfig.disallowRotationOnConfigChange = $false
    
    # Process model settings
    $pool.processModel.loadUserProfile = $true
    $pool.processModel.setProfileEnvironment = $true
    $pool.processModel.shutdownTimeLimit = 90000  # 90 seconds
    $pool.processModel.startupTimeLimit = 90000   # 90 seconds
    
    # Failure settings
    $pool.failure.rapidFailProtection = $true
    $pool.failure.rapidFailProtectionMaxFailures = 5
    $pool.failure.rapidFailProtectionInterval = 300  # 5 minutes
    
    $pool | Set-Item
    Write-Success "Application Pool configured"

    Write-Heading "Step 2: Create Virtual Application"
    
    # Check if virtual app exists
    $vappPath = "IIS:\Sites\$siteName\$appName"
    
    if (Test-Path $vappPath) {
        Write-Host "Virtual Application '$appName' already exists"
        Write-Host "Updating physical path..."
        Set-ItemProperty -PSPath $vappPath -Name "physicalPath" -Value $DeploymentDir
        Write-Success "Virtual Application updated"
    } else {
        Write-Host "Creating Virtual Application: $appName"
        New-WebApplication -Name $appName -Site $siteName -ApplicationPool $poolName -PhysicalPath $DeploymentDir
        Write-Success "Virtual Application created"
    }

    Write-Heading "Step 3: Configure URL Rewrite (Reverse Proxy)"
    
    Write-Host "Setting up reverse proxy rule to http://localhost:3000"
    
    # Create web.config if it doesn't exist
    $webConfigPath = Join-Path $DeploymentDir "web.config"
    if (-not (Test-Path $webConfigPath)) {
        Write-Host "Creating web.config..."
        
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
      <outboundRules>
        <rule name="ReverseProxyContentEncoding" preCondition="ResponseIsGzipped">
          <match filterByTags="Vary" pattern=".*" negate="false" />
          <action type="Rewrite" value="Accept-Encoding" />
        </rule>
      </outboundRules>
      <preConditions>
        <preCondition name="ResponseIsGzipped">
          <add input="{RESPONSE_Content_Encoding}" pattern="gzip" />
        </preCondition>
      </preConditions>
    </rewrite>
    <security>
      <requestFiltering>
        <fileExtensions>
          <add fileExtension=".config" allowed="false" />
          <add fileExtension=".env" allowed="false" />
        </fileExtensions>
      </requestFiltering>
    </security>
    <directoryBrowse enabled="false" />
    <defaultDocument>
      <files>
        <add value="index.html" />
      </files>
    </defaultDocument>
  </system.webServer>
</configuration>
"@
        
        Set-Content -Path $webConfigPath -Value $webConfigContent
        Write-Success "web.config created with URL Rewrite rules"
    } else {
        Write-Host "web.config already exists"
        Write-Warning-Custom "Please verify URL Rewrite rules are configured correctly"
    }

    Write-Heading "Step 4: Configure SSL Binding"
    
    if ($CertificateThumbprint) {
        Write-Host "Configuring SSL binding with certificate: $CertificateThumbprint"
        
        # Verify certificate exists
        $cert = Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object { $_.Thumbprint -eq $CertificateThumbprint }
        if (-not $cert) {
            throw "Certificate not found with thumbprint: $CertificateThumbprint"
        }
        
        # Add HTTPS binding if not exists
        $site = Get-WebSite -Name $siteName
        $httpsBind = $site.Bindings.Collection | Where-Object { $_.Protocol -eq "https" -and $_.Host -match ".*" }
        
        if (-not $httpsBind) {
            Write-Host "Adding HTTPS binding..."
            New-WebBinding -Name $siteName -Protocol https -Port 443 -HostHeader "*" -SslFlags 1
        }
        
        # Assign certificate
        Get-WebBinding -Name $siteName -Protocol https | Remove-WebBinding -Verbose
        New-WebBinding -Name $siteName -Protocol https -Port 443 -HostHeader "*" -CertificateThumbprint $CertificateThumbprint -CertificateStoreName My -SslFlags 1
        
        Write-Success "SSL binding configured"
    } else {
        Write-Warning-Custom "No certificate provided. SSL binding not configured."
        Write-Host "To configure SSL manually:"
        Write-Host "  1. Open IIS Manager"
        Write-Host "  2. Select 'Default Web Site'"
        Write-Host "  3. Click 'Bindings' in the Actions pane"
        Write-Host "  4. Add HTTPS binding with your certificate"
    }

    Write-Heading "Step 5: Set File Permissions"
    
    Write-Host "Verifying file permissions on deployment directory..."
    
    # Verify IIS APPPOOL user has read/execute permissions
    $appPoolUser = "IIS AppPool\$poolName"
    Write-Host "Ensuring '$appPoolUser' has appropriate permissions..."
    
    icacls $DeploymentDir /grant "$appPoolUser`:(OI)(CI)RX" /T /Q /C
    Write-Success "File permissions configured"

    Write-Heading "Step 6: Verify Configuration"
    
    Write-Host "Checking Application Pool state..."
    $poolState = Get-WebAppPoolState -Name $poolName
    Write-Host "  Status: $($poolState.Value)"
    
    if ($poolState.Value -ne "Started") {
        Write-Host "Starting Application Pool..."
        Start-WebAppPool -Name $poolName
        Start-Sleep -Seconds 2
        $poolState = Get-WebAppPoolState -Name $poolName
        Write-Host "  Status: $($poolState.Value)"
    }
    
    if ($poolState.Value -eq "Started") {
        Write-Success "Application Pool is running"
    } else {
        Write-Warning-Custom "Application Pool is not running. Check Application Event Viewer for errors."
    }

    Write-Heading "Configuration Complete!"
    Write-Host ""
    Write-Host "PASCO-TDX-MCP IIS Configuration Summary:"
    Write-Host "  Application Pool: $poolName"
    Write-Host "  Virtual Application: $appName"
    Write-Host "  Physical Path: $DeploymentDir"
    Write-Host "  Reverse Proxy Target: http://localhost:3000"
    Write-Host "  Site: $siteName"
    Write-Host ""
    Write-Host "Access the application at:"
    if ($CertificateThumbprint) {
        Write-Host "  https://your-server/PASCO-TDX-MCP/"
    } else {
        Write-Host "  http://your-server/PASCO-TDX-MCP/"
    }
    Write-Host ""
    Write-Host "For troubleshooting:"
    Write-Host "  - IIS Logs: C:\inetpub\logs\LogFiles\"
    Write-Host "  - Windows Event Viewer: Application event log"
    Write-Host "  - Check Node.js is running: netstat -ano | findstr 3000"
    Write-Host ""

} catch {
    Write-Error "IIS configuration failed: $_"
    Write-Host "Stack Trace: $($_.ScriptStackTrace)"
    exit 1
}
