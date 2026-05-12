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
   - Update `$ServerUrl` with your server's MCP endpoint (e.g., `http://your-server-host:3000/mcp`)

3. **Note:** `test-params.ps1` is excluded from git (see `.gitignore`) to keep credentials secure.

4. **Run tests:**
   ```powershell
   .\test-tools.ps1
   .\test-server-status.ps1
   ```

## Folder Structure

```
tests/
├── README.md                      # This file
├── test-tools.ps1                # Tests all 20 TDX MCP read-only tools
├── test-server-status.ps1        # Tests server health and infrastructure
├── test-params.example.ps1       # Template for parameters
├── test-params.ps1               # Configuration file (generated, not committed)
└── results/                       # Test result JSON files
```

## Test Scripts Overview

### test-tools.ps1 - Comprehensive Tool Testing

**Purpose:** Tests all 20 read-only TDX MCP tools with full coverage  
**Usage:** `.\test-tools.ps1`  
**Result File:** `results/test-results-tools-YYYYMMDD-HHMMSS.json`

**Coverage:**
- Accounts (search, get)
- Assets (search, get)
- CMDB/Configuration Items (search, get)
- Groups (search, get)
- Knowledge Base (search, get)
- People (search, lookup, get)
- Projects (search, get)
- Statuses (for tickets, assets, projects, cmdb)
- Attributes (for tickets, assets, projects)
- Tickets (search, get)

**Features:**
- Uses proper JSON-RPC wrapper: `{"method":"tools/call","params":{"name":"<tool>","arguments":{...}}}`
- Comprehensive parameter testing with edge cases
- Returns actual API responses with verified data
- Proper error handling and validation
- Color-coded console output
- Automatic JSON result file generation with timestamp

**Run:**
```powershell
.\test-tools.ps1
```

### test-server-status.ps1 - Server Infrastructure Testing

**Purpose:** Verifies server deployment, HTTP infrastructure, tool registration, and authentication  
**Usage:** `.\test-server-status.ps1` or `.\test-server-status.ps1 -OutputFormat JSON`  
**Result File:** `results/test-results-server-status-YYYYMMDD-HHMMSS.json` (JSON mode only)

**Tests:**
- Health Endpoint (server responsiveness)
- CORS Headers (cross-origin resource sharing)
- Authorization Header (token validation)
- Tool Registration (endpoint availability)
- JSON-RPC Endpoint (proper protocol support)
- Concurrent Request Handling (load capability)
- Response Time (performance baseline)

**Run:**
```powershell
# Console output
.\test-server-status.ps1

# JSON output
.\test-server-status.ps1 -OutputFormat JSON
```

## Configuration

Both test scripts use parameters from `test-params.ps1`:

**test-params.ps1 content:**
```powershell
# The MCP server URL endpoint (full path including /mcp)
$ServerUrl = "http://your-server-host:3000/mcp"

# The TDX API bearer token for authentication
$BearerToken = "your-actual-token-here"
```

**Override parameters at runtime:**
```powershell
.\test-tools.ps1 -ServerUrl "http://localhost:3000/mcp" -BearerToken "your-token"
.\test-server-status.ps1 -ServerUrl "http://localhost:3000/mcp" -BearerToken "your-token"
```

## Test Results

Test results are automatically saved to the `results/` folder with timestamps:
- `test-results-tools-YYYYMMDD-HHMMSS.json` - Tool test results
- `test-results-server-status-YYYYMMDD-HHMMSS.json` - Server status test results

Results include:
- Test execution timestamp
- Individual test outcomes and details
- Summary statistics
- Detailed responses for all API calls

## Running All Tests

```powershell
cd tests/

# Test all tools
.\test-tools.ps1

# Test server infrastructure
.\test-server-status.ps1 -OutputFormat JSON

# Both with custom parameters
$url = "http://your-server-host:3000/mcp"
$token = "your-bearer-token"
.\test-tools.ps1 -ServerUrl $url -BearerToken $token
.\test-server-status.ps1 -ServerUrl $url -BearerToken $token
```

## Prerequisites

- **Server Running:** MCP server must be running and accessible
- **Bearer Token:** Valid TDX API bearer token required
- **PowerShell:** Version 5.0 or later
- **Network:** TCP access to the configured server address

## MCP Protocol

The TDX MCP server uses the `tools/call` wrapper for all tool invocations:

**Correct format:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "tdx-ticket-search",
    "arguments": { "maxResults": 5 }
  }
}
```

**Incorrect format (returns error -32601):**
```json
{
  "method": "tdx-ticket-search",
  "params": { "maxResults": 5 }
}
```

Both test scripts properly implement this protocol.

## Troubleshooting

**test-params.ps1 not found error:**
- Copy `test-params.example.ps1` to `test-params.ps1`
- Fill in your actual ServerUrl and BearerToken values

**Connection timeout errors:**
- Verify server is running at the configured ServerUrl
- Check network connectivity to the server address
- Confirm firewall allows access to the port

**Authorization errors (401/403):**
- Verify BearerToken is correct and active
- Check that token has required TDX API permissions

**Tool not found errors:**
- Verify tool name matches exactly (case-sensitive)
- Check that the server has all 20 tools registered
- Run `test-server-status.ps1` to verify tool registration

## For More Information

- See [TOOLS_REFERENCE.md](../TOOLS_REFERENCE.md) for complete tool documentation
- See [package.json](../package.json) for MCP server configuration


