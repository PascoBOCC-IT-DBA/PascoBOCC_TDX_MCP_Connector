#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { TdxClient } from "./tdx-client.js";
import { registerTicketTools, registerTicketReadOnlyTools } from "./tools/tickets.js";
import { registerAssetTools, registerAssetReadOnlyTools } from "./tools/assets.js";
import { registerCmdbTools, registerCmdbReadOnlyTools } from "./tools/cmdb.js";
import { registerKbTools, registerKbReadOnlyTools } from "./tools/kb.js";
import { registerProjectTools, registerProjectReadOnlyTools } from "./tools/projects.js";
import { registerPeopleTools, registerPeopleReadOnlyTools } from "./tools/people.js";
import { registerAccountTools } from "./tools/accounts.js";
import { registerGroupTools } from "./tools/groups.js";
import { registerAttributeTools } from "./tools/attributes.js";
import { registerStatusTools } from "./tools/statuses.js";

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
    const config = loadConfig();
    console.error("[TDX-MCP] Config loaded successfully");
    console.error(`[TDX-MCP] TDX Base URL: ${config.baseUrl}`);
    console.error("[TDX-MCP] Creating TDX client...");
    const client = new TdxClient(config);
    console.error("[TDX-MCP] TDX client created successfully");

    const server = new McpServer({
      name: "tdx-mcp",
      version: "1.0.0",
    });

    // Note: Modification tools (create, update, delete, feed, link operations) are DISABLED
    // 27 tools are currently disabled for safety:
    // Tickets: create, update, patch, feed-add, add-asset, add-contact
    // Assets: create, update, patch, delete, feed-add
    // CMDB: create, update, delete, feed-add, add-relationship
    // KB: create, update, delete
    // Projects: create, update
    // People: update
    // 
    // To re-enable, set environment variable: ALLOW_MODIFICATIONS=true
    const allowModifications = process.env.ALLOW_MODIFICATIONS === "true";

    const registerIfAllowed = (allowFunc: () => void, name: string) => {
      if (allowModifications) {
        allowFunc();
        console.error(`[TDX-MCP] Enabled modification tool: ${name}`);
      } else {
        console.error(`[TDX-MCP] Skipped modification tool: ${name}`);
      }
    };

    registerIfAllowed(
      () => registerTicketTools(server, client),
      "registerTicketTools"
    );
    // Ticket read-only tools always enabled
    console.error("[TDX-MCP] Registering ticket read-only tools...");
    registerTicketReadOnlyTools(server, client);
    console.error("[TDX-MCP] Ticket read-only tools registered successfully!");

    // Asset read-only tools always enabled
    console.error("[TDX-MCP] Registering asset read-only tools...");
    registerAssetReadOnlyTools(server, client);
    console.error("[TDX-MCP] Asset read-only tools registered successfully!");
    registerIfAllowed(
      () => registerAssetTools(server, client),
      "registerAssetTools"
    );

    // CMDB read-only tools always enabled
    console.error("[TDX-MCP] Registering CMDB read-only tools...");
    registerCmdbReadOnlyTools(server, client);
    console.error("[TDX-MCP] CMDB read-only tools registered successfully!");
    registerIfAllowed(
      () => registerCmdbTools(server, client),
      "registerCmdbTools"
    );

    // KB read-only tools always enabled
    console.error("[TDX-MCP] Registering KB read-only tools...");
    registerKbReadOnlyTools(server, client);
    console.error("[TDX-MCP] KB read-only tools registered successfully!");
    registerIfAllowed(
      () => registerKbTools(server, client),
      "registerKbTools"
    );

    // Project read-only tools always enabled
    console.error("[TDX-MCP] Registering project read-only tools...");
    registerProjectReadOnlyTools(server, client);
    console.error("[TDX-MCP] Project read-only tools registered successfully!");
    registerIfAllowed(
      () => registerProjectTools(server, client),
      "registerProjectTools"
    );

    // People read-only tools always enabled
    console.error("[TDX-MCP] Registering people read-only tools...");
    registerPeopleReadOnlyTools(server, client);
    console.error("[TDX-MCP] People read-only tools registered successfully!");
    registerIfAllowed(
      () => registerPeopleTools(server, client),
      "registerPeopleTools"
    );

    // Read-only tools are always enabled
    registerAccountTools(server, client);
    registerGroupTools(server, client);
    registerAttributeTools(server, client);
    registerStatusTools(server, client);
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
