/**
 * React hooks for IPC communication
 * Provides easy-to-use hooks for common IPC operations
 */

import { useState, useEffect, useCallback } from 'react';
import type {
    AgentMessage,
    AppConfigDTO,
    Session,
    SkillInfo,
    ToolPermission,
    WorkMode,
} from '../../electron/types/ipc';
import { ipcService } from '../../electron/services/IPCService.ts';

// ============================================
// Agent Hooks
// ============================================

export interface UseAgentResult {
    history: AgentMessage[];
    isProcessing: boolean;
    stage: string;
    sendMessage: (content: string, images?: string[]) => Promise<void>;
    abort: () => Promise<void>;
    error: string | null;
}

/**
 * Hook for interacting with the agent
 */
export function useAgent(): UseAgentResult {
    const [history, setHistory] = useState<AgentMessage[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [stage, setStage] = useState('IDLE');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const removeListener = window.ipcRenderer.on('agent:history-update', (_event, updatedHistory) => {
            setHistory(updatedHistory as AgentMessage[]);
            setIsProcessing(false);
        });

        const removeErrorListener = window.ipcRenderer.on('agent:error', (_event, err) => {
            console.error('Agent Error:', err);
            setError(err as string);
            setIsProcessing(false);
        });

        const removeStageListener = window.ipcRenderer.on('agent:stage-change', (_event, newStage) => {
            setStage(newStage as string);
        });

        return () => {
            removeListener();
            removeErrorListener();
            removeStageListener();
        };
    }, []);

    const sendMessage = useCallback(async (content: string, images?: string[]) => {
        setIsProcessing(true);
        setError(null);
        try {
            await ipcService.sendMessage(content, images);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setIsProcessing(false);
        }
    }, []);

    const abort = useCallback(async () => {
        await ipcService.abortAgent();
        setIsProcessing(false);
    }, []);

    return {
        history,
        isProcessing,
        stage,
        sendMessage,
        abort,
        error,
    };
}

// ============================================
// Config Hooks
// ============================================

export interface UseConfigResult {
    config: AppConfigDTO | null;
    loading: boolean;
    error: string | null;
    updateConfig: (config: Partial<AppConfigDTO>) => Promise<void>;
    setWorkMode: (mode: WorkMode) => Promise<void>;
    refresh: () => Promise<void>;
}

/**
 * Hook for accessing and updating configuration
 */
export function useConfig(): UseConfigResult {
    const [config, setConfig] = useState<AppConfigDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const cfg = await ipcService.getConfig();
            setConfig(cfg);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    const updateConfig = useCallback(async (updates: Partial<AppConfigDTO>) => {
        setError(null);
        try {
            await ipcService.updateConfig(updates);
            // Refresh config after update
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }, [refresh]);

    const setWorkMode = useCallback(async (mode: WorkMode) => {
        setError(null);
        try {
            await ipcService.setWorkMode(mode);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }, [refresh]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        const remove = window.ipcRenderer.on('config:updated', () => {
            refresh();
        });
        return () => remove();
    }, [refresh]);

    return {
        config,
        loading,
        error,
        updateConfig,
        setWorkMode,
        refresh,
    };
}

// ============================================
// Session Hooks
// ============================================

export interface UseSessionsResult {
    sessions: Session[];
    currentSessionId: string | null;
    loading: boolean;
    loadSession: (id: string) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    renameSession: (id: string, title: string) => Promise<void>;
    createNew: () => Promise<string | undefined>;
    refresh: () => Promise<void>;
}

/**
 * Hook for managing sessions
 */
export function useSessions(): UseSessionsResult {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const sortSessions = useCallback((list: Session[]) => {
        return list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, []);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const sessionList = await ipcService.listSessions();
            setSessions(sortSessions(sessionList));
            const current = await ipcService.getCurrentSession();
            setCurrentSessionId(current?.id ?? null);
        } catch (err) {
            console.error('Failed to load sessions:', err);
        } finally {
            setLoading(false);
        }
    }, [sortSessions]);

    const loadSession = useCallback(async (id: string) => {
        await ipcService.loadSession(id);
        setCurrentSessionId(id);
    }, []);

    const deleteSession = useCallback(async (id: string) => {
        await ipcService.deleteSession(id);
        await refresh();
    }, [refresh]);

    const renameSession = useCallback(async (id: string, title: string) => {
        await ipcService.renameSession(id, title);
        await refresh();
    }, [refresh]);

    const createNew = useCallback(async () => {
        const result = await ipcService.createNewSession();
        if (result.sessionId) {
            await refresh();
            return result.sessionId;
        }
    }, [refresh]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            try {
                const list = sortSessions(await ipcService.listSessions());
                if (cancelled) return;
                setSessions(list);
                const latestId = list[0]?.id;
                if (latestId) {
                    await ipcService.loadSession(latestId);
                    if (!cancelled) setCurrentSessionId(latestId);
                    return;
                }
                const created = await ipcService.createNewSession();
                if (created.sessionId && !cancelled) {
                    setCurrentSessionId(created.sessionId);
                    await refresh();
                }
            } catch (err) {
                console.error('Failed to init sessions:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [refresh, sortSessions]);

    useEffect(() => {
        let timeoutId: number | null = null;
        const remove = window.ipcRenderer.on('agent:history-update', () => {
            if (timeoutId) window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(() => {
                refresh().catch(() => void 0);
            }, 150);
        });
        return () => {
            if (timeoutId) window.clearTimeout(timeoutId);
            remove();
        };
    }, [refresh]);

    return {
        sessions,
        currentSessionId,
        loading,
        loadSession,
        deleteSession,
        renameSession,
        createNew,
        refresh,
    };
}

// ============================================
// Permission Hooks
// ============================================

export interface UsePermissionsResult {
    permissions: ToolPermission[];
    loading: boolean;
    refresh: () => Promise<void>;
}

/**
 * Hook for managing tool permissions
 */
export function usePermissions(): UsePermissionsResult {
    const [permissions, setPermissions] = useState<ToolPermission[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const perms = await ipcService.listPermissions();
            setPermissions(perms);
        } catch (err) {
            console.error('Failed to load permissions:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        permissions,
        loading,
        refresh,
    };
}

// ============================================
// Skill Hooks
// ============================================

export interface UseSkillsResult {
    skills: SkillInfo[];
    loading: boolean;
    refresh: () => Promise<void>;
}

/**
 * Hook for accessing available skills
 */
export function useSkills(): UseSkillsResult {
    const [skills, setSkills] = useState<SkillInfo[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const skillList = await ipcService.listSkills();
            setSkills(skillList);
        } catch (err) {
            console.error('Failed to load skills:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        skills,
        loading,
        refresh,
    };
}
