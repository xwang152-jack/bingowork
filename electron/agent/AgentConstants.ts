/**
 * Agent Constants
 * 
 * Centralized constants for the Agent system.
 * Extracted from AgentRuntime.ts to eliminate magic numbers.
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Agent runtime configuration constants
 */
export const AGENT_CONSTANTS = {
    // History management
    MAX_HISTORY_SIZE: 200,
    HISTORY_TRIM_THRESHOLD: 0.9,  // Trigger trim at 90% capacity
    SYSTEM_MESSAGES_TO_KEEP: 3,
    
    // Loop control
    MAX_ITERATIONS: 30,
    
    // Error recovery
    MAX_SENSITIVE_CONTENT_RETRIES: 3,
    
    // Rate limiting
    RATE_LIMIT_BACKOFF_MS: 5000,
    EXPONENTIAL_BACKOFF_BASE_MS: 1000,
    EXPONENTIAL_BACKOFF_MAX_MS: 5000,
    
    // Input validation
    MAX_IMAGES_PER_MESSAGE: 10,
    MAX_IMAGE_SIZE_BYTES: 20 * 1024 * 1024,  // 20MB
    
    // Memory monitoring
    HIGH_MEMORY_THRESHOLD_MB: 500,
    
    // Token limits
    DEFAULT_MAX_TOKENS: 4096,
} as const;

/**
 * Supported image media types
 */
export const SUPPORTED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
] as const;

export type SupportedImageType = typeof SUPPORTED_IMAGE_TYPES[number];

/**
 * Agent stages for the processing loop
 */
export type AgentStage = 'IDLE' | 'THINKING' | 'PLANNING' | 'EXECUTING' | 'FEEDBACK';

/**
 * Sensitive content error indicators
 * Used to detect content filter errors from various providers
 */
export const SENSITIVE_CONTENT_INDICATORS = [
    '1027',
    'sensitive',
    'new_sensitive',
    'content_filter',
    'safety_filter',
] as const;

/**
 * Agent Message Type
 * Extends Anthropic.MessageParam with an optional ID for management
 */
export type AgentMessage = Anthropic.MessageParam & {
    id?: string;
};
