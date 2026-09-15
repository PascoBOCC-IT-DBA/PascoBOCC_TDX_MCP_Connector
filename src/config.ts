import dotenv from "dotenv";
import { KeyVaultClient } from "./key-vault-client.js";

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
  counts: number;          // Max tickets echoed back in the count tool's preview array
  countScan: number;       // Max tickets the count tool asks TDX for when computing the count
}

/**
 * Load configuration from Azure Key Vault or environment variables
 * Prefers Key Vault for sensitive values when available
 * Falls back to environment variables for local development
 */
export async function loadConfig(): Promise<TdxConfig> {
  // Initialize Key Vault client if KEYVAULT_URL is provided
  const keyVaultUrl = process.env.KEYVAULT_URL;
  const kvClient = new KeyVaultClient(keyVaultUrl || null);

  console.log("[CONFIG] Loading configuration...");
  if (keyVaultUrl) {
    console.log(`[CONFIG] Using Azure Key Vault: ${keyVaultUrl}`);
  } else {
    console.log("[CONFIG] KEYVAULT_URL not set, falling back to environment variables");
  }

  try {
    // Fetch secrets from Key Vault or environment variables
    const baseUrl = await kvClient.getSecret("TdxBaseUrl", "TDX_BASE_URL");
    const beid = await kvClient.getSecret("TdxBeid", "TDX_BEID");
    const webServicesKey = await kvClient.getSecret("TdxWebServicesKey", "TDX_WEB_SERVICES_KEY");
    const appIdStr = await kvClient.getSecret("TdxAppId", "TDX_APP_ID");

    // Optional secrets
    let assetsAppIdStr: string | undefined;
    let kbAppIdStr: string | undefined;

    try {
      assetsAppIdStr = await kvClient.getSecret("TdxAssetsAppId", "TDX_ASSETS_APP_ID");
    } catch {
      console.log("[CONFIG] TdxAssetsAppId not found in Key Vault or environment");
    }

    try {
      kbAppIdStr = await kvClient.getSecret("TdxKbAppId", "TDX_KB_APP_ID");
    } catch {
      console.log("[CONFIG] TdxKbAppId not found in Key Vault or environment");
    }

    // Validate and parse configuration
    if (!baseUrl) {
      console.error("[CONFIG] FATAL: TDX_BASE_URL is required");
      console.error("[CONFIG] Set either KEYVAULT_URL env var for Key Vault or TDX_BASE_URL directly");
      throw new Error("TDX_BASE_URL is required");
    }
    if (!beid) {
      console.error("[CONFIG] FATAL: TDX_BEID is required");
      throw new Error("TDX_BEID is required");
    }
    if (!webServicesKey) {
      console.error("[CONFIG] FATAL: TDX_WEB_SERVICES_KEY is required");
      throw new Error("TDX_WEB_SERVICES_KEY is required");
    }
    if (!appIdStr) {
      console.error("[CONFIG] FATAL: TDX_APP_ID is required");
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

    console.log("[CONFIG] ✅ Configuration loaded successfully");
    return { baseUrl: baseUrl.replace(/\/+$/, ""), beid, webServicesKey, appId, assetsAppId, kbAppId };
  } catch (error) {
    console.error("[CONFIG] ❌ Failed to load configuration:", error);
    throw error;
  }
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
    // Counts tool scan ceiling: only ticket IDs are counted, so this can be far larger
    // than the preview limit without risking a large MCP response.
    countScan: parseInt(process.env.TDX_MAX_RESULTS_COUNT_SCAN || '10000', 10),
  };
}
