/**
 * Top Bar Component
 * Header with session title, settings access, and new session button
 */

import { Settings, Plus, MoreVertical } from 'lucide-react';

export interface TopBarProps {
    title?: string;
    onNewSession: () => void;
    onOpenSettings: () => void;
}

export function TopBar({ title = 'Bingowork', onNewSession, onOpenSettings }: TopBarProps) {
    return (
        <div className="h-16 border-b border-stone-200/60 flex items-center justify-between px-5 bg-white/80 backdrop-blur-sm">
            {/* Title */}
            <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-stone-800 tracking-tight">{title}</h1>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={onNewSession}
                    className="p-2.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 rounded-xl transition-all"
                    title="新建会话"
                >
                    <Plus size={20} />
                </button>
                <button
                    onClick={onOpenSettings}
                    className="p-2.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 rounded-xl transition-all"
                    title="设置"
                >
                    <Settings size={20} />
                </button>
                <button
                    className="p-2.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 rounded-xl transition-all"
                    title="更多"
                >
                    <MoreVertical size={20} />
                </button>
            </div>
        </div>
    );
}
