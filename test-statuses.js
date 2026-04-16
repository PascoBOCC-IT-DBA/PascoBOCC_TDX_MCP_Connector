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
let statusesRequested = false;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    
    // After initialization, list available tools
    if (!initialized && response.id === 1) {
      initialized = true;
      console.log("\n✓ Server initialized successfully!");
      console.log("\nListing available tools...");

      const listRequest = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/list",
      };
      server.stdin.write(JSON.stringify(listRequest) + "\n");
    }
    // After listing tools, find and call the statuses tool
    else if (!toolsListed && response.id === 2 && response.result?.tools) {
      toolsListed = true;
      const statusesTool = response.result.tools.find(
        (t) => t.name === "tdx-statuses-get"
      );

      if (statusesTool) {
        console.log("✓ Found tdx-statuses-get tool!");
        console.log("\nCalling tool: tdx-statuses-get with componentType='tickets'");

        const callRequest = {
          jsonrpc: "2.0",
          id: messageId++,
          method: "tools/call",
          params: {
            name: "tdx-statuses-get",
            arguments: {
              componentType: "tickets",
            },
          },
        };
        server.stdin.write(JSON.stringify(callRequest) + "\n");
      } else {
        console.log("✗ tdx-statuses-get tool not found");
        console.log("Available tools:", response.result.tools.map((t) => t.name));
        process.exit(1);
      }
    }
    // Handle the statuses response
    else if (!statusesRequested && response.id === 3) {
      statusesRequested = true;
      console.log("\n=== TICKET STATUSES ===\n");
      
      if (response.result?.content?.[0]?.text) {
        try {
          const statuses = JSON.parse(response.result.content[0].text);
          console.log(JSON.stringify(statuses, null, 2));
        } catch {
          console.log(response.result.content[0].text);
        }
      } else if (response.error) {
        console.log("Error:", response.error);
      }
      
      console.log("\n=== END ===\n");
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
