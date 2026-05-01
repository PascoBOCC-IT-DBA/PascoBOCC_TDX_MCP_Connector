/**
 * Test: Retrieve Scribe SharePoint Allow-List Ticket Details
 * Description: Retrieves the full details and comments from the most relevant tickets
 *              to show the actual solution for adding Scribe to SharePoint allow-list
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// Connect to the tdx-local MCP server via stdio
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

// Send initialization request
const initRequest = {
  jsonrpc: "2.0",
  id: messageId++,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "scribe-detail-retrieval",
      version: "1.0.0",
    },
  },
};

server.stdin.write(JSON.stringify(initRequest) + "\n");

let initialized = false;
let requestsInProgress = 0;
const results = {
  ticket4231102: null,
  feed4231102: null,
  ticket4143881: null,
  feed4143881: null,
};

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);

    // After initialization, start retrieving ticket details
    if (!initialized && response.id === 1) {
      initialized = true;

      console.log(
        "\n📋 RETRIEVING SCRIBE SHAREPOINT ALLOW-LIST SOLUTIONS...\n"
      );

      // Get ticket 4231102
      const getTicket1 = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-ticket-get",
          arguments: {
            id: 4231102,
          },
        },
      };
      server.stdin.write(JSON.stringify(getTicket1) + "\n");
      requestsInProgress++;

      // Get feed for ticket 4231102
      const getFeed1 = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-ticket-feed-get",
          arguments: {
            id: 4231102,
          },
        },
      };
      server.stdin.write(JSON.stringify(getFeed1) + "\n");
      requestsInProgress++;

      // Get ticket 4143881
      const getTicket2 = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-ticket-get",
          arguments: {
            id: 4143881,
          },
        },
      };
      server.stdin.write(JSON.stringify(getTicket2) + "\n");
      requestsInProgress++;

      // Get feed for ticket 4143881
      const getFeed2 = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-ticket-feed-get",
          arguments: {
            id: 4143881,
          },
        },
      };
      server.stdin.write(JSON.stringify(getFeed2) + "\n");
      requestsInProgress++;
    } else if (
      initialized &&
      response.id >= 2 &&
      response.id <= 5
    ) {
      // Store results based on request ID
      if (response.result?.content?.[0]?.text) {
        try {
          const data = JSON.parse(response.result.content[0].text);
          if (response.id === 2) results.ticket4231102 = data;
          else if (response.id === 3) results.feed4231102 = data;
          else if (response.id === 4) results.ticket4143881 = data;
          else if (response.id === 5) results.feed4143881 = data;
        } catch (e) {
          if (response.id === 2) results.ticket4231102 = response.result.content[0].text;
          else if (response.id === 3) results.feed4231102 = response.result.content[0].text;
          else if (response.id === 4) results.ticket4143881 = response.result.content[0].text;
          else if (response.id === 5) results.feed4143881 = response.result.content[0].text;
        }
      } else if (response.error) {
        if (response.id === 2) results.ticket4231102 = { error: response.error };
        else if (response.id === 3) results.feed4231102 = { error: response.error };
        else if (response.id === 4) results.ticket4143881 = { error: response.error };
        else if (response.id === 5) results.feed4143881 = { error: response.error };
      }

      requestsInProgress--;
      if (requestsInProgress === 0) {
        displayResults();
        process.exit(0);
      }
    }
  } catch (e) {
    // Ignore JSON parse errors from npm output
  }
});

function displayResults() {
  console.log("\n" + "=".repeat(81));
  console.log("🎯 SOLUTION: Add Scribe Site/Domain to SharePoint Allow-List");
  console.log("=".repeat(81) + "\n");

  // Display Ticket 4231102
  if (results.ticket4231102 && typeof results.ticket4231102 === "object") {
    const t1 = results.ticket4231102;
    console.log(
      `📌 TICKET #${t1.ID} - ${t1.Title}`
    );
    console.log(`   Status: ${t1.StatusName} | Priority: ${t1.PriorityName}`);
    console.log(
      `   Created: ${new Date(t1.CreatedDate).toLocaleDateString()}`
    );

    if (t1.webLink) {
      console.log(`   🔗 WebLink: ${t1.webLink}`);
    }

    if (t1.Description) {
      const desc = t1.Description.replace(/<[^>]*>/g, "");
      console.log(`\n   Description:\n   ${desc}\n`);
    }
  }

  // Display feed for ticket 4231102
  if (results.feed4231102 && Array.isArray(results.feed4231102)) {
    console.log("   📝 Comments & Updates:");
    results.feed4231102.slice(0, 5).forEach((item, idx) => {
      const text = item.CommentText ? item.CommentText.replace(/<[^>]*>/g, "") : "";
      const author = item.CreatedByName || "System";
      const date = new Date(item.CreatedDate).toLocaleDateString();
      console.log(`\n   ${idx + 1}. [${date}] ${author}:`);
      console.log(`      ${text.substring(0, 300)}`);
      if (text.length > 300) console.log(`      ...`);
    });
  }

  console.log("\n" + "-".repeat(81) + "\n");

  // Display Ticket 4143881
  if (results.ticket4143881 && typeof results.ticket4143881 === "object") {
    const t2 = results.ticket4143881;
    console.log(
      `📌 TICKET #${t2.ID} - ${t2.Title}`
    );
    console.log(`   Status: ${t2.StatusName} | Priority: ${t2.PriorityName}`);
    console.log(
      `   Created: ${new Date(t2.CreatedDate).toLocaleDateString()}`
    );

    if (t2.webLink) {
      console.log(`   🔗 WebLink: ${t2.webLink}`);
    }

    if (t2.Description) {
      const desc = t2.Description.replace(/<[^>]*>/g, "");
      console.log(`\n   Description:\n   ${desc}\n`);
    }
  }

  // Display feed for ticket 4143881
  if (results.feed4143881 && Array.isArray(results.feed4143881)) {
    console.log("   📝 Comments & Updates:");
    results.feed4143881.slice(0, 5).forEach((item, idx) => {
      const text = item.CommentText ? item.CommentText.replace(/<[^>]*>/g, "") : "";
      const author = item.CreatedByName || "System";
      const date = new Date(item.CreatedDate).toLocaleDateString();
      console.log(`\n   ${idx + 1}. [${date}] ${author}:`);
      console.log(`      ${text.substring(0, 300)}`);
      if (text.length > 300) console.log(`      ...`);
    });
  }

  console.log("\n" + "=".repeat(81) + "\n");
}

server.stderr.on("data", (data) => {
  // Ignore stderr noise from npm
});

setTimeout(() => {
  console.error("❌ Timeout waiting for results");
  process.exit(1);
}, 30000);
