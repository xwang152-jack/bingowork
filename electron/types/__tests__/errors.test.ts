/**
 * Unit tests for Error Types
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  FileNotFoundError,
  PathUnauthorizedError,
  FileWriteError,
  ApiRateLimitError,
  ApiTimeoutError,
  ApiUnauthorizedError,
  ApiServerError,
  ApiSensitiveContentError,
  ToolNotFoundError,
  ToolExecutionFailedError,
  ToolPermissionDeniedError,
  DangerousCommandError,
  AgentNotInitializedError,
  AgentAlreadyRunningError,
  ERROR_CODES,
  ErrorSeverity,
  isAppError,
  isApiError,
  hasErrorCode,
} from '../errors';

describe('Error Types', () => {
  describe('AppError', () => {
    it('should create error with code', () => {
      const error = new AppError(ERROR_CODES.FILE_NOT_FOUND);

      expect(error.code).toBe(ERROR_CODES.FILE_NOT_FOUND);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.recoverable).toBe(true);
    });

    it('should serialize to JSON', () => {
      const error = new AppError(ERROR_CODES.FILE_NOT_FOUND, { filePath: '/test' });
      const json = error.toJSON();

      expect(json.code).toBe(ERROR_CODES.FILE_NOT_FOUND);
      expect(json.context).toEqual({ filePath: '/test' });
      expect(json.userMessage).toBeDefined();
      expect(json.recovery).toBeDefined();
    });

    it('should include timestamp', () => {
      const error = new AppError(ERROR_CODES.FILE_NOT_FOUND);
      const timestamp = Date.now();

      expect(error.timestamp).toBeLessThanOrEqual(timestamp);
      expect(error.timestamp).toBeGreaterThan(timestamp - 1000);
    });

    it('should set severity and recoverable', () => {
      const error = new AppError(
        ERROR_CODES.FILE_NOT_FOUND,
        {},
        ErrorSeverity.LOW,
        false
      );

      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.recoverable).toBe(false);
    });
  });

  describe('FileNotFoundError', () => {
    it('should create with file path', () => {
      const error = new FileNotFoundError('/test/file.txt');

      expect(error.code).toBe(ERROR_CODES.FILE_NOT_FOUND);
      expect(error.context).toEqual({ filePath: '/test/file.txt' });
      expect(error.severity).toBe(ErrorSeverity.LOW);
    });
  });

  describe('PathUnauthorizedError', () => {
    it('should create with path', () => {
      const error = new PathUnauthorizedError('/unauthorized/path');

      expect(error.code).toBe(ERROR_CODES.PATH_UNAUTHORIZED);
      expect(error.context).toEqual({ filePath: '/unauthorized/path' });
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    });
  });

  describe('FileWriteError', () => {
    it('should create with path and original error', () => {
      const originalError = new Error('Permission denied');
      const error = new FileWriteError('/test/file.txt', originalError);

      expect(error.code).toBe(ERROR_CODES.FILE_WRITE_ERROR);
      expect(error.context).toEqual({
        filePath: '/test/file.txt',
        originalError: 'Permission denied',
      });
    });
  });

  describe('API Errors', () => {
    it('should create rate limit error', () => {
      const error = new ApiRateLimitError();

      expect(error.code).toBe(ERROR_CODES.API_RATE_LIMITED);
      expect(error.userMessage).toContain('频率限制');
      expect(error.recoverable).toBe(true);
    });

    it('should create timeout error', () => {
      const error = new ApiTimeoutError('Request timed out');

      expect(error.code).toBe(ERROR_CODES.API_TIMEOUT);
      expect(error.context).toEqual({ message: 'Request timed out' });
    });

    it('should create unauthorized error', () => {
      const error = new ApiUnauthorizedError();

      expect(error.code).toBe(ERROR_CODES.API_UNAUTHORIZED);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should create server error with status code', () => {
      const error = new ApiServerError(500, 'Internal server error');

      expect(error.code).toBe(ERROR_CODES.API_SERVER_ERROR);
      expect(error.context).toEqual({
        statusCode: 500,
        message: 'Internal server error',
      });
    });

    it('should create sensitive content error', () => {
      const error = new ApiSensitiveContentError();

      expect(error.code).toBe(ERROR_CODES.API_SENSITIVE_CONTENT);
      expect(error.userMessage).toContain('安全过滤器');
    });
  });

  describe('Tool Errors', () => {
    it('should create tool not found error', () => {
      const error = new ToolNotFoundError('unknown_tool');

      expect(error.code).toBe(ERROR_CODES._TOOL_NOT_FOUND);
      expect(error.context).toEqual({ toolName: 'unknown_tool' });
    });

    it('should create tool execution failed error', () => {
      const originalError = new Error('Tool failed');
      const error = new ToolExecutionFailedError('write_file', originalError);

      expect(error.code).toBe(ERROR_CODES.TOOL_EXECUTION_FAILED);
      expect(error.context).toEqual({
        toolName: 'write_file',
        error: 'Tool failed',
      });
    });

    it('should create permission denied error', () => {
      const error = new ToolPermissionDeniedError('run_command', '/test');

      expect(error.code).toBe(ERROR_CODES.TOOL_PERMISSION_DENIED);
      expect(error.context).toEqual({
        toolName: 'run_command',
        path: '/test',
      });
      expect(error.recoverable).toBe(true);
    });

    it('should create dangerous command error', () => {
      const error = new DangerousCommandError('rm -rf /', 'System destruction');

      expect(error.code).toBe(ERROR_CODES.COMMAND_DANGEROUS);
      expect(error.context).toEqual({
        command: 'rm -rf /',
        reason: 'System destruction',
      });
      expect(error.recoverable).toBe(false);
    });
  });

  describe('Agent Errors', () => {
    it('should create agent not initialized error', () => {
      const error = new AgentNotInitializedError();

      expect(error.code).toBe(ERROR_CODES.AGENT_NOT_INITIALIZED);
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('should create agent already running error', () => {
      const error = new AgentAlreadyRunningError();

      expect(error.code).toBe(ERROR_CODES.AGENT_ALREADY_RUNNING);
      expect(error.recoverable).toBe(true);
    });
  });

  describe('AppError.fromUnknown', () => {
    it('should return AppError as-is', () => {
      const originalError = new FileNotFoundError('/test');
      const error = AppError.fromUnknown(originalError);

      expect(error).toBe(originalError);
    });

    it('should convert generic Error to AppError', () => {
      const originalError = new Error('Something went wrong');
      const error = AppError.fromUnknown(originalError);

      expect(error).toBeInstanceOf(AppError);
      // Note: Error message may be mapped to a user-facing message
      expect(error.userMessage).toBeTruthy();
    });

    it('should infer rate limit error from message', () => {
      const error = AppError.fromUnknown(new Error('Rate limit exceeded'));
      expect(error).toBeInstanceOf(ApiRateLimitError);
    });

    it('should infer timeout error from message', () => {
      const error = AppError.fromUnknown(new Error('Request timeout'));
      expect(error).toBeInstanceOf(ApiTimeoutError);
    });

    it('should infer unauthorized error from message', () => {
      const error = AppError.fromUnknown(new Error('Unauthorized access'));
      expect(error).toBeInstanceOf(ApiUnauthorizedError);
    });

    it('should infer sensitive content error from message', () => {
      const error = AppError.fromUnknown(new Error('Content blocked as sensitive'));
      expect(error).toBeInstanceOf(ApiSensitiveContentError);
    });

    it('should use default code for unknown errors', () => {
      const error = AppError.fromUnknown('Unknown error', ERROR_CODES.CONFIG_INVALID);

      expect(error.code).toBe(ERROR_CODES.CONFIG_INVALID);
    });
  });

  describe('Type Guards', () => {
    describe('isAppError', () => {
      it('should return true for AppError instances', () => {
        const error = new AppError(ERROR_CODES.FILE_NOT_FOUND);
        expect(isAppError(error)).toBe(true);
      });

      it('should return false for generic errors', () => {
        const error = new Error('Generic error');
        expect(isAppError(error)).toBe(false);
      });

      it('should return false for non-errors', () => {
        expect(isAppError('not an error')).toBe(false);
        expect(isAppError(null)).toBe(false);
        expect(isAppError(undefined)).toBe(false);
      });
    });

    describe('isApiError', () => {
      it('should return true for objects with status and message', () => {
        const error = { status: 500, message: 'Server error' };
        expect(isApiError(error)).toBe(true);
      });

      it('should return false for objects without status', () => {
        const error = { message: 'Server error' };
        expect(isApiError(error)).toBe(false);
      });

      it('should return false for objects with non-number status', () => {
        const error = { status: '500', message: 'Server error' };
        expect(isApiError(error)).toBe(false);
      });
    });

    describe('hasErrorCode', () => {
      it('should return true for objects with code property', () => {
        const error = { code: ERROR_CODES.FILE_NOT_FOUND };
        expect(hasErrorCode(error)).toBe(true);
      });

      it('should return false for objects without code', () => {
        const error = { message: 'Error' };
        expect(hasErrorCode(error)).toBe(false);
      });
    });
  });

  describe('Error Messages', () => {
    it('should have user-friendly message for each error code', () => {
      const errorCodes = Object.values(ERROR_CODES);

      errorCodes.forEach((code) => {
        const error = new AppError(code);
        expect(error.userMessage).toBeTruthy();
        expect(error.userMessage.length).toBeGreaterThan(0);
        expect(error.recovery).toBeTruthy();
        expect(error.recovery.length).toBeGreaterThan(0);
      });
    });
  });
});
