/**
 * Functional tests for FileSystemTools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileSystemTools } from '../FileSystemTools';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('FileSystemTools', () => {
  let fsTools: FileSystemTools;
  let testDir: string;

  beforeEach(async () => {
    fsTools = new FileSystemTools();
    // Create a temporary directory for tests
    testDir = path.join(os.tmpdir(), 'fs-tools-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('readFile', () => {
    it('should read file content successfully', async () => {
      const testFilePath = path.join(testDir, 'test.txt');
      const testContent = 'Hello, World!';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await fsTools.readFile({ path: testFilePath });

      expect(result).toContain('Successfully read file');
      expect(result).toContain(testContent);
    });

    it('should return error for non-existent file', async () => {
      const nonExistentPath = path.join(testDir, 'nonexistent.txt');

      const result = await fsTools.readFile({ path: nonExistentPath });

      expect(result).toContain('Error reading file');
    });

    it('should handle UTF-8 encoding correctly', async () => {
      const testFilePath = path.join(testDir, 'unicode.txt');
      const testContent = '你好世界 🚀 Hello World';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await fsTools.readFile({ path: testFilePath });

      expect(result).toContain(testContent);
    });
  });

  describe('writeFile', () => {
    it('should write file content successfully', async () => {
      const testFilePath = path.join(testDir, 'output.txt');
      const testContent = 'Test content for writing';

      const result = await fsTools.writeFile({ path: testFilePath, content: testContent });

      expect(result).toContain('Successfully wrote to');
      expect(result).toContain(testFilePath);

      // Verify file was actually written
      const writtenContent = await fs.readFile(testFilePath, 'utf-8');
      expect(writtenContent).toBe(testContent);
    });

    it('should create intermediate directories', async () => {
      const nestedFilePath = path.join(testDir, 'level1', 'level2', 'file.txt');
      const testContent = 'Nested file content';

      const result = await fsTools.writeFile({ path: nestedFilePath, content: testContent });

      expect(result).toContain('Successfully wrote to');

      // Verify file exists
      const exists = await fs.access(nestedFilePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should overwrite existing file', async () => {
      const testFilePath = path.join(testDir, 'overwrite.txt');
      await fs.writeFile(testFilePath, 'Original content', 'utf-8');

      const newContent = 'Updated content';
      const result = await fsTools.writeFile({ path: testFilePath, content: newContent });

      expect(result).toContain('Successfully wrote to');

      // Verify content was overwritten
      const currentContent = await fs.readFile(testFilePath, 'utf-8');
      expect(currentContent).toBe(newContent);
    });
  });

  describe('listDir', () => {
    beforeEach(async () => {
      // Create test directory structure
      await fs.mkdir(path.join(testDir, 'subdir'), { recursive: true });
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
      await fs.writeFile(path.join(testDir, 'subdir', 'file3.txt'), 'content3');
    });

    it('should list directory contents', async () => {
      const result = await fsTools.listDir({ path: testDir });

      expect(result).toContain('Directory contents');
      expect(result).toContain('[FILE] file1.txt');
      expect(result).toContain('[FILE] file2.txt');
      expect(result).toContain('[DIR] subdir');
    });

    it('should return error for non-existent directory', async () => {
      const nonExistentDir = path.join(testDir, 'nonexistent');

      const result = await fsTools.listDir({ path: nonExistentDir });

      expect(result).toContain('Error listing directory');
    });

    it('should list subdirectory contents', async () => {
      const subDirPath = path.join(testDir, 'subdir');
      const result = await fsTools.listDir({ path: subDirPath });

      expect(result).toContain('[FILE] file3.txt');
    });
  });

  describe('runCommand', () => {
    it('should execute simple command', async () => {
      const result = await fsTools.runCommand(
        { command: 'echo "Hello from command"' },
        testDir
      );

      expect(result).toContain('Hello from command');
      expect(result).toContain('Exit Code: 0');
    });

    it('should handle command with cwd', async () => {
      const result = await fsTools.runCommand(
        { command: 'pwd', cwd: testDir },
        testDir
      );

      expect(result).toContain(testDir);
    });

    it('should handle command errors gracefully', async () => {
      const result = await fsTools.runCommand(
        { command: 'ls /nonexistent-directory-xyz-123' },
        testDir
      );

      // Should complete without throwing
      expect(result).toBeDefined();
      expect(result).toContain('Exit Code:');
    });

    it('should stream command output', async () => {
      const chunks: string[] = [];
      const streamCallback = vi.fn((chunk: string, type: 'stdout' | 'stderr') => {
        chunks.push(`[${type}] ${chunk}`);
      });

      const result = await fsTools.runCommandStream(
        { command: 'echo "stream test"' },
        testDir,
        streamCallback
      );

      expect(result).toContain('Exit Code: 0');
      expect(streamCallback).toHaveBeenCalled();
    });
  });

  describe('runCommandStream', () => {
    it('should call stream callback for output', async () => {
      const callback = vi.fn();

      await fsTools.runCommandStream(
        { command: 'echo "test output"' },
        testDir,
        callback
      );

      expect(callback).toHaveBeenCalled();
      // Check that stdout callback was made
      const stdoutCalls = callback.mock.calls.filter(call => call[1] === 'stdout');
      expect(stdoutCalls.length).toBeGreaterThan(0);
    });

    it('should handle stderr output', async () => {
      const callback = vi.fn();

      await fsTools.runCommandStream(
        { command: 'ls /nonexistent-xyz-123 2>&1' },
        testDir,
        callback
      );

      expect(callback).toHaveBeenCalled();
    });

    it('should respect max output limit', async () => {
      // Create a command that produces lots of output
      const callback = vi.fn();

      const result = await fsTools.runCommandStream(
        { command: 'for i in {1..100}; do echo "Line $i"; done' },
        testDir,
        callback
      );

      // Should complete without hanging
      expect(result).toBeDefined();
      expect(result).toContain('Exit Code:');
    }, 10000);

    it('should handle timeout', async () => {
      // Command that takes longer than timeout
      const result = await fsTools.runCommandStream(
        { command: 'sleep 200' },
        testDir,
        () => {}
      );

      // Should be terminated due to timeout
      expect(result).toContain('terminated due to hard timeout');
    }, 150000);
  });
});
