#!/usr/bin/env node

/**
 * HTTP Wrapper for MCP Server
 * Provides HTTP endpoints that forward requests to the MCP stdio server
 * Allows Copilot Studio and other clients to interact with MCP tools via HTTP
 */

// @ts-nocheck

import http from 'http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { EventEmitter } from 'events';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.MCP_HTTP_PORT || 3000;
const API_KEY = process.env.MCP_API_KEY || null; // Set to require API key auth
const MCPscriptPath = join(__dirname, '..', 'dist', 'index.js');

/**
 * Transform MCP responses into agent-friendly format
 * Flattens nested JSON, extracts data, and adds metadata
 */
function transformMCPResponse(mcpResponse, requestMessage) {
  try {
    if (!mcpResponse) {
      return mcpResponse;
    }

    // Extract result content - handle both formats:
    // Old: mcpResponse.result.content
    // Current HTTP wrapper: returns the MCP response directly
    const result = mcpResponse.result || mcpResponse;
    if (!result || !result.content) {
      console.log(`[Transform] No content in response, returning as-is`);
      return mcpResponse;
    }

    const content = result.content;
    if (!Array.isArray(content) || content.length === 0) {
      console.log(`[Transform] Content is not array or empty`);
      return mcpResponse;
    }

    const firstContent = content[0];
    const textContent = firstContent.text || (typeof firstContent === 'string' ? firstContent : null);
    
    if (!textContent) {
      console.log(`[Transform] No text content found`);
      return mcpResponse;
    }

    // Parse the JSON text
    let parsedData;
    try {
      console.log(`[Transform] Attempting to parse JSON string (${textContent.length} chars, starts with: ${textContent.substring(0, 50)})`);
      parsedData = JSON.parse(textContent);
    } catch (e) {
      // If not JSON, return as-is
      console.log(`[Transform] JSON parse error: ${e.message}, returning original`);
      return mcpResponse;
    }

    const toolName = requestMessage?.params?.name || 'unknown';
    const toolArgs = requestMessage?.params?.arguments || {};
    const timestamp = new Date().toISOString();

    // Determine entity type
    let entityType = 'unknown';
    if (toolName.includes('ticket')) entityType = 'tickets';
    else if (toolName.includes('asset')) entityType = 'assets';
    else if (toolName.includes('cmdb') || toolName.includes('configuration')) entityType = 'configurationItems';
    else if (toolName.includes('kb') || toolName.includes('knowledge')) entityType = 'knowledgeBase';
    else if (toolName.includes('project')) entityType = 'projects';
    else if (toolName.includes('account')) entityType = 'accounts';
    else if (toolName.includes('people') || toolName.includes('person')) entityType = 'people';
    else if (toolName.includes('group')) entityType = 'groups';
    else if (toolName.includes('status')) entityType = 'statuses';

    // Count items if array
    const itemCount = Array.isArray(parsedData) ? parsedData.length : 1;

    // Build transformed response
    const transformed = {
      success: true,
      type: entityType,
      timestamp: timestamp,
      tool: toolName,
      
      // Main data payload - flattened
      data: parsedData,
      
      // Metadata for agents
      meta: {
        count: itemCount,
        resultType: Array.isArray(parsedData) ? 'array' : 'object',
        query: toolArgs,
        tool: {
          name: toolName,
          type: entityType
        }
      },
      
      // Keep original for reference
      _raw: mcpResponse
    };

    console.log(`[Transform] Successfully transformed response with ${itemCount} items`);
    return transformed;
  } catch (err) {
    console.error(`[Transform] Unexpected error: ${err.message}`, err);
    return mcpResponse;
  }
}

class MCPServerPool {
  availableProcesses: any[] = [];
  warmingProcesses: Set<Promise<any>> = new Set();
  maxProcesses: number = 3;
  minWarmProcesses: number = 1;
  processTimeout: number = 15000; // 15s timeout for process operations

  constructor() {
    console.log('[MCP Pool] Initializing with max=' + this.maxProcesses + ', min-warm=' + this.minWarmProcesses);
  }

  async spawnProcess(): Promise<any> {
    return new Promise((resolve) => {
      console.log(`[MCP Pool] Spawning new MCP process`);
      
      const proc = spawn('node', [MCPscriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.processTimeout,
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

      // Mark process with metadata
      (proc as any).createdAt = Date.now();
      (proc as any).isHealthy = false;
      (proc as any).requestCount = 0;

      // Aggressive error handling
      const errorHandler = (err: Error) => {
        console.error(`[MCP Pool] Process error (PID ${proc.pid}):`, err.message);
        (proc as any).isHealthy = false;
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      };

      const closeHandler = (code: number) => {
        console.error(`[MCP Pool] Process closed (PID ${proc.pid}) with code ${code}`);
        (proc as any).isHealthy = false;
      };

      proc.on('error', errorHandler);
      proc.on('close', closeHandler);
      proc.on('exit', closeHandler);

      // Don't wait for ready message - assume process is ready immediately
      // We'll validate on first use
      (proc as any).isHealthy = true;
      console.log(`[MCP Pool] Process spawned (PID: ${proc.pid}), ready for use`);
      resolve(proc);
    });
  }

  async warmup() {
    const totalWarming = this.availableProcesses.length + this.warmingProcesses.size;
    
    while (this.availableProcesses.length < this.minWarmProcesses && 
           totalWarming < this.maxProcesses) {
      const warmupPromise = this.spawnProcess().then(proc => {
        if (proc && !proc.killed && (proc as any).isHealthy) {
          this.availableProcesses.push(proc);
          console.log(`[MCP Pool] Warm process ready (PID: ${proc.pid}), available=${this.availableProcesses.length}`);
        }
        this.warmingProcesses.delete(warmupPromise);
      }).catch(err => {
        console.error('[MCP Pool] Warmup failed:', err.message);
        this.warmingProcesses.delete(warmupPromise);
      });
      
      this.warmingProcesses.add(warmupPromise);
    }
  }

  getProcess(): any {
    // Return healthy warm process if available
    while (this.availableProcesses.length > 0) {
      const proc = this.availableProcesses.shift();
      
      if (proc && !proc.killed && (proc as any).isHealthy) {
        console.log(`[MCP Pool] Using warm process (PID: ${proc.pid}), available=${this.availableProcesses.length}`);
        (proc as any).requestCount++;
        return proc;
      } else {
        console.log(`[MCP Pool] Discarding dead/unhealthy process`);
        if (proc && !proc.killed) {
          proc.kill('SIGKILL');
        }
      }
    }

    // Spawn a new process immediately (don't wait)
    console.log(`[MCP Pool] No warm processes available, spawning new one`);
    const newProc = spawn('node', [MCPscriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: this.processTimeout,
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

    (newProc as any).createdAt = Date.now();
    (newProc as any).isHealthy = true;
    (newProc as any).requestCount = 0;

    newProc.on('error', (err) => {
      console.error(`[MCP Pool] Process error (PID ${newProc.pid}):`, err.message);
      (newProc as any).isHealthy = false;
    });

    // Continue warming up in background
    this.warmup();
    
    return newProc;
  }

  releaseProcess(proc: any) {
    if (!proc) return;
    
    // Mark unhealthy processes for disposal
    if (proc.killed || !(proc as any).isHealthy) {
      console.log(`[MCP Pool] Releasing dead process (PID: ${proc.pid})`);
      return;
    }

    // Recycle old processes after many requests
    const age = Date.now() - (proc as any).createdAt;
    if (age > 300000 || (proc as any).requestCount > 100) { // 5 min or 100 requests
      console.log(`[MCP Pool] Recycling old process (PID: ${proc.pid}, age=${age}ms, requests=${(proc as any).requestCount})`);
      if (!proc.killed) {
        proc.kill('SIGTERM');
      }
      return;
    }

    // Return healthy process to pool
    if (this.availableProcesses.length < this.maxProcesses) {
      this.availableProcesses.push(proc);
      console.log(`[MCP Pool] Returned process to pool (PID: ${proc.pid}), available=${this.availableProcesses.length}`);
    } else {
      console.log(`[MCP Pool] Pool full, discarding process (PID: ${proc.pid})`);
      if (!proc.killed) {
        proc.kill('SIGTERM');
      }
    }

    // Maintain warmup
    this.warmup();
  }

  cleanup() {
    console.log('[MCP Pool] Cleaning up...');
    this.availableProcesses.forEach(proc => {
      if (proc && !proc.killed) {
        proc.kill('SIGKILL');
      }
    });
    this.availableProcesses = [];
    this.warmingProcesses.clear();
  }

  async initialize() {
    console.log('[MCP Pool] Initializing...');
    await this.warmup();
    await Promise.race([
      Promise.all(Array.from(this.warmingProcesses)),
      new Promise(resolve => setTimeout(resolve, 5000)) // Max 5s wait
    ]);
    console.log(`[MCP Pool] Ready with ${this.availableProcesses.length} warm processes`);
  }
}

const mcpPool = new MCPServerPool();

// MCP Session Manager for HTTP transport
class MCPSession {
  sessionId: string;
  mcp: any;
  requestId: number = 0;
  pendingRequests: Map<number, any>;
  sseClients: any[] = [];
  messageQueue: any[] = [];
  responseHandlers: any[] = [];
  outputBuffer: string = '';
  lastRequest: any = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.mcp = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.sseClients = [];
    this.messageQueue = [];
    this.outputBuffer = '';
    this.lastRequest = null;
    this.responseHandlers = [];
  }

  initialize() {
    this.mcp = mcpPool.getProcess();
    this.setupMCPListeners();
  }

  setupMCPListeners() {
    this.mcp.stdout.on('data', (data) => {
      this.outputBuffer += data.toString();
      this.processBuffer();
    });

    this.mcp.stderr.on('data', (data) => {
      console.error(`[MCP Session] stderr for ${this.sessionId}:`, data.toString());
    });

    this.mcp.on('error', (err) => {
      console.error(`[MCP Session] Process error for ${this.sessionId}:`, err);
      this.broadcastToClients({ type: 'error', error: err.message });
    });

    this.mcp.on('close', (code) => {
      console.log(`[MCP Session] Process closed for ${this.sessionId} with code ${code}`);
      // Process any remaining buffer
      this.processBuffer(true);
      this.broadcastToClients({ type: 'closed', code });
    });
  }

  processBuffer(force = false) {
    // Try to extract complete JSON-RPC messages from buffer
    let startIdx = 0;
    let braceCount = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < this.outputBuffer.length; i++) {
      const char = this.outputBuffer[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"' && !escaped) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;

        // Complete JSON object found
        if (braceCount === 0 && i > startIdx && this.outputBuffer[startIdx] === '{') {
          try {
            const jsonStr = this.outputBuffer.substring(startIdx, i + 1);
            const message = JSON.parse(jsonStr);
            console.log(`[MCP Session] Parsed response for ${this.sessionId}:`, JSON.stringify(message).substring(0, 150));
            this.handleMCPResponse(message);
            startIdx = i + 1;
          } catch (err) {
            console.error('[MCP Session] Parse error:', err.message);
          }
        }
      }
    }

    // Keep unparsed portion in buffer, trim processed portion
    if (startIdx > 0) {
      this.outputBuffer = this.outputBuffer.substring(startIdx).trim();
    }

    // Skip logging lines that aren't JSON
    if (this.outputBuffer && !this.outputBuffer.startsWith('{')) {
      const lines = this.outputBuffer.split('\n');
      const jsonStart = lines.findIndex(line => line.trim().startsWith('{'));
      if (jsonStart > 0) {
        this.outputBuffer = lines.slice(jsonStart).join('\n');
      }
    }
  }

  sendRequest(message) {
    console.log(`[MCP Session] Sending request to ${this.sessionId}:`, JSON.stringify(message).substring(0, 100));
    this.lastRequest = message; // Store for use in transformation
    
    // Validate process is alive
    if (!this.mcp || this.mcp.killed || (this.mcp as any).isHealthy === false) {
      console.error(`[MCP Session] Process is dead/unhealthy for ${this.sessionId}, reinitializing...`);
      // Mark as dead if it exists
      if (this.mcp && !(this.mcp as any).isHealthy) {
        console.error(`[MCP Session] Marking process unhealthy before reinit`);
        (this.mcp as any).isHealthy = false;
      }
      this.initialize();
    }
    
    if (!this.mcp || this.mcp.killed) {
      console.error(`[MCP Session] Still no valid process after reinit!`);
      return;
    }
    
    try {
      const msgStr = JSON.stringify(message) + '\n';
      console.log(`[MCP Session] Writing to stdin: ${msgStr.substring(0, 100)}`);
      this.mcp.stdin.write(msgStr, (err: Error | null) => {
        if (err) {
          console.error(`[MCP Session] Write error: ${err.message}`);
          (this.mcp as any).isHealthy = false;
        }
      });
    } catch (err) {
      console.error('[MCP Session] Write exception:', err);
      if (this.mcp) {
        (this.mcp as any).isHealthy = false;
      }
    }
  }

  handleMCPResponse(message) {
    console.log(`[MCP Session] Received response with id: ${message.id}`);
    
    // Check if any HTTP handlers are waiting for this response
    // (only if this message has an id - notifications don't have responses)
    if (message.id && this.responseHandlers && this.responseHandlers.length > 0) {
      const matched = this.responseHandlers.find(handler => {
        try {
          return handler(message);
        } catch (err) {
          console.error('[MCP Session] Error in response handler:', err.message);
          return false;
        }
      });
      
      if (matched) {
        console.log(`[MCP Session] Response matched HTTP handler for id ${message.id}`);
        // Don't broadcast to SSE if HTTP handler claimed it
        return;
      }
    }
    
    // Check if this is a control message (initialize, tools/list, notifications)
    // vs a tool call result
    const isControlMessage = !message.result?.content || 
                             message.result?.tools ||
                             !Array.isArray(message.result?.content);
    
    let transformedMessage = message;
    
    if (!isControlMessage) {
      // Transform the message for better agent consumption
      transformedMessage = transformMCPResponse(message, this.lastRequest);
      console.log(`[MCP Session] Transformed tool response`);
    } else {
      console.log(`[MCP Session] Control message, passing through without transformation`);
    }
    
    // Broadcast to all SSE clients
    this.broadcastToClients(transformedMessage);
  }

  registerSSEClient(res) {
    this.sseClients.push(res);
    console.log(`[MCP Session] Registered SSE client, ${this.messageQueue.length} queued messages to flush`);
    
    // Send any queued messages
    this.messageQueue.forEach((msg, idx) => {
      try {
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
        console.log(`[MCP Session] Flushed queued message ${idx + 1}/${this.messageQueue.length}`);
      } catch (err) {
        console.error(`[MCP Session] Error flushing queued message: ${err.message}`);
      }
    });
    this.messageQueue = [];
    console.log(`[MCP Session] Queued message flush complete`);
  }

  broadcastToClients(message) {
    this.sseClients = this.sseClients.filter(res => !res.destroyed);
    
    console.log(`[MCP Session] Broadcasting to ${this.sseClients.length} SSE clients for session ${this.sessionId}`);
    console.log(`[MCP Session] Message to broadcast:`, JSON.stringify(message).substring(0, 200));
    
    if (this.sseClients.length === 0) {
      console.log(`[MCP Session] No active SSE clients, queuing message for ${this.sessionId}`);
      this.messageQueue.push(message);
    } else {
      this.sseClients.forEach((res, idx) => {
        try {
          const sseData = `data: ${JSON.stringify(message)}\n\n`;
          res.write(sseData);
          console.log(`[MCP Session] Sent response to SSE client ${idx + 1}/${this.sseClients.length}, length: ${sseData.length} bytes`);
        } catch (err) {
          console.error(`[MCP Session] Error writing to SSE client: ${err.message}`);
        }
      });
    }
  }

  removeSSEClient(res) {
    this.sseClients = this.sseClients.filter(r => r !== res);
  }

  cleanup() {
    this.sseClients.forEach(res => {
      if (!res.destroyed) {
        res.end();
      }
    });
    this.sseClients = [];
    if (this.mcp && !this.mcp.killed) {
      this.mcp.kill();
    }
    mcpPool.releaseProcess(this.mcp);
  }
}

const mcpSessions = new Map();

function getOrCreateSession(sessionId) {
  if (!mcpSessions.has(sessionId)) {
    const session = new MCPSession(sessionId);
    session.initialize();
    mcpSessions.set(sessionId, session);
  }
  return mcpSessions.get(sessionId);
}

// Create HTTP server
const server = http.createServer((req, res) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  
  // Helper to send response with consistent CORS headers
  const sendResponse = (statusCode: number, contentType: string, body: string) => {
    res.writeHead(statusCode, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': contentType
    });
    res.end(body);
  };

  const sendError = (statusCode: number, error: string, details?: string) => {
    sendResponse(statusCode, 'application/json', JSON.stringify({ 
      error, 
      ...(details && { details }) 
    }));
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // API Key authentication (if configured, but allow /health and /tools without auth)
  if (API_KEY && req.url !== '/health' && req.url !== '/tools' && req.url !== '/' && req.url !== '/status') {
    const authHeader = req.headers.authorization || '';
    const providedKey = authHeader.replace('Bearer ', '').trim();
    
    if (!providedKey || providedKey !== API_KEY) {
      sendError(401, 'Unauthorized: Invalid or missing API key');
      return;
    }
  }

  // MCP-over-HTTP root endpoint (for VS Code HTTP client)
  if ((req.url === '/' || req.url.startsWith('/?')) && req.method === 'POST') {
    handleMCPHTTPRequest(req, res);
    return;
  }

  // MCP-over-HTTP SSE endpoint
  if ((req.url === '/' || req.url.startsWith('/?')) && req.method === 'GET') {
    handleMCPSSE(req, res);
    return;
  }

  // Health check endpoint (no auth required)
  if (req.url === '/health' && req.method === 'GET') {
    sendResponse(200, 'application/json', JSON.stringify({ 
      status: 'healthy', 
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Status endpoint
  if (req.url === '/status' && req.method === 'GET') {
    sendResponse(200, 'application/json', JSON.stringify({
      service: 'TDX MCP HTTP Wrapper',
      version: '1.0.0',
      port: PORT,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // MCP endpoint - handles JSON-RPC calls
  if (req.url === '/mcp' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
      console.log(`[HTTP MCP] Received ${body.length} bytes`);
      if (body.length > 1e6) {
        req.connection.destroy();
      }
    });

    req.on('end', () => {
      console.log(`[HTTP MCP] Request complete, body length: ${body.length}`);
      try {
        const message = JSON.parse(body);
        console.log(`[HTTP MCP] Parsed JSON, calling handleMcpRequest`);
        handleMcpRequest(message, res);
      } catch (err) {
        console.log(`[HTTP MCP] JSON parse error: ${err}`);
        sendError(400, 'Invalid JSON', (err as Error).message);
      }
    });
    return;
  }

  // Tools endpoint - list available tools
  if (req.url === '/tools' && req.method === 'GET') {
    sendResponse(200, 'application/json', JSON.stringify({
      tools: [
        'tdx-ticket-create',
        'tdx-ticket-search',
        'tdx-ticket-get',
        'tdx-ticket-update',
        'tdx-ticket-patch',
        'tdx-ticket-feed-get',
        'tdx-ticket-feed-add',
        'tdx-ticket-add-asset',
        'tdx-ticket-add-contact',
        'tdx-asset-create',
        'tdx-asset-search',
        'tdx-asset-get',
        'tdx-asset-update',
        'tdx-asset-patch',
        'tdx-asset-delete',
        'tdx-asset-categories',
        'tdx-asset-feed-add',
        'tdx-cmdb-create',
        'tdx-cmdb-search',
        'tdx-cmdb-get',
        'tdx-cmdb-update',
        'tdx-cmdb-delete',
        'tdx-cmdb-feed-add',
        'tdx-cmdb-add-relationship',
        'tdx-kb-search',
        'tdx-kb-create',
        'tdx-kb-get',
        'tdx-kb-update',
        'tdx-kb-delete',
        'tdx-people-get',
        'tdx-people-search',
        'tdx-people-lookup',
        'tdx-people-update',
        'tdx-project-create',
        'tdx-project-search',
        'tdx-project-get',
        'tdx-project-update',
        'tdx-account-get',
        'tdx-account-search',
        'tdx-group-get',
        'tdx-group-search',
        'tdx-attributes-get',
        'tdx-statuses-get'
      ]
    }));
    return;
  }

  // 404 for unknown routes
  sendError(404, 'Not found', req.url);
});

// Handle MCP-over-HTTP requests (POST to root)
function handleMCPHTTPRequest(req, res) {
  const sessionId = req.headers['x-mcp-session'] || 'default';
  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
    if (body.length > 1e6) {
      req.connection.destroy();
    }
  });

  req.on('end', () => {
    try {
      const message = JSON.parse(body);
      console.log(`[MCP HTTP] Received POST request with id: ${message.id}, method: ${message.method}`);
      
      const session = getOrCreateSession(sessionId);
      
      // Check if this is a notification (no id) or a request (has id)
      if (!message.id) {
        console.log(`[MCP HTTP] Notification received (no id), sending without waiting for response`);
        // Notifications don't expect responses
        session.sendRequest(message);
        
        res.writeHead(202, { 'Content-Type': 'application/json' }); // Accepted
        res.end(JSON.stringify({ accepted: true, sessionId }));
        return;
      }
      
      // Set up response collection for this specific request
      let responseReceived = false;
      let responseData = null;
      let requestProcessed = false;
      
      const responseHandler = (msgToCheck) => {
        // Check if this is the response to our request
        if (msgToCheck.id === message.id) {
          responseReceived = true;
          responseData = msgToCheck;
          return true;
        }
        return false;
      };
      
      // Register a temporary response handler
      session.responseHandlers = session.responseHandlers || [];
      session.responseHandlers.push(responseHandler);
      
      // Send to MCP server
      session.sendRequest(message);
      
      // Set a timeout to wait for response (30 seconds)
      const timeout = setTimeout(() => {
        if (!responseReceived && !requestProcessed) {
          requestProcessed = true;
          console.error(`[MCP HTTP] Timeout waiting for response to request id ${message.id}`);
          // Remove handler
          session.responseHandlers = session.responseHandlers.filter(h => h !== responseHandler);
          
          // Mark process as unhealthy if we timeout
          if (session.mcp) {
            console.error(`[MCP HTTP] Marking process unhealthy due to timeout`);
            (session.mcp as any).isHealthy = false;
            // Release the dead process
            mcpPool.releaseProcess(session.mcp);
            session.mcp = null;
          }
          
          if (!res.headersSent) {
            res.writeHead(504, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request timeout', id: message.id }));
          }
        }
      }, 30000);
      
      // Poll for response
      const pollInterval = setInterval(() => {
        if (responseReceived && !requestProcessed) {
          requestProcessed = true;
          clearInterval(pollInterval);
          clearTimeout(timeout);
          
          // Remove handler
          session.responseHandlers = session.responseHandlers.filter(h => h !== responseHandler);
          
          // Release process back to pool after successful request
          if (session.mcp && !session.mcp.killed && (session.mcp as any).isHealthy) {
            mcpPool.releaseProcess(session.mcp);
            console.log(`[MCP HTTP] Released process back to pool after successful request`);
          }
          
          if (!res.headersSent) {
            console.log(`[MCP HTTP] Returning response to request id ${message.id}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(responseData));
          }
        }
      }, 50); // Poll every 50ms
      
    } catch (err) {
      console.error('[MCP HTTP] JSON parse error:', (err as Error).message);
      if (!res.headersSent) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON', details: (err as Error).message }));
      }
    }
  });
}

// Handle MCP-over-HTTP SSE (GET to root)
function handleMCPSSE(req, res) {
  const sessionId = req.headers['x-mcp-session'] || req.url.split('?sessionId=')[1] || 'default';
  
  console.log(`[MCP SSE] Client connecting with session: ${sessionId}`);
  console.log(`[MCP SSE] Headers received:`, {
    'x-mcp-session': req.headers['x-mcp-session'],
    'user-agent': req.headers['user-agent'],
    'authorization': req.headers['authorization'] ? 'present' : 'missing'
  });

  // Set SSE headers - crucial for proper streaming
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Accel-Buffering': 'no' // Disable buffering proxies
  });

  console.log(`[MCP SSE] Headers sent to client`);

  const session = getOrCreateSession(sessionId);
  session.registerSSEClient(res);
  console.log(`[MCP SSE] Registered SSE client for session ${sessionId}`);

  // Keep-alive interval: send a comment every 15 seconds to prevent connection timeouts
  const keepAliveInterval = setInterval(() => {
    if (!res.destroyed) {
      try {
        res.write(': keep-alive\n');
        console.log(`[MCP SSE] Sent keep-alive ping for ${sessionId}`);
      } catch (err) {
        console.error(`[MCP SSE] Error sending keep-alive for ${sessionId}:`, err.message);
      }
    } else {
      clearInterval(keepAliveInterval);
    }
  }, 15000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(keepAliveInterval);
    console.log(`[MCP SSE] Client closed connection for ${sessionId}`);
    session.removeSSEClient(res);
    if (session.sseClients.length === 0) {
      console.log(`[MCP SSE] No more clients for session ${sessionId}, cleaning up`);
      session.cleanup();
      mcpSessions.delete(sessionId);
    }
  });

  req.on('error', (err) => {
    clearInterval(keepAliveInterval);
    console.error(`[MCP SSE] Request error for ${sessionId}: ${err.message} (code: ${err.code})`);
    session.removeSSEClient(res);
  });

  res.on('error', (err) => {
    clearInterval(keepAliveInterval);
    console.error(`[MCP SSE] Response error for ${sessionId}: ${err.message} (code: ${err.code})`);
  });

  res.on('finish', () => {
    clearInterval(keepAliveInterval);
    console.log(`[MCP SSE] Response finished for ${sessionId}`);
  });
}

// Handle MCP JSON-RPC requests
function handleMcpRequest(message, res) {
  console.log(`[HTTP MCP] handleMcpRequest called for message ID: ${message.id}`);
  const mcp = mcpPool.getProcess();
  const requestStartTime = Date.now();
  const requestId = message.id || Math.random();

  let output = '';
  let error = '';
  let responded = false;
  let dataListener: any = null;
  let timeout: any = null;

  const sendJsonResponse = (statusCode: number, body: any) => {
    if (!responded) {
      responded = true;
      clearTimeout(timeout);
      if (dataListener) {
        mcp.stdout.removeListener('data', dataListener);
      }
      
      res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end(JSON.stringify(body));
      
      // Release process back to pool (only if still alive)
      if (mcp && !mcp.killed) {
        mcpPool.releaseProcess(mcp);
        console.log(`[HTTP MCP] Released process (PID: ${mcp.pid}) back to pool`);
      }
    }
  };

  // Timeout for this specific request
  timeout = setTimeout(() => {
    if (!responded) {
      console.error(`[HTTP MCP] Request ${requestId} timeout after 60s`);
      sendJsonResponse(504, { error: 'MCP request timeout (60s exceeded)' });
    }
  }, 60000);

  // Set up one-time data listener for this request
  dataListener = (data: Buffer) => {
    output += data.toString();
    console.log(`[HTTP MCP] Received ${data.length} bytes, total: ${output.length}`);

    // Try to extract a complete JSON response
    const lines = output.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('◇') || line.startsWith('⌘') || line.startsWith('⌁')) {
        continue; // Skip non-JSON lines
      }

      if (line.startsWith('{')) {
        try {
          const parsed = JSON.parse(line);
          console.log(`[HTTP MCP] Parsed JSON-RPC response with id: ${parsed.id}`);
          
          // Check if this is the response we're waiting for
          if (parsed.id === message.id || parsed.id === requestId) {
            // Transform and send response
            const transformed = transformMCPResponse(parsed, message);
            sendJsonResponse(200, { result: transformed });
            return;
          }
        } catch (e) {
          // Not valid JSON, continue
        }
      }
    }
  };

  mcp.stdout.on('data', dataListener);

  // Send the request
  try {
    const msgStr = JSON.stringify(message) + '\n';
    console.log(`[HTTP MCP] Sending request to process (PID: ${mcp.pid}): ${msgStr.substring(0, 100)}`);
    mcp.stdin.write(msgStr);
  } catch (err) {
    console.error(`[HTTP MCP] Write error: ${err}`);
    sendJsonResponse(500, { error: 'Failed to send request to MCP', details: (err as Error).message });
  }

  // Handle process errors
  mcp.once('error', (err) => {
    if (!responded) {
      console.error(`[HTTP MCP] Process error: ${err}`);
      sendJsonResponse(500, { error: 'MCP process error', details: (err as Error).message });
    }
  });
}

// Start HTTP server
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`[HTTP Server] MCP HTTP Wrapper started on port ${PORT}`);
  console.log(`[HTTP Server] API Key Required: ${API_KEY ? 'YES' : 'NO'}`);
  console.log(`[HTTP Server] MCP-over-HTTP (SSE): GET http://localhost:${PORT}/`);
  console.log(`[HTTP Server] MCP-over-HTTP (POST): POST http://localhost:${PORT}/`);
  console.log(`[HTTP Server] Health check: GET http://localhost:${PORT}/health`);
  console.log(`[HTTP Server] Status: GET http://localhost:${PORT}/status`);
  console.log(`[HTTP Server] MCP endpoint: POST http://localhost:${PORT}/mcp`);
  console.log(`[HTTP Server] Tools list: GET http://localhost:${PORT}/tools`);

  // Initialize process pool with warm processes
  console.log('[HTTP Server] Warming up process pool...');
  await mcpPool.initialize();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[HTTP Server] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    // Clean up all MCP sessions
    mcpSessions.forEach((session) => {
      session.cleanup();
    });
    mcpSessions.clear();
    mcpPool.cleanup();
    console.log('[HTTP Server] Server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('[HTTP Server] Forced shutdown');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('[HTTP Server] SIGINT received, shutting down...');
  mcpSessions.forEach((session) => {
    session.cleanup();
  });
  mcpSessions.clear();
  mcpPool.cleanup();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[HTTP Server] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[HTTP Server] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
