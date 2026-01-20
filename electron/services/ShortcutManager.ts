/**
 * Shortcut Manager
 * Manages global keyboard shortcuts
 */

import { globalShortcut } from 'electron';
import { WindowManager } from '../windows/WindowManager';

export class ShortcutManager {
  private windowManager: WindowManager | null = null;

  /**
   * Set window manager reference
   */
  setWindowManager(windowManager: WindowManager): void {
    this.windowManager = windowManager;
  }

  /**
   * Register all global shortcuts
   */
  registerShortcuts(): void {
    // Unregister existing shortcuts first
    this.unregisterShortcuts();

    // Register Alt+Space to toggle floating ball
    const success = globalShortcut.register('Alt+Space', () => {
      if (!this.windowManager) return;

      const floatingBall = this.windowManager.getFloatingBallWindow();
      const ballState = this.windowManager.getFloatingBallState();

      if (floatingBall) {
        if (floatingBall.isVisible()) {
          if (ballState.isExpanded) {
            this.windowManager.toggleFloatingBallExpanded();
          }
          floatingBall.hide();
        } else {
          floatingBall.show();
          floatingBall.focus();
        }
      }
    });

    if (success) {
      console.log('[Shortcut] Alt+Space registered');
    } else {
      console.error('[Shortcut] Failed to register Alt+Space');
    }
  }

  /**
   * Unregister all shortcuts
   */
  unregisterShortcuts(): void {
    globalShortcut.unregisterAll();
    console.log('[Shortcut] All shortcuts unregistered');
  }

  /**
   * Check if a shortcut is registered
   */
  isRegistered(accelerator: string): boolean {
    return globalShortcut.isRegistered(accelerator);
  }
}

/**
 * Singleton instance
 */
let shortcutManagerInstance: ShortcutManager | null = null;

export function getShortcutManager(): ShortcutManager {
  if (!shortcutManagerInstance) {
    shortcutManagerInstance = new ShortcutManager();
  }
  return shortcutManagerInstance;
}
