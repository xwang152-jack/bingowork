/**
 * File System Tool Executors
 *
 * Implements file system tools: read_file, write_file, list_dir, run_command
 * SECURITY: Enhanced with path traversal protection and authorization validation
 */

import path from 'path';
import * as fs from 'fs';
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
// Shared Security Functions
// ============================================================================

/**
 * SECURITY: Resolve and validate absolute path with authorization check
 * This function prevents path traversal attacks and ensures all paths are within authorized folders
 *
 * @param inputPath - The user-provided path (can be relative or absolute)
 * @returns The resolved absolute path
 * @throws Error if path is outside authorized folders or contains traversal patterns
 */
function resolveAndValidatePath(inputPath: string): string {
  // Step 1: Clean and validate input
  const raw = String(inputPath || '').trim().replace(/^["']|["']$/g, '');

  if (!raw) {
    throw new Error('Path cannot be empty');
  }

  // SECURITY: Check for path traversal patterns BEFORE any resolution
  const traversalPatterns = ['../', '..\\', '%2e%2e', '%252e'];
  for (const pattern of traversalPatterns) {
    if (raw.toLowerCase().includes(pattern)) {
      throw new Error(`Path traversal detected: pattern "${pattern}" found in path`);
    }
  }

  // SECURITY: Check for null bytes
  if (raw.includes('\u0000')) {
    throw new Error('Null byte detected in path');
  }

  // SECURITY: Limit path length
  if (raw.length > 1000) {
    throw new Error('Path too long (max 1000 characters)');
  }

  // Step 2: Normalize the path
  let normalizedPath: string;
  try {
    normalizedPath = path.normalize(raw);
  } catch (e) {
    throw new Error(`Invalid path format: ${(e as Error).message}`);
  }

  // Step 3: Convert to absolute path
  const isAbs = path.isAbsolute(normalizedPath);
  let absolutePath: string;

  if (isAbs) {
    absolutePath = normalizedPath;
  } else {
    // For relative paths, resolve against the first authorized folder
    const authorizedFolders = permissionManager.getAuthorizedFolders();
    if (authorizedFolders.length === 0) {
      throw new Error('No authorized folders configured. Please authorize a folder first.');
    }
    const baseDir = authorizedFolders[0];
    absolutePath = path.resolve(baseDir, normalizedPath);
  }

  // Step 4: Windows path case normalization
  // Windows paths are case-insensitive, so we normalize for comparison
  const normalizedForComparison = process.platform === 'win32'
    ? absolutePath.toLowerCase()
    : absolutePath;

  // Step 5: Validate against authorized folders
  const authorizedFolders = permissionManager.getAuthorizedFolders();
  let isAuthorized = false;

  for (const folder of authorizedFolders) {
    const normalizedFolder = process.platform === 'win32'
      ? folder.toLowerCase()
      : folder;

    // Check if path is exactly the authorized folder or within it
    if (normalizedForComparison === normalizedFolder ||
        normalizedForComparison.startsWith(normalizedFolder + path.sep)) {
      isAuthorized = true;

      // SECURITY: Check for symbolic link attacks
      try {
        if (fs.existsSync(absolutePath)) {
          const stats = fs.lstatSync(absolutePath);
          if (stats.isSymbolicLink()) {
            const target = fs.readlinkSync(absolutePath);
            const resolvedTarget = path.resolve(path.dirname(absolutePath), target);
            const targetNormalized = process.platform === 'win32'
              ? resolvedTarget.toLowerCase()
              : resolvedTarget;

            // Verify symlink target is also within authorized folder
            if (!targetNormalized.startsWith(normalizedFolder + path.sep) &&
                targetNormalized !== normalizedFolder) {
              throw new Error(`Symbolic link points outside authorized directory: ${target}`);
            }
          }
        }
      } catch (e) {
        // File doesn't exist yet or cannot access, continue
        const fsError = e as NodeJS.ErrnoException;
        if (fsError.code !== 'ENOENT' && fsError.code !== 'EACCES') {
          throw new Error(`Failed to check path: ${fsError.message}`);
        }
      }

      break;
    }
  }

  if (!isAuthorized) {
    throw new Error(
      `Path "${absolutePath}" is not in an authorized folder. ` +
      `Authorized folders: ${authorizedFolders.join(', ')}`
    );
  }

  // SECURITY: Final sanity check - ensure no parent directory references
  const parts = absolutePath.split(path.sep);
  for (const part of parts) {
    if (part === '..') {
      throw new Error('Path traversal detected: parent directory reference found');
    }
  }

  return absolutePath;
}

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

        // SECURITY: Use shared path validation function
        const absPath = resolveAndValidatePath(args.path);

        return await this.fsTools.readFile({ path: absPath });
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

        // SECURITY: Use shared path validation function
        const absPath = resolveAndValidatePath(args.path);

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

        // SECURITY: Use shared path validation function
        const absPath = resolveAndValidatePath(args.path);

        return await this.fsTools.listDir({ path: absPath });
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

        // SECURITY: Use shared path validation function for cwd
        const resolvedCwd = args.cwd ? resolveAndValidatePath(args.cwd) : defaultCwd;

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

    /**
     * SECURITY: Enhanced command validation with multiple layers of protection
     * This prevents command injection, regex bypass, and encoding attacks
     */
    private validateRunCommand(command: unknown, networkAccessEnabled: boolean): { ok: true } | { ok: false; error: string } {
        const cmd = String(command || '').trim();

        // Basic validation
        if (!cmd) return { ok: false, error: 'Error: command 不能为空。' };
        if (cmd.length > 8000) return { ok: false, error: 'Error: command 过长，已拒绝执行。' };
        if (cmd.includes('\u0000')) return { ok: false, error: 'Error: command 包含非法字符，已拒绝执行。' };

        // SECURITY: Step 1 - Preprocess command to remove comments and detect dangerous patterns
        const preprocessResult = this.preprocessCommand(cmd);
        if (!preprocessResult.ok) {
            return preprocessResult;
        }

        const processedCmd = preprocessResult.normalized;

        // SECURITY: Step 2 - Split into statements and check each one
        const statements = this.splitCommandStatements(processedCmd);

        for (const stmt of statements) {
            // SECURITY: Step 3 - Check for dangerous commands
            const dangerousCheck = this.isDangerousCommand(stmt);
            if (dangerousCheck.isDangerous) {
                return {
                    ok: false,
                    error: `Error: 检测到高风险系统命令 "${dangerousCheck.command}"，已强制拦截。`
                };
            }

            // SECURITY: Step 4 - Check for sensitive path access
            const sensitivePathCheck = this.accessesSensitivePath(stmt);
            if (sensitivePathCheck.isAccessing) {
                return {
                    ok: false,
                    error: `Error: 检测到尝试修改敏感路径 (${sensitivePathCheck.path})，已强制拦截。`
                };
            }

            // SECURITY: Step 5 - Check network access
            if (!networkAccessEnabled) {
                const networkCheck = this.requiresNetwork(stmt);
                if (networkCheck.requiresNetwork) {
                    return {
                        ok: false,
                        error: `Error: 当前已关闭网络访问，已拒绝可能联网的命令 (${networkCheck.command})。`
                    };
                }
            }
        }

        return { ok: true };
    }

    /**
     * SECURITY: Preprocess command to remove comments and detect dangerous patterns
     */
    private preprocessCommand(cmd: string): { ok: true; normalized: string } | { ok: false; error: string } {
        let processed = cmd;

        // SECURITY: Remove comments (both # and // style)
        // Be careful to only remove actual comments, not # in strings
        processed = processed.replace(/#.*$/gm, '').replace(/\/\/.*$/gm, '');

        // SECURITY: Detect and block command substitution
        if (/\$\(|`/.test(processed)) {
            return { ok: false, error: 'Error: 命令替换（$()或`）不允许使用。' };
        }

        // SECURITY: Detect and block piping to arbitrary shells
        if (/\|\s*(sh|bash|zsh|python|perl|ruby|php|node|java)\b/i.test(processed)) {
            return { ok: false, error: 'Error: 管道到解释器不允许使用。' };
        }

        // SECURITY: Detect and block background execution with &
        if (/&\s*$/m.test(processed)) {
            return { ok: false, error: 'Error: 后台执行（&）不允许使用。' };
        }

        return { ok: true, normalized: processed.trim() };
    }

    /**
     * SECURITY: Split command into multiple statements
     * Handles: ; && || & | > >> newlines
     */
    private splitCommandStatements(cmd: string): string[] {
        const statements: string[] = [];

        // Split on command separators, but be careful with &&
        const parts = cmd.split(/;|&&|\|\|(?!\&)/);

        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed) {
                statements.push(trimmed);
            }
        }

        // Also check for pipes (|) that are not part of &&
        const pipedStatements: string[] = [];
        for (const stmt of statements) {
            const pipeParts = stmt.split(/\|(?!\&)/);
            pipedStatements.push(...pipeParts.map(p => p.trim()).filter(p => p));
        }

        return pipedStatements.length > 0 ? pipedStatements : statements;
    }

    /**
     * SECURITY: Check if command is dangerous
     * Uses word boundary matching to prevent bypass
     */
    private isDangerousCommand(stmt: string): { isDangerous: boolean; command?: string } {
        // Normalize: remove quotes and escape characters for checking
        const normalized = stmt.replace(/\\["'`]|["'`]/g, '').toLowerCase();

        // SECURITY: Dangerous commands list with word boundary matching
        const dangerousCommands = [
            // Privilege escalation
            { name: 'sudo', pattern: /\bsudo\b/ },
            { name: 'su', pattern: /\bsu\b/ },
            { name: 'doas', pattern: /\bdoas\b/ },

            // System control
            { name: 'shutdown', pattern: /\bshutdown\b/ },
            { name: 'reboot', pattern: /\breboot\b/ },
            { name: 'halt', pattern: /\bhalt\b/ },
            { name: 'poweroff', pattern: /\bpoweroff\b/ },
            { name: 'init', pattern: /\binit\s+\d+/ },

            // Disk destruction
            { name: 'rm -rf /', pattern: /\brm\s+-rf\s+\/\b/ },
            { name: 'rm -rf --no-preserve-root', pattern: /\brm\s+-rf\s+--no-preserve-root\b/ },
            { name: 'mkfs', pattern: /\bmkfs\b/ },
            { name: 'dd', pattern: /\bdd\s+if=/i },

            // Windows specific
            { name: 'diskutil erase', pattern: /\bdiskutil\s+\w*erase/i },
            { name: 'reg delete', pattern: /\breg\s+delete\b/i },
            { name: 'bcdedit', pattern: /\bbcdedit\b/i },

            // System modification
            { name: 'crontab', pattern: /\bcrontab\b/ },
            { name: 'chattr', pattern: /\bchattr\b/ },
            { name: 'lsattr', pattern: /\blsattr\b/ },
            { name: 'visudo', pattern: /\bvisudo\b/ },

            // User management
            { name: 'passwd', pattern: /\bpasswd\b/ },
            { name: 'chage', pattern: /\bchage\b/ },
            { name: 'userdel', pattern: /\buserdel\b/ },
            { name: 'groupdel', pattern: /\bgroupdel\b/ },
            { name: 'usermod', pattern: /\busermod\b/ },

            // Firewall
            { name: 'iptables', pattern: /\biptables\b/ },
            { name: 'ufw', pattern: /\bufw\b/ },
            { name: 'firewall', pattern: /\bfirewall\b/i },

            // Mount
            { name: 'mount', pattern: /\bmount\b/ },
            { name: 'umount', pattern: /\bumount\b/ },

            // Fork bomb
            { name: 'fork bomb', pattern: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/ },
        ];

        // Also check for encoding bypass attempts
        const encodingBypass = [
            /\$\{[^}]*\}/, // Variable expansion
            /\$[a-z_][a-z0-9_]*/i, // Variable reference
            /\\x[0-9a-f]{2}/i, // Hex encoding
            /\\[0-7]{3}/, // Octal encoding
        ];

        for (const bypass of encodingBypass) {
            if (bypass.test(normalized)) {
                return { isDangerous: true, command: '编码绕过' };
            }
        }

        // Check against dangerous command list
        for (const { name, pattern } of dangerousCommands) {
            if (pattern.test(normalized)) {
                return { isDangerous: true, command: name };
            }
        }

        return { isDangerous: false };
    }

    /**
     * SECURITY: Check if command accesses sensitive paths
     */
    private accessesSensitivePath(stmt: string): { isAccessing: boolean; path?: string } {
        const normalized = stmt.toLowerCase();

        // Check for redirection operators
        if (!/(>>|>\s*|\|\s*tee\s+)/i.test(normalized)) {
            return { isAccessing: false };
        }

        // SECURITY: Sensitive paths that should never be modified

        // SECURITY: Sensitive paths that should never be modified
        const sensitivePaths = [
            // Unix/Linux system paths
            '/etc/', '/usr/bin/', '/usr/sbin/', '/bin/', '/sbin/', '/var/root/',
            '/private/etc/', '/private/var/root/',
            '/sys/', '/proc/', '/dev/', // Linux special filesystems
            '/boot/', '/root/', // Critical system directories

            // macOS system paths
            '/system/library/', '/library/application support/',

            // User configuration files (can be sensitive)
            '.ssh/', '.bashrc', '.zshrc', '.bash_profile', '.profile',
            '.bash_history', '.zsh_history', '.env', '.config',

            // Windows system paths
            'c:\\windows\\system32\\config\\',
            'c:\\windows\\system32\\drivers\\etc\\',
            'c:\\programdata\\',
        ];

        // Extract paths from redirection
        const pathMatch = /(?:>>|>|\|)\s*"?([^"'\s|)]+)"?\s*/i;
        const matches = stmt.matchAll(pathMatch);

        for (const match of matches) {
            if (match[1]) {
                const extractedPath = match[1].toLowerCase();

                for (const sensitivePath of sensitivePaths) {
                    const normalizedSensitive = sensitivePath.toLowerCase().replace(/\\/g, '/');
                    const normalizedExtracted = extractedPath.replace(/\\/g, '/');

                    if (normalizedExtracted.includes(normalizedSensitive) ||
                        normalizedExtracted.startsWith(normalizedSensitive)) {
                        return { isAccessing: true, path: sensitivePath };
                    }
                }
            }
        }

        return { isAccessing: false };
    }

    /**
     * SECURITY: Check if command requires network access
     */
    private requiresNetwork(stmt: string): { requiresNetwork: boolean; command?: string } {
        const normalized = stmt.toLowerCase();

        // SECURITY: Network command tokens
        const networkCommands = [
            'curl', 'wget', 'git', 'npm', 'yarn', 'pnpm', 'pip', 'pip3', 'pipenv',
            'poetry', 'conda', 'brew', 'port', 'apt', 'apt-get', 'aptitude',
            'yum', 'dnf', 'zypper', 'pacman', 'apk', 'opkg',
            'npm', 'npx', 'yarn', 'pnpm',
            'gem', 'bundler', 'rvm',
            'go', 'godep', 'glide',
            'cargo', 'rustup',
            'composer', 'pear',
            'maven', 'gradle',
            'nuget', 'dotnet',
            'powershell', 'pwsh', 'iwr', 'invoke-webrequest',
            'nc', 'ncat', 'netcat', 'telnet', 'ssh', 'scp', 'sftp', 'rsync',
            'ping', 'ping6', 'traceroute', 'tracepath', 'nslookup', 'dig', 'host',
            'curl', 'wget', 'aria2', 'axel',
            'ftp', 'tftp', 'sftp', 'lftp',
            'svn', 'hg', 'bzr',
            'axel', 'aria2c', 'wget2'
        ];

        // Extract the command name (first word or first word after pipes)
        const commandMatch = normalized.match(/^\w+|\|\s*(\w+)/);
        if (commandMatch) {
            const command = commandMatch[1] || commandMatch[2];
            if (networkCommands.includes(command)) {
                return { requiresNetwork: true, command };
            }
        }

        // SECURITY: Also check for URL patterns
        const urlPatterns = [
            /https?:\/\//i,
            /ftp:\/\//i,
            /ssh:\/\//i
        ];

        for (const pattern of urlPatterns) {
            if (pattern.test(normalized)) {
                return { requiresNetwork: true, command: 'URL' };
            }
        }

        return { requiresNetwork: false };
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
