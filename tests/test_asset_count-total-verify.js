/**
 * Test: Total Asset Count Verification
 * Description: Verifies the total count of assets in the TDX system by attempting
 *              to retrieve all assets in a single request with maxResults set to 10,000.
 *              Analyzes the response to determine if paging is required and whether
 *              the API has hard limits on result size.
 * 
 * Purpose: This test helps understand the total asset inventory and API paging
 *          requirements for asset management operations.
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Get the directory where this test file is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Resolve to project root (parent of tests directory)
const projectRoot = resolve(__dirname, "..");

// Start the MCP server as a subprocess
const server = spawn("node", ["dist/index.js"], {
  cwd: projectRoot,
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

console.log("Getting total asset count from your TDX system...\n");
server.stdin.write(JSON.stringify(initRequest) + "\n");

// Listen for responses
let initialized = false;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    
    // After initialization, search for assets with higher limit
    if (!initialized && response.id === 1) {
      initialized = true;

      const searchRequest = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-asset-search",
          arguments: {
            appId: parseInt(process.env.TDX_ASSETS_APP_ID), // Asset Management app
            maxResults: 10000, // Try to get all assets
          },
        },
      };
      server.stdin.write(JSON.stringify(searchRequest) + "\n");
    }
    // Handle the search response
    else if (response.id === 2) {
      if (response.result?.content?.[0]?.text) {
        try {
          const assets = JSON.parse(response.result.content[0].text);
          console.log(`Total Assets in System: ${assets.length}`);
          
          if (assets.length === 500) {
            console.log("\nNOTE: Result is exactly 500, which may indicate:");
            console.log("- There are exactly 500 assets, OR");
            console.log("- The API has a hard limit of 500 results per request");
            console.log("\nPaging may be required to retrieve all assets beyond 500.");
          } else if (assets.length === 10000) {
            console.log("\nNOTE: Result is exactly 10,000, which may indicate:");
            console.log("- There are exactly 10,000 assets, OR");
            console.log("- The API has a hard limit of 10,000 results per request");
            console.log("\nPaging may be required to retrieve all assets beyond 10,000.");
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
