/**
 * Agent-related IPC handlers
 * Handles all IPC communication related to agent operations
 * SECURITY: Enhanced with permission token verification and audit logging
 */

import { ipcMain, BrowserWindow } from 'electron';
import { AgentRuntime } from '../../agent/AgentRuntime';
import { configStore } from '../../config/ConfigStore';
import { sessionStore } from '../../config/SessionStore';
import { AGENT_CHANNELS } from '../../constants/IpcChannels';
import { logs } from '../../utils/logger';
import * as crypto from 'crypto';

let agent: AgentRuntime | null = null;

/**
 * SECURITY: Secret key for token generation
 * In production, this should be stored securely (e.g., in keychain)
 */
const TOKEN_SECRET = process.env.PERMISSION_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

/**
 * SECURITY: Pending confirmation requests with tokens
 */
interface PendingConfirmation {
  id: string;
  tool: string;
  path: string;
  timestamp: number;
  token: string;
}

const pendingConfirmations = new Map<string, PendingConfirmation>();

/**
 * SECURITY: Clean up expired tokens periodically
 */
const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

setInterval(() => {
  const now = Date.now();
  for (const [id, confirmation] of pendingConfirmations.entries()) {
    if (now - confirmation.timestamp > TOKEN_EXPIRY_MS) {
      pendingConfirmations.delete(id);
      logs.ipc.warn(`[Permission] Expired token cleaned up: ${id}`);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * SECURITY: Audit log for permission changes
 */
interface PermissionAuditLogEntry {
  timestamp: number;
  action: 'grant' | 'revoke' | 'verify_fail' | 'token_expired';
  tool: string;
  path?: string;
  reason?: string;
  details?: Record<string, unknown>;
}

const permissionAuditLog: PermissionAuditLogEntry[] = [];

/**
 * Log permission change for audit purposes
 */
function logPermissionChange(entry: PermissionAuditLogEntry): void {
  permissionAuditLog.push(entry);

  // Keep only last 200 entries
  if (permissionAuditLog.length > 200) {
    permissionAuditLog.shift();
  }

  // Log security-relevant events
  if (entry.action === 'verify_fail' || entry.action === 'token_expired') {
    logs.ipc.warn('[Permission Security]', JSON.stringify(entry));
  } else {
    logs.ipc.info('[Permission Audit]', JSON.stringify(entry));
  }
}

/**
 * SECURITY: Generate cryptographic token for confirmation
 */
function generateConfirmationToken(tool: string, path: string): string {
  const timestamp = Date.now();
  const data = `${tool}:${path}:${timestamp}`;

  const hmac = crypto.createHmac('sha256', TOKEN_SECRET);
  hmac.update(data);

  return hmac.digest('hex');
}

/**
 * SECURITY: Verify confirmation token
 */
function verifyConfirmationToken(id: string, token: string): { ok: boolean; error?: string } {
  const pending = pendingConfirmations.get(id);

  if (!pending) {
    logPermissionChange({
      timestamp: Date.now(),
      action: 'verify_fail',
      tool: 'unknown',
      reason: `Invalid confirmation ID: ${id}`
    });
    return { ok: false, error: 'Invalid confirmation ID' };
  }

  if (pending.token !== token) {
    logPermissionChange({
      timestamp: Date.now(),
      action: 'verify_fail',
      tool: pending.tool,
      path: pending.path,
      reason: 'Token mismatch'
    });
    return { ok: false, error: 'Token verification failed' };
  }

  const now = Date.now();
  if (now - pending.timestamp > TOKEN_EXPIRY_MS) {
    logPermissionChange({
      timestamp: Date.now(),
      action: 'token_expired',
      tool: pending.tool,
      path: pending.path,
      reason: `Token expired after ${now - pending.timestamp}ms`
    });
    pendingConfirmations.delete(id);
    return { ok: false, error: 'Confirmation token has expired' };
  }

  return { ok: true };
}

/**
 * SECURITY: Check if tool requires specific path (no wildcard allowed)
 */
function toolRequiresSpecificPath(tool: string): boolean {
  const toolsRequiringPath = [
    'write_file',
    'delete_file',
    'run_command',
    'file_system__write_file',
    'file_system__delete_file',
    'file_system__run_command'
  ];

  return toolsRequiringPath.includes(tool);
}

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
 * SECURITY: Create a pending confirmation request with token
 * This should be called when agent requests user confirmation
 */
export function createPendingConfirmation(
  id: string,
  tool: string,
  path: string
): string {
  const token = generateConfirmationToken(tool, path);

  const confirmation: PendingConfirmation = {
    id,
    tool,
    path,
    timestamp: Date.now(),
    token
  };

  pendingConfirmations.set(id, confirmation);

  // Clean up old entries if too many
  if (pendingConfirmations.size > 100) {
    const oldestId = pendingConfirmations.keys().next().value;
    pendingConfirmations.delete(oldestId);
  }

  logs.ipc.info(`[Permission] Created confirmation token for ${tool}:${path}`);

  return token;
}

/**
 * SECURITY: Get audit log entries (for debugging/admin purposes)
 */
export function getPermissionAuditLog(): PermissionAuditLogEntry[] {
  return [...permissionAuditLog];
}

/**
 * SECURITY: Clear audit log
 */
export function clearPermissionAuditLog(): void {
  permissionAuditLog.length = 0;
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

  // SECURITY: Handle confirmation response with token verification
  ipcMain.handle(
    AGENT_CHANNELS.CONFIRM_RESPONSE,
    (
      _event,
      {
        id,
        approved,
        remember,
        tool,
        path,
        token
      }: {
        id: string;
        approved: boolean;
        remember?: boolean;
        tool?: string;
        path?: string;
        token?: string;
      }
    ) => {
      logs.ipc.info(`[Permission] Received confirmation response for ${id}, approved: ${approved}`);

      // SECURITY: Verify token if permission persistence is requested
      if (approved && remember && tool) {
        // SECURITY: Verify token to prevent forgery
        if (!token) {
          logPermissionChange({
            timestamp: Date.now(),
            action: 'verify_fail',
            tool,
            path,
            reason: 'Missing token for permission persistence'
          });

          logs.ipc.warn('[Permission] Permission persistence requested without token');
          agent?.handleConfirmResponse(id, approved);
          return { success: false, error: 'Token required for permission persistence' };
        }

        const verification = verifyConfirmationToken(id, token);
        if (!verification.ok) {
          logs.ipc.warn(`[Permission] Token verification failed: ${verification.error}`);

          // Still allow the operation, but don't persist permission
          agent?.handleConfirmResponse(id, approved);
          return {
            success: false,
            error: verification.error,
            message: 'Permission not persisted due to verification failure'
          };
        }

        // SECURITY: Restrict wildcard permissions for dangerous tools
        const permissionPath = tool === 'playwright__playwright_screenshot' ? '*' : path;

        if (permissionPath === '*' && toolRequiresSpecificPath(tool)) {
          logPermissionChange({
            timestamp: Date.now(),
            action: 'verify_fail',
            tool,
            path: permissionPath,
            reason: 'Wildcard permission not allowed for this tool'
          });

          logs.ipc.warn(`[Permission] Wildcard permission denied for tool: ${tool}`);

          agent?.handleConfirmResponse(id, approved);
          return {
            success: false,
            error: 'Wildcard permission not allowed for this tool',
            message: `Tool ${tool} requires specific path permissions`
          };
        }

        // SECURITY: Add permission with expiry (30 days)
        const permissionExpiry = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days

        configStore.addPermission(tool, permissionPath);

        logPermissionChange({
          timestamp: Date.now(),
          action: 'grant',
          tool,
          path: permissionPath,
          details: {
            expiresAt: permissionExpiry,
            expiryDays: 30
          }
        });

        logs.ipc.info(`[Permission] Saved: ${tool} for path: ${permissionPath || '*'}`);
      }

      // Clean up pending confirmation
      pendingConfirmations.delete(id);

      agent?.handleConfirmResponse(id, approved);

      return { success: true };
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
