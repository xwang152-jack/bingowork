/**
 * ToolRegistry - Refactored with Plugin-based Architecture
 *
 * This module manages tool registration and execution using a plugin-based
 * architecture. Tools are registered as executors and can be dynamically
 * loaded/unloaded.
 */

import Anthropic from '@anthropic-ai/sdk';
import { FileSystemTools } from '../tools/FileSystemTools';
import { BrowserTools } from '../tools/BrowserTools';
import { SkillManager } from '../skills/SkillManager';
import { MCPClientService } from '../mcp/MCPClientService';
import { configStore, WorkMode } from '../../config/ConfigStore';

// Import executor system
import {
    ToolExecutor,
    ToolExecutionContext,
    toolExecutorRegistry
} from './ToolExecutor';

// Import executor factories
import { coreToolExecutors } from './executors/CoreToolExecutors';
import { createFileSystemToolExecutors } from './executors/FileSystemToolExecutors';
import { createBrowserToolExecutors } from './executors/BrowserToolExecutors';
import { createSkillToolExecutors, isSkillTool } from './executors/SkillToolExecutor';
import { createMCPToolExecutors, isMCPTool } from './executors/MCPToolExecutor';

// ============================================================================
// Public Interfaces
// ============================================================================

export interface ToolCallbacks {
    requestConfirmation: (tool: string, description: string, args: Record<string, unknown>) => Promise<boolean>;
    onArtifactCreated: (artifact: { path: string; name: string; type: string }) => void;
    askUser: (question: string, options?: string[]) => Promise<string>;
    onToolStream?: (chunk: string, type: 'stdout' | 'stderr') => void;
}

// ============================================================================
// ToolRegistry Class
// ============================================================================

export class ToolRegistry {
    // Store executor references
    private coreToolExecutors: ToolExecutor[];
    private fsToolExecutors: ToolExecutor[];
    private browserToolExecutors: ToolExecutor[];

    // Dynamic tool caches
    private skillToolExecutors: ToolExecutor[] = [];
    private mcpToolExecutors: ToolExecutor[] = [];

    constructor(
        fsTools: FileSystemTools,
        browserTools: BrowserTools,
        private skillManager: SkillManager,
        private mcpService: MCPClientService,
        private getWorkMode: () => WorkMode,
        private callbacks: ToolCallbacks
    ) {
        // Register static tool executors
        this.coreToolExecutors = coreToolExecutors;
        this.fsToolExecutors = createFileSystemToolExecutors(fsTools);
        this.browserToolExecutors = createBrowserToolExecutors(browserTools);

        // Register all executors to the global registry
        this.registerExecutors();
    }

    private registerExecutors(): void {
        // Register core tools
        for (const executor of this.coreToolExecutors) {
            toolExecutorRegistry.register(executor);
        }

        // Register file system tools
        for (const executor of this.fsToolExecutors) {
            toolExecutorRegistry.register(executor);
        }

        // Register browser tools
        for (const executor of this.browserToolExecutors) {
            toolExecutorRegistry.register(executor);
        }
    }

    /**
     * Load dynamic tools (skills and MCP)
     * This should be called after skills and MCP clients are loaded
     */
    async loadDynamicTools(): Promise<void> {
        // Load skill executors
        this.skillToolExecutors = createSkillToolExecutors(this.skillManager);
        for (const executor of this.skillToolExecutors) {
            toolExecutorRegistry.register(executor);
        }

        // Load MCP executors
        this.mcpToolExecutors = await createMCPToolExecutors(this.mcpService);
        for (const executor of this.mcpToolExecutors) {
            toolExecutorRegistry.register(executor);
        }
    }

    /**
     * Get all available tools for the current work mode
     */
    async getTools(): Promise<Anthropic.Tool[]> {
        const mode = this.getWorkMode();

        if (mode === 'chat') {
            // In chat mode, only ask_user_question is available
            return toolExecutorRegistry.getSchemasForMode(mode);
        }

        // Ensure dynamic tools are loaded
        if (this.skillToolExecutors.length === 0 || this.mcpToolExecutors.length === 0) {
            await this.loadDynamicTools();
        }

        return toolExecutorRegistry.getSchemasForMode(mode);
    }

    /**
     * Execute a tool by name
     */
    async executeTool(
        name: string,
        input: Record<string, unknown>,
        streamCallback?: (chunk: string, type: 'stdout' | 'stderr') => void
    ): Promise<string> {
        const mode = this.getWorkMode();

        // Special handling for ask_user_question (requires callback)
        if (name === 'ask_user_question') {
            const args = input as { question: string; options?: string[] };
            return await this.callbacks.askUser(args.question, args.options);
        }

        // Find the executor for this tool
        const executor = toolExecutorRegistry.get(name);

        if (!executor) {
            // Fallback to legacy implementation for MCP and Skills
            // This maintains backward compatibility during migration
            if (isMCPTool(name)) {
                if (!configStore.getNetworkAccess()) {
                    return 'Error: 当前已关闭网络访问，MCP 工具不可用。';
                }
                return await this.mcpService.callTool(name, input);
            }

            if (isSkillTool(name, this.skillManager)) {
                const skillInfo = this.skillManager.getSkillInfo(name);
                if (skillInfo) {
                    return `[SKILL LOADED: ${name}]

SKILL DIRECTORY: ${skillInfo.skillDir}

Follow these instructions to complete the user's request. When the instructions reference Python modules in core/, create your script in the working directory and run it from the skill directory:

run_command: cd "${skillInfo.skillDir}" && python /path/to/your_script.py

Or add to the top of your script:
import sys; sys.path.insert(0, r"${skillInfo.skillDir}")

---
${skillInfo.instructions}
---`;
                }
            }

            return `Error: Unknown tool: ${name}`;
        }

        // Check if tool is allowed in current mode
        if (!executor.isAllowedInMode(mode)) {
            const label = mode === 'chat' ? 'Chat' : mode === 'code' ? 'Code' : 'Cowork';
            return `Error: 当前为 ${label} 模式，工具 ${name} 不可用。`;
        }

        // Validate input if validator is provided
        if (executor.validate) {
            const validation = executor.validate(input);
            if (!validation.ok) {
                return validation.error;
            }
        }

        // Build execution context
        const context: ToolExecutionContext = {
            requestConfirmation: this.callbacks.requestConfirmation,
            onArtifactCreated: this.callbacks.onArtifactCreated,
            onToolStream: streamCallback || this.callbacks.onToolStream
        };

        // Execute the tool
        try {
            return await executor.execute(input, context);
        } catch (error) {
            const err = error as Error;
            return `Error executing tool ${name}: ${err.message}`;
        }
    }

    /**
     * Check if a tool exists
     */
    hasTool(name: string): boolean {
        return toolExecutorRegistry.has(name);
    }

    /**
     * Get all registered tool names
     */
    getToolNames(): string[] {
        return toolExecutorRegistry.getAllNames();
    }
}
