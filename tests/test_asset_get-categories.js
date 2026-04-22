/**
 * Test: Get Asset Categories
 * Description: Retrieves all active asset forms/categories available in your TDX system
 *              using direct API calls. Shows form IDs, names, and metadata.
 */

import { fileURLToPath } from "url";
import { dirname } from "path";
import { TdxAuth } from "../dist/auth.js";
import { loadConfig } from "../dist/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = loadConfig();
const auth = new TdxAuth(config);

async function getAssetCategories() {
  const token = await auth.getToken();
  const baseUrl = config.baseUrl;

  console.log(`=== TDX Asset Categories (Forms) ===\n`);
  try {
    const response = await fetch(`${baseUrl}/assets/forms`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const forms = await response.json();
      console.log(`Total Asset Forms/Categories: ${forms.length}\n`);
      
      forms.forEach((form, index) => {
        console.log(`${index + 1}. ${form.Name}`);
        console.log(`   ID: ${form.ID}`);
        console.log(`   Active: ${form.IsActive}`);
        console.log(`   Is Default: ${form.IsDefaultForApp}`);
        console.log(`   Created: ${form.CreatedDate}`);
        console.log(`   Modified: ${form.ModifiedDate}`);
        console.log();
      });
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

getAssetCategories();
