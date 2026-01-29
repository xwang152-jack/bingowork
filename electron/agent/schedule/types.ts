/**
 * Schedule Types
 * Type definitions for the scheduled task system
 */

/**
 * Schedule type enumeration
 */
export enum ScheduleType {
  INTERVAL = 'interval',  // Execute at regular intervals
  CRON = 'cron',          // Execute using cron expression
  ONCE = 'once',          // Execute once at specific time
}

/**
 * Task status enumeration
 */
export enum ScheduleStatus {
  ACTIVE = 'active',      // Task is active and will execute
  PAUSED = 'paused',      // Task is paused and won't execute
  COMPLETED = 'completed',// Task completed (for ONCE tasks)
  FAILED = 'failed',      // Task failed after max retries
}

/**
 * Interval configuration
 */
export interface IntervalConfig {
  value: number;
  unit: 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days';
}

/**
 * Schedule configuration
 */
export interface ScheduleConfig {
  /** Interval configuration (for INTERVAL type) */
  interval?: IntervalConfig;
  /** Cron expression (for CRON type) */
  cron?: string;
  /** Unix timestamp for one-time execution (for ONCE type) */
  onceAt?: number;
}

/**
 * Task content types
 */
export interface MessageTaskContent {
  type: 'message';
  message: string;
  images?: string[];
}

export interface ToolTaskContent {
  type: 'tool';
  tool: {
    name: string;
    args: Record<string, unknown>;
  };
}

export type TaskContent = MessageTaskContent | ToolTaskContent;

/**
 * Scheduled task
 */
export interface ScheduleTask {
  /** Unique task identifier */
  id: string;
  /** Task name */
  name: string;
  /** Optional description */
  description?: string;
  /** Schedule type */
  type: ScheduleType;
  /** Schedule configuration */
  schedule: ScheduleConfig;
  /** Task content to execute */
  task: TaskContent;
  /** Current status */
  status: ScheduleStatus;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Last execution timestamp */
  lastExecutedAt?: number;
  /** Next execution timestamp */
  nextExecutionAt?: number;
  /** Number of times executed */
  executionCount: number;
  /** Number of failures */
  failureCount: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Retry interval in milliseconds */
  retryInterval: number;
  /** Task timeout in milliseconds */
  timeout: number;
  /** Whether to require user confirmation before execution */
  requireConfirmation: boolean;
  /** Optional session ID for message tasks */
  sessionId?: string;
}

/**
 * Execution log status
 */
export type ExecutionLogStatus = 'running' | 'success' | 'failed' | 'timeout';

/**
 * Execution log entry
 */
export interface ScheduleExecutionLog {
  /** Unique log identifier */
  id: string;
  /** Associated task ID */
  taskId: string;
  /** Execution start timestamp */
  startedAt: number;
  /** Execution completion timestamp */
  completedAt?: number;
  /** Execution status */
  status: ExecutionLogStatus;
  /** Execution result (for success) */
  result?: string;
  /** Error message (for failure) */
  error?: string;
}

/**
 * Storage keys for KV store
 */
export const SCHEDULE_STORAGE_PREFIX = 'schedule:task:';
export const LOG_STORAGE_PREFIX = 'schedule:log:';

/**
 * Get task storage key
 */
export function getTaskKey(taskId: string): string {
  return `${SCHEDULE_STORAGE_PREFIX}${taskId}`;
}

/**
 * Get log storage key
 */
export function getLogKey(logId: string): string {
  return `${LOG_STORAGE_PREFIX}${logId}`;
}

/**
 * Calculate next execution time based on schedule configuration
 */
export function calculateNextExecution(task: ScheduleTask, baseTime: number = Date.now()): number | null {
  const { type, schedule } = task;

  switch (type) {
    case ScheduleType.INTERVAL:
      if (schedule.interval) {
        const { value, unit } = schedule.interval;
        const multiplier = {
          milliseconds: 1,
          seconds: 1000,
          minutes: 60 * 1000,
          hours: 60 * 60 * 1000,
          days: 24 * 60 * 60 * 1000,
        };
        return baseTime + (value * multiplier[unit]);
      }
      return null;

    case ScheduleType.ONCE:
      // For ONCE tasks, return the scheduled time or null if passed
      return schedule.onceAt && schedule.onceAt > baseTime ? schedule.onceAt : null;

    case ScheduleType.CRON:
      // CRON calculation is done separately using cron-parser
      // This returns null to indicate external calculation is needed
      return null;

    default:
      return null;
  }
}

/**
 * Validate schedule configuration
 */
export function validateScheduleConfig(type: ScheduleType, schedule: ScheduleConfig): string | null {
  switch (type) {
    case ScheduleType.INTERVAL:
      if (!schedule.interval) {
        return 'Interval configuration is required for INTERVAL type';
      }
      if (schedule.interval.value <= 0) {
        return 'Interval value must be positive';
      }
      break;

    case ScheduleType.CRON:
      if (!schedule.cron) {
        return 'Cron expression is required for CRON type';
      }
      // Basic validation - more detailed validation happens during parsing
      if (!schedule.cron.match(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+/)) {
        return 'Invalid cron expression format';
      }
      break;

    case ScheduleType.ONCE:
      if (!schedule.onceAt) {
        return 'Execution time is required for ONCE type';
      }
      if (schedule.onceAt <= Date.now()) {
        return 'Execution time must be in the future';
      }
      break;

    default:
      return `Unknown schedule type: ${type}`;
  }

  return null;
}
