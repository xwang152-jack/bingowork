/**
 * Auto-update management IPC handlers
 * Handles all IPC communication related to application auto-updates
 */

import { ipcMain, BrowserWindow, app } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg as { autoUpdater: typeof import('electron-updater').autoUpdater };
import { UPDATE_CHANNELS } from '../../constants/IpcChannels';
import { configStore } from '../../config/ConfigStore';

/**
 * Set the main window instance for update notifications
 */
export function setUpdateMainWindow(_window: BrowserWindow | null): void {
  // Store reference for future use if needed
  // Currently we use BrowserWindow.getAllWindows() for notifications
}

/**
 * Configure autoUpdater settings
 */
function configureAutoUpdater(): void {
  // Configure autoUpdater settings
  autoUpdater.autoDownload = false; // Don't auto-download, let user confirm
  autoUpdater.autoInstallOnAppQuit = false; // We'll handle install manually
  autoUpdater.logger = require('electron-log');

  console.log('[Update] AutoUpdater configured');
  console.log('[Update] App version:', app.getVersion());
  console.log('[Update] isPackaged:', app.isPackaged);
}

/**
 * Notify all windows about update events
 */
function notifyAllWindows(channel: string, data?: unknown): void {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  });
}

/**
 * Register all update-related IPC handlers
 */
export function registerUpdateHandlers(): void {
  configureAutoUpdater();

  // Set up autoUpdater event listeners
  setupAutoUpdaterEvents();

  // Check for updates
  ipcMain.handle(UPDATE_CHANNELS.CHECK, async () => {
    console.log('[Update] IPC: update:check called');
    try {
      console.log('[Update] Sending checking event to renderer');
      notifyAllWindows(UPDATE_CHANNELS.CHECKING);

      console.log('[Update] Calling autoUpdater.checkForUpdates()');
      const result = await autoUpdater.checkForUpdates();
      console.log('[Update] checkForUpdates completed:', result);
      return { success: true, result };
    } catch (error) {
      console.error('[Update] Check for updates failed:', error);
      notifyAllWindows(UPDATE_CHANNELS.ERROR, {
        message: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: String(error) };
    }
  });

  // Download update
  ipcMain.handle(UPDATE_CHANNELS.DOWNLOAD, async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      console.error('[Update] Download failed:', error);
      notifyAllWindows(UPDATE_CHANNELS.ERROR, {
        message: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: String(error) };
    }
  });

  // Install update and restart
  ipcMain.handle(UPDATE_CHANNELS.INSTALL, async () => {
    try {
      setImmediate(() => {
        autoUpdater.quitAndInstall(false, true);
      });
      return { success: true };
    } catch (error) {
      console.error('[Update] Install failed:', error);
      return { success: false, error: String(error) };
    }
  });
}

/**
 * Set up autoUpdater event listeners
 */
function setupAutoUpdaterEvents(): void {
  console.log('[Update] Setting up event listeners');

  // When checking for updates
  autoUpdater.on('checking-for-update', () => {
    console.log('[Update] Event: checking-for-update');
    notifyAllWindows(UPDATE_CHANNELS.CHECKING);
  });

  // When update is available
  autoUpdater.on('update-available', (info) => {
    console.log('[Update] Event: update-available', info);
    notifyAllWindows(UPDATE_CHANNELS.AVAILABLE, {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  // When no update is available
  autoUpdater.on('update-not-available', (info) => {
    console.log('[Update] Event: update-not-available', info);
    notifyAllWindows(UPDATE_CHANNELS.NOT_AVAILABLE, {
      version: info.version,
    });
  });

  // Download progress
  autoUpdater.on('download-progress', (progress) => {
    console.log('[Update] Event: download-progress', progress);
    notifyAllWindows(UPDATE_CHANNELS.DOWNLOAD_PROGRESS, {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  // Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Update] Event: update-downloaded', info);
    notifyAllWindows(UPDATE_CHANNELS.DOWNLOADED, {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  // Update error
  autoUpdater.on('error', (error) => {
    console.error('[Update] Event: error', error);
    notifyAllWindows(UPDATE_CHANNELS.ERROR, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  });
}

/**
 * Check for updates automatically on startup
 * Call this after the main window is ready
 */
export function checkForUpdatesOnStartup(): void {
  // Only check in production (when packaged)
  if (app.isPackaged) {
    const autoUpdateEnabled = configStore.get('autoUpdateEnabled') ?? true;
    const lastUpdateCheck = configStore.get('lastUpdateCheck') ?? 0;
    const now = Date.now();
    const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    if (autoUpdateEnabled && (now - lastUpdateCheck > CHECK_INTERVAL)) {
      console.log('[Update] Checking for updates on startup...');
      configStore.set('lastUpdateCheck', now);

      // Delay check to avoid slowing down app startup
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((error) => {
          console.error('[Update] Startup check failed:', error);
        });
      }, 30000); // Check after 30 seconds
    }
  }
}

/**
 * Enable or disable auto-update
 */
export function setAutoUpdateEnabled(enabled: boolean): void {
  configStore.set('autoUpdateEnabled', enabled);
  configStore.set('lastUpdateCheck', 0);
}
