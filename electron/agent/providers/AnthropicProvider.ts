import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider, StreamChatParams } from './BaseLLMProvider';

export class AnthropicProvider extends BaseLLMProvider {
    private client: Anthropic;

    constructor(apiKey: string, baseURL: string) {
        super();
        this.client = new Anthropic({ apiKey, baseURL });
    }

    getProviderName(): string {
        return 'anthropic';
    }

    getBaseURL(): string | undefined {
        return this.client.baseURL;
    }

    async checkConnection(): Promise<boolean> {
        try {
            await this.client.messages.create({
                model: 'claude-3-haiku-20240307', // Use a lightweight model for check
                max_tokens: 1,
                messages: [{ role: 'user', content: 'ping' }]
            });
            return true;
        } catch (error) {
            console.error('Anthropic connection check failed:', error);
            throw error;
        }
    }

    async streamChat(params: StreamChatParams): Promise<Anthropic.ContentBlock[]> {
        const { model, systemPrompt, messages, tools, maxTokens, signal, onToken } = params;
        const finalContent: Anthropic.ContentBlock[] = [];
        let currentToolUse: { id: string; name: string; input: string } | null = null;
        let textBuffer = '';

        const stream = await this.client.messages.create({
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages,
            stream: true,
            tools,
            signal
        } as unknown as Anthropic.MessageCreateParamsStreaming);

        for await (const chunk of stream) {
            if (signal?.aborted) {
                stream.controller.abort();
                break;
            }

            switch (chunk.type) {
                case 'content_block_start':
                    if (chunk.content_block.type === 'tool_use') {
                        if (textBuffer) {
                            finalContent.push({ type: 'text', text: textBuffer, citations: null });
                            textBuffer = '';
                        }
                        currentToolUse = { ...chunk.content_block, input: '' };
                    }
                    break;
                case 'content_block_delta':
                    if (chunk.delta.type === 'text_delta') {
                        textBuffer += chunk.delta.text;
                        onToken?.(chunk.delta.text);
                    } else if (chunk.delta.type === 'input_json_delta' && currentToolUse) {
                        currentToolUse.input += chunk.delta.partial_json;
                    }
                    break;
                case 'content_block_stop':
                    if (currentToolUse) {
                        try {
                            const parsedInput = JSON.parse(currentToolUse.input || '{}');
                            finalContent.push({
                                type: 'tool_use',
                                id: currentToolUse.id,
                                name: currentToolUse.name,
                                input: parsedInput
                            });
                        } catch {
                            finalContent.push({
                                type: 'tool_use',
                                id: currentToolUse.id,
                                name: currentToolUse.name,
                                input: { error: 'Invalid JSON input', raw: currentToolUse.input }
                            });
                        }
                        currentToolUse = null;
                    }
                    break;
                case 'message_stop':
                    break;
                default:
                    break;
            }
        }

        if (textBuffer) {
            finalContent.push({ type: 'text', text: textBuffer, citations: null });
        }

        return finalContent;
    }
}

