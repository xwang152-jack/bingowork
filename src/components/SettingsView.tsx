import { useState, useEffect } from 'react';
import { X, Settings, FolderOpen, Server, Check, Plus, Trash2, Edit2, Zap, Eye, Clock, Download } from 'lucide-react';
import { SkillEditor } from './SkillEditor';
import { ModelSettings } from './settings/ModelSettings';
import { MCPSettings } from './settings/MCPSettings';
import { ScheduleView } from './schedule/ScheduleView';
import { UpdateDialog } from './UpdateDialog';

interface SettingsViewProps {
    onClose: () => void;
}

interface Config {
    // Legacy model config fields (kept for type compatibility but managed via ModelSettings)
    provider: 'anthropic' | 'openai' | 'minimax';
    apiKey: string;
    apiKeys?: Record<string, string>;
    apiUrl: string;
    model: string;
    
    // Active config fields
    authorizedFolders: string[];
    networkAccess: boolean;
    browserAccess: boolean;
    shortcut: string;
}

/**
 * Settings View Component
 * Handles application configuration and settings management
 */

interface SkillInfo {
    id: string;
    name: string;
    path: string;
    isBuiltin: boolean;
}

interface ToolPermission {
    tool: string;
    pathPattern?: string;
    grantedAt: number;
}

export function SettingsView({ onClose }: SettingsViewProps) {
    const [config, setConfig] = useState<Config>({
        provider: 'anthropic',
        apiKey: '',
        apiKeys: { anthropic: '', openai: '', minimax: '' },
        apiUrl: '',
        model: '',
        authorizedFolders: [],
        networkAccess: true,
        browserAccess: false,
        shortcut: 'Alt+Space'
    });
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState<'api' | 'folders' | 'mcp' | 'skills' | 'schedule' | 'advanced' | 'about'>('api');
    const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);

    // Skills State
    const [skills, setSkills] = useState<SkillInfo[]>([]);
    const [editingSkill, setEditingSkill] = useState<string | null>(null);
    const [viewingSkill, setViewingSkill] = useState<boolean>(false); // New state for read-only mode
    const [showSkillEditor, setShowSkillEditor] = useState(false);

    // Permissions State
    const [permissions, setPermissions] = useState<ToolPermission[]>([]);

    // Update State
    const [showUpdateDialog, setShowUpdateDialog] = useState(false);

    const loadPermissions = () => {
        window.ipcRenderer.invoke('permissions:list').then(list => setPermissions(list as ToolPermission[]));
    };

    const revokePermission = async (tool: string, pathPattern?: string) => {
        await window.ipcRenderer.invoke('permissions:revoke', { tool, pathPattern });
        loadPermissions();
    };

    const clearAllPermissions = async () => {
        if (confirm('确定要清除所有已授权的权限吗？')) {
            await window.ipcRenderer.invoke('permissions:clear');
            loadPermissions();
        }
    };

    useEffect(() => {
        window.ipcRenderer.invoke('config:get-all').then(async (cfg) => {
            if (cfg) {
                const config = cfg as Config;
                setConfig({
                    ...config,
                });
            }
        });
    }, []);

    useEffect(() => {
        if (activeTab === 'skills') {
            refreshSkills();
        } else if (activeTab === 'advanced') {
            loadPermissions();
        }
    }, [activeTab]);

    // Shortcut recording handler
    const handleShortcutKeyDown = (e: React.KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const parts: string[] = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Meta');

        // Add the actual key (filter out modifier keys)
        const key = e.key;
        if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
            // Normalize key names
            const normalizedKey = key === ' ' ? 'Space' : key.length === 1 ? key.toUpperCase() : key;
            parts.push(normalizedKey);
        }

        // Allow single function keys (F1-F12) or modifier + key combinations
        const isFunctionKey = /^F\d{1,2}$/.test(parts[parts.length - 1] || '');
        if (parts.length >= 1 && (isFunctionKey || parts.length >= 2)) {
            const newShortcut = parts.join('+');
            setConfig({ ...config, shortcut: newShortcut });
            setIsRecordingShortcut(false);
            // Update the global shortcut via IPC
            window.ipcRenderer.invoke('shortcut:update', newShortcut);
        }
    };

    const refreshSkills = () => {
        window.ipcRenderer.invoke('skills:list').then(list => setSkills(list as SkillInfo[]));
    };

    const handleSave = async () => {
        await window.ipcRenderer.invoke('config:set-all', config);
        setSaved(true);
        setTimeout(() => {
            setSaved(false);
            onClose();
        }, 800);
    };

    const deleteSkill = async (filename: string) => {
        if (confirm(`确定要删除技能 "${filename}" 吗？`)) {
            await window.ipcRenderer.invoke('skills:delete', filename);
            refreshSkills();
        }
    };

    const addFolder = async () => {
        const result = await window.ipcRenderer.invoke('dialog:select-folder') as string | null;
        if (result && !config.authorizedFolders.includes(result)) {
            setConfig({ ...config, authorizedFolders: [...config.authorizedFolders, result] });
        }
    };

    const removeFolder = (folder: string) => {
        setConfig({ ...config, authorizedFolders: config.authorizedFolders.filter(f => f !== folder) });
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white/95 backdrop-blur-md rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-stone-200/60">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-stone-200/60 shrink-0">
                    <h2 className="text-lg font-semibold text-stone-800 tracking-tight">设置</h2>
                    <div className="flex items-center gap-2">
                        {activeTab === 'folders' || activeTab === 'advanced' ? (
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saved}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${saved
                                    ? 'bg-emerald-100 text-emerald-600'
                                    : 'bg-gradient-to-r from-[#E85D3E] to-[#d14a2e] text-white hover:from-[#d14a2e] hover:to-[#b53d26] shadow-sm'
                                    } focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D3E]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
                            >
                                {saved ? <Check size={14} /> : null}
                                {saved ? '已保存' : '保存'}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="关闭设置"
                            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D3E]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-stone-200/60 overflow-x-auto shrink-0" role="tablist" aria-label="设置选项卡">
                    {[
                        { id: 'api' as const, label: '通用', icon: <Settings size={14} /> },
                        { id: 'folders' as const, label: '权限', icon: <FolderOpen size={14} /> },
                        { id: 'mcp' as const, label: 'MCP', icon: <Server size={14} /> },
                        { id: 'skills' as const, label: 'Skills', icon: <Zap size={14} /> },
                        { id: 'schedule' as const, label: '定时任务', icon: <Clock size={14} /> },
                        { id: 'advanced' as const, label: '高级', icon: <Settings size={14} /> },
                        { id: 'about' as const, label: '关于', icon: <Settings size={14} /> },
                    ].map(tab => (
                        <button
                            type="button"
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            role="tab"
                            id={`settings-tab-${tab.id}`}
                            aria-selected={activeTab === tab.id}
                            aria-controls={`settings-panel-${tab.id}`}
                            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                ? 'text-[#E85D3E] border-b-2 border-[#E85D3E] bg-orange-50/50'
                                : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50/80'
                                } focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D3E]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
                        >
                            {/*tab.icon*/}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-0 overflow-y-auto flex-1 bg-stone-50/50 custom-scrollbar">
                    <div className="p-6">
                        {activeTab === 'api' && (
                            <div
                                role="tabpanel"
                                id="settings-panel-api"
                                aria-labelledby="settings-tab-api"
                            >
                                <ModelSettings />
                            </div>
                        )}

                        {activeTab === 'folders' && (
                            <div
                                role="tabpanel"
                                id="settings-panel-folders"
                                aria-labelledby="settings-tab-folders"
                                className="space-y-5"
                            >
                                <div className="bg-blue-50 text-blue-700 rounded-lg p-3 text-xs">
                                    出于安全考虑，AI 只能访问以下授权的文件夹及其子文件夹。
                                </div>

                                {config.authorizedFolders.length === 0 ? (
                                    <div className="text-center py-8 text-stone-400 border-2 border-dashed border-stone-200 rounded-xl">
                                        <p className="text-sm">暂无授权文件夹</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {config.authorizedFolders.map((folder, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-lg group"
                                            >
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <FolderOpen size={16} className="text-stone-400 shrink-0" />
                                                    <span className="text-sm font-mono text-stone-600 truncate">
                                                        {folder}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFolder(folder)}
                                                    aria-label={`移除文件夹 ${folder}`}
                                                    className="p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={addFolder}
                                    className="w-full py-2.5 border border-dashed border-stone-300 text-stone-500 hover:text-orange-600 hover:border-orange-500 hover:bg-orange-50 rounded-xl transition-all flex items-center justify-center gap-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                >
                                    <Plus size={16} />
                                    添加文件夹
                                </button>
                            </div>
                        )}

                        {activeTab === 'mcp' && (
                            <div role="tabpanel" id="settings-panel-mcp" aria-labelledby="settings-tab-mcp" className="h-full">
                                <MCPSettings />
                            </div>
                        )}

                        {activeTab === 'skills' && (
                            <div role="tabpanel" id="settings-panel-skills" aria-labelledby="settings-tab-skills" className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-stone-500">自定义 AI 技能</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingSkill(null);
                                            setShowSkillEditor(true);
                                        }}
                                        className="flex items-center gap-1 text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                    >
                                        <Plus size={12} />
                                        新建技能
                                    </button>
                                </div>

                                {skills.length === 0 ? (
                                    <div className="text-center py-8 text-stone-400 border-2 border-dashed border-stone-200 rounded-xl">
                                        <p className="text-sm">暂无技能</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-2">
                                        {skills.map((skill) => (
                                            <div
                                                key={skill.id}
                                                className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-lg hover:border-orange-200 transition-colors group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${skill.isBuiltin ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600'}`}>
                                                        <Zap size={16} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-medium text-stone-700">{skill.name}</p>
                                                            {skill.isBuiltin && (
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded-full font-medium">内置</span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-stone-400 font-mono truncate max-w-xs">{skill.path}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingSkill(skill.id);
                                                            setViewingSkill(skill.isBuiltin); // Set view-only if built-in
                                                            setShowSkillEditor(true);
                                                        }}
                                                        aria-label={skill.isBuiltin ? `查看技能 ${skill.name}` : `编辑技能 ${skill.name}`}
                                                        className="p-1.5 text-stone-400 hover:text-blue-500 hover:bg-blue-50 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                                        title={skill.isBuiltin ? "查看" : "编辑"}
                                                    >
                                                        {skill.isBuiltin ? <Eye size={14} /> : <Edit2 size={14} />}
                                                    </button>
                                                    {!skill.isBuiltin && (
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteSkill(skill.id)}
                                                            aria-label={`删除技能 ${skill.name}`}
                                                            className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                                            title="删除"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'schedule' && (
                            <div
                                role="tabpanel"
                                id="settings-panel-schedule"
                                aria-labelledby="settings-tab-schedule"
                                className="h-full"
                            >
                                <ScheduleView />
                            </div>
                        )}

                        {activeTab === 'advanced' && (
                            <div
                                role="tabpanel"
                                id="settings-panel-advanced"
                                aria-labelledby="settings-tab-advanced"
                                className="space-y-5"
                            >
                                <div className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-lg">
                                    <div>
                                        <p className="text-sm font-medium text-stone-700">网络访问</p>
                                        <p className="text-xs text-stone-400">允许 AI 访问互联网（影响 MCP、浏览器及网络工具）</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setConfig({ ...config, networkAccess: !config.networkAccess })}
                                        role="switch"
                                        aria-checked={config.networkAccess}
                                        aria-label="网络访问"
                                        className={`w-10 h-6 rounded-full transition-colors ${config.networkAccess ? 'bg-orange-500' : 'bg-stone-200'} focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${config.networkAccess ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-lg">
                                    <div>
                                        <p className="text-sm font-medium text-stone-700">浏览器操作</p>
                                        <p className="text-xs text-stone-400">允许 AI 操作浏览器（需先安装 agent-browser）</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setConfig({ ...config, browserAccess: !config.browserAccess })}
                                        role="switch"
                                        aria-checked={config.browserAccess}
                                        aria-label="浏览器操作"
                                        className={`w-10 h-6 rounded-full transition-colors ${config.browserAccess ? 'bg-orange-500' : 'bg-stone-200'} focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${config.browserAccess ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-lg">
                                    <div>
                                        <p className="text-sm font-medium text-stone-700">快捷键</p>
                                        <p className="text-xs text-stone-400">{config.shortcut} 呼出悬浮球</p>
                                    </div>
                                    {isRecordingShortcut ? (
                                        <input
                                            type="text"
                                            autoFocus
                                            aria-label="录制快捷键"
                                            className="px-3 py-1.5 text-sm border border-orange-400 rounded-lg bg-orange-50 text-orange-600 font-medium outline-none animate-pulse"
                                            placeholder="按下快捷键..."
                                            onKeyDown={handleShortcutKeyDown}
                                            onBlur={() => setIsRecordingShortcut(false)}
                                            readOnly
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setIsRecordingShortcut(true)}
                                            aria-label="修改快捷键"
                                            className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg hover:bg-stone-50 text-stone-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                        >
                                            {config.shortcut}
                                        </button>
                                    )}
                                </div>

                                {/* Permissions Management */}
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-stone-700">已授权的权限</p>
                                    {permissions.length === 0 ? (
                                        <p className="text-xs text-stone-400 p-3 bg-stone-50 rounded-lg">暂无已保存的权限</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {permissions.map((p, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-white border border-stone-200 rounded-lg">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-mono text-stone-700">{p.tool}</p>
                                                        <p className="text-xs text-stone-400">{p.pathPattern === '*' ? '所有路径' : p.pathPattern}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => revokePermission(p.tool, p.pathPattern)}
                                                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                                    >
                                                        撤销
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={clearAllPermissions}
                                                className="w-full px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                            >
                                                清除所有权限
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'about' && (
                            <div
                                role="tabpanel"
                                id="settings-panel-about"
                                aria-labelledby="settings-tab-about"
                                className="space-y-5"
                            >
                                <div className="text-center py-8">
                                    <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#E85D3E] to-[#d14a2e] flex items-center justify-center mb-4">
                                        <Zap className="text-white" size={40} />
                                    </div>
                                    <h3 className="text-2xl font-bold text-stone-800">Bingowork</h3>
                                    <p className="text-sm text-stone-500 mt-1">你的数字同事</p>
                                    <p className="text-xs text-stone-400 mt-2">版本 1.0.8</p>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowUpdateDialog(true)}
                                        className="w-full py-3 bg-gradient-to-r from-[#E85D3E] to-[#d14a2e] text-white rounded-xl font-medium hover:from-[#d14a2e] hover:to-[#b53d26] transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D3E]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white flex items-center justify-center gap-2"
                                    >
                                        <Download size={18} />
                                        检查更新
                                    </button>

                                    <a
                                        href="https://github.com/xwang152-jack/bingowork"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block w-full py-3 border border-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition-all text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                    >
                                        GitHub 仓库
                                    </a>

                                    <a
                                        href="https://github.com/xwang152-jack/bingowork/issues"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block w-full py-3 border border-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition-all text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                    >
                                        反馈问题
                                    </a>
                                </div>

                                <div className="text-center pt-4 border-t border-stone-200">
                                    <p className="text-xs text-stone-400">
                                        © 2024 Bingowork. 基于 Apache 2.0 许可开源
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Skill Editor Modal */}
            {showSkillEditor && (
                <SkillEditor
                    filename={editingSkill}
                    readOnly={viewingSkill}
                    onClose={() => {
                        setShowSkillEditor(false);
                        setViewingSkill(false);
                    }}
                    onSave={refreshSkills}
                />
            )}

            {/* Update Dialog */}
            {showUpdateDialog && (
                <UpdateDialog onClose={() => setShowUpdateDialog(false)} />
            )}
        </div>
    );
}

export default SettingsView;
