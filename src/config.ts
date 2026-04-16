export interface TdxConfig {
  baseUrl: string;
  beid: string;
  webServicesKey: string;
  appId: number;
}

export function loadConfig(): TdxConfig {
  const baseUrl = process.env.TDX_BASE_URL;
  const beid = process.env.TDX_BEID;
  const webServicesKey = process.env.TDX_WEB_SERVICES_KEY;
  const appIdStr = process.env.TDX_APP_ID;

  if (!baseUrl) throw new Error("TDX_BASE_URL is required");
  if (!beid) throw new Error("TDX_BEID is required");
  if (!webServicesKey) throw new Error("TDX_WEB_SERVICES_KEY is required");
  if (!appIdStr) throw new Error("TDX_APP_ID is required");

  const appId = parseInt(appIdStr, 10);
  if (isNaN(appId)) throw new Error("TDX_APP_ID must be an integer");

  return { baseUrl: baseUrl.replace(/\/+$/, ""), beid, webServicesKey, appId };
}
