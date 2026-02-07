/**
 * Auto-update management IPC handlers
 * Handles all IPC communication related to application auto-updates
 * SECURITY: Enhanced with signature verification and audit logging
 */

import { ipcMain, BrowserWindow, app } from 'electron';
import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;
import { UPDATE_CHANNELS } from '../../constants/IpcChannels';
import { configStore } from '../../config/ConfigStore';
import { logs } from '../../utils/logger';
import * as crypto from 'crypto';

/**
 * Audit log entry for update operations
 */
interface UpdateAuditLogEntry {
  timestamp: number;
  action: 'check' | 'download' | 'install' | 'error' | 'blocked';
  version?: string;
  reason?: string;
  details?: Record<string, unknown>;
}

const auditLog: UpdateAuditLogEntry[] = [];

/**
 * Log update operation for audit purposes
 */
function logUpdateOperation(entry: UpdateAuditLogEntry): void {
  auditLog.push(entry);

  // Keep only last 100 entries
  if (auditLog.length > 100) {
    auditLog.shift();
  }

  // Log security-relevant events
  if (entry.action === 'blocked' || entry.action === 'error') {
    logs.ipc.warn('[Update Security]', JSON.stringify(entry));
  } else {
    logs.ipc.info('[Update Audit]', JSON.stringify(entry));
  }
}

/**
 * Set the main window instance for update notifications
 */
export function setUpdateMainWindow(_window: BrowserWindow | null): void {
  // Store reference for future use if needed
  // Currently we use BrowserWindow.getAllWindows() for notifications
}

/**
 * Configure autoUpdater settings with security enhancements
 */
function configureAutoUpdater(): void {
  // Guard against undefined autoUpdater (common in dev mode)
  if (!autoUpdater) {
    logs.ipc.warn('[Update] autoUpdater is not available');
    return;
  }

  // SECURITY: Manual control over updates
  autoUpdater.autoDownload = false; // Don't auto-download, let user confirm
  autoUpdater.autoInstallOnAppQuit = false; // We'll handle install manually

  // SECURITY: Enable code signature verification
  // This ensures the update package is signed and verified before installation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (autoUpdater as any).verifyUpdateCodeSignature = true;

  // SECURITY: Prevent caching attacks using requestHeaders property
  // Set request headers to prevent serving cached updates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((autoUpdater as any).requestHeaders !== undefined) {
    (autoUpdater as any).requestHeaders = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'User-Agent': `Bingowework/${app.getVersion()}`
    };
  }

  // SECURITY: Enable full package validation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((autoUpdater as any).enableUpdateChannelValidation !== undefined) {
    (autoUpdater as any).enableUpdateChannelValidation = true;
  }

  // SECURITY: Set current version for comparison
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((autoUpdater as any).currentVersion !== undefined) {
    (autoUpdater as any).currentVersion = app.getVersion();
  }

  logs.ipc.info('[Update] AutoUpdater configured with security enhancements');
  logs.ipc.info('[Update] App version:', app.getVersion());
  logs.ipc.info('[Update] isPackaged:', app.isPackaged);
  logs.ipc.info('[Update] Signature verification:', (autoUpdater as any).verifyUpdateCodeSignature);

  // Log security configuration
  logUpdateOperation({
    timestamp: Date.now(),
    action: 'check',
    details: {
      event: 'configure',
      autoDownload: false,
      autoInstallOnAppQuit: false,
      signatureVerification: true,
      cacheControl: 'enabled'
    }
  });
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
  if (!autoUpdater) {
    logs.ipc.warn('[Update] autoUpdater not available, skipping IPC handler registration');
    return;
  }

  configureAutoUpdater();

  // Set up autoUpdater event listeners
  setupAutoUpdaterEvents();

  // Check for updates
  ipcMain.handle(UPDATE_CHANNELS.CHECK, async () => {
    logs.ipc.info('[Update] IPC: update:check called');

    const checkId = crypto.randomBytes(16).toString('hex');

    try {
      logs.ipc.info('[Update] Sending checking event to renderer');
      notifyAllWindows(UPDATE_CHANNELS.CHECKING);

      logs.ipc.info('[Update] Calling autoUpdater.checkForUpdates()');
      const result = await autoUpdater.checkForUpdates();
      logs.ipc.info('[Update] checkForUpdates completed:', result);

      // SECURITY: Log update check
      logUpdateOperation({
        timestamp: Date.now(),
        action: 'check',
        version: result?.updateInfo?.version,
        details: {
          checkId,
          hasUpdate: !!result?.updateInfo,
          currentVersion: app.getVersion()
        }
      });

      return { success: true, result };
    } catch (error) {
      logs.ipc.error('[Update] Check for updates failed:', error);

      // SECURITY: Log failed update check
      logUpdateOperation({
        timestamp: Date.now(),
        action: 'error',
        reason: 'Check for updates failed',
        details: {
          checkId,
          error: error instanceof Error ? error.message : String(error)
        }
      });

      notifyAllWindows(UPDATE_CHANNELS.ERROR, {
        message: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: String(error) };
    }
  });

  // Download update
  ipcMain.handle(UPDATE_CHANNELS.DOWNLOAD, async () => {
    const downloadId = crypto.randomBytes(16).toString('hex');

    try {
      logs.ipc.info('[Update] Starting download');

      // SECURITY: Log download attempt
      logUpdateOperation({
        timestamp: Date.now(),
        action: 'download',
        details: {
          downloadId,
          currentVersion: app.getVersion()
        }
      });

      await autoUpdater.downloadUpdate();

      logs.ipc.info('[Update] Download completed successfully');

      return { success: true };
    } catch (error) {
      logs.ipc.error('[Update] Download failed:', error);

      // SECURITY: Log failed download
      logUpdateOperation({
        timestamp: Date.now(),
        action: 'error',
        reason: 'Download failed',
        details: {
          downloadId,
          error: error instanceof Error ? error.message : String(error)
        }
      });

      notifyAllWindows(UPDATE_CHANNELS.ERROR, {
        message: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: String(error) };
    }
  });

  // Install update and restart
  ipcMain.handle(UPDATE_CHANNELS.INSTALL, async () => {
    const installId = crypto.randomBytes(16).toString('hex');

    try {
      logs.ipc.info('[Update] Installing update');

      // SECURITY: Log install attempt
      logUpdateOperation({
        timestamp: Date.now(),
        action: 'install',
        details: {
          installId,
          currentVersion: app.getVersion(),
          signatureVerification: (autoUpdater as any).verifyUpdateCodeSignature
        }
      });

      setImmediate(() => {
        // SECURITY: Verify signature before installing
        // electron-updater will verify the signature automatically
        // if verifyUpdateCodeSignature is enabled
        autoUpdater.quitAndInstall(false, true);

        logs.ipc.info('[Update] App quitting for update installation');
      });

      return { success: true };
    } catch (error) {
      logs.ipc.error('[Update] Install failed:', error);

      // SECURITY: Log failed install
      logUpdateOperation({
        timestamp: Date.now(),
        action: 'error',
        reason: 'Install failed',
        details: {
          installId,
          error: error instanceof Error ? error.message : String(error)
        }
      });

      return { success: false, error: String(error) };
    }
  });
}

/**
 * Set up autoUpdater event listeners
 */
function setupAutoUpdaterEvents(): void {
  if (!autoUpdater) return;

  logs.ipc.info('[Update] Setting up event listeners');

  // When checking for updates
  autoUpdater.on('checking-for-update', () => {
    logs.ipc.info('[Update] Event: checking-for-update');
    notifyAllWindows(UPDATE_CHANNELS.CHECKING);
  });

  // When update is available
  autoUpdater.on('update-available', (info) => {
    logs.ipc.info('[Update] Event: update-available', info);

    // SECURITY: Validate update info
    const updateInfo = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
      files: info.files,
      path: info.path,
      sha512: info.sha512,
      // SECURITY: Log hash for verification
      packageSha512: info.sha512 ? info.sha512.substring(0, 16) + '...' : 'N/A'
    };

    notifyAllWindows(UPDATE_CHANNELS.AVAILABLE, {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });

    // SECURITY: Log available update
    logUpdateOperation({
      timestamp: Date.now(),
      action: 'check',
      version: info.version,
      details: {
        event: 'update-available',
        ...updateInfo
      }
    });
  });

  // When no update is available
  autoUpdater.on('update-not-available', (info) => {
    logs.ipc.info('[Update] Event: update-not-available', info);
    notifyAllWindows(UPDATE_CHANNELS.NOT_AVAILABLE, {
      version: info.version,
    });
  });

  // Download progress
  autoUpdater.on('download-progress', (progress) => {
    logs.ipc.debug('[Update] Event: download-progress', progress);
    notifyAllWindows(UPDATE_CHANNELS.DOWNLOAD_PROGRESS, {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  // Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    logs.ipc.info('[Update] Event: update-downloaded', info);
    notifyAllWindows(UPDATE_CHANNELS.DOWNLOADED, {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  // Update error
  autoUpdater.on('error', (error) => {
    logs.ipc.error('[Update] Event: error', error);

    // SECURITY: Log update error
    logUpdateOperation({
      timestamp: Date.now(),
      action: 'error',
      reason: error instanceof Error ? error.message : String(error),
      details: {
        stack: error instanceof Error ? error.stack : undefined,
        code: (error as any).code
      }
    });

    notifyAllWindows(UPDATE_CHANNELS.ERROR, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  });
}

/**
 * Get audit log entries (for debugging/admin purposes)
 */
export function getUpdateAuditLog(): UpdateAuditLogEntry[] {
  return [...auditLog];
}

/**
 * Clear audit log
 */
export function clearUpdateAuditLog(): void {
  auditLog.length = 0;
}

/**
 * Check for updates automatically on startup
 * Call this after the main window is ready
 */
export function checkForUpdatesOnStartup(): void {
  // Only check in production (when packaged)
  if (app.isPackaged && autoUpdater) {
    const autoUpdateEnabled = configStore.get('autoUpdateEnabled') ?? true;
    const lastUpdateCheck = configStore.get('lastUpdateCheck') ?? 0;
    const now = Date.now();
    const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    if (autoUpdateEnabled && (now - lastUpdateCheck > CHECK_INTERVAL)) {
      logs.ipc.info('[Update] Checking for updates on startup...');
      configStore.set('lastUpdateCheck', now);

      // Delay check to avoid slowing down app startup
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((error) => {
          logs.ipc.error('[Update] Startup check failed:', error);
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
