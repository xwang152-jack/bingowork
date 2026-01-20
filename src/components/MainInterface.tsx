import { useCallback, useEffect, useRef, useState } from 'react';
import { LeftSidebar } from './layout/LeftSidebar';
import { RightSidebar } from './layout/RightSidebar';
import { MessageList } from './cowork/MessageList';
import { ChatInput } from './cowork/ChatInput';
import { useAgent } from '../hooks/useAgent';
import { useConfig, useSessions } from '../hooks/useIPC';
import { useModelRegistry } from '../hooks/useModelRegistry';

export interface MainInterfaceProps {
    onOpenSettings: () => void;
}

export default function MainInterface({ onOpenSettings }: MainInterfaceProps) {
    const {
        history,
        isProcessing,
        sendMessage,
        streamingText,
    } = useAgent();

    const {
        sessions,
        currentSessionId,
        loadSession,
        deleteSession,
        renameSession,
        createNew,
    } = useSessions();

    const { config, setWorkMode } = useConfig();
    const activeTab = (config?.workMode || 'cowork') as 'chat' | 'code' | 'cowork';

    const { state: modelState, setActiveModel: setActiveModelId } = useModelRegistry();

    const chatInputWrapRef = useRef<HTMLDivElement>(null);
    const [chatInputHeight, setChatInputHeight] = useState<number | null>(null);

    useEffect(() => {
        const el = chatInputWrapRef.current;
        if (!el) return;

        const update = () => {
            const next = el.offsetHeight;
            setChatInputHeight(prev => (prev === next ? prev : next));
        };

        update();
        const ro = new ResizeObserver(() => update());
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const handleSendMessage = useCallback(async (content: string, images?: string[]) => {
        await sendMessage(content, images);
    }, [sendMessage]);

    return (
        <div className="flex h-full w-full bg-[#FAF8F5] overflow-hidden font-sans">
            <LeftSidebar
                onOpenSettings={onOpenSettings}
                activeTab={activeTab}
                onTabChange={(tab) => { void setWorkMode(tab); }}
                sessions={sessions}
                currentSessionId={currentSessionId}
                onLoadSession={loadSession}
                onNewSession={createNew}
                onDeleteSession={deleteSession}
                onRenameSession={renameSession}
                footerHeight={chatInputHeight}
            />

            <div className="flex-1 flex flex-col h-full relative min-w-0 bg-white">
                {/* Chat Area */}
                <MessageList
                    messages={history}
                    streamingText={streamingText}
                />

                {/* Input Area */}
                <div ref={chatInputWrapRef} className="animate-fade-in">
                    <ChatInput
                        onSend={handleSendMessage}
                        disabled={isProcessing}
                        placeholder={activeTab === 'chat' ? '聊天模式：只对话，不访问本地文件' : activeTab === 'code' ? '代码模式：可读写代码与运行命令' : 'Cowork 模式：可处理任务、文件与报告'}
                        models={modelState?.models}
                        activeModelId={modelState?.activeModelId}
                        onModelChange={(id) => { void setActiveModelId(id); }}
                    />
                </div>
            </div>

            <RightSidebar />
        </div>
    );
}
