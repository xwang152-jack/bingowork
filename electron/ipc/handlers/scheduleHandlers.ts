/**
 * Schedule IPC Handlers
 * Handle IPC communication for scheduled task management
 */

import { ipcMain } from 'electron';
import { ScheduleManager } from '../../agent/schedule/ScheduleManager';
import { SCHEDULE_CHANNELS } from '../../constants/IpcChannels';
import { logs } from '../../utils/logger';

let scheduleManager: ScheduleManager | null = null;

/**
 * Set the schedule manager instance
 */
export function setScheduleManager(manager: ScheduleManager | null): void {
  scheduleManager = manager;
}

/**
 * Register all schedule-related IPC handlers
 */
export function registerScheduleHandlers(): void {
  // List all tasks
  ipcMain.handle(SCHEDULE_CHANNELS.LIST, async () => {
    if (!scheduleManager) {
      throw new Error('ScheduleManager not initialized');
    }
    try {
      return await scheduleManager.listTasks();
    } catch (error) {
      logs.schedule.error('[IPC] Error listing tasks:', error);
      throw error;
    }
  });

  // Get a single task
  ipcMain.handle(SCHEDULE_CHANNELS.GET, async (_event, taskId: string) => {
    if (!scheduleManager) {
      throw new Error('ScheduleManager not initialized');
    }
    try {
      return await scheduleManager.getTask(taskId);
    } catch (error) {
      logs.schedule.error('[IPC] Error getting task:', error);
      throw error;
    }
  });

  // Create a new task
  ipcMain.handle(SCHEDULE_CHANNELS.CREATE, async (_event, taskData) => {
    if (!scheduleManager) {
      throw new Error('ScheduleManager not initialized');
    }
    try {
      return await scheduleManager.createTask(taskData);
    } catch (error) {
      logs.schedule.error('[IPC] Error creating task:', error);
      throw error;
    }
  });

  // Update an existing task
  ipcMain.handle(SCHEDULE_CHANNELS.UPDATE, async (_event, taskId: string, updates) => {
    if (!scheduleManager) {
      throw new Error('ScheduleManager not initialized');
    }
    try {
      return await scheduleManager.updateTask(taskId, updates);
    } catch (error) {
      logs.schedule.error('[IPC] Error updating task:', error);
      throw error;
    }
  });

  // Delete a task
  ipcMain.handle(SCHEDULE_CHANNELS.DELETE, async (_event, taskId: string) => {
    if (!scheduleManager) {
      throw new Error('ScheduleManager not initialized');
    }
    try {
      return await scheduleManager.deleteTask(taskId);
    } catch (error) {
      logs.schedule.error('[IPC] Error deleting task:', error);
      throw error;
    }
  });

  // Toggle task status
  ipcMain.handle(SCHEDULE_CHANNELS.TOGGLE, async (_event, taskId: string) => {
    if (!scheduleManager) {
      throw new Error('ScheduleManager not initialized');
    }
    try {
      return await scheduleManager.toggleTask(taskId);
    } catch (error) {
      logs.schedule.error('[IPC] Error toggling task:', error);
      throw error;
    }
  });

  // Execute task immediately
  ipcMain.handle(SCHEDULE_CHANNELS.EXECUTE_NOW, async (_event, taskId: string) => {
    if (!scheduleManager) {
      throw new Error('ScheduleManager not initialized');
    }
    try {
      return await scheduleManager.executeNow(taskId);
    } catch (error) {
      logs.schedule.error('[IPC] Error executing task:', error);
      throw error;
    }
  });

  // Get logs for a task
  ipcMain.handle(SCHEDULE_CHANNELS.GET_LOGS, async (_event, taskId: string) => {
    if (!scheduleManager) {
      throw new Error('ScheduleManager not initialized');
    }
    try {
      return await scheduleManager.getLogsByTaskId(taskId);
    } catch (error) {
      logs.schedule.error('[IPC] Error getting logs:', error);
      throw error;
    }
  });

  // Get all logs
  ipcMain.handle(SCHEDULE_CHANNELS.GET_ALL_LOGS, async () => {
    if (!scheduleManager) {
      throw new Error('ScheduleManager not initialized');
    }
    try {
      return await scheduleManager.getAllLogs();
    } catch (error) {
      logs.schedule.error('[IPC] Error getting all logs:', error);
      throw error;
    }
  });

  logs.schedule.info('Schedule IPC handlers registered');
}
