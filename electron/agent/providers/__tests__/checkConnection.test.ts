
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from '../OpenAIProvider';
import { AnthropicProvider } from '../AnthropicProvider';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Mock OpenAI
vi.mock('openai', () => {
  const MockOpenAI = vi.fn();
  MockOpenAI.prototype.chat = {
    completions: {
      create: vi.fn(),
    },
  };
  MockOpenAI.prototype.models = {
    list: vi.fn(),
  };
  return { default: MockOpenAI };
});

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn();
  MockAnthropic.prototype.messages = {
    create: vi.fn(),
  };
  return { default: MockAnthropic };
});

describe('Connection Check Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('OpenAIProvider.checkConnection', () => {
    it('should return true when chat completion succeeds', async () => {
      const provider = new OpenAIProvider('test-key', 'https://api.openai.com');
      const mockCreate = (provider['client'].chat.completions.create as any);
      
      mockCreate.mockResolvedValueOnce({});

      const result = await provider.checkConnection();
      expect(result).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        max_tokens: 1
      }));
    });

    it('should return true when chat completion fails but model list succeeds', async () => {
      const provider = new OpenAIProvider('test-key', 'https://api.openai.com');
      const mockCreate = (provider['client'].chat.completions.create as any);
      const mockList = (provider['client'].models.list as any);

      mockCreate.mockRejectedValueOnce(new Error('Chat failed'));
      mockList.mockResolvedValueOnce({ data: [] });

      const result = await provider.checkConnection();
      expect(result).toBe(true);
      expect(mockCreate).toHaveBeenCalled();
      expect(mockList).toHaveBeenCalled();
    });

    it('should return false when both checks fail', async () => {
      const provider = new OpenAIProvider('test-key', 'https://api.openai.com');
      const mockCreate = (provider['client'].chat.completions.create as any);
      const mockList = (provider['client'].models.list as any);

      mockCreate.mockRejectedValueOnce(new Error('Chat failed'));
      mockList.mockRejectedValueOnce(new Error('List failed'));

      const result = await provider.checkConnection();
      expect(result).toBe(false);
    });
  });

  describe('AnthropicProvider.checkConnection', () => {
    it('should return true when message creation succeeds', async () => {
      const provider = new AnthropicProvider('test-key', 'https://api.anthropic.com');
      const mockCreate = (provider['client'].messages.create as any);

      mockCreate.mockResolvedValueOnce({});

      const result = await provider.checkConnection();
      expect(result).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        max_tokens: 1
      }));
    });

    it('should return false when message creation fails', async () => {
      const provider = new AnthropicProvider('test-key', 'https://api.anthropic.com');
      const mockCreate = (provider['client'].messages.create as any);

      mockCreate.mockRejectedValueOnce(new Error('API Error'));

      const result = await provider.checkConnection();
      expect(result).toBe(false);
    });
  });
});
