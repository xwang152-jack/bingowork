/**
 * Core Tool Executors
 *
 * Implements core tools: ask_user_question, todo_write
 */

import {
    ToolExecutor,
    ToolExecutionContext,
    ToolInput,
    ToolResult,
    BaseToolExecutor
} from '../ToolExecutor';
import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// ask_user_question Tool
// ============================================================================

const AskUserQuestionSchema: Anthropic.Tool = {
    name: 'ask_user_question',
    description: 'Ask the user a question to clarify their request or get additional information needed to complete a task.',
    input_schema: {
        type: 'object',
        properties: {
            question: {
                type: 'string',
                description: 'The question to ask the user. Be clear and specific.'
            },
            options: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional list of choices for the user to select from. If not provided, the user can type any response.'
            }
        },
        required: ['question']
    }
};

class AskUserQuestionExecutor extends BaseToolExecutor {
    readonly name = 'ask_user_question';
    readonly schema = AskUserQuestionSchema;

    isAllowedInMode(_mode: 'chat' | 'code' | 'cowork'): boolean {
        return true; // Available in all modes
    }

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        const args = input as { question: string; options?: string[] };

        if (!args.question || typeof args.question !== 'string') {
            return 'Error: question parameter is required and must be a string.';
        }

        // This is handled via IPC, so we need to emit an event
        // The actual implementation will be provided by the caller
        throw new Error('ask_user_question requires special handling - use context callbacks');
    }
}

// ============================================================================
// todo_write Tool
// ============================================================================

const TodoWriteSchema: Anthropic.Tool = {
    name: 'todo_write',
    description: `**CRITICAL: MANDATORY FOR MULTI-STEP TASKS**

    Create and manage a task list for tracking progress on complex workflows.

    WHEN YOU MUST USE THIS TOOL (MANDATORY):
    - Tasks with 3+ steps or operations
    - Multiple file operations (read/write/create several files)
    - Complex workflows requiring multiple phases
    - Component/module/feature creation
    - Refactoring, migration, or setup work
    - Any task estimated to take >2 minutes

    WHEN TO SKIP (Simple tasks):
    - Simple questions requiring single response
    - Single file read operations
    - Trivial fixes (<10 seconds)
    - Informational queries

    This is NOT optional for complex tasks - users expect progress tracking.`,
    input_schema: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['add', 'update', 'delete', 'list'],
                description: 'The action to perform on the todo list.'
            },
            path: {
                type: 'string',
                description: 'Optional path to the todo JSON file. If not provided, uses the default path in the first authorized folder.'
            },
            content: {
                type: 'string',
                description: 'The todo item content (for add/update actions).'
            },
            status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed'],
                description: 'The status of the todo item (for update action).'
            },
            activeForm: {
                type: 'string',
                description: 'Present continuous form of the action (e.g., "Creating file").'
            }
        },
        required: ['action']
    }
};

class TodoWriteExecutor extends BaseToolExecutor {
    readonly name = 'todo_write';
    readonly schema = TodoWriteSchema;

    isAllowedInMode(mode: 'chat' | 'code' | 'cowork'): boolean {
        return mode === 'cowork'; // Only available in cowork mode
    }

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        const args = input as { action: string; path?: string; content?: string };

        // Import CoreTools dynamically to avoid circular dependency
        const { permissionManager } = await import('../../security/PermissionManager');
        const authorizedFolders = permissionManager.getAuthorizedFolders();
        const defaultPath = authorizedFolders.length > 0
            ? `${authorizedFolders[0]}/.bingowork-todo.json`
            : undefined;

        const { CoreTools } = await import('../../tools/CoreTools');
        const coreTools = new CoreTools();

        return await coreTools.todoWrite({
            action: args.action,
            path: args.path,
            content: args.content || ''
        }, defaultPath);
    }
}

// ============================================================================
// Export
// ============================================================================

export const coreToolExecutors: ToolExecutor[] = [
    new AskUserQuestionExecutor(),
    new TodoWriteExecutor()
];

export { AskUserQuestionSchema, TodoWriteSchema };
