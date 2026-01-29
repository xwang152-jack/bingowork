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
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.migrate();
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
        const stmt = this.db.prepare(`
            SELECT m.id, m.content, m.tags_json, m.created_at, m.updated_at
            FROM memories m
            JOIN memories_fts f ON m.id = f.rowid
            WHERE memories_fts MATCH @query
            ORDER BY rank
            LIMIT @limit
        `);
        return stmt.all({ query, limit }) as any;
    }

    getRecentMemories(limit: number = 20): Array<{ id: number; content: string; tags_json: string; created_at: number; updated_at: number }> {
        const stmt = this.db.prepare(`
            SELECT id, content, tags_json, created_at, updated_at
            FROM memories
            ORDER BY created_at DESC
            LIMIT @limit
        `);
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
