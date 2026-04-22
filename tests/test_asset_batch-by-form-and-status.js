/**
 * Test: Comprehensive Batch by Form and Status
 * Description: Executes parallel batch searches for each Form × Status combination to
 *              retrieve ALL assets in the system, bypassing the 10K result limit.
 *              Results in 117 parallel requests (9 forms × 13 statuses).
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
let initialized = false;
let statusesRequested = false;
let allStatuses = [];
let allForms = [];
let searchBatches = [];
let allAssets = [];
let completedSearches = 0;

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

console.log("Starting comprehensive batched asset retrieval...\n");
server.stdin.write(JSON.stringify(initRequest) + "\n");

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);

    // Step 1: After initialization, get statuses
    if (!initialized && response.id === 1) {
      initialized = true;
      console.log("Step 1: Retrieving asset statuses...\n");

      const getStatusesRequest = {
        jsonrpc: "2.0",
        id: messageId++,
        method: "tools/call",
        params: {
          name: "tdx-statuses-get",
          arguments: {
            componentType: "assets",
            appId: 116,
          },
        },
      };
      server.stdin.write(JSON.stringify(getStatusesRequest) + "\n");
    }
    // Step 2: After getting statuses, get forms
    else if (!statusesRequested && response.id === 2) {
      statusesRequested = true;

      if (response.result?.content?.[0]?.text) {
        try {
          allStatuses = JSON.parse(response.result.content[0].text);
          console.log(`Found ${allStatuses.length} asset statuses\n`);

          // Now get forms
          const getFormsRequest = {
            jsonrpc: "2.0",
            id: messageId++,
            method: "tools/call",
            params: {
              name: "tdx-asset-categories",
              arguments: {},
            },
          };
          server.stdin.write(JSON.stringify(getFormsRequest) + "\n");
        } catch (e) {
          console.log("Error parsing statuses:", e.message);
          process.exit(1);
        }
      }
    }
    // Step 3: After getting forms, create batches and start searches
    else if (response.id === 3) {
      if (response.result?.content?.[0]?.text) {
        try {
          allForms = JSON.parse(response.result.content[0].text);

          console.log(`Found ${allForms.length} asset forms\n`);
          console.log("Step 2: Creating search batches (Form × Status)...\n");

          // Create batches: each form × each status
          let batchId = messageId;
          for (const form of allForms) {
            for (const status of allStatuses) {
              searchBatches.push({
                batchId: batchId,
                formId: form.ID,
                formName: form.Name,
                statusId: status.ID,
                statusName: status.Name,
                searched: false,
                assetCount: 0,
              });
              batchId++;
            }
          }

          console.log(
            `Created ${searchBatches.length} search batches (${allForms.length} forms × ${allStatuses.length} statuses)\n`
          );
          console.log("Step 3: Executing parallel searches...\n");

          // Send all search requests
          searchBatches.forEach((batch) => {
            const searchRequest = {
              jsonrpc: "2.0",
              id: batch.batchId,
              method: "tools/call",
              params: {
                name: "tdx-asset-search",
                arguments: {
                  appId: 116,
                  maxResults: 10000,
                  formIds: [batch.formId],
                  statusIds: [batch.statusId],
                },
              },
            };
            server.stdin.write(JSON.stringify(searchRequest) + "\n");
          });

          messageId = batchId;
        } catch (e) {
          console.log("Error parsing forms:", e.message);
          process.exit(1);
        }
      }
    }
    // Step 4: Handle search responses
    else {
      const batch = searchBatches.find((b) => b.batchId === response.id);

      if (batch && !batch.searched) {
        batch.searched = true;
        completedSearches++;

        if (response.result?.content?.[0]?.text) {
          try {
            const assets = JSON.parse(response.result.content[0].text);
            batch.assetCount = assets.length;
            if (assets.length > 0) {
              allAssets.push(...assets);
            }

            if (completedSearches % 10 === 0) {
              console.log(`Progress: ${completedSearches}/${searchBatches.length} searches completed`);
            }

            // Check if all searches are complete
            if (completedSearches === searchBatches.length) {
              printSummary();
              process.exit(0);
            }
          } catch (e) {
            batch.assetCount = 0;

            if (completedSearches === searchBatches.length) {
              printSummary();
              process.exit(1);
            }
          }
        } else if (response.error) {
          batch.assetCount = 0;

          if (completedSearches === searchBatches.length) {
            printSummary();
            process.exit(1);
          }
        }
      }
    }
  } catch (e) {
    // Ignore JSON parse errors from server output
  }
});

function printSummary() {
  console.log("\n" + "=".repeat(70));
  console.log("COMPREHENSIVE BATCHING SUMMARY");
  console.log("=".repeat(70) + "\n");

  // Summary by form
  console.log("ASSETS RETRIEVED BY FORM:\n");
  const byForm = {};
  searchBatches.forEach((batch) => {
    if (!byForm[batch.formId]) {
      byForm[batch.formId] = {
        formName: batch.formName,
        total: 0,
        batches: 0,
      };
    }
    byForm[batch.formId].total += batch.assetCount;
    if (batch.assetCount > 0) {
      byForm[batch.formId].batches++;
    }
  });

  const sortedByForm = Object.entries(byForm)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([formId, data]) => ({
      formId: parseInt(formId),
      ...data,
    }));

  sortedByForm.forEach((form, index) => {
    console.log(`${index + 1}. ${form.formName}`);
    console.log(`   Form ID: ${form.formId}`);
    console.log(`   Total Assets: ${form.total}`);
    console.log(`   Batches with Data: ${form.batches}/${allStatuses.length} status filters`);
    console.log();
  });

  // Summary by status
  console.log("\n" + "=".repeat(70));
  console.log("DISTRIBUTION BY STATUS:\n");
  const byStatus = {};
  searchBatches.forEach((batch) => {
    if (!byStatus[batch.statusId]) {
      byStatus[batch.statusId] = {
        statusName: batch.statusName,
        total: 0,
      };
    }
    byStatus[batch.statusId].total += batch.assetCount;
  });

  const sortedByStatus = Object.entries(byStatus)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([statusId, data]) => ({
      statusId: parseInt(statusId),
      ...data,
    }));

  sortedByStatus.forEach((status, index) => {
    console.log(
      `${index + 1}. ${status.statusName || `Status ${status.statusId}`}: ${status.total} assets`
    );
  });

  // Overall summary
  console.log("\n" + "=".repeat(70));
  console.log("OVERALL SUMMARY:\n");
  console.log(`Total Assets Retrieved: ${allAssets.length}`);
  console.log(`Search Batches Executed: ${searchBatches.length}`);
  console.log(`Batches with Results: ${searchBatches.filter((b) => b.assetCount > 0).length}`);
  console.log(`Average Assets per Batch: ${(allAssets.length / searchBatches.filter((b) => b.assetCount > 0).length).toFixed(1)}`);

  // Check if we're hitting limits
  const atLimit = searchBatches.filter((b) => b.assetCount === 10000);
  if (atLimit.length > 0) {
    console.log(`\n⚠️  Batches at 10K limit (may have more): ${atLimit.length}`);
    console.log("   These combinations may need further sub-batching.");
  }

  console.log("\n" + "=".repeat(70));
}

server.stderr.on("data", (data) => {
  console.error("Server error:", data.toString());
});

setTimeout(() => {
  console.error("Timeout waiting for responses");
  process.exit(1);
}, 60000);
