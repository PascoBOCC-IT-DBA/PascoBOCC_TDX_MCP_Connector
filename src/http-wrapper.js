#!/usr/bin/env node

/**
 * HTTP Wrapper for MCP Server
 * Provides HTTP endpoints that forward requests to the MCP stdio server
 * Allows Copilot Studio and other clients to interact with MCP tools via HTTP
 */

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

class MCPServerPool {
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
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.mcp = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.sseClients = [];
    this.messageQueue = [];
    this.outputBuffer = ''; // Buffer for multi-line responses
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
    // Broadcast to all SSE clients
    this.broadcastToClients(message);
  }

  registerSSEClient(res) {
    this.sseClients.push(res);
    
    // Send any queued messages
    this.messageQueue.forEach(msg => {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
    });
    this.messageQueue = [];
  }

  broadcastToClients(message) {
    this.sseClients = this.sseClients.filter(res => !res.destroyed);
    
    if (this.sseClients.length === 0) {
      this.messageQueue.push(message);
    } else {
      this.sseClients.forEach(res => {
        res.write(`data: ${JSON.stringify(message)}\n\n`);
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
      const session = getOrCreateSession(sessionId);
      
      // Send to MCP server
      session.sendRequest(message);
      
      // Send acknowledgement
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(202); // Accepted
      res.end(JSON.stringify({ accepted: true, sessionId }));
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

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    sessionId: sessionId,
    timestamp: new Date().toISOString()
  })}\n\n`);

  const session = getOrCreateSession(sessionId);
  session.registerSSEClient(res);

  // Handle client disconnect
  req.on('close', () => {
    console.log(`[MCP SSE] Client disconnected: ${sessionId}`);
    session.removeSSEClient(res);
    if (session.sseClients.length === 0) {
      console.log(`[MCP SSE] No more clients for session ${sessionId}, cleaning up`);
      session.cleanup();
      mcpSessions.delete(sessionId);
    }
  });

  req.on('error', (err) => {
    console.error(`[MCP SSE] Client error: ${err.message}`);
    session.removeSSEClient(res);
  });
}

// Handle MCP JSON-RPC requests
function handleMcpRequest(message, res) {
  const mcp = mcpPool.getProcess();

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

          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            results: results.length === 1 ? results[0] : results
          }));
        } else {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, message: 'Processed' }));
        }
      } catch (parseErr) {
        console.error('[HTTP Server] Response parse error:', parseErr.message);
        res.writeHead(200);
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
