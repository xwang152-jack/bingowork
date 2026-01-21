/**
 * Refactored CoworkView Component
 * Main workspace view composed of smaller, focused components
 */

import { useState, useCallback, useEffect } from 'react';
import { SessionSidebar } from './SessionSidebar';
import { TopBar } from './TopBar';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { useAgent } from '../../hooks/useAgent';
import { useSessions } from '../../hooks/useIPC';

export interface CoworkViewRefactoredProps {
    onOpenSettings: () => void;
}

const SIDEBAR_COLLAPSED_KEY = 'bingowork-sidebar-collapsed';

/**
 * Main cowork view component with session management and chat functionality
 */
export function CoworkViewRefactored({ onOpenSettings }: CoworkViewRefactoredProps) {
    // Load collapsed state from localStorage
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        try {
            return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
        } catch {
            return false;
        }
    });

    // Save collapsed state to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
        } catch (error) {
            console.warn('Failed to save sidebar state:', error);
        }
    }, [sidebarCollapsed]);

    const toggleSidebar = useCallback(() => {
        setSidebarCollapsed(prev => !prev);
    }, []);

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
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={toggleSidebar}
            />

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                {!sidebarCollapsed && (
                    <div className="w-[280px] flex-shrink-0 transition-all duration-300 ease-in-out">
                        <SessionSidebar
                            sessions={sessions}
                            currentSessionId={currentSessionId}
                            loading={sessionsLoading}
                            onLoadSession={handleLoadSession}
                            onNewSession={handleNewSession}
                            onDeleteSession={handleDeleteSession}
                            onRenameSession={handleRenameSession}
                        />
                    </div>
                )}

                {/* Collapsed sidebar hint */}
                {sidebarCollapsed && (
                    <button
                        onClick={toggleSidebar}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white border border-stone-200 rounded-r-lg shadow-lg hover:bg-stone-50 hover:border-stone-300 transition-all group"
                        title="展开侧边栏"
                    >
                        <div className="flex flex-col items-center gap-1">
                            <div className="w-1 h-4 bg-stone-300 rounded-full group-hover:bg-[#E85D3E] transition-colors"></div>
                            <div className="w-1 h-4 bg-stone-300 rounded-full group-hover:bg-[#E85D3E] transition-colors"></div>
                            <div className="w-1 h-4 bg-stone-300 rounded-full group-hover:bg-[#E85D3E] transition-colors"></div>
                        </div>
                    </button>
                )}

                {/* Chat Area */}
                <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out">
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
