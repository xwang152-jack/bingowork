/**
 * Agent-related IPC handlers
 * Handles all IPC communication related to agent operations
 */

import { ipcMain, BrowserWindow } from 'electron';
import { AgentRuntime } from '../../agent/AgentRuntime';
import { configStore } from '../../config/ConfigStore';
import { sessionStore } from '../../config/SessionStore';
import { AGENT_CHANNELS } from '../../constants/IpcChannels';

let agent: AgentRuntime | null = null;

/**
 * Set the active agent instance
 */
export function setAgentInstance(agentInstance: AgentRuntime | null): void {
  agent = agentInstance;
}

/**
 * Get the active agent instance
 */
export function getAgentInstance(): AgentRuntime | null {
  return agent;
}

/**
 * Register all agent-related IPC handlers
 */
export function registerAgentHandlers(): void {
  // Message sending
  ipcMain.handle(
    AGENT_CHANNELS.SEND_MESSAGE,
    async (_event, message: string | { content: string; images: string[] }) => {
      if (!agent) {
        throw new Error('Agent not initialized');
      }
      return await agent.processUserMessage(message);
    }
  );

  // Alias for compatibility
  ipcMain.handle(
    AGENT_CHANNELS.SEND_MESSAGE_ALIAS,
    async (_event, message: string | { content: string; images: string[] }) => {
      if (!agent) {
        throw new Error('Agent not initialized');
      }
      return await agent.processUserMessage(message);
    }
  );

  // Abort current operation
  ipcMain.handle(AGENT_CHANNELS.ABORT, () => {
    agent?.abort();
  });

  // Handle confirmation response
  ipcMain.handle(
    AGENT_CHANNELS.CONFIRM_RESPONSE,
    (
      _event,
      { id, approved, remember, tool, path }: {
        id: string;
        approved: boolean;
        remember?: boolean;
        tool?: string;
        path?: string;
      }
    ) => {
      if (approved && remember && tool) {
        configStore.addPermission(tool, path);
        console.log(`[Permission] Saved: ${tool} for path: ${path || '*'}`);
      }
      agent?.handleConfirmResponse(id, approved);
    }
  );

  // Handle user question response
  ipcMain.handle(
    AGENT_CHANNELS.USER_QUESTION_RESPONSE,
    (_event, { id, answer }: { id: string; answer: string }) => {
      agent?.handleUserQuestionResponse(id, answer);
    }
  );

  // New session
  ipcMain.handle(AGENT_CHANNELS.NEW_SESSION, () => {
    agent?.clearHistory();
    const session = sessionStore.createSession();
    return { success: true, sessionId: session.id };
  });

  // Authorize folder
  ipcMain.handle(AGENT_CHANNELS.AUTHORIZE_FOLDER, (_event, folderPath: string) => {
    configStore.addAuthorizedFolder(folderPath);
    return { success: true, authorizedFolders: configStore.getAuthorizedFolders() };
  });

  // Get authorized folders
  ipcMain.handle(AGENT_CHANNELS.GET_AUTHORIZED_FOLDERS, () => {
    return configStore.getAuthorizedFolders();
  });

  // Set work mode
  ipcMain.handle(AGENT_CHANNELS.SET_WORK_MODE, (_event, mode: string) => {
    const normalized = String(mode || '').trim().toLowerCase();
    if (normalized !== 'chat' && normalized !== 'code' && normalized !== 'cowork') {
      return { success: false, error: 'Invalid work mode' };
    }
    const nextMode = normalized as 'chat' | 'code' | 'cowork';
    configStore.set('workMode', nextMode);
    agent?.setWorkMode(nextMode);

    // Broadcast config update
    notifyConfigUpdate();

    return { success: true, workMode: nextMode };
  });

  // Set working directory
  ipcMain.handle(AGENT_CHANNELS.SET_WORKING_DIR, (_event, folderPath: string) => {
    const folders = configStore.getAuthorizedFolders();
    configStore.setAuthorizedFolders([folderPath, ...folders.filter((f) => f !== folderPath)]);

    // Notify renderer that config has changed
    notifyConfigUpdate();

    return true;
  });
}

/**
 * Broadcast config update to all windows
 */
function notifyConfigUpdate(): void {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('config:updated');
    }
  });
}
