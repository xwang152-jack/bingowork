/**
 * Window management IPC handlers
 * Handles all IPC communication related to window operations
 */

import { ipcMain, BrowserWindow } from 'electron';
import { WINDOW_CHANNELS } from '../../constants/IpcChannels';

let mainWindow: BrowserWindow | null = null;

/**
 * Set the main window instance
 */
export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}

/**
 * Get the main window instance
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Register all window-related IPC handlers
 */
export function registerWindowHandlers(): void {
  // Minimize window
  ipcMain.handle(WINDOW_CHANNELS.MINIMIZE, () => {
    mainWindow?.minimize();
  });

  // Maximize/restore window
  ipcMain.handle(WINDOW_CHANNELS.MAXIMIZE, () => {
    if (!mainWindow) {
      return;
    }
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  // Close (hide) window
  ipcMain.handle(WINDOW_CHANNELS.CLOSE, () => {
    mainWindow?.hide();
  });
}
