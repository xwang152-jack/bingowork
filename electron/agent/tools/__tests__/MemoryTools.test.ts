import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryTools, SearchMemorySchema } from '../MemoryTools';

// Mock MemoryManager
const mockAddMemory = vi.fn();
const mockSearchMemories = vi.fn();
const mockGetRecentMemories = vi.fn();
const mockDeleteMemory = vi.fn();

vi.mock('../../memory/MemoryManager', () => ({
    getMemoryManager: () => ({
        addMemory: mockAddMemory,
        searchMemories: mockSearchMemories,
        getRecentMemories: mockGetRecentMemories,
        deleteMemory: mockDeleteMemory
    })
}));

describe('MemoryTools', () => {
    let memoryTools: MemoryTools;

    beforeEach(() => {
        memoryTools = new MemoryTools();
        vi.clearAllMocks();
    });

    describe('SearchMemorySchema', () => {
        it('should have correct name and description', () => {
            expect(SearchMemorySchema.name).toBe('search_memory');
            // Description was updated in previous steps
            expect(SearchMemorySchema.description).toContain('Search through previously saved facts');
        });
    });

    describe('searchMemory', () => {
        it('should return formatted string when memories are found', async () => {
            const mockMemories = [
                { id: 1, content: 'User likes coffee', tags: ['preference'], createdAt: new Date().toISOString() },
                { id: 2, content: 'Project uses TypeScript', tags: ['tech'], createdAt: new Date().toISOString() }
            ];
            mockSearchMemories.mockResolvedValue(mockMemories);

            const result = await memoryTools.searchMemory({ query: 'coffee' });

            expect(mockSearchMemories).toHaveBeenCalledWith({ query: 'coffee', limit: 5 });
            expect(result).toContain('Found 2 matching memories');
            expect(result).toContain('[ID: 1] User likes coffee');
            expect(result).toContain('[ID: 2] Project uses TypeScript');
        });

        it('should return no match message when no memories found', async () => {
            mockSearchMemories.mockResolvedValue([]);

            const result = await memoryTools.searchMemory({ query: 'notfound' });

            expect(mockSearchMemories).toHaveBeenCalledWith({ query: 'notfound', limit: 5 });
            expect(result).toContain('No matching memories found for query: "notfound"');
        });

        it('should use provided limit', async () => {
            mockSearchMemories.mockResolvedValue([]);
            await memoryTools.searchMemory({ query: 'test', limit: 10 });
            expect(mockSearchMemories).toHaveBeenCalledWith({ query: 'test', limit: 10 });
        });
    });
});
