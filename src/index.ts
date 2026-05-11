#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { TdxClient } from "./tdx-client.js";
import { registerTicketTools } from "./tools/tickets.js";
import { registerAssetTools } from "./tools/assets.js";
import { registerCmdbTools } from "./tools/cmdb.js";
import { registerKbTools } from "./tools/kb.js";
import { registerPeopleTools } from "./tools/people.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerAccountTools } from "./tools/accounts.js";
import { registerGroupTools } from "./tools/groups.js";
import { registerAttributeTools } from "./tools/attributes.js";
import { registerStatusTools } from "./tools/statuses.js";

const config = loadConfig();
const client = new TdxClient(config);

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

const transport = new StdioServerTransport();
await server.connect(transport);
