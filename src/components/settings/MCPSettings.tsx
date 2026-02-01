import { useState, useEffect } from 'react';
import { Server, Plus, Trash2, Edit2, Check, X, Terminal, Globe } from 'lucide-react';

/**
 * MCP Server Configuration Types
 */
interface MCPServerConfig {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    transportType: 'stdio' | 'http';
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
    createdAt?: number;
    updatedAt?: number;
}

interface EditingServer {
    server: MCPServerConfig;
    isNew: boolean;
}

/**
 * MCP Settings Component
 * Provides UI for managing MCP server configurations
 */
export function MCPSettings() {
    const [servers, setServers] = useState<MCPServerConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingServer, setEditingServer] = useState<EditingServer | null>(null);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load servers on mount
    useEffect(() => {
        loadServers();
    }, []);

    const loadServers = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await window.ipcRenderer.invoke('mcp:list-servers') as {
                success: boolean;
                data?: MCPServerConfig[];
                error?: string;
            };

            if (result.success && result.data) {
                setServers(result.data);
            } else {
                setError(result.error || '加载失败');
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddServer = () => {
        setEditingServer({
            server: {
                id: '',
                name: '',
                description: '',
                enabled: true,
                transportType: 'stdio',
                command: '',
                args: [],
                env: {}
            },
            isNew: true
        });
    };

    const handleEditServer = (server: MCPServerConfig) => {
        setEditingServer({
            server: { ...server },
            isNew: false
        });
    };

    const handleDeleteServer = async (id: string, name: string) => {
        if (!confirm(`确定要删除 MCP 服务器 "${name}" 吗？`)) {
            return;
        }

        try {
            const result = await window.ipcRenderer.invoke('mcp:delete-server', id) as {
                success: boolean;
                error?: string;
            };

            if (result.success) {
                await loadServers();
                showSaved();
            } else {
                alert('删除失败: ' + (result.error || '未知错误'));
            }
        } catch (e) {
            alert('删除失败: ' + (e as Error).message);
        }
    };

    const handleToggleServer = async (id: string, enabled: boolean) => {
        try {
            const result = await window.ipcRenderer.invoke('mcp:toggle-server', id, enabled) as {
                success: boolean;
                error?: string;
            };

            if (result.success) {
                await loadServers();
            } else {
                alert('切换失败: ' + (result.error || '未知错误'));
            }
        } catch (e) {
            alert('切换失败: ' + (e as Error).message);
        }
    };

    const handleSaveServer = async (server: MCPServerConfig) => {
        setError(null);

        const result = editingServer?.isNew
            ? await window.ipcRenderer.invoke('mcp:add-server', server) as { success: boolean; error?: string }
            : await window.ipcRenderer.invoke('mcp:update-server', server.id, server) as { success: boolean; error?: string };

        if (result.success) {
            setEditingServer(null);
            await loadServers();
            showSaved();
        } else {
            setError(result.error || '保存失败');
        }
    };

    const showSaved = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-stone-400 text-sm">加载中...</div>
            </div>
        );
    }

    if (editingServer) {
        return (
            <ServerEditor
                server={editingServer.server}
                isNew={editingServer.isNew}
                onSave={handleSaveServer}
                onCancel={() => setEditingServer(null)}
                error={error}
                existingIds={servers.map(s => s.id)}
            />
        );
    }

    return (
        <div className="space-y-4">
            {saved && (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg text-sm">
                    <Check size={16} />
                    已保存
                </div>
            )}

            {error && (
                <div className="text-red-600 bg-red-50 px-3 py-2 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-stone-700">MCP 服务器</p>
                    <p className="text-xs text-stone-400">管理 Model Context Protocol 服务器</p>
                </div>
                <button
                    type="button"
                    onClick={handleAddServer}
                    className="flex items-center gap-1.5 text-sm px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30"
                >
                    <Plus size={16} />
                    添加服务器
                </button>
            </div>

            {servers.length === 0 ? (
                <div className="text-center py-12 text-stone-400 border-2 border-dashed border-stone-200 rounded-xl">
                    <Server size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无 MCP 服务器</p>
                    <p className="text-xs mt-1">点击"添加服务器"开始配置</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {servers.map((server) => (
                        <ServerCard
                            key={server.id}
                            server={server}
                            onEdit={handleEditServer}
                            onDelete={handleDeleteServer}
                            onToggle={handleToggleServer}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

interface ServerCardProps {
    server: MCPServerConfig;
    onEdit: (server: MCPServerConfig) => void;
    onDelete: (id: string, name: string) => void;
    onToggle: (id: string, enabled: boolean) => void;
}

function ServerCard({ server, onEdit, onDelete, onToggle }: ServerCardProps) {
    return (
        <div className={`p-4 bg-white border rounded-xl transition-all ${server.enabled ? 'border-stone-200' : 'border-stone-200 opacity-60'}`}>
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${server.transportType === 'stdio' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                        {server.transportType === 'stdio' ? <Terminal size={18} /> : <Globe size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-stone-800">{server.name}</h3>
                            {!server.enabled && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded-full font-medium">
                                    已禁用
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-stone-400 font-mono mt-0.5">{server.id}</p>
                        {server.description && (
                            <p className="text-xs text-stone-500 mt-1 line-clamp-1">{server.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                            {server.transportType === 'stdio' ? (
                                <code className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">
                                    {server.command} {server.args?.join(' ')}
                                </code>
                            ) : (
                                <code className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">
                                    {server.url}
                                </code>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                        type="button"
                        onClick={() => onToggle(server.id, !server.enabled)}
                        className={`p-2 rounded-lg transition-colors ${server.enabled ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}
                        title={server.enabled ? '禁用' : '启用'}
                    >
                        {server.enabled ? <Check size={16} /> : <X size={16} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => onEdit(server)}
                        className="p-2 text-stone-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="编辑"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(server.id, server.name)}
                        className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}

interface ServerEditorProps {
    server: MCPServerConfig;
    isNew: boolean;
    onSave: (server: MCPServerConfig) => void;
    onCancel: () => void;
    error: string | null;
    existingIds: string[];
}

function ServerEditor({ server, isNew, onSave, onCancel, error, existingIds }: ServerEditorProps) {
    const [formData, setFormData] = useState<MCPServerConfig>({ ...server });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.id?.trim()) {
            newErrors.id = '服务器 ID 不能为空';
        } else if (!/^[a-z0-9-]+$/.test(formData.id)) {
            newErrors.id = '只能包含小写字母、数字和连字符';
        } else if (isNew && existingIds.includes(formData.id)) {
            newErrors.id = '该 ID 已存在';
        }

        if (!formData.name?.trim()) {
            newErrors.name = '服务器名称不能为空';
        }

        if (formData.transportType === 'stdio' && !formData.command?.trim()) {
            newErrors.command = '命令不能为空';
        }

        if (formData.transportType === 'http') {
            if (!formData.url?.trim()) {
                newErrors.url = 'URL 不能为空';
            } else {
                try {
                    new URL(formData.url);
                } catch {
                    newErrors.url = 'URL 格式无效';
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            onSave(formData);
        }
    };

    const updateField = <K extends keyof MCPServerConfig>(field: K, value: MCPServerConfig[K]) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error for this field
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-stone-800">
                    {isNew ? '添加 MCP 服务器' : '编辑 MCP 服务器'}
                </h3>
                <button
                    type="button"
                    onClick={onCancel}
                    className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            {error && (
                <div className="text-red-600 bg-red-50 px-3 py-2 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                        服务器 ID <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.id}
                        onChange={(e) => updateField('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        disabled={!isNew}
                        className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${!isNew ? 'bg-stone-50 text-stone-500' : ''} ${errors.id ? 'border-red-300' : 'border-stone-200'}`}
                        placeholder="my-server"
                    />
                    {errors.id && <p className="text-xs text-red-500 mt-1">{errors.id}</p>}
                </div>

                <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                        服务器名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => updateField('name', e.target.value)}
                        className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${errors.name ? 'border-red-300' : 'border-stone-200'}`}
                        placeholder="My Server"
                    />
                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                    描述
                </label>
                <input
                    type="text"
                    value={formData.description || ''}
                    onChange={(e) => updateField('description', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    placeholder="可选的服务器描述"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-stone-600 mb-2">
                    传输类型
                </label>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => updateField('transportType', 'stdio')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all ${formData.transportType === 'stdio'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                            }`}
                    >
                        <Terminal size={16} />
                        Stdio (本地进程)
                    </button>
                    <button
                        type="button"
                        onClick={() => updateField('transportType', 'http')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all ${formData.transportType === 'http'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                            }`}
                    >
                        <Globe size={16} />
                        HTTP (远程服务器)
                    </button>
                </div>
            </div>

            {formData.transportType === 'stdio' ? (
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">
                            命令 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.command || ''}
                            onChange={(e) => updateField('command', e.target.value)}
                            className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono ${errors.command ? 'border-red-300' : 'border-stone-200'}`}
                            placeholder="npx"
                        />
                        {errors.command && <p className="text-xs text-red-500 mt-1">{errors.command}</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">
                            参数 (每行一个)
                        </label>
                        <textarea
                            value={(formData.args || []).join('\n')}
                            onChange={(e) => updateField('args', e.target.value.split('\n').filter(a => a.trim()))}
                            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono h-24 resize-none"
                            placeholder="-y&#10;@modelcontextprotocol/server-filesystem"
                        />
                    </div>
                </div>
            ) : (
                <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                        服务器 URL <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.url || ''}
                        onChange={(e) => updateField('url', e.target.value)}
                        className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono ${errors.url ? 'border-red-300' : 'border-stone-200'}`}
                        placeholder="https://example.com/mcp"
                    />
                    {errors.url && <p className="text-xs text-red-500 mt-1">{errors.url}</p>}
                </div>
            )}

            <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                <div>
                    <p className="text-sm font-medium text-stone-700">启用服务器</p>
                    <p className="text-xs text-stone-400">禁用后不会连接到此服务器</p>
                </div>
                <button
                    type="button"
                    onClick={() => updateField('enabled', !formData.enabled)}
                    className={`w-10 h-6 rounded-full transition-colors ${formData.enabled ? 'bg-orange-500' : 'bg-stone-200'}`}
                >
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${formData.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                    取消
                </button>
                <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                    {isNew ? '添加' : '保存'}
                </button>
            </div>
        </form>
    );
}

export default MCPSettings;
