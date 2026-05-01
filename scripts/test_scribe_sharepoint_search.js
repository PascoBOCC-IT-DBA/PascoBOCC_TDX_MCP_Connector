/**
 * Test: Scribe SharePoint Allow-List Search
 * Description: Tests searching for tickets and KB articles related to the question:
 *              "How do I Add the Scribe Site/Domain to the Allow‑List in a SharePoint site?"
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

// The user's question
const userQuestion = "How do I Add the Scribe Site/Domain to the Allow-List in a SharePoint site?";
const searchText = "Scribe SharePoint Allow-List Domain";

// Send initialization request
const initRequest = {
  jsonrpc: "2.0",
  id: messageId++,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "scribe-search-test",
      version: "1.0.0",
    },
  },
};

server.stdin.write(JSON.stringify(initRequest) + "\n");

let initialized = false;
let ticketSearchDone = false;
let kbSearchDone = false;
let ticketResults = null;
let kbResults = null;

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);

    // After initialization, start ticket search
    if (!initialized && response.id === 1) {
      initialized = true;

      console.log(`\n🔍 SEARCHING FOR: "${userQuestion}"\n`);
      console.log(`Search Text Used: "${searchText}"\n`);
      console.log("=" + "=".repeat(80));

      const ticketSearchRequest = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-ticket-search",
          arguments: {
            searchText: searchText,
            maxResults: 25,
          },
        },
      };
      server.stdin.write(JSON.stringify(ticketSearchRequest) + "\n");
    }
    // Handle ticket search response
    else if (!ticketSearchDone && response.id === 2) {
      ticketSearchDone = true;

      if (response.result?.content?.[0]?.text) {
        try {
          ticketResults = JSON.parse(response.result.content[0].text);
        } catch (e) {
          ticketResults = response.result.content[0].text;
        }
      } else if (response.error) {
        ticketResults = { error: response.error };
      }

      // Now search KB articles
      const kbSearchRequest = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-kb-search",
          arguments: {
            searchText: searchText,
            maxResults: 25,
          },
        },
      };
      server.stdin.write(JSON.stringify(kbSearchRequest) + "\n");
    }
    // Handle KB search response
    else if (ticketSearchDone && !kbSearchDone && response.id === 3) {
      kbSearchDone = true;

      if (response.result?.content?.[0]?.text) {
        try {
          kbResults = JSON.parse(response.result.content[0].text);
        } catch (e) {
          kbResults = response.result.content[0].text;
        }
      } else if (response.error) {
        kbResults = { error: response.error };
      }

      // Display results
      displayResults();
      process.exit(0);
    }
  } catch (e) {
    // Ignore JSON parse errors from npm output
  }
});

function displayResults() {
  console.log("\n\n📌 TICKET SEARCH RESULTS");
  console.log("=" + "=".repeat(80));

  if (typeof ticketResults === "string") {
    console.log("Error:", ticketResults);
  } else if (Array.isArray(ticketResults)) {
    if (ticketResults.length === 0) {
      console.log("❌ No tickets found matching the search");
    } else {
      console.log(`✅ Found ${ticketResults.length} matching ticket(s):\n`);
      ticketResults.forEach((ticket, index) => {
        console.log(`${(index + 1).toString().padStart(2)}. [ID: ${ticket.ID}] ${ticket.Title}`);
        console.log(
          `    Status: ${ticket.StatusName} | Priority: ${ticket.PriorityName}`
        );
        if (ticket.webLink) {
          console.log(`    🔗 WebLink: ${ticket.webLink}`);
        }
        if (ticket.Description) {
          const desc = ticket.Description.replace(/<[^>]*>/g, "").substring(0, 100);
          console.log(`    Description: ${desc}...`);
        }
        console.log("");
      });
    }
  } else {
    console.log("Result:", JSON.stringify(ticketResults, null, 2));
  }

  console.log("\n\n📚 KB SEARCH RESULTS");
  console.log("=" + "=".repeat(80));

  if (typeof kbResults === "string") {
    console.log("Error:", kbResults);
  } else if (Array.isArray(kbResults)) {
    if (kbResults.length === 0) {
      console.log("❌ No KB articles found matching the search");
    } else {
      console.log(`✅ Found ${kbResults.length} matching KB article(s):\n`);
      kbResults.forEach((article, index) => {
        console.log(`${(index + 1).toString().padStart(2)}. [ID: ${article.ID}] ${article.Subject}`);
        if (article.Summary) {
          const summary = article.Summary.substring(0, 100);
          console.log(`    Summary: ${summary}...`);
        }
        console.log("");
      });
    }
  } else {
    console.log("Result:", JSON.stringify(kbResults, null, 2));
  }

  console.log("\n" + "=".repeat(81));
  console.log(
    "📊 SUMMARY: " +
      (Array.isArray(ticketResults) ? ticketResults.length : 0) +
      " ticket(s), " +
      (Array.isArray(kbResults) ? kbResults.length : 0) +
      " KB article(s) found"
  );
  console.log("=".repeat(81) + "\n");
}

server.stderr.on("data", (data) => {
  // Ignore stderr noise from npm
});

setTimeout(() => {
  console.error("❌ Timeout waiting for results");
  process.exit(1);
}, 30000);
