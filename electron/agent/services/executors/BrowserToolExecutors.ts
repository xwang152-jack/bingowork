/**
 * Browser Tool Executors
 *
 * Implements browser automation tools: browser_open, browser_snapshot, etc.
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
import { BrowserTools } from '../../tools/BrowserTools';
import { permissionManager } from '../../security/PermissionManager';
import { configStore } from '../../../config/ConfigStore';

// ============================================================================
// Browser Tool Schemas
// ============================================================================

const BrowserToolSchemas: Anthropic.Tool[] = [
    {
        name: 'browser_open',
        description: 'Open a URL in the browser automation tool.',
        input_schema: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'The URL to open' }
            },
            required: ['url']
        }
    },
    {
        name: 'browser_snapshot',
        description: 'Get a text snapshot of the current browser page contents based on the accessibility tree.',
        input_schema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'browser_click',
        description: 'Click on an element on the current browser page.',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'The selector of the element to click' }
            },
            required: ['selector']
        }
    },
    {
        name: 'browser_fill',
        description: 'Fill out a form element on the current browser page.',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'The selector of the element' },
                text: { type: 'string', description: 'The text to fill in' }
            },
            required: ['selector', 'text']
        }
    },
    {
        name: 'browser_type',
        description: 'Type text into an input element on the current browser page.',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'The selector of the element' },
                text: { type: 'string', description: 'The text to type' }
            },
            required: ['selector', 'text']
        }
    },
    {
        name: 'browser_press',
        description: 'Press a key or key combination in the browser.',
        input_schema: {
            type: 'object',
            properties: {
                key: { type: 'string', description: 'The key or key combination to press (e.g., Enter, Control+A)' }
            },
            required: ['key']
        }
    },
    {
        name: 'browser_scroll',
        description: 'Scroll the current browser page.',
        input_schema: {
            type: 'object',
            properties: {
                direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Scroll direction' },
                pixels: { type: 'number', description: 'Optional number of pixels to scroll' }
            },
            required: ['direction']
        }
    },
    {
        name: 'browser_screenshot',
        description: 'Take a screenshot of the current browser page and save it to a file.',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Optional path to save the screenshot' },
                fullPage: { type: 'boolean', description: 'Whether to capture the full page or just the viewport' }
            },
            required: []
        }
    },
    {
        name: 'browser_get_text',
        description: 'Get the text content of an element on the current browser page.',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'The selector of the element' }
            },
            required: ['selector']
        }
    },
    {
        name: 'browser_close',
        description: 'Close the browser.',
        input_schema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'browser_wait',
        description: 'Wait for a condition on the current browser page.',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'Optional selector to wait for' },
                ms: { type: 'number', description: 'Optional milliseconds to wait' },
                text: { type: 'string', description: 'Optional text to wait for' }
            },
            required: []
        }
    }
];

// ============================================================================
// Browser Tool Executors
// ============================================================================

abstract class BaseBrowserToolExecutor extends BaseToolExecutor {
    protected browserTools: BrowserTools;

    constructor(browserTools: BrowserTools) {
        super();
        this.browserTools = browserTools;
    }

    isAllowedInMode(_mode: 'chat' | 'code' | 'cowork'): boolean {
        return configStore.getNetworkAccess() && Boolean(configStore.get('browserAccess'));
    }

    protected resolveAuthorizedFilePath(inputPath: unknown, extension: string, prefix: string): { ok: true; path: string } | { ok: false; error: string } {
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
}

class BrowserOpenExecutor extends BaseBrowserToolExecutor {
    readonly name = 'browser_open';
    readonly schema = BrowserToolSchemas[0];

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        if (!configStore.getNetworkAccess()) {
            return 'Error: 当前已关闭网络访问，浏览器工具不可用。';
        }
        if (!configStore.get('browserAccess')) {
            return 'Error: 当前未启用浏览器访问，浏览器工具不可用。';
        }
        return await this.browserTools.open(input as { url: string });
    }
}

class BrowserSnapshotExecutor extends BaseBrowserToolExecutor {
    readonly name = 'browser_snapshot';
    readonly schema = BrowserToolSchemas[1];

    async execute(_input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        if (!configStore.getNetworkAccess()) {
            return 'Error: 当前已关闭网络访问，浏览器工具不可用。';
        }
        if (!configStore.get('browserAccess')) {
            return 'Error: 当前未启用浏览器访问，浏览器工具不可用。';
        }
        return await this.browserTools.snapshot();
    }
}

class BrowserClickExecutor extends BaseBrowserToolExecutor {
    readonly name = 'browser_click';
    readonly schema = BrowserToolSchemas[2];

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        if (!configStore.getNetworkAccess()) {
            return 'Error: 当前已关闭网络访问，浏览器工具不可用。';
        }
        if (!configStore.get('browserAccess')) {
            return 'Error: 当前未启用浏览器访问，浏览器工具不可用。';
        }
        return await this.browserTools.click(input as { selector: string });
    }
}

class BrowserFillExecutor extends BaseBrowserToolExecutor {
    readonly name = 'browser_fill';
    readonly schema = BrowserToolSchemas[3];

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        if (!configStore.getNetworkAccess()) {
            return 'Error: 当前已关闭网络访问，浏览器工具不可用。';
        }
        if (!configStore.get('browserAccess')) {
            return 'Error: 当前未启用浏览器访问，浏览器工具不可用。';
        }
        return await this.browserTools.fill(input as { selector: string; text: string });
    }
}

class BrowserTypeExecutor extends BaseBrowserToolExecutor {
    readonly name = 'browser_type';
    readonly schema = BrowserToolSchemas[4];

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        if (!configStore.getNetworkAccess()) {
            return 'Error: 当前已关闭网络访问，浏览器工具不可用。';
        }
        if (!configStore.get('browserAccess')) {
            return 'Error: 当前未启用浏览器访问，浏览器工具不可用。';
        }
        return await this.browserTools.type(input as { selector: string; text: string });
    }
}

class BrowserPressExecutor extends BaseBrowserToolExecutor {
    readonly name = 'browser_press';
    readonly schema = BrowserToolSchemas[5];

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        if (!configStore.getNetworkAccess()) {
            return 'Error: 当前已关闭网络访问，浏览器工具不可用。';
        }
        if (!configStore.get('browserAccess')) {
            return 'Error: 当前未启用浏览器访问，浏览器工具不可用。';
        }
        return await this.browserTools.press(input as { key: string });
    }
}

class BrowserScrollExecutor extends BaseBrowserToolExecutor {
    readonly name = 'browser_scroll';
    readonly schema = BrowserToolSchemas[6];

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        if (!configStore.getNetworkAccess()) {
            return 'Error: 当前已关闭网络访问，浏览器工具不可用。';
        }
        if (!configStore.get('browserAccess')) {
            return 'Error: 当前未启用浏览器访问，浏览器工具不可用。';
        }
        return await this.browserTools.scroll(input as { direction: string; pixels?: number });
    }
}

class BrowserScreenshotExecutor extends BaseBrowserToolExecutor {
    readonly name = 'browser_screenshot';
    readonly schema = BrowserToolSchemas[7];

    async execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolResult> {
        if (!configStore.getNetworkAccess()) {
            return 'Error: 当前已关闭网络访问，浏览器工具不可用。';
        }
        if (!configStore.get('browserAccess')) {
            return 'Error: 当前未启用浏览器访问，浏览器工具不可用。';
        }

        const args = input as { path?: string; fullPage?: boolean };
        const resolved = this.resolveAuthorizedFilePath(args?.path, '.png', 'browser_screenshot');
        if (!resolved.ok) return resolved.error;

        const approved = await context.requestConfirmation(
            this.name,
            `Save screenshot: ${resolved.path}`,
            { ...args, path: resolved.path }
        );

        if (!approved) return 'User denied the operation.';

        const dir = path.dirname(resolved.path);
        try { fs.mkdirSync(dir, { recursive: true }); } catch { void 0; }

        return await this.browserTools.screenshot({ ...args, path: resolved.path });
    }
}

class BrowserGetTextExecutor extends BaseBrowserToolExecutor {
    readonly name = 'browser_get_text';
    readonly schema = BrowserToolSchemas[8];

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        if (!configStore.getNetworkAccess()) {
            return 'Error: 当前已关闭网络访问，浏览器工具不可用。';
        }
        if (!configStore.get('browserAccess')) {
            return 'Error: 当前未启用浏览器访问，浏览器工具不可用。';
        }
        return await this.browserTools.getText(input as { selector: string });
    }
}

class BrowserCloseExecutor extends BaseBrowserToolExecutor {
    readonly name = 'browser_close';
    readonly schema = BrowserToolSchemas[9];

    async execute(_input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        if (!configStore.getNetworkAccess()) {
            return 'Error: 当前已关闭网络访问，浏览器工具不可用。';
        }
        if (!configStore.get('browserAccess')) {
            return 'Error: 当前未启用浏览器访问，浏览器工具不可用。';
        }
        return await this.browserTools.close();
    }
}

class BrowserWaitExecutor extends BaseBrowserToolExecutor {
    readonly name = 'browser_wait';
    readonly schema = BrowserToolSchemas[10];

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        if (!configStore.getNetworkAccess()) {
            return 'Error: 当前已关闭网络访问，浏览器工具不可用。';
        }
        if (!configStore.get('browserAccess')) {
            return 'Error: 当前未启用浏览器访问，浏览器工具不可用。';
        }
        return await this.browserTools.wait(input as { selector?: string; ms?: number; text?: string });
    }
}

// ============================================================================
// Export Factory
// ============================================================================

export function createBrowserToolExecutors(browserTools: BrowserTools): ToolExecutor[] {
    return [
        new BrowserOpenExecutor(browserTools),
        new BrowserSnapshotExecutor(browserTools),
        new BrowserClickExecutor(browserTools),
        new BrowserFillExecutor(browserTools),
        new BrowserTypeExecutor(browserTools),
        new BrowserPressExecutor(browserTools),
        new BrowserScrollExecutor(browserTools),
        new BrowserScreenshotExecutor(browserTools),
        new BrowserGetTextExecutor(browserTools),
        new BrowserCloseExecutor(browserTools),
        new BrowserWaitExecutor(browserTools)
    ];
}

export { BrowserToolSchemas };
