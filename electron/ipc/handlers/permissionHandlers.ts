/**
 * Permission management IPC handlers
 * Handles all IPC communication related to permission operations
 */

import { ipcMain } from 'electron';
import { configStore } from '../../config/ConfigStore';
import { PERMISSION_CHANNELS } from '../../constants/IpcChannels';

/**
 * Register all permission-related IPC handlers
 */
export function registerPermissionHandlers(): void {
  // List all permissions
  ipcMain.handle(PERMISSION_CHANNELS.LIST, () => {
    return configStore.getAllowedPermissions();
  });

  // Revoke specific permission
  ipcMain.handle(
    PERMISSION_CHANNELS.REVOKE,
    (_event, { tool, pathPattern }: { tool: string; pathPattern?: string }) => {
      configStore.removePermission(tool, pathPattern);
      return { success: true };
    }
  );

  // Clear all permissions
  ipcMain.handle(PERMISSION_CHANNELS.CLEAR, () => {
    configStore.clearAllPermissions();
    return { success: true };
  });
}
