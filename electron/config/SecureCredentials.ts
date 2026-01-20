/**
 * Secure Credentials Storage
 * Provides secure storage for sensitive data like API keys using the system keychain
 */

import keytar from 'keytar';

const SERVICE_NAME = 'com.bingowork.app';

/**
 * Secure credential storage using system keychain
 * - Windows: Credential Manager
 * - macOS: Keychain
 * - Linux: Secret Service API (gnome-keyring/kwallet)
 */
export class SecureCredentials {
  /**
   * Store an API key securely
   * @param provider - The API provider (e.g., 'anthropic', 'openai', 'minimax')
   * @param apiKey - The API key to store
   * @returns Promise that resolves when the key is stored
   */
  static async setApiKey(provider: string, apiKey: string): Promise<boolean> {
    if (!apiKey || apiKey.trim() === '') {
      // Clear the key if empty
      return await this.deleteApiKey(provider);
    }

    try {
      const account = `api-key-${provider}`;
      await keytar.setPassword(SERVICE_NAME, account, apiKey);
      return true;
    } catch (error) {
      console.error(`[SecureCredentials] Failed to store API key for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Retrieve an API key securely
   * @param provider - The API provider (e.g., 'anthropic', 'openai', 'minimax')
   * @returns Promise that resolves with the API key or null if not found
   */
  static async getApiKey(provider: string): Promise<string | null> {
    try {
      const account = `api-key-${provider}`;
      return await keytar.getPassword(SERVICE_NAME, account);
    } catch (error) {
      console.error(`[SecureCredentials] Failed to retrieve API key for ${provider}:`, error);
      return null;
    }
  }

  /**
   * Delete an API key from secure storage
   * @param provider - The API provider (e.g., 'anthropic', 'openai', 'minimax')
   * @returns Promise that resolves to true if the key was deleted
   */
  static async deleteApiKey(provider: string): Promise<boolean> {
    try {
      const account = `api-key-${provider}`;
      return await keytar.deletePassword(SERVICE_NAME, account);
    } catch (error) {
      console.error(`[SecureCredentials] Failed to delete API key for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Check if an API key exists in secure storage
   * @param provider - The API provider (e.g., 'anthropic', 'openai', 'minimax')
   * @returns Promise that resolves to true if the key exists
   */
  static async hasApiKey(provider: string): Promise<boolean> {
    const key = await this.getApiKey(provider);
    return key !== null && key.length > 0;
  }

  /**
   * Migrate API keys from plain text config to secure storage
   * @param plainTextKeys - Object containing provider -> API key mappings
   * @returns Promise that resolves when migration is complete
   */
  static async migrateApiKeys(plainTextKeys: Record<string, string>): Promise<void> {
    for (const [provider, apiKey] of Object.entries(plainTextKeys)) {
      if (apiKey && apiKey.trim() !== '') {
        await this.setApiKey(provider, apiKey);
      }
    }
  }

  /**
   * Clear all API keys from secure storage
   * Use with caution - this is typically used for testing or cleanup
   * @returns Promise that resolves when all keys are cleared
   */
  static async clearAllApiKeys(): Promise<void> {
    const providers = ['anthropic', 'openai', 'minimax'];
    for (const provider of providers) {
      await this.deleteApiKey(provider);
    }
  }

  /**
   * List all accounts (for debugging purposes)
   * @returns Promise that resolves with array of account names
   */
  static async listAccounts(): Promise<string[]> {
    try {
      // Note: keytar doesn't have a built-in list method, but we can check each provider
      const providers = ['anthropic', 'openai', 'minimax'];
      const accounts: string[] = [];
      for (const provider of providers) {
        if (await this.hasApiKey(provider)) {
          accounts.push(`api-key-${provider}`);
        }
      }
      return accounts;
    } catch (error) {
      console.error('[SecureCredentials] Failed to list accounts:', error);
      return [];
    }
  }
}

/**
 * Synchronous wrapper for cases where async is not available
 * Note: This is a fallback and should be avoided when possible
 */
export class SecureCredentialsSync {
  private static cache: Map<string, string> = new Map();

  /**
   * Initialize the sync cache from secure storage
   * Should be called at app startup
   */
  static async initialize(): Promise<void> {
    const providers = ['anthropic', 'openai', 'minimax'];
    for (const provider of providers) {
      const key = await SecureCredentials.getApiKey(provider);
      if (key) {
        this.cache.set(provider, key);
      }
    }
  }

  /**
   * Get API key from cache
   */
  static getApiKey(provider: string): string | null {
    return this.cache.get(provider) || null;
  }

  /**
   * Set API key in cache and secure storage
   */
  static async setApiKey(provider: string, apiKey: string): Promise<void> {
    this.cache.set(provider, apiKey);
    await SecureCredentials.setApiKey(provider, apiKey);
  }

  /**
   * Delete API key from cache and secure storage
   */
  static async deleteApiKey(provider: string): Promise<void> {
    this.cache.delete(provider);
    await SecureCredentials.deleteApiKey(provider);
  }

  /**
   * Clear all cached keys
   */
  static clearCache(): void {
    this.cache.clear();
  }
}
