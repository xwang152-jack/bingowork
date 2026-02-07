/**
 * Agent State Manager
 * 
 * Manages agent state including stage, history, and memory monitoring.
 * Extracted from AgentRuntime.ts to separate concerns.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logs } from '../utils/logger';
import { AGENT_CONSTANTS, AgentStage } from './AgentConstants';

/**
 * Event sink interface for logging events
 */
export interface AgentEventSink {
    logEvent: (type: string, payload: unknown) => void;
}

/**
 * Callback for broadcasting stage changes
 */
export type StageBroadcastCallback = (channel: string, data: unknown) => void;

/**
 * AgentStateManager handles all state-related logic for the Agent:
 * - Stage transitions (IDLE, THINKING, PLANNING, EXECUTING, FEEDBACK)
 * - History management (storage, trimming, size limits)
 * - Memory usage monitoring
 */
export class AgentStateManager {
    private stage: AgentStage = 'IDLE';
    private history: Anthropic.MessageParam[] = [];
    private isProcessing = false;
    private sensitiveContentRetries = 0;

    private broadcastCallback?: StageBroadcastCallback;
    private eventSink?: AgentEventSink;

    constructor(eventSink?: AgentEventSink) {
        this.eventSink = eventSink;
    }

    /**
     * Set the broadcast callback for stage updates
     */
    setBroadcastCallback(callback: StageBroadcastCallback): void {
        this.broadcastCallback = callback;
    }

    /**
     * Get current stage
     */
    getStage(): AgentStage {
        return this.stage;
    }

    /**
     * Set stage and broadcast the change
     */
    setStage(stage: AgentStage, detail?: unknown): void {
        if (this.stage === stage && detail === undefined) return;
        this.stage = stage;
        this.broadcastCallback?.('agent:stage', { stage, detail });
        this.eventSink?.logEvent('stage', { stage, detail });
    }

    /**
     * Check if currently processing
     */
    getIsProcessing(): boolean {
        return this.isProcessing;
    }

    /**
     * Set processing state
     */
    setIsProcessing(processing: boolean): void {
        this.isProcessing = processing;
    }

    /**
     * Get current history
     */
    getHistory(): Anthropic.MessageParam[] {
        return this.history;
    }

    /**
     * Get history size
     */
    getHistorySize(): number {
        return this.history.length;
    }

    /**
     * Add message to history
     */
    addToHistory(message: Anthropic.MessageParam): void {
        this.history.push(message);
    }

    /**
     * Clear history for new session
     */
    clearHistory(): void {
        this.history = [];
    }

    /**
     * Load history from saved session
     */
    loadHistory(messages: Anthropic.MessageParam[]): void {
        this.history = messages.slice(0, AGENT_CONSTANTS.MAX_HISTORY_SIZE);
    }

    /**
     * Smart history management that preserves important context
     * while keeping memory usage under control
     */
    manageHistory(): void {
        const threshold = AGENT_CONSTANTS.MAX_HISTORY_SIZE * AGENT_CONSTANTS.HISTORY_TRIM_THRESHOLD;
        if (this.history.length <= threshold) {
            return; // Still has room
        }

        const messagesToKeep = AGENT_CONSTANTS.MAX_HISTORY_SIZE - AGENT_CONSTANTS.SYSTEM_MESSAGES_TO_KEEP;
        const oldSize = this.history.length;

        // Preserve beginning (system messages) and end (recent context)
        this.history = [
            ...this.history.slice(0, AGENT_CONSTANTS.SYSTEM_MESSAGES_TO_KEEP),
            ...this.history.slice(-messagesToKeep)
        ];

        logs.agent.info(`[AgentStateManager] History trimmed from ${oldSize} to ${this.history.length} messages`);
    }

    /**
     * Check memory usage and trigger cleanup if needed
     */
    checkMemoryUsage(): void {
        const usage = process.memoryUsage();
        const MB = 1024 * 1024;
        const heapUsedMB = usage.heapUsed / MB;

        // Warn if memory usage is high
        if (heapUsedMB > AGENT_CONSTANTS.HIGH_MEMORY_THRESHOLD_MB) {
            logs.agent.warn(`[AgentStateManager] High memory usage: ${heapUsedMB.toFixed(2)}MB`);
            this.manageHistory();
        }
    }

    /**
     * Get sensitive content retry count
     */
    getSensitiveContentRetries(): number {
        return this.sensitiveContentRetries;
    }

    /**
     * Increment sensitive content retry count
     */
    incrementSensitiveContentRetries(): number {
        this.sensitiveContentRetries++;
        return this.sensitiveContentRetries;
    }

    /**
     * Reset sensitive content retry count
     */
    resetSensitiveContentRetries(): void {
        this.sensitiveContentRetries = 0;
    }

    /**
     * Check if max sensitive content retries exceeded
     */
    hasExceededSensitiveContentRetries(): boolean {
        return this.sensitiveContentRetries >= AGENT_CONSTANTS.MAX_SENSITIVE_CONTENT_RETRIES;
    }
}
