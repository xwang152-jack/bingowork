import { Tool } from '@anthropic-ai/sdk/resources/messages';
import { getScheduleManager } from '../schedule/ScheduleManager';
import { logs } from '../../utils/logger';
import { ScheduleTask, ScheduleType } from '../schedule/types';

/**
 * Tool schema for listing schedule tasks
 */
export const ListScheduleTasksSchema: Tool = {
    name: "list_schedule_tasks",
    description: "List all scheduled tasks. Use this when the user asks to see their scheduled tasks, timers, or automation jobs.",
    input_schema: {
        type: "object",
        properties: {
            status: {
                type: "string",
                enum: ["active", "paused", "completed", "failed", "all"],
                description: "Filter tasks by status. Use 'all' to show all tasks regardless of status. Defaults to 'all'."
            }
        }
    }
};

/**
 * Tool schema for executing a schedule task by ID
 */
export const ExecuteScheduleTaskSchema: Tool = {
    name: "execute_schedule_task",
    description: "Execute a scheduled task immediately by its ID. Use this when the user wants to run a specific task now instead of waiting for its scheduled time.",
    input_schema: {
        type: "object",
        properties: {
            taskId: {
                type: "string",
                description: "The unique ID of the task to execute."
            }
        },
        required: ["taskId"]
    }
};

/**
 * Tool schema for executing a schedule task by name
 */
export const ExecuteScheduleTaskByNameSchema: Tool = {
    name: "execute_schedule_task_by_name",
    description: "Find and execute a scheduled task by its name. Use this when the user refers to a task by name (e.g., 'run the daily report task', 'execute the backup job'). This is more user-friendly than using task IDs.",
    input_schema: {
        type: "object",
        properties: {
            taskName: {
                type: "string",
                description: "The name of the task to execute. This will search for tasks with matching names (case-insensitive partial match)."
            }
        },
        required: ["taskName"]
    }
};

/**
 * Tool schema for creating a new schedule task
 */
export const CreateScheduleTaskSchema: Tool = {
    name: "create_schedule_task",
    description: "Create a new scheduled task. Use this when the user wants to set up a new automation, timer, or recurring task. Supports interval-based, cron-based, and one-time execution.",
    input_schema: {
        type: "object",
        properties: {
            name: {
                type: "string",
                description: "The name of the task (e.g., 'Daily Backup', 'Hourly Report')."
            },
            description: {
                type: "string",
                description: "Optional description of what the task does."
            },
            scheduleType: {
                type: "string",
                enum: ["interval", "cron", "once"],
                description: "Type of schedule: 'interval' for regular intervals, 'cron' for cron expressions, 'once' for one-time execution."
            },
            intervalValue: {
                type: "number",
                description: "For interval type: the numeric value (e.g., 5 for '5 minutes'). Must be positive."
            },
            intervalUnit: {
                type: "string",
                enum: ["seconds", "minutes", "hours", "days"],
                description: "For interval type: the time unit (seconds, minutes, hours, days)."
            },
            cronExpression: {
                type: "string",
                description: "For cron type: cron expression (e.g., '0 */5 * * *' for every 5 minutes). Format: minute hour day month weekday."
            },
            executeAt: {
                type: "string",
                description: "For once type: ISO 8601 datetime string when to execute (e.g., '2026-01-30T10:00:00+08:00')."
            },
            taskType: {
                type: "string",
                enum: ["message", "tool"],
                description: "Type of task to execute: 'message' to send a message to AI, 'tool' to execute a specific tool."
            },
            message: {
                type: "string",
                description: "For message type: the message content to send to AI when task executes."
            },
            toolName: {
                type: "string",
                description: "For tool type: the name of the tool to execute (e.g., 'read_file', 'run_command')."
            },
            toolArgs: {
                type: "object",
                description: "For tool type: arguments to pass to the tool as a JSON object."
            },
            maxRetries: {
                type: "number",
                description: "Maximum number of retry attempts on failure. Defaults to 3."
            },
            timeout: {
                type: "number",
                description: "Task timeout in milliseconds. Defaults to 300000 (5 minutes)."
            }
        },
        required: ["name", "scheduleType", "taskType"]
    }
};

/**
 * Export all schedule tool schemas
 */
export const ScheduleToolSchemas = [
    ListScheduleTasksSchema,
    ExecuteScheduleTaskSchema,
    ExecuteScheduleTaskByNameSchema,
    CreateScheduleTaskSchema
];

/**
 * ScheduleTools class - Provides tools for interacting with scheduled tasks
 */
export class ScheduleTools {
    /**
     * List all scheduled tasks
     */
    async listScheduleTasks(args: { status?: string }): Promise<string> {
        const scheduleManager = getScheduleManager();
        if (!scheduleManager) {
            return "Error: Schedule manager is not initialized.";
        }

        try {
            const allTasks = await scheduleManager.listTasks();

            // Filter by status if specified
            let tasks = allTasks;
            if (args.status && args.status !== 'all') {
                tasks = allTasks.filter(task => task.status === args.status);
            }

            if (tasks.length === 0) {
                const statusMsg = args.status && args.status !== 'all'
                    ? ` with status '${args.status}'`
                    : '';
                return `No scheduled tasks found${statusMsg}.`;
            }

            // Format tasks for display
            const taskList = tasks.map((task, index) => {
                const scheduleInfo = this.formatScheduleInfo(task);
                const nextExecution = task.nextExecutionAt
                    ? new Date(task.nextExecutionAt).toLocaleString('zh-CN')
                    : 'N/A';
                const lastExecution = task.lastExecutedAt
                    ? new Date(task.lastExecutedAt).toLocaleString('zh-CN')
                    : 'Never';

                return `${index + 1}. **${task.name}** (ID: ${task.id})
   - Status: ${task.status}
   - Type: ${scheduleInfo}
   - Next execution: ${nextExecution}
   - Last execution: ${lastExecution}
   - Execution count: ${task.executionCount}
   - Description: ${task.description || 'N/A'}`;
            }).join('\n\n');

            return `Found ${tasks.length} scheduled task(s):\n\n${taskList}`;
        } catch (error) {
            logs.schedule.error('[ScheduleTools] Error listing tasks:', error);
            return `Error listing tasks: ${(error as Error).message}`;
        }
    }

    /**
     * Execute a scheduled task by ID
     */
    async executeScheduleTask(args: { taskId: string }): Promise<string> {
        const scheduleManager = getScheduleManager();
        if (!scheduleManager) {
            return "Error: Schedule manager is not initialized.";
        }

        try {
            // Check if task exists
            const task = await scheduleManager.getTask(args.taskId);
            if (!task) {
                return `Error: Task with ID '${args.taskId}' not found.`;
            }

            // Execute the task
            logs.schedule.info(`[ScheduleTools] Executing task: ${task.name} (${args.taskId})`);
            const result = await scheduleManager.executeNow(args.taskId);

            return `Successfully executed task '${task.name}' (ID: ${args.taskId}).\n\nResult: ${result}`;
        } catch (error) {
            logs.schedule.error('[ScheduleTools] Error executing task:', error);
            return `Error executing task: ${(error as Error).message}`;
        }
    }

    /**
     * Execute a scheduled task by name
     */
    async executeScheduleTaskByName(args: { taskName: string }): Promise<string> {
        const scheduleManager = getScheduleManager();
        if (!scheduleManager) {
            return "Error: Schedule manager is not initialized.";
        }

        try {
            // Search for tasks with matching names
            const allTasks = await scheduleManager.listTasks();
            const searchTerm = args.taskName.toLowerCase();
            const matchingTasks = allTasks.filter(task =>
                task.name.toLowerCase().includes(searchTerm)
            );

            if (matchingTasks.length === 0) {
                return `Error: No tasks found matching '${args.taskName}'.`;
            }

            if (matchingTasks.length > 1) {
                const taskList = matchingTasks.map((task, index) =>
                    `${index + 1}. ${task.name} (ID: ${task.id})`
                ).join('\n');
                return `Multiple tasks found matching '${args.taskName}':\n${taskList}\n\nPlease use execute_schedule_task with a specific task ID instead.`;
            }

            // Execute the single matching task
            const task = matchingTasks[0];
            logs.schedule.info(`[ScheduleTools] Executing task by name: ${task.name} (${task.id})`);
            const result = await scheduleManager.executeNow(task.id);

            return `Successfully executed task '${task.name}' (ID: ${task.id}).\n\nResult: ${result}`;
        } catch (error) {
            logs.schedule.error('[ScheduleTools] Error executing task by name:', error);
            return `Error executing task: ${(error as Error).message}`;
        }
    }

    /**
     * Create a new scheduled task
     */
    async createScheduleTask(args: {
        name: string;
        description?: string;
        scheduleType: 'interval' | 'cron' | 'once';
        intervalValue?: number;
        intervalUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
        cronExpression?: string;
        executeAt?: string;
        taskType: 'message' | 'tool';
        message?: string;
        toolName?: string;
        toolArgs?: Record<string, unknown>;
        maxRetries?: number;
        timeout?: number;
    }): Promise<string> {
        const scheduleManager = getScheduleManager();
        if (!scheduleManager) {
            return "Error: Schedule manager is not initialized.";
        }

        try {
            // Validate required fields based on schedule type
            if (args.scheduleType === 'interval') {
                if (!args.intervalValue || !args.intervalUnit) {
                    return "Error: For interval schedule, both intervalValue and intervalUnit are required.";
                }
                if (args.intervalValue <= 0) {
                    return "Error: intervalValue must be positive.";
                }
            } else if (args.scheduleType === 'cron') {
                if (!args.cronExpression) {
                    return "Error: For cron schedule, cronExpression is required.";
                }
            } else if (args.scheduleType === 'once') {
                if (!args.executeAt) {
                    return "Error: For once schedule, executeAt is required.";
                }
            }

            // Validate task content
            if (args.taskType === 'message') {
                if (!args.message) {
                    return "Error: For message task, message content is required.";
                }
            } else if (args.taskType === 'tool') {
                if (!args.toolName) {
                    return "Error: For tool task, toolName is required.";
                }
            }

            // Build schedule configuration
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const schedule: any = {};
            if (args.scheduleType === 'interval') {
                schedule.interval = {
                    value: args.intervalValue!,
                    unit: args.intervalUnit!
                };
            } else if (args.scheduleType === 'cron') {
                schedule.cron = args.cronExpression;
            } else if (args.scheduleType === 'once') {
                // Parse ISO datetime string to timestamp
                const executeTime = new Date(args.executeAt!).getTime();
                if (isNaN(executeTime)) {
                    return `Error: Invalid datetime format for executeAt: ${args.executeAt}`;
                }
                if (executeTime <= Date.now()) {
                    return "Error: Execution time must be in the future.";
                }
                schedule.onceAt = executeTime;
            }

            // Build task content
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const taskContent: any = {
                type: args.taskType
            };
            if (args.taskType === 'message') {
                taskContent.message = args.message;
            } else {
                taskContent.tool = {
                    name: args.toolName!,
                    args: args.toolArgs || {}
                };
            }

            // Create the task
            const newTask = await scheduleManager.createTask({
                name: args.name,
                description: args.description,
                type: args.scheduleType as ScheduleType,
                schedule,
                task: taskContent,
                maxRetries: args.maxRetries ?? 3,
                retryInterval: 60000, // 1 minute
                timeout: args.timeout ?? 300000, // 5 minutes
                requireConfirmation: false
            });

            const scheduleInfo = this.formatScheduleInfo(newTask);
            const nextExecution = newTask.nextExecutionAt
                ? new Date(newTask.nextExecutionAt).toLocaleString('zh-CN')
                : 'N/A';

            return `Successfully created task '${newTask.name}' (ID: ${newTask.id})\n\n` +
                `Schedule: ${scheduleInfo}\n` +
                `Next execution: ${nextExecution}\n` +
                `Status: ${newTask.status}\n\n` +
                `The task has been created and will execute automatically according to the schedule.`;
        } catch (error) {
            logs.schedule.error('[ScheduleTools] Error creating task:', error);
            return `Error creating task: ${(error as Error).message}`;
        }
    }

    /**
     * Format schedule information for display
     */
    private formatScheduleInfo(task: ScheduleTask): string {
        switch (task.type) {
            case 'interval':
                if (task.schedule.interval) {
                    const { value, unit } = task.schedule.interval;
                    const unitText = {
                        milliseconds: '毫秒',
                        seconds: '秒',
                        minutes: '分钟',
                        hours: '小时',
                        days: '天',
                    }[unit];
                    return `Interval (every ${value} ${unitText})`;
                }
                return 'Interval';
            case 'cron':
                return `Cron (${task.schedule.cron || 'N/A'})`;
            case 'once':
                return 'Once';
            default:
                return 'Unknown';
        }
    }
}
