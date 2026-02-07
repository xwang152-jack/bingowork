/**
 * ScheduleManager
 * Core service for managing scheduled tasks
 */

import * as cron from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { nanoid } from 'nanoid';
import { BrowserWindow } from 'electron';
import { TaskDatabase } from '../../config/TaskDatabase';
import { AgentRuntime } from '../AgentRuntime';
import { logs } from '../../utils/logger';
import {
  ScheduleTask,
  ScheduleType,
  ScheduleStatus,
  getTaskKey,
  calculateNextExecution,
  validateScheduleConfig,
  ScheduleExecutionLog,
  SCHEDULE_STORAGE_PREFIX,
} from './types';

/**
 * Configuration constants
 */
const CONFIG = {
  MAX_CONCURRENT_TASKS: 3,
  CHECK_INTERVAL_MS: 1000, // Check every second
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_RETRY_INTERVAL: 60000, // 1 minute
  DEFAULT_TIMEOUT: 300000, // 5 minutes
} as const;

/**
 * Running task tracker
 */
interface RunningTask {
  taskId: string;
  startTime: number;
  timeout: NodeJS.Timeout | null;
}

/**
 * ScheduleManager class
 */
export class ScheduleManager {
  private taskDb: TaskDatabase;
  private agent: AgentRuntime | null = null;
  private mainWindow: BrowserWindow | null = null;
  private isStarted = false;
  private checkTimer: NodeJS.Timeout | null = null;
  private runningTasks = new Map<string, RunningTask>();
  private intervalTimers = new Map<string, NodeJS.Timeout>();
  private cronTasks = new Map<string, cron.ScheduledTask>();

  constructor(taskDb: TaskDatabase) {
    this.taskDb = taskDb;
  }
  // ... (omitting strictly unchanged methods to keep replacement concise, but here I need to target imports at top too) 
  // The tool replacer works on chunks. I'll split into two chunks if needed, or just one if contiguous?
  // Checks: Imports are at top, getLogsByTaskId is middle.
  // I will do two edits. One for imports, one for getLogs.

  /**
   * Set the agent instance for task execution
   */
  setAgent(agent: AgentRuntime | null): void {
    this.agent = agent;
  }

  /**
   * Set the main window for IPC broadcasts
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * Start the schedule manager
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logs.schedule.warn('ScheduleManager already started');
      return;
    }

    logs.schedule.info('Starting ScheduleManager...');
    this.isStarted = true;

    // Load and start all active tasks
    await this.loadActiveTasks();

    // Recover stuck tasks from previous session
    try {
      const recoveredCount = this.taskDb.recoverStuckExecutionLogs();
      if (recoveredCount > 0) {
        logs.schedule.info(`Recovered ${recoveredCount} stuck execution logs`);
      }
    } catch (error) {
      logs.schedule.error('Failed to recover stuck execution logs:', error);
    }

    // Cleanup old logs (older than 7 days)
    try {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const deletedCount = this.taskDb.cleanupExecutionLogs(sevenDaysAgo);
      if (deletedCount > 0) {
        logs.schedule.info(`Cleaned up ${deletedCount} old execution logs`);
      }
    } catch (error) {
      logs.schedule.error('Failed to cleanup old execution logs:', error);
    }

    // Start the check timer
    this.startCheckTimer();

    logs.schedule.info('ScheduleManager started');
  }

  /**
   * Stop the schedule manager and cleanup
   */
  cleanup(): void {
    logs.schedule.info('Cleaning up ScheduleManager...');

    // Stop check timer
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }

    // Clear all interval timers
    for (const timer of this.intervalTimers.values()) {
      clearTimeout(timer);
    }
    this.intervalTimers.clear();

    // Stop all cron tasks
    for (const task of this.cronTasks.values()) {
      task.stop();
    }
    this.cronTasks.clear();

    // Cancel running task timeouts
    for (const running of this.runningTasks.values()) {
      if (running.timeout) {
        clearTimeout(running.timeout);
      }
    }
    this.runningTasks.clear();

    this.isStarted = false;
    logs.schedule.info('ScheduleManager cleaned up');
  }

  /**
   * Create a new scheduled task
   */
  async createTask(task: Omit<ScheduleTask, 'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'failureCount' | 'status'>): Promise<ScheduleTask> {
    const validationError = validateScheduleConfig(task.type, task.schedule);
    if (validationError) {
      throw new Error(validationError);
    }

    const newTask: ScheduleTask = {
      ...task,
      id: nanoid(),
      status: ScheduleStatus.ACTIVE,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      executionCount: 0,
      failureCount: 0,
    };

    // Calculate initial next execution time
    if (task.type === ScheduleType.ONCE && task.schedule.onceAt) {
      newTask.nextExecutionAt = task.schedule.onceAt;
    } else if (task.type === ScheduleType.INTERVAL && task.schedule.interval) {
      const nextTime = calculateNextExecution(newTask);
      newTask.nextExecutionAt = nextTime ?? undefined;
    } else if (task.type === ScheduleType.CRON && task.schedule.cron) {
      try {
        const interval = CronExpressionParser.parse(task.schedule.cron);
        newTask.nextExecutionAt = interval.next().getTime();
      } catch (error) {
        throw new Error(`Invalid cron expression: ${(error as Error).message}`);
      }
    }

    // Save to database
    this.taskDb.setKV(getTaskKey(newTask.id), newTask);

    // Start scheduling if already started
    if (this.isStarted && newTask.status === ScheduleStatus.ACTIVE) {
      await this.scheduleTask(newTask);
    }

    // Broadcast creation event
    this.broadcast('schedule:task-created', newTask);

    logs.schedule.info(`Created task: ${newTask.name} (${newTask.id})`);
    return newTask;
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, updates: Partial<Omit<ScheduleTask, 'id' | 'createdAt' | 'executionCount' | 'failureCount'>>): Promise<ScheduleTask | null> {
    const task = await this.getTask(taskId);
    if (!task) {
      return null;
    }

    const validationError = updates.type && updates.schedule ? validateScheduleConfig(updates.type, updates.schedule) : null;
    if (validationError) {
      throw new Error(validationError);
    }

    const updatedTask: ScheduleTask = {
      ...task,
      ...updates,
      id: task.id, // Ensure ID doesn't change
      createdAt: task.createdAt, // Preserve creation time
      updatedAt: Date.now(),
    };

    // Recalculate next execution if schedule changed
    if (updates.schedule || updates.type) {
      if (updatedTask.type === ScheduleType.ONCE && updatedTask.schedule.onceAt) {
        updatedTask.nextExecutionAt = updatedTask.schedule.onceAt;
      } else if (updatedTask.type === ScheduleType.INTERVAL && updatedTask.schedule.interval) {
        const nextTime = calculateNextExecution(updatedTask);
        updatedTask.nextExecutionAt = nextTime ?? undefined;
      } else if (updatedTask.type === ScheduleType.CRON && updatedTask.schedule.cron) {
        try {
          const interval = CronExpressionParser.parse(updatedTask.schedule.cron);
          updatedTask.nextExecutionAt = interval.next().getTime();
        } catch (error) {
          throw new Error(`Invalid cron expression: ${(error as Error).message}`);
        }
      }
    }

    // Save to database
    this.taskDb.setKV(getTaskKey(updatedTask.id), updatedTask);

    // Reschedule if active
    if (this.isStarted) {
      // Stop existing scheduling
      this.unscheduleTask(task.id);

      // Start new scheduling if active
      if (updatedTask.status === ScheduleStatus.ACTIVE) {
        await this.scheduleTask(updatedTask);
      }
    }

    // Broadcast update event
    this.broadcast('schedule:task-updated', updatedTask);

    logs.schedule.info(`Updated task: ${updatedTask.name} (${updatedTask.id})`);
    return updatedTask;
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<boolean> {
    const task = await this.getTask(taskId);
    if (!task) {
      return false;
    }

    // Stop scheduling
    this.unscheduleTask(taskId);

    // Delete from database
    this.taskDb.deleteKV(getTaskKey(taskId));

    // Delete associated logs
    this.taskDb.deleteExecutionLogs(taskId);

    // Broadcast deletion event
    this.broadcast('schedule:task-deleted', { id: taskId });

    logs.schedule.info(`Deleted task: ${task.name} (${taskId})`);
    return true;
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string): Promise<ScheduleTask | null> {
    return this.taskDb.getKV<ScheduleTask>(getTaskKey(taskId));
  }

  /**
   * List all tasks
   */
  async listTasks(): Promise<ScheduleTask[]> {
    const tasksMap = this.taskDb.getKVByPrefix<ScheduleTask>(SCHEDULE_STORAGE_PREFIX);
    return Array.from(tasksMap.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Toggle task status (active/paused)
   */
  async toggleTask(taskId: string): Promise<ScheduleTask | null> {
    const task = await this.getTask(taskId);
    if (!task) {
      return null;
    }

    const newStatus = task.status === ScheduleStatus.ACTIVE ? ScheduleStatus.PAUSED : ScheduleStatus.ACTIVE;
    return this.updateTask(taskId, { status: newStatus });
  }

  /**
   * Execute a task immediately
   */
  async executeNow(taskId: string): Promise<string> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (this.runningTasks.has(taskId)) {
      throw new Error('Task is already running');
    }

    if (this.runningTasks.size >= CONFIG.MAX_CONCURRENT_TASKS) {
      throw new Error('Maximum concurrent tasks reached');
    }

    return this.executeTask(task);
  }

  /**
   * Get execution logs for a task
   */
  async getLogsByTaskId(taskId: string): Promise<ScheduleExecutionLog[]> {
    return this.taskDb.getExecutionLogs(taskId) as unknown as ScheduleExecutionLog[];
  }

  /**
   * Get all execution logs
   */
  async getAllLogs(): Promise<ScheduleExecutionLog[]> {
    return this.taskDb.getExecutionLogs(null) as unknown as ScheduleExecutionLog[];
  }

  /**
   * Load and start all active tasks
   */
  private async loadActiveTasks(): Promise<void> {
    const tasks = await this.listTasks();
    const activeTasks = tasks.filter(t => t.status === ScheduleStatus.ACTIVE);

    logs.schedule.info(`Loading ${activeTasks.length} active tasks`);

    for (const task of activeTasks) {
      await this.scheduleTask(task);
    }
  }

  /**
   * Start scheduling a task
   */
  private async scheduleTask(task: ScheduleTask): Promise<void> {
    // Clear any existing scheduling for this task
    this.unscheduleTask(task.id);

    const now = Date.now();

    switch (task.type) {
      case ScheduleType.INTERVAL:
        await this.scheduleIntervalTask(task);
        break;

      case ScheduleType.CRON:
        await this.scheduleCronTask(task);
        break;

      case ScheduleType.ONCE:
        if (task.nextExecutionAt && task.nextExecutionAt > now) {
          const delay = task.nextExecutionAt - now;
          const timer = setTimeout(() => {
            this.executeTask(task).catch(err => {
              logs.schedule.error(`Error executing once task ${task.id}:`, err);
            });
          }, delay);
          this.intervalTimers.set(task.id, timer);
        }
        break;
    }
  }

  /**
   * Schedule an interval task
   */
  private async scheduleIntervalTask(task: ScheduleTask): Promise<void> {
    if (!task.schedule.interval) {
      return;
    }

    const { value, unit } = task.schedule.interval;
    const multiplier = {
      milliseconds: 1,
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
    };
    const intervalMs = value * multiplier[unit];

    // Calculate first execution time
    let delay = intervalMs;
    if (task.nextExecutionAt && task.nextExecutionAt > Date.now()) {
      delay = task.nextExecutionAt - Date.now();
    }

    const timer = setTimeout(() => {
      this.executeTask(task).catch(err => {
        logs.schedule.error(`Error executing interval task ${task.id}:`, err);
      });

      // Reschedule next execution
      this.scheduleIntervalTask(task).catch(err => {
        logs.schedule.error(`Error rescheduling interval task ${task.id}:`, err);
      });
    }, delay);

    this.intervalTimers.set(task.id, timer);
  }

  /**
   * Schedule a cron task
   */
  private async scheduleCronTask(task: ScheduleTask): Promise<void> {
    if (!task.schedule.cron) {
      return;
    }

    try {
      // node-cron uses a different API - we create the task and start it manually
      const cronTask = cron.schedule(task.schedule.cron, () => {
        this.executeTask(task).catch(err => {
          logs.schedule.error(`Error executing cron task ${task.id}:`, err);
        });
      });

      this.cronTasks.set(task.id, cronTask);
    } catch (error) {
      logs.schedule.error(`Failed to schedule cron task ${task.id}:`, error);
    }
  }

  /**
   * Stop scheduling a task
   */
  private unscheduleTask(taskId: string): void {
    // Clear interval timer
    const intervalTimer = this.intervalTimers.get(taskId);
    if (intervalTimer) {
      clearTimeout(intervalTimer);
      this.intervalTimers.delete(taskId);
    }

    // Stop cron task
    const cronTask = this.cronTasks.get(taskId);
    if (cronTask) {
      cronTask.stop();
      this.cronTasks.delete(taskId);
    }
  }

  /**
   * Start the check timer
   */
  private startCheckTimer(): void {
    const check = () => {
      this.checkAndExecuteTasks();
      this.checkTimer = setTimeout(check, CONFIG.CHECK_INTERVAL_MS);
    };
    this.checkTimer = setTimeout(check, CONFIG.CHECK_INTERVAL_MS);
  }

  /**
   * Check and execute tasks that are due
   */
  private async checkAndExecuteTasks(): Promise<void> {
    const now = Date.now();
    const tasks = await this.listTasks();
    const activeTasks = tasks.filter(t => t.status === ScheduleStatus.ACTIVE && !this.runningTasks.has(t.id));

    for (const task of activeTasks) {
      if (this.runningTasks.size >= CONFIG.MAX_CONCURRENT_TASKS) {
        break;
      }

      // Check if task is due (for CRON tasks that need manual checking)
      if (task.nextExecutionAt && task.nextExecutionAt <= now) {
        if (task.type === ScheduleType.CRON && !this.cronTasks.has(task.id)) {
          // CRON task that's not yet scheduled
          await this.executeTask(task);
        }
      }
    }
  }

  /**
   * Execute a task
   */
  private async executeTask(task: ScheduleTask): Promise<string> {
    if (!this.agent) {
      throw new Error('Agent not available');
    }

    if (this.runningTasks.has(task.id)) {
      throw new Error('Task is already running');
    }

    // Create execution log
    const logId = nanoid();
    const log: ScheduleExecutionLog = {
      id: logId,
      taskId: task.id,
      startedAt: Date.now(),
      status: 'running',
    };
    this.taskDb.insertExecutionLog(log);

    // Track running task
    const runningTask: RunningTask = {
      taskId: task.id,
      startTime: Date.now(),
      timeout: null,
    };

    try {
      this.runningTasks.set(task.id, runningTask);

      // Set timeout
      if (task.timeout > 0) {
        runningTask.timeout = setTimeout(() => {
          this.handleTaskTimeout(task.id, logId);
        }, task.timeout);
      }

      // Execute based on task content type
      let result = '';
      if (task.task.type === 'message') {
        // Send message to agent
        if (task.task.images && task.task.images.length > 0) {
          await this.agent.processUserMessage({
            content: task.task.message,
            images: task.task.images,
          });
        } else {
          await this.agent.processUserMessage(task.task.message);
        }
        result = 'Message sent to agent successfully';
      } else if (task.task.type === 'tool') {
        // Execute tool directly
        result = await this.agent.executeToolDirectly(task.task.tool.name, task.task.tool.args);
      }

      // Update task stats
      const updatedTask = await this.getTask(task.id);
      if (updatedTask) {
        updatedTask.lastExecutedAt = Date.now();
        updatedTask.executionCount = updatedTask.executionCount + 1;
        updatedTask.failureCount = 0;
        updatedTask.updatedAt = Date.now();
        this.taskDb.setKV(getTaskKey(updatedTask.id), updatedTask);
      }

      // Update log
      log.completedAt = Date.now();
      log.status = 'success';
      log.result = result;
      this.taskDb.updateExecutionLog(log);

      // Calculate next execution time
      if (task.type === ScheduleType.INTERVAL && task.schedule.interval) {
        const nextTask = await this.getTask(task.id);
        if (nextTask) {
          const nextExecutionAt = calculateNextExecution(nextTask);
          if (nextExecutionAt) {
            await this.updateTask(task.id, { nextExecutionAt });
          }
        }
      } else if (task.type === ScheduleType.ONCE) {
        // Mark as completed
        await this.updateTask(task.id, { status: ScheduleStatus.COMPLETED });
      } else if (task.type === ScheduleType.CRON && task.schedule.cron) {
        try {
          const interval = CronExpressionParser.parse(task.schedule.cron);
          const nextExecutionAt = interval.next().getTime();
          await this.updateTask(task.id, { nextExecutionAt });
        } catch {
          // Failed to parse, keep existing
        }
      }

      // Broadcast execution event
      this.broadcast('schedule:task-executed', { taskId: task.id, logId, result });

      logs.schedule.info(`Executed task: ${task.name} (${task.id})`);
      return result;

    } catch (error) {
      const errorMessage = (error as Error).message;

      // Update task stats
      const updatedTask = await this.getTask(task.id);
      if (updatedTask) {
        updatedTask.failureCount = (updatedTask.failureCount || 0) + 1;
        updatedTask.updatedAt = Date.now();

        // Check if should mark as failed
        if (updatedTask.failureCount >= updatedTask.maxRetries) {
          updatedTask.status = ScheduleStatus.FAILED;
        }

        this.taskDb.setKV(getTaskKey(updatedTask.id), updatedTask);
      }

      // Update log
      log.completedAt = Date.now();
      log.status = 'failed';
      log.error = errorMessage;
      this.taskDb.updateExecutionLog(log);

      // Broadcast failure event
      this.broadcast('schedule:task-failed', { taskId: task.id, logId, error: errorMessage });

      logs.schedule.error(`Task execution failed: ${task.name} (${task.id}):`, error);
      throw error;

    } finally {
      // Clear timeout
      if (runningTask.timeout) {
        clearTimeout(runningTask.timeout);
      }

      // Remove from running tasks
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(taskId: string, logId: string): void {
    logs.schedule.warn(`Task timeout: ${taskId}`);

    // Update log - we need to fetch it first or just update blind?
    // updateExecutionLog only needs id and status...
    // But the method in TaskDatabase takes a partial/full object.
    // Let's create a minimal object for update
    const logUpdate = {
      id: logId,
      status: 'timeout',
      completedAt: Date.now(),
      error: 'Task execution timeout'
    };

    this.taskDb.updateExecutionLog(logUpdate);

    // Remove from running tasks
    this.runningTasks.delete(taskId);

    // Broadcast timeout event
    this.broadcast('schedule:task-failed', { taskId, logId, error: 'Task execution timeout' });
  }

  /**
   * Broadcast event to renderer process
   */
  private broadcast(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}

/**
 * Singleton instance
 */
let scheduleManagerInstance: ScheduleManager | null = null;

export function getScheduleManager(): ScheduleManager | null {
  return scheduleManagerInstance;
}

export function setScheduleManager(instance: ScheduleManager): void {
  scheduleManagerInstance = instance;
}

export function clearScheduleManager(): void {
  scheduleManagerInstance = null;
}

/**
 * Initialize and register the ScheduleManager singleton
 */
export function initializeScheduleManager(taskDb: TaskDatabase): ScheduleManager {
  if (!scheduleManagerInstance) {
    scheduleManagerInstance = new ScheduleManager(taskDb);
  }
  return scheduleManagerInstance;
}
