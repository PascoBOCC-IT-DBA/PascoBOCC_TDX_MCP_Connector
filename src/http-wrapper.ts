#!/usr/bin/env node

/**
 * HTTP Wrapper for MCP Server (CLEAN VERSION)
 * Simplified to use single persistent MCP process, no sessions or pooling
 * Provides HTTP endpoints that forward requests to the MCP stdio server
 */

import http from 'http';
import type { ServerResponse } from 'http';
import { createHash, timingSafeEqual } from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { RateLimiter } from './rate-limiter.js';
import { PerKeyQuota } from './per-key-quota.js';
import { loadRateLimiterConfig } from './rate-limit-config.js';
import { canAccessTool, getToolAccessLevel, filterToolsByAccessLevel, type AccessLevel } from './tool-access-config.js';
import { McpTransport, RequestTimeoutError } from './mcp-transport.js';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || process.env.MCP_HTTP_PORT || '3000', 10);

const unresolvedKeyVaultRefs: string[] = [];

/**
 * App Service leaves the literal "@Microsoft.KeyVault(SecretUri=...)" string in the
 * env var when a Key Vault reference fails to resolve. Treat that as unconfigured so
 * a failed secret fetch can never become a publicly guessable API key.
 */
function readApiKey(envName: string): string | null {
  const value = (process.env[envName] || '').trim();
  if (!value) return null;
  if (value.startsWith('@Microsoft.KeyVault(')) {
    unresolvedKeyVaultRefs.push(envName);
    return null;
  }
  return value;
}

const API_KEY_READONLY = readApiKey('MCP_API_KEY_READONLY');
const API_KEY_READWRITE = readApiKey('MCP_API_KEY_READWRITE');
// When running from dist/http-wrapper.js, index.js is in the same directory
const MCPscriptPath = join(__dirname, 'index.js');
// Global fallback timeout for MCP requests in milliseconds
const REQUEST_TIMEOUT_MS = parseInt(process.env.MCP_REQUEST_TIMEOUT_MS || '60000', 10);
// Method-specific timeout overrides (milliseconds)
const INIT_TIMEOUT_MS = parseInt(process.env.MCP_INIT_TIMEOUT_MS || '30000', 10);
const TOOLS_LIST_TIMEOUT_MS = parseInt(process.env.MCP_TOOLS_LIST_TIMEOUT_MS || '30000', 10);
const TOOLS_CALL_TIMEOUT_MS = parseInt(process.env.MCP_TOOLS_CALL_TIMEOUT_MS || '180000', 10);

/**
 * Browser origins permitted to reach this server. Comma-separated; '*' restores the
 * unrestricted behaviour. Empty (the default) means no browser origin is allowed.
 */
const ALLOWED_ORIGINS = (process.env.MCP_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const ALLOW_ANY_ORIGIN = ALLOWED_ORIGINS.includes('*');

console.log(`[Startup] HTTP Wrapper initializing...`);
console.log(`[Startup] PORT: ${PORT}`);
console.log(`[Startup] API_KEY_READONLY: ${API_KEY_READONLY ? 'configured' : 'not configured'}`);
console.log(`[Startup] API_KEY_READWRITE: ${API_KEY_READWRITE ? 'configured' : 'not configured'}`);
console.log(`[Startup] Allowed origins: ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(', ') : 'none (non-browser clients only)'}`);
console.log(`[Startup] MCP Script: ${MCPscriptPath}`);
console.log(`[Startup] Request Timeout (default): ${REQUEST_TIMEOUT_MS}ms`);
console.log(`[Startup] Request Timeout (initialize): ${INIT_TIMEOUT_MS}ms`);
console.log(`[Startup] Request Timeout (tools/list): ${TOOLS_LIST_TIMEOUT_MS}ms`);
console.log(`[Startup] Request Timeout (tools/call): ${TOOLS_CALL_TIMEOUT_MS}ms`);

/**
 * Refuse to serve traffic in an insecure configuration rather than failing open.
 */
function assertSecureConfiguration() {
  // The flag was removed; warn so a stale App Service setting doesn't look like it still works.
  if (process.env.MCP_ALLOW_UNAUTH_INITIALIZE) {
    console.warn('[Startup] WARNING: MCP_ALLOW_UNAUTH_INITIALIZE is set but no longer supported - every /mcp request requires an API key. Remove the setting.');
  }

  const problems: string[] = [];

  for (const envName of unresolvedKeyVaultRefs) {
    problems.push(`${envName} holds an unresolved Key Vault reference - the secret failed to fetch`);
  }

  if (!API_KEY_READONLY && !API_KEY_READWRITE) {
    problems.push('Neither MCP_API_KEY_READONLY nor MCP_API_KEY_READWRITE is set - every tool would be reachable unauthenticated');
  }

  if (API_KEY_READONLY && API_KEY_READWRITE && API_KEY_READONLY === API_KEY_READWRITE) {
    problems.push('MCP_API_KEY_READONLY and MCP_API_KEY_READWRITE are identical - the read-only tier would grant write access');
  }

  for (const [name, key] of [['MCP_API_KEY_READONLY', API_KEY_READONLY], ['MCP_API_KEY_READWRITE', API_KEY_READWRITE]] as const) {
    if (key && key.length < 32) {
      problems.push(`${name} is shorter than 32 characters`);
    }
  }

  if (problems.length > 0) {
    console.error('[Startup] FATAL: Insecure configuration:');
    for (const problem of problems) {
      console.error(`[Startup]   - ${problem}`);
    }
    process.exit(1);
  }
}

// Initialize Rate Limiter
let rateLimiter: RateLimiter | null = null;
let perKeyQuota: PerKeyQuota | null = null;
let queueTimeoutMs = 300000;
let rateLimiterStatsInterval: NodeJS.Timeout | null = null;

function initializeRateLimiter() {
  try {
    const config = loadRateLimiterConfig();
    
    if (!config.enabled) {
      console.warn('[Startup] Rate limiting is DISABLED');
      return;
    }

    rateLimiter = new RateLimiter(
      config.callsPerWindow,
      config.windowMs,
      config.burstCapacityMultiplier
    );

    perKeyQuota = new PerKeyQuota(
      Math.max(1, Math.floor(config.callsPerWindow * config.perKeyShare)),
      config.windowMs
    );

    queueTimeoutMs = config.queueTimeoutMs;

    console.error(`[Startup] ✓ Rate limiter initialized: ${config.callsPerWindow} calls per ${config.windowMs}ms`);

    // Log rate limiter stats every 30 seconds
    rateLimiterStatsInterval = setInterval(() => {
      if (rateLimiter) {
        const stats = rateLimiter.getStats();
        if (stats.queueDepth > 0) {
          console.error(
            `[Rate Limiter] Stats: tokens=${stats.tokensAvailable.toFixed(2)}, ` +
            `queue=${stats.queueDepth}, requests=${stats.totalRequests}, ` +
            `avg_wait=${stats.avgWaitTimeMs}ms`
          );
        }
      }
    }, 30000);
  } catch (err) {
    // The limiter exists to protect TDX's own budget, so serving traffic without it
    // would silently exceed the upstream limit. Fail closed like the auth checks do.
    console.error('[Startup] FATAL: Failed to initialize rate limiter:', err);
    console.error('[Startup] Refusing to start - set TDX_RATE_LIMIT_ENABLED=false to run without it deliberately.');
    process.exit(1);
  }
}

function getRequestTimeoutMs(message: any): number {
  const methodName = message?.method;

  if (methodName === 'initialize') {
    return INIT_TIMEOUT_MS;
  }

  if (methodName === 'tools/list') {
    return TOOLS_LIST_TIMEOUT_MS;
  }

  if (methodName === 'tools/call' || methodName === 'call_tool') {
    return TOOLS_CALL_TIMEOUT_MS;
  }

  return REQUEST_TIMEOUT_MS;
}

function getProvidedApiKey(req: http.IncomingMessage): string {
  const authHeaderRaw = req.headers.authorization;
  const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw || '';

  if (authHeader) {
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.slice(7).trim();
    }
    return authHeader.trim();
  }

  const candidateHeaders = ['x-api-key', 'api-key', 'x-functions-key'];
  for (const headerName of candidateHeaders) {
    const headerRaw = req.headers[headerName];
    const headerValue = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
    if (typeof headerValue === 'string' && headerValue.trim()) {
      return headerValue.trim();
    }
  }

  return '';
}

/**
 * Constant-time key comparison. Hashing first keeps both inputs the same length,
 * so timingSafeEqual never throws and length isn't leaked.
 */
function keysMatch(providedKey: string, expectedKey: string | null): boolean {
  if (!expectedKey) return false;
  const provided = createHash('sha256').update(providedKey, 'utf8').digest();
  const expected = createHash('sha256').update(expectedKey, 'utf8').digest();
  return timingSafeEqual(provided, expected);
}

/**
 * Determine the access level of a provided API key
 * Returns 'readwrite', 'readonly', or null if key is invalid
 */
function getApiKeyAccessLevel(providedKey: string): AccessLevel | null {
  if (!providedKey) return null;

  // Both branches always evaluate so the result doesn't depend on which tier matched.
  const isReadWrite = keysMatch(providedKey, API_KEY_READWRITE);
  const isReadOnly = keysMatch(providedKey, API_KEY_READONLY);

  if (isReadWrite) return 'readwrite';
  if (isReadOnly) return 'readonly';

  return null;
}

/**
 * Short, stable, non-reversible label for a key so logs and quotas can name a caller
 * without ever recording the secret itself.
 */
function fingerprintKey(providedKey: string): string {
  if (!providedKey) return 'none';
  return createHash('sha256').update(providedKey, 'utf8').digest('hex').slice(0, 8);
}

interface Caller {
  level: AccessLevel | null;
  keyId: string;
}

function identifyCaller(req: http.IncomingMessage): Caller {
  const providedKey = getProvidedApiKey(req);
  return { level: getApiKeyAccessLevel(providedKey), keyId: fingerprintKey(providedKey) };
}

function describeCaller(caller: Caller): string {
  return `${caller.level ?? 'unauthenticated'}/${caller.keyId}`;
}

/**
 * Access level to enforce for a request. Falls back to 'readonly' if a caller ever
 * reaches here without a key. Returns null only when auth is disabled.
 */
function resolveEffectiveAccessLevel(keyAccessLevel: AccessLevel | null | undefined): AccessLevel | null {
  if (keyAccessLevel) {
    return keyAccessLevel;
  }
  return (API_KEY_READONLY || API_KEY_READWRITE) ? 'readonly' : null;
}

function isToolCallMethod(methodName: string): boolean {
  return methodName === 'tools/call' || methodName === 'call_tool';
}

/**
 * DNS-rebinding defence recommended by the MCP HTTP transport spec.
 *
 * A request with no Origin header is not from a browser (curl, the Copilot connector, the
 * MCP CLI) and is left alone -- auth here is header-based, so there is nothing a browser
 * would attach automatically. A request that does carry one must be on the allowlist.
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (ALLOW_ANY_ORIGIN) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, Api-Key',
  };
  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = ALLOW_ANY_ORIGIN ? '*' : origin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

/**
 * Transform MCP responses into agent-friendly format
 */
function transformMCPResponse(mcpResponse, requestMessage) {
  try {
    if (!mcpResponse) {
      return mcpResponse;
    }

    const result = mcpResponse.result || mcpResponse;
    if (!result || !result.content) {
      return mcpResponse;
    }

    const content = result.content;
    if (!Array.isArray(content) || content.length === 0) {
      return mcpResponse;
    }

    const firstContent = content[0];
    const textContent = firstContent.text || (typeof firstContent === 'string' ? firstContent : null);
    
    if (!textContent) {
      return mcpResponse;
    }

    let parsedData;
    try {
      parsedData = JSON.parse(textContent);
    } catch (e) {
      return mcpResponse;
    }

    const toolName = requestMessage?.params?.name || 'unknown';
    const itemCount = Array.isArray(parsedData) ? parsedData.length : 1;

    return {
      success: true,
      type: 'tool-result',
      tool: toolName,
      data: parsedData,
      meta: {
        count: itemCount,
        resultType: Array.isArray(parsedData) ? 'array' : 'object',
      },
      _raw: mcpResponse
    };
  } catch (err) {
    console.error(`[Transform] Error: ${(err as Error).message}`);
    return mcpResponse;
  }
}

// Single persistent MCP process
let globalMcpProcess: any = null;
let mcpRestartCount = 0;
const MAX_RESTART_ATTEMPTS = 5;
const RESTART_DELAY = 2000; // 2 seconds

function getOrCreateMCPProcess() {
  if (globalMcpProcess && !globalMcpProcess.killed) {
    return globalMcpProcess;
  }

  console.log(`[MCP] Spawning new persistent MCP process... (restart count: ${mcpRestartCount})`);
  
  if (mcpRestartCount >= MAX_RESTART_ATTEMPTS) {
    console.error(`[MCP] ❌ FATAL: Max restart attempts (${MAX_RESTART_ATTEMPTS}) exceeded. MCP process is crashing repeatedly.`);
    console.error('[MCP] Check:');
    console.error('  1. TDX_BASE_URL, TDX_BEID, TDX_WEB_SERVICES_KEY are set correctly');
    console.error('  2. TDX API is accessible from this container');
    console.error('  3. TDX credentials are valid and have required permissions');
    console.error('  4. Network connectivity to TDX instance');
    globalMcpProcess = null;
    return null;
  }
  
  const proc = spawn('node', [MCPscriptPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      TDX_BASE_URL: process.env.TDX_BASE_URL,
      TDX_BEID: process.env.TDX_BEID,
      TDX_WEB_SERVICES_KEY: process.env.TDX_WEB_SERVICES_KEY,
      TDX_APP_ID: process.env.TDX_APP_ID,
      TDX_ASSETS_APP_ID: process.env.TDX_ASSETS_APP_ID,
      TDX_KB_APP_ID: process.env.TDX_KB_APP_ID
    }
  });

  proc.on('error', (err) => {
    console.error(`[MCP] Process error: ${err.message}`);
    mcpRestartCount++;
    globalMcpProcess = null;
    transport.detach();
    transport.failAllPending(new Error(`MCP process error: ${err.message}`));
    console.log(`[MCP] Will attempt to restart in ${RESTART_DELAY}ms...`);
    setTimeout(() => {
      if (!globalMcpProcess) {
        getOrCreateMCPProcess();
      }
    }, RESTART_DELAY);
  });

  proc.on('close', (code) => {
    console.error(`[MCP] ❌ Process closed with exit code ${code}`);
    transport.detach();
    transport.failAllPending(new Error(`MCP process exited with code ${code}`));
    if (code !== 0) {
      mcpRestartCount++;
      globalMcpProcess = null;
      console.log(`[MCP] Restart count: ${mcpRestartCount}/${MAX_RESTART_ATTEMPTS}`);
      if (mcpRestartCount < MAX_RESTART_ATTEMPTS) {
        console.log(`[MCP] Will attempt to restart in ${RESTART_DELAY}ms...`);
        setTimeout(() => {
          if (!globalMcpProcess) {
            getOrCreateMCPProcess();
          }
        }, RESTART_DELAY);
      }
    } else {
      console.log('[MCP] Process exited cleanly (code 0)');
      mcpRestartCount = 0;
      globalMcpProcess = null;
    }
  });

  // Capture stderr for diagnostics
  proc.stderr.on('data', (data: Buffer) => {
    console.error(`[MCP stderr] ${data.toString().trim()}`);
  });

  globalMcpProcess = proc;
  console.log(`[MCP] New process spawned (PID: ${proc.pid})`);
  return proc;
}

const transport = new McpTransport();

// Handle MCP JSON-RPC requests
async function handleMcpRequest(message, res, caller?: Caller) {
  const hasMessageId = Object.prototype.hasOwnProperty.call(message, 'id');
  const isNotification = !hasMessageId; // Notifications don't have an ID in JSON-RPC 2.0
  const methodName = message.method || 'unknown';
  const timeoutMs = getRequestTimeoutMs(message);
  
  console.log(`[Handler] Processing ${isNotification ? 'NOTIFICATION' : 'REQUEST'} - method: ${methodName}, id: ${message.id}`);
  // Handle notifications (one-way messages that don't expect a response from MCP)
  // Examples: notifications/initialized, notifications/progress, notifications/message
  if (isNotification || methodName.startsWith('notifications/')) {
    console.log(`[Handler] Notification ${methodName} - responding immediately without MCP subprocess`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({})); // Empty response for notifications
    return;
  }

  // Acquire rate limiter token before proceeding
  if (rateLimiter) {
    // Write calls outrank reads in the queue so a busy read-only client can't delay them.
    const priority = caller?.level === 'readwrite' ? 1 : 0;
    const waitStart = Date.now();

    try {
      // A single key may only take its configured share of the shared TDX budget.
      // Over-share callers wait for their window rather than failing outright.
      if (perKeyQuota && caller) {
        await perKeyQuota.acquire(caller.keyId, queueTimeoutMs);
      }

      // Both queues share one deadline so a slow key wait can't double the client's wait.
      const remainingMs = Math.max(1, queueTimeoutMs - (Date.now() - waitStart));
      await rateLimiter.acquire(priority, remainingMs);

      const acquireTime = Date.now() - waitStart;
      if (acquireTime > 100) {
        console.error(`[Rate Limiter] Request queued for ${acquireTime}ms (caller: ${caller ? describeCaller(caller) : 'internal'}, method: ${methodName})`);
      }
    } catch (err) {
      const waitedMs = Date.now() - waitStart;
      console.error(`[Rate Limiter] Gave up after ${waitedMs}ms for ${caller ? describeCaller(caller) : 'internal'}: ${err}`);
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(queueTimeoutMs / 1000)) });
      res.end(JSON.stringify({ error: 'Service rate limit exceeded', details: (err as Error).message }));
      return;
    }
  }
  
  const proc = getOrCreateMCPProcess();
  
  if (!proc || proc.killed) {
    console.error(`[Handler] No valid MCP process available`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'MCP process unavailable' }));
    return;
  }

  console.log(`[Handler] Sending to MCP process (PID: ${proc.pid}, method: ${methodName}, timeout: ${timeoutMs}ms)`);

  try {
    const mcpResponse = await transport.send(proc, message, timeoutMs);
    if (!res.headersSent) {
      // Filter tool list by API key access level, so a read-only key never sees write tools
      const tools = mcpResponse?.result?.tools;
      if (methodName === 'tools/list' && caller?.level && Array.isArray(tools)) {
        const filtered = filterToolsByAccessLevel(tools, caller.level);
        mcpResponse.result!.tools = filtered;
        console.log(`[Handler] tools/list: Filtered ${tools.length} tools to ${filtered.length} for ${describeCaller(caller)}`);
      }
      // Return raw MCP JSON-RPC response without wrapping
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mcpResponse));
    }
  } catch (err) {
    const isTimeout = err instanceof RequestTimeoutError;
    console.error(`[Handler] ${methodName} failed: ${(err as Error).message}`);
    if (!res.headersSent) {
      res.writeHead(isTimeout ? 504 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(isTimeout
        ? { error: (err as Error).message, method: methodName }
        : { error: 'Internal error' }));
    }
  }
}

// HTTP Server
const server = http.createServer((req, res) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  // Diagnostic: surface any session/protocol headers a client sends us (we don't issue or require these)
  const sessionHeader = req.headers['mcp-session-id'];
  const protocolHeader = req.headers['mcp-protocol-version'];
  if (sessionHeader || protocolHeader) {
    console.log(`[HTTP] Client headers - Mcp-Session-Id: ${sessionHeader || 'none'}, Mcp-Protocol-Version: ${protocolHeader || 'none'}`);
  }

  // CORS
  const originHeaderRaw = req.headers.origin;
  const origin = Array.isArray(originHeaderRaw) ? originHeaderRaw[0] : originHeaderRaw;
  if (!isOriginAllowed(origin)) {
    console.warn(`[Origin] Rejected ${req.method} ${req.url} from origin '${origin}' - add it to MCP_ALLOWED_ORIGINS to permit it`);
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Origin not allowed' }));
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  // Echo the allowed origin on the actual response too, so a permitted browser client can read it.
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', ALLOW_ANY_ORIGIN ? '*' : origin);
    res.setHeader('Vary', 'Origin');
  }

  const isPublicEndpoint = req.url === '/health' || req.url === '/tools' || req.url === '/status';

  // API Key authentication for non-MCP routes
  // Only enforce if at least one API key is configured
  const anyApiKeyConfigured = API_KEY_READONLY || API_KEY_READWRITE;
  if (anyApiKeyConfigured && !isPublicEndpoint && req.url !== '/' && req.url !== '/mcp' && req.url !== '/mcp/') {
    const caller = identifyCaller(req);
    if (!caller.level) {
      console.warn(`[Auth] Rejected ${req.method} ${req.url} - invalid or missing key (fingerprint: ${caller.keyId})`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
    return;
  }

  // Status
  if (req.url === '/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: 'TDX MCP HTTP Wrapper',
      version: '1.0.0',
      port: PORT,
      uptime: process.uptime()
    }));
    return;
  }

  // Tools list endpoint - returns available tools filtered by API key access level
  if (req.url === '/tools' && req.method === 'GET') {
    // Get API key access level for filtering
    const caller = identifyCaller(req);
    const keyAccessLevel = caller.level;
    
    // Check if API keys are configured and if the provided key is valid
    const anyApiKeyConfigured = API_KEY_READONLY || API_KEY_READWRITE;
    if (anyApiKeyConfigured && !keyAccessLevel) {
      console.warn(`[Auth] Rejected GET /tools - invalid or missing key (fingerprint: ${caller.keyId})`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized - Invalid or missing API key' }));
      return;
    }
    
    const toolsListMessage = { jsonrpc: '2.0', id: `tools-list-${Date.now()}`, method: 'tools/list', params: {} };
    let savedStatus = 200;
    let responded = false;
    const fakeRes = {
      get headersSent() { return responded; },
      writeHead(code: number) { savedStatus = code; },
      end(body: string) {
        if (responded) return;
        responded = true;
        if (savedStatus === 200) {
          try {
            const parsed = JSON.parse(body);
            // Return full tool objects with descriptions and input schemas (not just names)
            // This is required for Copilot agents to properly enumerate and use tools
            let tools = parsed?.result?.tools ?? [];
            
            // Filter tools based on API key access level if applicable
            const effectiveAccessLevel = resolveEffectiveAccessLevel(keyAccessLevel);
            if (effectiveAccessLevel) {
              const originalCount = tools.length;
              tools = filterToolsByAccessLevel(tools, effectiveAccessLevel);
              console.log(`[HTTP] /tools: Filtered ${originalCount} tools to ${tools.length} for ${describeCaller(caller)}`);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ tools }));
            return;
          } catch { /* fall through to raw */ }
        }
        res.writeHead(savedStatus, { 'Content-Type': 'application/json' });
        res.end(body);
      }
    };
    handleMcpRequest(toolsListMessage, fakeRes as unknown as ServerResponse, { level: null, keyId: caller.keyId }).catch((err) => {
      console.error(`[HTTP] /tools error: ${err}`);
      if (!responded && !res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to retrieve tools list' }));
      }
    });
    return;
  }

  // MCP endpoint
  if ((req.url === '/' || req.url === '/mcp' || req.url === '/mcp/') && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) {
        console.error('[HTTP] Request too large, closing connection');
        req.connection.destroy();
      }
    });

    req.on('end', () => {
      console.log(`[HTTP] Request complete, body length: ${body.length}`);
      try {
        const message = JSON.parse(body);

        // API Key authentication for MCP endpoint
        const anyApiKeyConfigured = API_KEY_READONLY || API_KEY_READWRITE;
        let caller: Caller = { level: null, keyId: 'none' };

        if (anyApiKeyConfigured) {
          caller = identifyCaller(req);

          if (!caller.level) {
            console.warn(`[Auth] Rejected POST ${req.url} method '${message?.method ?? 'unknown'}' - invalid or missing key (fingerprint: ${caller.keyId})`);
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }
        }

        // Validate tool access for tools/call requests
        const effectiveAccessLevel = resolveEffectiveAccessLevel(caller.level);
        const effectiveCaller: Caller = { level: effectiveAccessLevel, keyId: caller.keyId };
        if (isToolCallMethod(message.method)) {
          // Every write reaches TDX as the one admin account, so this log is the only record
          // of which key asked for it. Logged before the access check so denials appear too.
          const toolName = message.params?.name ?? 'unknown';
          console.log(`[Audit] ${describeCaller(effectiveCaller)} ${message.method} ${toolName} (requires ${getToolAccessLevel(toolName)})`);
        }
        if (effectiveAccessLevel && isToolCallMethod(message.method)) {
          const toolName = message.params?.name;
          if (toolName && !canAccessTool(toolName, effectiveAccessLevel)) {
            console.warn(`[Auth] Access denied for ${describeCaller(effectiveCaller)} attempting to call tool: ${toolName}`);
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              error: `Access denied: Tool '${toolName}' requires ${getToolAccessLevel(toolName)} access level`
            }));
            return;
          }
        }

        // Call async handler
        handleMcpRequest(message, res, effectiveCaller).catch((err) => {
          console.error(`[HTTP] Unhandled error in handleMcpRequest: ${err}`);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        });
      } catch (err) {
        console.error(`[HTTP] JSON parse error: ${err}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

assertSecureConfiguration();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Startup] ✓ MCP HTTP Wrapper listening on port ${PORT}`);
  console.log(`[Startup] ✓ Endpoints: POST /mcp, GET /health, GET /tools, GET /status`);
  console.log(`[Startup] ✓ API Key (Read-only): ${API_KEY_READONLY ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
  console.log(`[Startup] ✓ API Key (Read-write): ${API_KEY_READWRITE ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
  console.log('[Startup] ✓ Environment variables verified');
  console.log('[Startup] ✓ Initializing rate limiter...');
  initializeRateLimiter();
  console.log('[Startup] ✓ Spawning MCP subprocess...');
  // Pre-spawn MCP process to catch startup errors early
  getOrCreateMCPProcess();
});

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('[ERROR] Uncaught Exception:', err);
  console.error('[ERROR] Stack:', err.stack);
  console.error('[ERROR] Process will restart in 2 seconds...');
  setTimeout(() => {
    process.exit(1);
  }, 2000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Rejection at:', promise);
  console.error('[ERROR] Reason:', reason);
  console.error('[ERROR] Process will restart in 2 seconds...');
  setTimeout(() => {
    process.exit(1);
  }, 2000);
});

// Log startup info
console.log(`[Startup] Node.js version: ${process.version}`);
console.log(`[Startup] Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`[Startup] PID: ${process.pid}`);

process.on('SIGTERM', () => {
  console.log('[Shutdown] SIGTERM received, cleaning up...');
  if (rateLimiterStatsInterval) {
    clearInterval(rateLimiterStatsInterval);
  }
  if (rateLimiter) {
    rateLimiter.shutdown();
  }
  if (perKeyQuota) {
    perKeyQuota.shutdown();
  }
  if (globalMcpProcess && !globalMcpProcess.killed) {
    globalMcpProcess.kill();
  }
  server.close(() => {
    console.log('[Shutdown] Server closed');
    process.exit(0);
  });
});
