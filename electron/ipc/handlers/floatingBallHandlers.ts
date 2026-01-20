/**
 * Floating Ball IPC handlers
 * Handles all IPC communication related to the floating ball window
 */

import { ipcMain } from 'electron';
import { FLOATING_BALL_CHANNELS } from '../../constants/IpcChannels';
import { getWindowManager } from '../../windows/WindowManager';

/**
 * Register all floating ball related IPC handlers
 */
export function registerFloatingBallHandlers(): void {
  const windowManager = getWindowManager();

  // Toggle floating ball expanded/collapsed state
  ipcMain.handle(FLOATING_BALL_CHANNELS.TOGGLE, () => {
    windowManager.toggleFloatingBallExpanded();
  });

  // Show main window from floating ball
  ipcMain.handle(FLOATING_BALL_CHANNELS.SHOW_MAIN, () => {
    windowManager.showMainWindow();
  });

  // Start drag operation (no-op, drag is handled via move)
  ipcMain.handle(FLOATING_BALL_CHANNELS.START_DRAG, () => {
    // Drag is handled client-side with MOVE messages
  });

  // Move floating ball by delta
  ipcMain.handle(FLOATING_BALL_CHANNELS.MOVE, (_event, { deltaX, deltaY }: { deltaX: number; deltaY: number }) => {
    windowManager.moveFloatingBall(deltaX, deltaY);
  });
}
