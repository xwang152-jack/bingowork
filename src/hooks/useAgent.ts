/**
 * useAgent Hook
 * Hook for interacting with the AI agent
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AgentMessage, AgentStage } from '../../electron/types/ipc';
import { ipcService } from '../../electron/services/IPCService.ts';

export interface UseAgentResult {
    history: AgentMessage[];
    isProcessing: boolean;
    stage: AgentStage;
    streamingText: string;
    sendMessage: (content: string, images?: string[]) => Promise<void>;
    abort: () => Promise<void>;
    deleteMessage: (id: string) => Promise<void>;
    regenerateMessage: (id: string) => Promise<void>;
    error: string | null;
}

/**
 * Hook for interacting with the agent
 */
export function useAgent(): UseAgentResult {
    const [history, setHistory] = useState<AgentMessage[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [stage, setStage] = useState<AgentStage>('IDLE');
    const [error, setError] = useState<string | null>(null);
    const [streamingText, setStreamingText] = useState('');
    const streamingTextRef = useRef('');
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        streamingTextRef.current = streamingText;
    }, [streamingText]);

    useEffect(() => {
        if (!window.ipcRenderer) return;

        const removeListener = window.ipcRenderer.on('agent:history-update', async (_event, updatedHistory) => {
            setHistory(updatedHistory as AgentMessage[]);
            // Do not set isProcessing to false here, wait for agent:processing-state
            setStreamingText(''); // Clear streaming text as it is now part of history

            // 优化：异步保存会话，避免阻塞 UI
            // 使用 setTimeout 将深拷贝操作推迟到下一个事件循环
            setTimeout(() => {
                try {
                    // Create a clean copy without any non-serializable properties
                    const cleanHistory = JSON.parse(JSON.stringify(updatedHistory));
                    window.ipcRenderer.invoke('session:save', cleanHistory).catch((err) => {
                        console.error('Failed to save session:', err);
                    });
                } catch (err) {
                    console.error('Failed to save session:', err);
                }
            }, 0);
        });

        const removeErrorListener = window.ipcRenderer.on('agent:error', (_event, err) => {
            console.error('Agent Error:', err);
            setError(err as string);
            // setIsProcessing(false); // Let state manager handle this via processing-state event
            setStreamingText('');
        });

        const removeStageListener = window.ipcRenderer.on('agent:stage', (_event, newStage) => {
            setStage((newStage as { stage: AgentStage }).stage);
        });

        const removeStreamListener = window.ipcRenderer.on('agent:stream-token', (_event, token) => {
            // 累积 token 到 ref
            streamingTextRef.current += (token as string);

            // 使用 requestAnimationFrame 批处理更新，减少状态更新频率
            if (rafRef.current) return;

            rafRef.current = requestAnimationFrame(() => {
                setStreamingText(streamingTextRef.current);
                rafRef.current = null;
            });
        });

        const removeProcessingStateListener = window.ipcRenderer.on('agent:processing-state', (_event, state) => {
            const { isProcessing } = state as { isProcessing: boolean };
            setIsProcessing(isProcessing);
            if (!isProcessing) {
                setStreamingText('');
            }
        });

        return () => {
            removeListener();
            removeErrorListener();
            removeStageListener();
            removeStreamListener();
            removeProcessingStateListener();
            // 清理 RAF
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, []);

    const sendMessage = useCallback(async (content: string, images?: string[]) => {
        setIsProcessing(true);
        setError(null);
        try {
            await ipcService.sendMessage(content, images);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setIsProcessing(false);
        }
    }, []);

    const abort = useCallback(async () => {
        await ipcService.abortAgent();
        setIsProcessing(false);
    }, []);

    const deleteMessage = useCallback(async (id: string) => {
        setIsProcessing(true);
        setError(null);
        try {
            await ipcService.deleteMessage(id);
        } catch (err) {
            console.error('Failed to delete message:', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const regenerateMessage = useCallback(async (id: string) => {
        setIsProcessing(true);
        setError(null);
        try {
            await ipcService.regenerateMessage(id);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setIsProcessing(false);
        }
    }, []);

    return {
        history,
        isProcessing,
        stage,
        streamingText,
        sendMessage,
        abort,
        deleteMessage,
        regenerateMessage,
        error,
    };
}
