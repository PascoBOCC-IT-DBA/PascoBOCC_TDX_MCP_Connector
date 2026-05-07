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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.MCP_HTTP_PORT || 3000;
const API_KEY = process.env.MCP_API_KEY || null; // Set to require API key auth
const MCPscriptPath = join(__dirname, 'index.js');

class MCPServerPool {
  constructor() {
    this.processes = [];
    this.maxProcesses = 5;
  }

  getProcess() {
    // Return existing process if available
    if (this.processes.length > 0) {
      const proc = this.processes.pop();
      if (proc && !proc.killed) {
        return proc;
      }
    }

    // Create new process
    console.log(`[MCP Pool] Creating new MCP process (${this.processes.length}/${this.maxProcesses})`);
    const proc = spawn('node', [MCPscriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' }
    });

    proc.on('error', (err) => {
      console.error('[MCP Pool] Process error:', err);
    });

    return proc;
  }

  releaseProcess(proc) {
    if (proc && !proc.killed && this.processes.length < this.maxProcesses) {
      this.processes.push(proc);
    } else if (proc && !proc.killed) {
      proc.kill();
    }
  }

  cleanup() {
    this.processes.forEach(proc => {
      if (proc && !proc.killed) {
        proc.kill();
      }
    });
    this.processes = [];
  }
}

const mcpPool = new MCPServerPool();

// Create HTTP server
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API Key authentication (if configured)
  if (API_KEY && req.url !== '/health') {
    const authHeader = req.headers.authorization || '';
    const providedKey = authHeader.replace('Bearer ', '').trim();
    
    if (!providedKey || providedKey !== API_KEY) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing API key' }));
      return;
    }
  }

  // Health check endpoint (no auth required)
  if (req.url === '/health' && req.method === 'GET') {
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
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON', details: err.message }));
      }
    });
    return;
  }

  // Tools endpoint - list available tools
  if (req.url === '/tools' && req.method === 'GET') {
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
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found', path: req.url }));
});

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
            .filter(line => line.trim())
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
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP Server] MCP HTTP Wrapper started on port ${PORT}`);
  console.log(`[HTTP Server] API Key Required: ${API_KEY ? 'YES' : 'NO'}`);
  console.log(`[HTTP Server] Health check: http://localhost:${PORT}/health`);
  console.log(`[HTTP Server] Status: http://localhost:${PORT}/status`);
  console.log(`[HTTP Server] MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`[HTTP Server] Tools list: http://localhost:${PORT}/tools`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[HTTP Server] SIGTERM received, shutting down gracefully...');
  server.close(() => {
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
