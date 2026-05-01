/**
 * Test: Get Scribe SharePoint Allow-List Ticket Feed/Comments
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
let feedFetched = 0;
const ticketIds = [4231102, 4697840, 4143881];
let currentIndex = 0;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);
    
    if (!initialized) {
      console.log("✅ Initialized\n");
      initialized = true;
      fetchNextFeed();
    } else if (response.result && response.result.content) {
      const content = response.result.content[0].text;
      const feed = JSON.parse(content);
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`💬 TICKET #${ticketIds[currentIndex]} - FEED/COMMENTS`);
      console.log(`${'='.repeat(80)}`);
      
      if (feed && Array.isArray(feed)) {
        feed.forEach((comment, idx) => {
          console.log(`\n[Comment ${idx + 1}]`);
          console.log(`Author: ${comment.CreatedFullName}`);
          console.log(`Date: ${comment.CreatedDate}`);
          console.log(`Body:\n${comment.Body.substring(0, 1000)}${comment.Body.length > 1000 ? '...' : ''}`);
        });
      } else {
        console.log("No comments found");
      }
      
      feedFetched++;
      currentIndex++;
      
      if (currentIndex < ticketIds.length) {
        fetchNextFeed();
      } else {
        setTimeout(() => {
          server.kill();
          process.exit(0);
        }, 500);
      }
    }
  } catch (e) {
    // Ignore parse errors
  }
});

function fetchNextFeed() {
  const ticketId = ticketIds[currentIndex];
  console.log(`🔍 Fetching feed for ticket #${ticketId}...`);
  
  const request = {
    jsonrpc: "2.0",
    id: messageId++,
    method: "tools/call",
    params: {
      name: "tdx-ticket-feed-get",
      arguments: { id: ticketId },
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
      name: "scribe-feed-details",
      version: "1.0.0",
    },
  },
};

server.stdin.write(JSON.stringify(initRequest) + "\n");

setTimeout(() => {
  server.kill();
  process.exit(0);
}, 30000);
