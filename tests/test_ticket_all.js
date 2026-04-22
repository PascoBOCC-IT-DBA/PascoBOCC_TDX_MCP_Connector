/**
 * Test: All Tickets Retrieval
 * Description: Retrieves all tickets from your TDX system and provides a summary
 *              of ticket data including counts by status and other ticket metrics.
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// Start the MCP server as a subprocess
const server = spawn("node", ["dist/index.js"], {
  cwd: projectRoot,
  stdio: ["pipe", "pipe", "pipe"],
});

const rl = createInterface({
  input: server.stdout,
  output: server.stdin,
  terminal: false,
});

let messageId = 1;

// Send an initialization request
const initRequest = {
  jsonrpc: "2.0",
  id: messageId++,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "test-client",
      version: "1.0.0",
    },
  },
};

console.log("Sending initialize request...");
server.stdin.write(JSON.stringify(initRequest) + "\n");

// Listen for responses
let initialized = false;
let ticketsRequested = false;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    
    // After initialization, search for open tickets with higher limit
    if (!initialized && response.id === 1) {
      initialized = true;
      console.log("✓ Server initialized successfully!\n");
      console.log("Searching for all open tickets (requesting 500 results)...\n");

      const searchRequest = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-ticket-search",
          arguments: {
            statusIds: [894, 896, 3625], // New, In Process, Pending
            maxResults: 500,
          },
        },
      };
      server.stdin.write(JSON.stringify(searchRequest) + "\n");
    }
    // Handle the search response
    else if (!ticketsRequested && response.id === 2) {
      ticketsRequested = true;
      
      if (response.result?.content?.[0]?.text) {
        try {
          const tickets = JSON.parse(response.result.content[0].text);
          console.log(`Total open tickets found: ${tickets.length}`);
          console.log(`\nAPI actually returned ${tickets.length} results (not limited to 50)`);
          console.log(`\nThis means either:`);
          console.log(`  - There are only ${tickets.length} open tickets in the system, OR`);
          console.log(`  - The API has its own server-side limit`);
        } catch (e) {
          console.log(response.result.content[0].text);
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
  console.error("Timeout waiting for response");
  process.exit(1);
}, 10000);
