/**
 * Session Sidebar Component
 * Displays and manages chat sessions
 */

import { useState, useMemo, useCallback } from 'react';
import { Folder, MessageSquare, Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import type { Session } from '../../../electron/types/ipc';

export interface SessionSidebarProps {
    sessions: Session[];
    currentSessionId: string | null;
    loading: boolean;
    onLoadSession: (id: string) => void;
    onNewSession: () => void;
    onDeleteSession: (id: string) => void;
    onRenameSession: (id: string, title: string) => void;
}

export function SessionSidebar({
    sessions,
    currentSessionId,
    loading,
    onLoadSession,
    onNewSession,
    onDeleteSession,
    onRenameSession,
}: SessionSidebarProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    // Group sessions by date - already optimized with useMemo
    const groupedSessions = useMemo(() => {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const weekMs = 7 * dayMs;

        const today: Session[] = [];
        const yesterday: Session[] = [];
        const week: Session[] = [];
        const older: Session[] = [];

        sessions.forEach(session => {
            const age = now - session.updatedAt;
            if (age < dayMs) {
                today.push(session);
            } else if (age < 2 * dayMs) {
                yesterday.push(session);
            } else if (age < weekMs) {
                week.push(session);
            } else {
                older.push(session);
            }
        });

        return { today, yesterday, week, older };
    }, [sessions]);

    // Memoize callbacks with useCallback
    const startEdit = useCallback((session: Session) => {
        setEditingId(session.id);
        setEditTitle(session.title);
    }, []);

    const saveEdit = useCallback(() => {
        if (editingId && editTitle.trim()) {
            onRenameSession(editingId, editTitle.trim());
        }
        setEditingId(null);
        setEditTitle('');
    }, [editingId, editTitle, onRenameSession]);

    const cancelEdit = useCallback(() => {
        setEditingId(null);
        setEditTitle('');
    }, []);

    const confirmDelete = useCallback((id: string) => {
        setPendingDeleteId(id);
    }, []);

    const handleDelete = useCallback(() => {
        if (pendingDeleteId) {
            onDeleteSession(pendingDeleteId);
            setPendingDeleteId(null);
        }
    }, [pendingDeleteId, onDeleteSession]);

    const handleLoadSession = useCallback((id: string) => {
        onLoadSession(id);
    }, [onLoadSession]);

    // Memoize renderSessionGroup
    const renderSessionGroup = useCallback((title: string, groupSessions: Session[]) => {
        if (groupSessions.length === 0) return null;

        return (
            <div key={title} className="mb-4">
                <h3 className="px-3 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wider">
                    {title}
                </h3>
                {groupSessions.map(session => (
                    <SessionItem
                        key={session.id}
                        session={session}
                        isActive={session.id === currentSessionId}
                        isEditing={editingId === session.id}
                        editTitle={editTitle}
                        onEditTitle={setEditTitle}
                        onClick={() => handleLoadSession(session.id)}
                        onStartEdit={() => startEdit(session)}
                        onSaveEdit={saveEdit}
                        onCancelEdit={cancelEdit}
                        onDelete={() => confirmDelete(session.id)}
                        isPendingDelete={pendingDeleteId === session.id}
                        onCancelDelete={() => setPendingDeleteId(null)}
                        onConfirmDelete={handleDelete}
                    />
                ))}
            </div>
        );
    }, [currentSessionId, editingId, editTitle, pendingDeleteId, handleLoadSession, startEdit, saveEdit, cancelEdit, confirmDelete, handleDelete]);

    return (
        <div className="w-64 bg-stone-50 border-r border-stone-200 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-stone-200">
                <button
                    onClick={onNewSession}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                    <Plus size={18} />
                    新建会话
                </button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto p-3">
                {loading ? (
                    <div className="text-center text-stone-400 py-8">加载中...</div>
                ) : sessions.length === 0 ? (
                    <div className="text-center text-stone-400 py-8">
                        <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">暂无会话</p>
                    </div>
                ) : (
                    <>
                        {renderSessionGroup('今天', groupedSessions.today)}
                        {renderSessionGroup('昨天', groupedSessions.yesterday)}
                        {renderSessionGroup('过去 7 天', groupedSessions.week)}
                        {renderSessionGroup('更早', groupedSessions.older)}
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-stone-200 text-xs text-stone-400 text-center">
                {sessions.length} 个会话
            </div>
        </div>
    );
}

interface SessionItemProps {
    session: Session;
    isActive: boolean;
    isEditing: boolean;
    editTitle: string;
    onEditTitle: (title: string) => void;
    onClick: () => void;
    onStartEdit: () => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onDelete: () => void;
    isPendingDelete: boolean;
    onCancelDelete: () => void;
    onConfirmDelete: () => void;
}

function SessionItem({
    session,
    isActive,
    isEditing,
    editTitle,
    onEditTitle,
    onClick,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onDelete,
    isPendingDelete,
    onCancelDelete,
    onConfirmDelete,
}: SessionItemProps) {
    if (isPendingDelete) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg mb-1">
                <span className="text-sm flex-1">确认删除?</span>
                <button
                    onClick={onConfirmDelete}
                    className="p-1 hover:bg-red-200 rounded"
                    title="确认删除"
                >
                    <Check size={14} />
                </button>
                <button
                    onClick={onCancelDelete}
                    className="p-1 hover:bg-red-200 rounded"
                    title="取消"
                >
                    <X size={14} />
                </button>
            </div>
        );
    }

    if (isEditing) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg mb-1 border border-stone-200">
                <input
                    type="text"
                    value={editTitle}
                    onChange={e => onEditTitle(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') onSaveEdit();
                        if (e.key === 'Escape') onCancelEdit();
                    }}
                    className="flex-1 text-sm bg-transparent border-none outline-none"
                    autoFocus
                />
                <button
                    onClick={onSaveEdit}
                    className="p-1 hover:bg-stone-100 rounded"
                    title="保存"
                >
                    <Check size={14} />
                </button>
                <button
                    onClick={onCancelEdit}
                    className="p-1 hover:bg-stone-100 rounded"
                    title="取消"
                >
                    <X size={14} />
                </button>
            </div>
        );
    }

    return (
        <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-1 cursor-pointer transition-colors group ${
                isActive
                    ? 'bg-orange-100 text-orange-800'
                    : 'hover:bg-stone-100 text-stone-700'
            }`}
            onClick={isActive ? undefined : onClick}
        >
            <Folder size={16} className="flex-shrink-0" />
            <span className="flex-1 text-sm truncate">{session.title}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={e => {
                        e.stopPropagation();
                        onStartEdit();
                    }}
                    className="p-1 hover:bg-stone-200 rounded"
                    title="重命名"
                >
                    <Edit2 size={12} />
                </button>
                <button
                    onClick={e => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="p-1 hover:bg-red-200 rounded text-red-500"
                    title="删除"
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
}
