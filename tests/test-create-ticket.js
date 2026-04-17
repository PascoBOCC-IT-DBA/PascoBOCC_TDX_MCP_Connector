import { spawn } from "child_process";
import { createInterface } from "readline";

// Start the MCP server as a subprocess
const server = spawn("node", ["dist/index.js"], {
  cwd: process.cwd(),
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

console.log("Creating a test service request ticket...\n");
server.stdin.write(JSON.stringify(initRequest) + "\n");

// Listen for responses
let initialized = false;
let ticketCreated = false;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    
    // After initialization, create a ticket
    if (!initialized && response.id === 1) {
      initialized = true;

      const createRequest = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-ticket-create",
          arguments: {
            typeId: 867, // "General" type
            title: "Test Service Request - GitHub Copilot MCP Connector",
            description: "This is a test ticket created by the MCP connector test script",
            accountId: 2356, // Information Technology
            priorityId: 329, // P3
            statusId: 894, // New
          },
        },
      };
      server.stdin.write(JSON.stringify(createRequest) + "\n");
    }
    // Handle the create response
    else if (!ticketCreated && response.id === 2) {
      ticketCreated = true;
      
      if (response.result?.content?.[0]?.text) {
        try {
          const result = JSON.parse(response.result.content[0].text);
          console.log(`✓ Ticket created successfully!\n`);
          console.log(`========== TICKET DETAILS ==========`);
          console.log(`Ticket ID: ${result.ID}`);
          console.log(`Title: ${result.Title}`);
          console.log(`Status: ${result.StatusName}`);
          console.log(`Priority: ${result.PriorityName}`);
          console.log(`Type: ${result.TypeName}`);
          console.log(`Account: ${result.AccountName}`);
          console.log(`Created: ${new Date(result.CreatedDate).toLocaleString()}`);
          console.log(`====================================`);
        } catch (e) {
          console.log(response.result.content[0].text);
        }
      } else if (response.error) {
        console.log("Error:", response.error);
      }
      
      process.exit(0);
    }
  } catch (e) {
    // Ignore JSON parse errors from server output
  }
});

server.stderr.on("data", (data) => {
  console.error("Server error:", data.toString());
});

setTimeout(() => {
  console.error("Timeout waiting for response");
  process.exit(1);
}, 10000);
