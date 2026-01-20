/**
 * Standardized error types for Bingowork application
 * Provides consistent error handling across main and renderer processes
 */

/**
 * Error severity levels for categorization and user-facing messaging
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Application-specific error codes
 * Each code maps to a specific error scenario with predefined recovery actions
 */
export const ERROR_CODES = {
  // File System Errors (E001-E099)
  FILE_NOT_FOUND: 'E001',
  FILE_READ_ERROR: 'E002',
  FILE_WRITE_ERROR: 'E003',
  PATH_UNAUTHORIZED: 'E004',
  PATH_INVALID: 'E005',
  DIR_NOT_EMPTY: 'E006',

  // Network/API Errors (E100-E199)
  API_RATE_LIMITED: 'E100',
  API_TIMEOUT: 'E101',
  API_UNAUTHORIZED: 'E102',
  API_SERVER_ERROR: 'E103',
  API_SENSITIVE_CONTENT: 'E104',
  NETWORK_DISABLED: 'E105',
  NETWORK_ERROR: 'E106',

  // Tool Execution Errors (E200-E299)
 _TOOL_NOT_FOUND: 'E200',
  TOOL_EXECUTION_FAILED: 'E201',
  TOOL_PERMISSION_DENIED: 'E202',
  TOOL_INPUT_INVALID: 'E203',
  COMMAND_DANGEROUS: 'E204',
  COMMAND_BLOCKED: 'E205',

  // Agent Runtime Errors (E300-E399)
  AGENT_NOT_INITIALIZED: 'E300',
  AGENT_ALREADY_RUNNING: 'E301',
  AGENT_LOOP_LIMIT: 'E302',
  AGENT_ABORTED: 'E303',

  // Configuration Errors (E400-E499)
  CONFIG_INVALID: 'E400',
  CONFIG_MISSING: 'E401',
  API_KEY_MISSING: 'E402',
  MODEL_INVALID: 'E403',

  // Session Errors (E500-E599)
  SESSION_NOT_FOUND: 'E500',
  SESSION_LOAD_FAILED: 'E501',
  SESSION_SAVE_FAILED: 'E502',

  // MCP Errors (E600-E699)
  MCP_SERVER_ERROR: 'E600',
  MCP_CONNECTION_FAILED: 'E601',
  MCP_TOOL_ERROR: 'E602',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * User-facing error messages with recovery suggestions
 */
const ERROR_MESSAGES: Record<ErrorCode, { message: string; recovery: string }> = {
  // File System
  [ERROR_CODES.FILE_NOT_FOUND]: {
    message: '找不到指定的文件',
    recovery: '请检查文件路径是否正确，或选择一个已授权的目录',
  },
  [ERROR_CODES.FILE_READ_ERROR]: {
    message: '读取文件失败',
    recovery: '请检查文件权限，确保文件未被其他程序占用',
  },
  [ERROR_CODES.FILE_WRITE_ERROR]: {
    message: '写入文件失败',
    recovery: '请检查磁盘空间和文件权限',
  },
  [ERROR_CODES.PATH_UNAUTHORIZED]: {
    message: '路径未授权',
    recovery: '请在设置中添加此目录到授权列表',
  },
  [ERROR_CODES.PATH_INVALID]: {
    message: '无效的路径',
    recovery: '请提供有效的文件或目录路径',
  },
  [ERROR_CODES.DIR_NOT_EMPTY]: {
    message: '目录不为空',
    recovery: '请选择一个空目录或清空目标目录',
  },

  // Network/API
  [ERROR_CODES.API_RATE_LIMITED]: {
    message: 'API 请求频率限制',
    recovery: '请等待几秒后重试，或检查 API 配额',
  },
  [ERROR_CODES.API_TIMEOUT]: {
    message: 'API 请求超时',
    recovery: '请检查网络连接，或稍后重试',
  },
  [ERROR_CODES.API_UNAUTHORIZED]: {
    message: 'API 密钥无效',
    recovery: '请在设置中检查并更新 API 密钥',
  },
  [ERROR_CODES.API_SERVER_ERROR]: {
    message: 'API 服务器错误',
    recovery: '请稍后重试，或联系服务提供商',
  },
  [ERROR_CODES.API_SENSITIVE_CONTENT]: {
    message: '生成的内容被安全过滤器拦截',
    recovery: '请重新表述您的请求，避免敏感内容',
  },
  [ERROR_CODES.NETWORK_DISABLED]: {
    message: '网络访问已禁用',
    recovery: '请在设置中启用网络访问',
  },
  [ERROR_CODES.NETWORK_ERROR]: {
    message: '网络连接错误',
    recovery: '请检查网络连接',
  },

  // Tool Execution
  [ERROR_CODES._TOOL_NOT_FOUND]: {
    message: '工具不存在',
    recovery: '请检查工具名称是否正确',
  },
  [ERROR_CODES.TOOL_EXECUTION_FAILED]: {
    message: '工具执行失败',
    recovery: '请检查工具参数和权限设置',
  },
  [ERROR_CODES.TOOL_PERMISSION_DENIED]: {
    message: '工具权限被拒绝',
    recovery: '请在权限设置中授权此工具',
  },
  [ERROR_CODES.TOOL_INPUT_INVALID]: {
    message: '工具输入参数无效',
    recovery: '请检查工具输入参数格式',
  },
  [ERROR_CODES.COMMAND_DANGEROUS]: {
    message: '检测到危险命令',
    recovery: '出于安全考虑，此命令已被阻止',
  },
  [ERROR_CODES.COMMAND_BLOCKED]: {
    message: '命令已被阻止',
    recovery: '此命令违反安全策略，无法执行',
  },

  // Agent Runtime
  [ERROR_CODES.AGENT_NOT_INITIALIZED]: {
    message: 'Agent 未初始化',
    recovery: '请配置 API 密钥后重试',
  },
  [ERROR_CODES.AGENT_ALREADY_RUNNING]: {
    message: 'Agent 正在运行',
    recovery: '请等待当前任务完成',
  },
  [ERROR_CODES.AGENT_LOOP_LIMIT]: {
    message: 'Agent 达到最大迭代次数',
    recovery: '任务已终止，可能需要简化请求',
  },
  [ERROR_CODES.AGENT_ABORTED]: {
    message: '任务已取消',
    recovery: '您可以重新开始任务',
  },

  // Configuration
  [ERROR_CODES.CONFIG_INVALID]: {
    message: '配置无效',
    recovery: '请检查配置设置',
  },
  [ERROR_CODES.CONFIG_MISSING]: {
    message: '配置缺失',
    recovery: '请重新配置应用设置',
  },
  [ERROR_CODES.API_KEY_MISSING]: {
    message: 'API 密钥未配置',
    recovery: '请在设置中配置 API 密钥',
  },
  [ERROR_CODES.MODEL_INVALID]: {
    message: '模型名称无效',
    recovery: '请选择有效的模型',
  },

  // Session
  [ERROR_CODES.SESSION_NOT_FOUND]: {
    message: '会话不存在',
    recovery: '会话可能已被删除',
  },
  [ERROR_CODES.SESSION_LOAD_FAILED]: {
    message: '加载会话失败',
    recovery: '请尝试创建新会话',
  },
  [ERROR_CODES.SESSION_SAVE_FAILED]: {
    message: '保存会话失败',
    recovery: '请检查磁盘空间和权限',
  },

  // MCP
  [ERROR_CODES.MCP_SERVER_ERROR]: {
    message: 'MCP 服务器错误',
    recovery: '请检查 MCP 服务器配置',
  },
  [ERROR_CODES.MCP_CONNECTION_FAILED]: {
    message: 'MCP 连接失败',
    recovery: '请检查 MCP 服务是否运行',
  },
  [ERROR_CODES.MCP_TOOL_ERROR]: {
    message: 'MCP 工具错误',
    recovery: '请检查 MCP 工具配置',
  },
};

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly recoverable: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly userMessage: string;
  public readonly recovery: string;
  public readonly timestamp: number;

  constructor(
    code: ErrorCode,
    context?: Record<string, unknown>,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    recoverable: boolean = true
  ) {
    const errorInfo = ERROR_MESSAGES[code];
    super(errorInfo.message);

    this.name = this.constructor.name;
    this.code = code;
    this.severity = severity;
    this.recoverable = recoverable;
    this.context = context;
    this.userMessage = errorInfo.message;
    this.recovery = errorInfo.recovery;
    this.timestamp = Date.now();

    // Maintains proper stack trace
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Convert error to plain object for IPC transmission
   */
  toJSON(): {
    code: ErrorCode;
    message: string;
    userMessage: string;
    recovery: string;
    severity: ErrorSeverity;
    recoverable: boolean;
    context?: Record<string, unknown>;
    timestamp: number;
  } {
    return {
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      recovery: this.recovery,
      severity: this.severity,
      recoverable: this.recoverable,
      context: this.context,
      timestamp: this.timestamp,
    };
  }

  /**
   * Create AppError from unknown error
   */
  static fromUnknown(error: unknown, defaultCode: ErrorCode = ERROR_CODES.API_SERVER_ERROR): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      // Try to infer error type from message
      const message = error.message.toLowerCase();

      if (message.includes('rate limit') || message.includes('429')) {
        return new ApiRateLimitError(error.message);
      }
      if (message.includes('timeout')) {
        return new ApiTimeoutError(error.message);
      }
      if (message.includes('unauthorized') || message.includes('401')) {
        return new ApiUnauthorizedError(error.message);
      }
      if (message.includes('sensitive') || message.includes('1027')) {
        return new ApiSensitiveContentError(error.message);
      }
    }

    return new AppError(defaultCode, { originalError: error });
  }
}

/**
 * File System Errors
 */
export class FileNotFoundError extends AppError {
  constructor(filePath: string) {
    super(ERROR_CODES.FILE_NOT_FOUND, { filePath }, ErrorSeverity.LOW);
  }
}

export class PathUnauthorizedError extends AppError {
  constructor(filePath: string) {
    super(ERROR_CODES.PATH_UNAUTHORIZED, { filePath }, ErrorSeverity.MEDIUM);
  }
}

export class FileWriteError extends AppError {
  constructor(filePath: string, originalError?: Error) {
    super(
      ERROR_CODES.FILE_WRITE_ERROR,
      { filePath, originalError: originalError?.message },
      ErrorSeverity.MEDIUM
    );
  }
}

/**
 * API Errors
 */
export class ApiRateLimitError extends AppError {
  constructor(message?: string) {
    super(
      ERROR_CODES.API_RATE_LIMITED,
      { message },
      ErrorSeverity.MEDIUM,
      true
    );
  }
}

export class ApiTimeoutError extends AppError {
  constructor(message?: string) {
    super(
      ERROR_CODES.API_TIMEOUT,
      { message },
      ErrorSeverity.MEDIUM,
      true
    );
  }
}

export class ApiUnauthorizedError extends AppError {
  constructor(message?: string) {
    super(
      ERROR_CODES.API_UNAUTHORIZED,
      { message },
      ErrorSeverity.HIGH,
      true
    );
  }
}

export class ApiServerError extends AppError {
  constructor(statusCode: number, message?: string) {
    super(
      ERROR_CODES.API_SERVER_ERROR,
      { statusCode, message },
      ErrorSeverity.HIGH,
      true
    );
  }
}

export class ApiSensitiveContentError extends AppError {
  constructor(message?: string) {
    super(
      ERROR_CODES.API_SENSITIVE_CONTENT,
      { message },
      ErrorSeverity.LOW,
      true
    );
  }
}

/**
 * Tool Execution Errors
 */
export class ToolNotFoundError extends AppError {
  constructor(toolName: string) {
    super(ERROR_CODES._TOOL_NOT_FOUND, { toolName }, ErrorSeverity.MEDIUM);
  }
}

export class ToolExecutionFailedError extends AppError {
  constructor(toolName: string, error: Error) {
    super(
      ERROR_CODES.TOOL_EXECUTION_FAILED,
      { toolName, error: error.message },
      ErrorSeverity.MEDIUM
    );
  }
}

export class ToolPermissionDeniedError extends AppError {
  constructor(toolName: string, path?: string) {
    super(
      ERROR_CODES.TOOL_PERMISSION_DENIED,
      { toolName, path },
      ErrorSeverity.LOW,
      true
    );
  }
}

export class DangerousCommandError extends AppError {
  constructor(command: string, reason: string) {
    super(
      ERROR_CODES.COMMAND_DANGEROUS,
      { command, reason },
      ErrorSeverity.HIGH,
      false
    );
  }
}

/**
 * Agent Runtime Errors
 */
export class AgentNotInitializedError extends AppError {
  constructor() {
    super(ERROR_CODES.AGENT_NOT_INITIALIZED, {}, ErrorSeverity.CRITICAL);
  }
}

export class AgentAlreadyRunningError extends AppError {
  constructor() {
    super(ERROR_CODES.AGENT_ALREADY_RUNNING, {}, ErrorSeverity.LOW, true);
  }
}

/**
 * Type guard for checking if error is AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard for API errors with status code
 */
export function isApiError(error: unknown): error is { status: number; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

/**
 * Type guard for error with code
 */
export function hasErrorCode(error: unknown): error is { code: ErrorCode } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}
