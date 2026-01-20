/**
 * Unit tests for ConfigStore type definitions and interfaces
 */

import { describe, it, expect } from 'vitest';
import type { ApiProvider, WorkMode, ToolPermission, LLMProfile, AppConfig } from '../ConfigStore';

describe('ConfigStore Types', () => {
  describe('Type Definitions', () => {
    it('should have correct ApiProvider type', () => {
      const anthropic: ApiProvider = 'anthropic';
      const openai: ApiProvider = 'openai';
      const minimax: ApiProvider = 'minimax';

      expect(anthropic).toBe('anthropic');
      expect(openai).toBe('openai');
      expect(minimax).toBe('minimax');
    });

    it('should have correct WorkMode type', () => {
      const chat: WorkMode = 'chat';
      const code: WorkMode = 'code';
      const cowork: WorkMode = 'cowork';

      expect(chat).toBe('chat');
      expect(code).toBe('code');
      expect(cowork).toBe('cowork');
    });

    it('should have correct ToolPermission interface', () => {
      const permission: ToolPermission = {
        tool: 'write_file',
        pathPattern: '/test/path',
        grantedAt: Date.now(),
      };

      expect(permission.tool).toBe('write_file');
      expect(permission.pathPattern).toBe('/test/path');
      expect(typeof permission.grantedAt).toBe('number');
    });

    it('should have correct LLMProfile interface', () => {
      const profile: LLMProfile = {
        model: 'claude-3-opus-20240229',
        provider: 'anthropic',
        apiUrl: 'https://api.anthropic.com',
        updatedAt: Date.now(),
      };

      expect(profile.model).toBe('claude-3-opus-20240229');
      expect(profile.provider).toBe('anthropic');
      expect(profile.apiUrl).toBe('https://api.anthropic.com');
      expect(typeof profile.updatedAt).toBe('number');
    });

    it('should have correct AppConfig interface', () => {
      const config: AppConfig = {
        provider: 'anthropic',
        apiKey: 'test-key',
        apiKeys: {
          anthropic: 'test-key',
          openai: '',
          minimax: '',
        },
        apiUrl: 'https://api.anthropic.com',
        model: 'claude-3-opus-20240229',
        modelHistory: ['claude-3-opus-20240229'],
        llmProfiles: [],
        authorizedFolders: ['/test/path'],
        networkAccess: true,
        browserAccess: false,
        shortcut: 'Alt+Space',
        allowedPermissions: [],
        workMode: 'cowork',
      };

      expect(config.provider).toBe('anthropic');
      expect(config.apiKey).toBe('test-key');
      expect(config.apiKeys?.anthropic).toBe('test-key');
      expect(config.authorizedFolders).toContain('/test/path');
      expect(config.networkAccess).toBe(true);
      expect(config.browserAccess).toBe(false);
      expect(config.workMode).toBe('cowork');
    });
  });

  describe('Type Safety', () => {
    it('should not allow invalid provider values', () => {
      // @ts-expect-error - Testing type safety
      const invalidProvider: ApiProvider = 'invalid';
      expect(invalidProvider).toBe('invalid');
    });

    it('should not allow invalid work mode values', () => {
      // @ts-expect-error - Testing type safety
      const invalidMode: WorkMode = 'invalid';
      expect(invalidMode).toBe('invalid');
    });
  });
});
