import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { SecureCredentials } from './SecureCredentials';

export interface ToolPermission {
    tool: string;           // 'write_file', 'run_command', etc.
    pathPattern?: string;   // Optional: specific path or '*' for all
    grantedAt: number;      // Timestamp
}

export type ApiProvider = 'anthropic' | 'openai' | 'minimax';
export type WorkMode = 'chat' | 'code' | 'cowork';

export type LLMProfile = {
    model: string;
    provider: ApiProvider;
    apiUrl: string;
    updatedAt: number;
};

export interface AppConfig {
    provider: ApiProvider;
    // Note: apiKey and apiKeys are deprecated in the config file
    // They are now stored securely using the system keychain
    apiKey?: string; // @deprecated - for backward compatibility only
    apiKeys?: Record<string, string>; // @deprecated - for backward compatibility only
    apiUrl: string;
    model: string;
    modelHistory: string[];
    llmProfiles: LLMProfile[];
    authorizedFolders: string[];
    networkAccess: boolean;
    browserAccess: boolean;
    shortcut: string;
    allowedPermissions: ToolPermission[];
    workMode: WorkMode;
}

const defaults: AppConfig = {
    provider: 'anthropic',
    apiKey: '', // @deprecated
    apiKeys: {  // @deprecated
        anthropic: '',
        openai: '',
        minimax: ''
    },
    apiUrl: 'https://open.bigmodel.cn/api/anthropic',
    model: 'glm-4.7',
    modelHistory: ['glm-4.7'],
    llmProfiles: [
        {
            model: 'glm-4.7',
            provider: 'anthropic',
            apiUrl: 'https://open.bigmodel.cn/api/anthropic',
            updatedAt: 0
        }
    ],
    authorizedFolders: [],
    networkAccess: true, // "Open and use" implies network should be on
    browserAccess: false, // Disabled by default, requires agent-browser install
    shortcut: 'Alt+Space',
    allowedPermissions: [],
    workMode: 'cowork'
};

/**
 * Flag to track if migration has been performed
 * Stored in userData to avoid re-migrating on every startup
 */
const MIGRATION_FLAG_FILE = 'bingowork-migration-complete';

class ConfigStore {
    private data: AppConfig;
    private configPath: string;
    private migrationFlagPath: string;
    private secureCredentialsReady: boolean = false;

    constructor() {
        let userDataPath: string;

        if (process.env.VITE_DEV_SERVER_URL) {
            // Development mode
            const cwd = path.join(process.cwd(), 'local-data', 'electron-userdata');
            if (!fs.existsSync(cwd)) {
                fs.mkdirSync(cwd, { recursive: true });
            }
            userDataPath = cwd;
        } else {
            // Production mode
            userDataPath = app.getPath('userData');
        }

        this.configPath = path.join(userDataPath, 'bingowork-config.json');
        this.migrationFlagPath = path.join(userDataPath, MIGRATION_FLAG_FILE);

        // Load existing config or create new
        if (fs.existsSync(this.configPath)) {
            try {
                const content = fs.readFileSync(this.configPath, 'utf-8');
                const loadedData = JSON.parse(content);
                this.data = { ...defaults, ...loadedData };

                // Migrate API keys to secure storage on first load
                this.migrateApiKeysIfNeeded().catch(err => {
                    console.error('[ConfigStore] Failed to migrate API keys:', err);
                });
            } catch (e) {
                this.data = { ...defaults };
            }
        } else {
            this.data = { ...defaults };
            this.save();
        }

        // Mark secure credentials as ready
        this.secureCredentialsReady = true;
    }

    /**
     * Migrate existing plain text API keys to secure storage
     * This is a one-time operation that runs on startup
     */
    private async migrateApiKeysIfNeeded(): Promise<void> {
        // Check if migration has already been performed
        if (fs.existsSync(this.migrationFlagPath)) {
            console.log('[ConfigStore] API key migration already completed');
            return;
        }

        console.log('[ConfigStore] Starting API key migration to secure storage...');

        // Get all API keys from config
        const apiKeys = this.data.apiKeys || {};
        const legacyApiKey = this.data.apiKey || '';

        // Build the complete list of keys to migrate
        const keysToMigrate: Record<string, string> = { ...apiKeys };

        // Include legacy apiKey for anthropic if it exists and is not empty
        if (legacyApiKey && (!apiKeys.anthropic || apiKeys.anthropic === '')) {
            keysToMigrate.anthropic = legacyApiKey;
        }

        // Migrate all keys to secure storage
        await SecureCredentials.migrateApiKeys(keysToMigrate);

        // Clear API keys from config (keep empty structure for backward compatibility)
        this.data.apiKey = '';
        this.data.apiKeys = {
            anthropic: '',
            openai: '',
            minimax: ''
        };
        this.save();

        // Mark migration as complete
        fs.writeFileSync(this.migrationFlagPath, Date.now().toString(), 'utf-8');
        console.log('[ConfigStore] API key migration completed successfully');
    }

    private save(): void {
        // Ensure API keys are never written to disk in plain text
        const dataToSave = {
            ...this.data,
            apiKey: '', // Always empty - stored in keychain
            apiKeys: {  // Always empty - stored in keychain
                anthropic: '',
                openai: '',
                minimax: ''
            }
        };
        fs.writeFileSync(this.configPath, JSON.stringify(dataToSave, null, 2), 'utf-8');
    }

    private normalizeAuthorizedFolder(folder: string): string | null {
        const raw = String(folder || '').trim().replace(/^["']|["']$/g, '');
        if (!raw) return null;
        const resolved = path.resolve(raw);
        const root = path.parse(resolved).root;
        if (resolved === root) return null;
        return resolved;
    }

    private normalizeAuthorizedFolders(folders: string[]): string[] {
        const out: string[] = [];
        for (const f of folders || []) {
            const normalized = this.normalizeAuthorizedFolder(f);
            if (!normalized) continue;
            if (!out.includes(normalized)) out.push(normalized);
        }
        return out;
    }

    get<K extends keyof AppConfig>(key: K): AppConfig[K] {
        return this.data[key];
    }

    set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
        this.data[key] = value;
        this.save();
    }

    getAll(): AppConfig {
        return this.data;
    }

    // =====================================================
    // API Key Management - Now using Secure Credentials
    // =====================================================

    /**
     * Get API key from secure storage
     * @param provider - The API provider (defaults to current provider)
     * @returns The API key or empty string if not found
     */
    async getApiKey(provider?: ApiProvider): Promise<string> {
        const p = provider || this.getProvider();

        // Priority 1: Secure storage (keychain)
        if (this.secureCredentialsReady) {
            const secureKey = await SecureCredentials.getApiKey(p);
            if (secureKey) {
                return secureKey;
            }
        }

        // Priority 2: Environment variable (for development and testing)
        if (p === 'anthropic') {
            const envKey = process.env.ANTHROPIC_API_KEY;
            if (envKey && envKey.trim()) {
                return envKey;
            }
        }

        return '';
    }

    /**
     * @deprecated Use async getApiKey() instead. This method exists only for backward compatibility.
     * Note: This only checks environment variables and returns empty string for secure storage.
     */
    getApiKeySync(provider?: ApiProvider): string {
        console.warn('[ConfigStore] getApiKeySync is deprecated. Use async getApiKey() instead.');
        const p = provider || this.getProvider();

        // Try environment variable for anthropic (legacy support)
        if (p === 'anthropic') {
            const envKey = process.env.ANTHROPIC_API_KEY;
            if (envKey) {
                return envKey;
            }
        }

        // Return empty string - async version should be used for secure storage
        return '';
    }

    /**
     * Set API key in secure storage
     * @param key - The API key to store
     * @param provider - The API provider (defaults to current provider)
     */
    async setApiKey(key: string, provider?: ApiProvider): Promise<void> {
        const p = provider || this.getProvider();

        // Store in secure storage
        if (this.secureCredentialsReady) {
            await SecureCredentials.setApiKey(p, key);
        }

        // Note: No longer storing in config file
        // Keep the in-memory object for backward compatibility but don't persist
        if (this.data.apiKeys) {
            this.data.apiKeys[p] = ''; // Always empty in memory
        }
        if (p === 'anthropic') {
            this.data.apiKey = ''; // Always empty in memory
        }
    }

    /**
     * Delete API key from secure storage
     * @param provider - The API provider
     */
    async deleteApiKey(provider: ApiProvider): Promise<void> {
        if (this.secureCredentialsReady) {
            await SecureCredentials.deleteApiKey(provider);
        }
    }

    /**
     * Check if an API key exists in secure storage
     * @param provider - The API provider
     */
    async hasApiKey(provider: ApiProvider): Promise<boolean> {
        if (this.secureCredentialsReady) {
            return await SecureCredentials.hasApiKey(provider);
        }
        return false;
    }

    // =====================================================
    // Model Management
    // =====================================================

    getModel(): string {
        const stored = this.data.model;
        const envModel = process.env.VITE_MODEL_NAME;
        if (envModel && stored === defaults.model) return envModel;
        return stored || envModel || defaults.model;
    }

    setModel(model: string): void {
        const normalized = String(model || '').trim();
        if (!normalized) return;
        this.data.model = normalized;
        this.addModelToHistory(normalized);
        this.save();
    }

    getModelHistory(): string[] {
        const list = this.data.modelHistory || [];
        const normalized = Array.from(
            new Set(
                [this.getModel(), ...list].filter(Boolean)
            )
        );
        if (normalized.join(',') !== list.join(',')) {
            this.data.modelHistory = normalized;
            this.save();
        }
        return normalized;
    }

    addModelToHistory(model: string): void {
        const normalized = String(model || '').trim();
        if (!normalized) return;
        const list = this.data.modelHistory || [];
        const filtered = list.filter(m => m !== normalized);
        this.data.modelHistory = [normalized, ...filtered].slice(0, 20);
        this.save();
    }

    // LLM Profiles
    getLLMProfiles(): LLMProfile[] {
        return this.data.llmProfiles || [];
    }

    addLLMProfile(profile: LLMProfile): void {
        const profiles = this.getLLMProfiles();
        const existing = profiles.findIndex(p => p.model === profile.model);
        if (existing >= 0) {
            profiles[existing] = profile;
        } else {
            profiles.push(profile);
        }
        this.data.llmProfiles = profiles.slice(0, 20).sort((a, b) => b.updatedAt - a.updatedAt);
        this.save();
    }

    recordCurrentLLMProfile(): void {
        const profile: LLMProfile = {
            model: this.getModel(),
            provider: this.getProvider(),
            apiUrl: this.getApiUrl(),
            updatedAt: Date.now(),
        };
        this.addLLMProfile(profile);
    }

    // =====================================================
    // Provider Management
    // =====================================================

    getProvider(): ApiProvider {
        return this.data.provider || 'anthropic';
    }

    setProvider(provider: ApiProvider): void {
        this.data.provider = provider;
        this.save();
    }

    // API URL
    getApiUrl(): string {
        return this.data.apiUrl || defaults.apiUrl;
    }

    setApiUrl(url: string): void {
        this.data.apiUrl = String(url || '').trim();
        this.save();
    }

    // =====================================================
    // Authorized Folders Management
    // =====================================================

    getAuthorizedFolders(): string[] {
        return this.normalizeAuthorizedFolders(this.data.authorizedFolders || []);
    }

    addAuthorizedFolder(folder: string): void {
        const normalized = this.normalizeAuthorizedFolder(folder);
        if (!normalized) return;
        const folders = this.getAuthorizedFolders();
        if (!folders.includes(normalized)) {
            this.data.authorizedFolders = [...folders, normalized];
            this.save();
        }
    }

    removeAuthorizedFolder(folder: string): void {
        const normalized = this.normalizeAuthorizedFolder(folder);
        if (!normalized) return;
        const folders = this.getAuthorizedFolders().filter(f => f !== normalized);
        this.data.authorizedFolders = folders;
        this.save();
    }

    setAuthorizedFolders(folders: string[]): void {
        this.data.authorizedFolders = this.normalizeAuthorizedFolders(folders);
        this.save();
    }

    // =====================================================
    // Network Access Management
    // =====================================================

    getNetworkAccess(): boolean {
        return this.data.networkAccess !== undefined ? this.data.networkAccess : true;
    }

    setNetworkAccess(enabled: boolean): void {
        this.data.networkAccess = enabled;
        this.save();
    }

    // =====================================================
    // Browser Access Management
    // =====================================================

    getBrowserAccess(): boolean {
        return this.data.browserAccess || false;
    }

    setBrowserAccess(enabled: boolean): void {
        this.data.browserAccess = enabled;
        this.save();
    }

    // =====================================================
    // Shortcut Management
    // =====================================================

    getShortcut(): string {
        return this.data.shortcut || 'Alt+Space';
    }

    setShortcut(shortcut: string): void {
        this.data.shortcut = String(shortcut || '').trim() || 'Alt+Space';
        this.save();
    }

    findLLMProfileByModel(model: string): LLMProfile | undefined {
        return this.getLLMProfiles().find(p => p.model === model);
    }

    // =====================================================
    // Tool Permissions Management
    // =====================================================

    hasPermission(tool: string, pathPattern?: string): boolean {
        const permissions = this.data.allowedPermissions || [];
        return permissions.some(p =>
            p.tool === tool && (!pathPattern || p.pathPattern === pathPattern || p.pathPattern === '*')
        );
    }

    grantPermission(tool: string, pathPattern?: string): void {
        const permissions = this.data.allowedPermissions || [];
        const existing = permissions.findIndex(p =>
            p.tool === tool && p.pathPattern === pathPattern
        );
        if (existing >= 0) {
            permissions[existing].grantedAt = Date.now();
        } else {
            permissions.push({ tool, pathPattern, grantedAt: Date.now() });
        }
        this.data.allowedPermissions = permissions;
        this.save();
    }

    // Alias for compatibility
    addPermission(tool: string, pathPattern?: string): void {
        this.grantPermission(tool, pathPattern);
    }

    revokePermission(tool: string, pathPattern?: string): void {
        const permissions = this.data.allowedPermissions || [];
        this.data.allowedPermissions = permissions.filter(p =>
            !(p.tool === tool && (!pathPattern || p.pathPattern === pathPattern))
        );
        this.save();
    }

    // Alias for compatibility
    removePermission(tool: string, pathPattern?: string): void {
        this.revokePermission(tool, pathPattern);
    }

    clearPermissions(): void {
        this.data.allowedPermissions = [];
        this.save();
    }

    // Alias for compatibility
    clearAllPermissions(): void {
        this.clearPermissions();
    }

    getPermissions(): ToolPermission[] {
        return this.data.allowedPermissions || [];
    }

    // Alias for compatibility
    getAllowedPermissions(): ToolPermission[] {
        return this.getPermissions();
    }

    // =====================================================
    // Utility Methods
    // =====================================================

    /**
     * Get effective config for external use
     * Note: API keys are not included for security
     */
    getEffectiveConfig(): AppConfig {
        return {
            ...this.data,
            apiKey: '', // Never include actual API key
            authorizedFolders: this.getAuthorizedFolders(),
        };
    }

    /**
     * Bulk update configuration
     */
    update(config: Partial<AppConfig>): void {
        if (config.authorizedFolders) {
            config.authorizedFolders = this.normalizeAuthorizedFolders(config.authorizedFolders);
        }
        // Never update API keys through bulk update - use setApiKey instead
        const { apiKey, apiKeys, ...safeConfig } = config as any;
        this.data = { ...this.data, ...safeConfig };
        this.save();
    }

    /**
     * Reset to defaults
     * Note: This does not clear API keys from secure storage
     * Use deleteApiKey() for each provider to clear secure storage
     */
    reset(): void {
        this.data = { ...defaults };
        this.save();
    }

    /**
     * Clear all API keys from secure storage
     * Use with caution
     */
    async clearAllApiKeys(): Promise<void> {
        if (this.secureCredentialsReady) {
            await SecureCredentials.clearAllApiKeys();
        }
    }
}

export const configStore = new ConfigStore();
