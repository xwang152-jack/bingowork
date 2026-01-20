/**
 * Unit tests for generateResponse.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createProvider,
  generateResponse,
  type ProviderRuntimeConfig,
} from '../generateResponse';
import { BaseLLMProvider } from '../BaseLLMProvider';

// Mock the provider classes
vi.mock('../AnthropicProvider', () => {
  const mockStreamChat = vi.fn().mockResolvedValue([{ type: 'text' as const, text: 'Response' }]);
  return {
    AnthropicProvider: class {
      streamChat = mockStreamChat;
    },
  };
});

vi.mock('../OpenAIProvider', () => {
  const mockStreamChat = vi.fn().mockResolvedValue([{ type: 'text' as const, text: 'Response' }]);
  return {
    OpenAIProvider: class {
      streamChat = mockStreamChat;
    },
  };
});

vi.mock('../MiniMaxProvider', () => {
  const mockStreamChat = vi.fn().mockResolvedValue([{ type: 'text' as const, text: 'Response' }]);
  return {
    MiniMaxProvider: class {
      streamChat = mockStreamChat;
    },
  };
});

describe('generateResponse', () => {
  const mockConfig: ProviderRuntimeConfig = {
    apiKey: 'test-key',
    apiUrl: 'https://api.example.com',
  };

  const mockPrompt = {
    messages: [{ role: 'user' as const, content: 'Test message' }],
    system: 'You are a helpful assistant',
    tools: [],
  };

  describe('createProvider()', () => {
    it('should create provider for anthropic', () => {
      const provider = createProvider('anthropic', mockConfig);
      expect(provider).toBeDefined();
      expect(typeof provider.streamChat).toBe('function');
    });

    it('should create provider for openai', () => {
      const provider = createProvider('openai', mockConfig);
      expect(provider).toBeDefined();
      expect(typeof provider.streamChat).toBe('function');
    });

    it('should create provider for minimax', () => {
      const provider = createProvider('minimax', mockConfig);
      expect(provider).toBeDefined();
      expect(typeof provider.streamChat).toBe('function');
    });

    it('should trim trailing slashes from apiUrl', () => {
      const provider = createProvider('anthropic', {
        ...mockConfig,
        apiUrl: 'https://api.example.com/',
      });
      expect(provider).toBeDefined();
    });

    it('should handle multiple trailing slashes', () => {
      const provider = createProvider('anthropic', {
        ...mockConfig,
        apiUrl: 'https://api.example.com///',
      });
      expect(provider).toBeDefined();
    });

    it('should handle empty apiUrl', () => {
      const provider = createProvider('anthropic', {
        apiKey: 'test-key',
        apiUrl: '',
      });
      expect(provider).toBeDefined();
    });
  });

  describe('generateResponse()', () => {
    it('should generate response using anthropic provider', async () => {
      const result = await generateResponse('anthropic', mockPrompt, mockConfig);
      expect(result).toEqual([{ type: 'text', text: 'Response' }]);
    });

    it('should generate response using openai provider', async () => {
      const result = await generateResponse('openai', mockPrompt, mockConfig);
      expect(result).toEqual([{ type: 'text', text: 'Response' }]);
    });

    it('should generate response using minimax provider', async () => {
      const result = await generateResponse('minimax', mockPrompt, mockConfig);
      expect(result).toEqual([{ type: 'text', text: 'Response' }]);
    });

    it('should use existing provider if provided', async () => {
      // Create a mock provider
      const existingProvider = {
        streamChat: vi.fn().mockResolvedValueOnce([{ type: 'text' as const, text: 'Existing Response' }]),
      } as unknown as BaseLLMProvider;

      const result = await generateResponse('anthropic', mockPrompt, mockConfig, existingProvider);

      expect(result).toEqual([{ type: 'text', text: 'Existing Response' }]);
      expect(existingProvider.streamChat).toHaveBeenCalledWith(mockPrompt);
    });

    it('should create new provider if existing is not provided', async () => {
      const result = await generateResponse('anthropic', mockPrompt, mockConfig);
      expect(result).toEqual([{ type: 'text', text: 'Response' }]);
    });
  });
});
