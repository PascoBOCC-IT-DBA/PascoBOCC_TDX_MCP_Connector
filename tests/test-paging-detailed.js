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
let page1Assets = [];
let page2Assets = [];

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

console.log("Running comprehensive asset pagination test...\n");
server.stdin.write(JSON.stringify(initRequest) + "\n");

// Listen for responses
let initialized = false;
let page1Requested = false;
let page1Received = false;
let page2Requested = false;

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
            maxResults: 50,
            skip: 0,
          },
        },
      };
      console.log("Test 1: Requesting first 50 assets (skip=0)...");
      server.stdin.write(JSON.stringify(searchRequest) + "\n");
      page1Requested = true;
    }
    // After first page, search for second batch
    else if (page1Requested && !page1Received && response.id === 2) {
      page1Received = true;
      
      if (response.result?.content?.[0]?.text) {
        try {
          page1Assets = JSON.parse(response.result.content[0].text);
          console.log(`✓ Page 1 Results: ${page1Assets.length} assets`);
          if (page1Assets.length >= 5) {
            console.log(`  Sample IDs: ${page1Assets.slice(0, 5).map(a => a.ID).join(", ")}`);
          }
          
          console.log(`\nTest 2: Requesting next 50 assets (skip=50)...`);
          const searchRequest2 = {
            jsonrpc: "2.0",
            id: messageId++,
            method: "tools/call",
            params: {
              name: "tdx-asset-search",
              arguments: {
                appId: 116,
                maxResults: 50,
                skip: 50,
              },
            },
          };
          server.stdin.write(JSON.stringify(searchRequest2) + "\n");
          page2Requested = true;
        } catch (e) {
          console.error("Error parsing page 1:", e.message);
          process.exit(1);
        }
      }
    }
    // Handle second page response
    else if (page2Requested && response.id === 3) {
      if (response.result?.content?.[0]?.text) {
        try {
          page2Assets = JSON.parse(response.result.content[0].text);
          console.log(`✓ Page 2 Results: ${page2Assets.length} assets`);
          if (page2Assets.length >= 5) {
            console.log(`  Sample IDs: ${page2Assets.slice(0, 5).map(a => a.ID).join(", ")}`);
          }
          
          // Analyze the results
          console.log(`\n=== PAGINATION ANALYSIS ===`);
          console.log(`Page 1 size: ${page1Assets.length}`);
          console.log(`Page 2 size: ${page2Assets.length}`);
          
          // Check if pages have different assets
          const page1Ids = new Set(page1Assets.map(a => a.ID));
          const page2Ids = new Set(page2Assets.map(a => a.ID));
          const overlap = [...page1Ids].filter(id => page2Ids.has(id));
          
          console.log(`Overlap (assets in both pages): ${overlap.length}`);
          
          if (overlap.length === 0 && page1Assets.length > 0 && page2Assets.length > 0) {
            console.log(`\n✅ SUCCESS: Skip parameter is working correctly!`);
            console.log(`   Pages contain completely different assets.`);
            console.log(`   You can now iterate through all assets using skip parameter.`);
          } else if (overlap.length > 0) {
            console.log(`\n⚠️  WARNING: Found ${overlap.length} overlapping assets between pages.`);
            console.log(`   This may indicate the skip parameter is not being respected.`);
          }
          
          process.exit(0);
        } catch (e) {
          console.error("Error parsing page 2:", e.message);
          process.exit(1);
        }
      }
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
