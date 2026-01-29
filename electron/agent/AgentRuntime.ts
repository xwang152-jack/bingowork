import Anthropic from '@anthropic-ai/sdk';
import { BrowserWindow } from 'electron';

import { FileSystemTools } from './tools/FileSystemTools';
import { BrowserTools } from './tools/BrowserTools';
import { SkillManager } from './skills/SkillManager';
import { MCPClientService } from './mcp/MCPClientService';
import { ApiProvider, WorkMode, configStore } from '../config/ConfigStore';
import { PromptService } from './services/PromptService';
import { ToolRegistry } from './services/ToolRegistry';
import { TaskAnalyzer } from './services/TaskAnalyzer';
import { permissionManager } from './security/PermissionManager';
import { BaseLLMProvider } from './providers/BaseLLMProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { MiniMaxProvider } from './providers/MiniMaxProvider';
import { generateResponse, ProviderId } from './providers/generateResponse';
import { logs } from '../utils/logger';

export type AgentMessage = {
    role: 'user' | 'assistant';
    content: string | Anthropic.ContentBlock[];
    id?: string;
};

export type AgentStage = 'IDLE' | 'THINKING' | 'PLANNING' | 'EXECUTING' | 'FEEDBACK';

export type AgentEventSink = {
    logEvent: (type: string, payload: unknown) => void;
};

interface AgentError extends Error {
    status?: number;
}

export class AgentRuntime {
    private llmProvider: BaseLLMProvider;
    private provider: ApiProvider;
    private apiKey: string;
    private apiUrl: string;
    private history: Anthropic.MessageParam[] = [];
    private windows: BrowserWindow[] = [];

    // Core Services
    private fsTools: FileSystemTools;
    private browserTools: BrowserTools;
    private skillManager: SkillManager;
    private mcpService: MCPClientService;
    private promptService: PromptService;
    private toolRegistry: ToolRegistry;
    private taskAnalyzer: TaskAnalyzer;

    private abortController: AbortController | null = null;
    private isProcessing = false;
    private pendingConfirmations: Map<string, { resolve: (approved: boolean) => void }> = new Map();
    private pendingQuestions: Map<string, { resolve: (answer: string) => void }> = new Map();
    private artifacts: { path: string; name: string; type: string }[] = [];
    private currentToolUseId: string | null = null;
    private stage: AgentStage = 'IDLE';
    private eventSink?: AgentEventSink;

    private model: string;
    private workMode: WorkMode = 'cowork';

    // Performance optimization: Lazy load skills and MCP
    private skillsLoaded = false;
    private mcpLoaded = false;

    // History management
    private readonly MAX_HISTORY_SIZE = 200; // Maximum messages in history

    // Input validation limits
    private readonly MAX_IMAGES_PER_MESSAGE = 10; // Maximum number of images per message
    private readonly MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB max per image

    constructor(apiKey: string, window: BrowserWindow, model: string = 'claude-3-5-sonnet-20241022', apiUrl: string = 'https://api.anthropic.com', provider: ApiProvider = 'anthropic', eventSink?: AgentEventSink) {
        this.provider = provider;
        this.model = model;
        this.workMode = configStore.get('workMode') || 'cowork';
        this.apiKey = apiKey;
        this.apiUrl = String(apiUrl || '').trim().replace(/\/+$/, '');
        this.llmProvider = this.createProvider(this.apiKey, this.apiUrl, provider);
        this.eventSink = eventSink;

        this.windows = [window];

        // Initialize reusable tools/managers
        this.fsTools = new FileSystemTools();
        this.browserTools = new BrowserTools();
        this.skillManager = new SkillManager();
        this.mcpService = new MCPClientService();

        // Initialize Services
        this.promptService = new PromptService();
        this.taskAnalyzer = new TaskAnalyzer();
        this.toolRegistry = new ToolRegistry(
            this.fsTools,
            this.browserTools,
            this.skillManager,
            this.mcpService,
            () => this.workMode,
            {
                requestConfirmation: this.requestConfirmation.bind(this),
                onArtifactCreated: (artifact) => {
                    this.artifacts.push(artifact);
                    this.broadcast('agent:artifact-created', artifact);
                },
                askUser: this.askUser.bind(this),
                onToolStream: (chunk: string, type: 'stdout' | 'stderr') => {
                    if (this.currentToolUseId) {
                        this.broadcast('agent:tool-output-stream', {
                            callId: this.currentToolUseId,
                            chunk,
                            type
                        });
                    }
                }
            }
        );

        // Note: IPC handlers are now registered in main.ts, not here
    }

    public getWorkMode(): WorkMode {
        return this.workMode;
    }

    public setWorkMode(mode: WorkMode) {
        this.workMode = mode;
    }

    public setModel(model: string) {
        const normalized = String(model || '').trim();
        if (!normalized) return;
        this.model = normalized;
    }

    public updateLLMConfig(next: { model?: string; provider?: ApiProvider; apiUrl?: string; apiKey?: string }) {
        const nextModel = typeof next?.model === 'string' ? String(next.model || '').trim() : '';
        if (nextModel) this.model = nextModel;

        const nextProvider = next?.provider || this.provider;
        const nextApiUrl = typeof next?.apiUrl === 'string' ? String(next.apiUrl || '').trim().replace(/\/+$/, '') : this.apiUrl;
        const nextApiKey = typeof next?.apiKey === 'string' ? next.apiKey : this.apiKey;

        const providerChanged = nextProvider !== this.provider;
        const apiUrlChanged = nextApiUrl !== this.apiUrl;
        const apiKeyChanged = nextApiKey !== this.apiKey;

        if (providerChanged || apiUrlChanged || apiKeyChanged) {
            this.provider = nextProvider;
            this.apiUrl = nextApiUrl;
            this.apiKey = nextApiKey;
            this.llmProvider = this.createProvider(this.apiKey, this.apiUrl, this.provider);
        }
    }

    private createProvider(apiKey: string, apiUrl: string, provider: ApiProvider): BaseLLMProvider {
        if (provider === 'openai') return new OpenAIProvider(apiKey, apiUrl);
        if (provider === 'minimax') return new MiniMaxProvider(apiKey, apiUrl);
        return new AnthropicProvider(apiKey, apiUrl);
    }

    // Add a window to receive updates (for floating ball)
    public addWindow(win: BrowserWindow) {
        if (!this.windows.includes(win)) {
            this.windows.push(win);
        }
    }

    public async shutdown() {
        this.abortController?.abort();
        try {
            await this.mcpService.closeAll();
        } catch {
            void 0;
        }
    }

    public async initialize() {
        logs.agent.info('Initializing AgentRuntime...');
        // Performance optimization: Skip pre-loading skills and MCP
        // They will be loaded on-demand when first user message is processed
        logs.agent.info('AgentRuntime initialized (Skills & MCP will load on-demand)');
    }

    public removeWindow(win: BrowserWindow) {
        this.windows = this.windows.filter(w => w !== win);

        // Clean up pending promises associated with this window
        // This prevents memory leaks when windows are closed
        const pendingIds = [
            ...this.pendingConfirmations.keys(),
            ...this.pendingQuestions.keys()
        ];

        for (const id of pendingIds) {
            // Reject any pending promises that are still waiting
            const confirmation = this.pendingConfirmations.get(id);
            if (confirmation) {
                confirmation.resolve(false); // Deny by default when window is closed
                this.pendingConfirmations.delete(id);
            }

            const question = this.pendingQuestions.get(id);
            if (question) {
                question.resolve('Window closed'); // Provide default answer
                this.pendingQuestions.delete(id);
            }
        }

        logs.agent.info(`Removed window and cleaned up ${pendingIds.length} pending promises`);
    }

    // Handle confirmation response
    public handleConfirmResponse(id: string, approved: boolean) {
        const pending = this.pendingConfirmations.get(id);
        if (pending) {
            pending.resolve(approved);
            this.pendingConfirmations.delete(id);
        }
    }

    // Handle user question response
    public handleUserQuestionResponse(id: string, answer: string) {
        const pending = this.pendingQuestions.get(id);
        if (pending) {
            pending.resolve(answer);
            this.pendingQuestions.delete(id);
        }
    }

    // Callback for ToolRegistry to ask user
    private async askUser(question: string, options?: string[]): Promise<string> {
        const id = Math.random().toString(36).substring(7);
        this.broadcast('agent:user-question', { id, question, options });

        return new Promise((resolve) => {
            this.pendingQuestions.set(id, { resolve });
            // Optional: Set a timeout if we want to avoid hanging forever, 
            // but user interaction might take time.
        });
    }

    // Clear history for new session
    public clearHistory() {
        this.history = [];
        this.artifacts = [];
        this.notifyUpdate();
    }

    // Load history from saved session
    public loadHistory(messages: Anthropic.MessageParam[]) {
        this.history = messages.slice(0, this.MAX_HISTORY_SIZE);
        this.artifacts = [];
        this.notifyUpdate();
    }

    /**
     * Get current history size
     */
    public getHistorySize(): number {
        return this.history.length;
    }

    public async processUserMessage(input: string | { content: string, images: string[] }) {
        if (this.isProcessing) {
            throw new Error('Agent is already processing a message');
        }

        this.isProcessing = true;
        this.abortController = new AbortController();
        this.setStage('THINKING');
        this.eventSink?.logEvent('user_message', this.summarizeUserInput(input));

        try {
            // Performance optimization: Lazy load skills on first message
            if (!this.skillsLoaded) {
                logs.agent.info('Loading skills on-demand...');
                await this.skillManager.loadSkills();
                this.skillsLoaded = true;

                // Load dynamic tool executors after skills are loaded
                await this.toolRegistry.loadDynamicTools();
            }

            // Performance optimization: Lazy load MCP clients on first message
            if (!this.mcpLoaded) {
                if (configStore.getNetworkAccess()) {
                    logs.agent.info('Loading MCP clients on-demand...');
                    await this.mcpService.loadClients();

                    // Load MCP tool executors after clients are loaded
                    await this.toolRegistry.loadDynamicTools();
                } else {
                    await this.mcpService.closeAll();
                }
                this.mcpLoaded = true;
            }

            // Task complexity analysis for TodoWrite enforcement (Cowork mode only)
            let userContent: string | Anthropic.ContentBlockParam[] = '';
            let userText = '';

            if (typeof input === 'string') {
                userText = input;
            } else {
                userText = input.content || '';
            }

            // Analyze task complexity and inject reminder if needed (Cowork mode only)
            if (this.workMode === 'cowork' && userText.trim()) {
                const analysis = this.taskAnalyzer.analyzeMessage(userText);

                if (analysis.requiresTodo) {
                    logs.agent.info(`[TaskAnalyzer] Complex task detected (score: ${analysis.score}), complexity: ${analysis.complexity}`);

                    // Inject system reminder to use TodoWrite
                    const reminder = this.buildTodoReminder(analysis);
                    userText = reminder + '\n\n' + userText;

                    // Broadcast to UI that TodoWrite is recommended
                    this.broadcast('agent:todo-recommended', {
                        complexity: analysis.complexity,
                        reason: analysis.reason,
                        estimatedSteps: analysis.estimatedSteps
                    });
                }
            }

            if (typeof input === 'string') {
                userContent = userText;
            } else {
                const blocks: Anthropic.ContentBlockParam[] = [];

                // Process images with validation
                if (input.images && input.images.length > 0) {
                    const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

                    // Validate image count
                    if (input.images.length > this.MAX_IMAGES_PER_MESSAGE) {
                        throw new Error(`Too many images. Maximum ${this.MAX_IMAGES_PER_MESSAGE} images per message, received ${input.images.length}.`);
                    }

                    for (const img of input.images) {
                        // format: data:image/png;base64,......
                        const match = img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
                        if (match) {
                            const mediaType = match[1];
                            const data = match[2];

                            if (!SUPPORTED_TYPES.includes(mediaType)) {
                                logs.agent.warn(`Unsupported image type: ${mediaType}. Skipping.`);
                                continue;
                            }

                            // Validate image size (base64 encoded size)
                            const base64Size = Buffer.byteLength(data, 'base64');
                            if (base64Size > this.MAX_IMAGE_SIZE_BYTES) {
                                logs.agent.warn(`Image size exceeds ${this.MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB. Skipping.`);
                                continue;
                            }

                            blocks.push({
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                                    data: data
                                }
                            });
                        } else {
                            logs.agent.warn('Invalid image data format. Skipping.');
                        }
                    }

                    // If all images were filtered out, warn the user
                    if (blocks.length === 0 && input.images.length > 0) {
                        logs.agent.warn('No valid images were processed. All images were filtered out.');
                    }
                }
                // Add text
                if (input.content && input.content.trim()) {
                    blocks.push({ type: 'text', text: input.content });
                } else if (blocks.some(b => b.type === 'image')) {
                    // [Fix] If only images are present, add a default prompt to satisfy API requirements
                    blocks.push({ type: 'text', text: "Please analyze this image." });
                }
                userContent = blocks;
            }

            // Add user message to history
            this.history.push({ role: 'user', content: userContent });
            this.notifyUpdate();

            // Start the agent loop
            await this.runLoop();

        } catch (error: unknown) {
            const err = error as { status?: number; message?: string };
            logs.agent.error('Agent Loop Error:', error);
            this.eventSink?.logEvent('error', { message: err.message || String(error), status: err.status });

            // [Fix] Handle MiniMax/provider sensitive content errors gracefully
            if (err.status === 500 && (err.message?.includes('sensitive') || JSON.stringify(error).includes('1027'))) {
                this.broadcast('agent:error', '供应商返回敏感内容拦截（1027），请修改输入或稍后重试。');
            } else if (err.status === 401 || err.status === 403) {
                this.broadcast('agent:error', '鉴权失败：API Key 无效、已过期或未配置，请在设置中重新填写。');
            } else if (err.status === 429) {
                this.broadcast('agent:error', '请求过于频繁（Rate Limit），请稍后重试。');
            } else if (err.status === 400 && err.message) {
                this.broadcast('agent:error', err.message);
            } else {
                const rawMessage = err.message || String(error);
                const normalized = /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|network/i.test(rawMessage)
                    ? '网络错误：请检查 Base URL 是否正确、网络是否可用。'
                    : rawMessage || '发生未知错误';
                this.broadcast('agent:error', normalized);
            }
        } finally {
            this.isProcessing = false;
            this.abortController = null;
            this.setStage('IDLE');
            this.notifyUpdate();
        }
    }

    private summarizeUserInput(input: string | { content: string, images: string[] }) {
        if (typeof input === 'string') {
            return { textPreview: input.slice(0, 2000), textLength: input.length, imageCount: 0 };
        }
        const text = input.content || '';
        const imageCount = Array.isArray(input.images) ? input.images.length : 0;
        return { textPreview: text.slice(0, 2000), textLength: text.length, imageCount };
    }

    private async runLoop() {
        let keepGoing = true;
        let iterationCount = 0;
        const MAX_ITERATIONS = 30;

        while (keepGoing && iterationCount < MAX_ITERATIONS) {
            iterationCount++;
            logs.agent.info(`[AgentRuntime] Loop iteration: ${iterationCount}`);
            if (this.abortController?.signal.aborted) break;

            const configuredWorkMode = configStore.get('workMode') || 'cowork';
            if (this.workMode !== configuredWorkMode) {
                this.workMode = configuredWorkMode;
            }

            // Get Tools from Registry
            const tools = await this.toolRegistry.getTools();
            // Get System Prompt from Service
            const systemPrompt = this.promptService.buildSystemPrompt(this.skillManager, this.workMode);

            logs.agent.info('Sending request to API...');
            logs.agent.info('Provider:', this.provider);
            logs.agent.info('Model:', this.model);
            logs.agent.info('Base URL:', this.llmProvider.getBaseURL());

            try {
                if (!String(this.apiKey || '').trim()) {
                    const e: AgentError = new Error('API Key 未配置，请在设置中为当前供应商填写 API Key');
                    e.status = 401;
                    throw e;
                }
                if (!String(this.model || '').trim()) {
                    const e: AgentError = new Error('模型未配置，请在设置中选择或填写模型');
                    e.status = 400;
                    throw e;
                }
                if (!String(this.apiUrl || '').trim()) {
                    const e: AgentError = new Error('Base URL 未配置，请在设置中填写 Base URL');
                    e.status = 400;
                    throw e;
                }

                this.setStage('THINKING', { iteration: iterationCount });
                const finalContent = await generateResponse(
                    this.provider as ProviderId,
                    {
                        model: this.model,
                        systemPrompt,
                        messages: this.history,
                        tools,
                        maxTokens: 4096,
                        signal: this.abortController?.signal,
                        onToken: (token) => this.broadcast('agent:stream-token', token)
                    },
                    {
                        apiKey: this.apiKey,
                        apiUrl: this.apiUrl,
                    },
                    this.llmProvider
                );

                if (this.abortController?.signal.aborted) return;

                if (finalContent.length > 0) {
                    const assistantMsg: Anthropic.MessageParam = { role: 'assistant', content: finalContent };
                    this.history.push(assistantMsg);
                    this.notifyUpdate();

                    const toolUses = finalContent.filter(c => c.type === 'tool_use');
                    if (toolUses.length > 0) {
                        this.setStage('PLANNING', { toolCount: toolUses.length });
                        const toolResults: Anthropic.ToolResultBlockParam[] = [];

                        for (const toolUse of toolUses) {
                            if (toolUse.type !== 'tool_use') continue;

                            logs.agent.info(`Executing tool: ${toolUse.name}`);
                            this.broadcast('agent:tool-call', {
                                callId: toolUse.id,
                                name: toolUse.name,
                                input: toolUse.input as Record<string, unknown>
                            });
                            this.setStage('EXECUTING', { tool: toolUse.name, toolUseId: toolUse.id });
                            const startedAt = Date.now();
                            this.currentToolUseId = toolUse.id; // Set ID for streaming context
                            let result = "Tool execution failed or unknown tool.";

                            try {
                                result = await this.toolRegistry.executeTool(
                                    toolUse.name,
                                    toolUse.input as Record<string, unknown>
                                );
                                this.broadcast('agent:tool-result', {
                                    callId: toolUse.id,
                                    status: 'done'
                                });
                                this.eventSink?.logEvent('tool_executed', {
                                    tool: toolUse.name,
                                    toolUseId: toolUse.id,
                                    durationMs: Date.now() - startedAt,
                                    ok: true
                                });
                            } catch (toolErr: unknown) {
                                result = `Error executing tool: ${(toolErr as Error).message}`;
                                this.broadcast('agent:tool-result', {
                                    callId: toolUse.id,
                                    status: 'error',
                                    error: (toolErr as Error).message
                                });
                                this.eventSink?.logEvent('tool_executed', {
                                    tool: toolUse.name,
                                    toolUseId: toolUse.id,
                                    durationMs: Date.now() - startedAt,
                                    ok: false,
                                    error: (toolErr as Error).message
                                });
                            }
                            this.currentToolUseId = null; // Clear ID after execution

                            toolResults.push({
                                type: 'tool_result',
                                tool_use_id: toolUse.id,
                                content: result
                            });
                        }

                        this.history.push({ role: 'user', content: toolResults });
                        this.notifyUpdate();
                        this.setStage('THINKING', { iteration: iterationCount });
                    } else {
                        this.setStage('FEEDBACK');
                        keepGoing = false;
                    }
                } else {
                    this.setStage('FEEDBACK');
                    keepGoing = false;
                }

            } catch (loopError: unknown) {
                const loopErr = loopError as { status?: number; message?: string };
                logs.agent.error("Agent Loop detailed error:", loopError);

                // Handle Rate Limit (429)
                if (loopErr.status === 429) {
                    logs.agent.info("Rate limit hit, waiting 5s before retry...");
                    this.broadcast('agent:status', 'Rate limit hit, retrying in 5s...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    iterationCount--; // Don't count this as an iteration
                    continue;
                }

                // Handle Sensitive Content Error (1027)
                if (loopErr.status === 500 && (loopErr.message?.includes('sensitive') || JSON.stringify(loopError).includes('1027'))) {
                    logs.agent.info("Caught sensitive content error, asking Agent to retry...");

                    // Add a system-like user message to prompt the agent to fix its output
                    this.history.push({
                        role: 'user',
                        content: `[SYSTEM ERROR] Your previous response was blocked by the safety filter (Error Code 1027: output new_sensitive). \n\nThis usually means the generated content contained sensitive, restricted, or unsafe material.\n\nPlease generate a NEW response that:\n1. Addresses the user's request safely.\n2. Avoids the sensitive topic or phrasing that triggered the block.\n3. Acknowledges the issue briefly if necessary.`
                    });
                    this.notifyUpdate();

                    // Allow the loop to continue to the next iteration
                    continue;
                } else {
                    // Re-throw other errors to be caught effectively by the outer handler
                    throw loopError;
                }
            }
        }
    }

    private setStage(stage: AgentStage, detail?: unknown) {
        if (this.stage === stage && detail === undefined) return;
        this.stage = stage;
        this.broadcast('agent:stage', { stage, detail });
        this.eventSink?.logEvent('stage', { stage, detail });
    }

    // Build TodoWrite reminder message based on task analysis
    private buildTodoReminder(analysis: { complexity: string; reason: string; estimatedSteps?: number }): string {
        return `<SYSTEM REMINDER>
================================================================================
COMPLEX TASK DETECTED - TODO_WRITE USAGE REQUIRED
================================================================================

Task Analysis:
• Complexity: ${analysis.complexity.toUpperCase()}
• Reason: ${analysis.reason}
• Estimated Steps: ${analysis.estimatedSteps || 'N/A'}

ACTION REQUIRED:
You MUST use the todo_write tool BEFORE proceeding with any other tools.

Example format:
<todo_write>
{
  "action": "add",
  "todos": [
    {"content": "First step", "status": "pending", "activeForm": "Starting first step"},
    {"content": "Second step", "status": "pending", "activeForm": "Working on second step"}
  ]
}
</todo_write>

This helps users track progress on complex workflows.
================================================================================
</SYSTEM REMINDER>`;
    }

    // Broadcast to all windows
    private broadcast(channel: string, data: unknown) {
        for (const win of this.windows) {
            if (!win.isDestroyed()) {
                win.webContents.send(channel, data);
            }
        }
    }

    private notifyUpdate() {
        this.broadcast('agent:history-update', this.history);
    }

    private async requestConfirmation(tool: string, description: string, args: Record<string, unknown>): Promise<boolean> {
        // Extract path from args if available
        const path = (args?.path || args?.cwd) as string | undefined;

        // 1. Check if permission is already explicitly granted (Remembered by user)
        if (configStore.hasPermission(tool, path)) {
            logs.agent.info(`[AgentRuntime] Auto-approved ${tool} (saved permission)`);
            return true;
        }

        // 2. Auto-approve standard file writes in authorized folders
        if (tool === 'write_file' && path && permissionManager.isPathAuthorized(path)) {
            logs.agent.info(`[AgentRuntime] Auto-approved ${tool} (authorized folder: ${path})`);
            return true;
        }

        // 3. For other operations (like run_command), we still require confirmation 
        // unless they were explicitly "remembered" in step 1.

        const id = `confirm-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        return new Promise((resolve) => {
            this.pendingConfirmations.set(id, { resolve });
            this.broadcast('agent:confirm-request', { id, tool, description, args });
        });
    }

    public handleConfirmResponseWithRemember(id: string, approved: boolean, remember: boolean): void {
        const pending = this.pendingConfirmations.get(id);
        if (pending) {
            if (approved && remember) {
                // Future: We would extract tool and path here and save to configStore
                // For now this is just a placeholder logic from before
            }
            pending.resolve(approved);
            this.pendingConfirmations.delete(id);
        }
    }

    public abort() {
        this.abortController?.abort();
    }

    /**
     * Execute a tool directly without LLM intervention
     * Used by scheduled tasks for direct tool execution
     */
    async executeToolDirectly(toolName: string, args: Record<string, unknown>): Promise<string> {
        logs.agent.info(`[executeToolDirectly] Executing tool: ${toolName}`);

        // Check tool permission
        const hasPermission = await this.checkToolPermission(toolName, args);
        if (!hasPermission) {
            throw new Error(`Permission denied for tool: ${toolName}`);
        }

        try {
            // Execute the tool
            const result = await this.toolRegistry.executeTool(toolName, args);
            return result;
        } catch (error) {
            logs.agent.error(`[executeToolDirectly] Error executing ${toolName}:`, error);
            throw error;
        }
    }

    /**
     * Check if tool execution requires permission
     */
    private async checkToolPermission(toolName: string, args: Record<string, unknown>): Promise<boolean> {
        // Extract path from args if available
        const path = (args?.path || args?.cwd) as string | undefined;

        // 1. Check if permission is already explicitly granted
        if (configStore.hasPermission(toolName, path)) {
            return true;
        }

        // 2. Auto-approve standard file writes in authorized folders
        if (toolName === 'write_file' && path && permissionManager.isPathAuthorized(path)) {
            return true;
        }

        // 3. For scheduled tasks, we don't want to show confirmation dialogs
        // so we check if there's a saved permission
        if (configStore.hasPermission(toolName, path)) {
            return true;
        }

        // 4. Deny if no permission found
        logs.agent.warn(`[executeToolDirectly] Permission denied for ${toolName} at path ${path || '(any)'}`);
        return false;
    }
}
