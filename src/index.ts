#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { TdxClient } from "./tdx-client.js";
import { registerAllTools } from "./register-tools.js";

// Global error handlers to catch startup errors
process.on('uncaughtException', (err) => {
  console.error("[TDX-MCP] FATAL: Uncaught exception during initialization");
  console.error("[TDX-MCP] Error:", err.message);
  console.error("[TDX-MCP] Stack:", err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error("[TDX-MCP] FATAL: Unhandled rejection during initialization");
  console.error("[TDX-MCP] Promise:", promise);
  console.error("[TDX-MCP] Reason:", reason);
  process.exit(1);
});

// Async main function to wrap initialization with await
(async () => {
  try {
    console.error("[TDX-MCP] Process started");
    const config = await loadConfig();
    console.error("[TDX-MCP] Config loaded successfully");
    console.error(`[TDX-MCP] TDX Base URL: ${config.baseUrl}`);
    console.error("[TDX-MCP] Creating TDX client...");
    const client = new TdxClient(config);
    console.error("[TDX-MCP] TDX client created successfully");

    const server = new McpServer({
      name: "tdx-mcp",
      version: "1.0.0",
    });

    // All tools are now registered on the MCP server
    // Access control is enforced at the HTTP wrapper layer via two-tier API keys:
    // - MCP_API_KEY_READONLY: Can call read-only tools only (search, get, list, count, etc.)
    // - MCP_API_KEY_READWRITE: Can call all tools including modifications (create, update, delete, etc.)
    // 
    // This allows multiple agents to share a single MCP server instance with different access levels

    console.error("[TDX-MCP] Registering all tools (read-only + write)...");
    registerAllTools(server, client);
    console.error("[TDX-MCP] All tool registrations complete, creating transport...");

    const transport = new StdioServerTransport();
    console.error("[TDX-MCP] Transport created, calling server.connect()...");
    await server.connect(transport);
    console.error("[TDX-MCP] server.connect() complete!");

    // Signal to HTTP wrapper that this process is fully initialized with all tools
    console.log("[MCP Server Ready]");
    console.error("[TDX-MCP] Emitted MCP Server Ready signal");
  } catch (err) {
    console.error("[TDX-MCP] FATAL: Failed to initialize MCP server");
    console.error("[TDX-MCP] Error:", (err as Error).message);
    console.error("[TDX-MCP] Stack:", (err as Error).stack);
    process.exit(1);
  }
})();
