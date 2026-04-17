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

console.log("Fetching all open tickets to analyze status breakdown...\n");
server.stdin.write(JSON.stringify(initRequest) + "\n");

// Listen for responses
let initialized = false;
let ticketsRequested = false;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    
    // After initialization, search for all open tickets
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
            maxResults: 1000,
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
          
          // Group by status
          const statusBreakdown = {};
          tickets.forEach((ticket) => {
            const statusName = ticket.StatusName;
            if (!statusBreakdown[statusName]) {
              statusBreakdown[statusName] = { count: 0, statusId: ticket.StatusID, examples: [] };
            }
            statusBreakdown[statusName].count++;
            if (statusBreakdown[statusName].examples.length < 3) {
              statusBreakdown[statusName].examples.push({
                id: ticket.ID,
                title: ticket.Title,
                priority: ticket.PriorityName,
              });
            }
          });
          
          console.log(`=== OPEN TICKETS STATUS BREAKDOWN ===\n`);
          console.log(`Total Open Tickets: ${tickets.length}\n`);
          
          // Sort by count (descending)
          const sorted = Object.entries(statusBreakdown).sort((a, b) => b[1].count - a[1].count);
          
          sorted.forEach(([statusName, data], index) => {
            const percentage = ((data.count / tickets.length) * 100).toFixed(1);
            console.log(`${index + 1}. ${statusName}`);
            console.log(`   Count: ${data.count} (${percentage}%)`);
            console.log(`   Status ID: ${data.statusId}`);
            console.log(`   Examples:`);
            data.examples.forEach((ex) => {
              console.log(`     - #${ex.id}: ${ex.title.substring(0, 60)}... [${ex.priority}]`);
            });
            console.log();
          });
          
          console.log(`=== END ===`);
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
