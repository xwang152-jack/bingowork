/**
 * Unit tests for CoreTools
 */

// Mock electron before any imports
import { vi } from 'vitest';
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/test-userdata'),
    isPackaged: false,
  },
}));

// Mock fs module
vi.mock('fs/promises', () => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
}));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CoreTools } from '../CoreTools';
import * as fs from 'fs/promises';
import * as path from 'path';

// Get mocked functions
const mockReadFile = vi.mocked(fs.readFile);
const mockWriteFile = vi.mocked(fs.writeFile);
const mockMkdir = vi.mocked(fs.mkdir);

describe('CoreTools', () => {
    let coreTools: CoreTools;

    beforeEach(() => {
        coreTools = new CoreTools();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Tool Schemas', () => {
        it('should have AskUserQuestionSchema with correct structure', async () => {
            const { AskUserQuestionSchema } = await import('../CoreTools');

            expect(AskUserQuestionSchema.name).toBe('ask_user_question');
            expect(AskUserQuestionSchema.description).toContain('ask the user a question');
            expect(AskUserQuestionSchema.input_schema.type).toBe('object');
            expect(AskUserQuestionSchema.input_schema.required).toEqual(['question']);
        });

        it('should have TodoWriteSchema with correct structure', async () => {
            const { TodoWriteSchema } = await import('../CoreTools');

            expect(TodoWriteSchema.name).toBe('todo_write');
            expect(TodoWriteSchema.description).toContain('TODO list');
            expect(TodoWriteSchema.input_schema.required).toEqual(['action', 'content']);
            expect(TodoWriteSchema.input_schema.properties.action.enum).toEqual(['add', 'complete', 'update', 'overwrite']);
        });

        it('should export CoreToolSchemas array', async () => {
            const { CoreToolSchemas } = await import('../CoreTools');

            expect(CoreToolSchemas).toHaveLength(2);
            expect(CoreToolSchemas[0].name).toBe('ask_user_question');
            expect(CoreToolSchemas[1].name).toBe('todo_write');
        });
    });

    describe('askUserQuestion', () => {
        it('should return formatted response with question', async () => {
            const result = await coreTools.askUserQuestion({ question: 'What is your name?' });

            expect(result).toContain('[User Question Triggered]');
            expect(result).toContain('Question: What is your name?');
            expect(result).toContain('SYSTEM INSTRUCTION');
        });

        it('should include options when provided', async () => {
            const result = await coreTools.askUserQuestion({
                question: 'Choose a color',
                options: ['Red', 'Blue', 'Green']
            });

            expect(result).toContain('Options: Red, Blue, Green');
        });

        it('should not include options when not provided', async () => {
            const result = await coreTools.askUserQuestion({ question: 'Simple question' });

            expect(result).not.toContain('Options:');
        });

        it('should handle empty options array', async () => {
            const result = await coreTools.askUserQuestion({
                question: 'Question',
                options: []
            });

            expect(result).not.toContain('Options:');
        });
    });

    describe('todoWrite', () => {
        beforeEach(() => {
            // Setup default mocks
            mockMkdir.mockResolvedValue(undefined);
            mockWriteFile.mockResolvedValue(undefined);
        });

        it('should overwrite content when action is overwrite', async () => {
            mockReadFile.mockResolvedValue('old content');

            const result = await coreTools.todoWrite({
                action: 'overwrite',
                path: '/test/TODO.md',
                content: 'new content'
            });

            expect(result).toContain('Todo updated successfully');
            expect(mockWriteFile).toHaveBeenCalledWith('/test/TODO.md', 'new content', 'utf-8');
        });

        it('should add content when action is add', async () => {
            mockReadFile.mockResolvedValue('Existing task');

            const result = await coreTools.todoWrite({
                action: 'add',
                path: '/test/TODO.md',
                content: 'New task'
            });

            expect(result).toContain('Todo updated successfully');
            expect(mockWriteFile).toHaveBeenCalledWith('/test/TODO.md', 'Existing task\n- [ ] New task', 'utf-8');
        });

        it('should complete task when action is complete', async () => {
            mockReadFile.mockResolvedValue('- [ ] Task to complete\n- [ ] Another task');

            const result = await coreTools.todoWrite({
                action: 'complete',
                path: '/test/TODO.md',
                content: 'Task to complete'
            });

            expect(result).toContain('Todo updated successfully');
            expect(mockWriteFile).toHaveBeenCalledWith('/test/TODO.md', '- [x] Task to complete\n- [ ] Another task', 'utf-8');
        });

        it('should handle file not found gracefully when adding', async () => {
            mockReadFile.mockRejectedValue(new Error('File not found'));

            const result = await coreTools.todoWrite({
                action: 'add',
                path: '/test/TODO.md',
                content: 'First task'
            });

            expect(result).toContain('Todo updated successfully');
            expect(mockWriteFile).toHaveBeenCalledWith('/test/TODO.md', '\n- [ ] First task', 'utf-8');
        });

        it('should return error message for update action', async () => {
            const result = await coreTools.todoWrite({
                action: 'update',
                path: '/test/TODO.md',
                content: 'Some content'
            });

            expect(result).toContain('For complex updates');
            expect(result).toContain("action='overwrite'");
        });

        it('should create directory if it does not exist', async () => {
            mockReadFile.mockResolvedValue('');
            mockMkdir.mockResolvedValue(undefined);

            await coreTools.todoWrite({
                action: 'overwrite',
                path: '/test/nested/dir/TODO.md',
                content: 'content'
            });

            expect(mockMkdir).toHaveBeenCalledWith('/test/nested/dir', { recursive: true });
        });

        it('should use default path when path not provided and defaultPath is given', async () => {
            mockReadFile.mockResolvedValue('');

            const result = await coreTools.todoWrite({
                action: 'add',
                content: 'Task with default path'
            }, '/default/dir');

            expect(result).toContain('Todo updated successfully');
            expect(mockWriteFile).toHaveBeenCalledWith(
                path.join('/default/dir', 'TODO.md'),
                '\n- [ ] Task with default path',
                'utf-8'
            );
        });

        it('should return error when no path provided and no defaultPath', async () => {
            const result = await coreTools.todoWrite({
                action: 'add',
                content: 'Task without path'
            });

            expect(result).toContain('Error: No path provided');
            expect(result).toContain('no default working directory available');
        });

        it('should handle empty file content on overwrite', async () => {
            mockReadFile.mockResolvedValue('old content');

            const result = await coreTools.todoWrite({
                action: 'overwrite',
                path: '/test/TODO.md',
                content: ''
            });

            expect(result).toContain('Todo updated successfully');
            expect(mockWriteFile).toHaveBeenCalledWith('/test/TODO.md', '', 'utf-8');
        });

        it('should not match incomplete task strings in complete action', async () => {
            mockReadFile.mockResolvedValue('- [ ] Task one\n- [ ] Task two');

            const result = await coreTools.todoWrite({
                action: 'complete',
                path: '/test/TODO.md',
                content: 'Task three' // Non-existent task
            });

            expect(result).toContain('Todo updated successfully');
            // Content should remain unchanged since no match found
            expect(mockWriteFile).toHaveBeenCalledWith('/test/TODO.md', '- [ ] Task one\n- [ ] Task two', 'utf-8');
        });
    });
});
