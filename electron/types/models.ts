/**
 * Model Management Type Definitions
 * Unified schema for multi-vendor LLM model configuration
 */

// ============================================
// Core Model Types
// ============================================

/**
 * Provider protocol type - determines API compatibility
 * - anthropic: Anthropic-compatible API (messages format)
 * - openai: OpenAI-compatible API (chat completions format)
 * - custom: Custom implementation (may require special handling)
 */
export type ProviderProtocol = 'anthropic' | 'openai' | 'custom';

/**
 * Authentication method for API requests
 */
export type AuthType = 'bearer' | 'api-key-header' | 'custom';

/**
 * Model configuration metadata
 * Contains all information needed to connect to and use an LLM model
 */
export interface ModelConfig {
    // Unique identifier for this model configuration
    id: string;

    // Display name shown in UI
    displayName: string;

    // Stable provider identifier (for storage & keychain)
    providerId: string;

    // Provider/Service name (e.g., 'deepseek', 'alibaba', 'moonshot')
    providerName: string;

    // Model identifier passed to API (e.g., 'deepseek-chat', 'qwen-3-235b')
    modelId: string;

    // Base URL for API endpoints
    baseUrl: string;

    // Protocol/API compatibility
    protocol: ProviderProtocol;

    // Authentication type
    authType: AuthType;

    // Whether this model is configured (has API key)
    isConfigured: boolean;

    // Whether this is a user-added custom model
    isCustom: boolean;

    // Optional: Vision capability flag
    supportsVision?: boolean;

    // Optional: Maximum tokens supported
    maxTokens?: number;

    // Optional: Default temperature
    defaultTemperature?: number;

    // Timestamp when this configuration was last updated
    updatedAt: number;
}

/**
 * Active model selection
 * Represents the currently selected model for use
 */
export interface ActiveModelConfig {
    // Model configuration ID
    modelId: string;

    // Provider name (for quick lookup)
    providerId: string;
    providerName: string;

    // Model identifier for API calls
    model: string;

    // Base URL for API calls
    apiUrl: string;

    // Protocol for API compatibility
    protocol: ProviderProtocol;

    // Whether this model supports vision
    supportsVision: boolean;
}

// ============================================
// Preset Model Definitions
// ============================================

/**
 * Preset model configurations
 * These are built-in models that users can configure
 */
export const PRESET_MODELS: Omit<ModelConfig, 'isConfigured' | 'updatedAt'>[] = [
    // DeepSeek
    {
        id: 'deepseek-v3.2',
        displayName: 'DeepSeek-V3.2',
        providerId: 'deepseek',
        providerName: 'DeepSeek',
        modelId: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com/v1',
        protocol: 'openai',
        authType: 'bearer',
        isCustom: false,
        supportsVision: true,
        maxTokens: 8192,
        defaultTemperature: 0.7
    },
    // Alibaba Qwen
    {
        id: 'qwen-3-235b',
        displayName: 'Qwen 3 (235B)',
        providerId: 'alibaba-qwen',
        providerName: 'Alibaba (Qwen)',
        modelId: 'qwen-3-235b',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        protocol: 'openai',
        authType: 'bearer',
        isCustom: false,
        supportsVision: true,
        maxTokens: 8192,
        defaultTemperature: 0.7
    },
    // Moonshot Kimi
    {
        id: 'kimi-k2',
        displayName: 'Kimi K2',
        providerId: 'moonshot-kimi',
        providerName: 'Moonshot',
        modelId: 'kimi-k2',
        baseUrl: 'https://api.moonshot.cn/v1',
        protocol: 'openai',
        authType: 'bearer',
        isCustom: false,
        supportsVision: true,
        maxTokens: 8192,
        defaultTemperature: 0.7
    },
    // ByteDance Doubao
    {
        id: 'doubao-2.0',
        displayName: '豆包-大模型 2.0',
        providerId: 'bytedance-doubao',
        providerName: 'ByteDance',
        modelId: 'doubao-2.0',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        protocol: 'openai',
        authType: 'bearer',
        isCustom: false,
        supportsVision: true,
        maxTokens: 8192,
        defaultTemperature: 0.7
    },
    // Zhipu AI GLM
    {
        id: 'glm-4.7',
        displayName: 'GLM-4.7',
        providerId: 'zhipu-glm',
        providerName: 'Zhipu AI',
        modelId: 'glm-4.7',
        baseUrl: 'https://open.bigmodel.cn/api/anthropic',
        protocol: 'anthropic',
        authType: 'bearer',
        isCustom: false,
        supportsVision: true,
        maxTokens: 8192,
        defaultTemperature: 0.7
    },
    // ModelScope (using DeepSeek)
    {
        id: 'modelscope-deepseek-v3.2',
        displayName: 'DeepSeek-V3.2 (ModelScope)',
        providerId: 'modelscope',
        providerName: 'ModelScope',
        modelId: 'deepseek-chat',
        baseUrl: 'https://api-inference.modelscope.cn/v1',
        protocol: 'openai',
        authType: 'bearer',
        isCustom: false,
        supportsVision: true,
        maxTokens: 8192,
        defaultTemperature: 0.7
    }
];

/**
 * Default model ID (GLM-4.7 for compatibility with existing config)
 */
export const DEFAULT_MODEL_ID = 'deepseek-v3.2';

// ============================================
// Custom Model Input Types
// ============================================

/**
 * Input for creating a custom model configuration
 */
export interface CreateModelInput {
    displayName: string;
    providerId?: string;
    providerName: string;
    modelId: string;
    baseUrl: string;
    protocol: ProviderProtocol;
    authType?: AuthType;
    supportsVision?: boolean;
    maxTokens?: number;
    defaultTemperature?: number;
}

/**
 * Input for updating a model configuration
 */
export interface UpdateModelInput {
    displayName?: string;
    baseUrl?: string;
    modelId?: string;
    protocol?: ProviderProtocol;
    authType?: AuthType;
    supportsVision?: boolean;
    maxTokens?: number;
    defaultTemperature?: number;
}

// ============================================
// Storage Types
// ============================================

/**
 * Stored model configuration (with API key reference)
 * Note: API keys are stored separately in secure storage
 */
export interface StoredModelConfig extends Omit<ModelConfig, 'isConfigured'> {
    // Last updated timestamp
    updatedAt: number;
}

/**
 * Model registry storage format
 */
export interface ModelRegistryStorage {
    // Active model ID
    activeModelId: string;

    // All configured models (presets + custom)
    models: Record<string, StoredModelConfig>;

    // Version for migrations
    version: number;
}

// ============================================
// Error Types
// ============================================

/**
 * Model-specific error types
 */
export class ModelError extends Error {
    constructor(
        message: string,
        public code: 'MODEL_NOT_FOUND' | 'MODEL_NOT_CONFIGURED' | 'INVALID_MODEL_ID' | 'API_KEY_MISSING' | 'PROTOCOL_NOT_SUPPORTED'
    ) {
        super(message);
        this.name = 'ModelError';
    }
}

/**
 * API error types for model requests
 */
export class ModelAPIError extends Error {
    constructor(
        message: string,
        public code: 'API_KEY_INVALID' | 'RATE_LIMIT' | 'NETWORK_ERROR' | 'API_ERROR' | 'AUTH_FAILED',
        public originalError?: unknown
    ) {
        super(message);
        this.name = 'ModelAPIError';
    }
}
