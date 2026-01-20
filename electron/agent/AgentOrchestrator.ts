/**
 * Agent Orchestrator
 *
 * Core orchestration logic for the agent loop.
 * Manages the THINKING -> PLANNING -> EXECUTING -> FEEDBACK cycle.
 */

import type { BrowserWindow } from 'electron';
import type { BaseLLMProvider } from './providers/BaseLLMProvider';
import type { ConversationManager } from './ConversationManager';
import type { ToolExecutor } from './ToolExecutor';
import type { PromptService } from './services/PromptService';
import type { ToolRegistry } from './services/ToolRegistry';

export type AgentStage = 'IDLE' | 'THINKING' | 'PLANNING' | 'EXECUTING' | 'FEEDBACK';
export type WorkMode = 'chat' | 'code' | 'cowork';

export interface OrchestratorConfig {
  model: string;
  workMode: WorkMode;
  maxTokens?: number;
  maxIterations?: number;
}

export interface AgentEventSink {
  logEvent: (type: string, payload: unknown) => void;
}

/**
 * Orchestrates the agent execution loop
 */
export class AgentOrchestrator {
  private stage: AgentStage = 'IDLE';
  private abortController: AbortController | null = null;
  private isProcessing = false;

  constructor(
    private llmProvider: BaseLLMProvider,
    private conversationManager: ConversationManager,
    private toolExecutor: ToolExecutor,
    private promptService: PromptService,
    private toolRegistry: ToolRegistry,
    private windows: BrowserWindow[],
    private eventSink?: AgentEventSink
  ) {}

  /**
   * Get current stage
   */
  getStage(): AgentStage {
    return this.stage;
  }

  /**
   * Check if currently processing
   */
  getIsProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Process a user message through the agent loop
   */
  async processUserMessage(
    input: string | { content: string; images?: string[] },
    config: OrchestratorConfig
  ): Promise<void> {
    if (this.isProcessing) {
      throw new Error('Agent is already processing a message');
    }

    this.isProcessing = true;
    this.abortController = new AbortController();
    this.setStage('THINKING');
    this.eventSink?.logEvent('user_message', this.summarizeInput(input));

    try {
      // Add user message to history
      const userContent = this.formatUserContent(input);
      this.conversationManager.addMessage({
        role: 'user',
        content: userContent,
      });
      this.notifyHistoryUpdate();

      // Run the agent loop
      await this.runLoop(config);

    } catch (error: unknown) {
      this.handleError(error);
    } finally {
      this.isProcessing = false;
      this.abortController = null;
      this.setStage('IDLE');
      this.notifyHistoryUpdate();
    }
  }

  /**
   * Abort current processing
   */
  abort(): void {
    this.abortController?.abort();
  }

  /**
   * Run the main agent loop
   */
  private async runLoop(config: OrchestratorConfig): Promise<void> {
    const maxIterations = config.maxIterations || 30;
    let keepGoing = true;
    let iterationCount = 0;

    while (keepGoing && iterationCount < maxIterations) {
      iterationCount++;

      if (this.abortController?.signal.aborted) {
        break;
      }

      // Get tools and system prompt
      const tools = await this.toolRegistry.getTools();
      const systemPrompt = this.promptService.buildSystemPrompt(
        // We need to pass skillManager - for now use empty object
        { getTools: () => [], loadedSkills: new Set() } as any,
        config.workMode
      );

      this.setStage('THINKING', { iteration: iterationCount });

      // Call LLM
      const finalContent = await this.llmProvider.streamChat({
        model: config.model,
        systemPrompt,
        messages: this.conversationManager.getHistory(),
        tools,
        maxTokens: config.maxTokens || 4096,
        signal: this.abortController?.signal,
        onToken: (token) => this.broadcast('agent:stream-token', token),
      });

      if (this.abortController?.signal.aborted) {
        return;
      }

      if (finalContent.length > 0) {
        const assistantMsg: any = { role: 'assistant', content: finalContent };
        this.conversationManager.addMessage(assistantMsg);
        this.notifyHistoryUpdate();

        // Check for tool uses
        const toolUses = finalContent.filter((c: any) => c.type === 'tool_use');

        if (toolUses.length > 0) {
          this.setStage('PLANNING', { toolCount: toolUses.length });

          // Execute tools
          const results = await this.toolExecutor.executeTools(
            toolUses.map((t: any) => ({
              id: t.id,
              name: t.name,
              input: t.input as Record<string, unknown>,
            })),
            {
              requestConfirmation: async () => true, // Placeholder
              onToolStream: (chunk, type) => {
                const toolId = this.toolExecutor.getCurrentToolUseId();
                if (toolId) {
                  this.broadcast('agent:tool-output-stream', {
                    callId: toolId,
                    chunk,
                    type,
                  });
                }
              },
              onToolCall: (call) => this.broadcast('agent:tool-call', call),
              onToolResult: (result) => {
                this.eventSink?.logEvent('tool_executed', {
                  tool: result.callId,
                  status: result.status,
                });
                this.broadcast('agent:tool-result', result);
              },
            }
          );

          // Add tool results to history
          this.conversationManager.addMessage({
            role: 'user',
            content: results,
          });
          this.notifyHistoryUpdate();

          this.setStage('THINKING', { iteration: iterationCount });
        } else {
          // No tools, end of conversation
          this.setStage('FEEDBACK');
          keepGoing = false;
        }
      } else {
        this.setStage('FEEDBACK');
        keepGoing = false;
      }
    }
  }

  /**
   * Set current stage and broadcast
   */
  private setStage(stage: AgentStage, detail?: unknown): void {
    if (this.stage === stage && detail === undefined) return;
    this.stage = stage;
    this.broadcast('agent:stage', { stage, detail });
    this.eventSink?.logEvent('stage', { stage, detail });
  }

  /**
   * Format user content for API
   */
  private formatUserContent(input: string | { content: string; images?: string[] }): string | any[] {
    if (typeof input === 'string') {
      return input;
    }

    const blocks: any[] = [];

    // Process images
    if (input.images && input.images.length > 0) {
      const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

      for (const img of input.images) {
        const match = img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
        if (match) {
          const mediaType = match[1];
          const data = match[2];

          if (SUPPORTED_TYPES.includes(mediaType)) {
            blocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data,
              },
            });
          }
        }
      }
    }

    // Add text
    if (input.content && input.content.trim()) {
      blocks.push({ type: 'text', text: input.content });
    } else if (blocks.length > 0) {
      blocks.push({ type: 'text', text: 'Please analyze this image.' });
    }

    return blocks.length > 0 ? blocks : input.content;
  }

  /**
   * Summarize user input for logging
   */
  private summarizeInput(input: string | { content: string; images?: string[] }): unknown {
    if (typeof input === 'string') {
      return { textPreview: input.slice(0, 2000), textLength: input.length, imageCount: 0 };
    }
    const text = input.content || '';
    const imageCount = Array.isArray(input.images) ? input.images.length : 0;
    return { textPreview: text.slice(0, 2000), textLength: text.length, imageCount };
  }

  /**
   * Handle errors
   */
  private handleError(error: unknown): void {
    const err = error as { status?: number; message?: string };
    this.eventSink?.logEvent('error', {
      message: err?.message || String(error),
      status: err?.status,
    });

    let errorMsg = err?.message || 'An unknown error occurred';

    // Handle sensitive content errors
    if (err?.status === 500 && (err?.message?.includes('sensitive') || JSON.stringify(error).includes('1027'))) {
      errorMsg = 'AI Provider Error: The generated content was flagged as sensitive and blocked by the provider.';
    }

    this.broadcast('agent:error', errorMsg);
  }

  /**
   * Broadcast to all windows
   */
  private broadcast(channel: string, data: unknown): void {
    for (const win of this.windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    }
  }

  /**
   * Notify history update
   */
  private notifyHistoryUpdate(): void {
    this.broadcast('agent:history-update', this.conversationManager.getHistory());
  }

  /**
   * Add a window
   */
  addWindow(win: BrowserWindow): void {
    if (!this.windows.includes(win)) {
      this.windows.push(win);
    }
    this.toolExecutor.addWindow(win);
  }

  /**
   * Remove a window
   */
  removeWindow(win: BrowserWindow): void {
    this.windows = this.windows.filter(w => w !== win);
    this.toolExecutor.removeWindow(win);
  }
}
