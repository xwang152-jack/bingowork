/**
 * Schedule IPC Handlers
 * Handle IPC communication for scheduled task management
 */

import { ipcMain } from 'electron';
import { ScheduleManager } from '../../agent/schedule/ScheduleManager';
import { SCHEDULE_CHANNELS } from '../../constants/IpcChannels';
import { logs } from '../../utils/logger';
import {
  createErrorResponse,
  IpcErrorCode,
  withIpcErrorHandling,
} from '../types/IpcResponse';

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
      return createErrorResponse(
        IpcErrorCode.NOT_INITIALIZED,
        'ScheduleManager not initialized'
      );
    }

    return withIpcErrorHandling(async () => {
      return await scheduleManager!.listTasks();
    }, IpcErrorCode.SCHEDULE_TASK_ERROR)();
  });

  // Get a single task
  ipcMain.handle(SCHEDULE_CHANNELS.GET, async (_event, taskId: string) => {
    if (!scheduleManager) {
      return createErrorResponse(
        IpcErrorCode.NOT_INITIALIZED,
        'ScheduleManager not initialized'
      );
    }

    return withIpcErrorHandling(async () => {
      return await scheduleManager!.getTask(taskId);
    }, IpcErrorCode.SCHEDULE_TASK_ERROR)();
  });

  // Create a new task
  ipcMain.handle(SCHEDULE_CHANNELS.CREATE, async (_event, taskData) => {
    if (!scheduleManager) {
      return createErrorResponse(
        IpcErrorCode.NOT_INITIALIZED,
        'ScheduleManager not initialized'
      );
    }

    return withIpcErrorHandling(async () => {
      return await scheduleManager!.createTask(taskData);
    }, IpcErrorCode.SCHEDULE_TASK_ERROR)();
  });

  // Update an existing task
  ipcMain.handle(SCHEDULE_CHANNELS.UPDATE, async (_event, taskId: string, updates) => {
    if (!scheduleManager) {
      return createErrorResponse(
        IpcErrorCode.NOT_INITIALIZED,
        'ScheduleManager not initialized'
      );
    }

    return withIpcErrorHandling(async () => {
      return await scheduleManager!.updateTask(taskId, updates);
    }, IpcErrorCode.SCHEDULE_TASK_ERROR)();
  });

  // Delete a task
  ipcMain.handle(SCHEDULE_CHANNELS.DELETE, async (_event, taskId: string) => {
    if (!scheduleManager) {
      return createErrorResponse(
        IpcErrorCode.NOT_INITIALIZED,
        'ScheduleManager not initialized'
      );
    }

    return withIpcErrorHandling(async () => {
      return await scheduleManager!.deleteTask(taskId);
    }, IpcErrorCode.SCHEDULE_TASK_ERROR)();
  });

  // Toggle task status
  ipcMain.handle(SCHEDULE_CHANNELS.TOGGLE, async (_event, taskId: string) => {
    if (!scheduleManager) {
      return createErrorResponse(
        IpcErrorCode.NOT_INITIALIZED,
        'ScheduleManager not initialized'
      );
    }

    return withIpcErrorHandling(async () => {
      return await scheduleManager!.toggleTask(taskId);
    }, IpcErrorCode.SCHEDULE_TASK_ERROR)();
  });

  // Execute task immediately
  ipcMain.handle(SCHEDULE_CHANNELS.EXECUTE_NOW, async (_event, taskId: string) => {
    if (!scheduleManager) {
      return createErrorResponse(
        IpcErrorCode.NOT_INITIALIZED,
        'ScheduleManager not initialized'
      );
    }

    return withIpcErrorHandling(async () => {
      return await scheduleManager!.executeNow(taskId);
    }, IpcErrorCode.SCHEDULE_TASK_ERROR)();
  });

  // Get logs for a task
  ipcMain.handle(SCHEDULE_CHANNELS.GET_LOGS, async (_event, taskId: string) => {
    if (!scheduleManager) {
      return createErrorResponse(
        IpcErrorCode.NOT_INITIALIZED,
        'ScheduleManager not initialized'
      );
    }

    return withIpcErrorHandling(async () => {
      return await scheduleManager!.getLogsByTaskId(taskId);
    }, IpcErrorCode.SCHEDULE_TASK_ERROR)();
  });

  // Get all logs
  ipcMain.handle(SCHEDULE_CHANNELS.GET_ALL_LOGS, async () => {
    if (!scheduleManager) {
      return createErrorResponse(
        IpcErrorCode.NOT_INITIALIZED,
        'ScheduleManager not initialized'
      );
    }

    return withIpcErrorHandling(async () => {
      return await scheduleManager!.getAllLogs();
    }, IpcErrorCode.SCHEDULE_TASK_ERROR)();
  });

  logs.schedule.info('Schedule IPC handlers registered');
}
