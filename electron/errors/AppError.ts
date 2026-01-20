/**
 * Unified Error Handling System
 *
 * Provides a consistent error handling approach across the application.
 * Includes:
 * - Standardized error types
 * - Error codes and severity levels
 * - Error recovery strategies
 * - Error logging and reporting
 */

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',       // Non-critical, can be recovered
  MEDIUM = 'medium', // May affect functionality but app continues
  HIGH = 'high',     // Critical, affects core functionality
  FATAL = 'fatal',   // App cannot continue
}

/**
 * Error categories
 */
export enum ErrorCategory {
  // Network & API errors
  NETWORK = 'network',
  API_RATE_LIMIT = 'api_rate_limit',
  API_TIMEOUT = 'api_timeout',
  API_AUTH = 'api_auth',

  // File system errors
  FILE_NOT_FOUND = 'file_not_found',
  FILE_PERMISSION = 'file_permission',
  FILE_READ = 'file_read',
  FILE_WRITE = 'file_write',

  // Agent errors
  AGENT_INIT = 'agent_init',
  AGENT_EXECUTION = 'agent_execution',
  TOOL_EXECUTION = 'tool_execution',

  // Configuration errors
  CONFIG_INVALID = 'config_invalid',
  CONFIG_MISSING = 'config_missing',

  // IPC errors
  IPC_TIMEOUT = 'ipc_timeout',
  IPC_ERROR = 'ipc_error',

  // Unknown
  UNKNOWN = 'unknown',
}

/**
 * Standardized application error
 */
export class AppError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly recoverable: boolean;
  readonly context?: Record<string, unknown>;
  readonly cause?: Error;
  readonly timestamp: number;

  constructor(
    code: string,
    category: ErrorCategory,
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    recoverable: boolean = true,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.recoverable = recoverable;
    this.context = context;
    this.cause = cause;
    this.timestamp = Date.now();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(): boolean {
    return this.recoverable;
  }

  /**
   * Get user-friendly message
   */
  getUserMessage(): string {
    switch (this.category) {
      case ErrorCategory.NETWORK:
        return 'Network connection failed. Please check your internet connection.';
      case ErrorCategory.API_RATE_LIMIT:
        return 'API rate limit exceeded. Please wait a moment and try again.';
      case ErrorCategory.API_TIMEOUT:
        return 'Request timed out. Please try again.';
      case ErrorCategory.API_AUTH:
        return 'Authentication failed. Please check your API key.';
      case ErrorCategory.FILE_NOT_FOUND:
        return 'File not found. Please check the file path.';
      case ErrorCategory.FILE_PERMISSION:
        return 'Permission denied. Please check file permissions.';
      case ErrorCategory.TOOL_EXECUTION:
        return 'A tool failed to execute. Please try again.';
      default:
        return this.message;
    }
  }

  /**
   * Convert to plain object for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      severity: this.severity,
      message: this.message,
      recoverable: this.recoverable,
      context: this.context,
      cause: this.cause?.message,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * Create from unknown error
   */
  static fromUnknown(error: unknown, context?: Record<string, unknown>): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(
        'UNKNOWN_ERROR',
        ErrorCategory.UNKNOWN,
        error.message,
        ErrorSeverity.MEDIUM,
        true,
        context,
        error
      );
    }

    return new AppError(
      'UNKNOWN_ERROR',
      ErrorCategory.UNKNOWN,
      String(error),
      ErrorSeverity.MEDIUM,
      true,
      context
    );
  }
}

/**
 * Error factory methods for common scenarios
 */
export class ErrorFactory {
  /**
   * Network error
   */
  static network(message: string, context?: Record<string, unknown>): AppError {
    return new AppError(
      'NETWORK_ERROR',
      ErrorCategory.NETWORK,
      message,
      ErrorSeverity.MEDIUM,
      true,
      context
    );
  }

  /**
   * API rate limit error
   */
  static rateLimit(message: string, context?: Record<string, unknown>): AppError {
    return new AppError(
      'RATE_LIMIT_ERROR',
      ErrorCategory.API_RATE_LIMIT,
      message,
      ErrorSeverity.MEDIUM,
      true,
      context
    );
  }

  /**
   * API timeout error
   */
  static timeout(message: string, context?: Record<string, unknown>): AppError {
    return new AppError(
      'TIMEOUT_ERROR',
      ErrorCategory.API_TIMEOUT,
      message,
      ErrorSeverity.MEDIUM,
      true,
      context
    );
  }

  /**
   * Authentication error
   */
  static auth(message: string, context?: Record<string, unknown>): AppError {
    return new AppError(
      'AUTH_ERROR',
      ErrorCategory.API_AUTH,
      message,
      ErrorSeverity.HIGH,
      false,
      context
    );
  }

  /**
   * File not found error
   */
  static fileNotFound(path: string, context?: Record<string, unknown>): AppError {
    return new AppError(
      'FILE_NOT_FOUND',
      ErrorCategory.FILE_NOT_FOUND,
      `File not found: ${path}`,
      ErrorSeverity.MEDIUM,
      true,
      { ...context, path }
    );
  }

  /**
   * Permission denied error
   */
  static permissionDenied(message: string, context?: Record<string, unknown>): AppError {
    return new AppError(
      'PERMISSION_DENIED',
      ErrorCategory.FILE_PERMISSION,
      message,
      ErrorSeverity.HIGH,
      false,
      context
    );
  }

  /**
   * Tool execution error
   */
  static toolExecution(
    tool: string,
    message: string,
    context?: Record<string, unknown>
  ): AppError {
    return new AppError(
      'TOOL_EXECUTION_ERROR',
      ErrorCategory.TOOL_EXECUTION,
      `Tool "${tool}" failed: ${message}`,
      ErrorSeverity.MEDIUM,
      true,
      { ...context, tool }
    );
  }

  /**
   * Configuration error
   */
  static config(message: string, context?: Record<string, unknown>): AppError {
    return new AppError(
      'CONFIG_ERROR',
      ErrorCategory.CONFIG_INVALID,
      message,
      ErrorSeverity.HIGH,
      false,
      context
    );
  }

  /**
   * IPC timeout error
   */
  static ipcTimeout(channel: string, context?: Record<string, unknown>): AppError {
    return new AppError(
      'IPC_TIMEOUT',
      ErrorCategory.IPC_TIMEOUT,
      `IPC timeout: ${channel}`,
      ErrorSeverity.MEDIUM,
      true,
      { ...context, channel }
    );
  }
}

/**
 * Error handler interface
 */
export interface ErrorHandler {
  handle(error: AppError): void;
  canHandle(error: AppError): boolean;
}

/**
 * Error logger
 */
export class ErrorLogger implements ErrorHandler {
  constructor(private logger: any) {}

  canHandle(_error: AppError): boolean {
    return true; // Can handle all errors
  }

  handle(error: AppError): void {
    const logMethod = this.getLogMethod(error.severity);
    logMethod.call(this.logger, {
      message: error.message,
      code: error.code,
      category: error.category,
      context: error.context,
      stack: error.stack,
    });
  }

  private getLogMethod(severity: ErrorSeverity): (...args: any[]) => void {
    switch (severity) {
      case ErrorSeverity.LOW:
        return this.logger.debug;
      case ErrorSeverity.MEDIUM:
        return this.logger.warn;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.FATAL:
        return this.logger.error;
      default:
        return this.logger.info;
    }
  }
}

/**
 * Error reporter (sends to external service)
 */
export class ErrorReporter implements ErrorHandler {
  private endpoint?: string;

  constructor(endpoint?: string) {
    this.endpoint = endpoint;
  }

  canHandle(error: AppError): boolean {
    // Only report HIGH and FATAL errors
    return error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.FATAL;
  }

  async handle(error: AppError): Promise<void> {
    if (!this.endpoint || !this.canHandle(error)) {
      return;
    }

    try {
      // Send error report to external service
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error.toJSON()),
      });
    } catch (e) {
      // Don't throw when error reporting fails
      console.error('[ErrorReporter] Failed to report error:', e);
    }
  }
}

/**
 * Error recovery strategy
 */
export interface RecoveryStrategy {
  canRecover(error: AppError): boolean;
  recover(error: AppError): Promise<void>;
}

/**
 * Retry recovery strategy
 */
export class RetryRecovery implements RecoveryStrategy {
  constructor(
    private maxRetries: number = 3,
    private delay: number = 1000
  ) {}

  canRecover(error: AppError): boolean {
    return error.recoverable &&
      (error.category === ErrorCategory.NETWORK ||
       error.category === ErrorCategory.API_TIMEOUT ||
       error.category === ErrorCategory.API_RATE_LIMIT);
  }

  async recover(error: AppError): Promise<void> {
    const retryCount = (error.context?.retryCount as number) || 0;

    if (retryCount >= this.maxRetries) {
      throw new AppError(
        'MAX_RETRIES_EXCEEDED',
        error.category,
        `Max retries exceeded for: ${error.message}`,
        ErrorSeverity.HIGH,
        false,
        { ...error.context, retryCount }
      );
    }

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, this.delay * (retryCount + 1)));
  }
}

/**
 * Error manager - orchestrates error handling
 */
export class ErrorManager {
  private handlers: ErrorHandler[] = [];
  private recoveryStrategies: RecoveryStrategy[] = [];

  registerHandler(handler: ErrorHandler): void {
    this.handlers.push(handler);
  }

  registerRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
  }

  async handleError(error: unknown): Promise<void> {
    const appError = AppError.fromUnknown(error);

    // Log error
    for (const handler of this.handlers) {
      if (handler.canHandle(appError)) {
        handler.handle(appError);
      }
    }

    // Try recovery
    for (const strategy of this.recoveryStrategies) {
      if (strategy.canRecover(appError)) {
        await strategy.recover(appError);
        return;
      }
    }

    // If not recoverable, rethrow
    if (!appError.recoverable) {
      throw appError;
    }
  }
}

/**
 * Global error manager instance
 */
let globalErrorManager: ErrorManager | null = null;

/**
 * Get or create global error manager
 */
export function getErrorManager(): ErrorManager {
  if (!globalErrorManager) {
    globalErrorManager = new ErrorManager();
  }
  return globalErrorManager;
}

/**
 * Initialize error handling system
 */
export function initializeErrorHandling(logger: any): ErrorManager {
  const errorManager = getErrorManager();

  // Register default handlers
  errorManager.registerHandler(new ErrorLogger(logger));
  errorManager.registerRecoveryStrategy(new RetryRecovery());

  // Setup global error handlers
  process.on('uncaughtException', async (error) => {
    console.error('[Uncaught Exception]', error);
    await errorManager.handleError(error);
  });

  process.on('unhandledRejection', async (reason) => {
    console.error('[Unhandled Rejection]', reason);
    await errorManager.handleError(reason);
  });

  return errorManager;
}
