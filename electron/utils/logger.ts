/**
 * Structured logging utility for Electron main process
 * Provides consistent logging format with levels, scopes, and optional file output
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

/**
 * Log levels in order of severity
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

/**
 * Log entry structure
 */
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    levelName: string;
    scope: string;
    message: string;
    data?: unknown;
    error?: Error;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
    level: LogLevel;
    enableConsole: boolean;
    enableFile: boolean;
    filePath?: string;
    fileBufferSize?: number;
}

/**
 * Scoped logger instance
 */
export class ScopedLogger {
    private buffers: Map<string, LogEntry[]> = new Map();

    constructor(
        private scope: string,
        private config: LoggerConfig,
        private flushCallback?: (entries: LogEntry[]) => Promise<void>
    ) {}

    /**
     * Log a debug message
     */
    debug(message: string, data?: unknown): void {
        this.log(LogLevel.DEBUG, message, data);
    }

    /**
     * Log an info message
     */
    info(message: string, data?: unknown): void {
        this.log(LogLevel.INFO, message, data);
    }

    /**
     * Log a warning message
     */
    warn(message: string, data?: unknown): void {
        this.log(LogLevel.WARN, message, data);
    }

    /**
     * Log an error message
     */
    error(message: string, error?: Error | unknown, data?: unknown): void {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: LogLevel.ERROR,
            levelName: LogLevel[LogLevel.ERROR],
            scope: this.scope,
            message,
            data,
        };

        if (error instanceof Error) {
            entry.error = error;
        } else if (error !== undefined) {
            entry.data = typeof data === 'object' && data !== null
                ? { ...(data as Record<string, unknown>), error }
                : { error, prevData: data };
        }

        this.output(entry);
    }

    /**
     * Log a message at specified level
     */
    private log(level: LogLevel, message: string, data?: unknown): void {
        if (level < this.config.level) {
            return;
        }

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            levelName: LogLevel[level],
            scope: this.scope,
            message,
            data,
        };

        this.output(entry);
    }

    /**
     * Output log entry to console and/or file
     */
    private output(entry: LogEntry): void {
        // Console output
        if (this.config.enableConsole) {
            this.outputToConsole(entry);
        }

        // File output (buffered)
        if (this.config.enableFile) {
            this.bufferForFile(entry);
        }
    }

    /**
     * Output to console with formatting
     */
    private outputToConsole(entry: LogEntry): void {
        const prefix = `[${entry.timestamp}] [${entry.levelName}] [${entry.scope}]`;
        const message = `${prefix} ${entry.message}`;

        switch (entry.level) {
            case LogLevel.DEBUG:
                console.debug(message, entry.data ?? '');
                break;
            case LogLevel.INFO:
                console.info(message, entry.data ?? '');
                break;
            case LogLevel.WARN:
                console.warn(message, entry.data ?? '');
                break;
            case LogLevel.ERROR:
                console.error(message, entry.error ?? entry.data ?? '');
                break;
        }
    }

    /**
     * Buffer log entry for file writing
     */
    private bufferForFile(entry: LogEntry): void {
        const bufferKey = this.scope;
        let buffer = this.buffers.get(bufferKey);

        if (!buffer) {
            buffer = [];
            this.buffers.set(bufferKey, buffer);
        }

        buffer.push(entry);

        const bufferSize = this.config.fileBufferSize ?? 50;
        if (buffer.length >= bufferSize) {
            void this.flushBuffer(bufferKey);
        }
    }

    /**
     * Flush buffered log entries to file
     */
    async flushBuffer(scope?: string): Promise<void> {
        if (scope) {
            const buffer = this.buffers.get(scope);
            if (buffer && buffer.length > 0) {
                await this.flushCallback?.(buffer);
                this.buffers.set(scope, []);
            }
        } else {
            // Flush all buffers
            const promises: Promise<void>[] = [];
            Array.from(this.buffers.entries()).forEach(([key, buffer]) => {
                if (buffer.length > 0) {
                    promises.push(
                        (async () => {
                            await this.flushCallback?.(buffer);
                            this.buffers.set(key, []);
                        })()
                    );
                }
            });
            await Promise.all(promises);
        }
    }

    /**
     * Create a performance logger for this scope
     */
    startPerformanceMeasure(operation: string): () => void {
        const startTime = performance.now();
        const startTimeIso = new Date().toISOString();

        this.debug(`Performance: Started ${operation}`);

        return () => {
            const duration = performance.now() - startTime;
            this.info(`Performance: Completed ${operation}`, {
                duration: `${duration.toFixed(2)}ms`,
                startTime: startTimeIso,
                endTime: new Date().toISOString(),
            });
        };
    }
}

/**
 * Main logger class
 */
export class Logger {
    private config: LoggerConfig;
    private scopedLoggers: Map<string, ScopedLogger> = new Map();
    private fileWriteQueue: LogEntry[] = [];
    private isWriting = false;

    constructor(config?: Partial<LoggerConfig>) {
        this.config = {
            level: LogLevel.INFO,
            enableConsole: true,
            enableFile: false,
            fileBufferSize: 50,
            ...config,
        };

        // Initialize file path if enabled
        if (this.config.enableFile && !this.config.filePath) {
            this.config.filePath = this.getDefaultLogPath();
        }

        // Flush buffers on process exit
        process.on('exit', () => {
            void this.flushAll();
        });
    }

    /**
     * Get default log file path
     */
    private getDefaultLogPath(): string {
        const userDataPath = app.getPath('userData');
        const logsDir = path.join(userDataPath, 'logs');

        // Ensure logs directory exists
        void fs.mkdir(logsDir, { recursive: true });

        const date = new Date().toISOString().split('T')[0];
        return path.join(logsDir, `bingowork-${date}.log`);
    }

    /**
     * Create or retrieve a scoped logger
     */
    getScope(scope: string): ScopedLogger {
        let scopedLogger = this.scopedLoggers.get(scope);

        if (!scopedLogger) {
            scopedLogger = new ScopedLogger(
                scope,
                this.config,
                this.flushToFile.bind(this)
            );
            this.scopedLoggers.set(scope, scopedLogger);
        }

        return scopedLogger;
    }

    /**
     * Flush buffered entries to file
     */
    private async flushToFile(entries: LogEntry[]): Promise<void> {
        if (!this.config.enableFile || !this.config.filePath) {
            return;
        }

        this.fileWriteQueue.push(...entries);

        if (this.isWriting) {
            return;
        }

        this.isWriting = true;

        try {
            const lines = this.fileWriteQueue.map(entry => this.formatLogEntry(entry));
            this.fileWriteQueue = [];

            await fs.appendFile(this.config.filePath, lines.join('\n') + '\n', 'utf-8');
        } catch (error) {
            console.error('Failed to write logs to file:', error);
        } finally {
            this.isWriting = false;
        }
    }

    /**
     * Format log entry for file output
     */
    private formatLogEntry(entry: LogEntry): string {
        const base = `[${entry.timestamp}] [${entry.levelName}] [${entry.scope}] ${entry.message}`;

        if (entry.data) {
            return `${base} ${JSON.stringify(entry.data)}`;
        }

        if (entry.error) {
            return `${base} ${entry.error.name}: ${entry.error.message}\n${entry.error.stack}`;
        }

        return base;
    }

    /**
     * Flush all scoped loggers
     */
    async flushAll(): Promise<void> {
        const promises: Promise<void>[] = [];

        Array.from(this.scopedLoggers.values()).forEach(scopedLogger => {
            promises.push(scopedLogger.flushBuffer());
        });

        await Promise.all(promises);

        // Flush any remaining queue
        if (this.fileWriteQueue.length > 0) {
            await this.flushToFile([]);
        }
    }

    /**
     * Update logger configuration
     */
    setConfig(config: Partial<LoggerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Set log level
     */
    setLevel(level: LogLevel): void {
        this.config.level = level;
    }

    /**
     * Enable or disable console logging
     */
    setConsoleEnabled(enabled: boolean): void {
        this.config.enableConsole = enabled;
    }

    /**
     * Enable or disable file logging
     */
    setFileEnabled(enabled: boolean): void {
        this.config.enableFile = enabled;
    }
}

/**
 * Global logger instance
 */
export const logger = new Logger({
    level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
    enableConsole: true,
    enableFile: true,
    fileBufferSize: 50,
});

/**
 * Convenience function to get a scoped logger
 */
export function getLogger(scope: string): ScopedLogger {
    return logger.getScope(scope);
}

/**
 * Predefined scoped loggers for common modules
 */
export const logs = {
    main: logger.getScope('Main'),
    agent: logger.getScope('Agent'),
    ipc: logger.getScope('IPC'),
    mcp: logger.getScope('MCP'),
    tools: logger.getScope('Tools'),
    db: logger.getScope('Database'),
    config: logger.getScope('Config'),
    skill: logger.getScope('Skill'),
};
