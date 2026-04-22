/**
 * Utility: Local TDX Client
 * Description: Provides a local client utility for direct interaction with the TDX API.
 *              Used by other test scripts to make authenticated requests and handle responses.
 *              Manages TDX server startup and communication.
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// Connect to the tdx-local MCP server via stdio
const server = spawn("npm", ["start"], {
  cwd: projectRoot,
  stdio: ["pipe", "pipe", "pipe"],
  shell: true,
});

const rl = createInterface({
  input: server.stdout,
  output: server.stdin,
  terminal: false,
});

let messageId = 1;

// Send initialization request
const initRequest = {
  jsonrpc: "2.0",
  id: messageId++,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "tdx-local-client",
      version: "1.0.0",
    },
  },
};

console.log("Connecting to tdx-local MCP server...");
server.stdin.write(JSON.stringify(initRequest) + "\n");

let initialized = false;
let toolsCalled = false;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    
    // After initialization, query open tickets
    if (!initialized && response.id === 1) {
      initialized = true;
      console.log("✓ Connected to tdx-local server!\n");
      console.log("Querying open tickets (statusIds: 894=New, 896=In Process, 3625=Pending)...\n");

      const searchRequest = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-ticket-search",
          arguments: {
            statusIds: [894, 896, 3625],
            maxResults: 500, // Get more results if available
          },
        },
      };
      server.stdin.write(JSON.stringify(searchRequest) + "\n");
    }
    // Handle search response
    else if (!toolsCalled && response.id === 2) {
      toolsCalled = true;
      
      if (response.result?.content?.[0]?.text) {
        try {
          const tickets = JSON.parse(response.result.content[0].text);
          console.log(`Found ${tickets.length} open tickets:\n`);
          
          // Summary by status
          const byStatus = {};
          tickets.forEach(ticket => {
            if (!byStatus[ticket.StatusName]) {
              byStatus[ticket.StatusName] = 0;
            }
            byStatus[ticket.StatusName]++;
          });
          
          console.log("Summary by status:");
          Object.entries(byStatus).forEach(([status, count]) => {
            console.log(`  ${status}: ${count}`);
          });
          console.log();
          
          // Show first 10 for detail
          console.log("First 10 tickets:");
          tickets.slice(0, 10).forEach((ticket, index) => {
            console.log(`${index + 1}. [${ticket.ID}] ${ticket.Title}`);
            console.log(`   Status: ${ticket.StatusName} | Priority: ${ticket.PriorityName}`);
            console.log();
          });
        } catch (e) {
          console.log("Response:", response.result.content[0].text);
        }
      } else if (response.error) {
        console.log("Error:", response.error);
      }
      
      process.exit(0);
    }
  } catch (e) {
    console.error("Error parsing response:", e.message);
  }
});

server.stderr.on("data", (data) => {
  console.error("Server error:", data.toString());
});

setTimeout(() => {
  console.error("Timeout waiting for response from server");
  process.exit(1);
}, 10000);
