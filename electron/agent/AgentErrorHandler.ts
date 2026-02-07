/**
 * Agent Error Handler
 * 
 * Centralized error handling logic for the Agent system.
 * Extracted from AgentRuntime.ts to eliminate code duplication.
 */

import { logs } from '../utils/logger';
import { AGENT_CONSTANTS, SENSITIVE_CONTENT_INDICATORS } from './AgentConstants';

/**
 * Extended error interface for Agent errors
 */
export interface AgentError extends Error {
    status?: number;
}

/**
 * Error classification result
 */
export interface ErrorClassification {
    type: 'rate_limit' | 'auth' | 'sensitive_content' | 'network' | 'validation' | 'unknown';
    retryable: boolean;
    userMessage: string;
}

/**
 * AgentErrorHandler provides static utilities for error handling
 * across the Agent system, eliminating duplicated error handling code.
 */
export class AgentErrorHandler {
    /**
     * Check if an error is a rate limit error (429)
     */
    static isRateLimitError(error: unknown): boolean {
        const err = error as { status?: number };
        return err.status === 429;
    }

    /**
     * Handle rate limit with exponential backoff
     * @returns The delay in milliseconds that was applied
     */
    static async handleRateLimit(retryCount: number = 0): Promise<number> {
        const baseDelay = AGENT_CONSTANTS.EXPONENTIAL_BACKOFF_BASE_MS;
        const maxDelay = AGENT_CONSTANTS.EXPONENTIAL_BACKOFF_MAX_MS;
        const backoffDelay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

        logs.agent.info(`[AgentErrorHandler] Rate limit hit, waiting ${backoffDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));

        return backoffDelay;
    }

    /**
     * Check if an error is a sensitive content error (e.g., MiniMax 1027)
     * More robust than simple string matching
     */
    static isSensitiveContentError(error: unknown): boolean {
        const err = error as { status?: number; message?: string };
        if (err.status !== 500) return false;

        const errorStr = JSON.stringify(error);
        const messageStr = String(err.message || '');

        return SENSITIVE_CONTENT_INDICATORS.some(indicator =>
            messageStr.toLowerCase().includes(indicator) ||
            errorStr.toLowerCase().includes(indicator)
        );
    }

    /**
     * Check if an error is an authentication/authorization error
     */
    static isAuthError(error: unknown): boolean {
        const err = error as { status?: number };
        return err.status === 401 || err.status === 403;
    }

    /**
     * Check if an error is a network error
     */
    static isNetworkError(error: unknown): boolean {
        const err = error as { message?: string };
        const message = String(err.message || '');
        return /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|network/i.test(message);
    }

    /**
     * Classify an error and get handling information
     */
    static classifyError(error: unknown): ErrorClassification {
        if (this.isRateLimitError(error)) {
            return {
                type: 'rate_limit',
                retryable: true,
                userMessage: '请求过于频繁（Rate Limit），请稍后重试。'
            };
        }

        if (this.isAuthError(error)) {
            return {
                type: 'auth',
                retryable: false,
                userMessage: '鉴权失败：API Key 无效、已过期或未配置，请在设置中重新填写。'
            };
        }

        if (this.isSensitiveContentError(error)) {
            return {
                type: 'sensitive_content',
                retryable: true,
                userMessage: '供应商返回敏感内容拦截（1027），请修改输入或稍后重试。'
            };
        }

        if (this.isNetworkError(error)) {
            return {
                type: 'network',
                retryable: true,
                userMessage: '网络错误：请检查 Base URL 是否正确、网络是否可用。'
            };
        }

        const err = error as { status?: number; message?: string };
        if (err.status === 400 && err.message) {
            return {
                type: 'validation',
                retryable: false,
                userMessage: err.message
            };
        }

        return {
            type: 'unknown',
            retryable: false,
            userMessage: String(err.message || error) || '发生未知错误'
        };
    }

    /**
     * Format error for user display (Chinese localized)
     */
    static formatErrorMessage(error: unknown): string {
        return this.classifyError(error).userMessage;
    }

    /**
     * Create an AgentError with status code
     */
    static createError(message: string, status: number): AgentError {
        const error: AgentError = new Error(message);
        error.status = status;
        return error;
    }

    /**
     * Build the sensitive content retry message for the Agent
     */
    static buildSensitiveContentRetryMessage(): string {
        return `[SYSTEM ERROR] Your previous response was blocked by the safety filter (Error Code 1027: output new_sensitive). 

This usually means the generated content contained sensitive, restricted, or unsafe material.

Please generate a NEW response that:
1. Addresses the user's request safely.
2. Avoids the sensitive topic or phrasing that triggered the block.
3. Acknowledges the issue briefly if necessary.`;
    }
}
