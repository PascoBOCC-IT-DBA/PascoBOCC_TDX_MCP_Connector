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

console.log("Fetching asset types from your TDX system...\n");
server.stdin.write(JSON.stringify(initRequest) + "\n");

// Listen for responses
let initialized = false;
let assetsRequested = false;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    
    // After initialization, search for assets
    if (!initialized && response.id === 1) {
      initialized = true;

      const searchRequest = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-asset-search",
          arguments: {
            appId: 116, // Asset Management app
            maxResults: 500,
          },
        },
      };
      server.stdin.write(JSON.stringify(searchRequest) + "\n");
    }
    // Handle the search response
    else if (!assetsRequested && response.id === 2) {
      assetsRequested = true;
      
      if (response.result?.content?.[0]?.text) {
        try {
          const assets = JSON.parse(response.result.content[0].text);
          
          // Group by asset type/model
          const typeBreakdown = {};
          const modelBreakdown = {};
          
          assets.forEach((asset) => {
            // Group by manufacturer and model
            const key = `${asset.ManufacturerName || 'Unknown'} - ${asset.ModelName || asset.Name || 'No Model'}`;
            if (!typeBreakdown[key]) {
              typeBreakdown[key] = { count: 0, examples: [] };
            }
            typeBreakdown[key].count++;
            if (typeBreakdown[key].examples.length < 2) {
              typeBreakdown[key].examples.push({
                id: asset.ID,
                name: asset.Name,
                serialNumber: asset.SerialNumber,
              });
            }
          });
          
          console.log(`=== ASSET TYPES IN YOUR TDX SYSTEM ===\n`);
          console.log(`Total Assets: ${assets.length}\n`);
          
          // Sort by count (descending)
          const sorted = Object.entries(typeBreakdown)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 30); // Show top 30
          
          sorted.forEach(([key, data], index) => {
            console.log(`${index + 1}. ${key}`);
            console.log(`   Count: ${data.count}`);
            if (data.examples.length > 0) {
              console.log(`   Examples:`);
              data.examples.forEach((ex) => {
                console.log(`     - ${ex.name}${ex.serialNumber ? ` (${ex.serialNumber})` : ''}`);
              });
            }
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
