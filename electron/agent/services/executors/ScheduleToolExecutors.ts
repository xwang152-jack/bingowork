/**
 * Schedule Tool Executors
 *
 * Implements schedule management tools for executing scheduled tasks via natural language
 */

import {
    ToolExecutor,
    ToolExecutionContext,
    ToolInput,
    ToolResult,
    BaseToolExecutor
} from '../ToolExecutor';
import Anthropic from '@anthropic-ai/sdk';
import { ScheduleTools } from '../../tools/ScheduleTools';

// ============================================================================
// list_schedule_tasks Tool
// ============================================================================

const ListScheduleTasksSchema: Anthropic.Tool = {
    name: 'list_schedule_tasks',
    description: 'List all scheduled tasks. Use this when the user asks to see their scheduled tasks, timers, or automation jobs.',
    input_schema: {
        type: 'object',
        properties: {
            status: {
                type: 'string',
                enum: ['active', 'paused', 'completed', 'failed', 'all'],
                description: "Filter tasks by status. Use 'all' to show all tasks regardless of status. Defaults to 'all'."
            }
        }
    }
};

class ListScheduleTasksExecutor extends BaseToolExecutor {
    readonly name = 'list_schedule_tasks';
    readonly schema = ListScheduleTasksSchema;
    private scheduleTools = new ScheduleTools();

    isAllowedInMode(_mode: 'chat' | 'code' | 'cowork'): boolean {
        return true; // Available in all modes
    }

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        const args = input as { status?: string };
        return await this.scheduleTools.listScheduleTasks(args);
    }
}

// ============================================================================
// execute_schedule_task Tool
// ============================================================================

const ExecuteScheduleTaskSchema: Anthropic.Tool = {
    name: 'execute_schedule_task',
    description: 'Execute a scheduled task immediately by its ID. Use this when the user wants to run a specific task now instead of waiting for its scheduled time.',
    input_schema: {
        type: 'object',
        properties: {
            taskId: {
                type: 'string',
                description: 'The unique ID of the task to execute.'
            }
        },
        required: ['taskId']
    }
};

class ExecuteScheduleTaskExecutor extends BaseToolExecutor {
    readonly name = 'execute_schedule_task';
    readonly schema = ExecuteScheduleTaskSchema;
    private scheduleTools = new ScheduleTools();

    isAllowedInMode(_mode: 'chat' | 'code' | 'cowork'): boolean {
        return true; // Available in all modes
    }

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        const args = input as { taskId: string };

        if (!args.taskId || typeof args.taskId !== 'string') {
            return 'Error: taskId parameter is required and must be a string.';
        }

        return await this.scheduleTools.executeScheduleTask(args);
    }
}

// ============================================================================
// execute_schedule_task_by_name Tool
// ============================================================================

const ExecuteScheduleTaskByNameSchema: Anthropic.Tool = {
    name: 'execute_schedule_task_by_name',
    description: 'Find and execute a scheduled task by its name. Use this when the user refers to a task by name (e.g., "run the daily report task", "execute the backup job"). This is more user-friendly than using task IDs.',
    input_schema: {
        type: 'object',
        properties: {
            taskName: {
                type: 'string',
                description: 'The name of the task to execute. This will search for tasks with matching names (case-insensitive partial match).'
            }
        },
        required: ['taskName']
    }
};

class ExecuteScheduleTaskByNameExecutor extends BaseToolExecutor {
    readonly name = 'execute_schedule_task_by_name';
    readonly schema = ExecuteScheduleTaskByNameSchema;
    private scheduleTools = new ScheduleTools();

    isAllowedInMode(_mode: 'chat' | 'code' | 'cowork'): boolean {
        return true; // Available in all modes
    }

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        const args = input as { taskName: string };

        if (!args.taskName || typeof args.taskName !== 'string') {
            return 'Error: taskName parameter is required and must be a string.';
        }

        return await this.scheduleTools.executeScheduleTaskByName(args);
    }
}

// ============================================================================
// create_schedule_task Tool
// ============================================================================

const CreateScheduleTaskSchema: Anthropic.Tool = {
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

class CreateScheduleTaskExecutor extends BaseToolExecutor {
    readonly name = 'create_schedule_task';
    readonly schema = CreateScheduleTaskSchema;
    private scheduleTools = new ScheduleTools();

    isAllowedInMode(_mode: 'chat' | 'code' | 'cowork'): boolean {
        return true; // Available in all modes
    }

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        const args = input as any;

        // Basic validation
        if (!args.name || !args.scheduleType || !args.taskType) {
            return 'Error: name, scheduleType, and taskType are required fields.';
        }

        return await this.scheduleTools.createScheduleTask(args);
    }
}

// ============================================================================
// Export
// ============================================================================

export const scheduleToolExecutors: ToolExecutor[] = [
    new ListScheduleTasksExecutor(),
    new ExecuteScheduleTaskExecutor(),
    new ExecuteScheduleTaskByNameExecutor(),
    new CreateScheduleTaskExecutor()
];

export {
    ListScheduleTasksSchema,
    ExecuteScheduleTaskSchema,
    ExecuteScheduleTaskByNameSchema,
    CreateScheduleTaskSchema
};
