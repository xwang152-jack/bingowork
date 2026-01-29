
import { TaskDatabase } from '../../config/TaskDatabase';
import { Memory, MemorySearchParams } from './types';
import { logs } from '../../utils/logger';

/**
 * MemoryManager
 * Manages permanent memories using SQLite and FTS5
 */
export class MemoryManager {
    private static instance: MemoryManager | null = null;
    private db: TaskDatabase;

    private constructor() {
        this.db = new TaskDatabase();
    }

    public static getInstance(): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager();
        }
        return MemoryManager.instance;
    }

    /**
     * Add a new memory
     */
    public async addMemory(content: string, tags: string[] = []): Promise<Memory> {
        try {
            const tagsJson = JSON.stringify(tags);
            const id = this.db.insertMemory(content, tagsJson);

            const now = Date.now();
            return {
                id,
                content,
                tags,
                createdAt: now,
                updatedAt: now
            };
        } catch (error) {
            logs.agent.error(`[Memory] Failed to add memory: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Search memories
     */
    public async searchMemories(params: MemorySearchParams): Promise<Memory[]> {
        try {
            const { query, limit = 10 } = params;

            let results;
            if (query) {
                results = this.db.searchMemories(query, limit);
            } else {
                results = this.db.getRecentMemories(limit);
            }

            return results.map(row => ({
                id: row.id,
                content: row.content,
                tags: JSON.parse(row.tags_json || '[]'),
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
        } catch (error) {
            logs.agent.error(`[Memory] Failed to search memories: ${(error as Error).message}`);
            return [];
        }
    }

    /**
     * Get recent memories
     */
    public async getRecentMemories(limit: number = 20): Promise<Memory[]> {
        return this.searchMemories({ limit });
    }

    /**
     * Delete memory
     */
    public async deleteMemory(id: number): Promise<boolean> {
        try {
            return this.db.deleteMemory(id);
        } catch (error) {
            logs.agent.error(`[Memory] Failed to delete memory ${id}: ${(error as Error).message}`);
            return false;
        }
    }
}

// Global accessor
export function getMemoryManager(): MemoryManager {
    return MemoryManager.getInstance();
}
