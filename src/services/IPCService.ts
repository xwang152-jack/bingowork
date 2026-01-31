/**
 * Enhanced IPC Service with timeout and error handling
 * Provides a robust layer for IPC communication with automatic error conversion
 */

// Simple error class for renderer
class RendererAppError extends Error {
  code: string;
  context?: Record<string, unknown>;
  recoverable: boolean;

  constructor(
    code: string,
    context?: Record<string, unknown>,
    _severity?: string,
    recoverable = true
  ) {
    super(code);
    this.code = code;
    this.context = context;
    this.recoverable = recoverable;
    this.name = 'AppError';
  }

  static fromErrorCode(code: string, context?: Record<string, unknown>): Error {
    return new RendererAppError(code, context);
  }
}

const AppError = RendererAppError;

/**
 * IPC request options
 */
export interface IPCRequestOptions {
  timeout?: number;        // Request timeout in milliseconds (default: 30000)
  retries?: number;        // Number of retries on failure (default: 0)
  retryDelay?: number;     // Delay between retries in milliseconds (default: 1000)
  silent?: boolean;        // Suppress error notifications (default: false)
}

/**
 * IPC response wrapper
 */
export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Default request options
 */
const DEFAULT_OPTIONS: Required<Omit<IPCRequestOptions, 'silent'>> = {
  timeout: 30000,  // 30 seconds
  retries: 0,
  retryDelay: 1000,
};

/**
 * Enhanced IPC Service
 */
export class IPCService {
  /**
   * Invoke an IPC channel with timeout and retry support
   */
  static async invoke<T = any>(
    channel: string,
    ...args: any[]
  ): Promise<T> {
    return this.invokeWithOptions<T>(channel, {}, ...args);
  }

  /**
   * Invoke an IPC channel with custom options
   */
  static async invokeWithOptions<T = any>(
    channel: string,
    options: IPCRequestOptions,
    ...args: any[]
  ): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= opts.retries; attempt++) {
      try {
        return await this.invokeWithTimeout<T>(channel, opts.timeout, ...args);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (error instanceof AppError && !error.recoverable) {
          throw error;
        }

        // Wait before retry (except on last attempt)
        if (attempt < opts.retries) {
          await this.delay(opts.retryDelay);
        }
      }
    }

    // All retries failed
    throw this.convertError(lastError!, channel, opts);
  }

  /**
   * Invoke with timeout
   */
  private static async invokeWithTimeout<T>(
    channel: string,
    timeout: number,
    ...args: any[]
  ): Promise<T> {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`IPC request timeout: ${channel}`));
      }, timeout);

      // Clear timer on cleanup
      timeoutPromise.catch(() => clearTimeout(timer));
    });

    // Race between actual call and timeout
    const response = await Promise.race([
      window.ipcRenderer ? window.ipcRenderer.invoke(channel, ...args) : Promise.resolve(null),
      timeoutPromise,
    ]);

    // Check for error response wrapper
    if (response && typeof response === 'object' && 'success' in response) {
      const wrapped = response as IPCResponse<T>;
      if (!wrapped.success && wrapped.error) {
        const error = new Error(wrapped.error.message);
        (error as any).code = wrapped.error.code;
        throw error;
      }
      return wrapped.data as T;
    }

    return response as T;
  }

  /**
   * Convert raw error to AppError
   */
  private static convertError(
    error: Error,
    channel: string,
    options: IPCRequestOptions
  ): Error {
    // Already an AppError
    if (error instanceof AppError) {
      return error;
    }

    // Timeout error
    if (error.message?.includes('timeout')) {
      return new AppError(
        'IPC_TIMEOUT',
        { channel, timeout: options.timeout },
        'medium',
        true
      );
    }

    // Generic IPC error
    return new AppError(
      'IPC_ERROR',
      { channel, originalError: error.message },
      'medium',
      true
    );
  }

  /**
   * Add a listener for IPC events
   */
  static on(
    channel: string,
    callback: (...args: any[]) => void
  ): () => void {
    const listener = (_event: any, ...args: any[]) => {
      callback(...args);
    };

    window.ipcRenderer.on(channel, listener);

    // Return cleanup function
    return () => {
      window.ipcRenderer.off(channel, listener as any);
    };
  }

  /**
   * Add a one-time listener for IPC events
   */
  static once(
    channel: string,
    callback: (...args: any[]) => void
  ): void {
    const wrappedListener: any = (_event: any, ...args: any[]) => {
      callback(...args);
      window.ipcRenderer.off(channel, wrappedListener);
    };

    window.ipcRenderer.on(channel, wrappedListener);
  }

  /**
   * Send a one-way message (no response expected)
   */
  static send(channel: string, ...args: any[]): void {
    window.ipcRenderer.send(channel, ...args);
  }

  /**
   * Delay helper
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
