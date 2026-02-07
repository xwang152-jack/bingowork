/**
 * Message List Component
 * Renders chat messages with proper formatting
 */

import { memo, useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { User, Bot } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { CollapsibleToolBlock } from '../CollapsibleToolBlock';
import Anthropic from '@anthropic-ai/sdk';
import { AgentMessage } from '../../../electron/types/ipc';

export interface MessageListProps {
    messages: AgentMessage[];
    isDark?: boolean;
    streamingText?: string;
}

export function MessageList({ messages, isDark = false, streamingText = '' }: MessageListProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [toolStreamById, setToolStreamById] = useState<Record<string, string>>({});
    const [toolStatusById, setToolStatusById] = useState<Record<string, 'running' | 'done' | 'error'>>({});
    const shouldStickToBottomRef = useRef(true);

    const toolResultById = useMemo(() => {
        const out: Record<string, string> = {};
        for (const m of messages) {
            const arr = Array.isArray(m.content) ? m.content : [];
            for (const block of arr) {
                if (!block || typeof block !== 'object') continue;
                const b = block as unknown as { type?: string; tool_use_id?: string; content?: unknown };
                if (b.type !== 'tool_result') continue;
                const id = String(b.tool_use_id || '');
                if (!id) continue;
                const content = typeof b.content === 'string'
                    ? b.content
                    : Array.isArray(b.content)
                        ? JSON.stringify(b.content, null, 2)
                        : b.content == null
                            ? ''
                            : String(b.content);
                out[id] = content;
            }
        }
        return out;
    }, [messages]);

    const scrollToBottom = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, []);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        shouldStickToBottomRef.current = distanceToBottom < 120;
    }, []);

    // Memoize filtered messages to avoid unnecessary re-renders
    const visibleMessages = useMemo(() => {
        return messages.filter((m) => {
            if (m.role !== 'user') return true;
            if (!Array.isArray(m.content)) return true;
            const arr = m.content as unknown[];
            if (arr.length === 0) return true;
            const allToolResults = arr.every((b) => {
                const t = (b as { type?: unknown } | null)?.type;
                return t === 'tool_result';
            });
            return !allToolResults;
        });
    }, [messages]);

    useEffect(() => {
        const remove = window.ipcRenderer.on('agent:tool-output-stream', (_event, payload) => {
            const p = payload as { callId?: string; chunk?: string } | undefined;
            const id = String(p?.callId || '');
            const chunk = String(p?.chunk || '');
            if (!id || !chunk) return;
            setToolStreamById((prev) => ({ ...prev, [id]: (prev[id] || '') + chunk }));
        });
        return () => remove();
    }, []);

    useEffect(() => {
        const remove = window.ipcRenderer.on('session:loaded', () => {
            setToolStreamById({});
            setToolStatusById({});
        });
        return () => remove();
    }, []);

    useEffect(() => {
        const removeToolCall = window.ipcRenderer.on('agent:tool-call', (_event, payload) => {
            const p = payload as { callId?: string } | undefined;
            const id = String(p?.callId || '');
            if (!id) return;
            setToolStatusById((prev) => ({ ...prev, [id]: 'running' }));
        });
        const removeToolResult = window.ipcRenderer.on('agent:tool-result', (_event, payload) => {
            const p = payload as { callId?: string; status?: 'done' | 'error' } | undefined;
            const id = String(p?.callId || '');
            if (!id) return;
            setToolStatusById((prev) => ({ ...prev, [id]: p?.status === 'error' ? 'error' : 'done' }));
        });
        return () => {
            removeToolCall();
            removeToolResult();
        };
    }, []);

    // 优化：使用 requestAnimationFrame 节流滚动，避免频繁滚动
    const rafRef = useRef<number | null>(null);
    useEffect(() => {
        if (!shouldStickToBottomRef.current) return;

        // 使用 RAF 节流，避免每次 token 都触发滚动
        if (rafRef.current) return;

        rafRef.current = requestAnimationFrame(() => {
            scrollToBottom();
            rafRef.current = null;
        });

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [visibleMessages.length, streamingText.length, scrollToBottom]);

    if (visibleMessages.length === 0) {
        return <EmptyState />;
    }

    return (
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar" onScroll={handleScroll}>
            <div className="max-w-4xl mx-auto py-8 px-6 space-y-8">
                {visibleMessages.map((message, index) => (
                    <MessageItem
                        key={message.id || index}
                        message={message}
                        isDark={isDark}
                        toolResultById={toolResultById}
                        toolStreamById={toolStreamById}
                        toolStatusById={toolStatusById}
                    />
                ))}
                {streamingText && (
                    <StreamingMessage text={streamingText} isDark={isDark} />
                )}
            </div>
        </div>
    );
}

interface MessageItemProps {
    message: AgentMessage;
    isDark?: boolean;
    toolResultById: Record<string, string>;
    toolStreamById: Record<string, string>;
    toolStatusById: Record<string, 'running' | 'done' | 'error'>;
}

// Custom comparison function for MessageItem
const areMessageEqual = (prevProps: MessageItemProps, nextProps: MessageItemProps) => {
    return (
        prevProps.message === nextProps.message &&
        prevProps.isDark === nextProps.isDark &&
        prevProps.toolResultById === nextProps.toolResultById &&
        prevProps.toolStreamById === nextProps.toolStreamById &&
        prevProps.toolStatusById === nextProps.toolStatusById
    );
};

const MessageItem = memo(function MessageItem({ message, isDark, toolResultById, toolStreamById, toolStatusById }: MessageItemProps) {
    // Memoize message content parsing to avoid re-computation
    const { isUser, text, toolUses, images } = useMemo(() => {
        const isUser = message.role === 'user';
        const contentArray = Array.isArray(message.content) ? message.content : [];
        const text = typeof message.content === 'string'
            ? message.content
            : (contentArray.find((b): b is Anthropic.TextBlockParam => 'type' in b && b.type === 'text')?.text || '');
        const toolUses = contentArray.filter((b): b is Anthropic.ToolUseBlockParam => 'type' in b && b.type === 'tool_use');
        const images = contentArray.filter((b): b is Anthropic.ImageBlockParam => 'type' in b && b.type === 'image');

        return { isUser, text, toolUses, images };
    }, [message]);

    // Memoize avatar class
    const avatarClass = useMemo(() => {
        return `flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
            isUser ? 'bg-[#E85D3E] text-white' : 'bg-stone-100 text-stone-600'
        }`;
    }, [isUser]);

    // Memoize content wrapper class
    const contentWrapperClass = useMemo(() => {
        return `${
            isUser
                ? 'bg-stone-50 text-stone-800 rounded-2xl rounded-tr-sm border border-stone-100 shadow-sm'
                : 'bg-white text-stone-800 rounded-2xl rounded-tl-sm border border-stone-100 shadow-sm'
        } px-5 py-3.5`;
    }, [isUser]);

    return (
        <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={avatarClass}>
                {isUser ? <User size={20} /> : <Bot size={20} />}
            </div>

            {/* Content */}
            <div className={`flex-1 max-w-[85%] ${isUser ? 'text-right' : ''}`}>
                <div className={contentWrapperClass}>
                    {/* Text Content */}
                    {text && (
                        <div className="prose prose-sm max-w-none text-stone-700 prose-p:my-0 prose-p:leading-6">
                            <MarkdownRenderer content={text} isDark={isDark} />
                        </div>
                    )}

                    {/* Images */}
                    {images.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {images.map((img, index) => {
                                const source = (img.source && typeof img.source === 'object')
                                    ? (img.source as unknown as { media_type?: unknown; data?: unknown })
                                    : undefined;
                                const mediaType = typeof source?.media_type === 'string' ? source.media_type : '';
                                const data = typeof source?.data === 'string' ? source.data : '';
                                if (!mediaType || !data) return null;
                                return (
                                <img
                                    key={`${message.id || 'msg'}-img-${index}`}
                                    src={`data:${mediaType};base64,${data}`}
                                    alt={`Uploaded ${index + 1}`}
                                    className="max-w-xs rounded-2xl border border-stone-200/60 shadow-sm"
                                />
                            )})}
                        </div>
                    )}

                    {/* Tool Uses */}
                    {toolUses.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {toolUses.map((toolUse, index) => (
                                <CollapsibleToolBlock
                                    key={`${message.id || 'msg'}-tool-${index}`}
                                    toolName={toolUse.name}
                                    input={toolUse.input as Record<string, unknown>}
                                    output={toolResultById[String(toolUse.id || '')] || toolStreamById[String(toolUse.id || '')]}
                                    status={
                                        toolStatusById[String(toolUse.id || '')]
                                        || (toolResultById[String(toolUse.id || '')] ? 'done' : (toolStreamById[String(toolUse.id || '')] ? 'running' : 'done'))
                                    }
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}, areMessageEqual);

// Memoize EmptyState since it's static
const EmptyState = memo(function EmptyState() {
    return (
        <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-stone-400 animate-fade-in">
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-stone-100 flex items-center justify-center">
                    <Bot size={36} className="text-stone-300" />
                </div>
                <h3 className="text-xl font-semibold text-stone-600 mb-2 tracking-tight">开始新对话</h3>
                <p className="text-sm text-stone-400">输入消息开始与 AI 助手对话</p>
            </div>
        </div>
    );
});

interface StreamingMessageProps {
    text: string;
    isDark?: boolean;
}

const StreamingMessage = memo(function StreamingMessage({ text, isDark }: StreamingMessageProps) {
    const avatarClass = `flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-stone-100 text-stone-600 shadow-sm`;
    const contentWrapperClass = `bg-white text-stone-800 rounded-2xl rounded-tl-sm border border-stone-100 px-5 py-3.5 shadow-sm`;

    return (
        <div className="flex gap-4">
            <div className={avatarClass}>
                <Bot size={20} />
            </div>
            <div className="flex-1 max-w-[85%]">
                <div className={contentWrapperClass}>
                    <div className="prose prose-sm max-w-none text-stone-700">
                        <MarkdownRenderer content={text} isDark={isDark} />
                    </div>
                </div>
            </div>
        </div>
    );
});
