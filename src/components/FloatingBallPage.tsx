import { useState, useEffect, useRef, memo } from 'react';
import { X, ArrowUp, ChevronDown, Home, History, Plus } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

// UI Timeouts (ms)
const UI_TIMEOUTS = {
    FLOATING_BALL_COLLAPSE: 3000,
    INPUT_FOCUS_DELAY: 100,
} as const;

type BallState = 'collapsed' | 'input' | 'expanded';

interface ContentBlock {
    type: string;
    text?: string;
    name?: string;
    source?: { media_type: string; data: string };
}

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string | ContentBlock[];
}

/**
 * Floating Ball Page Component
 * Provides a collapsible floating UI for quick AI interactions
 */
export const FloatingBallPage = memo(function FloatingBallPage() {
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [ballState, setBallState] = useState<BallState>('collapsed');
    const [input, setInput] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [streamingText, setStreamingText] = useState('');

    // Add transparent class to html element
    useEffect(() => {
        document.documentElement.classList.add('floating-ball-mode');
        return () => {
            document.documentElement.classList.remove('floating-ball-mode');
        };
    }, []);

    // Listen for state changes and messages
    useEffect(() => {
        const removeHistoryListener = window.ipcRenderer.on('agent:history-update', (_event, ...args) => {
            const history = args[0] as Message[];
            setMessages(history.filter(m => m.role !== 'system'));
            setIsProcessing(false);
            setStreamingText('');
        });

        const removeStreamListener = window.ipcRenderer.on('agent:stream-token', (_event, ...args) => {
            const token = args[0] as string;
            setStreamingText(prev => prev + token);
            // Reset isProcessing when streaming starts
            setIsProcessing(false);
        });

        const removeErrorListener = window.ipcRenderer.on('agent:error', () => {
            setIsProcessing(false);
            setStreamingText('');
        });

        // Listen to agent stage changes to properly reset isProcessing
        const removeStageListener = window.ipcRenderer.on('agent:stage', (_event, stageData) => {
            const data = stageData as { stage: string };
            console.log('[FloatingBall] Stage event:', JSON.stringify(data)); // Debug log
            if (data?.stage === 'IDLE') {
                setIsProcessing(false);
                setStreamingText('');
            } else if (data?.stage === 'THINKING') {
                setIsProcessing(true);
            }
        });

        return () => {
            removeHistoryListener?.();
            removeStreamListener?.();
            removeErrorListener?.();
            removeStageListener?.();
        };
    }, []);

    // Auto-collapse logic (only if not hovering and no input)
    useEffect(() => {
        if (ballState === 'input' && !input.trim() && images.length === 0 && !isProcessing && !isHovering) {
            collapseTimeoutRef.current = setTimeout(() => {
                setBallState('collapsed');
                window.ipcRenderer.invoke('floating-ball:toggle');
            }, UI_TIMEOUTS.FLOATING_BALL_COLLAPSE); // Use constant
        }

        return () => {
            if (collapseTimeoutRef.current) {
                clearTimeout(collapseTimeoutRef.current);
            }
        };
    }, [ballState, input, images, isProcessing, isHovering]);

    // Clear timeout when user types
    useEffect(() => {
        if (input.trim() || images.length > 0) {
            if (collapseTimeoutRef.current) {
                clearTimeout(collapseTimeoutRef.current);
                collapseTimeoutRef.current = null;
            }
        }
    }, [input, images]);

    // Auto-scroll to bottom (newest message) when messages or streaming text changes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (messagesContainerRef.current) {
                console.log('[FloatingBall] Auto-scroll - scrollTop:', messagesContainerRef.current.scrollTop, 'scrollHeight:', messagesContainerRef.current.scrollHeight);
                messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
        }, 50);
        return () => clearTimeout(timeoutId);
    }, [messages, streamingText]);

    // Click outside to collapse
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                if (ballState !== 'collapsed' && !isProcessing) {
                    setBallState('collapsed');
                    window.ipcRenderer.invoke('floating-ball:toggle');
                }
            }
        };

        if (ballState !== 'collapsed') {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [ballState, isProcessing]);

    // Focus input when expanding to input state
    useEffect(() => {
        if (ballState === 'input') {
            setTimeout(() => inputRef.current?.focus(), UI_TIMEOUTS.INPUT_FOCUS_DELAY);
        }
    }, [ballState]);

    // Handle ball click - expand slowly
    const handleBallClick = () => {
        // If there are messages, show expanded view with history, otherwise show input
        if (messages.length > 0) {
            setBallState('expanded');
        } else {
            setBallState('input');
        }
        window.ipcRenderer.invoke('floating-ball:toggle');
    };

    // Handle submit - send message and expand to full view
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && images.length === 0) || isProcessing) return;

        setIsProcessing(true);
        setStreamingText('');
        setBallState('expanded'); // Expand to show conversation

        try {
            // Send as object if images exist, otherwise string for backward compat
            if (images.length > 0) {
                await window.ipcRenderer.invoke('agent:send-message', { content: input, images });
            } else {
                await window.ipcRenderer.invoke('agent:send-message', input.trim());
            }
        } catch (err) {
            console.error(err);
            setIsProcessing(false);
        }
        setInput('');
        setImages([]);
    };

    // Handle collapse
    const handleCollapse = () => {
        setBallState('collapsed');
        window.ipcRenderer.invoke('floating-ball:toggle');
    };

    // Image Input Handlers
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            Array.from(files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const result = e.target?.result as string;
                        if (result) {
                            setImages(prev => [...prev, result]);
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const blob = items[i].getAsFile();
                if (blob) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const result = e.target?.result as string;
                        if (result) {
                            setImages(prev => [...prev, result]);
                        }
                    };
                    reader.readAsDataURL(blob);
                }
            }
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    // General drag handling - works for all states
    const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, moved: false });

    const handleDragStart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragRef.current = { isDragging: true, startX: e.screenX, startY: e.screenY, moved: false };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (dragRef.current.isDragging) {
                const deltaX = moveEvent.screenX - dragRef.current.startX;
                const deltaY = moveEvent.screenY - dragRef.current.startY;

                // Move window immediately (no threshold for drag header)
                dragRef.current.startX = moveEvent.screenX;
                dragRef.current.startY = moveEvent.screenY;
                window.ipcRenderer.invoke('floating-ball:move', { deltaX, deltaY });
            }
        };

        const handleMouseUp = () => {
            dragRef.current.isDragging = false;
            dragRef.current.moved = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Collapsed state drag with click detection
    const handleMouseDown = (e: React.MouseEvent) => {
        if (ballState !== 'collapsed') return;
        e.preventDefault();
        e.stopPropagation();
        dragRef.current = { isDragging: true, startX: e.screenX, startY: e.screenY, moved: false };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (dragRef.current.isDragging) {
                const deltaX = moveEvent.screenX - dragRef.current.startX;
                const deltaY = moveEvent.screenY - dragRef.current.startY;

                if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                    dragRef.current.moved = true;
                }

                if (dragRef.current.moved) {
                    dragRef.current.startX = moveEvent.screenX;
                    dragRef.current.startY = moveEvent.screenY;
                    window.ipcRenderer.invoke('floating-ball:move', { deltaX, deltaY });
                }
            }
        };

        const handleMouseUp = () => {
            const wasMoved = dragRef.current.moved;
            dragRef.current.isDragging = false;
            dragRef.current.moved = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);

            // Only trigger click if not dragged
            if (!wasMoved) {
                handleBallClick();
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Collapsed Ball (Unchanged)
    if (ballState === 'collapsed') {
        return (
            <div
                ref={containerRef}
                className="w-16 h-16 flex items-center justify-center select-none cursor-move"
                style={{ background: 'transparent' }}
                onMouseDown={handleMouseDown}
            >
                <div className="relative w-14 h-14 group">
                    <div className="absolute inset-0 bg-amber-200/30 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative w-14 h-14 rounded-full bg-stone-800 flex items-center justify-center shadow-lg border border-stone-700 transition-transform hover:scale-105 overflow-hidden">
                        <img src="/icon.png" alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    {isProcessing && (
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-orange-500 rounded-full animate-pulse border-2 border-white" />
                    )}
                </div>
            </div>
        );
    }

    // Input-only state (initial expand)
    if (ballState === 'input') {
        return (
            <div
                ref={containerRef}
                className="w-full h-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-stone-200/60 overflow-hidden animate-scale-in flex flex-col"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                {/* Draggable Header */}
                <div
                    className="flex items-center justify-center py-2 cursor-move bg-stone-50/80 border-b border-stone-200/60"
                    onMouseDown={handleDragStart}
                >
                    <div className="w-10 h-1 bg-stone-300/60 rounded-full" />
                </div>

                {/* Input Area */}
                <div className="p-4">
                    {/* Image Preview */}
                    {images.length > 0 && (
                        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                            {images.map((img, idx) => (
                                <div key={idx} className="relative w-12 h-12 rounded-xl border border-stone-200/60 overflow-hidden shrink-0 group">
                                    <img src={img} alt="Preview" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(idx)}
                                        aria-label="移除图片"
                                        className="absolute top-0 right-0 bg-black/60 backdrop-blur-sm text-white p-0.5 opacity-0 group-hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                                    >
                                        <X size={8} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-stone-50/80 border border-stone-200/60 rounded-2xl px-3 py-2.5 focus-within:border-[#E85D3E]/50 focus-within:ring-2 focus-within:ring-[#E85D3E]/10 transition-all">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            aria-label="上传图片"
                            className="text-stone-400 hover:text-stone-600 p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D3E]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-lg transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={handleFileSelect}
                        />

                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onPaste={handlePaste}
                            placeholder={isProcessing ? "思考中..." : "描述任务..."}
                            aria-label="描述任务"
                            className="flex-1 bg-transparent text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none"
                            autoFocus
                            disabled={isProcessing}
                        />
                        <button
                            type="submit"
                            disabled={(!input.trim() && images.length === 0) || isProcessing}
                            aria-label="发送"
                            className={`p-1.5 rounded-xl transition-all ${input.trim() || images.length > 0
                                ? 'bg-gradient-to-br from-[#E85D3E] to-[#d14a2e] text-white shadow-sm'
                                : 'bg-stone-200 text-stone-400'
                                } focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D3E]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${isProcessing ? 'opacity-50' : ''}`}
                        >
                            <ArrowUp size={14} />
                        </button>
                    </form>

                    {/* Processing status indicator */}
                    {isProcessing && (
                        <div className="flex items-center gap-2 text-xs text-stone-400 px-1 mt-2">
                            <div className="w-1.5 h-1.5 bg-[#E85D3E] rounded-full animate-bounce" />
                            思考中...
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="px-3 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => {
                                window.ipcRenderer.invoke('agent:new-session');
                                setMessages([]);
                                setImages([]);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                        >
                            <Plus size={12} />
                            新会话
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowHistory(!showHistory)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                        >
                            <History size={12} />
                            历史
                        </button>
                        <button
                            type="button"
                            onClick={() => window.ipcRenderer.invoke('floating-ball:show-main')}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                        >
                            <Home size={12} />
                            首页
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleCollapse}
                        aria-label="关闭"
                        className="p-1 text-stone-400 hover:text-stone-600 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Previous Tasks (History) */}
                {showHistory && messages.length > 0 && (
                    <div className="border-t border-stone-100 p-3 max-h-40 overflow-y-auto">
                        <p className="text-xs text-stone-400 mb-2">最近任务</p>
                        {messages
                            .filter(m => m.role === 'user')
                            .slice(-5)
                            .map((msg, idx) => {
                                const text = typeof msg.content === 'string' ? msg.content :
                                    Array.isArray(msg.content) ? msg.content.find(b => b.type === 'text')?.text : '';
                                return text ? (
                                    <div key={idx} className="text-xs text-stone-600 py-1 truncate">
                                        • {text}
                                    </div>
                                ) : null;
                            })}
                    </div>
                )}
            </div>
        );
    }

    // Expanded state (with conversation)
    return (
        <div
            ref={containerRef}
            className="w-full h-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-stone-200/60 flex flex-col overflow-hidden animate-scale-in"
        >
            {/* Draggable Header */}
            <div
                className="flex items-center justify-center py-2 cursor-move bg-stone-50/80 border-b border-stone-200/60 shrink-0"
                onMouseDown={handleDragStart}
            >
                <div className="w-10 h-1 bg-stone-300/60 rounded-full" />
            </div>

            {/* Lightbox Overlay */}
            {selectedImage && (
                <div
                    className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImage(null);
                    }}
                >
                    <button
                        type="button"
                        aria-label="关闭预览"
                        className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded"
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImage(null);
                        }}
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={selectedImage}
                        alt="Full size"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    />
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200/60 shrink-0">
                <span className="text-sm font-semibold text-stone-700 tracking-tight">Bingowork</span>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => {
                            window.ipcRenderer.invoke('agent:new-session');
                            setMessages([]);
                            setImages([]);
                        }}
                        aria-label="新会话"
                        className="p-1.5 text-stone-400 hover:text-stone-600 rounded-xl transition-all hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D3E]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                        <Plus size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => window.ipcRenderer.invoke('floating-ball:show-main')}
                        aria-label="回到首页"
                        className="p-1.5 text-stone-400 hover:text-stone-600 rounded-xl transition-all hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D3E]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                        <Home size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={handleCollapse}
                        aria-label="收起"
                        className="p-1.5 text-stone-400 hover:text-stone-600 rounded-xl transition-all hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D3E]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                        <ChevronDown size={14} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.filter(m => m.role !== 'system').map((msg, idx) => {
                    if (msg.role === 'user') {
                        const text = typeof msg.content === 'string' ? msg.content :
                            Array.isArray(msg.content) ? msg.content.find(b => b.type === 'text')?.text : '';

                        // Check if message has images
                        const images = Array.isArray(msg.content) ? msg.content.filter(b => b.type === 'image') : [];

                        if (Array.isArray(msg.content) && msg.content[0]?.type === 'tool_result') return null;

                        return (
                            <div key={idx} className="bg-stone-100 rounded-xl px-3 py-2 text-sm text-stone-700 max-w-[85%] space-y-2">
                                {images.length > 0 && (
                                    <div className="flex gap-2 flex-wrap">
                                        {images.map((img, i: number) => (
                                            <img
                                                key={i}
                                                src={`data:${img.source?.media_type};base64,${img.source?.data}`}
                                                alt="User upload"
                                                className="w-20 h-20 object-cover rounded-lg cursor-zoom-in hover:opacity-90 transition-opacity"
                                                onClick={() => setSelectedImage(`data:${img.source?.media_type};base64,${img.source?.data}`)}
                                            />
                                        ))}
                                    </div>
                                )}
                                {text && <div>{text}</div>}
                                {!text && images.length === 0 && '...'}
                            </div>
                        );
                    }
                    // Assistant message
                    const blocks: ContentBlock[] = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }];
                    return (
                        <div key={idx} className="space-y-1">
                            {blocks.map((block, i: number) => {
                                if (block.type === 'text' && block.text) {
                                    return (
                                        <div key={i} className="text-sm text-stone-600 leading-relaxed max-w-none">
                                            <MarkdownRenderer content={block.text} className="prose-sm" />
                                        </div>
                                    );
                                }
                                if (block.type === 'tool_use') {
                                    return (
                                        <div key={i} className="text-xs text-stone-400 bg-stone-50 rounded px-2 py-1">
                                            ⌘ {block.name}
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    );
                })}

                {/* Streaming */}
                {streamingText && (
                    <div className="text-sm text-stone-600 leading-relaxed max-w-none">
                        <MarkdownRenderer content={streamingText} className="prose-sm" />
                        <span className="inline-block w-1.5 h-4 bg-orange-500 ml-0.5 animate-pulse" />
                    </div>
                )}

                {/* Processing indicator */}
                {isProcessing && !streamingText && (
                    <div className="flex items-center gap-2 text-xs text-stone-400">
                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" />
                        思考中...
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="border-t border-stone-200/60 p-3 bg-stone-50/30">
                {/* Image Preview */}
                {images.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-1 px-1">
                        {images.map((img, idx) => (
                            <div key={idx} className="relative w-12 h-12 rounded-xl border border-stone-200/60 overflow-hidden shrink-0 group">
                                <img src={img} alt="Preview" className="w-full h-full object-cover" />
                                <button
                                    onClick={() => removeImage(idx)}
                                    className="absolute top-0 right-0 bg-black/60 backdrop-blur-sm text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={8} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="flex items-center gap-2 bg-white border border-stone-200/60 rounded-2xl px-3 py-2.5 focus-within:border-[#E85D3E]/50 focus-within:ring-2 focus-within:ring-[#E85D3E]/10 transition-all shadow-sm">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-stone-400 hover:text-stone-600 p-1 rounded-lg transition-all hover:bg-stone-100"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={handleFileSelect}
                        />

                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onPaste={handlePaste}
                            placeholder="继续对话..."
                            className="flex-1 bg-transparent text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none"
                            disabled={isProcessing}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() && images.length === 0 || isProcessing}
                            className={`p-1.5 rounded-xl transition-all ${input.trim() || images.length > 0 && !isProcessing
                                ? 'bg-gradient-to-br from-[#E85D3E] to-[#d14a2e] text-white shadow-sm'
                                : 'bg-stone-200 text-stone-400'
                                }`}
                        >
                            <ArrowUp size={14} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
});
export default FloatingBallPage;
