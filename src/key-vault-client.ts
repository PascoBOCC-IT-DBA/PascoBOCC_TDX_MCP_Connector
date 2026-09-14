import { SecretClient } from "@azure/keyvault-secrets";
import { DefaultAzureCredential } from "@azure/identity";

/**
 * KeyVaultClient handles fetching secrets from Azure Key Vault
 * Uses Managed Identity (SystemAssigned) for authentication when running on App Service
 * Falls back to environment variables for local development
 */
export class KeyVaultClient {
  private secretClient: SecretClient | null = null;
  private secretCache: Map<string, { value: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Initialize the Key Vault client
   * @param keyVaultUrl - Full URL to the Key Vault (e.g., https://kv-tdx-mcp-abc123.vault.azure.net/)
   */
  constructor(keyVaultUrl: string | null) {
    if (keyVaultUrl) {
      try {
        const credential = new DefaultAzureCredential();
        this.secretClient = new SecretClient(keyVaultUrl, credential);
        console.log(`[KeyVault] Client initialized for: ${keyVaultUrl}`);
      } catch (error) {
        console.error(`[KeyVault] Failed to initialize client: ${error}`);
      }
    } else {
      console.warn("[KeyVault] No Key Vault URL provided, falling back to environment variables");
    }
  }

  /**
   * Fetch a secret from Key Vault or cache, with fallback to environment variable
   * @param secretName - Name of the secret in Key Vault
   * @param envVarName - Optional environment variable to fall back to
   * @returns The secret value
   */
  async getSecret(secretName: string, envVarName?: string): Promise<string> {
    // Try cache first
    const cached = this.secretCache.get(secretName);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      console.log(`[KeyVault] Using cached secret: ${secretName}`);
      return cached.value;
    }

    // Try Key Vault
    if (this.secretClient) {
      try {
        console.log(`[KeyVault] Fetching secret: ${secretName}`);
        const secret = await this.secretClient.getSecret(secretName);
        if (secret.value) {
          // Cache the result
          this.secretCache.set(secretName, { value: secret.value, timestamp: Date.now() });
          console.log(`[KeyVault] ✅ Secret fetched and cached: ${secretName}`);
          return secret.value;
        }
      } catch (error) {
        console.error(`[KeyVault] Failed to fetch ${secretName}: ${error}`);
        // Fall through to environment variable
      }
    }

    // Fall back to environment variable
    if (envVarName) {
      const envValue = process.env[envVarName];
      if (envValue) {
        console.log(`[KeyVault] Using environment variable for: ${secretName} (${envVarName})`);
        return envValue;
      }
    }

    throw new Error(
      `Secret not found: ${secretName}. Neither Key Vault nor environment variable ${envVarName} is available`
    );
  }

  /**
   * Clear the cache (useful for testing or when secrets are rotated)
   */
  clearCache(): void {
    this.secretCache.clear();
    console.log("[KeyVault] Cache cleared");
  }

  /**
   * Check if Key Vault client is available
   */
  isAvailable(): boolean {
    return this.secretClient !== null;
  }
}
