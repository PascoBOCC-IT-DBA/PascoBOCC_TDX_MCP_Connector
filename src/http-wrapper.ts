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
  warmingProcesses: Promise<void>[] = [];
  maxProcesses: number = 5;
  minWarmProcesses: number = 2;

  constructor() {
    this.availableProcesses = [];
    this.warmingProcesses = [];
    this.maxProcesses = 5;
    this.minWarmProcesses = 2;
  }

  async spawnProcess() {
    return new Promise((resolve) => {
      console.log(`[MCP Pool] Spawning new MCP process`);
      const proc = spawn('node', [MCPscriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'production',
          TDX_BASE_URL: process.env.TDX_BASE_URL,
          TDX_BEID: process.env.TDX_BEID,
          TDX_WEB_SERVICES_KEY: process.env.TDX_WEB_SERVICES_KEY,
          TDX_APP_ID: process.env.TDX_APP_ID
        }
      });

      let readyReceived = false;

      proc.on('error', (err) => {
        console.error('[MCP Pool] Process error:', err);
        resolve(null);
      });

      // Wait for first output indicating process is ready
      const onData = () => {
        if (!readyReceived) {
          readyReceived = true;
          proc.stdout.removeListener('data', onData);
          console.log(`[MCP Pool] Process ready (PID: ${proc.pid})`);
          resolve(proc);
        }
      };

      // Set timeout - if process doesn't respond within 30 seconds, return anyway
      const timeout = setTimeout(() => {
        if (!readyReceived) {
          readyReceived = true;
          proc.stdout.removeListener('data', onData);
          console.log(`[MCP Pool] Process timeout (PID: ${proc.pid}), using anyway`);
          resolve(proc);
        }
      }, 30000);

      proc.stdout.on('data', onData);
    });
  }

  async warmup() {
    while (this.availableProcesses.length < this.minWarmProcesses && 
           this.warmingProcesses.length + this.availableProcesses.length < this.maxProcesses) {
      const warmupPromise = (async () => {
        const proc = await this.spawnProcess();
        if (proc && !proc.killed) {
          this.availableProcesses.push(proc);
        }
        this.warmingProcesses = this.warmingProcesses.filter(p => p !== warmupPromise);
      })();
      this.warmingProcesses.push(warmupPromise);
    }
  }

  getProcess() {
    // Return existing process if available
    if (this.availableProcesses.length > 0) {
      return this.availableProcesses.pop();
    }

    // Spawn new process immediately (synchronously, but will complete in background)
    console.log(`[MCP Pool] No warm process available, spawning new one (available: ${this.availableProcesses.length}, warming: ${this.warmingProcesses.length})`);
    this.spawnProcess().then(proc => {
      if (proc && !proc.killed) {
        this.availableProcesses.push(proc);
      }
    });

    // For now, create and return one immediately (fallback behavior)
    const proc = spawn('node', [MCPscriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        TDX_BASE_URL: process.env.TDX_BASE_URL,
        TDX_BEID: process.env.TDX_BEID,
        TDX_WEB_SERVICES_KEY: process.env.TDX_WEB_SERVICES_KEY,
        TDX_APP_ID: process.env.TDX_APP_ID
      }
    });

    proc.on('error', (err) => {
      console.error('[MCP Pool] Process error:', err);
    });

    return proc;
  }

  releaseProcess(proc) {
    if (proc && !proc.killed && this.availableProcesses.length < this.maxProcesses) {
      // Reset process for reuse
      this.availableProcesses.push(proc);
      // Start warming more processes if needed
      this.warmup();
    } else if (proc && !proc.killed) {
      proc.kill();
    }
  }

  cleanup() {
    this.availableProcesses.forEach(proc => {
      if (proc && !proc.killed) {
        proc.kill();
      }
    });
    this.availableProcesses = [];
    this.warmingProcesses = [];
  }

  async initialize() {
    console.log('[MCP Pool] Initializing process pool...');
    await this.warmup();
    // Wait for initial warm-up to complete
    await Promise.allSettled(this.warmingProcesses);
    console.log(`[MCP Pool] Pool initialized with ${this.availableProcesses.length} ready processes`);
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
    if (!this.mcp || this.mcp.killed) {
      console.log(`[MCP Session] Initializing new MCP process for ${this.sessionId}`);
      this.initialize();
    }
    try {
      const msgStr = JSON.stringify(message) + '\n';
      console.log(`[MCP Session] Writing to stdin: ${msgStr.substring(0, 100)}`);
      this.mcp.stdin.write(msgStr);
    } catch (err) {
      console.error('[MCP Session] Write error:', err);
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
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API Key authentication (if configured, but allow /health without auth)
  if (API_KEY && req.url !== '/health' && req.url !== '/') {
    const authHeader = req.headers.authorization || '';
    const providedKey = authHeader.replace('Bearer ', '').trim();
    
    if (!providedKey || providedKey !== API_KEY) {
      res.writeHead(401);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing API key' }));
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
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ 
      status: 'healthy', 
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Status endpoint
  if (req.url === '/status' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({
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
      if (body.length > 1e6) {
        req.connection.destroy();
      }
    });

    req.on('end', () => {
      try {
        const message = JSON.parse(body);
        handleMcpRequest(message, res);
      } catch (err) {
        console.error('[HTTP Server] JSON parse error:', err.message);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON', details: err.message }));
      }
    });
    return;
  }

  // Tools endpoint - list available tools
  if (req.url === '/tools' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({
      tools: [
        'tickets_create',
        'tickets_query',
        'tickets_update',
        'assets_create',
        'assets_query',
        'assets_update',
        'cmdb_create',
        'cmdb_query',
        'people_get',
        'projects_create',
        'accounts_list',
        'groups_list',
        'kb_search'
      ]
    }));
    return;
  }

  // 404 for unknown routes
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found', path: req.url }));
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
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(202); // Accepted
        res.end(JSON.stringify({ accepted: true, sessionId }));
        return;
      }
      
      // Set up response collection for this specific request
      let responseReceived = false;
      let responseData = null;
      
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
        if (!responseReceived) {
          console.error(`[MCP HTTP] Timeout waiting for response to request id ${message.id}`);
          // Remove handler
          session.responseHandlers = session.responseHandlers.filter(h => h !== responseHandler);
          
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(504);
            res.end(JSON.stringify({ error: 'Request timeout', id: message.id }));
          }
        }
      }, 30000);
      
      // Poll for response
      const pollInterval = setInterval(() => {
        if (responseReceived) {
          clearInterval(pollInterval);
          clearTimeout(timeout);
          
          // Remove handler
          session.responseHandlers = session.responseHandlers.filter(h => h !== responseHandler);
          
          console.log(`[MCP HTTP] Returning response to request id ${message.id}`);
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify(responseData));
        }
      }, 50); // Poll every 50ms
      
    } catch (err) {
      console.error('[MCP HTTP] JSON parse error:', err.message);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON', details: err.message }));
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
  const mcp = mcpPool.getProcess();
  const requestStartTime = Date.now();

  let output = '';
  let error = '';
  let responded = false;

  const timeout = setTimeout(() => {
    if (!responded) {
      responded = true;
      mcp.kill();
      mcpPool.releaseProcess(null);
      res.writeHead(504);
      res.end(JSON.stringify({ error: 'MCP server timeout' }));
    }
  }, 10000);

  mcp.stdout.on('data', (data) => {
    output += data.toString();
  });

  mcp.stderr.on('data', (data) => {
    error += data.toString();
    console.error('[MCP Process] stderr:', data.toString());
  });

  mcp.on('error', (err) => {
    if (!responded) {
      responded = true;
      clearTimeout(timeout);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'MCP process error', details: err.message }));
    }
  });

  mcp.on('close', (code) => {
    clearTimeout(timeout);

    if (!responded) {
      responded = true;

      if (code !== 0) {
        console.error(`[MCP Process] Exited with code ${code}`);
        if (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'MCP execution error', details: error }));
          return;
        }
      }

      try {
        // Try to parse output as JSON
        if (output) {
          const results = output
            .split('\n')
            .filter(line => {
              const trimmed = line.trim();
              // Skip empty lines and dotenv logging
              if (!trimmed || trimmed.startsWith('◇') || trimmed.startsWith('⌘') || trimmed.startsWith('⌁')) {
                return false;
              }
              // Only include JSON-RPC responses
              return trimmed.startsWith('{');
            })
            .map(line => JSON.parse(line));

          // Transform responses for better agent consumption
          const transformedResults = results.map(result => transformMCPResponse(result, message));

          const executionTime = Date.now() - requestStartTime;
          
          res.writeHead(200);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            results: transformedResults.length === 1 ? transformedResults[0] : transformedResults,
            meta: {
              executionTimeMs: executionTime,
              timestamp: new Date().toISOString()
            }
          }));
        } else {
          res.writeHead(200);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, message: 'Processed' }));
        }
      } catch (parseErr) {
        console.error('[HTTP Server] Response parse error:', parseErr.message);
        res.writeHead(200);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ output: output, raw: true }));
      }
    }

    mcpPool.releaseProcess(null);
  });

  // Send the request to MCP server
  try {
    mcp.stdin.write(JSON.stringify(message) + '\n');
    mcp.stdin.end();
  } catch (err) {
    console.error('[MCP Process] Write error:', err);
    if (!responded) {
      responded = true;
      clearTimeout(timeout);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to send to MCP', details: err.message }));
    }
  }
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
