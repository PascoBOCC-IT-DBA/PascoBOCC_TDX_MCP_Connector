import { spawn } from "child_process";
import { createInterface } from "readline";

// Connect to the tdx-local MCP server via stdio
const server = spawn("npm", ["start"], {
  cwd: process.cwd(),
  stdio: ["pipe", "pipe", "pipe"],
  shell: true,
});

const rl = createInterface({
  input: server.stdout,
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
      name: "ticket-query",
      version: "1.0.0",
    },
  },
};

server.stdin.write(JSON.stringify(initRequest) + "\n");

let initialized = false;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);

    // After initialization, query open tickets
    if (!initialized && response.id === 1) {
      initialized = true;

      const searchRequest = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-ticket-search",
          arguments: {
            statusIds: [894, 896, 3625], // New, In Process, Pending
            maxResults: 5000,
          },
        },
      };
      server.stdin.write(JSON.stringify(searchRequest) + "\n");
    }
    // Handle search response
    else if (response.id === 2) {
      if (response.result?.content?.[0]?.text) {
        try {
          const tickets = JSON.parse(response.result.content[0].text);
          
          // Summary by status
          const byStatus = {};
          tickets.forEach(ticket => {
            if (!byStatus[ticket.StatusName]) {
              byStatus[ticket.StatusName] = [];
            }
            byStatus[ticket.StatusName].push(ticket);
          });

          console.log(`\n📋 Total Open Tickets: ${tickets.length}\n`);
          console.log("Summary by Status:");
          Object.entries(byStatus).forEach(([status, items]) => {
            console.log(`  • ${status}: ${items.length}`);
          });
          
          console.log("\n\nFirst 15 Open Tickets:\n");
          tickets.slice(0, 15).forEach((ticket, index) => {
            console.log(`${(index + 1).toString().padStart(2)}. [${ticket.ID}] ${ticket.Title}`);
            console.log(`    Status: ${ticket.StatusName} | Priority: ${ticket.PriorityName} | Account: ${ticket.AccountName}`);
          });
          
          if (tickets.length > 15) {
            console.log(`\n... and ${tickets.length - 15} more tickets`);
          }
        } catch (e) {
          console.log("Response:", response.result.content[0].text);
        }
      } else if (response.error) {
        console.log("Error:", response.error);
      }

      process.exit(0);
    }
  } catch (e) {
    // Ignore JSON parse errors from npm output
  }
});

server.stderr.on("data", (data) => {
  // Ignore stderr noise from npm
});

setTimeout(() => {
  console.error("Timeout");
  process.exit(1);
}, 15000);
