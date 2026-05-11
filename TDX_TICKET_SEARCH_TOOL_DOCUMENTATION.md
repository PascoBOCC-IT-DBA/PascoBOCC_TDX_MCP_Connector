# TDX Ticket Search Tool - Complete Documentation

## Tool Overview
The `tdx-ticket-search` tool searches and filters TeamDynamix tickets with multiple filtering options. Filters are applied as AND conditions (all specified filters must match).

## Parameters Reference

### searchText (Optional)
**Type:** string  
**Default:** (empty - no text search)  
**Description:** Full-text search across ticket titles and descriptions. Supports plain text matching only. Does NOT support filter syntax (e.g., "created:", "status:", etc.). Use specific filter parameters below for filtering by date, status, priority, etc.

**Examples that WORK:**
- `"account"` → returns tickets with "account" in title or description
- `"printer issue"` → returns tickets matching both words
- `"P3"` → returns P3 priority tickets

**Examples that DON'T WORK:**
- `"created:2026-05-11"` → filter syntax not supported, use date parameters instead (if added)
- `"status:898"` → use statusIds parameter instead
- `"priority:P3"` → use priorityIds parameter instead

**VERIFIED BEHAVIOR:** ✓ Tested - searchText="account" returned tickets with "account" in searchable fields

---

### statusIds (Optional)
**Type:** array of integers  
**Default:** (empty - no status filter)  
**Description:** Filter tickets by status ID. Returns only tickets with the specified status(es). Supports multiple status IDs (OR logic within array, AND with other parameters).

**Examples:**
- `[898]` → only "Closed" tickets
- `[896, 894]` → only "In Process" OR "New" tickets
- (empty array) → no status filtering

**VERIFIED BEHAVIOR:** ✓ Tested - statusIds=[898] returned only tickets with StatusId=898

**Known Status IDs:**
- 894 = New
- 896 = In Process
- 898 = Closed
(Run `mcp_bocc-tdx-mcp_tdx-statuses-get` to get full list)

---

### priorityIds (Optional)
**Type:** array of integers  
**Default:** (empty - no priority filter)  
**Description:** Filter tickets by priority ID (similar behavior to statusIds).

**Examples:**
- `[329]` → P3 priority only
- `[329, 328]` → P3 or P4 priority

**ASSUMED BEHAVIOR:** Likely works same as statusIds (not yet tested)

---

### typeIds (Optional)
**Type:** array of integers  
**Description:** Filter tickets by ticket type ID.

**ASSUMED BEHAVIOR:** Likely works same as statusIds (not yet tested)

---

### accountIds (Optional)
**Type:** array of integers  
**Description:** Filter tickets by account/department ID.

**ASSUMED BEHAVIOR:** Likely works same as statusIds (not yet tested)

---

### requestorUids (Optional)
**Type:** array of strings  
**Description:** Filter tickets by requestor person UID.

---

### responsibleUids (Optional)
**Type:** array of strings  
**Description:** Filter tickets by responsible person UID.

---

### responsibleGroupIds (Optional)
**Type:** array of integers  
**Description:** Filter tickets by responsible group ID.

---

### maxResults (Optional)
**Type:** integer  
**Default:** 25  
**Range:** 1-1000+ (not hard-limited in tool, but performance may degrade)  
**Description:** Maximum number of results to return. Tool respects this value exactly.

**Examples:**
- `maxResults=10` → returns at most 10 tickets
- `maxResults=100` → returns at most 100 tickets
- `maxResults=1000` → returns at most 1000 tickets (may be slow)

**VERIFIED BEHAVIOR:** ✓ Tested - maxResults=1 returned 1 result, maxResults=5 returned 5 results

**Performance Note:** Large values (500+) may take several seconds. For large result sets, consider filtering more specifically with statusIds, priorityIds, etc.

---

## Return Value

### Success Response
Returns an array of ticket objects. Each ticket includes:

```json
{
  "ID": 4744483,
  "Title": "Please add user to MUNIS User Groups",
  "CreatedDate": "2026-05-11T14:47:31.68Z",
  "StatusID": 894,
  "StatusName": "New",
  "PriorityID": 329,
  "PriorityName": "P3",
  "AccountID": 3910,
  "AccountName": "Enterprise Resource Planning",
  ...
  // (55+ fields total)
}
```

### Empty Result
Returns empty array `[]` if no tickets match the filters:

```json
[]
```

**NOTE:** No error is thrown for invalid filter values - the tool simply returns no results. Example: `statusIds=[99999]` returns `[]`

---

## How Filters Work Together

### AND Logic Between Parameters
All specified filters must match (AND condition):
- `searchText="account" + statusIds=[898]` → tickets with "account" text AND status "Closed"
- `searchText="printer" + priorityIds=[329]` → tickets with "printer" AND P3 priority

### OR Logic Within Arrays
Multiple values in the same array use OR:
- `statusIds=[896, 898]` → status "In Process" OR "Closed"
- `priorityIds=[328, 329]` → P4 OR P3 priority

---

## Common Usage Patterns

### Get tickets created today
❌ **CANNOT DO** - No createdDate filtering available. Use client-side filtering on CreatedDate field.

```javascript
// After getting results with tool, filter client-side:
const today = new Date().toISOString().split('T')[0]; // "2026-05-11"
const todaysTickets = results.filter(t => t.CreatedDate.startsWith(today));
```

### Get unresolved tickets
✓ **CAN DO** - Use statusIds for "New" and "In Process"

```
statusIds=[894, 896]
```

### Get high-priority closed tickets
✓ **CAN DO** - Combine statusIds and priorityIds

```
statusIds=[898] + priorityIds=[329, 1127]  // P3 or P5 priority
```

### Search for specific ticket topic AND filter by status
✓ **CAN DO** - Combine searchText with statusIds

```
searchText="account creation" + statusIds=[898]
```

---

## Testing Results

### ✓ VERIFIED (Tested)
- `searchText` parameter filters correctly by text content
- `statusIds` parameter filters correctly by status
- `maxResults` parameter returns exact count requested
- Parameter combinations work as AND filters
- Invalid filter values return empty results (no error)

### ? UNTESTED (Assumed to work)
- `priorityIds`, `typeIds`, `accountIds` (assumed same as statusIds)
- `requestorUids`, `responsibleUids`, `responsibleGroupIds` (UID-based filters)
- `maxResults` performance at 500+ values

---

## Limitations & Workarounds

| Need | Solution |
|------|----------|
| Filter by creation date | No tool parameter; filter results client-side on `CreatedDate` field |
| Filter by date range | No tool parameter; filter results client-side |
| Full-text search with filters | Combine `searchText` with statusIds/priorityIds (text search + parameter filters) |
| Regex search | Not supported; plain text only |
| Case-insensitive search | Built-in (searchText="Account" finds "account") |
| Exclude specific statuses | Not directly supported; request all, filter client-side |
| Sort results | Not supported by tool; sort client-side on desired fields |

---

## Error Handling

The tool does NOT throw errors for invalid inputs. Instead:

| Scenario | Behavior |
|----------|----------|
| Invalid statusIds | Returns `[]` (empty) |
| Invalid priorityIds | Returns `[]` (empty) |
| Invalid UIDs | Returns `[]` (empty) |
| maxResults=0 | Unknown - NOT TESTED |
| maxResults=-1 | Unknown - NOT TESTED |
| searchText="" (empty) | Returns results (no text filter applied) |
| No parameters | Returns results (latest/default ordering) |

---

## Recommendations for Agents

1. **Always filter first by specific parameters** (statusIds, priorityIds, etc.) before using searchText
2. **For date-based queries**, retrieve results and filter client-side on CreatedDate
3. **Start with maxResults=25-50** and increase if needed; large values may be slow
4. **Combine multiple filters** using AND logic to reduce result set size
5. **Check result count** before assuming filtering worked; the tool returns empty `[]` rather than errors
6. **Avoid searchText for boolean/ID-based searches** - use dedicated parameters (statusIds, etc.)

---

## Related Tools

- `mcp_bocc-tdx-mcp_tdx-statuses-get` - Get list of valid status IDs and names
- `mcp_bocc-tdx-mcp_tdx-ticket-get` - Get full details for a specific ticket by ID

---

**Last Updated:** May 11, 2026  
**Test Verified:** May 11, 2026  
**Tool Version:** Based on mcp_bocc-tdx-mcp_tdx-ticket-search