import { useState, useRef, useEffect } from 'react';
import { Plus, Info, Settings, MessageSquare, Trash2, Edit2, MoreHorizontal, PanelLeftClose } from 'lucide-react';
import type { Session } from '../../../electron/types/ipc';

type Tab = 'chat' | 'code' | 'cowork';

interface LeftSidebarProps {
  onOpenSettings?: () => void;
  activeTab?: Tab;
  onTabChange?: (tab: Tab) => void;
  sessions?: Session[];
  currentSessionId?: string | null;
  onLoadSession?: (id: string) => void;
  onNewSession?: () => void;
  onDeleteSession?: (id: string) => void;
  onRenameSession?: (id: string, title: string) => void;
  footerHeight?: number | null;
  isOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function LeftSidebar({ 
  onOpenSettings,
  activeTab = 'cowork',
  onTabChange,
  sessions = [],
  currentSessionId,
  onLoadSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  footerHeight,
  isOpen = true,
  onToggleSidebar
}: LeftSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStartEdit = (session: Session) => {
    setEditingId(session.id);
    setEditTitle(session.title);
    setMenuOpenId(null);
  };

  const handleFinishEdit = () => {
    if (editingId && editTitle.trim() && onRenameSession) {
      onRenameSession(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishEdit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <div className={`${
      isOpen ? 'w-[280px] opacity-100' : 'w-0 opacity-0'
    } bg-[#FAF8F5] flex flex-col border-r border-stone-200/60 h-full transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap`}>
      <div className="w-[280px] h-full flex flex-col">
      {/* Tabs */}
      <div className="sidebar-section flex items-center justify-between pr-4">
        <div className="tab-switcher flex-1">
          {(['chat', 'code', 'cowork'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange?.(tab)}
              className={`tab-button ${
                activeTab === tab
                  ? 'active text-stone-800'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={onToggleSidebar}
          className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-200/50 rounded-lg transition-colors ml-2"
          title="收起侧边栏"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* New Task Button */}
      <div className="px-5 pb-5">
        <button
          onClick={onNewSession}
          className="flex items-center gap-3 text-stone-700 hover:text-stone-900 font-medium text-sm transition-all w-full p-3 hover:bg-stone-200/50 rounded-2xl text-left"
        >
          <div className="w-7 h-7 rounded-xl bg-[#E85D3E] flex items-center justify-center text-white shadow-sm">
            <Plus size={16} />
          </div>
          新建会话
        </button>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto px-3 custom-scrollbar">
        <div className="space-y-1.5">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group relative p-3 rounded-2xl transition-all cursor-pointer ${
                currentSessionId === session.id
                  ? 'bg-white shadow-md border border-stone-100/80'
                  : 'hover:bg-stone-200/40 border border-transparent'
              }`}
              onClick={() => onLoadSession?.(session.id)}
            >
              {editingId === session.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleFinishEdit}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D3E]/20 focus:border-[#E85D3E]"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 overflow-hidden">
                    <MessageSquare size={15} className="mt-0.5 shrink-0 text-stone-400" />
                    <h3 className={`text-sm truncate leading-relaxed ${
                      currentSessionId === session.id ? 'font-semibold text-stone-800' : 'font-medium text-stone-600'
                    }`}>
                      {session.title || '未命名会话'}
                    </h3>
                  </div>

                  <button
                    className={`opacity-0 group-hover:opacity-100 p-1.5 hover:bg-stone-200 rounded-xl text-stone-400 hover:text-stone-600 transition-all ${
                      menuOpenId === session.id ? 'opacity-100' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === session.id ? null : session.id);
                    }}
                  >
                    <MoreHorizontal size={15} />
                  </button>

                  {/* Context Menu */}
                  {menuOpenId === session.id && (
                    <div
                      ref={menuRef}
                      className="absolute right-3 top-12 w-36 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-stone-200/60 z-10 py-2 animate-scale-in"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleStartEdit(session)}
                        className="w-full px-4 py-2.5 text-left text-xs text-stone-600 hover:bg-stone-50 flex items-center gap-2 transition-colors"
                      >
                        <Edit2 size={13} /> 重命名
                      </button>
                      <button
                        onClick={() => {
                          onDeleteSession?.(session.id);
                          setMenuOpenId(null);
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 size={13} /> 删除
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="text-[10px] text-stone-400 pl-7 mt-1.5 font-medium tracking-wide">
                {new Date(session.updatedAt).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div
        className="p-5 border-t border-stone-200/60 flex flex-col justify-end"
        style={footerHeight ? { height: footerHeight } : undefined}
      >
        <div className="flex items-start gap-2.5 text-xs text-stone-400 mb-4">
          <Info size={14} className="mt-0.5 shrink-0" />
          <p className="leading-relaxed">所有会话仅保存在本地，不会上传到云端</p>
        </div>

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2.5 text-stone-600 hover:text-stone-900 text-sm font-medium transition-all w-full p-3 hover:bg-stone-200/50 rounded-2xl"
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
