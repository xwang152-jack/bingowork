/**
 * Refactored CoworkView Component
 * Main workspace view composed of smaller, focused components
 */

import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { SessionSidebar } from './SessionSidebar';
import { TopBar } from './TopBar';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { useAgent } from '../../hooks/useAgent';
import { useSessions } from '../../hooks/useIPC';

export interface CoworkViewRefactoredProps {
    onOpenSettings: () => void;
}

/**
 * Main cowork view component with session management and chat functionality
 */
export function CoworkViewRefactored({ onOpenSettings }: CoworkViewRefactoredProps) {
    const [showSidebar, setShowSidebar] = useState(true);

    // Use custom hooks for state management
    const {
        history,
        isProcessing,
        sendMessage,
        abort,
        streamingText,
    } = useAgent();

    const {
        sessions,
        currentSessionId,
        loading: sessionsLoading,
        loadSession,
        deleteSession,
        renameSession,
        createNew,
    } = useSessions();

    // Handle sending a message
    const handleSendMessage = useCallback(async (content: string, images?: string[]) => {
        await sendMessage(content, images);
    }, [sendMessage]);

    // Handle creating a new session
    const handleNewSession = useCallback(async () => {
        await createNew();
    }, [createNew]);

    // Handle loading a session
    const handleLoadSession = useCallback(async (id: string) => {
        await loadSession(id);
    }, [loadSession]);

    // Handle deleting a session
    const handleDeleteSession = useCallback(async (id: string) => {
        await deleteSession(id);
    }, [deleteSession]);

    // Handle renaming a session
    const handleRenameSession = useCallback(async (id: string, title: string) => {
        await renameSession(id, title);
    }, [renameSession]);

    // Handle aborting the current operation
    const handleAbort = useCallback(async () => {
        await abort();
    }, [abort]);

    // Get current session title
    const currentSessionTitle = sessions.find(s => s.id === currentSessionId)?.title || 'Bingowork';

    return (
        <div className="h-screen w-full bg-[#FAF8F5] flex flex-col overflow-hidden font-sans">
            {/* Top Bar */}
            <TopBar
                title={currentSessionTitle}
                onNewSession={handleNewSession}
                onOpenSettings={onOpenSettings}
            />

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                {showSidebar && (
                    <SessionSidebar
                        sessions={sessions}
                        currentSessionId={currentSessionId}
                        loading={sessionsLoading}
                        onLoadSession={handleLoadSession}
                        onNewSession={handleNewSession}
                        onDeleteSession={handleDeleteSession}
                        onRenameSession={handleRenameSession}
                    />
                )}

                {/* Toggle Sidebar Button */}
                <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-white border border-stone-200 rounded-r-lg shadow-sm hover:bg-stone-50 transition-colors"
                    style={{ left: showSidebar ? '16rem' : '0' }}
                >
                    <X
                        size={16}
                        className={`transition-transform ${showSidebar ? '' : 'rotate-180'}`}
                    />
                </button>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col ml-auto">
                    {/* Messages */}
                    <MessageList messages={history} isDark={false} streamingText={streamingText} />

                    {/* Processing Indicator */}
                    {isProcessing && (
                        <div className="px-4 py-2 bg-orange-50 text-orange-700 text-sm flex items-center gap-2">
                            <div className="animate-spin w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full" />
                            <span>AI 正在处理...</span>
                            <button
                                onClick={handleAbort}
                                className="ml-auto px-2 py-1 text-xs bg-orange-100 hover:bg-orange-200 rounded transition-colors"
                            >
                                中止
                            </button>
                        </div>
                    )}

                    {/* Input */}
                    <ChatInput
                        disabled={isProcessing}
                        onSend={handleSendMessage}
                        placeholder="输入消息... (支持拖拽上传图片)"
                    />
                </div>
            </div>
        </div>
    );
}
