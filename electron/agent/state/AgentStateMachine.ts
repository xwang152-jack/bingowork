/**
 * Agent State Machine - XState Implementation
 *
 * This module defines the state machine for the Agent lifecycle using XState.
 * It provides a centralized, testable way to manage agent states and transitions.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logs } from '../../utils/logger';

// ============================================================================
// Type Definitions
// ============================================================================

export type AgentStage = 'IDLE' | 'THINKING' | 'PLANNING' | 'EXECUTING' | 'FEEDBACK' | 'ERROR';

export interface AgentStateContext {
    // Current state
    stage: AgentStage;
    iteration: number;
    isProcessing: boolean;

    // Message history
    history: Anthropic.MessageParam[];
    historySize: number;

    // Current tool execution
    currentTool: string | null;
    currentToolUseId: string | null;
    toolResults: Anthropic.ToolResultBlockParam[];

    // Error handling
    error: string | null;
    errorStatus: number | null;

    // Metadata
    startTime: number | null;
    lastStageChange: number | null;

    // Retry logic
    shouldRetry: boolean;
    retryCount: number;
}

export type AgentEvent =
    | { type: 'START_PROCESSING'; input: string | { content: string; images: string[] } }
    | { type: 'SET_STAGE'; stage: AgentStage; detail?: unknown }
    | { type: 'TOOL_CALL'; toolName: string; toolUseId: string }
    | { type: 'TOOL_COMPLETE'; result: string }
    | { type: 'TOOL_ERROR'; error: string }
    | { type: 'MESSAGE_COMPLETE'; content: Anthropic.ContentBlock[] }
    | { type: 'ERROR'; error: string; status?: number }
    | { type: 'RETRY' }
    | { type: 'COMPLETE' };

// ============================================================================
// Constants
// ============================================================================

export const MAX_ITERATIONS = 30;
export const MAX_HISTORY_SIZE = 200;

// ============================================================================
// Initial Context
// ============================================================================

export const initialContext: AgentStateContext = {
    stage: 'IDLE',
    iteration: 0,
    isProcessing: false,
    history: [],
    historySize: 0,
    currentTool: null,
    currentToolUseId: null,
    toolResults: [],
    error: null,
    errorStatus: null,
    startTime: null,
    lastStageChange: null,
    shouldRetry: false,
    retryCount: 0
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if agent is in a valid state for a given operation
 */
export function canExecuteTool(stage: AgentStage): boolean {
    return stage === 'PLANNING' || stage === 'EXECUTING';
}

/**
 * Check if agent should continue iterating
 */
export function shouldContinueIterating(iteration: number, maxIterations: number = MAX_ITERATIONS): boolean {
    return iteration < maxIterations;
}

/**
 * Check if agent can add more history
 */
export function canAddToHistory(historySize: number, maxSize: number = MAX_HISTORY_SIZE): boolean {
    return historySize < maxSize;
}

/**
 * Get human-readable stage name
 */
export function getStageName(stage: AgentStage): string {
    const names: Record<AgentStage, string> = {
        IDLE: 'Idle',
        THINKING: 'Thinking',
        PLANNING: 'Planning',
        EXECUTING: 'Executing',
        FEEDBACK: 'Feedback',
        ERROR: 'Error'
    };
    return names[stage] || 'Unknown';
}

/**
 * Log state transition
 */
export function logStateTransition(from: AgentStage, to: AgentStage, detail?: unknown): void {
    logs.agent.info(`[AgentStateMachine] ${from} -> ${to}`, detail || '');
}

/**
 * Create state reducer (simplified state machine without XState setup)
 * This is a functional alternative to the full XState machine
 */
export function agentStateReducer(
    context: AgentStateContext,
    event: AgentEvent
): AgentStateContext {
    switch (event.type) {
        case 'START_PROCESSING':
            logStateTransition(context.stage, 'THINKING');
            return {
                ...context,
                stage: 'THINKING',
                iteration: context.iteration + 1,
                isProcessing: true,
                startTime: Date.now(),
                lastStageChange: Date.now(),
                error: null,
                errorStatus: null
            };

        case 'SET_STAGE':
            if (context.stage !== event.stage) {
                logStateTransition(context.stage, event.stage, event.detail);
            }
            return {
                ...context,
                stage: event.stage,
                lastStageChange: Date.now()
            };

        case 'TOOL_CALL':
            return {
                ...context,
                currentTool: event.toolName,
                currentToolUseId: event.toolUseId,
                stage: 'PLANNING',
                lastStageChange: Date.now()
            };

        case 'TOOL_COMPLETE':
            return {
                ...context,
                toolResults: [
                    ...context.toolResults,
                    {
                        type: 'tool_result',
                        tool_use_id: context.currentToolUseId || '',
                        content: event.result
                    }
                ],
                stage: 'EXECUTING'
            };

        case 'TOOL_ERROR':
            return {
                ...context,
                error: event.error,
                currentTool: null,
                currentToolUseId: null,
                stage: 'THINKING'
            };

        case 'MESSAGE_COMPLETE':
            return {
                ...context,
                toolResults: [],
                stage: 'FEEDBACK'
            };

        case 'ERROR':
            return {
                ...context,
                stage: 'ERROR',
                error: event.error,
                errorStatus: event.status ?? null,
                lastStageChange: Date.now()
            };

        case 'RETRY':
            return {
                ...context,
                stage: 'THINKING',
                retryCount: context.retryCount + 1,
                lastStageChange: Date.now()
            };

        case 'COMPLETE':
            logStateTransition(context.stage, 'IDLE');
            return {
                ...context,
                stage: 'IDLE',
                isProcessing: false,
                currentTool: null,
                currentToolUseId: null,
                toolResults: [],
                startTime: null,
                lastStageChange: Date.now()
            };

        default:
            return context;
    }
}
