import { TdxClient } from "./tdx-client.js";

export interface AssetBatchResult {
  totalAssets: number;
  assetsByForm: Record<string, { name: string; count: number }>;
  assetsByStatus: Record<string, { name: string; count: number }>;
  allAssets: any[];
  batchesExecuted: number;
  batchesWithResults: number;
}

export class AssetBatcher {
  constructor(private client: TdxClient) {}

  /**
   * Retrieves all assets using Form × Status batching to bypass the 10K result limit.
   * @param appId The TDX application ID (defaults to client's appId)
   * @param onProgress Optional callback for progress updates
   * @returns Complete asset inventory with metadata
   */
  async getAllAssets(
    appId?: number,
    onProgress?: (message: string) => void
  ): Promise<AssetBatchResult> {
    const app = appId || this.client.appId;
    const log = onProgress || ((msg: string) => console.log(msg));

    try {
      log("Step 1: Retrieving asset statuses...");
      const statusesResponse = await this.client.get(`/${app}/assets/statuses`);
      const allStatuses = Array.isArray(statusesResponse) ? statusesResponse : [];

      if (allStatuses.length === 0) {
        throw new Error("No asset statuses found");
      }
      log(`  Found ${allStatuses.length} statuses`);

      log("Step 2: Retrieving asset forms...");
      const formsResponse = await this.client.get("/assets/forms");
      const allForms = Array.isArray(formsResponse) ? formsResponse : [];

      if (allForms.length === 0) {
        throw new Error("No asset forms found");
      }
      log(`  Found ${allForms.length} forms`);

      log(
        `Step 3: Creating batches (${allForms.length} forms × ${allStatuses.length} statuses)...`
      );
      const totalBatches = allForms.length * allStatuses.length;
      log(`  Total batches to execute: ${totalBatches}`);

      log("Step 4: Executing parallel batch searches...");
      const allAssets: any[] = [];
      const assetsByForm: Record<
        string,
        { name: string; count: number }
      > = {};
      const assetsByStatus: Record<
        string,
        { name: string; count: number }
      > = {};
      let completedBatches = 0;

      // Create all batch promises
      const batchPromises = [];

      for (const form of allForms) {
        for (const status of allStatuses) {
          const batchPromise = this.client
            .post(`/${app}/assets/search`, {
              FormIDs: [form.ID],
              StatusIDs: [status.ID],
              MaxResults: 10000,
            })
            .then((result) => {
              const assets = Array.isArray(result) ? result : [];
              completedBatches++;

              if (completedBatches % Math.max(1, Math.floor(totalBatches / 10)) === 0) {
                log(`  Progress: ${completedBatches}/${totalBatches} batches`);
              }

              // Track results by form
              if (!assetsByForm[form.ID]) {
                assetsByForm[form.ID] = {
                  name: form.Name || `Form ${form.ID}`,
                  count: 0,
                };
              }
              assetsByForm[form.ID].count += assets.length;

              // Track results by status
              if (!assetsByStatus[status.ID]) {
                assetsByStatus[status.ID] = {
                  name: status.Name || `Status ${status.ID}`,
                  count: 0,
                };
              }
              assetsByStatus[status.ID].count += assets.length;

              return assets;
            })
            .catch((error) => {
              completedBatches++;
              log(
                `  Warning: Batch (Form ${form.ID}, Status ${status.ID}) failed: ${error.message}`
              );
              return [];
            });

          batchPromises.push(batchPromise);
        }
      }

      // Wait for all batches to complete
      const batchResults = await Promise.all(batchPromises);

      // Aggregate all assets
      for (const assets of batchResults) {
        allAssets.push(...assets);
      }

      const batchesWithResults = batchResults.filter((r) => r.length > 0).length;

      log(`\nStep 5: Compilation complete`);
      log(`  Total assets retrieved: ${allAssets.length}`);
      log(`  Batches with results: ${batchesWithResults}/${totalBatches}`);

      return {
        totalAssets: allAssets.length,
        assetsByForm,
        assetsByStatus,
        allAssets,
        batchesExecuted: totalBatches,
        batchesWithResults,
      };
    } catch (error) {
      throw new Error(
        `Failed to retrieve all assets: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Retrieves assets for a specific form using Status batching.
   * Useful when you only need assets from one form type.
   */
  async getAssetsByForm(
    formId: number,
    appId?: number,
    onProgress?: (message: string) => void
  ): Promise<any[]> {
    const app = appId || this.client.appId;
    const log = onProgress || ((msg: string) => console.log(msg));

    try {
      log(`Retrieving asset statuses for form ${formId}...`);
      const statusesResponse = await this.client.get(`/${app}/assets/statuses`);
      const allStatuses = Array.isArray(statusesResponse) ? statusesResponse : [];

      log(`  Found ${allStatuses.length} statuses`);
      log(`  Batching by status...`);

      const allAssets: any[] = [];
      const batchPromises = [];

      for (const status of allStatuses) {
        const batchPromise = this.client
          .post(`/${app}/assets/search`, {
            FormIDs: [formId],
            StatusIDs: [status.ID],
            MaxResults: 10000,
          })
          .then((result) => {
            const assets = Array.isArray(result) ? result : [];
            log(
              `  Status ${status.Name || status.ID}: ${assets.length} assets`
            );
            return assets;
          })
          .catch((error) => {
            log(
              `  Warning: Status ${status.ID} failed: ${error.message}`
            );
            return [];
          });

        batchPromises.push(batchPromise);
      }

      const batchResults = await Promise.all(batchPromises);

      for (const assets of batchResults) {
        allAssets.push(...assets);
      }

      log(`\nTotal assets for form ${formId}: ${allAssets.length}`);

      return allAssets;
    } catch (error) {
      throw new Error(
        `Failed to retrieve assets for form ${formId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Retrieves assets for a specific status across all forms using Form batching.
   * Useful when you need assets in a particular status.
   */
  async getAssetsByStatus(
    statusId: number,
    appId?: number,
    onProgress?: (message: string) => void
  ): Promise<any[]> {
    const app = appId || this.client.appId;
    const log = onProgress || ((msg: string) => console.log(msg));

    try {
      log(`Retrieving asset forms for status ${statusId}...`);
      const formsResponse = await this.client.get("/assets/forms");
      const allForms = Array.isArray(formsResponse) ? formsResponse : [];

      log(`  Found ${allForms.length} forms`);
      log(`  Batching by form...`);

      const allAssets: any[] = [];
      const batchPromises = [];

      for (const form of allForms) {
        const batchPromise = this.client
          .post(`/${app}/assets/search`, {
            FormIDs: [form.ID],
            StatusIDs: [statusId],
            MaxResults: 10000,
          })
          .then((result) => {
            const assets = Array.isArray(result) ? result : [];
            log(`  Form ${form.Name || form.ID}: ${assets.length} assets`);
            return assets;
          })
          .catch((error) => {
            log(`  Warning: Form ${form.ID} failed: ${error.message}`);
            return [];
          });

        batchPromises.push(batchPromise);
      }

      const batchResults = await Promise.all(batchPromises);

      for (const assets of batchResults) {
        allAssets.push(...assets);
      }

      log(`\nTotal assets for status ${statusId}: ${allAssets.length}`);

      return allAssets;
    } catch (error) {
      throw new Error(
        `Failed to retrieve assets for status ${statusId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
