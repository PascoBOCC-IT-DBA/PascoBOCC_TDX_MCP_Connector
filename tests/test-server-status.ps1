#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Test script to verify TDX MCP Server status and infrastructure

.DESCRIPTION
    Verifies server deployment, HTTP infrastructure, tool registration, and authentication.
    Results can be output to JSON for documentation and comparison.

.PARAMETER ServerUrl
    Server MCP URL endpoint (default: http://10.210.1.38:3000/mcp)

.PARAMETER BearerToken
    Bearer token for authentication (default: TDX API bearer token)

.PARAMETER OutputFormat
    Output format: Console (default) or JSON. JSON results are automatically saved to tests\results directory.

.PARAMETER OutputFile
    Optional file path to override default JSON output location (only used with -OutputFormat JSON)

.EXAMPLE
    .\test-server-status.ps1

.EXAMPLE
    .\test-server-status.ps1 -OutputFormat JSON
#>

param(
    [string]$ServerUrl,
    [string]$BearerToken,
    [ValidateSet("Console", "JSON")]
    [string]$OutputFormat = "Console",
    [string]$OutputFile = ""
)

# Load parameters from test-params.ps1 if it exists
$paramsFile = Join-Path -Path $PSScriptRoot -ChildPath "test-params.ps1"
if (Test-Path $paramsFile) {
    . $paramsFile
    # Use loaded values only if parameters weren't explicitly provided
    if (-not $PSBoundParameters.ContainsKey('ServerUrl')) { $ServerUrl = $ServerUrl }
    if (-not $PSBoundParameters.ContainsKey('BearerToken')) { $BearerToken = $BearerToken }
} else {
    Write-Error "test-params.ps1 not found. Please copy test-params.example.ps1 to test-params.ps1 and fill in your credentials."
    exit 1
}

# Extract base address from ServerUrl (remove scheme and path)
$uri = [System.Uri]$ServerUrl
$serviceBaseUrl = "$($uri.Host):$($uri.Port)"

$results = @{
    timestamp = (Get-Date -AsUTC).ToString("yyyy-MM-ddTHH:mm:ssZ")
    serverAddress = $serviceBaseUrl
    tests = @()
}

function Test-HealthEndpoint {
    param([string]$address)
    
    try {
        $response = Invoke-WebRequest "http://$address/health" -ErrorAction Stop
        return @{
            name = "Health Endpoint"
            status = $response.StatusCode -eq 200 ? "✅ PASS" : "❌ FAIL"
            statusCode = $response.StatusCode
            responseTime = $response.Headers["X-Response-Time"] ?? "N/A"
        }
    } catch {
        return @{
            name = "Health Endpoint"
            status = "❌ FAIL"
            error = $_.Exception.Message
        }
    }
}

function Test-CorsHeaders {
    param([string]$address, [string]$bearerToken)
    
    try {
        $headers = @{
            "Authorization" = "Bearer $bearerToken"
            "Origin" = "http://localhost:3000"
        }
        $response = Invoke-WebRequest "http://$address/health" -Headers $headers -ErrorAction Stop
        $corsHeader = $response.Headers["Access-Control-Allow-Origin"] ?? "Not present"
        
        return @{
            name = "CORS Headers"
            status = $corsHeader -ne "Not present" ? "✅ PASS" : "⚠️ WARNING"
            corsAllowOrigin = $corsHeader
        }
    } catch {
        return @{
            name = "CORS Headers"
            status = "❌ FAIL"
            error = $_.Exception.Message
        }
    }
}

function Test-AuthorizationHeader {
    param([string]$address, [string]$bearerToken)
    
    try {
        # Test with valid auth
        $headers = @{"Authorization" = "Bearer $bearerToken"}
        $response = Invoke-WebRequest "http://$address/tools" -Headers $headers -ErrorAction Stop
        
        return @{
            name = "Authorization Header"
            status = "✅ PASS"
            validToken = $true
        }
    } catch {
        return @{
            name = "Authorization Header"
            status = "❌ FAIL"
            error = $_.Exception.Message
            validToken = $false
        }
    }
}

function Test-ToolRegistration {
    param([string]$address, [string]$bearerToken)
    
    try {
        $headers = @{"Authorization" = "Bearer $bearerToken"}
        $response = Invoke-WebRequest "http://$address/tools" -Headers $headers -ErrorAction Stop
        $tools = $response.Content | ConvertFrom-Json
        
        $readOnlyTools = @($tools | Where-Object { $_.name -match "(search|get|lookup)" }).Count
        $modificationTools = @($tools | Where-Object { $_.name -match "(create|update|patch|delete|feed-add)" }).Count
        
        return @{
            name = "Tool Registration"
            status = "✅ PASS"
            totalToolsRegistered = $tools.Count
            readOnlyTools = $readOnlyTools
            modificationTools = $modificationTools
        }
    } catch {
        return @{
            name = "Tool Registration"
            status = "❌ FAIL"
            error = $_.Exception.Message
        }
    }
}

function Test-JsonRpcEndpoint {
    param([string]$address, [string]$bearerToken)
    
    try {
        $headers = @{
            "Authorization" = "Bearer $bearerToken"
            "Content-Type" = "application/json"
        }
        
        $body = @{
            jsonrpc = "2.0"
            method = "tools/call"
            params = @{
                name = "tdx-statuses-get"
                arguments = @{componentType = "tickets"}
            }
            id = 1
        } | ConvertTo-Json -Depth 10
        
        $response = Invoke-WebRequest "http://$address/mcp" -Method POST -Headers $headers -Body $body -ErrorAction Stop
        
        return @{
            name = "JSON-RPC 2.0 Endpoint"
            status = "✅ PASS"
            responseCode = $response.StatusCode
        }
    } catch {
        return @{
            name = "JSON-RPC 2.0 Endpoint"
            status = "❌ FAIL"
            error = $_.Exception.Message
        }
    }
}

function Test-ConcurrentRequests {
    param([string]$address, [string]$bearerToken)
    
    try {
        $headers = @{"Authorization" = "Bearer $bearerToken"}
        $results = @()
        
        # Send 5 concurrent requests
        1..5 | ForEach-Object {
            $response = Invoke-WebRequest "http://$address/health" -Headers $headers -ErrorAction Stop
            $results += $response.StatusCode
        }
        
        $allSuccess = ($results -eq 200).Count -eq 5
        
        return @{
            name = "Concurrent Request Handling"
            status = $allSuccess ? "✅ PASS" : "❌ FAIL"
            successCount = ($results -eq 200).Count
            totalRequests = $results.Count
        }
    } catch {
        return @{
            name = "Concurrent Request Handling"
            status = "❌ FAIL"
            error = $_.Exception.Message
        }
    }
}

function Test-ResponseTime {
    param([string]$address, [string]$bearerToken)
    
    try {
        $headers = @{"Authorization" = "Bearer $apiKey"}
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest "http://$address/health" -Headers $headers -ErrorAction Stop
        $stopwatch.Stop()
        
        $responseTime = $stopwatch.ElapsedMilliseconds
        $threshold = 1000  # 1 second
        
        return @{
            name = "Response Time"
            status = $responseTime -lt $threshold ? "✅ PASS" : "⚠️ WARNING"
            responseTimeMs = $responseTime
            threshold = $threshold
        }
    } catch {
        return @{
            name = "Response Time"
            status = "❌ FAIL"
            error = $_.Exception.Message
        }
    }
}

# Run all tests
Write-Host "🔍 Starting TDX MCP Server Status Tests" -ForegroundColor Cyan
Write-Host "Server: $serviceBaseUrl" -ForegroundColor Gray
Write-Host ""

$tests = @(
    { Test-HealthEndpoint $serviceBaseUrl },
    { Test-CorsHeaders $serviceBaseUrl $BearerToken },
    { Test-AuthorizationHeader $serviceBaseUrl $BearerToken },
    { Test-ToolRegistration $serviceBaseUrl $BearerToken },
    { Test-JsonRpcEndpoint $serviceBaseUrl $BearerToken },
    { Test-ConcurrentRequests $serviceBaseUrl $BearerToken },
    { Test-ResponseTime $serviceBaseUrl $BearerToken }
)

foreach ($test in $tests) {
    $result = & $test
    $results.tests += $result
    
    if ($OutputFormat -eq "Console") {
        $color = if ($result.status -match "PASS") { "Green" }
                 elseif ($result.status -match "WARNING") { "Yellow" }
                 else { "Red" }
        
        Write-Host "[$($result.status)]  $($result.name)" -ForegroundColor $color
        
        # Show details for each test
        $result.GetEnumerator() | Where-Object { $_.Name -notin @("name", "status") } | ForEach-Object {
            Write-Host "  $($_.Name): $($_.Value)" -ForegroundColor Gray
        }
    }
}

Write-Host ""
$passCount = ($results.tests | Where-Object { $_.status -match "PASS" }).Count
$totalCount = $results.tests.Count
Write-Host "Results: $passCount/$totalCount tests passing" -ForegroundColor (
    $passCount -eq $totalCount ? "Green" : "Yellow"
)

# Output JSON if requested
if ($OutputFormat -eq "JSON") {
    $jsonOutput = $results | ConvertTo-Json -Depth 10
    
    # Determine output file path
    if ([string]::IsNullOrEmpty($OutputFile)) {
        $resultsDir = "tests\results"
        if (-not (Test-Path $resultsDir)) {
            New-Item -ItemType Directory -Path $resultsDir -Force | Out-Null
        }
        $OutputFile = "$resultsDir\test-results-server-status-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    }
    
    $jsonOutput | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host ""
    Write-Host "Results saved to: $OutputFile" -ForegroundColor Green
}

# Exit with appropriate code
exit ($passCount -eq $totalCount ? 0 : 1)
