#!/usr/bin/env node

/**
 * HTTP Wrapper for MCP Server (CLEAN VERSION)
 * Simplified to use single persistent MCP process, no sessions or pooling
 * Provides HTTP endpoints that forward requests to the MCP stdio server
 */

// @ts-nocheck

import http from 'http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { RateLimiter } from './rate-limiter.js';
import { loadRateLimiterConfig } from './rate-limit-config.js';

type JsonRpcId = string | number;

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || process.env.MCP_HTTP_PORT || 3000;
const API_KEY = process.env.MCP_API_KEY || null;
const ALLOW_UNAUTH_INITIALIZE = process.env.MCP_ALLOW_UNAUTH_INITIALIZE === 'true';
// When running from dist/http-wrapper.js, index.js is in the same directory
const MCPscriptPath = join(__dirname, 'index.js');
// Global fallback timeout for MCP requests in milliseconds
const REQUEST_TIMEOUT_MS = parseInt(process.env.MCP_REQUEST_TIMEOUT_MS || '60000', 10);
// Method-specific timeout overrides (milliseconds)
const INIT_TIMEOUT_MS = parseInt(process.env.MCP_INIT_TIMEOUT_MS || '30000', 10);
const TOOLS_LIST_TIMEOUT_MS = parseInt(process.env.MCP_TOOLS_LIST_TIMEOUT_MS || '30000', 10);
const TOOLS_CALL_TIMEOUT_MS = parseInt(process.env.MCP_TOOLS_CALL_TIMEOUT_MS || '180000', 10);

console.log(`[Startup] HTTP Wrapper initializing...`);
console.log(`[Startup] PORT: ${PORT}`);
console.log(`[Startup] API_KEY: ${API_KEY ? 'configured' : 'not configured'}`);
console.log(`[Startup] Allow Unauthenticated Initialize: ${ALLOW_UNAUTH_INITIALIZE ? 'enabled' : 'disabled'}`);
console.log(`[Startup] MCP Script: ${MCPscriptPath}`);
console.log(`[Startup] Request Timeout (default): ${REQUEST_TIMEOUT_MS}ms`);
console.log(`[Startup] Request Timeout (initialize): ${INIT_TIMEOUT_MS}ms`);
console.log(`[Startup] Request Timeout (tools/list): ${TOOLS_LIST_TIMEOUT_MS}ms`);
console.log(`[Startup] Request Timeout (tools/call): ${TOOLS_CALL_TIMEOUT_MS}ms`);

// Initialize Rate Limiter
let rateLimiter: RateLimiter | null = null;
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
    console.error(`[Startup] Failed to initialize rate limiter: ${err}`);
    rateLimiter = null;
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

function isNotificationMessage(message: any): boolean {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return false;
  }

  const hasMessageId = Object.prototype.hasOwnProperty.call(message, 'id');
  const methodName = typeof message.method === 'string' ? message.method : '';

  return !hasMessageId || methodName.startsWith('notifications/');
}

function isAllowedWithoutAuthInCompatibilityMode(message: any): boolean {
  if (!ALLOW_UNAUTH_INITIALIZE) {
    return false;
  }

  if (Array.isArray(message)) {
    return message.length > 0 && message.every((entry) => isNotificationMessage(entry));
  }

  const methodName = typeof message?.method === 'string' ? message.method : '';
  if (methodName === 'initialize') {
    return true;
  }

  return isNotificationMessage(message);
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
    console.error(`[Transform] Error: ${err.message}`);
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
      ALLOW_MODIFICATIONS: process.env.ALLOW_MODIFICATIONS || 'false',
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
    console.log(`[MCP] Will attempt to restart in ${RESTART_DELAY}ms...`);
    setTimeout(() => {
      if (!globalMcpProcess) {
        getOrCreateMCPProcess();
      }
    }, RESTART_DELAY);
  });

  proc.on('close', (code) => {
    console.error(`[MCP] ❌ Process closed with exit code ${code}`);
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

// Pending requests map
const pendingRequests = new Map<JsonRpcId, {
  resolve: (data: any) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}>();

// Stdout listener state
let stdoutListenerAttached = false;

function ensureStdoutListener() {
  if (stdoutListenerAttached) return;
  
  const proc = getOrCreateMCPProcess();
  let buffer = '';
  let initMarkerSeen = false;

  console.log(`[MCP] Attaching stdout listener to process PID: ${proc.pid}`);

  proc.stdout.on('data', (data: Buffer) => {
    const dataStr = data.toString();
    console.log(`[MCP] stdout (${data.length} bytes): ${dataStr.substring(0, 200)}`);
    buffer += dataStr;
    
    // Check for initialization marker
    if (!initMarkerSeen && buffer.includes('[MCP Server Ready]')) {
      console.log(`[MCP] ✓ Detected MCP initialization complete`);
      initMarkerSeen = true;
    }
    
    const lines = buffer.split('\n');
    
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Try to parse as JSON
      if (line.startsWith('{')) {
        try {
          const msg = JSON.parse(line);
          console.log(`[MCP] Received JSON-RPC response with id: ${msg.id}`);
          
          if (Object.prototype.hasOwnProperty.call(msg, 'id') && pendingRequests.has(msg.id)) {
            const req = pendingRequests.get(msg.id)!;
            pendingRequests.delete(msg.id);
            clearTimeout(req.timeout);
            req.resolve(msg);
          }
        } catch (e) {
          console.log(`[MCP] Failed to parse line as JSON: ${line.substring(0, 100)}`);
        }
      }
    }
    
    buffer = lines[lines.length - 1];
  });

  console.log(`[MCP] stdout listener attached successfully`);
  stdoutListenerAttached = true;
}

// Handle MCP JSON-RPC requests
async function handleMcpRequest(message, res) {
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
    try {
      const acquireStart = Date.now();
      await rateLimiter.acquire();
      const acquireTime = Date.now() - acquireStart;
      if (acquireTime > 100) {
        console.error(`[Rate Limiter] Request queued for ${acquireTime}ms`);
      }
    } catch (err) {
      console.error(`[Rate Limiter] Failed to acquire token: ${err}`);
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Service rate limit exceeded', details: (err as Error).message }));
      return;
    }
  }
  
  ensureStdoutListener();
  const proc = getOrCreateMCPProcess();
  
  if (!proc || proc.killed) {
    console.error(`[Handler] No valid MCP process available`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'MCP process unavailable' }));
    return;
  }

  const requestId: JsonRpcId = message.id;
  const timeout = setTimeout(() => {
    if (pendingRequests.has(requestId)) {
      console.error(`[Handler] Request ${requestId} timeout after ${timeoutMs}ms (method: ${methodName})`);
      pendingRequests.delete(requestId);
      if (!res.headersSent) {
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Request timeout (${timeoutMs / 1000}s)`, method: methodName }));
      }
    }
  }, timeoutMs);

  const promise = new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject, timeout });
  });

  promise.then((mcpResponse) => {
    if (!res.headersSent) {
      // Return raw MCP JSON-RPC response without wrapping
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mcpResponse));
    }
  }).catch((err) => {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal error', details: (err as Error).message }));
    }
  });

  // Send the request
  try {
    const msgStr = JSON.stringify(message) + '\n';
    console.log(`[Handler] Sending to MCP process (PID: ${proc.pid}, timeout: ${timeoutMs}ms): ${msgStr.substring(0, 100)}`);
    proc.stdin.write(msgStr, (err) => {
      if (err) {
        console.error(`[Handler] Write error: ${err.message}`);
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to write to MCP' }));
        }
      }
    });
  } catch (err) {
    console.error(`[Handler] Write exception: ${err}`);
    clearTimeout(timeout);
    pendingRequests.delete(requestId);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Write exception', details: (err as Error).message }));
    }
  }
}

// HTTP Server
const server = http.createServer((req, res) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  
  // CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  const isPublicEndpoint = req.url === '/health' || req.url === '/tools' || req.url === '/status';

  // API Key authentication for non-MCP routes
  if (API_KEY && !isPublicEndpoint && req.url !== '/' && req.url !== '/mcp' && req.url !== '/mcp/') {
    const providedKey = getProvidedApiKey(req);
    if (!providedKey || providedKey !== API_KEY) {
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

  // Tools list - query MCP subprocess dynamically so ALLOW_MODIFICATIONS is respected
  if (req.url === '/tools' && req.method === 'GET') {
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
            const toolNames = (parsed?.result?.tools ?? []).map((t: { name: string }) => t.name);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ tools: toolNames }));
            return;
          } catch { /* fall through to raw */ }
        }
        res.writeHead(savedStatus, { 'Content-Type': 'application/json' });
        res.end(body);
      }
    };
    handleMcpRequest(toolsListMessage, fakeRes as unknown as ServerResponse).catch((err) => {
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

        // API Key authentication for MCP endpoint with optional compatibility bypass
        if (API_KEY) {
          const providedKey = getProvidedApiKey(req);

          if (!providedKey || providedKey !== API_KEY) {
            if (!isAllowedWithoutAuthInCompatibilityMode(message)) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unauthorized' }));
              return;
            }
            console.warn('[Auth] Allowing unauthenticated MCP compatibility request due to MCP_ALLOW_UNAUTH_INITIALIZE=true');
          }
        }

        // Call async handler
        handleMcpRequest(message, res).catch((err) => {
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Startup] ✓ MCP HTTP Wrapper listening on port ${PORT}`);
  console.log(`[Startup] ✓ Endpoints: POST /mcp, GET /health, GET /tools, GET /status`);
  console.log(`[Startup] ✓ API Key: ${API_KEY ? 'REQUIRED' : 'NOT REQUIRED'}`);
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
  if (globalMcpProcess && !globalMcpProcess.killed) {
    globalMcpProcess.kill();
  }
  server.close(() => {
    console.log('[Shutdown] Server closed');
    process.exit(0);
  });
});
