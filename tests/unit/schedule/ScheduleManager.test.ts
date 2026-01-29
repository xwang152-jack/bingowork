/**
 * ScheduleManager Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScheduleManager } from '../../../electron/agent/schedule/ScheduleManager';
import { TaskDatabase } from '../../../electron/config/TaskDatabase';
import { AgentRuntime } from '../../../electron/agent/AgentRuntime';
import { ScheduleType, ScheduleStatus, type ScheduleTask } from '../../../electron/agent/schedule/types';

// Mock TaskDatabase
vi.mock('../../../electron/config/TaskDatabase', () => ({
  TaskDatabase: vi.fn(() => ({
    setKV: vi.fn(),
    getKV: vi.fn(),
    deleteKV: vi.fn(),
    getKVByPrefix: vi.fn(() => new Map()),
  })),
}));

// Mock AgentRuntime
const mockAgent = {
  processUserMessage: vi.fn(),
  executeToolDirectly: vi.fn(),
} as unknown as AgentRuntime;

// Mock BrowserWindow
const mockWindow = {
  isDestroyed: vi.fn(() => false),
  webContents: {
    send: vi.fn(),
  },
} as any;

describe('ScheduleManager', () => {
  let scheduleManager: ScheduleManager;
  let mockTaskDb: TaskDatabase;

  beforeEach(() => {
    mockTaskDb = new TaskDatabase(':memory:');
    scheduleManager = new ScheduleManager(mockTaskDb);
    scheduleManager.setAgent(mockAgent);
    scheduleManager.setMainWindow(mockWindow);
    vi.useFakeTimers();
  });

  afterEach(() => {
    scheduleManager.cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create an interval task', async () => {
      const taskData = {
        name: 'Test Interval Task',
        description: 'Test description',
        type: ScheduleType.INTERVAL,
        schedule: {
          interval: { value: 5, unit: 'minutes' as const },
        },
        task: {
          type: 'message' as const,
          message: 'Hello from scheduler',
        },
        maxRetries: 3,
        retryInterval: 60000,
        timeout: 300000,
        requireConfirmation: false,
      };

      const task = await scheduleManager.createTask(taskData);

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.name).toBe('Test Interval Task');
      expect(task.status).toBe(ScheduleStatus.ACTIVE);
      expect(task.executionCount).toBe(0);
      expect(task.failureCount).toBe(0);
      expect(mockTaskDb.setKV).toHaveBeenCalled();
    });

    it('should create a cron task', async () => {
      const taskData = {
        name: 'Test Cron Task',
        type: ScheduleType.CRON,
        schedule: {
          cron: '0 */5 * * *',
        },
        task: {
          type: 'message' as const,
          message: 'Cron test',
        },
        maxRetries: 3,
        retryInterval: 60000,
        timeout: 300000,
        requireConfirmation: false,
      };

      const task = await scheduleManager.createTask(taskData);

      expect(task).toBeDefined();
      expect(task.type).toBe(ScheduleType.CRON);
      expect(task.schedule.cron).toBe('0 */5 * * *');
    });

    it('should create a once task', async () => {
      const futureTime = Date.now() + 3600000; // 1 hour from now
      const taskData = {
        name: 'Test Once Task',
        type: ScheduleType.ONCE,
        schedule: {
          onceAt: futureTime,
        },
        task: {
          type: 'message' as const,
          message: 'Once test',
        },
        maxRetries: 0,
        retryInterval: 60000,
        timeout: 300000,
        requireConfirmation: false,
      };

      const task = await scheduleManager.createTask(taskData);

      expect(task).toBeDefined();
      expect(task.type).toBe(ScheduleType.ONCE);
      expect(task.schedule.onceAt).toBe(futureTime);
    });

    it('should reject invalid interval task', async () => {
      const taskData = {
        name: 'Invalid Task',
        type: ScheduleType.INTERVAL,
        schedule: {
          interval: { value: -1, unit: 'minutes' as const },
        },
        task: {
          type: 'message' as const,
          message: 'Test',
        },
        maxRetries: 3,
        retryInterval: 60000,
        timeout: 300000,
        requireConfirmation: false,
      };

      await expect(scheduleManager.createTask(taskData)).rejects.toThrow();
    });

    it('should reject invalid cron expression', async () => {
      const taskData = {
        name: 'Invalid Cron Task',
        type: ScheduleType.CRON,
        schedule: {
          cron: 'invalid',
        },
        task: {
          type: 'message' as const,
          message: 'Test',
        },
        maxRetries: 3,
        retryInterval: 60000,
        timeout: 300000,
        requireConfirmation: false,
      };

      await expect(scheduleManager.createTask(taskData)).rejects.toThrow();
    });
  });

  describe('updateTask', () => {
    it('should update an existing task', async () => {
      // First create a task
      const taskData = {
        name: 'Original Name',
        type: ScheduleType.INTERVAL,
        schedule: {
          interval: { value: 5, unit: 'minutes' as const },
        },
        task: {
          type: 'message' as const,
          message: 'Test',
        },
        maxRetries: 3,
        retryInterval: 60000,
        timeout: 300000,
        requireConfirmation: false,
      };

      const created = await scheduleManager.createTask(taskData);

      // Mock the getKV to return the created task
      vi.mocked(mockTaskDb.getKV).mockResolvedValue(created);

      // Update the task
      const updated = await scheduleManager.updateTask(created.id, {
        name: 'Updated Name',
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Name');
    });

    it('should return null for non-existent task', async () => {
      vi.mocked(mockTaskDb.getKV).mockResolvedValue(null);

      const updated = await scheduleManager.updateTask('non-existent-id', {
        name: 'New Name',
      });

      expect(updated).toBeNull();
    });
  });

  describe('deleteTask', () => {
    it('should delete an existing task', async () => {
      const taskData = {
        name: 'Task to Delete',
        type: ScheduleType.INTERVAL,
        schedule: {
          interval: { value: 5, unit: 'minutes' as const },
        },
        task: {
          type: 'message' as const,
          message: 'Test',
        },
        maxRetries: 3,
        retryInterval: 60000,
        timeout: 300000,
        requireConfirmation: false,
      };

      const created = await scheduleManager.createTask(taskData);

      // Mock getKV to return the task
      vi.mocked(mockTaskDb.getKV).mockResolvedValue(created);

      const deleted = await scheduleManager.deleteTask(created.id);

      expect(deleted).toBe(true);
      expect(mockTaskDb.deleteKV).toHaveBeenCalled();
    });

    it('should return false for non-existent task', async () => {
      vi.mocked(mockTaskDb.getKV).mockResolvedValue(null);

      const deleted = await scheduleManager.deleteTask('non-existent-id');

      expect(deleted).toBe(false);
    });
  });

  describe('toggleTask', () => {
    it('should toggle active task to paused', async () => {
      const taskData = {
        name: 'Toggle Test',
        type: ScheduleType.INTERVAL,
        schedule: {
          interval: { value: 5, unit: 'minutes' as const },
        },
        task: {
          type: 'message' as const,
          message: 'Test',
        },
        maxRetries: 3,
        retryInterval: 60000,
        timeout: 300000,
        requireConfirmation: false,
      };

      const created = await scheduleManager.createTask(taskData);

      // Mock getKV to return the created task
      vi.mocked(mockTaskDb.getKV).mockResolvedValue(created);

      const toggled = await scheduleManager.toggleTask(created.id);

      expect(toggled).toBeDefined();
      expect(toggled?.status).toBe(ScheduleStatus.PAUSED);
    });
  });

  describe('start and cleanup', () => {
    it('should start the schedule manager', async () => {
      await scheduleManager.start();

      expect(scheduleManager['isStarted']).toBe(true);
    });

    it('should cleanup resources', () => {
      scheduleManager.cleanup();

      expect(scheduleManager['isStarted']).toBe(false);
      expect(scheduleManager['runningTasks'].size).toBe(0);
    });
  });

  describe('executeNow', () => {
    it('should execute a message task', async () => {
      const taskData = {
        name: 'Execute Now Test',
        type: ScheduleType.INTERVAL,
        schedule: {
          interval: { value: 5, unit: 'minutes' as const },
        },
        task: {
          type: 'message' as const,
          message: 'Test message',
        },
        maxRetries: 3,
        retryInterval: 60000,
        timeout: 300000,
        requireConfirmation: false,
      };

      const created = await scheduleManager.createTask(taskData);

      // Mock getKV to return the created task
      vi.mocked(mockTaskDb.getKV).mockResolvedValue(created);

      // Mock agent method
      vi.mocked(mockAgent.processUserMessage).mockResolvedValue();

      const result = await scheduleManager.executeNow(created.id);

      expect(mockAgent.processUserMessage).toHaveBeenCalledWith('Test message');
      expect(result).toBeDefined();
    });

    it('should execute a tool task', async () => {
      const taskData = {
        name: 'Execute Tool Test',
        type: ScheduleType.INTERVAL,
        schedule: {
          interval: { value: 5, unit: 'minutes' as const },
        },
        task: {
          type: 'tool' as const,
          tool: {
            name: 'test_tool',
            args: { param1: 'value1' },
          },
        },
        maxRetries: 3,
        retryInterval: 60000,
        timeout: 300000,
        requireConfirmation: false,
      };

      const created = await scheduleManager.createTask(taskData);

      // Mock getKV to return the created task
      vi.mocked(mockTaskDb.getKV).mockResolvedValue(created);

      // Mock agent method
      vi.mocked(mockAgent.executeToolDirectly).mockResolvedValue('Tool executed');

      const result = await scheduleManager.executeNow(created.id);

      expect(mockAgent.executeToolDirectly).toHaveBeenCalledWith('test_tool', { param1: 'value1' });
      expect(result).toBe('Tool executed');
    });

    it('should throw error for non-existent task', async () => {
      vi.mocked(mockTaskDb.getKV).mockResolvedValue(null);

      await expect(scheduleManager.executeNow('non-existent-id')).rejects.toThrow('Task not found');
    });
  });
});
