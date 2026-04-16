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

const config = loadConfig();
const client = new TdxClient(config);

const server = new McpServer({
  name: "tdx-mcp",
  version: "1.0.0",
});

registerTicketTools(server, client);
registerAssetTools(server, client);
registerCmdbTools(server, client);
registerKbTools(server, client);
registerPeopleTools(server, client);
registerProjectTools(server, client);
registerAccountTools(server, client);
registerGroupTools(server, client);
registerAttributeTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
