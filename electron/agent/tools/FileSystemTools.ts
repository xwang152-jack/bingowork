import fs from 'fs/promises';
import path from 'path';
import { parseCommandToSafe } from '../security/CommandSecurity';

// Type definitions for FileSystemTools
export interface ToolInput {
    [key: string]: unknown;
}

export interface ToolResult {
    success: boolean;
    output?: string;
    error?: string;
    metadata?: Record<string, unknown>;
}

export interface FilePathInput {
    path: string;
}

export interface CommandInput {
    command: string;
    cwd?: string;
}

export type StreamCallback = (chunk: string, type: 'stdout' | 'stderr') => void;

export const ReadFileSchema = {
    name: "read_file",
    description: "Read the content of a file from the local filesystem. Use this to analyze code or documents.",
    input_schema: {
        type: "object" as const,
        properties: {
            path: { type: "string", description: "Absolute path to the file." }
        },
        required: ["path"]
    }
};

export const WriteFileSchema = {
    name: "write_file",
    description: "Write content to a file. Overwrites existing files. Create directories if needed.",
    input_schema: {
        type: "object" as const,
        properties: {
            path: { type: "string", description: "Absolute path to the file." },
            content: { type: "string", description: "The content to write." }
        },
        required: ["path", "content"]
    }
};

export const ListDirSchema = {
    name: "list_dir",
    description: "List contents of a directory.",
    input_schema: {
        type: "object" as const,
        properties: {
            path: { type: "string", description: "Absolute path to the directory." }
        },
        required: ["path"]
    }
};

export const RunCommandSchema = {
    name: "run_command",
    description: "Execute a shell command (bash, python, npm, etc.). Use for running scripts, installing dependencies, building projects. The command runs in the specified working directory.",
    input_schema: {
        type: "object" as const,
        properties: {
            command: { type: "string", description: "The command to execute (e.g., 'python script.py', 'npm install')." },
            cwd: { type: "string", description: "Working directory for the command. Defaults to first authorized folder." }
        },
        required: ["command"]
    }
};

export class FileSystemTools {

    async readFile(args: { path: string }) {
        try {
            const content = await fs.readFile(args.path, 'utf-8');
            return `Successfully read file ${args.path}: \n${content} `;
        } catch (error: unknown) {
            return `Error reading file: ${error instanceof Error ? error.message : String(error)} `;
        }
    }

    async writeFile(args: { path: string, content: string }) {
        try {
            await fs.mkdir(path.dirname(args.path), { recursive: true });
            await fs.writeFile(args.path, args.content, 'utf-8');
            return `Successfully wrote to ${args.path} `;
        } catch (error: unknown) {
            return `Error writing file: ${error instanceof Error ? error.message : String(error)} `;
        }
    }

    async listDir(args: { path: string }) {
        try {
            const items = await fs.readdir(args.path, { withFileTypes: true });
            const result = items.map(item =>
                `${item.isDirectory() ? '[DIR]' : '[FILE]'} ${item.name} `
            ).join('\n');
            return `Directory contents of ${args.path}: \n${result} `;
        } catch (error: unknown) {
            return `Error listing directory: ${error instanceof Error ? error.message : String(error)} `;
        }
    }

    async runCommand(args: { command: string, cwd?: string }, defaultCwd: string) {
        return await this.runCommandStream(args, defaultCwd, () => { });
    }

    async runCommandStream(
        args: { command: string, cwd?: string },
        defaultCwd: string,
        onOutput: (chunk: string, type: 'stdout' | 'stderr') => void,
        signal?: AbortSignal
    ): Promise<string> {
        const workingDir = args.cwd || defaultCwd;

        // SECURITY: Use safe command execution with streaming
        const { spawn } = await import('child_process');

        // Parse command to extract base command and args
        const parsed = parseCommandToSafe(args.command);
        const useShell = /[|&;<>()$`\\"']/.test(args.command); // Detect shell features

        return new Promise((resolve) => {
            console.log(`[FileSystemTools] Executing command (stream): ${args.command} in ${workingDir}`);

            // SECURITY: Use parameterized execution when possible
            const child = useShell
                ? spawn(args.command, {
                    cwd: workingDir,
                    shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
                })
                : spawn(parsed.command, parsed.args || [], {
                    cwd: workingDir,
                    shell: false  // SECURITY: Prevent shell interpretation
                });

            const timeoutMs = 120_000;
            const maxOutputChars = 1_000_000;

            let settled = false;
            let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
            const settle = (finalResponse: string) => {
                if (settled) return;
                settled = true;
                if (timeoutHandle) clearTimeout(timeoutHandle);
                resolve(finalResponse);
            };

            if (signal) {
                signal.addEventListener('abort', () => {
                    try {
                        child.kill();
                    } catch {
                        void 0;
                    }
                    settle(`Command execution aborted by user.`);
                });
            }

            let fullOutput = "";

            const handleOutput = (data: Buffer | string, type: 'stdout' | 'stderr') => {
                const chunk = data.toString();
                fullOutput += chunk;

                // Stream to callback
                onOutput(chunk, type);

                if (fullOutput.length > maxOutputChars) {
                    try {
                        child.kill();
                    } catch {
                        void 0;
                    }
                    const truncated = fullOutput.slice(0, maxOutputChars);
                    settle(
                        `Command '${args.command}' executed in ${workingDir}.\\nExit Code: null\\n\\nOutput (truncated):\\n${truncated}\\n\\n[Output truncated and process terminated due to hard limit.]`
                    );
                }
            };

            child.stdout?.on('data', (data) => handleOutput(data, 'stdout'));
            child.stderr?.on('data', (data) => handleOutput(data, 'stderr'));

            timeoutHandle = setTimeout(() => {
                try {
                    child.kill();
                } catch {
                    void 0;
                }
                settle(
                    `Command '${args.command}' executed in ${workingDir}.\\nExit Code: null\\n\\nOutput:\\n${fullOutput}\\n\\n[Process terminated due to hard timeout: ${timeoutMs}ms]`
                );
            }, timeoutMs);

            child.on('error', (err) => {
                const errorMsg = `Failed to start command: ${err.message}`;
                fullOutput += `\\n${errorMsg}`;
                settle(`Command execution error:\\n${fullOutput}`);
            });

            child.on('close', (code) => {
                const finalResponse = `Command '${args.command}' executed in ${workingDir}.\\nExit Code: ${code}\\n\\nOutput:\\n${fullOutput}`;
                settle(finalResponse);
            });
        });
    }
}
