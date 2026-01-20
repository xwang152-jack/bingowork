import Anthropic from '@anthropic-ai/sdk';
import type { StreamChatParams } from './BaseLLMProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { MiniMaxProvider } from './MiniMaxProvider';
import { OpenAIProvider } from './OpenAIProvider';
import type { BaseLLMProvider } from './BaseLLMProvider';

export type ProviderId = 'anthropic' | 'openai' | 'minimax';

export type ProviderRuntimeConfig = {
    apiKey: string;
    apiUrl: string;
};

export function createProvider(provider: ProviderId, config: ProviderRuntimeConfig): BaseLLMProvider {
    const apiUrl = String(config.apiUrl || '').trim().replace(/\/+$/, '');
    if (provider === 'openai') return new OpenAIProvider(config.apiKey, apiUrl);
    if (provider === 'minimax') return new MiniMaxProvider(config.apiKey, apiUrl);
    return new AnthropicProvider(config.apiKey, apiUrl);
}

export async function generateResponse(
    provider: ProviderId,
    prompt: StreamChatParams,
    config: ProviderRuntimeConfig,
    existingProvider?: BaseLLMProvider
): Promise<Anthropic.ContentBlock[]> {
    const p = existingProvider || createProvider(provider, config);
    return await p.streamChat(prompt);
}

