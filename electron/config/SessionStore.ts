import Store from 'electron-store';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import Anthropic from '@anthropic-ai/sdk';

export interface Session {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: Anthropic.MessageParam[];
}

interface SessionStoreSchema {
    sessions: Session[];
    currentSessionId: string | null;
}

const defaults: SessionStoreSchema = {
    sessions: [],
    currentSessionId: null
};

export class SessionStore {
    private store: Store<SessionStoreSchema>;

    constructor() {
        const cwd = process.env.VITE_DEV_SERVER_URL
            ? path.join(process.cwd(), 'local-data', 'electron-userdata')
            : undefined;
        if (cwd) fs.mkdirSync(cwd, { recursive: true });
        this.store = new Store<SessionStoreSchema>({
            name: 'bingowork-sessions',
            defaults,
            cwd
        });
    }

    // Get all sessions (summary only, without full messages for list view)
    getSessions(): Omit<Session, 'messages'>[] {
        const sessions = this.store.get('sessions') || [];
        return sessions
            .slice()
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .map(s => ({
                id: s.id,
                title: s.title,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt
            }));
    }

    // Get full session by ID
    getSession(id: string): Session | null {
        const sessions = this.store.get('sessions') || [];
        return sessions.find(s => s.id === id) || null;
    }

    // Create new session
    createSession(title?: string): Session {
        const session: Session = {
            id: nanoid(),
            title: title || '新会话',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: []
        };
        const sessions = this.store.get('sessions') || [];
        sessions.unshift(session); // Add to beginning
        this.store.set('sessions', sessions);
        this.store.set('currentSessionId', session.id);
        return session;
    }

    // Update session messages
    // onlyUpdateTitle: if true, don't update timestamp (used for loading sessions)
    updateSession(id: string, messages: Anthropic.MessageParam[], title?: string, onlyUpdateTitle = false): void {
        const sessions = this.store.get('sessions') || [];
        const index = sessions.findIndex(s => s.id === id);
        if (index >= 0) {
            const oldMessageCount = sessions[index].messages.length;
            sessions[index].messages = messages;

            // Only update timestamp if new messages were added (not just loading/viewing)
            if (!onlyUpdateTitle && messages.length > oldMessageCount) {
                sessions[index].updatedAt = Date.now();
            }

            if (title) {
                sessions[index].title = title;
            } else if (sessions[index].title === '新会话' && messages.length > 0) {
                // Auto-generate title from first user message
                const firstUserMsg = messages.find(m => m.role === 'user');
                if (firstUserMsg) {
                    const text = typeof firstUserMsg.content === 'string'
                        ? firstUserMsg.content
                        : (Array.isArray(firstUserMsg.content)
                            ? (firstUserMsg.content as Array<{ type: string; text?: string }>).find(b => b.type === 'text')?.text
                            : '');
                    if (text) {
                        sessions[index].title = text.slice(0, 50) + (text.length > 50 ? '...' : '');
                    }
                }
            }
            this.store.set('sessions', sessions);
        }
    }

    // Delete session
    deleteSession(id: string): void {
        const sessions = (this.store.get('sessions') || []).filter(s => s.id !== id);
        this.store.set('sessions', sessions);
        if (this.store.get('currentSessionId') === id) {
            this.store.set('currentSessionId', sessions.length > 0 ? sessions[0].id : null);
        }
    }

    // Get current session ID
    getCurrentSessionId(): string | null {
        return this.store.get('currentSessionId');
    }

    // Set current session
    setCurrentSession(id: string): void {
        this.store.set('currentSessionId', id);
    }

    // Rename session (don't update timestamp - only new conversations should)
    renameSession(id: string, title: string): void {
        const sessions = this.store.get('sessions') || [];
        const index = sessions.findIndex(s => s.id === id);
        if (index >= 0) {
            sessions[index].title = title;
            // Don't update updatedAt on rename - only update when new messages are added
            this.store.set('sessions', sessions);
        }
    }
}

export const sessionStore = new SessionStore();
