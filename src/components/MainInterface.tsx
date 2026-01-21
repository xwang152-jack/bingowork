import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelLeftOpen } from 'lucide-react';
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

const SIDEBAR_OPEN_KEY = 'bingowork-sidebar-open';

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

    // Sidebar state
    const [sidebarOpen, setSidebarOpen] = useState(() => {
        try {
            const saved = localStorage.getItem(SIDEBAR_OPEN_KEY);
            return saved !== null ? saved === 'true' : true;
        } catch {
            return true;
        }
    });

    const toggleSidebar = useCallback(() => {
        setSidebarOpen(prev => {
            const next = !prev;
            localStorage.setItem(SIDEBAR_OPEN_KEY, String(next));
            return next;
        });
    }, []);

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
                isOpen={sidebarOpen}
                onToggleSidebar={toggleSidebar}
            />

            <div className="flex-1 flex flex-col h-full relative min-w-0 bg-white">
                {/* Expand Button */}
                {!sidebarOpen && (
                    <div className="absolute left-4 top-3 z-10 animate-fade-in">
                        <button
                            onClick={toggleSidebar}
                            className="p-2 bg-white/80 backdrop-blur-sm border border-stone-200/60 rounded-xl shadow-sm hover:shadow-md hover:bg-white text-stone-500 hover:text-stone-800 transition-all"
                            title="展开侧边栏"
                        >
                            <PanelLeftOpen size={20} />
                        </button>
                    </div>
                )}

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
