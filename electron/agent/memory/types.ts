
/**
 * Memory Types
 */

export interface Memory {
    id: number;
    content: string;
    tags: string[];
    createdAt: number;
    updatedAt: number;
}

export interface MemorySearchParams {
    query?: string;
    tags?: string[];
    limit?: number;
}
