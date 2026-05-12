# Tests Directory

This folder contains PowerShell testing scripts and organized test results for the TDX MCP Server.

## Setup Instructions

Before running any test scripts, you need to configure your test parameters:

1. **Copy the example parameters file:**
   ```powershell
   cp test-params.example.ps1 test-params.ps1
   ```

2. **Edit `test-params.ps1` with your credentials:**
   - Replace `your-bearer-token-here` with your actual TDX API bearer token
   - Update `ServerUrl` and `ServerAddress` if your server is at a different location
   - Update `ApiKey` if it differs from your bearer token

3. **Note:** `test-params.ps1` is excluded from git (see `.gitignore`) to keep credentials secure.

4. **Run tests:**
   ```powershell
   .\test-tools.ps1
   .\test-server-status.ps1
   ```

## Folder Structure

```
tests/
├── README.md                              # This file
├── test-comprehensive.ps1                 # ✅ CURRENT MASTER TEST SUITE (Consolidated)
├── results/                               # All test result files
    ├── test-results-20260512-083735.json           # Early test
    ├── test-results-extensive-20260512-091024.json # First comprehensive run
    ├── test-results-extensive-20260512-091035.json # Second comprehensive run
    ├── test-results-extensive-20260512-091600.json # Third run (deprecated results)
    ├── test-results-proper-mcp-20260512-091950.json # ✅ CURRENT (verified real data)
    └── test-verbose-output.txt                     # Verbose output log
```

## Test Scripts Overview

### ✅ test-comprehensive.ps1 (MASTER TEST SUITE - CONSOLIDATED)
**Status:** Current standard, comprehensive coverage of all tools  
**Test Date:** Latest run on demand  
**Protocol:** Correct MCP tools/call interface  
**Test Coverage:** All 20 read-only tools + edge cases and parameter variations  
**Result File:** `results/test-results-comprehensive-YYYYMMDD-HHMMSS.json`

This is the **single, unified test suite** that consolidates all previous test scripts:
- ✅ Combined test-with-proper-mcp-protocol.ps1 (base framework)
- ✅ Added comprehensive edge case testing from test-extensive-may12-tools.ps1
- ✅ Eliminated duplicate tests between scripts
- ✅ Proper error handling and validation tests
- ✅ Results stored in results/ folder automatically

**Coverage:**
- Tickets (5 tests): basic search, text filter, status filter, combined filters, invalid ID
- Assets (5 tests): basic search, text filter, maxResults edge cases, invalid ID, categories
- CMDB (4 tests): basic search, text filter, get, invalid ID
- Knowledge Base (4 tests): search, text filter, get, invalid ID
- Projects (3 tests): search, get, invalid ID
- People (5 tests): search, lookup, invalid lookup, get, invalid ID
- Accounts (3 tests): search, get, invalid ID
- Groups (4 tests): search, maxResults edge case, get, invalid ID
- Metadata (7 tests): statuses for tickets/assets/projects/cmdb, attributes for tickets/assets/projects

**Total: 40+ comprehensive tests across all 20 read-only tools**

**Key Features:**
- Uses proper JSON-RPC wrapper: `{"method":"tools/call","params":{"name":"<tool>","arguments":{...}}}`
- Returns actual API responses with verified data
- Handles errors correctly and documents legitimate failures
- Edge case testing (maxResults=1, invalid IDs, various component types)
- Parameter variation testing (search with/without filters, combined filters)
- Result counting and validation
- Color-coded console output for quick scanning
- Automatic JSON result file generation with timestamp

**Run the comprehensive test suite:**
```powershell
cd tests/
.\test-comprehensive.ps1
```

Results automatically saved to: `results/test-results-comprehensive-YYYYMMDD-HHMMSS.json`

## Running Tests

### Prerequisites

1. **Server Running:** MCP server must be running at `http://10.210.1.38:3000/mcp`
2. **Bearer Token:** Valid TDX API bearer token required
3. **PowerShell:** Version 5.0 or later
4. **Network:** TCP access to 10.210.1.38:3000

### Execute Master Test Suite (RECOMMENDED)

```powershell
cd tests/
.\test-comprehensive.ps1
```

This will:
- Test all 20 read-only tools through proper MCP protocol
- Run 40+ unique tests covering basic functionality and edge cases
- Generate timestamped result file in `results/` folder: `test-results-comprehensive-YYYYMMDD-HHMMSS.json`
- Display color-coded pass/fail status in console
- Document actual API responses with real data
- Return exit code 0 for all tests passed, 1 if any test failed

**Expected Output:**
```
================================================================================
TDX MCP COMPREHENSIVE TEST SUITE
All 20 read-only tools with complete test coverage
Using proper MCP tools/call protocol
================================================================================

=== TICKETS ===
✅ tdx-ticket-search - Search with maxResults=5: (5 results)
✅ tdx-ticket-search - Search with maxResults=1 (edge case): (1 results)
... [40+ more tests] ...

================================================================================
TEST SUMMARY
================================================================================

Total Tests Run:     43
Passed:              40 ✅
Failed:              3 ❌
Success Rate:        93.0%
Timestamp:           2026-05-12 14:30:45

Detailed results saved to: results/test-results-comprehensive-20260512-143045.json
```

### Using Custom Parameters

```powershell
# Run with custom server address and token
.\test-comprehensive.ps1 -ServerUrl "http://localhost:3000/mcp" -BearerToken "your-token-here"

# Run with environment variables (more secure)
$env:TDX_SERVER = "http://10.210.1.38:3000/mcp"
$env:TDX_TOKEN = "your-token"
.\test-comprehensive.ps1 -ServerUrl $env:TDX_SERVER -BearerToken $env:TDX_TOKEN
```

### Using Manual Test Function

For quick ad-hoc testing of individual tools:

```powershell
# Configure these variables
$serverAddress = "10.210.1.38:3000"
$token = "226ee1edd38aea72c27c62e44d0d4edb101a97922568db6db77036f83fbcebde"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Proper MCP protocol
$body = @{
    jsonrpc = "2.0"
    method = "tools/call"
    params = @{
        name = "tdx-ticket-search"
        arguments = @{ maxResults = 5 }
    }
    id = 1
} | ConvertTo-Json -Depth 10

# Execute
$response = Invoke-RestMethod -Uri "http://$serverAddress/mcp" `
    -Method POST -Headers $headers -Body $body -TimeoutSec 15

$response | ConvertTo-Json -Depth 8 | Write-Host
```

## Test Results Analysis

### Current Status

**Master Test Suite:** `test-comprehensive.ps1`  
**Test Approach:** Consolidated from 4 previous scripts with duplicate elimination  
**Coverage:** All 20 read-only tools with 40+ comprehensive tests  
**Result File Location:** `results/test-results-comprehensive-YYYYMMDD-HHMMSS.json`

**Latest Results:**
Run the master test suite to generate current results. Previous historical results are available in:
- `results/test-results-proper-mcp-20260512-091950.json` (baseline - 19/20 tools, 95% pass rate)
- `results/test-results-extensive-*.json` (archived from old test runs)
- `results/test-results-20260512-083735.json` (early test run)

### What Changed: Consolidation Details

**Four separate test scripts combined into ONE:**

| Script | Status | Key Tests | Result |
|--------|--------|-----------|--------|
| test-all-tools.ps1 | ❌ Archived | 20 tools, wrong protocol | Removed |
| test-extensive-may12-tools.ps1 | ✅ Consolidated | Edge cases, parameter variations | Included |
| test-remaining-tools.ps1 | ✅ Consolidated | Partial coverage | Included |
| test-with-proper-mcp-protocol.ps1 | ✅ Consolidated | Core 20 tools, proper protocol | Base |

**Result: test-comprehensive.ps1**
- ✅ Proper MCP protocol (tools/call wrapper)
- ✅ All 20 tools covered
- ✅ Edge case testing (invalid IDs, boundary values)
- ✅ Parameter variations (filters, search terms, maxResults options)
- ✅ All component types for metadata tools
- ✅ Error handling and validation
- ✅ No duplicate tests
- ✅ 40+ comprehensive tests total

### Verified Tool Status

See [TDX_MCP_TOOLS_COMPLETE_REFERENCE.md](../TDX_MCP_TOOLS_COMPLETE_REFERENCE.md) for:
- Complete tool documentation
- Test results summary
- Known limitations and workarounds
- Parameter documentation

## Important Protocol Discovery

**Critical Finding:** MCP tools require the `tools/call` wrapper, not direct JSON-RPC method calls.

**Correct:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "tdx-ticket-search",
    "arguments": { "maxResults": 5 }
  }
}
```

**Incorrect (returns -32601 error):**
```json
{
  "method": "tdx-ticket-search",
  "params": { "maxResults": 5 }
}
```

This discovery explains why earlier test results showed uniform "1 result" responses - they were using wrong protocol.

## Adding New Tests

All new tests should be added to the master test suite: `test-comprehensive.ps1`

**To add new tests:**

1. **Open the master script:**
   ```powershell
   code test-comprehensive.ps1
   ```

2. **Find the appropriate section** (Tickets, Assets, CMDB, etc.)

3. **Add a new Test-Tool call** following the pattern:
   ```powershell
   # Under the relevant category section
   Test-Tool "tool-name" @{ param1 = "value"; param2 = "value" } "Test description"
   Test-Tool "tool-name" @{ param1 = "different" } "Alternative parameter test"
   ```

4. **Examples:**
   ```powershell
   # Basic test
   Test-Tool "tdx-ticket-search" @{ maxResults = 5 } "Search with max results"
   
   # Edge case test
   Test-Tool "tdx-ticket-search" @{ maxResults = 1 } "Search with edge case limit"
   
   # Test for error handling
   Test-Tool "tdx-ticket-get" @{ id = 999999999 } "Invalid ID error handling" -ExpectSuccess $false
   
   # Test with multiple parameters
   Test-Tool "tdx-ticket-search" @{ searchText = "test"; statusIds = @(898) } "Combined filters"
   ```

5. **Run to verify:**
   ```powershell
   .\test-comprehensive.ps1
   ```

6. **Review results in results folder**

**Important:**
- Keep script consolidated - do NOT create new individual test scripts
- Document what each test validates in the test description
- Use edge cases and multiple parameter combinations
- Test error handling (use `-ExpectSuccess $false` for tests that should fail)
- Result files are automatically generated with timestamps

## Troubleshooting

### "Method not found" (-32601 error)
- You're using direct JSON-RPC method calls
- Switch to `tools/call` protocol (see example above)

### No results returned
- Check bearer token is valid
- Verify server connectivity: `Test-NetConnection -ComputerName 10.210.1.38 -Port 3000`
- Check parameters match tool requirements

### "TDAssets application" error on tdx-cmdb-search
- This is expected - tool requires TDAssets app type
- Use `tdx-cmdb-get` for individual CI retrieval instead
- Contact admin to configure TDAssets app if needed
- tdx-ticket-get
- tdx-ticket-feed-get
- tdx-statuses-get
- tdx-attributes-get

### 17 Read-Only Tools Available
All search, get, and lookup tools are enabled and ready for testing.

### 27 Modification Tools Disabled
Create, update, delete tools are disabled by default. Enable via `ALLOW_MODIFICATIONS=true` environment variable if needed.

## Expected Timeouts

Tool execution may timeout due to TDX API performance. This is normal.

**Workaround:** Increase client timeout to 90+ seconds in your test scripts.

## Reporting Issues

When reporting test failures, include:

1. Tool name tested
2. Parameters used
3. Error message received
4. Server uptime/status
5. Network connectivity

## Note

This folder is excluded from git (.gitignore). Test results and scripts are local only and not committed to version control.
