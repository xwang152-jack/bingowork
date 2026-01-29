
import { Anthropic } from '@anthropic-ai/sdk';
import { getMemoryManager } from '../memory/MemoryManager';

/**
 * Tool schema for recording a fact (adding memory)
 */
export const RecordFactSchema: Anthropic.Tool = {
    name: 'record_fact',
    description: 'Save an important fact, user preference, or project context for permanent memory. Use this when you learn something that should be remembered across different sessions.',
    input_schema: {
        type: 'object',
        properties: {
            fact: {
                type: 'string',
                description: 'The fact or information to remember.'
            },
            tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional tags to categorize the memory (e.g., "preference", "background", "technical").'
            }
        },
        required: ['fact']
    }
};

/**
 * Tool schema for searching memories
 */
export const SearchMemorySchema: Anthropic.Tool = {
    name: 'search_memory',
    description: 'Search through previously saved facts and permanent memories. Use this when you need to recall information from past interactions.',
    input_schema: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query or keywords to find relevant memories.'
            },
            limit: {
                type: 'number',
                description: 'Maximum number of results to return. Defaults to 5.'
            }
        },
        required: ['query']
    }
};

/**
 * Tool schema for listing recent memories
 */
export const ListMemoriesSchema: Anthropic.Tool = {
    name: 'list_memories',
    description: 'List the most recent permanent memories. Use this to see what has been recently remembered.',
    input_schema: {
        type: 'object',
        properties: {
            limit: {
                type: 'number',
                description: 'Maximum number of memories to list. Defaults to 10.'
            }
        }
    }
};

/**
 * Tool schema for forgetting a fact
 */
export const ForgetFactSchema: Anthropic.Tool = {
    name: 'forget_fact',
    description: 'Remove a previously saved fact from permanent memory using its ID.',
    input_schema: {
        type: 'object',
        properties: {
            memoryId: {
                type: 'number',
                description: 'The ID of the memory to remove.'
            }
        },
        required: ['memoryId']
    }
};

/**
 * MemoryTools
 * Implements logic for memory tools
 */
export class MemoryTools {
    /**
     * Record a new fact
     */
    async recordFact(args: { fact: string; tags?: string[] }): Promise<string> {
        const memoryManager = getMemoryManager();
        const memory = await memoryManager.addMemory(args.fact, args.tags || []);
        return `Fact recorded successfully. Memory ID: ${memory.id}`;
    }

    /**
     * Search memories
     */
    async searchMemory(args: { query: string; limit?: number }): Promise<string> {
        const memoryManager = getMemoryManager();
        const memories = await memoryManager.searchMemories({
            query: args.query,
            limit: args.limit || 5
        });

        if (memories.length === 0) {
            return `No matching memories found for query: "${args.query}"`;
        }

        const formatted = memories.map(m => `[ID: ${m.id}] ${m.content} (Tags: ${m.tags?.join(', ') || 'none'})`).join('\n---\n');
        return `Found ${memories.length} matching memories:\n\n${formatted}`;
    }

    /**
     * List recent memories
     */
    async listMemories(args: { limit?: number }): Promise<string> {
        const memoryManager = getMemoryManager();
        const memories = await memoryManager.getRecentMemories(args.limit || 10);

        if (memories.length === 0) {
            return "No permanent memories found.";
        }

        const formatted = memories.map(m => `[ID: ${m.id}] ${m.content} (Created: ${new Date(m.createdAt).toLocaleString()})`).join('\n---\n');
        return `Most recent memories:\n\n${formatted}`;
    }

    /**
     * Delete a memory
     */
    async forgetFact(args: { memoryId: number }): Promise<string> {
        const memoryManager = getMemoryManager();
        const success = await memoryManager.deleteMemory(args.memoryId);

        if (success) {
            return `Memory [ID: ${args.memoryId}] has been forgotten.`;
        } else {
            return `Error: Could not find memory with ID: ${args.memoryId}`;
        }
    }
}
