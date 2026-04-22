/**
 * Test: Batch Assets by Form
 * Description: Retrieves all assets by batching searches across each asset form type.
 *              Each form is searched separately with a 500 result limit to show breakdown
 *              by asset category (Computer, Mobile Device, Radio, etc.).
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
let formsRequested = false;
let assetBatches = [];
let allAssets = [];

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

console.log("Starting batched asset retrieval by form...\n");
server.stdin.write(JSON.stringify(initRequest) + "\n");

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line);

    // Step 1: After initialization, get asset categories/forms
    if (!initialized && response.id === 1) {
      initialized = true;
      console.log("Step 1: Retrieving asset forms...\n");

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
    }
    // Step 2: After getting forms, batch search by form
    else if (!formsRequested && response.id === 2) {
      formsRequested = true;

      if (response.result?.content?.[0]?.text) {
        try {
          const forms = JSON.parse(response.result.content[0].text);

          console.log(`Found ${forms.length} asset forms:\n`);
          forms.forEach((form) => {
            console.log(`  - Form ${form.ID}: ${form.Name}`);
          });

          // Now batch search for each form
          assetBatches = forms.map((form, index) => ({
            formId: form.ID,
            formName: form.Name,
            messageId: messageId + index,
            searched: false,
            assetCount: 0,
          }));

          console.log(`\nStep 2: Batching asset searches by form...\n`);

          // Send search requests for each form
          assetBatches.forEach((batch) => {
            const searchRequest = {
              jsonrpc: "2.0",
              id: batch.messageId,
              method: "tools/call",
              params: {
                name: "tdx-asset-search",
                arguments: {
                  appId: 116,
                  maxResults: 10000,
                  formIds: [batch.formId],
                },
              },
            };
            server.stdin.write(JSON.stringify(searchRequest) + "\n");
          });

          messageId += assetBatches.length;
        } catch (e) {
          console.log("Error parsing forms:", e.message);
          process.exit(1);
        }
      }
    }
    // Step 3: Handle asset search responses
    else {
      // Find which batch this response belongs to
      const batch = assetBatches.find((b) => b.messageId === response.id);

      if (batch && !batch.searched) {
        batch.searched = true;

        if (response.result?.content?.[0]?.text) {
          try {
            const assets = JSON.parse(response.result.content[0].text);
            batch.assetCount = assets.length;
            allAssets.push(...assets);

            console.log(
              `✓ Form ${batch.formId} (${batch.formName}): ${assets.length} assets`
            );

            // Check if all batches are complete
            if (assetBatches.every((b) => b.searched)) {
              printSummary();
              process.exit(0);
            }
          } catch (e) {
            console.log(
              `✗ Form ${batch.formId} - Error parsing response:`,
              e.message
            );
            batch.assetCount = 0;

            if (assetBatches.every((b) => b.searched)) {
              printSummary();
              process.exit(1);
            }
          }
        } else if (response.error) {
          console.log(`✗ Form ${batch.formId} - Error:`, response.error.message);
          batch.assetCount = 0;

          if (assetBatches.every((b) => b.searched)) {
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
  console.log("\n" + "=".repeat(60));
  console.log("BATCHING SUMMARY");
  console.log("=".repeat(60) + "\n");

  console.log("Assets Retrieved by Form:\n");

  const sorted = assetBatches
    .filter((b) => b.assetCount > 0)
    .sort((a, b) => b.assetCount - a.assetCount);

  sorted.forEach((batch, index) => {
    console.log(`${index + 1}. ${batch.formName}`);
    console.log(`   Form ID: ${batch.formId}`);
    console.log(`   Assets: ${batch.assetCount}`);
    console.log();
  });

  console.log("=".repeat(60));
  console.log(
    `Total Assets Retrieved: ${allAssets.length} (across ${sorted.length} forms)`
  );
  console.log("=".repeat(60));

  // Show if any form hit the 10K limit
  const hittingLimit = assetBatches.filter((b) => b.assetCount === 10000);
  if (hittingLimit.length > 0) {
    console.log("\n⚠️  Forms with 10,000 assets (may have more):");
    hittingLimit.forEach((b) => {
      console.log(`   - ${b.formName} (Form ID: ${b.formId})`);
    });
    console.log("\nThese forms may need further sub-batching by status or department.\n");
  }

  // Breakdown by asset type (manufacturer + model)
  console.log("=".repeat(60));
  console.log("TOP 20 ASSET TYPES (by manufacturer and model):\n");

  const typeBreakdown = {};
  allAssets.forEach((asset) => {
    const key = `${asset.ManufacturerName || "Unknown"} - ${
      asset.ModelName || asset.Name || "No Model"
    }`;
    typeBreakdown[key] = (typeBreakdown[key] || 0) + 1;
  });

  const topTypes = Object.entries(typeBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  topTypes.forEach(([type, count], index) => {
    console.log(`${index + 1}. ${type}: ${count}`);
  });
}

server.stderr.on("data", (data) => {
  console.error("Server error:", data.toString());
});

setTimeout(() => {
  console.error("Timeout waiting for responses");
  process.exit(1);
}, 30000);
