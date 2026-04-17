import { TdxAuth } from "./dist/auth.js";
import { loadConfig } from "./dist/config.js";

const config = loadConfig();
const auth = new TdxAuth(config);

async function countAssetsByForm() {
  const token = await auth.getToken();
  const baseUrl = config.baseUrl;
  const appId = config.assetsAppId ?? config.appId;

  try {
    const response = await fetch(`${baseUrl}/${appId}/assets/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ MaxResults: 5000 }),
    });

    if (response.ok) {
      const assets = await response.json();
      
      // Count by FormID
      const formCounts = {};
      const formNames = {};
      
      assets.forEach(asset => {
        const formId = asset.FormID;
        const formName = asset.FormName;
        
        if (!formCounts[formId]) {
          formCounts[formId] = 0;
          formNames[formId] = formName;
        }
        formCounts[formId]++;
      });

      console.log("Assets by Form:\n");
      Object.entries(formCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([formId, count]) => {
          console.log(`Form ID ${formId}: ${formNames[formId]}`);
          console.log(`  Count: ${count} assets\n`);
        });

      console.log(`\nTotal Assets: ${assets.length}`);
      console.log(`\nAssets in Form 1773 (Computer Asset Form): ${formCounts[1773] || 0}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

countAssetsByForm();
