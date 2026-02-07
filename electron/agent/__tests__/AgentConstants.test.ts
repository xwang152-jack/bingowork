/**
 * AgentConstants Tests
 */

import { describe, it, expect } from 'vitest';
import { AGENT_CONSTANTS, SUPPORTED_IMAGE_TYPES, SENSITIVE_CONTENT_INDICATORS } from '../AgentConstants';

describe('AgentConstants', () => {
    describe('AGENT_CONSTANTS', () => {
        it('should have correct history management values', () => {
            expect(AGENT_CONSTANTS.MAX_HISTORY_SIZE).toBe(200);
            expect(AGENT_CONSTANTS.HISTORY_TRIM_THRESHOLD).toBe(0.9);
            expect(AGENT_CONSTANTS.SYSTEM_MESSAGES_TO_KEEP).toBe(3);
        });

        it('should have correct loop control values', () => {
            expect(AGENT_CONSTANTS.MAX_ITERATIONS).toBe(30);
        });

        it('should have correct error recovery values', () => {
            expect(AGENT_CONSTANTS.MAX_SENSITIVE_CONTENT_RETRIES).toBe(3);
        });

        it('should have correct rate limiting values', () => {
            expect(AGENT_CONSTANTS.RATE_LIMIT_BACKOFF_MS).toBe(5000);
            expect(AGENT_CONSTANTS.EXPONENTIAL_BACKOFF_BASE_MS).toBe(1000);
            expect(AGENT_CONSTANTS.EXPONENTIAL_BACKOFF_MAX_MS).toBe(5000);
        });

        it('should have correct input validation values', () => {
            expect(AGENT_CONSTANTS.MAX_IMAGES_PER_MESSAGE).toBe(10);
            expect(AGENT_CONSTANTS.MAX_IMAGE_SIZE_BYTES).toBe(20 * 1024 * 1024);
        });

        it('should have correct memory monitoring values', () => {
            expect(AGENT_CONSTANTS.HIGH_MEMORY_THRESHOLD_MB).toBe(500);
        });

        it('should have correct token limits', () => {
            expect(AGENT_CONSTANTS.DEFAULT_MAX_TOKENS).toBe(4096);
        });
    });

    describe('SUPPORTED_IMAGE_TYPES', () => {
        it('should include common image types', () => {
            expect(SUPPORTED_IMAGE_TYPES).toContain('image/jpeg');
            expect(SUPPORTED_IMAGE_TYPES).toContain('image/png');
            expect(SUPPORTED_IMAGE_TYPES).toContain('image/gif');
            expect(SUPPORTED_IMAGE_TYPES).toContain('image/webp');
        });

        it('should have correct length', () => {
            expect(SUPPORTED_IMAGE_TYPES).toHaveLength(4);
        });
    });

    describe('SENSITIVE_CONTENT_INDICATORS', () => {
        it('should include error code 1027', () => {
            expect(SENSITIVE_CONTENT_INDICATORS).toContain('1027');
        });

        it('should include sensitive content keywords', () => {
            expect(SENSITIVE_CONTENT_INDICATORS).toContain('sensitive');
            expect(SENSITIVE_CONTENT_INDICATORS).toContain('new_sensitive');
            expect(SENSITIVE_CONTENT_INDICATORS).toContain('content_filter');
            expect(SENSITIVE_CONTENT_INDICATORS).toContain('safety_filter');
        });
    });
});
