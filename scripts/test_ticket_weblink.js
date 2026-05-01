/**
 * Test: Get Full Ticket Data with WebLink
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

const server = spawn("npm", ["start"], {
  cwd: projectRoot,
  stdio: ["pipe", "pipe", "pipe"],
  shell: true,
});

const rl = createInterface({
  input: server.stdout,
  terminal: false,
});

let messageId = 1;
let initialized = false;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    
    if (!initialized) {
      console.log("✅ Initialized\n");
      initialized = true;
      fetchTicket();
    } else if (response.result && response.result.content) {
      const content = response.result.content[0].text;
      const ticket = JSON.parse(content);
      
      console.log("Full Ticket Data:");
      console.log(JSON.stringify(ticket, null, 2));
      
      setTimeout(() => {
        server.kill();
        process.exit(0);
      }, 500);
    }
  } catch (e) {
    // Ignore parse errors
  }
});

function fetchTicket() {
  const request = {
    jsonrpc: "2.0",
    id: messageId++,
    method: "tools/call",
    params: {
      name: "tdx-ticket-get",
      arguments: { id: 4231102 },
    },
  };

  server.stdin.write(JSON.stringify(request) + "\n");
}

const initRequest = {
  jsonrpc: "2.0",
  id: messageId++,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "ticket-weblink-check",
      version: "1.0.0",
    },
  },
};

server.stdin.write(JSON.stringify(initRequest) + "\n");

setTimeout(() => {
  server.kill();
  process.exit(0);
}, 30000);
