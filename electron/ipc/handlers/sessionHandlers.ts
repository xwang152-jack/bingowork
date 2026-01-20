/**
 * Session management IPC handlers
 * Handles all IPC communication related to session operations
 */

import { ipcMain } from 'electron';
import Anthropic from '@anthropic-ai/sdk';
import { sessionStore } from '../../config/SessionStore';
import { SESSION_CHANNELS } from '../../constants/IpcChannels';
import { getAgentInstance } from './agentHandlers';
import type { AgentMessage } from '../../types/ipc';

/**
 * Register all session-related IPC handlers
 */
export function registerSessionHandlers(): void {
  // Create new session
  ipcMain.handle(SESSION_CHANNELS.CREATE, () => {
    const agent = getAgentInstance();
    agent?.clearHistory();
    const session = sessionStore.createSession();
    return { success: true, sessionId: session.id };
  });

  // List all sessions
  ipcMain.handle(SESSION_CHANNELS.LIST, () => {
    return sessionStore.getSessions();
  });

  // Get specific session
  ipcMain.handle(SESSION_CHANNELS.GET, (_event, id: string) => {
    return sessionStore.getSession(id);
  });

  // Load session
  ipcMain.handle(SESSION_CHANNELS.LOAD, (event, id: string) => {
    const session = sessionStore.getSession(id);
    if (!session) {
      return { error: 'Session not found' };
    }
    sessionStore.setCurrentSession(id);
    const agent = getAgentInstance();
    if (agent) {
      agent.loadHistory(session.messages);
      // Explicitly send history update to the requesting window
      // This ensures the frontend receives the loaded history even if
      // the event listener was registered after loadHistory was called
      setTimeout(() => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('agent:history-update', session.messages);
        }
      }, 50);
    }
    return { success: true };
  });

  // Save session
  ipcMain.handle(SESSION_CHANNELS.SAVE, (_event, messages: unknown) => {
    const normalizedMessages = normalizeMessages(messages);
    const currentId = sessionStore.getCurrentSessionId();
    if (currentId) {
      sessionStore.updateSession(currentId, normalizedMessages);
      return { success: true };
    }
    // Create new session if none exists
    const session = sessionStore.createSession();
    sessionStore.updateSession(session.id, normalizedMessages);
    return { success: true, sessionId: session.id };
  });

  // Delete session
  ipcMain.handle(SESSION_CHANNELS.DELETE, (_event, id: string) => {
    sessionStore.deleteSession(id);
    return { success: true };
  });

  // Rename session
  ipcMain.handle(SESSION_CHANNELS.RENAME, (_event, id: string, title: string) => {
    sessionStore.renameSession(id, title);
    return { success: true };
  });

  // Get current session
  ipcMain.handle(SESSION_CHANNELS.CURRENT, () => {
    const id = sessionStore.getCurrentSessionId();
    return id ? sessionStore.getSession(id) : null;
  });
}

function normalizeMessages(messages: unknown): Anthropic.MessageParam[] {
  if (!Array.isArray(messages)) return [];

  const normalized: Anthropic.MessageParam[] = [];
  for (const msg of messages as unknown[]) {
    if (!msg || typeof msg !== 'object') continue;
    const candidate = msg as Partial<AgentMessage>;
    const role = candidate.role;
    if (role !== 'user' && role !== 'assistant') continue;

    if (candidate.content === undefined) continue;
    normalized.push({ role, content: candidate.content });
  }

  return normalized;
}
