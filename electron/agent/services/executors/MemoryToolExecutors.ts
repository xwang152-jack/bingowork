
/**
 * Memory Tool Executors
 */

import {
    ToolExecutor,
    ToolExecutionContext,
    ToolInput,
    ToolResult,
    BaseToolExecutor
} from '../ToolExecutor';
import {
    MemoryTools,
    RecordFactSchema,
    SearchMemorySchema,
    ListMemoriesSchema,
    ForgetFactSchema
} from '../../tools/MemoryTools';

class RecordFactExecutor extends BaseToolExecutor {
    readonly name = 'record_fact';
    readonly schema = RecordFactSchema;
    private memoryTools = new MemoryTools();

    isAllowedInMode(_mode: 'chat' | 'code' | 'cowork'): boolean {
        return true;
    }

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        const args = input as { fact: string; tags?: string[] };
        if (!args.fact) {
            return 'Error: fact parameter is required.';
        }
        return await this.memoryTools.recordFact(args);
    }
}

class SearchMemoryExecutor extends BaseToolExecutor {
    readonly name = 'search_memory';
    readonly schema = SearchMemorySchema;
    private memoryTools = new MemoryTools();

    isAllowedInMode(_mode: 'chat' | 'code' | 'cowork'): boolean {
        return true;
    }

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        const args = input as { query: string; limit?: number };
        if (!args.query) {
            return 'Error: query parameter is required.';
        }
        return await this.memoryTools.searchMemory(args);
    }
}

class ListMemoriesExecutor extends BaseToolExecutor {
    readonly name = 'list_memories';
    readonly schema = ListMemoriesSchema;
    private memoryTools = new MemoryTools();

    isAllowedInMode(_mode: 'chat' | 'code' | 'cowork'): boolean {
        return true;
    }

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        const args = input as { limit?: number };
        return await this.memoryTools.listMemories(args);
    }
}

class ForgetFactExecutor extends BaseToolExecutor {
    readonly name = 'forget_fact';
    readonly schema = ForgetFactSchema;
    private memoryTools = new MemoryTools();

    isAllowedInMode(_mode: 'chat' | 'code' | 'cowork'): boolean {
        return true;
    }

    async execute(input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        const args = input as { memoryId: number };
        if (args.memoryId === undefined) {
            return 'Error: memoryId parameter is required.';
        }
        return await this.memoryTools.forgetFact(args);
    }
}

export const memoryToolExecutors: ToolExecutor[] = [
    new RecordFactExecutor(),
    new SearchMemoryExecutor(),
    new ListMemoriesExecutor(),
    new ForgetFactExecutor()
];
