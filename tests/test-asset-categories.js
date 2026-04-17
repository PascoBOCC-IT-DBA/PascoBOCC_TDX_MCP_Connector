import { TdxAuth } from "./dist/auth.js";
import { loadConfig } from "./dist/config.js";

const config = loadConfig();
const auth = new TdxAuth(config);

async function getAssetCategoriesInfo() {
  const token = await auth.getToken();
  const baseUrl = config.baseUrl;
  const appId = config.assetsAppId ?? config.appId;

  const endpoints = [
    `/cmdb/assets/types`,
    `/cmdb/asset/types`,
    `/asset/types`,
    `/${appId}/assets/types`,
    `/${appId}/asset/types`,
    `/forms/search`,
    `/${appId}/forms/search`,
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n=== Trying ${endpoint} ===`);
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
        if (Array.isArray(data) && data.length > 0) {
          console.log(JSON.stringify(data.slice(0, 5), null, 2));
          if (data.length > 5) console.log(`... and ${data.length - 5} more`);
        } else if (typeof data === 'object') {
          console.log(JSON.stringify(data, null, 2));
        }
        break;
      } else {
        console.log(`Status ${response.status}`);
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
}

getAssetCategoriesInfo();
