/**
 * Test: Comprehensive Asset Inventory Report
 * Description: Generates a detailed inventory report showing:
 *              - Total asset count with breakdown by form and status
 *              - Top 30 asset types by manufacturer and model
 *              - Form × Status distribution matrix
 *              - Statistical analysis and key insights
 *              Uses the AssetBatcher utility to retrieve all 17K+ assets efficiently.
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

async function generateAssetReport() {
  try {
    const client = new TdxClient(config);
    const batcher = new AssetBatcher(client);

    console.log("\n" + "=".repeat(80));
    console.log("COMPREHENSIVE ASSET INVENTORY REPORT");
    console.log("=".repeat(80) + "\n");

    console.log("Retrieving complete asset data...\n");

    const result = await batcher.getAllAssets(116, (msg) => {
      if (msg.includes("Progress") || msg.includes("Total")) {
        console.log(`  ${msg}`);
      }
    });

    const { totalAssets, assetsByForm, assetsByStatus, allAssets } = result;

    // ===== OVERALL SUMMARY =====
    console.log("\n" + "=".repeat(80));
    console.log("OVERALL SUMMARY");
    console.log("=".repeat(80) + "\n");

    console.log(`Total Assets in System: ${totalAssets.toLocaleString()}\n`);

    // ===== BY FORM =====
    console.log("=".repeat(80));
    console.log("ASSETS BY FORM");
    console.log("=".repeat(80) + "\n");

    const formsSorted = Object.entries(assetsByForm)
      .map(([formId, data]) => ({
        formId: parseInt(formId),
        ...data,
      }))
      .sort((a, b) => b.count - a.count);

    formsSorted.forEach((form, index) => {
      const percentage = ((form.count / totalAssets) * 100).toFixed(1);
      const bar = "█".repeat(Math.floor(form.count / 1000)) + "░".repeat(Math.max(0, 30 - Math.floor(form.count / 1000)));
      console.log(
        `${index + 1}. ${form.name.padEnd(35)} ${form.count
          .toString()
          .padStart(6)} (${percentage.padStart(5)}%) ${bar}`
      );
    });

    // ===== BY STATUS =====
    console.log("\n" + "=".repeat(80));
    console.log("ASSETS BY STATUS");
    console.log("=".repeat(80) + "\n");

    const statusesSorted = Object.entries(assetsByStatus)
      .map(([statusId, data]) => ({
        statusId: parseInt(statusId),
        ...data,
      }))
      .sort((a, b) => b.count - a.count);

    statusesSorted.forEach((status, index) => {
      const percentage = ((status.count / totalAssets) * 100).toFixed(1);
      const bar = "█".repeat(Math.floor(status.count / 2000)) + "░".repeat(Math.max(0, 30 - Math.floor(status.count / 2000)));
      console.log(
        `${index + 1}. ${status.name.padEnd(35)} ${status.count
          .toString()
          .padStart(6)} (${percentage.padStart(5)}%) ${bar}`
      );
    });

    // ===== TOP ASSET TYPES =====
    console.log("\n" + "=".repeat(80));
    console.log("TOP 30 ASSET TYPES (by Manufacturer and Model)");
    console.log("=".repeat(80) + "\n");

    const typeBreakdown = {};
    allAssets.forEach((asset) => {
      const key = `${asset.ManufacturerName || "Unknown"} - ${
        asset.ModelName || asset.Name || "No Model"
      }`;
      typeBreakdown[key] = (typeBreakdown[key] || 0) + 1;
    });

    const topTypes = Object.entries(typeBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);

    topTypes.forEach(([type, count], index) => {
      const percentage = ((count / totalAssets) * 100).toFixed(2);
      const bar = "█".repeat(Math.floor(count / 1000)) + "░".repeat(Math.max(0, 40 - Math.floor(count / 1000)));
      console.log(
        `${(index + 1).toString().padStart(2)}. ${type.substring(0, 45).padEnd(45)} ${count
          .toString()
          .padStart(6)} (${percentage.padStart(5)}%) ${bar}`
      );
    });

    // ===== FORM × STATUS MATRIX =====
    console.log("\n" + "=".repeat(80));
    console.log("FORM × STATUS DISTRIBUTION MATRIX");
    console.log("=".repeat(80) + "\n");

    const matrix = {};
    allAssets.forEach((asset) => {
      const key = `${asset.FormID}|${asset.StatusID}`;
      if (!matrix[key]) {
        matrix[key] = {
          formId: asset.FormID,
          statusId: asset.StatusID,
          formName: asset.FormName,
          statusName: asset.StatusName,
          count: 0,
        };
      }
      matrix[key].count++;
    });

    const matrixSorted = Object.values(matrix).sort((a, b) => b.count - a.count);

    console.log("Top 20 Form-Status combinations:\n");
    matrixSorted.slice(0, 20).forEach((item, index) => {
      console.log(
        `${(index + 1).toString().padStart(2)}. ${item.formName.substring(0, 30).padEnd(30)} → ${item.statusName
          .substring(0, 25)
          .padEnd(25)} : ${item.count.toString().padStart(6)} assets`
      );
    });

    // ===== STATISTICS =====
    console.log("\n" + "=".repeat(80));
    console.log("STATISTICS");
    console.log("=".repeat(80) + "\n");

    const avgAssetsPerForm = (totalAssets / formsSorted.length).toFixed(0);
    const avgAssetsPerStatus = (totalAssets / statusesSorted.length).toFixed(0);
    const avgAssetsPerType = (totalAssets / Object.keys(typeBreakdown).length).toFixed(1);

    console.log(`Average Assets per Form:       ${avgAssetsPerForm.padStart(8)}`);
    console.log(`Average Assets per Status:     ${avgAssetsPerStatus.padStart(8)}`);
    console.log(`Average Assets per Type:       ${avgAssetsPerType.padStart(8)}`);
    console.log(`Total Unique Manufacturers:    ${[...new Set(allAssets.map((a) => a.ManufacturerName))].length.toString().padStart(8)}`);
    console.log(`Total Unique Models:           ${[...new Set(allAssets.map((a) => a.ModelName))].length.toString().padStart(8)}`);
    console.log(`Total Asset Types (unique):    ${Object.keys(typeBreakdown).length.toString().padStart(8)}`);

    // ===== KEY INSIGHTS =====
    console.log("\n" + "=".repeat(80));
    console.log("KEY INSIGHTS");
    console.log("=".repeat(80) + "\n");

    const inUseCount = statusesSorted.find((s) => s.name.includes("In Use"))?.count || 0;
    const inUsePercentage = ((inUseCount / totalAssets) * 100).toFixed(1);

    console.log(`✓ ${inUsePercentage}% of assets are currently "In Use" (${inUseCount.toLocaleString()} assets)`);

    const largestForm = formsSorted[0];
    const largestFormPercentage = ((largestForm.count / totalAssets) * 100).toFixed(1);
    console.log(
      `✓ Largest form category: "${largestForm.name}" with ${largestForm.count.toLocaleString()} assets (${largestFormPercentage}%)`
    );

    const largestType = topTypes[0];
    const largestTypePercentage = ((largestType[1] / totalAssets) * 100).toFixed(1);
    console.log(
      `✓ Most common asset type: "${largestType[0]}" with ${largestType[1].toLocaleString()} assets (${largestTypePercentage}%)`
    );

    const dellCount = allAssets.filter((a) => a.ManufacturerName === "Dell Inc.").length;
    const dellPercentage = ((dellCount / totalAssets) * 100).toFixed(1);
    console.log(
      `✓ Dell Inc. dominates with ${dellCount.toLocaleString()} assets (${dellPercentage}% of inventory)`
    );

    const notInUseCount = totalAssets - inUseCount;
    const notInUsePercentage = ((notInUseCount / totalAssets) * 100).toFixed(1);
    console.log(
      `✓ ${notInUsePercentage}% of assets are not in active use (${notInUseCount.toLocaleString()} assets to manage)`
    );

    console.log("\n" + "=".repeat(80));
    console.log("END OF REPORT");
    console.log("=".repeat(80) + "\n");
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

generateAssetReport();
