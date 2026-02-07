/**
 * Agent UI Bridge
 * 
 * Handles all communication between the Agent and UI windows.
 * Extracted from AgentRuntime.ts to separate concerns.
 */

import { BrowserWindow } from 'electron';
import { logs } from '../utils/logger';

/**
 * Pending confirmation request
 */
interface PendingConfirmation {
    resolve: (approved: boolean) => void;
}

/**
 * Pending question request
 */
interface PendingQuestion {
    resolve: (answer: string) => void;
}

/**
 * AgentUIBridge manages communication between the Agent and BrowserWindows.
 * It handles:
 * - Window lifecycle (add/remove)
 * - Broadcasting messages to all windows
 * - Pending confirmations and questions
 */
export class AgentUIBridge {
    private windows: BrowserWindow[] = [];
    private pendingConfirmations: Map<string, PendingConfirmation> = new Map();
    private pendingQuestions: Map<string, PendingQuestion> = new Map();

    constructor(initialWindow?: BrowserWindow) {
        if (initialWindow) {
            this.windows = [initialWindow];
        }
    }

    /**
     * Add a window to receive updates
     */
    addWindow(win: BrowserWindow): void {
        if (!this.windows.includes(win)) {
            this.windows.push(win);
        }
    }

    /**
     * Remove a window and clean up pending promises
     */
    removeWindow(win: BrowserWindow): void {
        this.windows = this.windows.filter(w => w !== win);

        // Clean up pending promises associated with this window
        // This prevents memory leaks when windows are closed
        const pendingIds = [
            ...this.pendingConfirmations.keys(),
            ...this.pendingQuestions.keys()
        ];

        for (const id of pendingIds) {
            // Reject any pending promises that are still waiting
            const confirmation = this.pendingConfirmations.get(id);
            if (confirmation) {
                confirmation.resolve(false); // Deny by default when window is closed
                this.pendingConfirmations.delete(id);
            }

            const question = this.pendingQuestions.get(id);
            if (question) {
                question.resolve('Window closed'); // Provide default answer
                this.pendingQuestions.delete(id);
            }
        }

        logs.agent.info(`Removed window and cleaned up ${pendingIds.length} pending promises`);
    }

    /**
     * Broadcast a message to all non-destroyed windows
     */
    broadcast(channel: string, data: unknown): void {
        for (const win of this.windows) {
            if (!win.isDestroyed()) {
                win.webContents.send(channel, data);
            }
        }
    }

    /**
     * Get current window count
     */
    getWindowCount(): number {
        return this.windows.length;
    }

    /**
     * Handle confirmation response
     */
    handleConfirmResponse(id: string, approved: boolean): void {
        const pending = this.pendingConfirmations.get(id);
        if (pending) {
            pending.resolve(approved);
            this.pendingConfirmations.delete(id);
        }
    }

    /**
     * Handle user question response
     */
    handleUserQuestionResponse(id: string, answer: string): void {
        const pending = this.pendingQuestions.get(id);
        if (pending) {
            pending.resolve(answer);
            this.pendingQuestions.delete(id);
        }
    }

    /**
     * Request confirmation from user
     */
    requestConfirmation(id: string, data: unknown): Promise<boolean> {
        return new Promise((resolve) => {
            this.pendingConfirmations.set(id, { resolve });
            this.broadcast('agent:confirm-request', data);
        });
    }

    /**
     * Ask user a question
     */
    askUser(question: string, options?: string[]): Promise<string> {
        const id = Math.random().toString(36).substring(7);
        this.broadcast('agent:user-question', { id, question, options });

        return new Promise((resolve) => {
            this.pendingQuestions.set(id, { resolve });
        });
    }

    /**
     * Notify history update
     */
    notifyHistoryUpdate(history: unknown): void {
        this.broadcast('agent:history-update', history);
    }
}
