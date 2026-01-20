/**
 * Tool Executor
 *
 * Coordinates tool execution with proper permission checking,
 * error handling, and result streaming.
 */

import type { BrowserWindow } from 'electron';
import { ToolRegistry } from './services/ToolRegistry';

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export interface ToolExecutionOptions {
  requestConfirmation: (
    tool: string,
    description: string,
    args: Record<string, unknown>
  ) => Promise<boolean>;
  onToolStream?: (chunk: string, type: 'stdout' | 'stderr') => void;
  onToolCall?: (call: { callId: string; name: string; input: Record<string, unknown> }) => void;
  onToolResult?: (result: { callId: string; status: string; error?: string }) => void;
}

/**
 * Manages tool execution workflow
 */
export class ToolExecutor {
  private currentToolUseId: string | null = null;

  constructor(
    private toolRegistry: ToolRegistry,
    private windows: BrowserWindow[]
  ) {}

  /**
   * Execute a single tool call
   */
  async executeTool(
    toolCall: ToolCall,
    options: ToolExecutionOptions
  ): Promise<string> {
    const { id, name, input } = toolCall;

    // Notify about tool call
    if (options.onToolCall) {
      options.onToolCall({
        callId: id,
        name,
        input,
      });
    }

    // Set current tool ID for streaming
    this.currentToolUseId = id;

    // Request confirmation if needed (delegated to ToolRegistry)
    const result = await this.toolRegistry.executeTool(name, input);

    // Notify about completion
    if (options.onToolResult) {
      options.onToolResult({
        callId: id,
        status: 'done',
      });
    }

    // Clear current tool ID
    this.currentToolUseId = null;

    return result;
  }

  /**
   * Execute multiple tool calls in sequence
   */
  async executeTools(
    toolCalls: ToolCall[],
    options: ToolExecutionOptions
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeTool(toolCall, options);
        results.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: result,
        });
      } catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : String(error);

        results.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: `Error executing tool: ${errorMessage}`,
        });

        // Notify about error
        if (options.onToolResult) {
          options.onToolResult({
            callId: toolCall.id,
            status: 'error',
            error: errorMessage,
          });
        }
      }
    }

    return results;
  }

  /**
   * Add a window to receive updates
   */
  addWindow(win: BrowserWindow): void {
    if (!this.windows.includes(win)) {
      this.windows.push(win);
    }
  }

  /**
   * Remove a window
   */
  removeWindow(win: BrowserWindow): void {
    this.windows = this.windows.filter(w => w !== win);
  }

  /**
   * Get the current tool use ID (for streaming context)
   */
  getCurrentToolUseId(): string | null {
    return this.currentToolUseId;
  }
}
