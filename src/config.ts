import dotenv from "dotenv";

dotenv.config();

export interface TdxConfig {
  baseUrl: string;
  beid: string;
  webServicesKey: string;
  appId: number;
  assetsAppId?: number;
  kbAppId?: number;
}

export interface MaxResultsLimits {
  withFilter: number;      // Max results when date filters present
  withoutFilter: number;   // Max results when no filters
  counts: number;          // Max results for counts/preview
}

export function loadConfig(): TdxConfig {
  const baseUrl = process.env.TDX_BASE_URL;
  const beid = process.env.TDX_BEID;
  const webServicesKey = process.env.TDX_WEB_SERVICES_KEY;
  const appIdStr = process.env.TDX_APP_ID;
  const assetsAppIdStr = process.env.TDX_ASSETS_APP_ID;
  const kbAppIdStr = process.env.TDX_KB_APP_ID;

  if (!baseUrl) {
    console.error("[CONFIG] FATAL: TDX_BASE_URL environment variable is not set");
    console.error("[CONFIG] Required environment variables:");
    console.error("[CONFIG]   - TDX_BASE_URL (e.g., https://yourorg.teamdynamix.com/TDWebApi/api)");
    console.error("[CONFIG]   - TDX_BEID (Business Entity ID)");
    console.error("[CONFIG]   - TDX_WEB_SERVICES_KEY (Web Services API Key)");
    console.error("[CONFIG]   - TDX_APP_ID (integer, default ticket app ID)");
    throw new Error("TDX_BASE_URL is required");
  }
  if (!beid) {
    console.error("[CONFIG] FATAL: TDX_BEID environment variable is not set");
    throw new Error("TDX_BEID is required");
  }
  if (!webServicesKey) {
    console.error("[CONFIG] FATAL: TDX_WEB_SERVICES_KEY environment variable is not set");
    throw new Error("TDX_WEB_SERVICES_KEY is required");
  }
  if (!appIdStr) {
    console.error("[CONFIG] FATAL: TDX_APP_ID environment variable is not set");
    throw new Error("TDX_APP_ID is required");
  }

  const appId = parseInt(appIdStr, 10);
  if (isNaN(appId)) {
    console.error("[CONFIG] FATAL: TDX_APP_ID must be an integer");
    console.error("[CONFIG] Received:", appIdStr);
    throw new Error("TDX_APP_ID must be an integer");
  }

  let assetsAppId: number | undefined;
  if (assetsAppIdStr) {
    assetsAppId = parseInt(assetsAppIdStr, 10);
    if (isNaN(assetsAppId)) {
      console.error("[CONFIG] FATAL: TDX_ASSETS_APP_ID must be an integer");
      console.error("[CONFIG] Received:", assetsAppIdStr);
      throw new Error("TDX_ASSETS_APP_ID must be an integer");
    }
  }

  let kbAppId: number | undefined;
  if (kbAppIdStr) {
    kbAppId = parseInt(kbAppIdStr, 10);
    if (isNaN(kbAppId)) {
      console.error("[CONFIG] FATAL: TDX_KB_APP_ID must be an integer");
      console.error("[CONFIG] Received:", kbAppIdStr);
      throw new Error("TDX_KB_APP_ID must be an integer");
    }
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), beid, webServicesKey, appId, assetsAppId, kbAppId };
}

/**
 * Load maxResults limits from environment variables
 * Defaults are Teams-friendly (lower) to prevent ConversationStateTooLarge errors
 */
export function loadMaxResultsLimits(): MaxResultsLimits {
  return {
    // With date filters: default 300 (down from 5000 to avoid Teams state overflow)
    withFilter: parseInt(process.env.TDX_MAX_RESULTS_WITH_FILTER || '300', 10),
    // Without filters: default 50 (down from 100)
    withoutFilter: parseInt(process.env.TDX_MAX_RESULTS_WITHOUT_FILTER || '50', 10),
    // Counts tool: default 100 (down from 200)
    counts: parseInt(process.env.TDX_MAX_RESULTS_COUNTS || '100', 10),
  };
}
