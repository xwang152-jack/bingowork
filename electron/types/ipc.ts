/**
 * IPC Type Definitions
 * Shared types between main and renderer processes
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================
// Agent Types
// ============================================

export type AgentMessage = {
    role: 'user' | 'assistant';
    content: string | Anthropic.MessageParam['content'];
    id?: string;
};

export type AgentStage = 'IDLE' | 'THINKING' | 'PLANNING' | 'EXECUTING' | 'FEEDBACK';

// ============================================
// Config Types
// ============================================

export type ApiProvider = 'anthropic' | 'openai' | 'minimax';

export type WorkMode = 'chat' | 'code' | 'cowork';

export interface AppConfigDTO {
    provider: ApiProvider;
    apiKey: string;
    apiKeys?: Record<string, string>;
    apiUrl: string;
    model: string;
    modelHistory?: string[];
    llmProfiles?: Array<{
        model: string;
        provider: ApiProvider;
        apiUrl: string;
        updatedAt: number;
    }>;
    networkAccess: boolean;
    authorizedFolders: string[];
    browserAccess: boolean;
    shortcut: string;
    workMode?: WorkMode;
}

// ============================================
// Session Types
// ============================================

export interface Session {
    id: string;
    title: string;
    messages: AgentMessage[];
    createdAt: number;
    updatedAt: number;
}

// ============================================
// Permission Types
// ============================================

export interface ToolPermission {
    tool: string;
    pathPattern?: string;
    grantedAt: number;
}

// ============================================
// Skill Types
// ============================================

export interface SkillInfo {
    id: string;
    name: string;
    path: string;
    isBuiltin: boolean;
}

// ============================================
// IPC Event Types
// ============================================

export interface IPCEvents {
    // Agent events
    'agent:history-update': AgentMessage[];
    'agent:error': string;
    'agent:stage': { stage: AgentStage; detail?: unknown };
    'agent:stream-token': string;
    'agent:tool-call': { callId: string; name: string; input: Record<string, unknown> };
    'agent:tool-result': { callId: string; status: 'done' | 'error'; error?: string };
    'agent:tool-output-stream': { callId: string; chunk: string; type: 'stdout' | 'stderr' };
    'agent:confirm-request': { id: string; tool: string; description: string; args: Record<string, unknown> };
    'agent:user-question': { id: string; question: string; options?: string[] };
    'agent:artifact-created': { path: string; name: string; type: string };
    'agent:status': string;

    // Session events
    'session:loaded': Session;
    'session:created': Session;
    'session:deleted': string;
    'session:renamed': { id: string; title: string };

    // Config events
    'config:updated': AppConfigDTO;
}

// ============================================
// IPC Invoke Channels
// ============================================

export interface IPCInvokeChannels {
    // Agent operations
    'agent:sendMessage': (args: { content: string; images?: string[] }) => void;
    'agent:abort': () => void;
    'agent:loadHistory': (messages: AgentMessage[]) => void;
    'agent:clearHistory': () => void;

    // Session operations
    'session:list': () => Session[];
    'session:load': (id: string) => void;
    'session:create': () => { sessionId: string };
    'session:delete': (id: string) => void;
    'session:rename': (id: string, title: string) => void;

    // Config operations
    'config:get': () => AppConfigDTO;
    'config:update': (config: Partial<AppConfigDTO>) => void;

    // Permission operations
    'permission:list': () => ToolPermission[];
    'permission:grant': (tool: string, path?: string, remember?: boolean) => void;
    'permission:revoke': (tool: string, path?: string) => void;

    // Skill operations
    'skill:list': () => SkillInfo[];
    'skill:enable': (name: string) => void;
    'skill:disable': (name: string) => void;

    // System operations
    'system:openPath': (path: string) => void;
    'system:showItemInFolder': (path: string) => void;
}
