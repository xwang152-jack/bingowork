/**
 * Command Execution Security Utilities
 * 
 * Provides secure command execution with injection prevention
 */

import { spawn, SpawnOptionsWithoutStdio } from 'child_process';

/**
 * Command execution mode
 */
export type CommandExecutionMode = 'safe' | 'shell';

/**
 * Command options for safe execution
 */
export interface SafeCommandOptions {
    /** Command to execute (without arguments) */
    command: string;
    /** Command arguments as array */
    args?: string[];
    /** Working directory */
    cwd?: string;
    /** Environment variables */
    env?: Record<string, string>;
    /** Execution mode: 'safe' (default) or 'shell' */
    mode?: CommandExecutionMode;
    /** Timeout in milliseconds */
    timeoutMs?: number;
    /** Maximum output size in characters */
    maxOutputChars?: number;
}

/**
 * Command execution result
 */
export interface CommandResult {
    /** Exit code */
    exitCode: number | null;
    /** Standard output */
    stdout: string;
    /** Standard error */
    stderr: string;
    /** Whether execution was successful */
    success: boolean;
    /** Error message if failed */
    error?: string;
}

/**
 * SECURITY: Whitelist of allowed commands for shell mode
 * Only these commands can be executed with shell=true
 */
const SHELL_COMMAND_WHITELIST = new Set([
    'git',
    'npm',
    'node',
    'python',
    'python3',
    'pip',
    'pip3',
    'bash',
    'sh',
    'zsh'
]);

/**
 * SECURITY: Check if command should use shell mode
 * Shell mode is only allowed for whitelisted commands or when explicitly requested
 */
function shouldUseShell(command: string, mode?: CommandExecutionMode): boolean {
    if (mode === 'shell') {
        // Extract base command (first word)
        const baseCommand = command.trim().split(/\s+/)[0];
        return SHELL_COMMAND_WHITELIST.has(baseCommand);
    }
    return false;
}

/**
 * SECURITY: Execute command with injection prevention
 * 
 * @param options Command execution options
 * @returns Command execution result
 */
export async function executeCommandSafe(options: SafeCommandOptions): Promise<CommandResult> {
    const {
        command,
        args = [],
        cwd = process.cwd(),
        env,
        mode = 'safe',
        timeoutMs = 120_000,
        maxOutputChars = 1_000_000
    } = options;

    // SECURITY: Validate mode
    const useShell = shouldUseShell(command, mode);

    if (mode === 'shell' && !useShell) {
        return {
            exitCode: null,
            stdout: '',
            stderr: '',
            success: false,
            error: `Command "${command}" is not whitelisted for shell execution`
        };
    }

    const spawnOptions: SpawnOptionsWithoutStdio = {
        cwd,
        shell: useShell ? (process.platform === 'win32' ? 'powershell.exe' : '/bin/bash') : false,
        env: env ? { ...process.env, ...env } : process.env
    };

    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let settled = false;

        // SECURITY: Use parameterized execution (safe mode)
        const child = useShell
            ? spawn(command, spawnOptions)  // Shell mode: command includes args
            : spawn(command, args, spawnOptions);  // Safe mode: separate args

        const timeoutHandle = setTimeout(() => {
            if (!settled) {
                settled = true;
                try {
                    child.kill();
                } catch { /* ignore */ }
                resolve({
                    exitCode: null,
                    stdout,
                    stderr,
                    success: false,
                    error: `Command timed out after ${timeoutMs}ms`
                });
            }
        }, timeoutMs);

        child.stdout?.on('data', (data: Buffer) => {
            stdout += data.toString();
            if (stdout.length > maxOutputChars) {
                if (!settled) {
                    settled = true;
                    clearTimeout(timeoutHandle);
                    try {
                        child.kill();
                    } catch { /* ignore */ }
                    resolve({
                        exitCode: null,
                        stdout: stdout.slice(0, maxOutputChars),
                        stderr,
                        success: false,
                        error: 'Output exceeded maximum size'
                    });
                }
            }
        });

        child.stderr?.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        child.on('error', (error) => {
            if (!settled) {
                settled = true;
                clearTimeout(timeoutHandle);
                resolve({
                    exitCode: null,
                    stdout,
                    stderr,
                    success: false,
                    error: `Failed to start command: ${error.message}`
                });
            }
        });

        child.on('close', (code) => {
            if (!settled) {
                settled = true;
                clearTimeout(timeoutHandle);
                resolve({
                    exitCode: code,
                    stdout,
                    stderr,
                    success: code === 0
                });
            }
        });
    });
}

/**
 * SECURITY: Parse legacy command string to safe format
 * This helps migrate from shell-based execution to parameterized execution
 */
export function parseCommandToSafe(commandString: string): SafeCommandOptions {
    // Simple parsing - split on spaces (doesn't handle quotes properly)
    // For complex commands, users should provide args array directly
    const parts = commandString.trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    return {
        command,
        args,
        mode: 'safe'
    };
}
