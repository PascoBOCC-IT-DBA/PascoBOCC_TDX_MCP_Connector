/**
 * Test: AssetBatcher Utility Demonstration
 * Description: Demonstrates the three methods of the AssetBatcher utility:
 *              1. getAllAssets() - Retrieves all assets across all forms and statuses
 *              2. getAssetsByForm() - Retrieves all assets for a specific form
 *              3. getAssetsByStatus() - Retrieves all assets with a specific status
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { TdxAuth } from "../dist/auth.js";
import { TdxClient } from "../dist/tdx-client.js";
import { loadConfig } from "../dist/config.js";
import { AssetBatcher } from "../dist/asset-batcher.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = loadConfig();
const auth = new TdxAuth(config);

async function demonstrateAssetBatcher() {
  try {
    const token = await auth.getToken();
    const client = new TdxClient(config);

    // Initialize the batcher
    const batcher = new AssetBatcher(client);

    console.log("=".repeat(70));
    console.log("ASSET BATCHER UTILITY - DEMONSTRATION");
    console.log("=".repeat(70) + "\n");

    // Example 1: Get all assets
    console.log("EXAMPLE 1: Retrieve ALL assets (Form × Status batching)\n");
    const allResult = await batcher.getAllAssets(116, (msg) => console.log(msg));

    console.log("\n" + "=".repeat(70));
    console.log("EXAMPLE 1 RESULTS:\n");
    console.log(`Total Assets: ${allResult.totalAssets}`);
    console.log(`Batches Executed: ${allResult.batchesExecuted}`);
    console.log(`Batches with Data: ${allResult.batchesWithResults}`);

    console.log("\nAssets by Form:");
    Object.entries(allResult.assetsByForm)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .forEach(([formId, data]) => {
        console.log(`  ${data.name}: ${data.count}`);
      });

    console.log("\nAssets by Status:");
    Object.entries(allResult.assetsByStatus)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .forEach(([statusId, data]) => {
        console.log(`  ${data.name}: ${data.count}`);
      });

    // Example 2: Get assets by specific form
    console.log("\n" + "=".repeat(70));
    console.log("EXAMPLE 2: Retrieve assets by Form (Form ID: 1773)\n");
    const formAssets = await batcher.getAssetsByForm(1773, 116, (msg) =>
      console.log(msg)
    );

    console.log(`\nTotal Computer Assets: ${formAssets.length}`);
    console.log(
      `Sample Assets: ${formAssets.slice(0, 2).map((a) => `"${a.Name}"`).join(", ")}`
    );

    // Example 3: Get assets by specific status
    console.log("\n" + "=".repeat(70));
    console.log("EXAMPLE 3: Retrieve assets by Status (Status ID: 898)\n");
    const statusAssets = await batcher.getAssetsByStatus(
      898,
      116,
      (msg) => console.log(msg)
    );

    console.log(`\nAssets in Status 898: ${statusAssets.length}`);

    console.log("\n" + "=".repeat(70));
    console.log("DEMONSTRATION COMPLETE");
    console.log("=".repeat(70));
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

demonstrateAssetBatcher();
