import { BrowserWindow, ipcMain } from 'electron';
import { MODEL_CHANNELS } from '../../constants/IpcChannels';
import { configStore } from '../../config/ConfigStore';
import { SecureCredentials } from '../../config/SecureCredentials';
import { ModelRegistryService } from '../../models/ModelRegistryService';
import { getAgentInstance } from './agentHandlers';
import { TaskDatabase } from '../../config/TaskDatabase';
import { OpenAIProvider } from '../../agent/providers/OpenAIProvider';
import { AnthropicProvider } from '../../agent/providers/AnthropicProvider';

function broadcast(channel: string, data?: unknown) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
        if (!win.isDestroyed()) {
            win.webContents.send(channel, data);
        }
    });
}

export function registerModelHandlers(taskDb: TaskDatabase | null): void {
    function getService(): ModelRegistryService {
        if (!taskDb) {
            throw new Error('Task database not initialized');
        }
        return new ModelRegistryService(taskDb);
    }

    ipcMain.handle(MODEL_CHANNELS.GET_STATE, async () => {
        return await getService().getState();
    });

    ipcMain.handle(MODEL_CHANNELS.UPDATE_PROVIDER, async (_event, payload: { providerId: string; baseUrl?: string; apiKey?: string; providerName?: string }) => {
        await getService().setProviderConfig(payload);

        const state = await getService().getState();
        const active = state.models.find(m => m.id === state.activeModelId);
        if (active && active.providerId === String(payload.providerId || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) {
            const providerId = active.providerId;
            const apiKey = (await SecureCredentials.getApiKey(providerId)) || '';
            const transportProvider = active.protocol === 'anthropic' ? 'anthropic' : 'openai';
            const apiUrl = active.effectiveBaseUrl;
            const model = active.modelId;

            configStore.setProvider(transportProvider as any);
            configStore.setApiUrl(apiUrl);
            configStore.setModel(model);
            configStore.recordCurrentLLMProfile();

            const agent = getAgentInstance();
            if (agent) {
                if (apiKey) {
                    agent.updateLLMConfig({ provider: transportProvider as any, apiUrl, model, apiKey });
                } else {
                    agent.updateLLMConfig({ provider: transportProvider as any, apiUrl, model });
                }
            }
        }

        broadcast(MODEL_CHANNELS.UPDATED);
        broadcast('config:updated');
        return { success: true };
    });

    ipcMain.handle(MODEL_CHANNELS.ADD_CUSTOM_MODEL, async (_event, payload: { providerName: string; modelId: string; displayName?: string; baseUrl?: string; apiKey?: string; protocol?: 'openai' | 'anthropic' }) => {
        const result = await getService().addCustomModel(payload);
        broadcast(MODEL_CHANNELS.UPDATED);
        return { success: true, ...result };
    });

    ipcMain.handle(MODEL_CHANNELS.DELETE_CUSTOM_MODEL, async (_event, modelId: string) => {
        await getService().deleteCustomModel(modelId);
        broadcast(MODEL_CHANNELS.UPDATED);
        return { success: true };
    });

    ipcMain.handle(MODEL_CHANNELS.SET_ACTIVE, async (_event, modelId: string) => {
        await getService().setActiveModel(modelId);

        const state = await getService().getState();
        const active = state.models.find(m => m.id === state.activeModelId);
        if (!active) {
            return { success: false, error: '模型不存在' };
        }

        const providerId = active.providerId;
        const apiKey = (await SecureCredentials.getApiKey(providerId)) || '';
        const providerProtocol = active.protocol;
        const transportProvider = providerProtocol === 'anthropic' ? 'anthropic' : 'openai';
        const apiUrl = active.effectiveBaseUrl;
        const model = active.modelId;

        configStore.setProvider(transportProvider as any);
        configStore.setApiUrl(apiUrl);
        configStore.setModel(model);
        configStore.recordCurrentLLMProfile();

        const agent = getAgentInstance();
        if (agent) {
            if (apiKey) {
                agent.updateLLMConfig({ provider: transportProvider as any, apiUrl, model, apiKey });
            } else {
                agent.updateLLMConfig({ provider: transportProvider as any, apiUrl, model });
            }
        }

        broadcast(MODEL_CHANNELS.UPDATED);
        broadcast('config:updated');

        return { success: true, activeModelId: state.activeModelId };
    });

    ipcMain.handle(MODEL_CHANNELS.CHECK_CONNECTION, async (_event, payload: { providerId: string; baseUrl?: string; apiKey?: string; protocol?: 'openai' | 'anthropic' }) => {
        try {
            let apiKey = payload.apiKey || '';
            if (!apiKey && payload.providerId) {
                // If API key is not provided in payload, try to get it from secure storage
                apiKey = (await SecureCredentials.getApiKey(payload.providerId)) || '';
            }

            const baseUrl = payload.baseUrl || '';
            const protocol = payload.protocol || (payload.providerId === 'anthropic' ? 'anthropic' : 'openai');

            let instance;
            if (protocol === 'anthropic') {
                instance = new AnthropicProvider(apiKey, baseUrl);
            } else {
                instance = new OpenAIProvider(apiKey, baseUrl);
            }

            const success = await instance.checkConnection();
            return { success };
        } catch (error) {
            console.error('Connection check failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });
}
