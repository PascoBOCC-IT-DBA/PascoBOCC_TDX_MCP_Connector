#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { TdxClient } from "./tdx-client.js";
import { registerTicketTools, registerTicketReadOnlyTools } from "./tools/tickets.js";
import { registerAssetTools } from "./tools/assets.js";
import { registerCmdbTools } from "./tools/cmdb.js";
import { registerKbTools } from "./tools/kb.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerPeopleTools } from "./tools/people.js";
import { registerAccountTools } from "./tools/accounts.js";
import { registerGroupTools } from "./tools/groups.js";
import { registerAttributeTools } from "./tools/attributes.js";
import { registerStatusTools } from "./tools/statuses.js";

console.error("[TDX-MCP] Process started");
const config = loadConfig();
console.error("[TDX-MCP] Config loaded");
const client = new TdxClient(config);
console.error("[TDX-MCP] TDX client created");

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

registerIfAllowed(
  () => registerAssetTools(server, client),
  "registerAssetTools"
);
registerIfAllowed(
  () => registerCmdbTools(server, client),
  "registerCmdbTools"
);
registerIfAllowed(
  () => registerKbTools(server, client),
  "registerKbTools"
);
registerIfAllowed(
  () => registerProjectTools(server, client),
  "registerProjectTools"
);

// Read-only tools are always enabled
registerPeopleTools(server, client);
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
