import { TdxAuth } from "./dist/auth.js";
import { TdxClient } from "./dist/tdx-client.js";
import { loadConfig } from "./dist/config.js";

const config = loadConfig();
const client = new TdxClient(config);

async function getAsset() {
  try {
    const appId = parseInt(process.env.TDX_ASSETS_APP_ID);
    const assetId = 760879;
    
    const asset = await client.get(`/${appId}/assets/${assetId}`);
    
    console.log(JSON.stringify(asset, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

getAsset();
