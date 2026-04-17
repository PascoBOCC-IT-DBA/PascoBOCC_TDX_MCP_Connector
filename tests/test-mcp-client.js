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
let toolsListed = false;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    console.log("\nServer response:", JSON.stringify(response, null, 2));

    // After initialization, list available tools
    if (!initialized && response.id === 1) {
      initialized = true;
      console.log("\n✓ Server initialized successfully!");
      console.log("\nListing available tools...");

      const listToolsRequest = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/list",
        params: {},
      };
      server.stdin.write(JSON.stringify(listToolsRequest) + "\n");
    }

    // After tools listed, call tdx-ticket-search to get open tickets
    if (toolsListed === false && response.result?.tools) {
      toolsListed = true;
      const ticketSearchTool = response.result.tools.find((t) =>
        t.name.includes("ticket-search")
      );

      if (ticketSearchTool) {
        console.log("\n✓ Found ticket search tool!");
        console.log("\nSearching for open tickets...");

        const searchRequest = {
          jsonrpc: "2.0",
          id: messageId++,
          method: "tools/call",
          params: {
            name: "tdx-ticket-search",
            arguments: {
              searchText: "",
              pageSize: 10,
              isActive: true,
            },
          },
        };
        server.stdin.write(JSON.stringify(searchRequest) + "\n");
      }
    }

    // Exit after getting results
    if (response.result?.content) {
      console.log("\n✓ Query completed!");
      console.log("\nResults:", JSON.stringify(response.result.content, null, 2));
      setTimeout(() => {
        server.kill();
        process.exit(0);
      }, 1000);
    }
  } catch (e) {
    console.log("Raw line:", line);
  }
});

server.stderr.on("data", (data) => {
  console.error("Server error:", data.toString());
});

server.on("close", (code) => {
  console.log("\nServer closed with code", code);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log("\nTimeout - closing connection");
  server.kill();
  process.exit(1);
}, 10000);
