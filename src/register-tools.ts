import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TdxClient } from "./tdx-client.js";
import { registerTicketTools, registerTicketReadOnlyTools } from "./tools/tickets.js";
import { registerTicketCountTools } from "./tools/counts.js";
import { registerAssetTools, registerAssetReadOnlyTools } from "./tools/assets.js";
import { registerCmdbTools, registerCmdbReadOnlyTools } from "./tools/cmdb.js";
import { registerKbTools, registerKbReadOnlyTools } from "./tools/kb.js";
import { registerProjectTools, registerProjectReadOnlyTools } from "./tools/projects.js";
import { registerPeopleTools, registerPeopleReadOnlyTools } from "./tools/people.js";
import { registerAccountTools } from "./tools/accounts.js";
import { registerGroupTools } from "./tools/groups.js";
import { registerAttributeTools } from "./tools/attributes.js";
import { registerStatusTools } from "./tools/statuses.js";
import { registerTicketTypeTools } from "./tools/ticket-types.js";

/**
 * Every tool the server exposes, registered in one place.
 *
 * Read and write tools are all registered unconditionally; access control is enforced
 * by the HTTP wrapper via the two-tier API keys. tool-access-config.test.ts asserts this
 * list stays in sync with TOOL_ACCESS_MAP, which only works because both production and
 * the test go through this single function.
 */
export function registerAllTools(server: McpServer, client: TdxClient) {
  registerTicketReadOnlyTools(server, client);
  registerTicketTools(server, client);
  registerTicketCountTools(server, client);

  registerAssetReadOnlyTools(server, client);
  registerAssetTools(server, client);

  registerCmdbReadOnlyTools(server, client);
  registerCmdbTools(server, client);

  registerKbReadOnlyTools(server, client);
  registerKbTools(server, client);

  registerProjectReadOnlyTools(server, client);
  registerProjectTools(server, client);

  registerPeopleReadOnlyTools(server, client);
  registerPeopleTools(server, client);

  registerAccountTools(server, client);
  registerGroupTools(server, client);
  registerAttributeTools(server, client);
  registerStatusTools(server, client);
  registerTicketTypeTools(server, client);
}
