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

console.log("Fetching all open tickets to analyze category breakdown...\n");
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
          
          // Group by type
          const typeBreakdown = {};
          tickets.forEach((ticket) => {
            const typeName = ticket.TypeName || 'Unknown';
            if (!typeBreakdown[typeName]) {
              typeBreakdown[typeName] = { count: 0, examples: [] };
            }
            typeBreakdown[typeName].count++;
            if (typeBreakdown[typeName].examples.length < 3) {
              typeBreakdown[typeName].examples.push({
                id: ticket.ID,
                title: ticket.Title,
                account: ticket.AccountName,
                priority: ticket.PriorityName,
              });
            }
          });

          // Also group by account
          const accountBreakdown = {};
          tickets.forEach((ticket) => {
            const accountName = ticket.AccountName || 'Unknown';
            if (!accountBreakdown[accountName]) {
              accountBreakdown[accountName] = 0;
            }
            accountBreakdown[accountName]++;
          });
          
          console.log(`=== OPEN TICKETS CATEGORY BREAKDOWN ===\n`);
          console.log(`Total Open Tickets: ${tickets.length}\n`);
          
          // Sort by count (descending)
          const sortedTypes = Object.entries(typeBreakdown).sort((a, b) => b[1].count - a[1].count);
          
          console.log(`BY TICKET TYPE:\n`);
          sortedTypes.forEach(([typeName, data], index) => {
            const percentage = ((data.count / tickets.length) * 100).toFixed(1);
            console.log(`${index + 1}. ${typeName}`);
            console.log(`   Count: ${data.count} (${percentage}%)`);
            console.log(`   Examples:`);
            data.examples.forEach((ex) => {
              console.log(`     - #${ex.id}: ${ex.title.substring(0, 50)}... [${ex.priority}] @ ${ex.account}`);
            });
            console.log();
          });

          console.log(`\nBY ACCOUNT/DEPARTMENT:\n`);
          const sortedAccounts = Object.entries(accountBreakdown)
            .sort((a, b) => b[1] - a[1]);
          
          sortedAccounts.forEach(([accountName, count], index) => {
            const percentage = ((count / tickets.length) * 100).toFixed(1);
            console.log(`${index + 1}. ${accountName}`);
            console.log(`   Count: ${count} (${percentage}%)`);
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
}, 15000);
