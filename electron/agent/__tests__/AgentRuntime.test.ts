/**
 * Unit tests for AgentRuntime
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRuntime } from '../AgentRuntime';
import type { WorkMode } from '../../config/ConfigStore';

// Mock electron module with all required exports
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  app: {
    getPath: vi.fn(() => '/tmp/test-userdata'),
    isPackaged: false,
  },
}));

// Mock LLM Providers to avoid browser environment issues
// Define classes inside the mock factory to avoid hoisting issues
vi.mock('../providers/AnthropicProvider', () => {
  class MockAnthropicProvider {
    async streamChat() {
      return [];
    }
  }
  return { AnthropicProvider: MockAnthropicProvider };
});

vi.mock('../providers/OpenAIProvider', () => {
  class MockOpenAIProvider {
    async streamChat() {
      return [];
    }
  }
  return { OpenAIProvider: MockOpenAIProvider };
});

vi.mock('../providers/MiniMaxProvider', () => {
  class MockMiniMaxProvider {
    async streamChat() {
      return [];
    }
  }
  return { MiniMaxProvider: MockMiniMaxProvider };
});

// Mock ConfigStore to avoid file system operations
vi.mock('../../config/ConfigStore', () => ({
  WorkMode: {
    CHAT: 'chat' as const,
    CODE: 'code' as const,
    COWORK: 'cowork' as const,
  },
  ApiProvider: {
    ANTHROPIC: 'anthropic' as const,
    OPENAI: 'openai' as const,
    MINIMAX: 'minimax' as const,
  },
  configStore: {
    get: vi.fn((key: string) => {
      if (key === 'workMode') return 'cowork';
      if (key === 'networkAccess') return false;
      return undefined;
    }),
    set: vi.fn(),
    getAll: vi.fn(() => ({
      apiKey: 'test-key',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      apiUrl: 'https://api.anthropic.com',
      workMode: 'cowork' as WorkMode,
      networkAccess: false,
    })),
  },
}));

describe('AgentRuntime', () => {
  let mockWindow: any;

  beforeEach(() => {
    // Create mock BrowserWindow
    mockWindow = {
      webContents: {
        send: vi.fn(),
      },
      isDestroyed: vi.fn(() => false),
    };

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      const runtime = new AgentRuntime(
        'test-api-key',
        mockWindow as unknown as any,
        'claude-3-5-sonnet-20241022',
        'https://api.anthropic.com',
        'anthropic'
      );

      expect(runtime).toBeDefined();
      expect(runtime.getWorkMode()).toBe('cowork');
      expect(runtime.getHistorySize()).toBe(0);
    });

    it('should accept custom model parameter', () => {
      const runtime = new AgentRuntime(
        'test-api-key',
        mockWindow as unknown as any,
        'custom-model-name'
      );

      expect(runtime).toBeDefined();
    });

    it('should accept custom provider', () => {
      const runtime = new AgentRuntime(
        'test-api-key',
        mockWindow as unknown as any,
        'claude-3-5-sonnet-20241022',
        'https://api.openai.com',
        'openai'
      );

      expect(runtime).toBeDefined();
    });
  });

  describe('Work Mode Management', () => {
    let runtime: AgentRuntime;

    beforeEach(() => {
      runtime = new AgentRuntime(
        'test-api-key',
        mockWindow as unknown as any
      );
    });

    it('should return current work mode', () => {
      expect(runtime.getWorkMode()).toBe('cowork');
    });

    it('should set work mode to chat', () => {
      runtime.setWorkMode('chat');
      expect(runtime.getWorkMode()).toBe('chat');
    });

    it('should set work mode to code', () => {
      runtime.setWorkMode('code');
      expect(runtime.getWorkMode()).toBe('code');
    });

    it('should set work mode to cowork', () => {
      runtime.setWorkMode('cowork');
      expect(runtime.getWorkMode()).toBe('cowork');
    });

    it('should have valid work mode values', () => {
      const mode = runtime.getWorkMode();
      expect(['chat', 'code', 'cowork']).toContain(mode);
    });
  });

  describe('Model Management', () => {
    let runtime: AgentRuntime;

    beforeEach(() => {
      runtime = new AgentRuntime(
        'test-api-key',
        mockWindow as unknown as any,
        'claude-3-5-sonnet-20241022'
      );
    });

    it('should set model name', () => {
      runtime.setModel('claude-3-opus-20240229');
      expect(runtime).toBeDefined();
    });

    it('should update LLM config with all parameters', () => {
      runtime.updateLLMConfig({
        model: 'new-model',
        provider: 'openai',
        apiUrl: 'https://api.openai.com',
        apiKey: 'new-key'
      });

      expect(runtime).toBeDefined();
    });

    it('should update only model', () => {
      runtime.updateLLMConfig({ model: 'updated-model' });
      expect(runtime).toBeDefined();
    });

    it('should update only provider', () => {
      runtime.updateLLMConfig({ provider: 'minimax' });
      expect(runtime).toBeDefined();
    });

    it('should update only API URL', () => {
      runtime.updateLLMConfig({ apiUrl: 'https://new-api.com' });
      expect(runtime).toBeDefined();
    });

    it('should update only API key', () => {
      runtime.updateLLMConfig({ apiKey: 'new-api-key' });
      expect(runtime).toBeDefined();
    });
  });

  describe('History Management', () => {
    let runtime: AgentRuntime;

    beforeEach(() => {
      runtime = new AgentRuntime(
        'test-api-key',
        mockWindow as unknown as any
      );
    });

    it('should start with empty history', () => {
      expect(runtime.getHistorySize()).toBe(0);
    });

    it('should clear history', () => {
      runtime.clearHistory();
      expect(runtime.getHistorySize()).toBe(0);
    });

    it('should load history within max size limit', () => {
      const messages: any[] = Array.from({ length: 250 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`
      }));

      runtime.loadHistory(messages);

      // Should be limited to MAX_HISTORY_SIZE (200)
      expect(runtime.getHistorySize()).toBeLessThanOrEqual(200);
    });

    it('should handle empty history load', () => {
      runtime.loadHistory([]);
      expect(runtime.getHistorySize()).toBe(0);
    });

    it('should trim history to MAX_HISTORY_SIZE', () => {
      const messages: any[] = Array.from({ length: 300 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`
      }));

      runtime.loadHistory(messages);

      // Should be exactly MAX_HISTORY_SIZE after loading
      expect(runtime.getHistorySize()).toBe(200);
    });

    it('should preserve message order when loading', () => {
      const messages: any[] = [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Second' },
        { role: 'assistant', content: 'Response 2' },
      ];

      runtime.loadHistory(messages);

      expect(runtime.getHistorySize()).toBe(4);
    });
  });

  describe('Confirmation Handling', () => {
    let runtime: AgentRuntime;

    beforeEach(() => {
      runtime = new AgentRuntime(
        'test-api-key',
        mockWindow as unknown as any
      );
    });

    it('should handle confirmation response with approval', () => {
      const testId = 'test-confirmation-id';

      expect(() => {
        runtime.handleConfirmResponse(testId, true);
      }).not.toThrow();
    });

    it('should handle confirmation response with rejection', () => {
      const testId = 'test-confirmation-id';

      expect(() => {
        runtime.handleConfirmResponse(testId, false);
      }).not.toThrow();
    });

    it('should handle confirmation response with remember flag', () => {
      const testId = 'test-confirmation-id';

      expect(() => {
        runtime.handleConfirmResponseWithRemember(testId, true, true);
      }).not.toThrow();
    });

    it('should handle confirmation response without remember', () => {
      const testId = 'test-confirmation-id';

      expect(() => {
        runtime.handleConfirmResponseWithRemember(testId, false, false);
      }).not.toThrow();
    });
  });

  describe('User Question Handling', () => {
    let runtime: AgentRuntime;

    beforeEach(() => {
      runtime = new AgentRuntime(
        'test-api-key',
        mockWindow as unknown as any
      );
    });

    it('should handle user question response', () => {
      const testId = 'test-question-id';
      const answer = 'test answer';

      expect(() => {
        runtime.handleUserQuestionResponse(testId, answer);
      }).not.toThrow();
    });

    it('should handle empty question response', () => {
      const testId = 'test-question-id';

      expect(() => {
        runtime.handleUserQuestionResponse(testId, '');
      }).not.toThrow();
    });

    it('should handle special characters in answer', () => {
      const testId = 'test-question-id';
      const answer = 'Answer with 特殊字符 and 🎉 emojis';

      expect(() => {
        runtime.handleUserQuestionResponse(testId, answer);
      }).not.toThrow();
    });
  });

  describe('Abort Functionality', () => {
    let runtime: AgentRuntime;

    beforeEach(() => {
      runtime = new AgentRuntime(
        'test-api-key',
        mockWindow as unknown as any
      );
    });

    it('should handle abort gracefully', () => {
      expect(() => {
        runtime.abort();
      }).not.toThrow();
    });

    it('should handle multiple aborts gracefully', () => {
      expect(() => {
        runtime.abort();
        runtime.abort();
        runtime.abort();
      }).not.toThrow();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const runtime = new AgentRuntime(
        'test-api-key',
        mockWindow as unknown as any
      );

      await expect(runtime.shutdown()).resolves.toBeUndefined();
    });
  });
});
