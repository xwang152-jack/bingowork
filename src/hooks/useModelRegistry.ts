import { useCallback, useEffect, useState } from 'react';

export type ProviderConfigDTO = {
    providerId: string;
    providerName: string;
    defaultBaseUrl: string;
    baseUrl: string;
    hasApiKey: boolean;
    protocol: 'openai' | 'anthropic' | 'custom';
};

export type ModelConfigDTO = {
    id: string;
    displayName: string;
    providerId: string;
    providerName: string;
    modelId: string;
    protocol: 'openai' | 'anthropic' | 'custom';
    isCustom: boolean;
    isConfigured: boolean;
    effectiveBaseUrl: string;
    updatedAt: number;
};

export type ModelRegistryStateDTO = {
    activeModelId: string;
    providers: ProviderConfigDTO[];
    models: ModelConfigDTO[];
    version: number;
};

export function useModelRegistry() {
    const [state, setState] = useState<ModelRegistryStateDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const next = await window.ipcRenderer.invoke('models:get-state') as ModelRegistryStateDTO;
            setState(next);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    const setActiveModel = useCallback(async (modelId: string) => {
        setError(null);
        try {
            await window.ipcRenderer.invoke('models:set-active', modelId);
            await refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, [refresh]);

    const updateProvider = useCallback(async (payload: { providerId: string; baseUrl?: string; apiKey?: string }) => {
        setError(null);
        try {
            await window.ipcRenderer.invoke('models:update-provider', payload);
            await refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, [refresh]);

    const addCustomModel = useCallback(async (payload: { providerName: string; modelId: string; displayName?: string; baseUrl?: string; apiKey?: string; protocol?: 'openai' | 'anthropic' }) => {
        setError(null);
        try {
            await window.ipcRenderer.invoke('models:add-custom-model', payload);
            await refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, [refresh]);

    const deleteCustomModel = useCallback(async (modelId: string) => {
        setError(null);
        try {
            await window.ipcRenderer.invoke('models:delete-custom-model', modelId);
            await refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, [refresh]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        const remove = window.ipcRenderer.on('models:updated', () => {
            refresh();
        });
        return () => remove();
    }, [refresh]);

    return {
        state,
        loading,
        error,
        refresh,
        setActiveModel,
        updateProvider,
        addCustomModel,
        deleteCustomModel,
    };
}

