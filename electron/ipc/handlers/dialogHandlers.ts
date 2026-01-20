/**
 * Dialog IPC handlers
 * Handles all IPC communication related to native dialogs
 */

import { ipcMain, dialog } from 'electron';
import { DIALOG_CHANNELS } from '../../constants/IpcChannels';
import { getMainWindow } from './windowHandlers';

/**
 * Register all dialog-related IPC handlers
 */
export function registerDialogHandlers(): void {
  // Select folder dialog
  ipcMain.handle(DIALOG_CHANNELS.SELECT_FOLDER, async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      return null;
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });
}
