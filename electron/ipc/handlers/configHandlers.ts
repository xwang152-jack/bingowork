/**
 * Configuration management IPC handlers
 * Handles all IPC communication related to configuration operations
 */

import { ipcMain, BrowserWindow } from 'electron';
import { configStore } from '../../config/ConfigStore';
import { CONFIG_CHANNELS } from '../../constants/IpcChannels';
import { getAgentInstance } from './agentHandlers';
import { sessionStore } from '../../config/SessionStore';
import type { TaskDatabase } from '../../config/TaskDatabase';

let taskDb: TaskDatabase | null = null;

/**
 * Set the task database instance
 */
export function setTaskDatabase(db: TaskDatabase | null): void {
  taskDb = db;
}

export function getTaskDatabase(): TaskDatabase | null {
  return taskDb;
}

/**
 * Register all config-related IPC handlers
 */
export function registerConfigHandlers(): void {
  // Get all configuration
  ipcMain.handle(CONFIG_CHANNELS.GET_ALL, () => configStore.getEffectiveConfig());

  // Set all configuration
  ipcMain.handle(CONFIG_CHANNELS.SET_ALL, async (_event, cfg) => {
    if (typeof cfg.provider === 'string') {
      configStore.setProvider(cfg.provider);
    }

    // Handle API keys - store securely in keychain
    if (cfg.apiKeys && typeof cfg.apiKeys === 'object') {
      for (const [provider, apiKey] of Object.entries(cfg.apiKeys)) {
        if (typeof apiKey === 'string') {
          await configStore.setApiKey(apiKey, provider as any);
        }
      }
    }

    // Handle single API key (legacy support)
    if (typeof cfg.apiKey === 'string') {
      await configStore.setApiKey(cfg.apiKey);
    }

    if (typeof cfg.apiUrl === 'string') {
      configStore.setApiUrl(cfg.apiUrl);
    }
    if (typeof cfg.model === 'string') {
      configStore.setModel(cfg.model);
    }
    configStore.setAuthorizedFolders(Array.isArray(cfg.authorizedFolders) ? cfg.authorizedFolders : []);
    if (typeof cfg.networkAccess === 'boolean') {
      configStore.setNetworkAccess(cfg.networkAccess);
    }
    if (typeof cfg.browserAccess === 'boolean') {
      configStore.set('browserAccess', cfg.browserAccess);
    }
    if (typeof cfg.shortcut === 'string') {
      configStore.set('shortcut', cfg.shortcut);
    }
    if (
      typeof cfg.workMode === 'string' &&
      (cfg.workMode === 'chat' || cfg.workMode === 'code' || cfg.workMode === 'cowork')
    ) {
      configStore.set('workMode', cfg.workMode);
    }
    configStore.recordCurrentLLMProfile();

    try {
      taskDb?.upsertConfig(configStore.getAll());
      taskDb?.logEvent({
        sessionId: sessionStore.getCurrentSessionId(),
        type: 'config_updated',
        payload: configStore.getEffectiveConfig(),
      });
    } catch (e) {
      console.error('Task DB config write failed:', e);
    }

    // Notify renderer that config has changed
    notifyConfigUpdate();

    // Reinitialize agent
    reinitializeAgent();

    return { success: true };
  });

  // Get API key for current provider
  ipcMain.handle(CONFIG_CHANNELS.GET_API_KEY, async (_event, provider?: string) => {
    const apiKey = await configStore.getApiKey(provider as any);
    return apiKey || '';
  });

  // Set model
  ipcMain.handle(CONFIG_CHANNELS.SET_MODEL, async (_event, model: string) => {
    configStore.recordCurrentLLMProfile();
    const prevModel = configStore.getModel();
    if (typeof model === 'string') {
      configStore.setModel(model);
    }

    const profile = configStore.findLLMProfileByModel(configStore.getModel());
    if (!profile) {
      configStore.setModel(prevModel);
      notifyConfigUpdate();
      return { success: false, error: '模型未配置对应接口', model: prevModel };
    }

    configStore.setProvider(profile.provider);
    configStore.setApiUrl(profile.apiUrl);
    configStore.recordCurrentLLMProfile();

    try {
      taskDb?.upsertConfig(configStore.getAll());
      taskDb?.logEvent({
        sessionId: sessionStore.getCurrentSessionId(),
        type: 'config_updated',
        payload: configStore.getEffectiveConfig(),
      });
    } catch (e) {
      console.error('Task DB config write failed:', e);
    }

    notifyConfigUpdate();

    try {
      const apiKey = await configStore.getApiKey(configStore.getProvider());
      const agent = getAgentInstance();
      if (apiKey) {
        agent?.updateLLMConfig({
          model: configStore.getModel(),
          provider: configStore.getProvider(),
          apiUrl: configStore.getApiUrl(),
          apiKey,
        });
      } else {
        agent?.updateLLMConfig({
          model: configStore.getModel(),
          provider: configStore.getProvider(),
          apiUrl: configStore.getApiUrl(),
        });
        console.warn('No API Key found for provider:', configStore.getProvider());
      }
    } catch {
      // Ignore
    }

    return { success: true };
  });
}

/**
 * Broadcast config update to all windows
 */
function notifyConfigUpdate(): void {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(CONFIG_CHANNELS.UPDATED);
    }
  });
}

/**
 * Reinitialize the agent with new configuration
 */
function reinitializeAgent(): void {
  // This is a placeholder - actual reinitialization logic
  // should be called from the main process
  console.log('Agent reinitialization requested');
}
