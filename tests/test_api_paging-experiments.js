/**
 * Test: Paging Parameter Experiments
 * Description: Experiments with different paging parameter names (PageIndex, offset, skip)
 *              to determine which (if any) the TDX API supports.
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

console.log("Testing different paging parameter names...\n");
server.stdin.write(JSON.stringify(initRequest) + "\n");

let initialized = false;
let testNum = 0;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    
    if (!initialized && response.id === 1) {
      initialized = true;
      console.log("Trying PageIndex parameter...");
      
      // Try with manual TDX client to test different parameter
      const testRequest = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-asset-search",
          arguments: {
            appId: 116,
            maxResults: 10,
            skip: 0,
          },
        },
      };
      server.stdin.write(JSON.stringify(testRequest) + "\n");
    } else if (response.id === 2) {
      if (response.result?.content?.[0]?.text) {
        try {
          const assets = JSON.parse(response.result.content[0].text);
          console.log(`Results with skip=0: ${assets.length} assets`);
          console.log(`First 3 IDs: ${assets.slice(0, 3).map(a => a.ID).join(", ")}`);
          console.log(`\nNote: The TDX API search endpoint returns a flat array.`);
          console.log(`It may not support traditional paging via skip/offset/pageIndex.`);
          console.log(`\nAlternatives to explore:`);
          console.log(`1. Check TDX API documentation for paging support`);
          console.log(`2. Try sorting by ID and filtering (ID > lastSeenID)`);
          console.log(`3. Use cursor-based pagination if supported`);
        } catch (e) {
          console.log("Raw response:", response.result.content[0].text.substring(0, 200));
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
