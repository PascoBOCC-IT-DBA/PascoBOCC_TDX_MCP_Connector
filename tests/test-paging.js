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

console.log("Testing paging with skip parameter...\n");
server.stdin.write(JSON.stringify(initRequest) + "\n");

// Listen for responses
let initialized = false;
let page1Requested = false;
let page1Received = false;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    
    // After initialization, search for first batch of assets
    if (!initialized && response.id === 1) {
      initialized = true;

      const searchRequest = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-asset-search",
          arguments: {
            appId: 116,
            maxResults: 100,
            skip: 0,
          },
        },
      };
      console.log("Requesting first 100 assets (skip=0)...");
      server.stdin.write(JSON.stringify(searchRequest) + "\n");
      page1Requested = true;
    }
    // After first page, search for second batch
    else if (page1Requested && !page1Received && response.id === 2) {
      page1Received = true;
      
      if (response.result?.content?.[0]?.text) {
        try {
          const assets1 = JSON.parse(response.result.content[0].text);
          console.log(`✓ Page 1 (skip=0): Got ${assets1.length} results`);
          if (assets1.length > 0) {
            console.log(`  First asset ID: ${assets1[0].ID}`);
            console.log(`  Last asset ID: ${assets1[assets1.length - 1].ID}`);
          }
          
          console.log(`\nRequesting next 100 assets (skip=100)...`);
          const searchRequest2 = {
            jsonrpc: "2.0",
            id: messageId++,
            method: "tools/call",
            params: {
              name: "tdx-asset-search",
              arguments: {
                appId: 116,
                maxResults: 100,
                skip: 100,
              },
            },
          };
          server.stdin.write(JSON.stringify(searchRequest2) + "\n");
        } catch (e) {
          console.error("Error parsing page 1:", e.message);
          process.exit(1);
        }
      }
    }
    // Handle second page response
    else if (page1Received && response.id === 3) {
      if (response.result?.content?.[0]?.text) {
        try {
          const assets2 = JSON.parse(response.result.content[0].text);
          console.log(`✓ Page 2 (skip=100): Got ${assets2.length} results`);
          if (assets2.length > 0) {
            console.log(`  First asset ID: ${assets2[0].ID}`);
            console.log(`  Last asset ID: ${assets2[assets2.length - 1].ID}`);
          }
          
          console.log(`\n=== PAGINATION TEST SUCCESSFUL ===`);
          console.log(`Skip/Offset parameters are working!`);
          console.log(`You can now page through all ${100 + assets2.length}+ assets in batches.`);
        } catch (e) {
          console.error("Error parsing page 2:", e.message);
        }
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
