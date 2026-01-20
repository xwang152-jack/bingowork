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

    close() {
        this.db.close();
    }
}
