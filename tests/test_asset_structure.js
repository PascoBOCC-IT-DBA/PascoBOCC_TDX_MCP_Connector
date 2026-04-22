/**
 * Test: Asset Data Structure Validation
 * Description: Inspects the data structure and schema of individual asset objects
 *              returned by the TDX API. Shows what properties are available on assets
 *              and validates the response format.
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { TdxAuth } from "./dist/auth.js";
import { loadConfig } from "./dist/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = loadConfig();
const auth = new TdxAuth(config);

async function exploreAssetStructure() {
  const token = await auth.getToken();
  const baseUrl = config.baseUrl;
  const appId = parseInt(process.env.TDX_ASSETS_APP_ID);

  // Try to get a sample asset to understand structure
  console.log(`=== Getting Sample Asset ===`);
  try {
    const response = await fetch(`${baseUrl}/${appId}/assets/1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log("Sample Asset Fields:");
      console.log(JSON.stringify(Object.keys(data), null, 2));
      console.log("\nSample Asset Data:");
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`Status ${response.status}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // Try to get forms
  console.log(`\n=== Trying to get Forms ===`);
  const formEndpoints = [
    `/${appId}/forms`,
    `/forms/${appId}`,
    `/assets/forms`,
  ];

  for (const endpoint of formEndpoints) {
    try {
      console.log(`\nTrying ${endpoint}...`);
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`SUCCESS: Found ${Array.isArray(data) ? data.length : 'data'}`);
        if (Array.isArray(data)) {
          console.log(JSON.stringify(data.slice(0, 3), null, 2));
        }
        break;
      } else {
        console.log(`Status ${response.status}`);
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }

  // Try to search with a sample to see what metadata is returned
  console.log(`\n=== Searching Assets (limit 1) ===`);
  try {
    const response = await fetch(`${baseUrl}/${appId}/assets/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ MaxResults: 1 }),
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log("\nAsset Structure:");
        console.log(JSON.stringify(data[0], null, 2));
      }
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

exploreAssetStructure();
