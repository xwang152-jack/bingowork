/**
 * Window Manager
 * Manages all application windows (main window, floating ball)
 */

import { BrowserWindow, screen, app } from 'electron';
import path from 'path';
import { getPreloadPath, getIconPath } from '../config/AppConfig';

// Constants for floating ball
const BALL_SIZE = 64;
const EXPANDED_WIDTH = 340;
const EXPANDED_HEIGHT = 480;

/**
 * Floating ball state
 */
interface FloatingBallState {
  window: BrowserWindow | null;
  isExpanded: boolean;
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private floatingBall: FloatingBallState = {
    window: null,
    isExpanded: false,
  };
  private keepBallOnTopInterval: NodeJS.Timeout | null = null;

  /**
   * Create the main application window
   */
  createMainWindow(viteDevServerUrl: string | undefined, rendererDist: string): BrowserWindow {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1000,
      minHeight: 600,
      icon: getIconPath(),
      frame: false,
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        preload: getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: false,
    });

    // Remove menu bar
    this.mainWindow.setMenu(null);

    this.mainWindow.once('ready-to-show', () => {
      console.log('Main window ready.');
      this.mainWindow?.show();
      if (viteDevServerUrl) {
        this.mainWindow?.webContents.openDevTools({ mode: 'detach' });
      }
    });

    this.mainWindow.on('close', (event) => {
      if (!app.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });

    this.mainWindow.webContents.on('did-finish-load', () => {
      this.mainWindow?.webContents.send('main-process-message', new Date().toLocaleString());
    });

    this.mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error('[MainWindow] did-fail-load', { errorCode, errorDescription, validatedURL });
    });

    this.mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('[MainWindow] render-process-gone', details);
    });

    this.mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      console.log('[MainWindow] console', { level, message, line, sourceId });
    });

    // Load the appropriate URL
    if (viteDevServerUrl) {
      this.mainWindow.loadURL(viteDevServerUrl);
    } else {
      this.mainWindow.loadFile(path.join(rendererDist, 'index.html'));
    }

    return this.mainWindow;
  }

  /**
   * Create the floating ball window
   */
  createFloatingBallWindow(viteDevServerUrl: string | undefined, rendererDist: string): BrowserWindow {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

    this.floatingBall.window = new BrowserWindow({
      width: BALL_SIZE,
      height: BALL_SIZE,
      x: screenWidth - BALL_SIZE - 20,
      y: screenHeight - BALL_SIZE - 100,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      hasShadow: false,
      skipTaskbar: true,
      webPreferences: {
        preload: getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
      },
      icon: getIconPath(),
    });

    // Load the appropriate URL
    if (viteDevServerUrl) {
      this.floatingBall.window.loadURL(`${viteDevServerUrl}#/floating-ball`);
    } else {
      this.floatingBall.window.loadFile(path.join(rendererDist, 'index.html'), { hash: 'floating-ball' });
    }

    this.floatingBall.window.on('closed', () => {
      this.floatingBall.window = null;
    });

    this.floatingBall.window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error('[FloatingBall] did-fail-load', { errorCode, errorDescription, validatedURL });
    });

    this.floatingBall.window.webContents.on('render-process-gone', (_event, details) => {
      console.error('[FloatingBall] render-process-gone', details);
    });

    this.floatingBall.window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      console.log('[FloatingBall] console', { level, message, line, sourceId });
    });

    // Start keep-alive interval
    this.startKeepBallOnTopInterval();

    return this.floatingBall.window;
  }

  /**
   * Toggle floating ball expanded state
   */
  toggleFloatingBallExpanded(): void {
    if (!this.floatingBall.window) {
      return;
    }

    const [currentX, currentY] = this.floatingBall.window.getPosition();
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

    if (this.floatingBall.isExpanded) {
      // Collapse
      const ballX = currentX + EXPANDED_WIDTH - BALL_SIZE;
      const ballY = currentY;

      const finalX = Math.max(0, Math.min(ballX, screenWidth - BALL_SIZE));
      const finalY = Math.max(0, Math.min(ballY, screenHeight - BALL_SIZE));

      this.floatingBall.window.setSize(BALL_SIZE, BALL_SIZE);
      this.floatingBall.window.setPosition(finalX, finalY);
      this.floatingBall.isExpanded = false;
    } else {
      // Expand
      let newX = currentX + BALL_SIZE - EXPANDED_WIDTH;
      let newY = currentY;

      newX = Math.max(0, newX);
      newY = Math.max(0, newY);

      this.floatingBall.window.setSize(EXPANDED_WIDTH, EXPANDED_HEIGHT);
      this.floatingBall.window.setPosition(newX, newY);
      this.floatingBall.isExpanded = true;
    }

    this.floatingBall.window.webContents.send('floating-ball:state-changed', this.floatingBall.isExpanded);
  }

  /**
   * Move floating ball by delta
   */
  moveFloatingBall(deltaX: number, deltaY: number): void {
    if (!this.floatingBall.window) {
      return;
    }

    const [x, y] = this.floatingBall.window.getPosition();
    this.floatingBall.window.setPosition(x + deltaX, y + deltaY);

    // Enforce fixed size when expanded
    if (this.floatingBall.isExpanded) {
      this.floatingBall.window.setSize(EXPANDED_WIDTH, EXPANDED_HEIGHT);
    }
  }

  /**
   * Start interval to keep ball on top
   */
  private startKeepBallOnTopInterval(): void {
    this.keepBallOnTopInterval = setInterval(() => {
      if (this.floatingBall.window && !this.floatingBall.window.isDestroyed()) {
        this.floatingBall.window.setAlwaysOnTop(true, 'screen-saver');
      } else {
        this.stopKeepBallOnTopInterval();
      }
    }, 2000);
  }

  /**
   * Stop the keep-alive interval
   */
  private stopKeepBallOnTopInterval(): void {
    if (this.keepBallOnTopInterval) {
      clearInterval(this.keepBallOnTopInterval);
      this.keepBallOnTopInterval = null;
    }
  }

  /**
   * Show main window
   */
  showMainWindow(): void {
    this.mainWindow?.show();
    this.mainWindow?.focus();
  }

  /**
   * Hide main window
   */
  hideMainWindow(): void {
    this.mainWindow?.hide();
  }

  /**
   * Get the main window instance
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * Get the floating ball window instance
   */
  getFloatingBallWindow(): BrowserWindow | null {
    return this.floatingBall.window;
  }

  /**
   * Check if floating ball is visible
   */
  isFloatingBallVisible(): boolean {
    return this.floatingBall.window?.isVisible() ?? false;
  }

  /**
   * Show floating ball
   */
  showFloatingBall(): void {
    this.floatingBall.window?.show();
    this.floatingBall.window?.focus();
  }

  /**
   * Hide floating ball
   */
  hideFloatingBall(): void {
    this.floatingBall.window?.hide();
  }

  /**
   * Cleanup on app quit
   */
  cleanup(): void {
    this.stopKeepBallOnTopInterval();
  }

  /**
   * Get floating ball state
   */
  getFloatingBallState(): { window: BrowserWindow | null; isExpanded: boolean } {
    return {
      window: this.floatingBall.window,
      isExpanded: this.floatingBall.isExpanded,
    };
  }
}

/**
 * Singleton instance
 */
let windowManagerInstance: WindowManager | null = null;

export function getWindowManager(): WindowManager {
  if (!windowManagerInstance) {
    windowManagerInstance = new WindowManager();
  }
  return windowManagerInstance;
}
