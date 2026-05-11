# Disabled Modification Tools

**Status:** 27 modification tools are currently DISABLED for safety  
**Date Disabled:** May 11, 2026  
**Re-enable Command:** Set environment variable `ALLOW_MODIFICATIONS=true` before running MCP server

---

## Overview

All tools that create, alter, or delete data in the TDX tenant have been disabled by default. The tools remain in the codebase and can be easily re-enabled when needed.

## Disabled Tools (27 Total)

### Tickets (6 tools)
- `tdx-ticket-create` - Create new tickets
- `tdx-ticket-update` - Full update of tickets
- `tdx-ticket-patch` - Partial update of tickets
- `tdx-ticket-feed-add` - Add comments to tickets
- `tdx-ticket-add-asset` - Link assets to tickets
- `tdx-ticket-add-contact` - Add contacts to tickets

### Assets (5 tools)
- `tdx-asset-create` - Create new assets
- `tdx-asset-update` - Full update of assets
- `tdx-asset-patch` - Partial update of assets
- `tdx-asset-delete` - Delete assets
- `tdx-asset-feed-add` - Add notes to assets

### CMDB Configuration Items (5 tools)
- `tdx-cmdb-create` - Create new CIs
- `tdx-cmdb-update` - Full update of CIs
- `tdx-cmdb-delete` - Delete CIs
- `tdx-cmdb-feed-add` - Add notes to CIs
- `tdx-cmdb-add-relationship` - Create CI relationships

### Knowledge Base (3 tools)
- `tdx-kb-create` - Create articles
- `tdx-kb-update` - Update articles
- `tdx-kb-delete` - Delete articles

### Projects (2 tools)
- `tdx-project-create` - Create projects
- `tdx-project-update` - Update projects

### People (1 tool)
- `tdx-people-update` - Update user profiles

---

## Always-Enabled (Read-Only) Tools

The following tools are **always enabled** and cannot be disabled:

- **Tickets:** `tdx-ticket-get`, `tdx-ticket-search`, `tdx-ticket-feed-get`
- **Assets:** `tdx-asset-get`, `tdx-asset-search`, `tdx-asset-categories`
- **CMDB:** `tdx-cmdb-get`, `tdx-cmdb-search`
- **Knowledge Base:** `tdx-kb-get`, `tdx-kb-search`
- **Projects:** `tdx-project-get`, `tdx-project-search`
- **People:** `tdx-people-get`, `tdx-people-search`, `tdx-people-lookup`
- **Accounts:** `tdx-account-get`, `tdx-account-search`
- **Groups:** `tdx-group-get`, `tdx-group-search`
- **Metadata:** `tdx-statuses-get`, `tdx-attributes-get`

---

## How to Re-Enable

### Method 1: Environment Variable (Recommended)
```bash
# On Windows PowerShell
$env:ALLOW_MODIFICATIONS = "true"
npm start

# On Linux/Mac bash
export ALLOW_MODIFICATIONS=true
npm start
```

### Method 2: .env File
Add to `.env` file:
```
ALLOW_MODIFICATIONS=true
```

### Method 3: Direct Environment
```bash
ALLOW_MODIFICATIONS=true npm start
```

---

## Implementation Details

**File Modified:** `src/index.ts`

The implementation uses a feature gate in the main server initialization:
- All modification tools are conditionally registered based on the `ALLOW_MODIFICATIONS` environment variable
- Read-only tools are always registered regardless of the setting
- Console messages indicate which tools were skipped

**Code Pattern:**
```typescript
const allowModifications = process.env.ALLOW_MODIFICATIONS === "true";

const registerIfAllowed = (allowFunc: () => void, name: string) => {
  if (allowModifications) {
    allowFunc();
    console.error(`[TDX-MCP] Enabled modification tool: ${name}`);
  } else {
    console.error(`[TDX-MCP] Skipped modification tool: ${name}`);
  }
};

registerIfAllowed(() => registerTicketTools(server, client), "registerTicketTools");
// ... etc for other tool modules
```

---

## Why This Approach?

1. **Safety First** - Prevents accidental modifications to the TDX system
2. **Code Preservation** - All tool code remains intact and unmodified  
3. **Easy Re-enable** - Single environment variable to control behavior
4. **Clear Logging** - Console output shows which tools are active/inactive
5. **No Breaking Changes** - Existing API code untouched; only registration flow changed

---

## Verification

To verify that modification tools are disabled:
```bash
npm run build  # Should compile without errors
npm start      # Should show "Skipped modification tool" messages
```

When re-enabled with `ALLOW_MODIFICATIONS=true`, you should see:
```
[TDX-MCP] Enabled modification tool: registerTicketTools
[TDX-MCP] Enabled modification tool: registerAssetTools
... etc
```

---

## Re-enabling Specific Tool Groups

To selectively enable certain tool groups, you would need to modify the logic in `src/index.ts`. For example, to enable only ticket tools:

```typescript
const allowTicketMods = process.env.ALLOW_TICKET_MODIFICATIONS === "true";
const registerIfAllowed = (allowFunc: () => void, shouldAllow: boolean) => {
  if (shouldAllow) {
    allowFunc();
  }
};

registerIfAllowed(() => registerTicketTools(server, client), allowTicketMods);
// ... other tools with their own flags
```

---

## Support

For issues or to request enabling modifications, contact the system administrator.  
Last Updated: May 11, 2026
