/**
 * AgentErrorHandler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentErrorHandler, AgentError } from '../AgentErrorHandler';

// Mock logger
vi.mock('../../utils/logger', () => ({
    logs: {
        agent: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        },
    },
}));

describe('AgentErrorHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isRateLimitError', () => {
        it('should detect 429 errors', () => {
            const error = { status: 429 };
            expect(AgentErrorHandler.isRateLimitError(error)).toBe(true);
        });

        it('should return false for non-429 errors', () => {
            expect(AgentErrorHandler.isRateLimitError({ status: 500 })).toBe(false);
            expect(AgentErrorHandler.isRateLimitError({ status: 401 })).toBe(false);
            expect(AgentErrorHandler.isRateLimitError({})).toBe(false);
        });
    });

    describe('isSensitiveContentError', () => {
        it('should detect 1027 error code', () => {
            const error = { status: 500, message: 'Error 1027: content blocked' };
            expect(AgentErrorHandler.isSensitiveContentError(error)).toBe(true);
        });

        it('should detect sensitive keyword errors', () => {
            const error1 = { status: 500, message: 'new_sensitive content' };
            expect(AgentErrorHandler.isSensitiveContentError(error1)).toBe(true);

            const error2 = { status: 500, message: 'safety_filter triggered' };
            expect(AgentErrorHandler.isSensitiveContentError(error2)).toBe(true);
        });

        it('should return false for non-500 errors', () => {
            const error = { status: 400, message: '1027' };
            expect(AgentErrorHandler.isSensitiveContentError(error)).toBe(false);
        });

        it('should return false when no indicators present', () => {
            const error = { status: 500, message: 'Some other error' };
            expect(AgentErrorHandler.isSensitiveContentError(error)).toBe(false);
        });
    });

    describe('isAuthError', () => {
        it('should detect 401 errors', () => {
            expect(AgentErrorHandler.isAuthError({ status: 401 })).toBe(true);
        });

        it('should detect 403 errors', () => {
            expect(AgentErrorHandler.isAuthError({ status: 403 })).toBe(true);
        });

        it('should return false for other status codes', () => {
            expect(AgentErrorHandler.isAuthError({ status: 400 })).toBe(false);
            expect(AgentErrorHandler.isAuthError({ status: 500 })).toBe(false);
        });
    });

    describe('isNetworkError', () => {
        it('should detect ENOTFOUND errors', () => {
            const error = { message: 'Error: ENOTFOUND api.example.com' };
            expect(AgentErrorHandler.isNetworkError(error)).toBe(true);
        });

        it('should detect ECONNREFUSED errors', () => {
            const error = { message: 'ECONNREFUSED 127.0.0.1:3000' };
            expect(AgentErrorHandler.isNetworkError(error)).toBe(true);
        });

        it('should detect fetch failed errors', () => {
            const error = { message: 'fetch failed' };
            expect(AgentErrorHandler.isNetworkError(error)).toBe(true);
        });

        it('should return false for non-network errors', () => {
            const error = { message: 'Invalid API key' };
            expect(AgentErrorHandler.isNetworkError(error)).toBe(false);
        });
    });

    describe('classifyError', () => {
        it('should classify rate limit errors', () => {
            const result = AgentErrorHandler.classifyError({ status: 429 });
            expect(result.type).toBe('rate_limit');
            expect(result.retryable).toBe(true);
            expect(result.userMessage).toContain('Rate Limit');
        });

        it('should classify auth errors', () => {
            const result = AgentErrorHandler.classifyError({ status: 401 });
            expect(result.type).toBe('auth');
            expect(result.retryable).toBe(false);
            expect(result.userMessage).toContain('鉴权失败');
        });

        it('should classify sensitive content errors', () => {
            const error = { status: 500, message: '1027' };
            const result = AgentErrorHandler.classifyError(error);
            expect(result.type).toBe('sensitive_content');
            expect(result.retryable).toBe(true);
            expect(result.userMessage).toContain('敏感内容');
        });

        it('should classify network errors', () => {
            const error = { message: 'ENOTFOUND' };
            const result = AgentErrorHandler.classifyError(error);
            expect(result.type).toBe('network');
            expect(result.retryable).toBe(true);
            expect(result.userMessage).toContain('网络错误');
        });

        it('should classify validation errors', () => {
            const error = { status: 400, message: 'Invalid input' };
            const result = AgentErrorHandler.classifyError(error);
            expect(result.type).toBe('validation');
            expect(result.retryable).toBe(false);
            expect(result.userMessage).toBe('Invalid input');
        });

        it('should classify unknown errors', () => {
            const error = { message: 'Something went wrong' };
            const result = AgentErrorHandler.classifyError(error);
            expect(result.type).toBe('unknown');
            expect(result.retryable).toBe(false);
        });
    });

    describe('formatErrorMessage', () => {
        it('should return localized error message', () => {
            const error = { status: 429 };
            const message = AgentErrorHandler.formatErrorMessage(error);
            expect(message).toContain('Rate Limit');
        });

        it('should handle unknown errors', () => {
            const error = { message: 'Test error' };
            const message = AgentErrorHandler.formatErrorMessage(error);
            expect(message).toBe('Test error');
        });
    });

    describe('createError', () => {
        it('should create error with status', () => {
            const error = AgentErrorHandler.createError('Test message', 400);
            expect(error.message).toBe('Test message');
            expect(error.status).toBe(400);
            expect(error).toBeInstanceOf(Error);
        });
    });

    describe('buildSensitiveContentRetryMessage', () => {
        it('should return retry message', () => {
            const message = AgentErrorHandler.buildSensitiveContentRetryMessage();
            expect(message).toContain('SYSTEM ERROR');
            expect(message).toContain('1027');
            expect(message).toContain('safety filter');
        });
    });

    describe('handleRateLimit', () => {
        it('should apply exponential backoff', async () => {
            const startTime = Date.now();
            const delay = await AgentErrorHandler.handleRateLimit(0);
            const elapsed = Date.now() - startTime;

            expect(delay).toBe(1000); // Base delay
            expect(elapsed).toBeGreaterThanOrEqual(900); // Allow some tolerance
        });

        it('should cap at max delay', async () => {
            const delay = await AgentErrorHandler.handleRateLimit(10); // Large retry count
            expect(delay).toBe(5000); // Max delay
        }, 10000); // Increase timeout to 10s to accommodate 5s delay
    });
});
