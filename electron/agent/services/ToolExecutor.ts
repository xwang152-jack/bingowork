/**
 * Tool Executor System - Plugin-based architecture for tool execution
 *
 * This module provides a plugin-based architecture for tool execution,
 * allowing tools to be registered and executed in a modular way.
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ToolExecutionContext {
    requestConfirmation: (tool: string, description: string, args: Record<string, unknown>) => Promise<boolean>;
    onArtifactCreated: (artifact: { path: string; name: string; type: string }) => void;
    onToolStream?: (chunk: string, type: 'stdout' | 'stderr') => void;
}

export interface ToolInput {
    [key: string]: unknown;
}

export type ToolResult = string;

export interface ToolExecutor {
    /**
     * Get the tool name this executor handles
     */
    readonly name: string;

    /**
     * Get the tool schema for API discovery
     */
    readonly schema: Anthropic.Tool;

    /**
     * Validate if the tool can be used in the current mode
     */
    isAllowedInMode(mode: 'chat' | 'code' | 'cowork'): boolean;

    /**
     * Validate the input parameters
     * @returns { ok: true } if valid, { ok: false, error: string } if invalid
     */
    validate?(input: ToolInput): { ok: true } | { ok: false; error: string };

    /**
     * Execute the tool
     */
    execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolResult>;
}

// ============================================================================
// Base Tool Executor (helper class)
// ============================================================================

export abstract class BaseToolExecutor implements ToolExecutor {
    abstract readonly name: string;
    abstract readonly schema: Anthropic.Tool;

    isAllowedInMode(_mode: 'chat' | 'code' | 'cowork'): boolean {
        return true; // Default: allowed in all modes
    }

    validate?(_input: ToolInput): { ok: true } | { ok: false; error: string } {
        return { ok: true }; // Default: no validation
    }

    abstract execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolResult>;
}

// ============================================================================
// Tool Registry (Plugin Registration)
// ============================================================================

class ToolExecutorRegistry {
    private executors = new Map<string, ToolExecutor>();

    register(executor: ToolExecutor): void {
        if (this.executors.has(executor.name)) {
            // Allow re-registration for the same executor instance
            // This can happen when the registry is reused across tests
            return;
        }
        this.executors.set(executor.name, executor);
    }

    unregister(name: string): boolean {
        return this.executors.delete(name);
    }

    get(name: string): ToolExecutor | undefined {
        return this.executors.get(name);
    }

    has(name: string): boolean {
        return this.executors.has(name);
    }

    getAll(): ToolExecutor[] {
        return Array.from(this.executors.values());
    }

    getAllNames(): string[] {
        return Array.from(this.executors.keys());
    }

    getSchemasForMode(mode: 'chat' | 'code' | 'cowork'): Anthropic.Tool[] {
        return this.getAll()
            .filter(e => e.isAllowedInMode(mode))
            .map(e => e.schema);
    }

    clear(): void {
        this.executors.clear();
    }
}

export const toolExecutorRegistry = new ToolExecutorRegistry();

/**
 * Clear all registered executors (useful for testing)
 */
export function clearToolExecutorRegistry(): void {
    toolExecutorRegistry.clear();
}
