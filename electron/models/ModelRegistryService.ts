import { v4 as uuidv4 } from 'uuid';
import { SecureCredentials } from '../config/SecureCredentials';
import type { TaskDatabase } from '../config/TaskDatabase';
import {
    DEFAULT_MODEL_ID,
    ModelError,
    PRESET_MODELS,
    type CreateModelInput,
    type ModelRegistryStorage,
    type ProviderProtocol,
    type StoredModelConfig,
} from '../types/models';

export type ProviderConfigDTO = {
    providerId: string;
    providerName: string;
    defaultBaseUrl: string;
    baseUrl: string;
    hasApiKey: boolean;
    protocol: ProviderProtocol;
};

export type ModelConfigDTO = {
    id: string;
    displayName: string;
    providerId: string;
    providerName: string;
    modelId: string;
    protocol: ProviderProtocol;
    isCustom: boolean;
    isConfigured: boolean;
    effectiveBaseUrl: string;
    updatedAt: number;
};

export type ModelRegistryStateDTO = {
    activeModelId: string;
    providers: ProviderConfigDTO[];
    models: ModelConfigDTO[];
    version: number;
};

type ProviderSettingsStorage = Record<string, { baseUrl?: string; updatedAt: number }>;

const KV_KEYS = {
    REGISTRY: 'model_registry_v1',
    PROVIDERS: 'model_provider_settings_v1',
} as const;

function normalizeId(raw: string): string {
    return String(raw || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function defaultRegistryStorage(): ModelRegistryStorage {
    const models: Record<string, StoredModelConfig> = {};
    const now = Date.now();
    for (const m of PRESET_MODELS) {
        models[m.id] = { ...m, updatedAt: now };
    }
    return {
        activeModelId: DEFAULT_MODEL_ID,
        models,
        version: 1,
    };
}

function defaultProviderSettings(): ProviderSettingsStorage {
    const now = Date.now();
    const out: ProviderSettingsStorage = {};
    for (const m of PRESET_MODELS) {
        if (!out[m.providerId]) {
            out[m.providerId] = { baseUrl: m.baseUrl, updatedAt: now };
        }
    }
    return out;
}

export class ModelRegistryService {
    constructor(private db: TaskDatabase) {}

    private ensureDb() {
        if (!this.db) {
            throw new Error('TaskDatabase is not available');
        }
    }

    private loadRegistry(): ModelRegistryStorage {
        this.ensureDb();
        const stored = this.db.getKV<ModelRegistryStorage>(KV_KEYS.REGISTRY);
        if (stored?.models && typeof stored.activeModelId === 'string' && typeof stored.version === 'number') {
            return stored;
        }
        const next = defaultRegistryStorage();
        this.db.setKV(KV_KEYS.REGISTRY, next);
        return next;
    }

    private saveRegistry(next: ModelRegistryStorage) {
        this.ensureDb();
        this.db.setKV(KV_KEYS.REGISTRY, next);
    }

    private loadProviderSettings(): ProviderSettingsStorage {
        this.ensureDb();
        const stored = this.db.getKV<ProviderSettingsStorage>(KV_KEYS.PROVIDERS);
        if (stored && typeof stored === 'object') return stored;
        const next = defaultProviderSettings();
        this.db.setKV(KV_KEYS.PROVIDERS, next);
        return next;
    }

    private saveProviderSettings(next: ProviderSettingsStorage) {
        this.ensureDb();
        this.db.setKV(KV_KEYS.PROVIDERS, next);
    }

    async getState(): Promise<ModelRegistryStateDTO> {
        const registry = this.loadRegistry();
        const providerSettings = this.loadProviderSettings();

        const presetProviderMap = new Map<string, { providerName: string; protocol: ProviderProtocol; baseUrl: string }>();
        for (const m of PRESET_MODELS) {
            if (!presetProviderMap.has(m.providerId)) {
                presetProviderMap.set(m.providerId, { providerName: m.providerName, protocol: m.protocol, baseUrl: m.baseUrl });
            }
        }

        const providerIds = Array.from(
            new Set([
                ...presetProviderMap.keys(),
                ...Object.values(registry.models).map(m => m.providerId).filter(Boolean)
            ])
        );

        const apiKeyFlags = await Promise.all(providerIds.map(async (pid) => ({ pid, has: await SecureCredentials.hasApiKey(pid) })));
        const hasApiKeyByProvider = new Map(apiKeyFlags.map(r => [r.pid, r.has]));

        const providers: ProviderConfigDTO[] = providerIds.map((providerId) => {
            const preset = presetProviderMap.get(providerId);
            const defaultBaseUrl = preset?.baseUrl || '';
            const protocol = preset?.protocol || 'openai';
            const providerName = preset?.providerName || providerId;
            const savedBaseUrl = providerSettings[providerId]?.baseUrl;
            const baseUrl = String(savedBaseUrl || defaultBaseUrl || '').trim().replace(/\/+$/, '');
            return {
                providerId,
                providerName,
                defaultBaseUrl,
                baseUrl,
                hasApiKey: Boolean(hasApiKeyByProvider.get(providerId)),
                protocol,
            };
        }).sort((a, b) => a.providerName.localeCompare(b.providerName));

        const providerNameById = new Map(providers.map(p => [p.providerId, p.providerName]));
        const providerConfigById = new Map(providers.map(p => [p.providerId, p]));

        const models: ModelConfigDTO[] = Object.values(registry.models).map((m) => {
            const p = providerConfigById.get(m.providerId);
            const effectiveBaseUrl = String(p?.baseUrl || m.baseUrl || '').trim().replace(/\/+$/, '');
            const isConfigured = Boolean(p?.hasApiKey) && Boolean(effectiveBaseUrl);
            return {
                id: m.id,
                displayName: m.displayName,
                providerId: m.providerId,
                providerName: providerNameById.get(m.providerId) || m.providerName || m.providerId,
                modelId: m.modelId,
                protocol: m.protocol,
                isCustom: Boolean(m.isCustom),
                isConfigured,
                effectiveBaseUrl,
                updatedAt: m.updatedAt,
            };
        }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        const activeModelId = registry.activeModelId && registry.models[registry.activeModelId]
            ? registry.activeModelId
            : (models[0]?.id || DEFAULT_MODEL_ID);

        if (activeModelId !== registry.activeModelId) {
            this.saveRegistry({ ...registry, activeModelId });
        }

        return {
            activeModelId,
            providers,
            models,
            version: registry.version,
        };
    }

    async setProviderConfig(input: { providerId: string; baseUrl?: string; apiKey?: string; providerName?: string; protocol?: ProviderProtocol }): Promise<void> {
        const providerId = normalizeId(input.providerId);
        if (!providerId) throw new Error('providerId is required');

        const providerSettings = this.loadProviderSettings();
        const baseUrl = typeof input.baseUrl === 'string' ? String(input.baseUrl || '').trim().replace(/\/+$/, '') : undefined;
        providerSettings[providerId] = { baseUrl, updatedAt: Date.now() };
        this.saveProviderSettings(providerSettings);

        if (typeof input.apiKey === 'string') {
            await SecureCredentials.setApiKey(providerId, input.apiKey);
        }

        if (input.providerName || input.protocol) {
            const registry = this.loadRegistry();
            const now = Date.now();
            const models = { ...registry.models };
            for (const m of Object.values(models)) {
                if (m.providerId !== providerId) continue;
                models[m.id] = {
                    ...m,
                    providerName: input.providerName ? String(input.providerName) : m.providerName,
                    protocol: input.protocol || m.protocol,
                    updatedAt: now,
                };
            }
            this.saveRegistry({ ...registry, models });
        }
    }

    async addCustomModel(input: Pick<CreateModelInput, 'providerName' | 'modelId'> & Partial<Pick<CreateModelInput, 'displayName' | 'baseUrl' | 'protocol'>> & { apiKey?: string }): Promise<{ id: string }> {
        const providerName = String(input.providerName || '').trim();
        const modelId = String(input.modelId || '').trim();
        if (!providerName) throw new Error('Provider Name is required');
        if (!modelId) throw new Error('Model ID is required');

        const protocol: ProviderProtocol = input.protocol || 'openai';
        const providerId = normalizeId(providerName);
        const id = `custom-${uuidv4()}`;
        const now = Date.now();

        const registry = this.loadRegistry();
        const model: StoredModelConfig = {
            id,
            displayName: String(input.displayName || modelId),
            providerId,
            providerName,
            modelId,
            baseUrl: String(input.baseUrl || '').trim().replace(/\/+$/, '') || '',
            protocol,
            authType: 'bearer',
            isCustom: true,
            supportsVision: true,
            updatedAt: now,
        };

        this.saveRegistry({
            ...registry,
            models: {
                ...registry.models,
                [id]: model,
            }
        });

        if (typeof input.baseUrl === 'string' && input.baseUrl.trim()) {
            const providerSettings = this.loadProviderSettings();
            providerSettings[providerId] = { baseUrl: String(input.baseUrl).trim().replace(/\/+$/, ''), updatedAt: now };
            this.saveProviderSettings(providerSettings);
        }

        if (typeof input.apiKey === 'string') {
            await SecureCredentials.setApiKey(providerId, input.apiKey);
        }

        return { id };
    }

    async deleteCustomModel(modelId: string): Promise<void> {
        const id = String(modelId || '').trim();
        if (!id) throw new Error('modelId is required');

        const registry = this.loadRegistry();
        const existing = registry.models[id];
        if (!existing) {
            throw new ModelError('模型不存在', 'MODEL_NOT_FOUND');
        }
        if (!existing.isCustom) {
            throw new ModelError('仅允许删除自定义模型', 'INVALID_MODEL_ID');
        }

        const nextModels = { ...registry.models };
        delete nextModels[id];

        const nextActive = registry.activeModelId === id ? DEFAULT_MODEL_ID : registry.activeModelId;
        this.saveRegistry({ ...registry, models: nextModels, activeModelId: nextActive });
    }

    async setActiveModel(modelId: string): Promise<StoredModelConfig> {
        const id = String(modelId || '').trim();
        if (!id) throw new Error('modelId is required');

        const registry = this.loadRegistry();
        const existing = registry.models[id];
        if (!existing) {
            throw new ModelError('模型不存在', 'MODEL_NOT_FOUND');
        }

        if (existing.protocol !== 'openai' && existing.protocol !== 'anthropic') {
            throw new ModelError('该模型协议暂不支持', 'PROTOCOL_NOT_SUPPORTED');
        }

        this.saveRegistry({ ...registry, activeModelId: id });
        return existing;
    }
}

