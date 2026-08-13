# OAuth Migration Plan: TDX MCP Connector

## TL;DR
Replace static API key authentication with Azure Entra ID (OAuth 2.0) for client connections to the MCP server, while preserving the existing TDX API authentication (BEID + WebServicesKey). 

**Two Entra registrations:**
1. **Server-side app** ("TDX MCP Connector") — registered once per tenant; represents the MCP server as a logical resource
2. **Client-side apps** — one per client (e.g., Copilot); each gets its own credentials to request tokens for the server app

**Token flow**: Client → gets token from Entra for server app → calls MCP server with Bearer token → server validates token → allows request if valid.

The MCP server continues using administrative credentials (BEID + WebServicesKey) to access TDX internally—no change to that flow.

---

## Steps

### Phase 1: Azure Entra Application Registration & Configuration

**Action Owner: System Engineers / Tenant Admin**

#### A. Register the Resource App ("TDX MCP Connector")
This represents the MCP server as a logical resource. **Register once per tenant** (separate registrations for GCC and Commercial if you deploy to both).

1. In Azure Entra ID → App registrations → New registration
   - **Name**: "TDX MCP Connector"
   - **Supported account types**: Accounts in this organizational directory only (single tenant)
   - Do **NOT** set Redirect URI—this is a resource/API app, not a client app

2. On the app's Overview page, copy and store securely:
   - **Application (Client) ID** — becomes `AZURE_ENTRA_APP_ID` in Phase 3
   - **Directory (Tenant) ID** — becomes `AZURE_ENTRA_TENANT_ID` in Phase 3

3. Define OAuth scopes for the MCP API:
   - Go to **Manage** → **Expose an API**
   - Click **Set** next to Application ID URI, accept default `api://[app-id]`, or use custom `api://tdx-mcp`
   - Click **Add a scope** and create the following scopes (copy exact names):
     
     **READ SCOPES** (for read-only clients):
     - `tickets.read` — Access ticketing tools (search, get, count)
     - `assets.read` — Access asset tools (search, get, categories)
     - `cmdb.read` — Access CMDB tools (search, get)
     - `kb.read` — Access KB tools (search, get)
     - `projects.read` — Access project tools (search, get)
     - `people.read` — Access people tools (search, get, lookup)
     - `accounts.read` — Access account tools
     - `groups.read` — Access group tools
     - `metadata.read` — Access metadata tools (statuses, attributes, categories)
     
     **WRITE SCOPES** (for full-access clients):
     - `tickets.write` — Create/update/patch tickets, link assets/contacts
     - `assets.write` — Create/update/patch/delete assets
     - `cmdb.write` — Create/update/patch/delete CMDB entries
     - `kb.write` — Create/update/patch/delete KB articles
     - `projects.write` — Create/update/patch projects
     - `people.write` — Create/update/patch people
     - `tickets.feed` — Add comments to tickets
     - `assets.feed` — Add comments to assets
     - `cmdb.feed` — Add comments to CMDB entries

4. (Optional) Define app roles for RBAC:
   - Go to **Manage** → **App roles** → Create app role
   - Example: `read-only-client`, `full-access-client`
   - Assign to users/service principals as needed

5. Document any required admin consent:
   - Go to **API permissions** — if using user consent, may require tenant admin approval
   - For GCC, coordinate with your Tenant Admin

---

#### B. Register Client App(s)
Each application (e.g., a Copilot instance, a CI/CD service account, an automation tool) registers **its own Entra app** to get credentials for calling the TDX MCP Connector. Repeat this for each client. **Example: Copilot Agent**

1. In Azure Entra ID → App registrations → New registration
   - **Name**: "TDX MCP Copilot" (or similar—name indicates what will use it)
   - **Supported account types**: Accounts in this organizational directory only (single tenant)
   - **Redirect URI** (optional): Only needed if client is a web app; leave empty for daemon/API clients

2. On the app's Overview page, copy and store:
   - **Application (Client) ID** — needed by the client application

3. Create a client credential (secret or certificate):
   - Go to **Manage** → **Certificates & secrets** → New client secret
   - Copy the **Value** (not the ID)—this is used with Client Credentials flow to get tokens
   - **Store securely** in the client's environment

4. Grant permission to call the MCP server:
   - Go to **Manage** → **API permissions** → Add a permission
   - Search for "TDX MCP Connector" (the resource app registered in part A)
   - Select **Application permissions** (for service/daemon) or **Delegated permissions** (for user sign-in)
   - Select the scopes needed (e.g., `tickets.read`, `tickets.write`, etc.)
   - Click **Grant admin consent for [Tenant]** (requires Tenant Admin)

5. Example client registrations:
   - **"TDX MCP Copilot - Read-Only"** — Assign only `*.read` scopes (no write access)
   - **"TDX MCP Copilot - Full Access"** — Assign both `*.read` and `*.write` scopes
   - **"TDX MCP CI/CD Service"** — Assign only required scopes for your pipeline

---

#### Summary of Phase 1 Deliverables
When complete, provide the Developer with:
- **Resource App ID**: Application (Client) ID of "TDX MCP Connector"
- **Tenant ID**: Directory (Tenant) ID (same for both resource and client apps in single tenant)
- **Scope list**: Confirm all scopes (read, write, feed) are registered
- **Client app credentials**: For each client, provide Application ID and secret (if using Client Credentials flow)
- **Admin consent confirmation**: Confirm API permissions have been approved for all apps

### Phase 2: Update HTTP Wrapper to Validate JWT Tokens
**Action Owner: Developer**

5. Add JWT validation library to `package.json` (e.g., `jsonwebtoken`, `@azure/identity`)
6. Create new auth module: `src/oauth-auth.ts` 
   - Import Azure Entra public key (via Microsoft's metadata endpoint or cached locally)
   - Validate JWT: signature, expiry, issuer, audience, scopes
   - Implement `validateToken(token, requiredScopes?)` function:
     - Extract `scp` claim from token
     - Check if token includes all required scopes (space-delimited)
     - Return 403 Forbidden if scopes insufficient
   - Extract user/app identity from token claims for logging/audit
   - Support scope enforcement on a per-operation basis
7. Replace API key middleware in `src/http-wrapper.ts` (lines 476-503):
   - Remove hardcoded `MCP_API_KEY` validation
   - Insert OAuth middleware that calls `oauth-auth.validateToken()`
   - Return 401 if token invalid/expired, 403 if insufficient scopes
   - Pass token metadata (user/app ID, scopes) to request context for audit logging
8. Add scope validation to write operation handlers:
   - Wrap write operations (create, update, delete, feed-add) with scope checks
   - Examples:
     - Write to tickets: `await oauthAuth.validateToken(token, ['tickets.write'])`
     - Read tickets: `await oauthAuth.validateToken(token, ['tickets.read'])`
     - Add comment to asset: `await oauthAuth.validateToken(token, ['assets.feed'])`
   - This enables group-based access control (read-only clients vs. full-access clients)
   - Scope names are **relative to the Application ID URI** (e.g., if URI is `api://tdx-mcp`, scope claim will be `api://tdx-mcp/tickets.write`)
9. Preserve public endpoints (`/health`, `/status`, `/tools`) as auth-free

### Phase 3: Environment Variables & Key Vault
**Action Owner: System Engineers / Developer**

9. Add new Azure Key Vault secrets:
   - `AZURE-ENTRA-TENANT-ID` — Tenant ID for token issuer validation
   - `AZURE-ENTRA-APP-ID` — Client ID (App ID) of the Entra app
   - `AZURE-ENTRA-APP-SECRET` (optional) — Only needed if server issues tokens on behalf of clients; typically clients get tokens directly
10. Update `infra/main.bicep` to expose new secrets as App Service settings:
    - `AZURE_ENTRA_TENANT_ID`
    - `AZURE_ENTRA_APP_ID`
    - Optionally: `AZURE_ENTRA_APP_SECRET` (if server needs to validate/refresh tokens)
11. **Remove** `MCP_API_KEY` from Key Vault and App Service config—OAuth-only, no fallback
12. Update `src/config.ts` to load Entra configuration:
    - Add required fields: `entraClientId`, `entraTenantId`
    - Validate that Entra config is present (no fallback to API key)

### Phase 4: Update Client Documentation & Testing
**Action Owner: Developer**

13. Update `docs/COPILOT_INTEGRATION.md`:
    - Document new OAuth authentication flow
    - Add steps for registering Copilot client app in Entra
    - Explain scopes and roles if defined
    - Show example JWT token structure and validation
14. Create test script: `tests/test-oauth-token-validation.js`
    - Mock Azure Entra metadata endpoint
    - Test valid/expired/malformed tokens
    - Test scope validation (if implemented)
15. Update deployment documentation (`docs/DEPLOYMENT_AZURE_APPSERVICE.md`):
    - Add Entra app registration prerequisites
    - Show Key Vault secret setup
    - Document environment variable mappings

### Phase 5: Deployment & Validation
**Action Owner: Developer / System Engineers**

16. Update `deploy/azure-app-service/deploy-gcc-with-sp.ps1`:
    - Build TypeScript: `npm run build`
    - ZIP with new oauth-auth.ts and updated http-wrapper.ts
    - Deploy via `az webapp deploy`
    - Populate new Key Vault secrets before deployment
17. Test OAuth flow end-to-end:
    - Get JWT token from Azure Entra (via portal, CLI, or MSAL)
    - Call `POST /mcp` with token in Authorization header: `Bearer {token}`
    - Verify request succeeds with valid token, fails with invalid/expired token
    - Verify public endpoints (`/health`, `/tools`) work without token
18. Smoke test: Call a few key tools (e.g., ticket search, asset count) with OAuth token

---

## Relevant Files to Modify
- `src/http-wrapper.ts` — Replace API key middleware with OAuth validation
- `src/auth.ts` — **No change** — TDX API auth remains unchanged
- `src/config.ts` — Add OAuth config loading (entraClientId, entraTenantId, etc.)
- `src/oauth-auth.ts` — **NEW** — JWT token validation and scope checking
- `package.json` — Add `jsonwebtoken` and `@azure/identity` dependencies
- `infra/main.bicep` — Add Azure Key Vault secrets and App Service settings for Entra
- `docs/COPILOT_INTEGRATION.md` — Update with OAuth flow and Entra app registration
- `deploy/azure-app-service/deploy-gcc-with-sp.ps1` — Ensure Key Vault secrets populated

---

## Verification Checklist
1. **Unit tests** — Validate JWT signature, expiry, issuer, audience, scopes
   - Mock Azure Entra metadata endpoint
   - Test valid token → 200 OK ✓
   - Test expired token → 401 Unauthorized ✓
   - Test invalid signature → 401 ✓
   - Test missing token → 401 Unauthorized ✓
   - Test token with insufficient scopes → 403 Forbidden ✓
   - Test token with required scopes → 200 OK ✓
   - Test read-only token cannot access write operations → 403 ✓
   - Test full-access token can access both read and write → 200 ✓
2. **Integration tests** — Call `/mcp` endpoint with real/mock Entra token
   - Test with read-only scopes, verify write tools reject
   - Test with full scopes, verify all tools work
3. **Public endpoint tests** — Verify `/health`, `/status`, `/tools` still work without token
4. **Deployment validation** — After Azure deploy, test OAuth auth against live app
5. **Negative tests** — Verify API key rejected (no fallback); confirm 401 on missing/invalid token

---

## Key Decisions
- **OAuth Provider**: Azure Entra ID (standard for GCC Azure, enterprise-grade, RBAC support)
- **Token Format**: JWT (industry standard, easy to validate offline)
- **Two Entra Registrations Required**:
  1. **Resource app ("TDX MCP Connector")** — Registered once per tenant; defines the scopes; server validates tokens against this
  2. **Client apps** — One per client (e.g., Copilot, CI/CD); each gets credentials to request tokens for the resource app
- **Scope Strategy**: Implement scope validation in Phase 2—enables group-based access control (read-only vs. full-access clients)
  - Read-only clients: `*.read` scopes only
  - Full-access clients: `*.read` + `*.write` + `*.feed` scopes
- **Full OAuth-Only Migration**: No API key fallback. All clients must use OAuth tokens
- **TDX Internal Auth**: BEID + WebServicesKey remains unchanged (Entra OAuth does NOT apply to MCP↔TDX communication)
- **Multiple Tenants**: Register the resource app separately in GCC and commercial tenants (if deploying to both)

---

## Further Considerations

### 1. Scope-Based Access Control (Implemented in Phase 2)
**Objective**: Enable granular group-based access (read-only vs. full-access).

**How it works**:
- **Read-only clients**: Register in Entra with ONLY `*.read` scopes (e.g., `tickets.read`, `assets.read`, etc.)
  - These clients can call read-only tools (search, get, count, feed-get)
  - Cannot call write operations—server returns 403 Forbidden
- **Full-access clients**: Register with both `*.read` and `*.write` scopes (e.g., `tickets.read`, `tickets.write`, etc.)
  - Can call both read and write operations
  - Can call `.feed` operations (comments) on resources they have write access to

**Scope names** (from Phase 1):
- **Read scopes**: `tickets.read`, `assets.read`, `cmdb.read`, `kb.read`, `projects.read`, `people.read`, `accounts.read`, `groups.read`, `metadata.read`
- **Write scopes**: `tickets.write`, `assets.write`, `cmdb.write`, `kb.write`, `projects.write`, `people.write`
- **Feed scopes** (comments): `tickets.feed`, `assets.feed`, `cmdb.feed`

**Implementation in Phase 2**:
- Each write operation handler calls `oauthAuth.validateToken(token, ['tickets.write'])` etc.
- Server validates the token's `scp` claim contains the required scope
- Returns 403 if scope is missing

**Example use cases**:
- **Service A (Read-Only Dashboard)**: Assign only `*.read` scopes → can search/view tickets but cannot create/edit
- **Service B (Full Copilot Agent)**: Assign `*.read` + `*.write` scopes → can create, update, comment on tickets
- **CI/CD Pipeline**: Assign only `cmdb.write` scope → can only modify CMDB entries, not tickets

---

### 2. Token Refresh
**Question**: Should clients refresh tokens, or rely on 1-hour default JWT expiry? 

**Recommendation**: Let clients handle refresh via Azure SDK/MSAL libraries. MCP server validates only (doesn't issue tokens). Much simpler architecture.

### 3. Service Accounts
**Question**: How should CI/CD pipelines or automation authenticate to the server?

**Recommendation**: Create service principal in Entra, generate client credentials, have CI/CD use those to get OAuth tokens via Client Credentials flow. Service account tokens same format as user tokens.

### 4. GCC Tenant vs. Commercial
**Question**: How to handle split deployments (Azure GCC production vs. commercial legacy)?

**Recommendation**: Each tenant needs separate Entra app registration. GCC deployment uses GCC Entra tenant; commercial uses commercial tenant. Both can exist independently. Plan migration tenant-by-tenant.

---

## Next Steps
1. **Share this document** with your System Engineers / Tenant Admin team
   - Focus on Phase 1 (two sections: Resource App registration, then Client App registration)
   - Phase 1 contains complete step-by-step instructions
2. **Phase 1 (Entra Registration)**: System Engineers complete BOTH:
   - **A. Register the Resource App** ("TDX MCP Connector") — scopes are defined in Phase 1 section A, step 3
   - **B. Register at least one Client App** — follow the example in Phase 1 section B
     - Example: "TDX MCP Copilot - Read-Only" (or full-access, depending on first need)
3. **Collect Phase 1 Deliverables** from System Engineers:
   - Resource App ID: `AZURE_ENTRA_APP_ID`
   - Tenant ID: `AZURE_ENTRA_TENANT_ID`
   - Confirmation: All scopes (read, write, feed) registered in the resource app
   - Client app credentials: Application ID and secret (if needed by first client)
4. **Development begins**: With Phase 1 complete, developer starts Phase 2–5 implementation
