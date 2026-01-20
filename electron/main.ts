/**
 * Bingowork - Main Process Entry Point
 * Refactored for better maintainability and modularity
 */

import { app, BrowserWindow } from 'electron';
import dotenv from 'dotenv';

// Configuration
import { setupDevEnvironment, VITE_DEV_SERVER_URL, RENDERER_DIST } from './config/AppConfig';
import { configStore } from './config/ConfigStore';
import { TaskDatabase } from './config/TaskDatabase';

// Managers
import { getWindowManager } from './windows/WindowManager';
import { getTrayManager } from './services/TrayManager';
import { getShortcutManager } from './services/ShortcutManager';
import { getAgentInitializer } from './services/AgentInitializer';

// IPC Handlers
import { registerAllIPCHandlers, setAgentInstance, setMainWindow, setTaskDatabase } from './ipc/handlers';

// Extend App type to include isQuitting property
declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}

dotenv.config();

// Global state
let taskDb: TaskDatabase | null = null;

/**
 * Application lifecycle handlers
 */

app.on('before-quit', () => {
  app.isQuitting = true;

  // Cleanup resources
  try {
    taskDb?.close();
  } catch (error) {
    console.error('[Cleanup] Failed to close task database:', error);
  }

  // Cleanup managers
  getWindowManager().cleanup();
  getShortcutManager().unregisterShortcuts();
  getTrayManager().cleanup();
  getAgentInitializer().cleanup();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const windowManager = getWindowManager();
    windowManager.createMainWindow(VITE_DEV_SERVER_URL, RENDERER_DIST);
  }
});

/**
 * Initialize the application
 */
app.whenReady().then(async () => {
  try {
    // 1. Setup development environment
    const devUserData = setupDevEnvironment();
    if (devUserData !== null) {
      app.setPath('userData', devUserData);
    }

    // 2. Initialize task database
    taskDb = await initializeTaskDatabase(devUserData);

    // 3. Set App User Model ID for Windows notifications
    app.setAppUserModelId('com.bingowork.app');

    // 4. Register protocol client
    if (app.isPackaged) {
      app.setAsDefaultProtocolClient('bingowork');
    } else {
      console.log('[Protocol] Skipping registration in Dev mode.');
    }

    // 5. Register IPC handlers
    registerAllIPCHandlers();

    // 6. Create windows
    const windowManager = getWindowManager();
    const mainWindow = windowManager.createMainWindow(VITE_DEV_SERVER_URL, RENDERER_DIST);
    const floatingBallWindow = windowManager.createFloatingBallWindow(VITE_DEV_SERVER_URL, RENDERER_DIST);

    // 7. Set instances for IPC handlers (do this early so IPC is available)
    setTaskDatabase(taskDb);
    setMainWindow(mainWindow);

    // 8. Create system tray
    const trayManager = getTrayManager();
    trayManager.setWindows(mainWindow, floatingBallWindow);
    trayManager.createTray();

    // 9. Register global shortcuts
    const shortcutManager = getShortcutManager();
    shortcutManager.setWindowManager(windowManager);
    shortcutManager.registerShortcuts();

    // 10. Show main window in dev mode
    if (VITE_DEV_SERVER_URL) {
      mainWindow?.show();
    }

    // 11. Initialize agent in background (non-blocking)
    // This allows the window to display immediately while agent loads
    setImmediate(async () => {
      try {
        const agentInitializer = getAgentInitializer();
        const agent = await agentInitializer.initializeAgent(mainWindow, taskDb);

        // Add floating ball window to agent so it receives agent events
        if (agent && floatingBallWindow) {
          agent.addWindow(floatingBallWindow);
        }

        // Set agent instance for IPC handlers
        if (agent) {
          setAgentInstance(agent);
        }

        // Notify renderer that agent is ready
        mainWindow?.webContents.send('agent:ready');
        console.log('[Agent] Agent initialized and ready');
      } catch (error) {
        console.error('[Agent] Agent initialization failed:', error);
        mainWindow?.webContents.send('agent:error', { error: String(error) });
      }
    });

    console.log('Bingowork started. Press Alt+Space to toggle floating ball.');
    console.log('[Config] Work mode:', configStore.get('workMode'));
  } catch (error) {
    console.error('[Init] Application initialization failed:', error);
    app.quit();
  }
});

/**
 * Initialize task database
 */
async function initializeTaskDatabase(devUserData: string | null): Promise<TaskDatabase | null> {
  try {
    const db = devUserData
      ? new TaskDatabase(devUserData + '/bingowork.sqlite3')
      : new TaskDatabase();

    db.upsertConfig(configStore.getAll());
    return db;
  } catch (error) {
    console.error('[Init] Task database initialization failed:', error);
    return null;
  }
}

// Export for testing
export { taskDb, getWindowManager, getAgentInitializer };
