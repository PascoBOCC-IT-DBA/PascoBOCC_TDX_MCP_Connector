/**
 * Test: API Response Structure Validation
 * Description: Validates the structure of TDX API responses and checks for paging metadata,
 *              total counts, and other structural information.
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

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

const initRequest = {
  jsonrpc: "2.0",
  id: messageId++,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" },
  },
};

console.log("Inspecting raw API response structure...\n");
server.stdin.write(JSON.stringify(initRequest) + "\n");

let initialized = false;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    
    if (!initialized && response.id === 1) {
      initialized = true;
      
      const testRequest = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-asset-search",
          arguments: {
            appId: 116,
            maxResults: 5,
          },
        },
      };
      server.stdin.write(JSON.stringify(testRequest) + "\n");
    } else if (response.id === 2) {
      if (response.result?.content?.[0]?.text) {
        try {
          const result = JSON.parse(response.result.content[0].text);
          console.log("Response type:", Array.isArray(result) ? "Array" : typeof result);
          console.log("Is Array:", Array.isArray(result));
          
          if (Array.isArray(result)) {
            console.log("Array length:", result.length);
            console.log("\nFirst item structure:");
            if (result.length > 0) {
              const firstItem = result[0];
              console.log("Keys:", Object.keys(firstItem).slice(0, 10).join(", "), "...");
              console.log(`\nSample: ID=${firstItem.ID}, Name=${firstItem.Name}`);
            }
          } else if (typeof result === "object") {
            console.log("\nResponse object keys:", Object.keys(result).slice(0, 15).join(", "));
            if (result.pageIndex !== undefined) {
              console.log(`\nPaging info found:`);
              console.log(`  pageIndex: ${result.pageIndex}`);
              console.log(`  pageSize: ${result.pageSize}`);
              console.log(`  totalCount: ${result.totalCount}`);
            }
            if (result.rows) {
              console.log(`Rows array found: ${result.rows.length} items`);
            }
          }
        } catch (e) {
          console.log("Could not parse:", e.message);
        }
      }
      process.exit(0);
    }
  } catch (e) {
    // Ignore
  }
});

setTimeout(() => {
  console.error("Timeout");
  process.exit(1);
}, 10000);
