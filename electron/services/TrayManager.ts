/**
 * Tray Manager
 * Manages system tray icon and menu
 */

import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';

export class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private floatingBallWindow: BrowserWindow | null = null;

  /**
   * Set window references
   */
  setWindows(mainWin: BrowserWindow | null, floatingBallWin: BrowserWindow | null): void {
    this.mainWindow = mainWin;
    this.floatingBallWindow = floatingBallWin;
  }

  /**
   * Create system tray
   */
  createTray(): void {
    try {
      // Try to load icon from public folder
      const iconPath = process.env.VITE_PUBLIC || '';
      const icon = nativeImage.createFromPath(iconPath + '/icon.png');

      if (icon.isEmpty()) {
        // Fallback to empty icon
        const blankIcon = nativeImage.createEmpty();
        this.tray = new Tray(blankIcon);
      } else {
        this.tray = new Tray(icon);
      }
    } catch {
      // Fallback to empty icon
      const blankIcon = nativeImage.createEmpty();
      this.tray = new Tray(blankIcon);
    }

    this.tray.setToolTip('Bingowork');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          this.mainWindow?.show();
          this.mainWindow?.focus();
        }
      },
      {
        label: '显示悬浮球',
        click: () => {
          if (this.floatingBallWindow) {
            this.floatingBallWindow.isVisible()
              ? this.floatingBallWindow.hide()
              : this.floatingBallWindow.show();
          }
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Cleanup on app quit
   */
  cleanup(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  /**
   * Get tray instance
   */
  getTray(): Tray | null {
    return this.tray;
  }
}

/**
 * Singleton instance
 */
let trayManagerInstance: TrayManager | null = null;

export function getTrayManager(): TrayManager {
  if (!trayManagerInstance) {
    trayManagerInstance = new TrayManager();
  }
  return trayManagerInstance;
}
