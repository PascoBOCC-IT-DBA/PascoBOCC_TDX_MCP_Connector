/**
 * Test: Total Asset Count Verification
 * Description: Verifies the total asset count by requesting high limits (5000-10000)
 *              to determine if there are more assets beyond the typical 500 limit
 *              and to identify if the API has a hard result limit.
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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

console.log("Checking API paging and total asset count...\n");
server.stdin.write(JSON.stringify(initRequest) + "\n");

// Listen for responses
let initialized = false;
let assetsRequested = false;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    
    // After initialization, search for assets with high limit
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
            maxResults: 5000, // Request a very high number
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
          
          console.log(`Requested: 5000 results`);
          console.log(`Received: ${assets.length} results`);
          console.log();
          
          if (Array.isArray(assets)) {
            console.log(`Total unique assets in system: ${assets.length}`);
            
            // Check if response includes paging info
            if (assets.pageIndex !== undefined) {
              console.log(`\nPaging Info Found:`);
              console.log(`  - Page Index: ${assets.pageIndex}`);
              console.log(`  - Page Size: ${assets.pageSize}`);
              console.log(`  - Total Count: ${assets.totalCount}`);
            } else {
              console.log(`\nNo paging metadata in response array.`);
              console.log(`The API appears to return a simple array without paging info.`);
            }
          } else if (assets.rows !== undefined) {
            console.log(`\nPaging structure detected:`);
            console.log(`  - Total Count: ${assets.pageCount || assets.totalCount || 'N/A'}`);
            console.log(`  - Rows returned: ${assets.rows.length}`);
          }
          
          console.log(`\n=== CONCLUSION ===`);
          if (assets.length >= 5000) {
            console.log(`The API returned exactly ${assets.length} results.`);
            console.log(`This suggests there may be MORE assets than returned.`);
            console.log(`The API likely has a hard cap around 500-5000 results per query.`);
          } else {
            console.log(`Total Assets in System: ${assets.length}`);
            console.log(`All assets retrieved in a single query.`);
            console.log(`Paging support: Likely NOT implemented in search endpoint.`);
          }
        } catch (e) {
          console.log("Raw response:", response.result.content[0].text.substring(0, 500));
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
