/**
 * Agent State Manager
 *
 * Manages the agent state using a functional state machine approach.
 * This layer provides a cleaner API for AgentRuntime to interact with.
 */

import { EventEmitter } from 'events';
import Anthropic from '@anthropic-ai/sdk';

import {
    agentStateReducer,
    AgentStateContext,
    AgentEvent,
    AgentStage,
    MAX_ITERATIONS,
    MAX_HISTORY_SIZE,
    getStageName,
    canExecuteTool,
    shouldContinueIterating,
    initialContext
} from './AgentStateMachine';

// ============================================================================
// State Manager Options
// ============================================================================

export interface StateManagerOptions {
    onStageChange?: (stage: AgentStage, detail?: unknown) => void;
    onError?: (error: string, status?: number) => void;
    onHistoryUpdate?: (history: Anthropic.MessageParam[]) => void;
}

// ============================================================================
// Agent State Manager Class
// ============================================================================

export class AgentStateManager extends EventEmitter {
    private context: AgentStateContext;
    private options: StateManagerOptions;

    constructor(options: StateManagerOptions = {}) {
        super();
        this.options = options;
        this.context = { ...initialContext };
    }

    // ========================================================================
    // State Queries
    // ========================================================================

    /**
     * Get current state as a snapshot
     */
    getSnapshot() {
        return {
            context: this.context,
            value: this.context.stage
        };
    }

    /**
     * Get current state context
     */
    getContext(): AgentStateContext {
        return this.context;
    }

    /**
     * Get current stage
     */
    getStage(): AgentStage {
        return this.context.stage;
    }

    /**
     * Get current iteration number
     */
    getIteration(): number {
        return this.context.iteration;
    }

    /**
     * Check if agent is currently processing
     */
    isProcessing(): boolean {
        return this.context.isProcessing;
    }

    /**
     * Check if agent is in a specific stage
     */
    isInStage(stage: AgentStage): boolean {
        return this.getStage() === stage;
    }

    /**
     * Check if agent is idle
     */
    isIdle(): boolean {
        return this.isInStage('IDLE');
    }

    /**
     * Check if agent can execute tools
     */
    canExecuteTools(): boolean {
        return canExecuteTool(this.getStage());
    }

    /**
     * Check if agent should continue iterating
     */
    shouldContinue(maxIterations: number = MAX_ITERATIONS): boolean {
        return shouldContinueIterating(this.getIteration(), maxIterations);
    }

    /**
     * Get current error
     */
    getError(): { error: string | null; status: number | null } {
        return { error: this.context.error, status: this.context.errorStatus };
    }

    // ========================================================================
    // State Transitions
    // ========================================================================

    /**
     * Send an event to the state machine
     */
    send(event: AgentEvent): void {
        const previousStage = this.context.stage;
        this.context = agentStateReducer(this.context, event);

        // Emit state change event
        this.emit('stateChange', this.context);

        // Notify callbacks
        if (previousStage !== this.context.stage && this.options.onStageChange) {
            this.options.onStageChange(this.context.stage);
        }

        if (this.context.error && this.options.onError) {
            this.options.onError(this.context.error, this.context.errorStatus ?? undefined);
        }
    }

    /**
     * Start processing a user message
     */
    startProcessing(input: string | { content: string; images: string[] }): void {
        this.send({ type: 'START_PROCESSING', input });
    }

    /**
     * Set the current stage
     */
    setStage(stage: AgentStage, detail?: unknown): void {
        this.send({ type: 'SET_STAGE', stage, detail });
    }

    /**
     * Signal a tool call
     */
    toolCall(toolName: string, toolUseId: string): void {
        this.send({ type: 'TOOL_CALL', toolName, toolUseId });
    }

    /**
     * Signal tool completion
     */
    toolComplete(result: string): void {
        this.send({ type: 'TOOL_COMPLETE', result });
    }

    /**
     * Signal tool error
     */
    toolError(error: string): void {
        this.send({ type: 'TOOL_ERROR', error });
    }

    /**
     * Signal message completion
     */
    messageComplete(content: Anthropic.ContentBlock[]): void {
        this.send({ type: 'MESSAGE_COMPLETE', content });
    }

    /**
     * Signal an error
     */
    error(error: string, status?: number): void {
        this.send({ type: 'ERROR', error, status });
    }

    /**
     * Signal a retry
     */
    retry(): void {
        this.send({ type: 'RETRY' });
    }

    /**
     * Signal completion
     */
    complete(): void {
        this.send({ type: 'COMPLETE' });
    }

    // ========================================================================
    // History Management
    // ========================================================================

    /**
     * Update history (external to state machine for performance)
     */
    updateHistory(history: Anthropic.MessageParam[]): void {
        this.context.history = history.slice(0, MAX_HISTORY_SIZE);
        this.context.historySize = history.length;

        if (this.options.onHistoryUpdate) {
            this.options.onHistoryUpdate(history);
        }
    }

    /**
     * Clear history
     */
    clearHistory(): void {
        this.updateHistory([]);
    }

    /**
     * Get history
     */
    getHistory(): Anthropic.MessageParam[] {
        return this.context.history;
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Stop the state manager and clean up
     */
    destroy(): void {
        this.removeAllListeners();
    }

    /**
     * Reset state to initial
     */
    reset(): void {
        this.context = { ...initialContext };
        this.emit('stateChange', this.context);
    }
}

// ============================================================================
// Utility Functions
// ========================================================================

/**
 * Create a state manager with default options
 */
export function createStateManager(options?: StateManagerOptions): AgentStateManager {
    return new AgentStateManager(options);
}

/**
 * Format stage name for display
 */
export function formatStageName(stage: AgentStage): string {
    return getStageName(stage);
}
