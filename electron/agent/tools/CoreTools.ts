import { Tool } from '@anthropic-ai/sdk/resources/messages';
import * as fs from 'fs/promises';
import * as path from 'path';

export const AskUserQuestionSchema: Tool = {
    name: "ask_user_question",
    description: "Use this tool to ask the user a question when you need clarification or more information to proceed. This is preferred over just asking in the text response because it signals a blocking state.",
    input_schema: {
        type: "object",
        properties: {
            question: { type: "string", description: "The question to ask the user." },
            options: {
                type: "array",
                items: { type: "string" },
                description: "Optional list of choices for the user to select from."
            }
        },
        required: ["question"]
    }
};

export const TodoWriteSchema: Tool = {
    name: "todo_write",
    description: "Manage a TODO list for the current task. Adds, updates, or completes items in a TODO.md file in the workspace.",
    input_schema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["add", "complete", "update", "overwrite"],
                description: "The action to perform on the todo list."
            },
            path: {
                type: "string",
                description: "Absolute path to the TODO file. Defaults to TODO.md in the primary authorized folder if not provided."
            },
            content: {
                type: "string",
                description: "The content to add or the new content for overwrite. For 'complete', this can be the item text to mark as done."
            }
        },
        required: ["action", "content"]
    }
};

export const CoreToolSchemas = [AskUserQuestionSchema, TodoWriteSchema];

export class CoreTools {
    async askUserQuestion(args: { question: string, options?: string[] }): Promise<string> {
        // In a real implementation, this might emit an event to the frontend to show a specific UI.
        // For now, we return a string that instructs the Agent to stop and wait.
        // The AgentRuntime might interpret this tool call specifically.

        let response = `[User Question Triggered]\nQuestion: ${args.question}`;
        if (args.options && args.options.length > 0) {
            response += `\nOptions: ${args.options.join(', ')}`;
        }
        return response + `\n\nSYSTEM INSTRUCTION: The user has been notified. Please stop generating and wait for the user's response in the chat.`;
    }

    async todoWrite(args: { action: string, path?: string, content: string }, defaultPath?: string): Promise<string> {
        const todoPath = args.path || (defaultPath ? path.join(defaultPath, 'TODO.md') : null);

        if (!todoPath) {
            return "Error: No path provided and no default working directory available.";
        }

        let currentContent = "";
        try {
            currentContent = await fs.readFile(todoPath, 'utf-8');
        } catch (e) {
            // File doesn't exist, start empty
        }

        let newContent = currentContent;

        if (args.action === 'overwrite') {
            newContent = args.content;
        } else if (args.action === 'add') {
            newContent += `\n- [ ] ${args.content}`;
        } else if (args.action === 'complete') {
            // Simple string matching to mark as done
            newContent = newContent.replace(`- [ ] ${args.content}`, `- [x] ${args.content}`);
        } else {
            // For update or complex logic, we might need a better parser.
            // For now, suggest overwrite for complex edits.
            return "For complex updates, please use action='overwrite' with the full new content.";
        }

        // Ensure directory exists
        await fs.mkdir(path.dirname(todoPath), { recursive: true });
        await fs.writeFile(todoPath, newContent, 'utf-8');

        // Broadcast todo update to all windows
        try {
            const { BrowserWindow } = await import('electron');
            const { TODO_CHANNELS } = await import('../../constants/IpcChannels');
            const todoList = {
                items: this.parseTodoContent(newContent),
                sourcePath: todoPath,
                exists: true,
                lastModified: Date.now()
            };

            BrowserWindow.getAllWindows().forEach((win) => {
                if (!win.isDestroyed()) {
                    win.webContents.send(TODO_CHANNELS.UPDATED, todoList);
                }
            });
        } catch (error) {
            console.error('[CoreTools] Failed to broadcast todo update:', error);
        }

        return `Todo updated successfully at ${todoPath}`;
    }

    private parseTodoContent(content: string): Array<{ text: string; completed: boolean }> {
        const lines = content.split('\n');
        const items: Array<{ text: string; completed: boolean }> = [];

        for (const line of lines) {
            const trimmed = line.trim();
            const match = trimmed.match(/^[-*+]\s*\[([ xX])\]\s*(.+)$/);
            if (match) {
                items.push({
                    text: match[2].trim(),
                    completed: match[1].toLowerCase() === 'x',
                });
            }
        }

        return items;
    }
}
