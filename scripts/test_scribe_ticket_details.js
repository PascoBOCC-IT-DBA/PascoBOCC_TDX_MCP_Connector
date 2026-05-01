/**
 * Test: Get Scribe SharePoint Allow-List Ticket Details
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
  terminal: false,
});

let messageId = 1;
let initialized = false;
let ticketsFetched = 0;
const ticketIds = [4231102, 4697840, 4143881];
let currentIndex = 0;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    
    if (!initialized) {
      console.log("✅ Initialized\n");
      initialized = true;
      fetchNextTicket();
    } else if (response.result && response.result.content) {
      const content = response.result.content[0].text;
      const ticket = JSON.parse(content);
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📋 TICKET #${ticket.ID}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Title: ${ticket.Title}`);
      console.log(`Status: ${ticket.StatusName}`);
      console.log(`Priority: ${ticket.PriorityName}`);
      console.log(`Created: ${ticket.CreatedDate}`);
      console.log(`Updated: ${ticket.ModifiedDate}`);
      if (ticket.Description) {
        console.log(`\nDescription:\n${ticket.Description.substring(0, 500)}${ticket.Description.length > 500 ? '...' : ''}`);
      }
      
      ticketsFetched++;
      currentIndex++;
      
      if (currentIndex < ticketIds.length) {
        fetchNextTicket();
      } else {
        setTimeout(() => {
          server.kill();
          process.exit(0);
        }, 500);
      }
    }
  } catch (e) {
    // Ignore parse errors
  }
});

function fetchNextTicket() {
  const ticketId = ticketIds[currentIndex];
  console.log(`🔍 Fetching ticket #${ticketId}...`);
  
  const request = {
    jsonrpc: "2.0",
    id: messageId++,
    method: "tools/call",
    params: {
      name: "tdx-ticket-get",
      arguments: { id: ticketId },
    },
  };

  server.stdin.write(JSON.stringify(request) + "\n");
}

// Send initialization request
const initRequest = {
  jsonrpc: "2.0",
  id: messageId++,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "scribe-ticket-details",
      version: "1.0.0",
    },
  },
};

server.stdin.write(JSON.stringify(initRequest) + "\n");

setTimeout(() => {
  server.kill();
  process.exit(0);
}, 30000);
