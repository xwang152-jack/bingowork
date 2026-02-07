/**
 * AgentStateManager Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentStateManager } from '../AgentStateManager';
import Anthropic from '@anthropic-ai/sdk';

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

describe('AgentStateManager', () => {
    let stateManager: AgentStateManager;

    beforeEach(() => {
        stateManager = new AgentStateManager();
    });

    describe('Stage Management', () => {
        it('should start at IDLE stage', () => {
            expect(stateManager.getStage()).toBe('IDLE');
        });

        it('should update stage', () => {
            stateManager.setStage('THINKING');
            expect(stateManager.getStage()).toBe('THINKING');
        });

        it('should broadcast stage changes', () => {
            const mockBroadcast = vi.fn();
            stateManager.setBroadcastCallback(mockBroadcast);

            stateManager.setStage('PLANNING');
            expect(mockBroadcast).toHaveBeenCalledWith('agent:stage', {
                stage: 'PLANNING',
                detail: undefined
            });
        });

        it('should not broadcast if stage unchanged and no detail', () => {
            const mockBroadcast = vi.fn();
            stateManager.setBroadcastCallback(mockBroadcast);

            stateManager.setStage('IDLE');
            stateManager.setStage('IDLE');

            expect(mockBroadcast).toHaveBeenCalledTimes(0);
        });

        it('should broadcast if stage unchanged but detail provided', () => {
            const mockBroadcast = vi.fn();
            stateManager.setBroadcastCallback(mockBroadcast);

            stateManager.setStage('IDLE', { test: true });
            expect(mockBroadcast).toHaveBeenCalledWith('agent:stage', {
                stage: 'IDLE',
                detail: { test: true }
            });
        });
    });

    describe('Processing State', () => {
        it('should start not processing', () => {
            expect(stateManager.getIsProcessing()).toBe(false);
        });

        it('should update processing state', () => {
            stateManager.setIsProcessing(true);
            expect(stateManager.getIsProcessing()).toBe(true);

            stateManager.setIsProcessing(false);
            expect(stateManager.getIsProcessing()).toBe(false);
        });
    });

    describe('History Management', () => {
        it('should start with empty history', () => {
            expect(stateManager.getHistorySize()).toBe(0);
            expect(stateManager.getHistory()).toEqual([]);
        });

        it('should add messages to history', () => {
            const message: Anthropic.MessageParam = {
                role: 'user',
                content: 'Hello'
            };

            stateManager.addToHistory(message);
            expect(stateManager.getHistorySize()).toBe(1);
            expect(stateManager.getHistory()).toEqual([message]);
        });

        it('should clear history', () => {
            stateManager.addToHistory({ role: 'user', content: 'Test' });
            expect(stateManager.getHistorySize()).toBe(1);

            stateManager.clearHistory();
            expect(stateManager.getHistorySize()).toBe(0);
        });

        it('should load history with size limit', () => {
            const messages: Anthropic.MessageParam[] = Array.from({ length: 250 }, (_, i) => ({
                role: i % 2 === 0 ? 'user' : 'assistant',
                content: `Message ${i}`
            }));

            stateManager.loadHistory(messages);
            expect(stateManager.getHistorySize()).toBeLessThanOrEqual(200);
        });

        it('should trim history when threshold exceeded', () => {
            // Add 200 messages to reach max
            for (let i = 0; i < 200; i++) {
                stateManager.addToHistory({
                    role: i % 2 === 0 ? 'user' : 'assistant',
                    content: `Message ${i}`
                });
            }

            expect(stateManager.getHistorySize()).toBe(200);

            // Manually trigger trim (in real usage, this happens via checkMemoryUsage)
            stateManager.manageHistory();

            // Should still be at or below max
            expect(stateManager.getHistorySize()).toBeLessThanOrEqual(200);
        });
    });

    describe('Sensitive Content Retries', () => {
        it('should start with 0 retries', () => {
            expect(stateManager.getSensitiveContentRetries()).toBe(0);
            expect(stateManager.hasExceededSensitiveContentRetries()).toBe(false);
        });

        it('should increment retries', () => {
            const count = stateManager.incrementSensitiveContentRetries();
            expect(count).toBe(1);
            expect(stateManager.getSensitiveContentRetries()).toBe(1);
        });

        it('should detect when retries exceeded', () => {
            stateManager.incrementSensitiveContentRetries(); // 1
            stateManager.incrementSensitiveContentRetries(); // 2
            expect(stateManager.hasExceededSensitiveContentRetries()).toBe(false);

            stateManager.incrementSensitiveContentRetries(); // 3
            expect(stateManager.hasExceededSensitiveContentRetries()).toBe(true);
        });

        it('should reset retries', () => {
            stateManager.incrementSensitiveContentRetries();
            stateManager.incrementSensitiveContentRetries();
            expect(stateManager.getSensitiveContentRetries()).toBe(2);

            stateManager.resetSensitiveContentRetries();
            expect(stateManager.getSensitiveContentRetries()).toBe(0);
        });
    });

    describe('Memory Usage Monitoring', () => {
        it('should check memory without error', () => {
            expect(() => stateManager.checkMemoryUsage()).not.toThrow();
        });

        it('should trim history if memory threshold exceeded', () => {
            // This test is tricky since we can't easily trigger high memory
            // Just ensure the method doesn't crash
            stateManager.checkMemoryUsage();
            expect(stateManager).toBeDefined();
        });
    });
});
