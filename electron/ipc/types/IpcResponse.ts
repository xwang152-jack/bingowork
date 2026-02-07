/**
 * Standard IPC Response Types
 * Defines unified response format for all IPC handlers
 */

/**
 * Standard error response structure
 */
export interface IpcError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Standard success response
 */
export interface IpcSuccess<T = unknown> {
  success: true;
  data?: T;
}

/**
 * Standard error response
 */
export interface IpcFailure {
  success: false;
  error: IpcError;
}

/**
 * Union type for all IPC responses
 */
export type IpcResponse<T = unknown> = IpcSuccess<T> | IpcFailure;

/**
 * Error code constants for common error scenarios
 */
export const IpcErrorCode = {
  // General errors
  UNKNOWN: 'UNKNOWN',
  INVALID_PARAMS: 'INVALID_PARAMS',
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  OPERATION_FAILED: 'OPERATION_FAILED',

  // File system errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
  INVALID_PATH: 'INVALID_PATH',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  TIMEOUT: 'TIMEOUT',

  // Configuration errors
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_LOAD_ERROR: 'CONFIG_LOAD_ERROR',
  CONFIG_SAVE_ERROR: 'CONFIG_SAVE_ERROR',

  // Session errors
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_LOAD_ERROR: 'SESSION_LOAD_ERROR',
  SESSION_SAVE_ERROR: 'SESSION_SAVE_ERROR',

  // Model errors
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  MODEL_LOAD_ERROR: 'MODEL_LOAD_ERROR',
  API_KEY_INVALID: 'API_KEY_INVALID',

  // MCP errors
  MCP_SERVER_NOT_FOUND: 'MCP_SERVER_NOT_FOUND',
  MCP_SERVER_ERROR: 'MCP_SERVER_ERROR',
  MCP_CONNECTION_ERROR: 'MCP_CONNECTION_ERROR',

  // Skill errors
  SKILL_NOT_FOUND: 'SKILL_NOT_FOUND',
  SKILL_LOAD_ERROR: 'SKILL_LOAD_ERROR',
  SKILL_SAVE_ERROR: 'SKILL_SAVE_ERROR',

  // Schedule errors
  SCHEDULE_TASK_NOT_FOUND: 'SCHEDULE_TASK_NOT_FOUND',
  SCHEDULE_TASK_ERROR: 'SCHEDULE_TASK_ERROR',

  // Shell errors
  SHELL_OPEN_FAILED: 'SHELL_OPEN_FAILED',
  SHELL_COMMAND_FAILED: 'SHELL_COMMAND_FAILED',
} as const;

export type IpcErrorCode = typeof IpcErrorCode[keyof typeof IpcErrorCode];

/**
 * Create a success response
 */
export function createSuccessResponse<T>(data?: T): IpcSuccess<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(
  code: IpcErrorCode,
  message: string,
  details?: unknown
): IpcFailure {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

/**
 * Wrap an async handler with standard error handling
 */
export function withIpcErrorHandling<T extends unknown[], R>(
  handler: (...args: T) => Promise<R> | R,
  errorCode: IpcErrorCode = IpcErrorCode.OPERATION_FAILED
): (...args: T) => Promise<IpcResponse<R>> {
  return async (...args: T): Promise<IpcResponse<R>> => {
    try {
      const result = await handler(...args);
      // If the handler already returns an IpcResponse, return it as-is
      if (
        typeof result === 'object' &&
        result !== null &&
        'success' in result &&
        typeof result.success === 'boolean'
      ) {
        return result as IpcResponse<R>;
      }
      return createSuccessResponse(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(errorCode, message, error);
    }
  };
}

/**
 * Check if a response is a success response
 */
export function isSuccessResponse<T>(response: IpcResponse<T>): response is IpcSuccess<T> {
  return response.success === true;
}

/**
 * Check if a response is an error response
 */
export function isErrorResponse(response: IpcResponse): response is IpcFailure {
  return response.success === false;
}
