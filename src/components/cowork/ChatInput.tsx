/**
 * Chat Input Component
 * Handles text input and image uploads for chat messages
 */

import { useState, useCallback, useMemo } from 'react';
import { Plus, ArrowUp, X, Square } from 'lucide-react';
import { useImageUpload } from '../../hooks/useImageUpload';

export interface ChatInputProps {
    disabled?: boolean;
    isProcessing?: boolean;
    onSend: (content: string, images?: string[]) => void;
    onStop?: () => void;
    placeholder?: string;
    models?: Array<{
        id: string;
        modelId?: string;
        isConfigured: boolean;
    }>;
    activeModelId?: string;
    onModelChange?: (modelId: string) => void;
}

export function ChatInput({
    disabled = false,
    isProcessing = false,
    onSend,
    onStop,
    placeholder = '输入消息...',
    models,
    activeModelId,
    onModelChange,
}: ChatInputProps) {
    const [content, setContent] = useState('');
    const [isComposing, setIsComposing] = useState(false);

    const {
        images,
        fileInputRef,
        handleFileSelect,
        handlePaste,
        removeImage,
        clearImages,
        getImagesForUpload,
    } = useImageUpload({
        onError: (error) => {
            console.error('Image upload error:', error);
            alert(error);
        },
    });

    // 优化：减少依赖，避免每次输入都重新创建回调
    const handleSend = useCallback(() => {
        if (!content.trim() && images.length === 0) return;

        const imageUrls = getImagesForUpload();
        onSend(content.trim(), imageUrls);

        setContent('');
        clearImages();
    }, [content, images, getImagesForUpload, onSend, clearImages]);

    // Memoize key down handler
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isComposing) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend, isComposing]);

    // Memoize paste handler
    const handlePasteEvent = useCallback(async (e: React.ClipboardEvent) => {
        const hadImages = await handlePaste(e.nativeEvent);
        if (hadImages) {
            e.preventDefault();
        }
    }, [handlePaste]);

    // Memoize file change handler
    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await handleFileSelect(file);
        }
        // Reset input
        e.target.value = '';
    }, [handleFileSelect]);

    // Memoize whether can send
    const canSend = useMemo(() => {
        return content.trim() || images.length > 0;
    }, [content, images]);

    // Memoize button disabled state
    const buttonDisabled = useMemo(() => {
        return disabled || !canSend;
    }, [disabled, canSend]);

    return (
        <div className="border-t border-stone-200/60 bg-white/80 backdrop-blur-sm p-5 w-full">
            {/* Image Preview */}
            {images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 animate-fade-in">
                    {images.map((img, index) => (
                        <div
                            key={index}
                            className="relative group w-16 h-16 rounded-2xl overflow-hidden border border-stone-200/60 shadow-sm"
                        >
                            <img
                                src={img.dataUrl}
                                alt={`Upload ${index + 1}`}
                                className="w-full h-full object-cover"
                            />
                            <button
                                onClick={() => removeImage(index)}
                                className="absolute top-1.5 right-1.5 p-1.5 bg-black/60 backdrop-blur-sm text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                                title="移除图片"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="w-full">
                <div className="input-bar items-center gap-3 w-full px-4 h-[52px]">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled}
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-stone-500 hover:bg-stone-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="添加图片"
                        title="添加图片"
                    >
                        <Plus size={18} />
                    </button>
                    <input
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePasteEvent}
                        onCompositionStart={() => setIsComposing(true)}
                        onCompositionEnd={() => setIsComposing(false)}
                        placeholder={placeholder}
                        disabled={disabled}
                        className="flex-1 h-10 bg-transparent outline-none text-sm text-stone-800 placeholder:text-stone-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {models && models.length > 0 && activeModelId && onModelChange ? (
                        <select
                            value={activeModelId}
                            onChange={(e) => onModelChange(e.target.value)}
                            disabled={disabled}
                            className="text-xs text-stone-700 px-3 py-2 rounded-xl bg-stone-50 border-0 focus:outline-none focus:ring-2 focus:ring-[#E85D3E]/20 max-w-[220px] truncate disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="选择模型"
                            title="选择模型"
                        >
                            {models.map(m => (
                                <option key={m.id} value={m.id}>
                                    {`${m.modelId || m.id}${m.isConfigured ? '' : '（待配置）'}`}
                                </option>
                            ))}
                        </select>
                    ) : null}
                    {isProcessing ? (
                        <button
                            onClick={() => onStop?.()}
                            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-all flex items-center justify-center shrink-0 shadow-sm hover:shadow animate-pulse"
                            aria-label="停止"
                            title="停止生成"
                        >
                            <Square size={14} fill="currentColor" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSend}
                            disabled={buttonDisabled}
                            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#E85D3E] to-[#d14a2e] text-white hover:from-[#d14a2e] hover:to-[#b53d26] disabled:from-stone-200 disabled:to-stone-300 disabled:text-stone-400 disabled:cursor-not-allowed transition-all flex items-center justify-center shrink-0 shadow-sm hover:shadow"
                            aria-label="发送"
                        >
                            <ArrowUp size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Helper Text */}
            <div className="mt-3 text-xs text-stone-400 flex items-center justify-between">
                <span>按 Enter 发送</span>
                <span className="text-stone-300">|</span>
                <span className="text-stone-400">AI 可能会出错，请仔细核对回复内容</span>
            </div>
        </div>
    );
}
