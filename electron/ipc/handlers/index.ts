/**
 * IPC Handler Registry
 * Central registration point for all IPC handlers
 */

import { registerAgentHandlers, setAgentInstance } from './agentHandlers';
import { registerSessionHandlers } from './sessionHandlers';
import { registerConfigHandlers, setTaskDatabase } from './configHandlers';
import { registerModelHandlers } from './modelHandlers';
import { registerWindowHandlers } from './windowHandlers';
import { registerDialogHandlers } from './dialogHandlers';
import { registerPermissionHandlers } from './permissionHandlers';
import { registerMCPHandlers, setAgentInstance as setMCPAgentInstance } from './mcpHandlers';
import { registerSkillsHandlers } from './skillsHandlers';
import { registerFloatingBallHandlers } from './floatingBallHandlers';
import { registerShellHandlers } from './shellHandlers';
import type { TaskDatabase } from '../../config/TaskDatabase';

/**
 * Register all IPC handlers
 * Call this during app initialization
 */
export function registerAllIPCHandlers(taskDb: TaskDatabase | null): void {
  registerAgentHandlers();
  registerSessionHandlers();
  registerConfigHandlers();
  registerModelHandlers(taskDb);
  registerWindowHandlers();
  registerDialogHandlers();
  registerPermissionHandlers();
  registerMCPHandlers();
  registerSkillsHandlers();
  registerFloatingBallHandlers();
  registerShellHandlers();
}

// Export instance setters
export { setAgentInstance, setTaskDatabase };

/**
 * Set agent instance for all handlers that need it
 */
export function setAgent(agentInstance: any): void {
  setAgentInstance(agentInstance);
  setMCPAgentInstance(agentInstance);
}

/**
 * Set main window instance
 */
export { setMainWindow } from './windowHandlers';
