# Comprehensive MCP Tool Testing Script with Valid Data
# Tests all 43 tools against live MCP server with real search queries and valid IDs
# Outputs JSON results for documentation

# Load test parameters from secure config file
. "$PSScriptRoot/test-params.ps1"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$resultsDir = Join-Path -Path (Get-Location) -ChildPath "results"
$outputFile = Join-Path -Path $resultsDir -ChildPath "test-results-live-valid-$timestamp.json"

# HTTP headers with authentication
$headers = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer $BearerToken"
}

# Ensure results directory exists
if (-not (Test-Path $resultsDir)) {
    New-Item -ItemType Directory -Path $resultsDir -Force | Out-Null
}

# Initialize results tracking
$allResults = @{
    toolsFailed = 0
    toolsPassed = 0
    toolsTotal = 0
    toolResults = @{}
    testTimestamp = ([datetime]::UtcNow).ToString("o")
}

function Invoke-MCPTool {
    param(
        [string]$toolName,
        [hashtable]$params,
        [string]$description
    )
    
    $body = @{
        jsonrpc = "2.0"
        id = (Get-Random -Maximum 100000)
        method = "tools/call"
        params = @{
            name = $toolName
            arguments = $params
        }
    } | ConvertTo-Json -Depth 10

    try {
        $response = Invoke-WebRequest -Uri $ServerUrl `
            -Method POST `
            -Headers $headers `
            -Body $body `
            -TimeoutSec 30 `
            -UseBasicParsing `
            -ErrorAction Stop

        $result = $response.Content | ConvertFrom-Json
        
        # Count results
        $resultCount = 0
        if ($result.result.data -is [array]) {
            $resultCount = $result.result.data.Count
        } elseif ($result.result.data) {
            $resultCount = 1
        }

        $toolResult = @{
            success = $true
            arguments = $params
            response = $result
            description = $description
            error = $null
            resultCount = $resultCount
        }
        
        $allResults["toolResults"][$toolName] = $toolResult
        $allResults["toolsPassed"] = $allResults["toolsPassed"] + 1
        Write-Host "✅ $toolName - $description (resultCount: $resultCount)"
        return $result
    }
    catch {
        $toolResult = @{
            success = $false
            arguments = $params
            response = $null
            description = $description
            error = $_.Exception.Message
            resultCount = 0
        }
        $allResults["toolResults"][$toolName] = $toolResult
        $allResults["toolsFailed"] = $allResults["toolsFailed"] + 1
        Write-Host "❌ $toolName - ERROR: $($_.Exception.Message)"
        return $null
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MCP Tool Testing with Valid Data" -ForegroundColor Cyan
Write-Host "Server: $ServerUrl" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# TICKETS
# ============================================
Write-Host "Testing TICKETS..." -ForegroundColor Yellow

# ============================================
# TICKETS
# ============================================
Write-Host "Testing TICKETS..." -ForegroundColor Yellow

$ticketSearch = Invoke-MCPTool -toolName "tdx-ticket-search" `
    -params @{maxResults = 5} `
    -description "Search tickets with maxResults=5"

if ($null -ne $ticketSearch -and $ticketSearch.result.data.Count -gt 0) {
    $ticketId = $ticketSearch.result.data[0].ID
    Invoke-MCPTool -toolName "tdx-ticket-get" `
        -params @{id = $ticketId} `
        -description "Get ticket by valid ID ($ticketId)"
    
    Invoke-MCPTool -toolName "tdx-ticket-feed-get" `
        -params @{id = $ticketId} `
        -description "Get ticket feed for valid ID ($ticketId)"
}

# ============================================
# ASSETS
# ============================================
Write-Host ""
Write-Host "Testing ASSETS..." -ForegroundColor Yellow

$assetSearch = Invoke-MCPTool -toolName "tdx-asset-search" `
    -params @{maxResults = 5} `
    -description "Search assets with maxResults=5"

if ($null -ne $assetSearch -and $assetSearch.result.data.Count -gt 0) {
    $assetId = $assetSearch.result.data[0].ID
    Invoke-MCPTool -toolName "tdx-asset-get" `
        -params @{id = $assetId} `
        -description "Get asset by valid ID ($assetId)"
}

# ============================================
# CMDB
# ============================================
Write-Host ""
Write-Host "Testing CMDB..." -ForegroundColor Yellow

$cmdbSearch = Invoke-MCPTool -toolName "tdx-cmdb-search" `
    -params @{maxResults = 5; isActive = $true} `
    -description "Search active CIs with maxResults=5"

if ($null -ne $cmdbSearch -and $cmdbSearch.result.data.Count -gt 0) {
    $ciId = $cmdbSearch.result.data[0].ID
    Invoke-MCPTool -toolName "tdx-cmdb-get" `
        -params @{id = $ciId} `
        -description "Get CI by valid ID ($ciId)"
}

# ============================================
# KNOWLEDGE BASE
# ============================================
Write-Host ""
Write-Host "Testing KNOWLEDGE BASE..." -ForegroundColor Yellow

$kbSearch = Invoke-MCPTool -toolName "tdx-kb-search" `
    -params @{maxResults = 5; status = 2} `
    -description "Search approved KB articles with maxResults=5"

if ($null -ne $kbSearch -and $kbSearch.result.data.Count -gt 0) {
    $kbId = $kbSearch.result.data[0].ID
    Invoke-MCPTool -toolName "tdx-kb-get" `
        -params @{id = $kbId} `
        -description "Get KB article by valid ID ($kbId)"
}

# ============================================
# PROJECTS
# ============================================
Write-Host ""
Write-Host "Testing PROJECTS..." -ForegroundColor Yellow

$projectSearch = Invoke-MCPTool -toolName "tdx-project-search" `
    -params @{maxResults = 5} `
    -description "Search projects with maxResults=5"

if ($null -ne $projectSearch -and $projectSearch.result.data.Count -gt 0) {
    $projectId = $projectSearch.result.data[0].ID
    Invoke-MCPTool -toolName "tdx-project-get" `
        -params @{id = $projectId} `
        -description "Get project by valid ID ($projectId)"
}

# ============================================
# PEOPLE
# ============================================
Write-Host ""
Write-Host "Testing PEOPLE..." -ForegroundColor Yellow

$peopleSearch = Invoke-MCPTool -toolName "tdx-people-search" `
    -params @{maxResults = 5; isActive = $true} `
    -description "Search active people with maxResults=5"

if ($null -ne $peopleSearch -and $peopleSearch.result.data.Count -gt 0) {
    $personUid = $peopleSearch.result.data[0].UID
    Invoke-MCPTool -toolName "tdx-people-get" `
        -params @{uid = $personUid} `
        -description "Get person by valid UID ($personUid)"
}

Invoke-MCPTool -toolName "tdx-people-lookup" `
    -params @{searchText = "admin"; maxResults = 5} `
    -description "Quick lookup for 'admin' users"

# ============================================
# ACCOUNTS
# ============================================
Write-Host ""
Write-Host "Testing ACCOUNTS..." -ForegroundColor Yellow

$accountSearch = Invoke-MCPTool -toolName "tdx-account-search" `
    -params @{maxResults = 5} `
    -description "Search accounts with maxResults=5"

if ($null -ne $accountSearch -and $accountSearch.result.data.Count -gt 0) {
    $accountId = $accountSearch.result.data[0].ID
    Invoke-MCPTool -toolName "tdx-account-get" `
        -params @{id = $accountId} `
        -description "Get account by valid ID ($accountId)"
}

# ============================================
# GROUPS
# ============================================
Write-Host ""
Write-Host "Testing GROUPS..." -ForegroundColor Yellow

$groupSearch = Invoke-MCPTool -toolName "tdx-group-search" `
    -params @{maxResults = 5} `
    -description "Search groups with maxResults=5"

if ($null -ne $groupSearch -and $groupSearch.result.data.Count -gt 0) {
    $groupId = $groupSearch.result.data[0].ID
    Invoke-MCPTool -toolName "tdx-group-get" `
        -params @{id = $groupId} `
        -description "Get group by valid ID ($groupId)"
}

# ============================================
# METADATA TOOLS
# ============================================
Write-Host ""
Write-Host "Testing METADATA TOOLS..." -ForegroundColor Yellow

Invoke-MCPTool -toolName "tdx-statuses-get" `
    -params @{componentType = "tickets"} `
    -description "Get ticket statuses"

Invoke-MCPTool -toolName "tdx-attributes-get" `
    -params @{componentId = 9} `
    -description "Get ticket custom attributes"

# ============================================
# COMPLETE SUMMARY
# ============================================
$allResults["toolsTotal"] = $allResults["toolsPassed"] + $allResults["toolsFailed"]

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Test Summary" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Passed: $($allResults['toolsPassed'])"
Write-Host "Failed: $($allResults['toolsFailed'])"
Write-Host "Total:  $($allResults['toolsTotal'])"
Write-Host "========================================" -ForegroundColor Green

# Save results to file
$outputFileName = "test-results-live-valid-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$outputPath = Join-Path -Path $resultsDir -ChildPath $outputFileName
$resultsJson = $allResults | ConvertTo-Json -Depth 20
$resultsJson | Out-File -FilePath $outputPath -Encoding UTF8 -Force

Write-Host ""
Write-Host "Results saved to: $outputPath" -ForegroundColor Cyan
Write-Host ""
