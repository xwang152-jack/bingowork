/**
 * File System Tool Executors
 *
 * Implements file system tools: read_file, write_file, list_dir, run_command
 */

import path from 'path';
import {
    ToolExecutor,
    ToolExecutionContext,
    ToolInput,
    ToolResult,
    BaseToolExecutor
} from '../ToolExecutor';
import Anthropic from '@anthropic-ai/sdk';
import { FileSystemTools } from '../../tools/FileSystemTools';
import { permissionManager } from '../../security/PermissionManager';
import { configStore } from '../../../config/ConfigStore';

// ============================================================================
// read_file Tool
// ============================================================================

const ReadFileSchema: Anthropic.Tool = {
    name: 'read_file',
    description: 'Read the complete contents of a file from the filesystem. Returns the full file contents as a text string.',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The path of the file to read'
            }
        },
        required: ['path']
    }
};

class ReadFileExecutor extends BaseToolExecutor {
    readonly name = 'read_file';
    readonly schema = ReadFileSchema;
    private fsTools: FileSystemTools;

    constructor(fsTools: FileSystemTools) {
        super();
        this.fsTools = fsTools;
    }

    isAllowedInMode(mode: 'chat' | 'code' | 'cowork'): boolean {
        return mode !== 'chat'; // Not available in chat mode
    }

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        const args = input as { path: string };
        const absPath = this.resolveAbsolutePath(args.path);

        if (!permissionManager.isPathAuthorized(absPath)) {
            return `Error: Path ${absPath} is not in an authorized folder.`;
        }

        return await this.fsTools.readFile({ path: absPath });
    }

    private resolveAbsolutePath(inputPath: string): string {
        const raw = String(inputPath || '').trim().replace(/^["']|["']$/g, '');
        const isWindowsAbs = /^[A-Za-z]:[\\/]/.test(raw);
        const isAbs = isWindowsAbs || path.isAbsolute(raw);
        if (isAbs) return path.normalize(raw);

        const authorizedFolders = permissionManager.getAuthorizedFolders();
        const baseDir = authorizedFolders[0] || process.cwd();

        // Security: Prevent path traversal attacks
        const resolved = path.resolve(baseDir, raw);
        const normalizedBase = path.normalize(baseDir);

        // Ensure resolved path is within the authorized folder
        if (!resolved.startsWith(normalizedBase)) {
            throw new Error(`Path traversal detected: ${raw} resolves outside authorized directory`);
        }

        return resolved;
    }
}

// ============================================================================
// write_file Tool
// ============================================================================

const WriteFileSchema: Anthropic.Tool = {
    name: 'write_file',
    description: 'Write content to a file at the specified path. Creates the file if it does not exist, or overwrites if it does.',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The path of the file to write to'
            },
            content: {
                type: 'string',
                description: 'The content to write to the file'
            }
        },
        required: ['path', 'content']
    }
};

class WriteFileExecutor extends BaseToolExecutor {
    readonly name = 'write_file';
    readonly schema = WriteFileSchema;
    private fsTools: FileSystemTools;

    constructor(fsTools: FileSystemTools) {
        super();
        this.fsTools = fsTools;
    }

    isAllowedInMode(mode: 'chat' | 'code' | 'cowork'): boolean {
        return mode !== 'chat'; // Not available in chat mode
    }

    async execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolResult> {
        const args = input as { path: string; content: string };
        const absPath = this.resolveAbsolutePath(args.path);

        if (!permissionManager.isPathAuthorized(absPath)) {
            return `Error: Path ${absPath} is not in an authorized folder.`;
        }

        const approved = await context.requestConfirmation(
            this.name,
            `Write to file: ${absPath}`,
            { ...args, path: absPath }
        );

        if (!approved) {
            return 'User denied the write operation.';
        }

        const result = await this.fsTools.writeFile({ ...args, path: absPath });
        const fileName = absPath.split(/[\\/]/).pop() || 'file';
        context.onArtifactCreated({ path: absPath, name: fileName, type: 'file' });

        return result;
    }

    private resolveAbsolutePath(inputPath: string): string {
        const raw = String(inputPath || '').trim().replace(/^["']|["']$/g, '');
        const isWindowsAbs = /^[A-Za-z]:[\\/]/.test(raw);
        const isAbs = isWindowsAbs || path.isAbsolute(raw);
        if (isAbs) return path.normalize(raw);

        const authorizedFolders = permissionManager.getAuthorizedFolders();
        const baseDir = authorizedFolders[0] || process.cwd();

        // Security: Prevent path traversal attacks
        const resolved = path.resolve(baseDir, raw);
        const normalizedBase = path.normalize(baseDir);

        if (!resolved.startsWith(normalizedBase)) {
            throw new Error(`Path traversal detected: ${raw} resolves outside authorized directory`);
        }

        return resolved;
    }
}

// ============================================================================
// list_dir Tool
// ============================================================================

const ListDirSchema: Anthropic.Tool = {
    name: 'list_dir',
    description: 'Get a detailed listing of the contents of a directory. Returns a list of files and subdirectories.',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The path of the directory to list'
            }
        },
        required: ['path']
    }
};

class ListDirExecutor extends BaseToolExecutor {
    readonly name = 'list_dir';
    readonly schema = ListDirSchema;
    private fsTools: FileSystemTools;

    constructor(fsTools: FileSystemTools) {
        super();
        this.fsTools = fsTools;
    }

    isAllowedInMode(mode: 'chat' | 'code' | 'cowork'): boolean {
        return mode !== 'chat'; // Not available in chat mode
    }

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        const args = input as { path: string };
        const absPath = this.resolveAbsolutePath(args.path);

        if (!permissionManager.isPathAuthorized(absPath)) {
            return `Error: Path ${absPath} is not in an authorized folder.`;
        }

        return await this.fsTools.listDir({ path: absPath });
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
}

// ============================================================================
// run_command Tool
// ============================================================================

const RunCommandSchema: Anthropic.Tool = {
    name: 'run_command',
    description: 'Execute a shell command in the specified directory and return the output.',
    input_schema: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The shell command to execute'
            },
            cwd: {
                type: 'string',
                description: 'The working directory in which to execute the command. Defaults to the first authorized folder if not specified.'
            }
        },
        required: ['command']
    }
};

class RunCommandExecutor extends BaseToolExecutor {
    readonly name = 'run_command';
    readonly schema = RunCommandSchema;
    private fsTools: FileSystemTools;

    constructor(fsTools: FileSystemTools) {
        super();
        this.fsTools = fsTools;
    }

    isAllowedInMode(mode: 'chat' | 'code' | 'cowork'): boolean {
        return mode !== 'chat'; // Not available in chat mode
    }

    validate(input: ToolInput): { ok: true } | { ok: false; error: string } {
        const args = input as { command: string };
        return this.validateRunCommand(args.command, configStore.getNetworkAccess());
    }

    async execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolResult> {
        const args = input as { command: string; cwd?: string };
        const authorizedFolders = permissionManager.getAuthorizedFolders();

        if (authorizedFolders.length === 0) {
            return 'Error: 尚未选择授权目录，无法执行命令。';
        }

        const defaultCwd = authorizedFolders[0];
        const resolvedCwd = args.cwd ? this.resolveAbsolutePath(args.cwd) : defaultCwd;

        if (!permissionManager.isPathAuthorized(resolvedCwd)) {
            return `Error: cwd ${resolvedCwd} 不在授权目录中。`;
        }

        const validation = this.validateRunCommand(args.command, configStore.getNetworkAccess());
        if (!validation.ok) return validation.error;

        const approved = await context.requestConfirmation(
            this.name,
            `Execute command: ${args.command}`,
            { ...args, cwd: resolvedCwd }
        );

        if (!approved) {
            return 'User denied the command execution.';
        }

        const streamCallback = context.onToolStream || (() => {});
        return await this.fsTools.runCommandStream(
            { ...args, cwd: resolvedCwd },
            defaultCwd,
            streamCallback
        );
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

    private validateRunCommand(command: unknown, networkAccessEnabled: boolean): { ok: true } | { ok: false; error: string } {
        const cmd = String(command || '').trim();
        if (!cmd) return { ok: false, error: 'Error: command 不能为空。' };
        if (cmd.length > 8000) return { ok: false, error: 'Error: command 过长，已拒绝执行。' };
        if (cmd.includes('\u0000')) return { ok: false, error: 'Error: command 包含非法字符，已拒绝执行。' };

        const dangerousPatterns: RegExp[] = [
            /(^|\s)sudo(\s|$)/i,
            /(^|\s)su(\s|$)/i,
            /(^|\s)shutdown(\s|$)/i,
            /(^|\s)reboot(\s|$)/i,
            /(^|\s)halt(\s|$)/i,
            /(^|\s)poweroff(\s|$)/i,
            /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, // Fork bomb
            /(^|\s)rm\s+-rf\s+\/(\s|$)/i,
            /(^|\s)rm\s+-rf\s+--no-preserve-root(\s|$)/i,
            /(^|\s)mkfs(\.|(\s|$))/i,
            /(^|\s)diskutil\s+erase(disk|volume)(\s|$)/i,
            /(^|\s)dd\s+if=/i,
            /(^|\s)reg\s+delete(\s|$)/i,
            /(^|\s)bcdedit(\s|$)/i,
            /(^|\s)crontab(\s|$)/i,
            /(^|\s)chattr(\s|$)/i,
            /(^|\s)passwd(\s|$)/i,
            /(^|\s)visudo(\s|$)/i,
            /(^|\s)userdel(\s|$)/i,
            /(^|\s)groupdel(\s|$)/i,
        ];

        for (const re of dangerousPatterns) {
            if (re.test(cmd)) {
                return { ok: false, error: 'Error: 检测到高风险系统命令，已强制拦截。' };
            }
        }

        const sensitivePaths = [
            '/etc/', '/usr/bin/', '/usr/sbin/', '/bin/', '/sbin/', '/var/root/',
            '/private/etc/', '/private/var/root/',
            '.ssh/', '.bashrc', '.zshrc', '.bash_profile', '.profile', '.bash_history',
            '.zsh_history', '.env'
        ];

        if (/>>|>\s*|\|\s*tee\s+/i.test(cmd)) {
            const lowered = cmd.toLowerCase();
            for (const p of sensitivePaths) {
                if (lowered.includes(p.toLowerCase())) {
                    return { ok: false, error: `Error: 检测到尝试修改敏感路径 (${p})，已强制拦截。` };
                }
            }
        }

        const downloadAndExecPatterns: RegExp[] = [
            /(curl|wget)\b[^|]*\|\s*(sh|bash|zsh|python|node|perl|ruby|php)\b/i,
            /(powershell|pwsh)\b.*\b(iwr|invoke-webrequest)\b.*\|\s*(iex|invoke-expression)\b/i,
        ];

        for (const re of downloadAndExecPatterns) {
            if (re.test(cmd)) {
                return { ok: false, error: 'Error: 检测到下载并直接执行链路，已强制拦截。' };
            }
        }

        if (!networkAccessEnabled) {
            const networkTokens = [
                'curl', 'wget', 'git', 'npm', 'yarn', 'pnpm', 'pip', 'pip3', 'brew',
                'apt', 'apt-get', 'yum', 'dnf', 'pacman', 'powershell', 'pwsh',
                'Invoke-WebRequest'.toLowerCase(), 'iwr', 'nc', 'ncat', 'telnet', 'ssh', 'scp', 'sftp',
                'ping', 'nslookup', 'dig', 'host', 'traceroute'
            ];
            const tokens = cmd.split(/[\s|&;><]+/);
            if (tokens.some(t => networkTokens.includes(t.toLowerCase()))) {
                return { ok: false, error: 'Error: 当前已关闭网络访问，已拒绝可能联网的命令。' };
            }
        }

        return { ok: true };
    }
}

// ============================================================================
// Export Factory
// ============================================================================

export function createFileSystemToolExecutors(fsTools: FileSystemTools): ToolExecutor[] {
    return [
        new ReadFileExecutor(fsTools),
        new WriteFileExecutor(fsTools),
        new ListDirExecutor(fsTools),
        new RunCommandExecutor(fsTools)
    ];
}

export { ReadFileSchema, WriteFileSchema, ListDirSchema, RunCommandSchema };
