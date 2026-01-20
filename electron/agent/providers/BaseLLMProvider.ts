import Anthropic from '@anthropic-ai/sdk';

export type StreamChatParams = {
    model: string;
    systemPrompt: string;
    messages: Anthropic.MessageParam[];
    tools: Anthropic.Tool[];
    maxTokens: number;
    signal?: AbortSignal;
    onToken?: (token: string) => void;
};

export abstract class BaseLLMProvider {
    abstract getProviderName(): string;
    abstract getBaseURL(): string | undefined;
    abstract streamChat(params: StreamChatParams): Promise<Anthropic.ContentBlock[]>;
}

