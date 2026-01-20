import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { ChatCompletionContentPart, ChatCompletionMessageFunctionToolCall, ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { BaseLLMProvider, StreamChatParams } from './BaseLLMProvider';

function normalizeOpenAIBaseURL(raw: string): string {
    const trimmed = String(raw || '').trim().replace(/\/+$/, '');
    if (!trimmed) return trimmed;

    const knownSuffixes = [
        '/v1/chat/completions',
        '/chat/completions',
        '/v1/text/chatcompletion',
        '/text/chatcompletion'
    ];

    for (const suffix of knownSuffixes) {
        if (trimmed.toLowerCase().endsWith(suffix)) {
            return trimmed.slice(0, -suffix.length) + (suffix.startsWith('/v1') ? '/v1' : '');
        }
    }

    return trimmed;
}

export class OpenAIProvider extends BaseLLMProvider {
    protected client: OpenAI;

    constructor(apiKey: string, baseURL: string) {
        super();
        this.client = new OpenAI({
            apiKey,
            baseURL: normalizeOpenAIBaseURL(baseURL),
            dangerouslyAllowBrowser: true
        });
    }

    getProviderName(): string {
        return 'openai';
    }

    getBaseURL(): string | undefined {
        return this.client.baseURL;
    }

    protected async convertToOpenAIMessages(history: Anthropic.MessageParam[], systemPrompt: string): Promise<ChatCompletionMessageParam[]> {
        const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: systemPrompt }];

        for (const msg of history) {
            if (msg.role === 'user') {
                if (typeof msg.content === 'string') {
                    messages.push({ role: 'user', content: msg.content });
                } else {
                    const contentBlocks: ChatCompletionContentPart[] = [];
                    const toolResults: Anthropic.ToolResultBlockParam[] = [];

                    for (const block of msg.content) {
                        if (block.type === 'tool_result') {
                            toolResults.push(block);
                        } else if (block.type === 'text') {
                            contentBlocks.push({ type: 'text', text: block.text });
                        } else if (block.type === 'image') {
                            const source = block.source as unknown as { media_type: string; data: string };
                            contentBlocks.push({
                                type: 'image_url',
                                image_url: { url: `data:${source.media_type};base64,${source.data}` }
                            });
                        }
                    }

                    if (contentBlocks.length > 0) {
                        messages.push({ role: 'user', content: contentBlocks });
                    }

                    for (const res of toolResults) {
                        messages.push({
                            role: 'tool',
                            tool_call_id: res.tool_use_id,
                            content: typeof res.content === 'string' ? res.content : JSON.stringify(res.content)
                        });
                    }
                }
            } else if (msg.role === 'assistant') {
                if (typeof msg.content === 'string') {
                    messages.push({ role: 'assistant', content: msg.content });
                } else {
                    const blocks = msg.content as Anthropic.ContentBlockParam[];
                    const textBlocks = blocks.filter((b): b is Anthropic.TextBlockParam => b.type === 'text');
                    const toolUseBlocks = blocks.filter((b): b is Anthropic.ToolUseBlockParam => b.type === 'tool_use');

                    let content: string | null = null;
                    if (textBlocks.length > 0) {
                        content = textBlocks.map(b => b.text).join('\n');
                    }

                    const toolCalls: ChatCompletionMessageFunctionToolCall[] = toolUseBlocks.map(b => ({
                        id: b.id,
                        type: 'function',
                        function: {
                            name: b.name,
                            arguments: JSON.stringify(b.input)
                        }
                    }));

                    const assistantMsg: ChatCompletionMessageParam = { role: 'assistant' };
                    if (content) assistantMsg.content = content;
                    if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;

                    messages.push(assistantMsg);
                }
            }
        }

        return messages;
    }

    async streamChat(params: StreamChatParams): Promise<Anthropic.ContentBlock[]> {
        const { model, systemPrompt, messages, tools, maxTokens, signal, onToken } = params;

        const openAIMessages = await this.convertToOpenAIMessages(messages, systemPrompt);
        const openAITools: ChatCompletionTool[] = tools.map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.input_schema
            }
        }));

        const stream = await this.client.chat.completions.create({
            model,
            messages: openAIMessages,
            tools: openAITools,
            stream: true,
            max_tokens: maxTokens
        });

        const finalContent: Anthropic.ContentBlock[] = [];
        let textBuffer = '';
        const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();

        for await (const chunk of stream) {
            if (signal?.aborted) {
                stream.controller.abort();
                break;
            }

            const delta = chunk.choices?.[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
                textBuffer += delta.content;
                onToken?.(delta.content);
            }

            if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                    const index = tc.index;
                    if (!toolCallsMap.has(index)) {
                        toolCallsMap.set(index, { id: '', name: '', arguments: '' });
                    }
                    const current = toolCallsMap.get(index)!;
                    if (tc.id) current.id = tc.id;
                    if (tc.function?.name) current.name = tc.function.name;
                    if (tc.function?.arguments) current.arguments += tc.function.arguments;
                }
            }
        }

        if (textBuffer) {
            finalContent.push({ type: 'text', text: textBuffer, citations: null });
        }

        for (const tc of toolCallsMap.values()) {
            try {
                finalContent.push({
                    type: 'tool_use',
                    id: tc.id,
                    name: tc.name,
                    input: JSON.parse(tc.arguments)
                });
            } catch {
                finalContent.push({
                    type: 'tool_use',
                    id: tc.id,
                    name: tc.name,
                    input: { error: 'Invalid JSON input', raw: tc.arguments }
                });
            }
        }

        return finalContent;
    }
}
