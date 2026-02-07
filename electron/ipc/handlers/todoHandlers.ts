/**
 * Todo IPC Handlers
 *
 * Handles todo list operations including reading from authorized folders
 * and broadcasting updates to all windows.
 */

import { ipcMain, BrowserWindow } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { configStore } from '../../config/ConfigStore';
import { TODO_CHANNELS } from '../../constants/IpcChannels';
import type { TodoList, TodoItem } from '../../types/ipc';

/**
 * Parse TODO.md file content and extract todo items
 * Supports markdown checkbox format: - [x] or - [ ]
 */
function parseTodoContent(content: string): TodoItem[] {
  const lines = content.split('\n');
  const items: TodoItem[] = [];

  console.log(`[Todo] Parsing ${lines.length} lines`);

  for (const line of lines) {
    const trimmed = line.trim();
    // Match markdown checkbox format: - [x] text or - [ ] text
    // Improved regex to be more permissive:
    // - Allow optional space in brackets
    // - Allow empty text
    const match = trimmed.match(/^[-*+]\s*\[([ xX]?)\]\s*(.*)$/);

    if (match) {
      const isCompleted = match[1].toLowerCase() === 'x';
      // If bracket content is empty, it's incomplete
      // If bracket content is space, it's incomplete

      items.push({
        text: match[2].trim(),
        completed: isCompleted,
      });
    }
  }

  console.log(`[Todo] Parsed ${items.length} items`);
  return items;
}

/**
 * Convert todo items back to markdown format
 */
function itemsToMarkdown(items: TodoItem[]): string {
  return items
    .map(item => `- [${item.completed ? 'x' : ' '}] ${item.text}`)
    .join('\n');
}

/**
 * Get the default TODO.md path
 */
function getDefaultTodoPath(): string | null {
  const folders = configStore.getAll().authorizedFolders || [];
  if (folders.length === 0) return null;
  return path.join(folders[0], 'TODO.md');
}

/**
 * Read TODO.md from the first authorized folder
 */
async function readTodoFromAuthorizedFolder(): Promise<TodoList> {
  const folders = configStore.getAll().authorizedFolders || [];

  if (folders.length === 0) {
    return { items: [], sourcePath: '', exists: false };
  }

  const todoPath = path.join(folders[0], 'TODO.md');

  try {
    const content = await fs.readFile(todoPath, 'utf-8');
    console.log(`[Todo] Read file from: ${todoPath}, length: ${content.length}`);
    const items = parseTodoContent(content);
    const stats = await fs.stat(todoPath);
    return { items, sourcePath: todoPath, exists: true, lastModified: stats.mtimeMs };
  } catch {
    return { items: [], sourcePath: todoPath, exists: false };
  }
}

/**
 * Write todo items to TODO.md
 */
async function writeTodoItems(items: TodoItem[]): Promise<{ success: boolean; error?: string; path?: string }> {
  const todoPath = getDefaultTodoPath();
  if (!todoPath) {
    return { success: false, error: 'No authorized folder configured' };
  }

  try {
    const content = itemsToMarkdown(items);
    await fs.mkdir(path.dirname(todoPath), { recursive: true });
    await fs.writeFile(todoPath, content, 'utf-8');

    // Broadcast update
    const result: TodoList = {
      items,
      sourcePath: todoPath,
      exists: true,
      lastModified: Date.now()
    };

    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(TODO_CHANNELS.UPDATED, result);
      }
    });

    return { success: true, path: todoPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      path: todoPath
    };
  }
}

/**
 * Broadcast todo update to all windows
 */
function broadcastTodoUpdate(todoList: TodoList): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(TODO_CHANNELS.UPDATED, todoList);
    }
  });
}

/**
 * Register todo-related IPC handlers
 */
export function registerTodoHandlers(): void {
  // Get current todo list
  ipcMain.handle(TODO_CHANNELS.LIST, async () => {
    return await readTodoFromAuthorizedFolder();
  });

  // Refresh and broadcast todo list to all windows
  ipcMain.handle(TODO_CHANNELS.REFRESH, async () => {
    const result = await readTodoFromAuthorizedFolder();
    broadcastTodoUpdate(result);
    return result;
  });

  // Add a new todo item
  ipcMain.handle('todo:add', async (_event, content: string) => {
    const current = await readTodoFromAuthorizedFolder();
    const newItem: TodoItem = { text: content, completed: false };
    const updated = [...current.items, newItem];

    return await writeTodoItems(updated);
  });

  // Toggle todo completion status
  ipcMain.handle('todo:toggle', async (_event, index: number) => {
    const current = await readTodoFromAuthorizedFolder();
    if (index < 0 || index >= current.items.length) {
      return { success: false, error: 'Invalid todo index' };
    }

    const updated = current.items.map((item, i) =>
      i === index ? { ...item, completed: !item.completed } : item
    );

    return await writeTodoItems(updated);
  });

  // Update todo item text
  ipcMain.handle('todo:update', async (_event, index: number, text: string) => {
    const current = await readTodoFromAuthorizedFolder();
    if (index < 0 || index >= current.items.length) {
      return { success: false, error: 'Invalid todo index' };
    }

    const updated = current.items.map((item, i) =>
      i === index ? { ...item, text } : item
    );

    return await writeTodoItems(updated);
  });

  // Delete a todo item
  ipcMain.handle('todo:delete', async (_event, index: number) => {
    const current = await readTodoFromAuthorizedFolder();
    if (index < 0 || index >= current.items.length) {
      return { success: false, error: 'Invalid todo index' };
    }

    const updated = current.items.filter((_, i) => i !== index);

    return await writeTodoItems(updated);
  });

  // Clear all completed todos
  ipcMain.handle('todo:clear-completed', async () => {
    const current = await readTodoFromAuthorizedFolder();
    const updated = current.items.filter(item => !item.completed);

    return await writeTodoItems(updated);
  });
}
