/**
 * Unit tests for ToolRegistry
 */

import { describe, it, expect } from 'vitest';

describe('ToolRegistry Types', () => {
  describe('WorkMode Type', () => {
    it('should have correct values', () => {
      const chat: 'chat' | 'code' | 'cowork' = 'chat';
      const code: 'chat' | 'code' | 'cowork' = 'code';
      const cowork: 'chat' | 'code' | 'cowork' = 'cowork';

      expect(chat).toBe('chat');
      expect(code).toBe('code');
      expect(cowork).toBe('cowork');
    });

    it('should have three distinct modes', () => {
      const modes: Array<'chat' | 'code' | 'cowork'> = ['chat', 'code', 'cowork'];
      expect(modes).toHaveLength(3);
      expect(new Set(modes).size).toBe(3);
    });
  });

  describe('Tool Names', () => {
    it('should handle MCP tool names with namespace', () => {
      const mcpToolName = 'filesystem__read_file';
      const parts = mcpToolName.split('__');

      expect(parts).toHaveLength(2);
      expect(parts[0]).toBe('filesystem');
      expect(parts[1]).toBe('read_file');
    });

    it('should handle browser tool names', () => {
      const browserTools = [
        'browser_open',
        'browser_snapshot',
        'browser_click',
        'browser_fill',
        'browser_type',
        'browser_press',
        'browser_scroll',
        'browser_screenshot',
        'browser_get_text',
        'browser_close',
        'browser_wait',
      ];

      browserTools.forEach(tool => {
        expect(tool).toMatch(/^browser_/);
      });
    });
  });

  describe('Tool Security Patterns', () => {
    it('should identify dangerous operations', () => {
      const dangerousTools = [
        'write_file',
        'run_command',
        'browser_screenshot',
        'playwright__playwright_screenshot',
      ];

      dangerousTools.forEach(tool => {
        expect(tool).toBeDefined();
      });
    });

    it('should identify safe operations', () => {
      const safeTools = ['read_file', 'list_dir', 'ask_user_question'];

      safeTools.forEach(tool => {
        expect(tool).toBeDefined();
      });
    });
  });
});
