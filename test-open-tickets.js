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

console.log("Sending initialize request...");
server.stdin.write(JSON.stringify(initRequest) + "\n");

// Listen for responses
let initialized = false;
let ticketsRequested = false;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    
    // After initialization, search for open tickets
    if (!initialized && response.id === 1) {
      initialized = true;
      console.log("✓ Server initialized successfully!\n");
      console.log("Searching for open tickets (statusIds: 894=New, 896=In Process, 3625=Pending)...\n");

      const searchRequest = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-ticket-search",
          arguments: {
            statusIds: [894, 896, 3625], // New, In Process, Pending
            maxResults: 50,
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
          console.log(`Found ${tickets.length} open tickets:\n`);
          
          // Display tickets in a readable format
          tickets.forEach((ticket, index) => {
            console.log(`${index + 1}. ID: ${ticket.ID} | Title: ${ticket.Title}`);
            console.log(`   Status: ${ticket.StatusName} | Priority: ${ticket.PriorityName}`);
            console.log(`   Type: ${ticket.TypeName} | Account: ${ticket.AccountName}`);
            console.log(`   Responsible: ${ticket.ResponsibleFullName} (${ticket.ResponsibleGroupName})`);
            console.log(`   Created: ${new Date(ticket.CreatedDate).toLocaleDateString()}`);
            console.log();
          });
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
