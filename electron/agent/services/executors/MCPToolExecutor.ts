/**
 * MCP Tool Executor
 *
 * Handles MCP (Model Context Protocol) tools with server__tool naming
 */

import fs from 'fs';
import path from 'path';
import {
    ToolExecutor,
    ToolExecutionContext,
    ToolInput,
    ToolResult,
    BaseToolExecutor
} from '../ToolExecutor';
import Anthropic from '@anthropic-ai/sdk';
import { MCPClientService } from '../../mcp/MCPClientService';
import { configStore } from '../../../config/ConfigStore';
import { permissionManager } from '../../security/PermissionManager';
import { logs } from '../../../utils/logger';

// ============================================================================
// MCP Tool Executor
// ============================================================================

class MCPToolExecutor extends BaseToolExecutor {
    readonly name: string;
    readonly schema: Anthropic.Tool;

    constructor(
        private mcpService: MCPClientService,
        private serverName: string,
        private toolName: string,
        schema: Anthropic.Tool
    ) {
        super();
        this.name = `${serverName}__${toolName}`;
        this.schema = schema;
    }

    isAllowedInMode(_mode: 'chat' | 'code' | 'cowork'): boolean {
        return configStore.getNetworkAccess(); // Only available when network is enabled
    }

    async execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolResult> {
        if (!configStore.getNetworkAccess()) {
            return 'Error: 当前已关闭网络访问，MCP 工具不可用。';
        }

        // Handle playwright_screenshot specially to ensure file is saved in authorized directory
        if (this.serverName === 'playwright' && this.toolName === 'playwright_screenshot') {
            return await this.handlePlaywrightScreenshot(input, context);
        }

        return await this.mcpService.callTool(this.name, input);
    }

    private async handlePlaywrightScreenshot(input: ToolInput, context: ToolExecutionContext): Promise<ToolResult> {
        const args = input as { path?: string } & Record<string, unknown>;
        const resolved = this.resolveAuthorizedFilePath(args?.path, '.png', 'playwright_screenshot');
        if (!resolved.ok) return resolved.error;

        const finalPath = resolved.path;
        const approved = await context.requestConfirmation(
            this.name,
            `Save screenshot: ${finalPath}`,
            { ...args, path: finalPath }
        );

        if (!approved) return 'User denied the operation.';

        // Ensure directory exists
        const dir = path.dirname(finalPath);
        try { fs.mkdirSync(dir, { recursive: true }); } catch { void 0; }

        // Call MCP tool WITHOUT path parameter to get base64 in memory
        const result = await this.mcpService.callTool(this.name, args);

        // Try to extract base64 and save to our authorized location
        try {
            const parsed = JSON.parse(String(result || '')) as unknown;
            const base64 = this.extractImageBase64FromMcpResult(parsed);

            if (base64) {
                fs.writeFileSync(finalPath, Buffer.from(base64, 'base64'));
                logs.agent.info(`[MCPToolExecutor] Saved screenshot from base64 to: ${finalPath}`);

                // Update the result message to reflect the correct path
                const resultStr = String(result);
                const updatedResult = resultStr.replace(
                    /saved to:\s*[^\s\n]+/i,
                    `saved to: ${finalPath}`
                );
                return updatedResult;
            } else {
                logs.agent.warn('[MCPToolExecutor] No base64 data found in playwright_screenshot result');
            }
        } catch (e) {
            logs.agent.error('[MCPToolExecutor] Error processing screenshot result:', e);
        }

        return result;
    }

    private resolveAuthorizedFilePath(inputPath: unknown, extension: string, prefix: string): { ok: true; path: string } | { ok: false; error: string } {
        const raw = typeof inputPath === 'string' ? inputPath : '';
        if (!raw.trim()) {
            return this.buildDefaultFilePath(extension, prefix);
        }
        const absPath = this.resolveAbsolutePath(raw);
        if (!permissionManager.isPathAuthorized(absPath)) {
            return { ok: false, error: `Error: Path ${absPath} 不在授权目录中。` };
        }
        const ext = extension.startsWith('.') ? extension : `.${extension}`;
        if (path.extname(absPath).toLowerCase() !== ext.toLowerCase()) {
            return { ok: true, path: `${absPath}${ext}` };
        }
        return { ok: true, path: absPath };
    }

    private resolveAbsolutePath(inputPath: string): string {
        const raw = String(inputPath || '').trim().replace(/^["']|["']$/g, '');
        const isWindowsAbs = /^[A-Za-z]:[\\/]/.test(raw);
        const isAbs = isWindowsAbs || path.isAbsolute(raw);
        if (isAbs) return path.normalize(raw);

        const authorizedFolders = permissionManager.getAuthorizedFolders();
        const baseDir = authorizedFolders[0] || process.cwd();

        const resolved = path.resolve(baseDir, raw);
        const normalizedBase = path.normalize(baseDir);

        if (!resolved.startsWith(normalizedBase)) {
            throw new Error(`Path traversal detected: ${raw} resolves outside authorized directory`);
        }

        return resolved;
    }

    private buildDefaultFilePath(extension: string, prefix: string): { ok: true; path: string } | { ok: false; error: string } {
        const authorizedFolders = permissionManager.getAuthorizedFolders();
        const baseDir = authorizedFolders[0];
        if (!baseDir) return { ok: false, error: 'Error: 尚未选择授权目录，无法保存文件。' };
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const safePrefix = String(prefix || 'file').replace(/[^\w.-]+/g, '_');
        const ext = extension.startsWith('.') ? extension : `.${extension}`;
        return { ok: true, path: path.join(baseDir, `${safePrefix}-${ts}${ext}`) };
    }

    private extractImageBase64FromMcpResult(parsed: unknown): string | null {
        const seen = new WeakSet<object>();

        const normalize = (s: string): string => {
            const v = s.trim();
            if (v.startsWith('data:')) {
                const idx = v.indexOf('base64,');
                return idx >= 0 ? v.slice(idx + 'base64,'.length) : v;
            }
            return v;
        };

        const walk = (node: unknown): string | null => {
            if (!node) return null;
            if (typeof node !== 'object') return null;
            if (seen.has(node as object)) return null;
            seen.add(node as object);

            if (Array.isArray(node)) {
                for (const item of node) {
                    const r = walk(item);
                    if (r) return r;
                }
                return null;
            }

            const obj = node as Record<string, unknown>;
            const typeVal = obj.type;
            const isImage = typeof typeVal === 'string' ? typeVal.toLowerCase() === 'image' || typeVal.toLowerCase().startsWith('image/') : false;
            if (isImage) {
                const direct = obj.data ?? obj.base64;
                if (typeof direct === 'string' && direct.trim()) return normalize(direct);
                if (direct && typeof direct === 'object') {
                    const d = direct as Record<string, unknown>;
                    const inner = d.base64 ?? d.data;
                    if (typeof inner === 'string' && inner.trim()) return normalize(inner);
                }
            }

            for (const v of Object.values(obj)) {
                const r = walk(v);
                if (r) return r;
            }
            return null;
        };

        return walk(parsed);
    }
}

// ============================================================================
// Dynamic MCP Tool Executor Factory
// ============================================================================

/**
 * Create MCP tool executors dynamically from available MCP tools
 * This is called after MCP clients are loaded
 */
export async function createMCPToolExecutors(mcpService: MCPClientService): Promise<ToolExecutor[]> {
    const tools = await mcpService.getTools();
    const executors: ToolExecutor[] = [];

    for (const tool of tools) {
        const name = (tool as any).name as string;
        if (name.includes('__')) {
            const [serverName, toolName] = name.split('__');
            executors.push(new MCPToolExecutor(mcpService, serverName, toolName, tool as Anthropic.Tool));
        }
    }

    return executors;
}

/**
 * Check if a tool name is an MCP tool
 */
export function isMCPTool(name: string): boolean {
    return name.includes('__');
}

/**
 * Extract server name and tool name from MCP tool name
 */
export function parseMCPToolName(name: string): { serverName: string; toolName: string } | null {
    if (name.includes('__')) {
        const [serverName, toolName] = name.split('__');
        return { serverName, toolName };
    }
    return null;
}
