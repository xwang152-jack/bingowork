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
    description: `**COLLABORATIVE MODE TASK TRACKING**

    Collaborative mode includes a TodoList tool for tracking progress.

    DEFAULT BEHAVIOR:
    Almost all tasks involving tool calls MUST use TodoWrite.
    Use this tool more frequently and loosely than suggested by typical tool standards.
    This is because it powers the collaborative UI component.

    WHEN TO SKIP:
    - Pure conversation (no tool usage)
    - User explicitly opts out

    SUGGESTED ORDER:
    Skill Check / Ask User -> TodoWrite -> Execute Work`,
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
        // Use the first authorized folder as default directory (TODO.md will be appended)
        const defaultDir = authorizedFolders.length > 0 ? authorizedFolders[0] : undefined;

        const { CoreTools } = await import('../../tools/CoreTools');
        const coreTools = new CoreTools();

        return await coreTools.todoWrite({
            action: args.action,
            path: args.path,
            content: args.content || ''
        }, defaultDir);
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
