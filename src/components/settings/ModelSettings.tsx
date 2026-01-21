import { useState, useEffect, useMemo } from 'react';
import { Check, ChevronDown, ChevronRight, Globe, Key, Plus, RefreshCw, Server, Trash2, Zap } from 'lucide-react';
import { useModelRegistry, ProviderConfigDTO, ModelConfigDTO } from '../../hooks/useModelRegistry';

// Define available templates for "Add Provider"
const PROVIDER_TEMPLATES = [
    { id: 'openai', name: 'OpenAI', protocol: 'openai', baseUrl: 'https://api.openai.com/v1' },
    { id: 'anthropic', name: 'Anthropic', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
    { id: 'deepseek', name: 'DeepSeek', protocol: 'openai', baseUrl: 'https://api.deepseek.com/v1' },
    { id: 'moonshot-kimi', name: 'Moonshot (Kimi)', protocol: 'openai', baseUrl: 'https://api.moonshot.cn/v1' },
    { id: 'alibaba-qwen', name: 'Alibaba (Qwen)', protocol: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    { id: 'custom', name: 'Custom (OpenAI Compatible)', protocol: 'openai', baseUrl: '' },
];

export function ModelSettings() {
    const { state, loading, error, setActiveModel, updateProvider, addCustomModel, deleteCustomModel } = useModelRegistry();
    const [showAddProvider, setShowAddProvider] = useState(false);

    // Group models by provider for the selector
    const modelsByProvider = useMemo(() => {
        if (!state) return {};
        const groups: Record<string, ModelConfigDTO[]> = {};
        state.models.forEach(m => {
            const key = m.providerName || m.providerId;
            if (!groups[key]) groups[key] = [];
            groups[key].push(m);
        });
        return groups;
    }, [state?.models]);

    if (loading && !state) {
        return <div className="p-8 text-center text-stone-400">Loading model configuration...</div>;
    }

    if (error) {
        return <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>;
    }

    if (!state) return null;

    const activeModel = state.models.find(m => m.id === state.activeModelId);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* 1. Global Model Selector */}
            <section className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
                <label className="block text-sm font-semibold text-stone-800 mb-2">当前使用的模型</label>
                <div className="relative">
                    <select
                        value={state.activeModelId}
                        onChange={(e) => setActiveModel(e.target.value)}
                        className="w-full appearance-none bg-stone-50 border border-stone-200 text-stone-700 py-3 px-4 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
                    >
                        {Object.entries(modelsByProvider).map(([providerName, models]) => (
                            <optgroup key={providerName} label={providerName}>
                                {models.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.displayName} ({m.modelId})
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={16} />
                </div>
                {activeModel && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-stone-400">
                        <span className={`w-2 h-2 rounded-full ${activeModel.isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {activeModel.isConfigured ? '已配置就绪' : '未配置 API Key 或 Base URL'}
                        <span className="mx-1">•</span>
                        <span className="font-mono">{activeModel.providerName}</span>
                    </div>
                )}
            </section>

            {/* 2. Provider List */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-stone-700">供应商配置</h3>
                    <button
                        onClick={() => setShowAddProvider(true)}
                        className="text-xs flex items-center gap-1 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg transition-colors font-medium"
                    >
                        <Plus size={14} />
                        添加供应商
                    </button>
                </div>

                <div className="space-y-3">
                    {state.providers.map(provider => (
                        <ProviderCard
                            key={provider.providerId}
                            provider={provider}
                            models={state.models.filter(m => m.providerId === provider.providerId)}
                            onUpdate={updateProvider}
                            onAddCustomModel={addCustomModel}
                            onDeleteCustomModel={deleteCustomModel}
                        />
                    ))}
                </div>
            </section>

            {/* Add Provider Modal */}
            {showAddProvider && (
                <AddProviderModal
                    existingProviders={state.providers}
                    onClose={() => setShowAddProvider(false)}
                    onAdd={async (template, name) => {
                        // For simplicity, we just add a custom model which implicitly creates/activates the provider config
                        // But wait, the backend creates provider config on demand when we set config.
                        // We can just add a dummy custom model or just set the provider config.
                        // The current backend doesn't have "create provider" explicit API, it's driven by `setProviderConfig` or `addCustomModel`.
                        // To show it in the list, we might need to add a model or just set the config.
                        // Let's use `addCustomModel` to bootstrap it if it's a new custom one,
                        // or just `updateProvider` if we want to enable a preset.
                        
                        // Actually, to make it appear in the list, we need it to be in `state.providers`.
                        // `state.providers` comes from `providerIds` which are gathered from presets + custom models.
                        // So if we pick a preset (like DeepSeek) that isn't shown yet (maybe logic hides unused presets? No, logic shows all presets).
                        // Wait, `ModelRegistryService.ts` lines 125-130 loads all PRESET_MODELS.
                        // So all presets should already be in the list?
                        // Let's check `ModelRegistryService.ts` again.
                        // It loads presets into `presetProviderMap`.
                        // Then `providerIds` = union of preset keys + custom model providerIds.
                        // So yes, all presets should be visible.
                        
                        // If the user wants to add a "Custom" provider, they need to give it a unique name.
                        // Then we call `addCustomModel` with that provider name.
                        
                        if (template.id === 'custom') {
                            // Add a placeholder model to establish the provider
                            await addCustomModel({
                                providerName: name,
                                modelId: 'gpt-3.5-turbo', // Default placeholder
                                displayName: 'Custom Model',
                                baseUrl: template.baseUrl,
                                protocol: 'openai'
                            });
                        } else {
                            // It's a preset. It should already be there.
                            // If it's not (maybe we want to support multiple instances of same provider?), that's complex.
                            // Assuming we just want to jump to it or ensure it's configured.
                            // For now, let's assume "Add Provider" is mostly for Custom providers 
                            // OR for presets that might not be in the default list (if we hide them).
                            // But currently we show all. 
                            
                            // If we want to support "Add Custom Provider", we just need the name.
                            await addCustomModel({
                                providerName: name,
                                modelId: 'my-model',
                                displayName: 'My Model',
                                baseUrl: template.baseUrl,
                                protocol: template.protocol as any
                            });
                        }
                        setShowAddProvider(false);
                    }}
                />
            )}
        </div>
    );
}

function ProviderCard({
    provider,
    models,
    onUpdate,
    onAddCustomModel,
    onDeleteCustomModel
}: {
    provider: ProviderConfigDTO;
    models: ModelConfigDTO[];
    onUpdate: (payload: { providerId: string; baseUrl?: string; apiKey?: string }) => Promise<void>;
    onAddCustomModel: (payload: any) => Promise<void>;
    onDeleteCustomModel: (id: string) => Promise<void>;
}) {
    const [expanded, setExpanded] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState(provider.baseUrl || provider.defaultBaseUrl);
    const [checking, setChecking] = useState(false);
    const [checkResult, setCheckResult] = useState<'success' | 'error' | null>(null);
    const [isDirty, setIsDirty] = useState(false);

    // Sync state when provider updates
    useEffect(() => {
        setBaseUrl(provider.baseUrl || provider.defaultBaseUrl);
        // We don't sync apiKey back because it's write-only usually, or we don't get the actual key back.
        // `provider.hasApiKey` tells us if it's set.
    }, [provider]);

    const handleSave = async () => {
        await onUpdate({
            providerId: provider.providerId,
            baseUrl,
            apiKey: apiKey || undefined // Only send if user typed something
        });
        setIsDirty(false);
        setApiKey(''); // Clear input after save
    };

    const handleCheck = async () => {
        setChecking(true);
        setCheckResult(null);
        try {
            // We need to save first if dirty, or pass current values to check
            const res = await window.ipcRenderer.invoke('models:check-connection', {
                providerId: provider.providerId,
                baseUrl,
                apiKey: apiKey || undefined, // If empty, backend might use stored key?
                protocol: provider.protocol
            }) as { success: boolean; error?: string };

            if (res.success) {
                setCheckResult('success');
            } else {
                setCheckResult('error');
                console.error(res.error);
            }
        } catch (e) {
            setCheckResult('error');
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className={`bg-white border transition-all duration-200 rounded-xl overflow-hidden ${expanded ? 'border-orange-200 shadow-md' : 'border-stone-200 hover:border-orange-200/50'}`}>
            <div
                className="flex items-center justify-between p-4 cursor-pointer select-none"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${provider.hasApiKey ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
                        <Server size={18} />
                    </div>
                    <div>
                        <div className="font-medium text-stone-700 flex items-center gap-2">
                            {provider.providerName}
                            {provider.hasApiKey && <Check size={14} className="text-emerald-500" />}
                        </div>
                        <div className="text-xs text-stone-400 font-mono mt-0.5">
                            {models.length} models • {provider.protocol}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                     {/* Status Badge */}
                     {!provider.hasApiKey && !expanded && (
                        <span className="text-xs text-amber-500 bg-amber-50 px-2 py-1 rounded-full">需配置</span>
                     )}
                    <ChevronRight size={18} className={`text-stone-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </div>
            </div>

            {expanded && (
                <div className="px-4 pb-4 pt-0 space-y-4 animate-fade-in">
                    <div className="h-px bg-stone-100 mb-4" />
                    
                    {/* Config Form */}
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-stone-500 flex items-center gap-1">
                                <Globe size={12} />
                                Base URL
                            </label>
                            <input
                                type="text"
                                value={baseUrl}
                                onChange={(e) => { setBaseUrl(e.target.value); setIsDirty(true); }}
                                placeholder={provider.defaultBaseUrl}
                                className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-stone-500 flex items-center gap-1">
                                <Key size={12} />
                                API Key
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => { setApiKey(e.target.value); setIsDirty(true); }}
                                    placeholder={provider.hasApiKey ? "已配置 (留空保持不变)" : "请输入 API Key"}
                                    className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                />
                                <button
                                    onClick={handleSave}
                                    disabled={!isDirty}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDirty 
                                        ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm' 
                                        : 'bg-stone-100 text-stone-400 cursor-not-allowed'}`}
                                >
                                    保存
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                             <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCheck}
                                    disabled={checking}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs rounded-lg transition-colors"
                                >
                                    {checking ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                                    测试连接
                                </button>
                                {checkResult === 'success' && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check size={12}/> 连接成功</span>}
                                {checkResult === 'error' && <span className="text-xs text-red-500">连接失败，请检查配置</span>}
                             </div>
                        </div>
                    </div>

                    {/* Model List */}
                    <div className="bg-stone-50/50 rounded-xl border border-stone-200/60 p-3 space-y-3">
                        <div className="text-xs font-medium text-stone-500">模型列表</div>
                        <div className="space-y-2">
                            {models.map(model => (
                                <div key={model.id} className="flex items-center justify-between bg-white p-2 rounded border border-stone-100">
                                    <div className="text-sm text-stone-700 font-mono">{model.modelId}</div>
                                    {model.isCustom && (
                                        <button 
                                            onClick={() => onDeleteCustomModel(model.id)}
                                            className="text-stone-300 hover:text-red-500 p-1"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            
                            {/* Add Model Inline */}
                            <AddModelInline provider={provider} onAdd={onAddCustomModel} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function AddModelInline({ provider, onAdd }: { provider: ProviderConfigDTO, onAdd: (p: any) => Promise<void> }) {
    const [isAdding, setIsAdding] = useState(false);
    const [modelId, setModelId] = useState('');
    
    if (!isAdding) {
        return (
            <button 
                onClick={() => setIsAdding(true)}
                className="w-full py-1.5 border border-dashed border-stone-300 rounded text-xs text-stone-400 hover:text-orange-500 hover:border-orange-300 hover:bg-orange-50 transition-colors flex items-center justify-center gap-1"
            >
                <Plus size={12} /> 添加模型 ID
            </button>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <input 
                autoFocus
                type="text" 
                value={modelId}
                onChange={e => setModelId(e.target.value)}
                placeholder="输入 Model ID (如 gpt-4)"
                className="flex-1 bg-white border border-orange-300 rounded px-2 py-1 text-sm font-mono focus:outline-none"
                onKeyDown={async (e) => {
                    if (e.key === 'Enter' && modelId.trim()) {
                        await onAdd({
                            providerName: provider.providerName,
                            modelId: modelId.trim(),
                            displayName: modelId.trim(), // Use ID as display name by default
                            protocol: provider.protocol
                        });
                        setIsAdding(false);
                        setModelId('');
                    } else if (e.key === 'Escape') {
                        setIsAdding(false);
                    }
                }}
            />
            <button 
                onClick={() => setIsAdding(false)}
                className="text-xs text-stone-400 hover:text-stone-600 px-2"
            >
                取消
            </button>
        </div>
    );
}

function AddProviderModal({ onClose, onAdd, existingProviders }: { onClose: () => void, onAdd: (t: typeof PROVIDER_TEMPLATES[0], name: string) => void, existingProviders: ProviderConfigDTO[] }) {
    const [selectedTemplate, setSelectedTemplate] = useState(PROVIDER_TEMPLATES[0]);
    const [customName, setCustomName] = useState('');

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-stone-100 flex justify-between items-center">
                    <h3 className="font-semibold text-stone-800">添加供应商</h3>
                    <button onClick={onClose}><div className="i-lucide-x text-stone-400" /></button>
                </div>
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        {PROVIDER_TEMPLATES.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedTemplate(t)}
                                className={`p-3 rounded-xl border text-left transition-all ${selectedTemplate.id === t.id 
                                    ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' 
                                    : 'border-stone-200 hover:border-orange-200 hover:bg-stone-50'}`}
                            >
                                <div className="font-medium text-sm text-stone-700">{t.name}</div>
                                <div className="text-[10px] text-stone-400 font-mono mt-1">{t.baseUrl ? 'Preset URL' : 'Custom URL'}</div>
                            </button>
                        ))}
                    </div>

                    {selectedTemplate.id === 'custom' && (
                        <div>
                            <label className="block text-xs font-medium text-stone-500 mb-1">供应商名称</label>
                            <input 
                                type="text" 
                                value={customName}
                                onChange={e => setCustomName(e.target.value)}
                                placeholder="My Custom Provider"
                                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                            />
                        </div>
                    )}

                    <button
                        onClick={() => onAdd(selectedTemplate, selectedTemplate.id === 'custom' ? customName : selectedTemplate.name)}
                        disabled={selectedTemplate.id === 'custom' && !customName.trim()}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        添加
                    </button>
                </div>
            </div>
        </div>
    );
}
