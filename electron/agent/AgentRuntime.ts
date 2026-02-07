/**
 * Agent Runtime
 * 
 * Core orchestration engine for the AI agent.
 * Refactored to use separate modules for better maintainability.
 * 
 * Modules:
 * - AgentConstants: Magic numbers and configuration
 * - AgentErrorHandler: Error handling utilities
 * - AgentStateManager: State management
 * - AgentUIBridge: UI communication
 */

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
import { createPendingConfirmation } from '../ipc/handlers/agentHandlers';

// Import refactored modules
import { AGENT_CONSTANTS, SUPPORTED_IMAGE_TYPES, AgentStage } from './AgentConstants';
import { AgentErrorHandler, AgentError } from './AgentErrorHandler';
import { AgentStateManager, AgentEventSink } from './AgentStateManager';
import { AgentUIBridge } from './AgentUIBridge';

// Re-export types for compatibility
export type { AgentStage, AgentEventSink };

export type AgentMessage = {
    role: 'user' | 'assistant';
    content: string | Anthropic.ContentBlock[];
    id?: string;
};

export class AgentRuntime {
    private llmProvider: BaseLLMProvider;
    private provider: ApiProvider;
    private apiKey: string;
    private apiUrl: string;
    private model: string;
    private workMode: WorkMode = 'cowork';

    // Core Services
    private fsTools: FileSystemTools;
    private browserTools: BrowserTools;
    private skillManager: SkillManager;
    private mcpService: MCPClientService;
    private promptService: PromptService;
    private toolRegistry: ToolRegistry;
    private taskAnalyzer: TaskAnalyzer;

    // Refactored modules
    private stateManager: AgentStateManager;
    private uiBridge: AgentUIBridge;

    private abortController: AbortController | null = null;
    private artifacts: { path: string; name: string; type: string }[] = [];
    private currentToolUseId: string | null = null;
    private eventSink?: AgentEventSink;

    // Performance optimization: Lazy loading
    private skillsLoaded = false;
    private mcpLoaded = false;

    // Cache for tools and system prompt
    private cachedTools: Anthropic.Tool[] | null = null;
    private cachedSystemPrompt: string | null = null;
    private cachedWorkMode: WorkMode | null = null;
    private cacheInvalidated = false;

    constructor(
        apiKey: string,
        window: BrowserWindow,
        model: string = 'claude-3-5-sonnet-20241022',
        apiUrl: string = 'https://api.anthropic.com',
        provider: ApiProvider = 'anthropic',
        eventSink?: AgentEventSink
    ) {
        this.provider = provider;
        this.model = model;
        this.workMode = configStore.get('workMode') || 'cowork';
        this.apiKey = apiKey;
        this.apiUrl = String(apiUrl || '').trim().replace(/\/+$/, '');
        this.llmProvider = this.createProvider(this.apiKey, this.apiUrl, provider);
        this.eventSink = eventSink;

        // Initialize refactored modules
        this.stateManager = new AgentStateManager(eventSink);
        this.uiBridge = new AgentUIBridge(window);
        this.stateManager.setBroadcastCallback((channel, data) => this.uiBridge.broadcast(channel, data));

        // Initialize tools/managers
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
                askUser: (question, options) => this.uiBridge.askUser(question, options),
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
    }

    // Public API - Work Mode
    public getWorkMode(): WorkMode { return this.workMode; }

    public setWorkMode(mode: WorkMode) {
        if (this.workMode !== mode) {
            this.workMode = mode;
            this.invalidateCache();
        }
    }

    // Public API - Model & Config
    public setModel(model: string) {
        const normalized = String(model || '').trim();
        if (normalized) this.model = normalized;
    }

    public getMCPService(): MCPClientService { return this.mcpService; }
    public getToolRegistry(): ToolRegistry { return this.toolRegistry; }

    public updateLLMConfig(next: { model?: string; provider?: ApiProvider; apiUrl?: string; apiKey?: string }) {
        if (next?.model) this.model = String(next.model).trim();

        const nextProvider = next?.provider || this.provider;
        const nextApiUrl = typeof next?.apiUrl === 'string' ? String(next.apiUrl).trim().replace(/\/+$/, '') : this.apiUrl;
        const nextApiKey = typeof next?.apiKey === 'string' ? next.apiKey : this.apiKey;

        if (nextProvider !== this.provider || nextApiUrl !== this.apiUrl || nextApiKey !== this.apiKey) {
            this.provider = nextProvider;
            this.apiUrl = nextApiUrl;
            this.apiKey = nextApiKey;
            this.llmProvider = this.createProvider(this.apiKey, this.apiUrl, this.provider);
        }
    }

    // Public API - Window Management (delegate to UIBridge)
    public addWindow(win: BrowserWindow) { this.uiBridge.addWindow(win); }
    public removeWindow(win: BrowserWindow) { this.uiBridge.removeWindow(win); }

    // Public API - Lifecycle
    public async shutdown() {
        this.abortController?.abort();
        try { await this.mcpService.closeAll(); } catch { void 0; }
    }

    public async initialize() {
        logs.agent.info('AgentRuntime initialized (Skills & MCP will load on-demand)');
    }

    // Public API - History (delegate to StateManager)
    public clearHistory() {
        this.stateManager.clearHistory();
        this.artifacts = [];
        this.notifyUpdate();
    }

    public loadHistory(messages: Anthropic.MessageParam[]) {
        this.stateManager.loadHistory(messages);
        this.artifacts = [];
        this.notifyUpdate();
    }

    public getHistorySize(): number { return this.stateManager.getHistorySize(); }

    // Public API - Confirmations
    public handleConfirmResponse(id: string, approved: boolean) {
        this.uiBridge.handleConfirmResponse(id, approved);
    }

    public handleUserQuestionResponse(id: string, answer: string) {
        this.uiBridge.handleUserQuestionResponse(id, answer);
    }

    public handleConfirmResponseWithRemember(id: string, approved: boolean, _remember: boolean): void {
        this.uiBridge.handleConfirmResponse(id, approved);
    }

    public abort() { this.abortController?.abort(); }

    // Main message processing
    public async processUserMessage(input: string | { content: string, images: string[] }) {
        if (this.stateManager.getIsProcessing()) {
            logs.agent.warn('Agent is already processing. Ignoring concurrent request.');
            return;
        }

        this.stateManager.setIsProcessing(true);
        this.stateManager.resetSensitiveContentRetries();

        try {
            this.abortController = new AbortController();
            this.stateManager.setStage('THINKING');
            this.eventSink?.logEvent('user_message', this.summarizeUserInput(input));

            await this.lazyLoadSkillsAndMCP();
            this.stateManager.checkMemoryUsage();

            const userContent = await this.prepareUserContent(input);
            this.stateManager.addToHistory({ role: 'user', content: userContent });
            this.notifyUpdate();

            await this.runLoop();

        } catch (error: unknown) {
            this.handleProcessingError(error);
        } finally {
            this.stateManager.setIsProcessing(false);
            this.abortController = null;
            this.stateManager.setStage('IDLE');
            this.notifyUpdate();
        }
    }

    // Tool execution for scheduled tasks
    async executeToolDirectly(toolName: string, args: Record<string, unknown>): Promise<string> {
        logs.agent.info(`[executeToolDirectly] Executing tool: ${toolName}`);

        if (!await this.checkToolPermission(toolName, args)) {
            throw new Error(`Permission denied for tool: ${toolName}`);
        }

        return this.toolRegistry.executeTool(toolName, args);
    }

    // Private helpers
    private createProvider(apiKey: string, apiUrl: string, provider: ApiProvider): BaseLLMProvider {
        if (provider === 'openai') return new OpenAIProvider(apiKey, apiUrl);
        if (provider === 'minimax') return new MiniMaxProvider(apiKey, apiUrl);
        return new AnthropicProvider(apiKey, apiUrl);
    }

    private invalidateCache(): void {
        this.cachedTools = null;
        this.cachedSystemPrompt = null;
        this.cacheInvalidated = true;
    }

    private async getToolsIfNeeded(): Promise<Anthropic.Tool[]> {
        if (!this.cacheInvalidated && this.cachedTools && this.cachedWorkMode === this.workMode) {
            return this.cachedTools;
        }
        this.cachedTools = await this.toolRegistry.getTools();
        this.cachedWorkMode = this.workMode;
        this.cacheInvalidated = false;
        return this.cachedTools;
    }

    private getSystemPromptIfNeeded(): string {
        if (!this.cacheInvalidated && this.cachedSystemPrompt && this.cachedWorkMode === this.workMode) {
            return this.cachedSystemPrompt;
        }
        this.cachedSystemPrompt = this.promptService.buildSystemPrompt(this.skillManager, this.workMode);
        this.cachedWorkMode = this.workMode;
        this.cacheInvalidated = false;
        return this.cachedSystemPrompt;
    }

    private async lazyLoadSkillsAndMCP(): Promise<void> {
        if (!this.skillsLoaded) {
            await this.skillManager.loadSkills();
            await this.toolRegistry.loadDynamicTools();
            this.skillsLoaded = true;
            this.invalidateCache();
        }

        if (!this.mcpLoaded) {
            if (configStore.getNetworkAccess()) {
                await this.mcpService.loadClients();
                await this.toolRegistry.loadDynamicTools();
                this.invalidateCache();
            } else {
                await this.mcpService.closeAll();
            }
            this.mcpLoaded = true;
        }
    }

    private async prepareUserContent(input: string | { content: string, images: string[] }): Promise<string | Anthropic.ContentBlockParam[]> {
        let userText = typeof input === 'string' ? input : (input.content || '');

        // Task complexity analysis for Cowork mode
        if (this.workMode === 'cowork' && userText.trim()) {
            const analysis = this.taskAnalyzer.analyzeMessage(userText);
            if (analysis.requiresTodo) {
                logs.agent.info(`[TaskAnalyzer] Complex task detected (score: ${analysis.score})`);
                userText = this.buildTodoReminder(analysis) + '\n\n' + userText;
                this.broadcast('agent:todo-recommended', {
                    complexity: analysis.complexity,
                    reason: analysis.reason,
                    estimatedSteps: analysis.estimatedSteps
                });
            }
        }

        if (typeof input === 'string') return userText;

        const blocks: Anthropic.ContentBlockParam[] = [];

        // Process images
        if (input.images?.length) {
            if (input.images.length > AGENT_CONSTANTS.MAX_IMAGES_PER_MESSAGE) {
                throw new Error(`Too many images. Maximum ${AGENT_CONSTANTS.MAX_IMAGES_PER_MESSAGE}.`);
            }

            for (const img of input.images) {
                const match = img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
                if (!match) continue;

                const [, mediaType, data] = match;
                if (!SUPPORTED_IMAGE_TYPES.includes(mediaType as any)) continue;
                if (Buffer.byteLength(data, 'base64') > AGENT_CONSTANTS.MAX_IMAGE_SIZE_BYTES) continue;

                blocks.push({
                    type: 'image',
                    source: { type: 'base64', media_type: mediaType as any, data }
                });
            }
        }

        if (input.content?.trim()) {
            blocks.push({ type: 'text', text: input.content });
        } else if (blocks.some(b => b.type === 'image')) {
            blocks.push({ type: 'text', text: "Please analyze this image." });
        }

        return blocks;
    }

    private async runLoop() {
        let keepGoing = true;
        let iterationCount = 0;

        while (keepGoing && iterationCount < AGENT_CONSTANTS.MAX_ITERATIONS) {
            iterationCount++;
            if (this.abortController?.signal.aborted) break;

            // Sync work mode
            const configuredWorkMode = configStore.get('workMode') || 'cowork';
            if (this.workMode !== configuredWorkMode) this.workMode = configuredWorkMode;

            const tools = await this.getToolsIfNeeded();
            const systemPrompt = this.getSystemPromptIfNeeded();

            try {
                this.validateConfig();
                this.stateManager.setStage('THINKING', { iteration: iterationCount });

                const finalContent = await generateResponse(
                    this.provider as ProviderId,
                    {
                        model: this.model,
                        systemPrompt,
                        messages: this.stateManager.getHistory(),
                        tools,
                        maxTokens: AGENT_CONSTANTS.DEFAULT_MAX_TOKENS,
                        signal: this.abortController?.signal,
                        onToken: (token) => this.broadcast('agent:stream-token', token)
                    },
                    { apiKey: this.apiKey, apiUrl: this.apiUrl },
                    this.llmProvider
                );

                if (this.abortController?.signal.aborted) return;
                keepGoing = await this.processContent(finalContent, iterationCount);

            } catch (loopError: unknown) {
                const shouldContinue = await this.handleLoopError(loopError, iterationCount);
                if (!shouldContinue.continue) throw loopError;
                if (shouldContinue.decrementIteration) iterationCount--;
            }
        }
    }

    private validateConfig(): void {
        if (!String(this.apiKey || '').trim()) {
            throw AgentErrorHandler.createError('API Key 未配置', 401);
        }
        if (!String(this.model || '').trim()) {
            throw AgentErrorHandler.createError('模型未配置', 400);
        }
        if (!String(this.apiUrl || '').trim()) {
            throw AgentErrorHandler.createError('Base URL 未配置', 400);
        }
    }

    private async processContent(finalContent: Anthropic.ContentBlock[], iterationCount: number): Promise<boolean> {
        if (finalContent.length === 0) {
            this.stateManager.setStage('FEEDBACK');
            return false;
        }

        this.stateManager.addToHistory({ role: 'assistant', content: finalContent });
        this.notifyUpdate();

        const toolUses = finalContent.filter(c => c.type === 'tool_use');
        if (toolUses.length === 0) {
            this.stateManager.setStage('FEEDBACK');
            return false;
        }

        this.stateManager.setStage('PLANNING', { toolCount: toolUses.length });
        const toolResults = await this.executeTools(toolUses);

        this.stateManager.addToHistory({ role: 'user', content: toolResults });
        this.notifyUpdate();
        this.stateManager.setStage('THINKING', { iteration: iterationCount });

        return true;
    }

    private async executeTools(toolUses: Anthropic.ContentBlock[]): Promise<Anthropic.ToolResultBlockParam[]> {
        const results: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUses) {
            if (toolUse.type !== 'tool_use') continue;

            this.broadcast('agent:tool-call', {
                callId: toolUse.id,
                name: toolUse.name,
                input: toolUse.input as Record<string, unknown>
            });
            this.stateManager.setStage('EXECUTING', { tool: toolUse.name, toolUseId: toolUse.id });
            this.currentToolUseId = toolUse.id;

            let result = "Tool execution failed or unknown tool.";
            const startedAt = Date.now();

            try {
                result = await this.toolRegistry.executeTool(
                    toolUse.name,
                    toolUse.input as Record<string, unknown>
                );
                this.broadcast('agent:tool-result', { callId: toolUse.id, status: 'done' });
                this.eventSink?.logEvent('tool_executed', {
                    tool: toolUse.name, toolUseId: toolUse.id,
                    durationMs: Date.now() - startedAt, ok: true
                });
            } catch (toolErr: unknown) {
                result = `Error executing tool: ${(toolErr as Error).message}`;
                this.broadcast('agent:tool-result', {
                    callId: toolUse.id, status: 'error',
                    error: (toolErr as Error).message
                });
                this.eventSink?.logEvent('tool_executed', {
                    tool: toolUse.name, toolUseId: toolUse.id,
                    durationMs: Date.now() - startedAt, ok: false,
                    error: (toolErr as Error).message
                });
            }

            this.currentToolUseId = null;
            results.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result });
        }

        return results;
    }

    private async handleLoopError(error: unknown, _iterationCount: number): Promise<{ continue: boolean; decrementIteration?: boolean }> {
        if (AgentErrorHandler.isRateLimitError(error)) {
            await AgentErrorHandler.handleRateLimit(0);
            this.broadcast('agent:status', 'Rate limit hit, retrying...');
            return { continue: true, decrementIteration: true };
        }

        if (AgentErrorHandler.isSensitiveContentError(error)) {
            if (this.stateManager.hasExceededSensitiveContentRetries()) {
                this.broadcast('agent:error', `内容安全拦截次数过多，请修改输入后重试。`);
                return { continue: false };
            }

            const retryCount = this.stateManager.incrementSensitiveContentRetries();
            await AgentErrorHandler.handleRateLimit(retryCount);

            this.stateManager.addToHistory({
                role: 'user',
                content: AgentErrorHandler.buildSensitiveContentRetryMessage()
            });
            this.notifyUpdate();
            this.stateManager.manageHistory();

            return { continue: true };
        }

        return { continue: false };
    }

    private handleProcessingError(error: unknown): void {
        logs.agent.error('Agent Loop Error:', error);
        this.eventSink?.logEvent('error', {
            message: (error as Error).message || String(error),
            status: (error as AgentError).status
        });
        this.broadcast('agent:error', AgentErrorHandler.formatErrorMessage(error));
    }

    private async requestConfirmation(tool: string, description: string, args: Record<string, unknown>): Promise<boolean> {
        const path = (args?.path || args?.cwd) as string | undefined;

        if (configStore.hasPermission(tool, path)) return true;
        if (tool === 'write_file' && path && permissionManager.isPathAuthorized(path)) return true;

        const id = `confirm-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const token = createPendingConfirmation(id, tool, path || '');
        return this.uiBridge.requestConfirmation(id, { id, tool, description, args, token });
    }

    private async checkToolPermission(toolName: string, args: Record<string, unknown>): Promise<boolean> {
        const path = (args?.path || args?.cwd) as string | undefined;
        if (configStore.hasPermission(toolName, path)) return true;
        if (toolName === 'write_file' && path && permissionManager.isPathAuthorized(path)) return true;
        logs.agent.warn(`[executeToolDirectly] Permission denied for ${toolName}`);
        return false;
    }

    private buildTodoReminder(analysis: { complexity: string; reason: string; estimatedSteps?: number }): string {
        return `<SYSTEM REMINDER>
COMPLEX TASK DETECTED - TODO_WRITE USAGE REQUIRED
Task Analysis: Complexity: ${analysis.complexity.toUpperCase()}, Reason: ${analysis.reason}
ACTION REQUIRED: You MUST use the todo_write tool BEFORE proceeding.
</SYSTEM REMINDER>`;
    }

    private summarizeUserInput(input: string | { content: string, images: string[] }) {
        if (typeof input === 'string') {
            return { textPreview: input.slice(0, 2000), textLength: input.length, imageCount: 0 };
        }
        return {
            textPreview: (input.content || '').slice(0, 2000),
            textLength: (input.content || '').length,
            imageCount: input.images?.length || 0
        };
    }

    // Broadcast helpers
    public broadcast(channel: string, data: unknown) { this.uiBridge.broadcast(channel, data); }
    private notifyUpdate() { this.uiBridge.notifyHistoryUpdate(this.stateManager.getHistory()); }
}
