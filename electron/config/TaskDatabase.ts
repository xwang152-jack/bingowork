import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

export type TaskEventInsert = {
    ts?: number;
    sessionId?: string | null;
    type: string;
    payload: unknown;
};

export class TaskDatabase {
    private db: Database.Database;

    constructor(dbFilePath?: string) {
        const baseDir = app.getPath('userData');
        const dbPath = dbFilePath || path.join(baseDir, 'bingowork.sqlite3');

        try {
            this.db = new Database(dbPath);
        } catch (error) {
            console.error('[TaskDatabase] Failed to initialize database:', error);
            throw new Error(`Failed to open database at ${dbPath}. Please ensure the application has proper permissions.`);
        }

        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.migrate();
    }

    private normalizeSearchQuery(query: string): string {
        return String(query || '').trim().toLowerCase();
    }

    private extractSearchTokens(query: string): string[] {
        const tokens = query
            .split(/[\s,，。;；:：、/\\|]+/)
            .map(token => token.trim())
            .filter(token => token.length > 0);
        return Array.from(new Set(tokens));
    }

    private isSimpleToken(token: string): boolean {
        return /^[\p{L}\p{N}_]+$/u.test(token);
    }

    private buildFtsQuery(tokens: string[]): string {
        if (tokens.length === 0) return '';
        const clauses: string[] = [];
        tokens.forEach(token => {
            if (!token) return;
            if (this.isSimpleToken(token)) {
                const suffix = token.length > 1 ? '*' : '';
                clauses.push(`${token}${suffix}`);
            } else {
                const escaped = token.replace(/"/g, '""');
                clauses.push(`"${escaped}"`);
            }
        });
        return clauses.join(' OR ');
    }

    private buildLikeKeywords(tokens: string[], fallbackQuery: string): string[] {
        const keywordSet = new Set<string>();
        const sources = tokens.length > 0 ? tokens : fallbackQuery ? [fallbackQuery] : [];
        const maxKeywords = 20;

        for (const token of sources) {
            if (!token) continue;
            keywordSet.add(token);
            if (token.length >= 2) {
                for (let i = 0; i < token.length - 1; i++) {
                    if (keywordSet.size >= maxKeywords) break;
                    keywordSet.add(token.substring(i, i + 2));
                }
            }
            if (keywordSet.size >= maxKeywords) break;
        }

        return Array.from(keywordSet);
    }

    private migrate() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS app_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                updated_at INTEGER NOT NULL,
                config_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS kv_store (
                key TEXT PRIMARY KEY,
                updated_at INTEGER NOT NULL,
                value_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS task_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts INTEGER NOT NULL,
                session_id TEXT,
                type TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_task_events_ts ON task_events(ts);
            CREATE INDEX IF NOT EXISTS idx_task_events_session_ts ON task_events(session_id, ts);
            CREATE INDEX IF NOT EXISTS idx_task_events_type_ts ON task_events(type, ts);

            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                tags_json TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
                content,
                tags_json,
                content='memories',
                content_rowid='id'
            );

            -- Triggers to keep FTS in sync
            CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
                INSERT INTO memories_fts(rowid, content, tags_json) VALUES (new.id, new.content, new.tags_json);
            END;
            CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
                INSERT INTO memories_fts(memories_fts, rowid, content, tags_json) VALUES('delete', old.id, old.content, old.tags_json);
            END;
            CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
                INSERT INTO memories_fts(memories_fts, rowid, content, tags_json) VALUES('delete', old.id, old.content, old.tags_json);
                INSERT INTO memories_fts(rowid, content, tags_json) VALUES (new.id, new.content, new.tags_json);
            END;

            CREATE TABLE IF NOT EXISTS task_execution_logs (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at INTEGER NOT NULL,
                completed_at INTEGER,
                result TEXT,
                error TEXT,
                created_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_logs_task_id ON task_execution_logs(task_id);
            CREATE INDEX IF NOT EXISTS idx_logs_created_at ON task_execution_logs(created_at);
        `);
    }

    upsertConfig(config: unknown) {
        const stmt = this.db.prepare(`
            INSERT INTO app_config (id, updated_at, config_json)
            VALUES (1, @updated_at, @config_json)
            ON CONFLICT(id) DO UPDATE SET
                updated_at = excluded.updated_at,
                config_json = excluded.config_json
        `);
        stmt.run({
            updated_at: Date.now(),
            config_json: JSON.stringify(config)
        });
    }

    setKV(key: string, value: unknown) {
        const normalizedKey = String(key || '').trim();
        if (!normalizedKey) {
            throw new Error('KV key is required');
        }

        const stmt = this.db.prepare(`
            INSERT INTO kv_store (key, updated_at, value_json)
            VALUES (@key, @updated_at, @value_json)
            ON CONFLICT(key) DO UPDATE SET
                updated_at = excluded.updated_at,
                value_json = excluded.value_json
        `);

        stmt.run({
            key: normalizedKey,
            updated_at: Date.now(),
            value_json: JSON.stringify(value ?? null)
        });
    }

    getKV<T = unknown>(key: string): T | null {
        const normalizedKey = String(key || '').trim();
        if (!normalizedKey) {
            throw new Error('KV key is required');
        }

        const stmt = this.db.prepare(`
            SELECT value_json FROM kv_store WHERE key = @key
        `);
        const row = stmt.get({ key: normalizedKey }) as { value_json?: string } | undefined;
        if (!row?.value_json) return null;
        try {
            return JSON.parse(row.value_json) as T;
        } catch {
            return null;
        }
    }

    deleteKV(key: string) {
        const normalizedKey = String(key || '').trim();
        if (!normalizedKey) {
            throw new Error('KV key is required');
        }
        const stmt = this.db.prepare(`
            DELETE FROM kv_store WHERE key = @key
        `);
        stmt.run({ key: normalizedKey });
    }

    logEvent(event: TaskEventInsert) {
        const stmt = this.db.prepare(`
            INSERT INTO task_events (ts, session_id, type, payload_json)
            VALUES (@ts, @session_id, @type, @payload_json)
        `);

        stmt.run({
            ts: event.ts ?? Date.now(),
            session_id: event.sessionId ?? null,
            type: event.type,
            payload_json: JSON.stringify(event.payload ?? null)
        });
    }

    /**
     * Get all KV entries with a given prefix
     * Useful for querying related data (e.g., all schedule tasks)
     */
    getKVByPrefix<T = unknown>(prefix: string): Map<string, T> {
        const normalizedPrefix = String(prefix || '').trim();
        if (!normalizedPrefix) {
            throw new Error('KV prefix is required');
        }

        const stmt = this.db.prepare(`
            SELECT key, value_json FROM kv_store WHERE key LIKE @prefix
        `);
        const rows = stmt.all({ prefix: `${normalizedPrefix}%` }) as Array<{ key: string; value_json: string }>;
        const result = new Map<string, T>();
        for (const row of rows) {
            try {
                result.set(row.key, JSON.parse(row.value_json) as T);
            } catch {
                // Skip invalid JSON entries
                console.warn(`[TaskDatabase] Failed to parse JSON for key: ${row.key}`);
            }
        }
        return result;
    }

    /**
     * Delete all KV entries with a given prefix
     * Useful for bulk deletion of related data
     */
    deleteKVByPrefix(prefix: string): number {
        const normalizedPrefix = String(prefix || '').trim();
        if (!normalizedPrefix) {
            throw new Error('KV prefix is required');
        }

        const stmt = this.db.prepare(`
            DELETE FROM kv_store WHERE key LIKE @prefix
        `);
        const result = stmt.run({ prefix: `${normalizedPrefix}%` });
        return result.changes;
    }

    /**
     * Execution Log Methods
     */

    insertExecutionLog(log: {
        id: string;
        taskId: string;
        status: string;
        startedAt: number;
        completedAt?: number;
        result?: string;
        error?: string;
    }) {
        const stmt = this.db.prepare(`
            INSERT INTO task_execution_logs (id, task_id, status, started_at, completed_at, result, error, created_at)
            VALUES (@id, @taskId, @status, @startedAt, @completedAt, @result, @error, @startedAt)
        `);
        stmt.run({
            id: log.id,
            taskId: log.taskId,
            status: log.status,
            startedAt: log.startedAt,
            completedAt: log.completedAt || null,
            result: log.result || null,
            error: log.error || null
        });
    }

    updateExecutionLog(log: {
        id: string;
        status: string;
        completedAt?: number;
        result?: string;
        error?: string;
    }) {
        const stmt = this.db.prepare(`
            UPDATE task_execution_logs
            SET status = @status, completed_at = @completedAt, result = @result, error = @error
            WHERE id = @id
        `);
        stmt.run({
            id: log.id,
            status: log.status,
            completedAt: log.completedAt || null,
            result: log.result || null,
            error: log.error || null
        });
    }

    getExecutionLogs(taskId: string | null = null, limit: number = 100, offset: number = 0): Array<{
        id: string;
        taskId: string;
        status: string;
        startedAt: number;
        completedAt?: number;
        result?: string;
        error?: string;
    }> {
        const params: { limit: number; offset: number; taskId?: string } = { limit, offset };
        let query = `SELECT * FROM task_execution_logs`;

        if (taskId) {
            query += ` WHERE task_id = @taskId`;
            params.taskId = taskId;
        }

        query += ` ORDER BY created_at DESC LIMIT @limit OFFSET @offset`;

        const stmt = this.db.prepare(query);
        const rows = stmt.all(params) as Array<{
            id: string;
            task_id: string;
            status: string;
            started_at: number;
            completed_at?: number;
            result?: string;
            error?: string;
        }>;

        return rows.map(row => ({
            id: row.id,
            taskId: row.task_id,
            status: row.status,
            startedAt: row.started_at,
            completedAt: row.completed_at || undefined,
            result: row.result || undefined,
            error: row.error || undefined
        }));
    }

    cleanupExecutionLogs(beforeTimestamp: number): number {
        const stmt = this.db.prepare(`
            DELETE FROM task_execution_logs WHERE created_at < @beforeTimestamp
        `);
        const result = stmt.run({ beforeTimestamp });
        return result.changes;
    }

    deleteExecutionLogs(taskId: string): number {
        const stmt = this.db.prepare(`
            DELETE FROM task_execution_logs WHERE task_id = @taskId
        `);
        const result = stmt.run({ taskId });
        return result.changes;
    }

    recoverStuckExecutionLogs(): number {
        const stmt = this.db.prepare(`
            UPDATE task_execution_logs
            SET status = 'failed', error = 'System crash or unexpected termination', completed_at = @now
            WHERE status = 'running'
        `);
        const result = stmt.run({ now: Date.now() });
        return result.changes;
    }

    /**
     * Permanent Memory Methods
     */

    insertMemory(content: string, tagsJson: string): number {
        const stmt = this.db.prepare(`
            INSERT INTO memories (content, tags_json, created_at, updated_at)
            VALUES (@content, @tags_json, @created_at, @updated_at)
        `);
        const result = stmt.run({
            content,
            tags_json: tagsJson,
            created_at: Date.now(),
            updated_at: Date.now()
        });
        return result.lastInsertRowid as number;
    }

    searchMemories(query: string, limit: number = 20): Array<{ id: number; content: string; tags_json: string; created_at: number; updated_at: number }> {
        let results: Array<{ id: number; content: string; tags_json: string; created_at: number; updated_at: number }> = [];
        const normalizedQuery = this.normalizeSearchQuery(query);
        const tokens = this.extractSearchTokens(normalizedQuery);
        const ftsQuery = this.buildFtsQuery(tokens) || normalizedQuery;

        // 1. Try FTS search
        if (ftsQuery) {
            try {
                const ftsStmt = this.db.prepare(`
                    SELECT m.id, m.content, m.tags_json, m.created_at, m.updated_at, bm25(f) AS score
                    FROM memories m
                    JOIN memories_fts f ON m.id = f.rowid
                    WHERE memories_fts MATCH @query
                    ORDER BY score, m.updated_at DESC
                    LIMIT @limit
                `);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                results = ftsStmt.all({ query: ftsQuery, limit }) as any;
            } catch (error) {
                console.warn('[TaskDatabase] FTS search failed or invalid query, falling back to LIKE', error);
            }
        }

        // 2. Fallback/Supplement with LIKE search if we haven't reached the limit
        if (results.length < limit) {
            const keywords = this.buildLikeKeywords(tokens, normalizedQuery);

            if (keywords.length > 0) {
                const existingIds = new Set(results.map(r => r.id));
                const remainingLimit = limit - results.length;

                const likeConditions = keywords.map((_, i) => `(content LIKE @k${i} OR tags_json LIKE @k${i})`).join(' OR ');
                const scoreFragments = keywords.map((_, i) => `(content LIKE @k${i}) + (tags_json LIKE @k${i})`).join(' + ');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const params: Record<string, any> = { limit: remainingLimit };
                keywords.forEach((k, i) => params[`k${i}`] = `%${k}%`);

                try {
                    const likeQuery = `
                        SELECT id, content, tags_json, created_at, updated_at, (${scoreFragments}) AS score
                        FROM memories
                        WHERE (${likeConditions})
                        ${existingIds.size > 0 ? `AND id NOT IN (${Array.from(existingIds).join(',')})` : ''}
                        ORDER BY score DESC, updated_at DESC
                        LIMIT @limit
                    `;

                    const likeStmt = this.db.prepare(likeQuery);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const likeResults = likeStmt.all(params) as any;
                    results = [...results, ...likeResults];
                } catch (error) {
                    console.error('[TaskDatabase] LIKE search failed', error);
                }
            }
        }

        return results;
    }

    getRecentMemories(limit: number = 20): Array<{ id: number; content: string; tags_json: string; created_at: number; updated_at: number }> {
        const stmt = this.db.prepare(`
            SELECT id, content, tags_json, created_at, updated_at
            FROM memories
            ORDER BY created_at DESC
            LIMIT @limit
        `);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return stmt.all({ limit }) as any;
    }

    deleteMemory(id: number): boolean {
        const stmt = this.db.prepare('DELETE FROM memories WHERE id = @id');
        const result = stmt.run({ id });
        return result.changes > 0;
    }

    close() {
        this.db.close();
    }
}
