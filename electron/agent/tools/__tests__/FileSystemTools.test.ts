/**
 * Unit tests for FileSystemTools interfaces and types
 */

import { describe, it, expect } from 'vitest';
import type {
  ToolInput,
  ToolResult,
  FilePathInput,
  CommandInput,
  StreamCallback,
} from '../../tools/FileSystemTools';

describe('FileSystemTools Types', () => {
  describe('ToolInput', () => {
    it('should accept string values', () => {
      const input: ToolInput = {
        path: '/test/file.txt',
      };

      expect(input.path).toBe('/test/file.txt');
    });

    it('should accept various value types', () => {
      const input: ToolInput = {
        path: '/test/file.txt',
        content: 'Test content',
        line: 42,
        flag: true,
        data: null,
      };

      expect(input.path).toBe('/test/file.txt');
      expect(input.content).toBe('Test content');
      expect(input.line).toBe(42);
      expect(input.flag).toBe(true);
      expect(input.data).toBe(null);
    });
  });

  describe('ToolResult', () => {
    it('should represent successful result', () => {
      const result: ToolResult = {
        success: true,
        output: 'File content',
      };

      expect(result.success).toBe(true);
      expect(result.output).toBe('File content');
    });

    it('should represent failed result', () => {
      const result: ToolResult = {
        success: false,
        error: 'File not found',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
    });

    it('should include metadata', () => {
      const result: ToolResult = {
        success: true,
        output: 'File content',
        metadata: {
          size: 1024,
          encoding: 'utf-8',
        },
      };

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.size).toBe(1024);
    });
  });

  describe('FilePathInput', () => {
    it('should have path property', () => {
      const input: FilePathInput = {
        path: '/test/file.txt',
      };

      expect(input.path).toBe('/test/file.txt');
    });
  });

  describe('CommandInput', () => {
    it('should have command property', () => {
      const input: CommandInput = {
        command: 'echo "test"',
      };

      expect(input.command).toBe('echo "test"');
    });

    it('should have optional cwd property', () => {
      const input: CommandInput = {
        command: 'echo "test"',
        cwd: '/test',
      };

      expect(input.cwd).toBe('/test');
    });
  });

  describe('StreamCallback', () => {
    it('should be callable function', () => {
      const callback: StreamCallback = (chunk, type) => {
        console.log(`[${type}] ${chunk}`);
      };

      expect(typeof callback).toBe('function');
      callback('test output', 'stdout');
    });
  });

  describe('Type Safety', () => {
    it('should enforce ToolInput structure', () => {
      const input: ToolInput = {
        path: '/test/file.txt',
        content: 'test',
      };

      // ToolInput allows any string key, so this is valid
      const valid = input['customProperty'];
      expect(valid).toBeUndefined();
    });
  });
});
