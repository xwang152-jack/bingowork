/**
 * AgentUIBridge Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentUIBridge } from '../AgentUIBridge';

// Mock logger
vi.mock('../../utils/logger', () => ({
    logs: {
        agent: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        },
    },
}));

// Create mock BrowserWindow
function createMockWindow() {
    return {
        webContents: {
            send: vi.fn()
        },
        isDestroyed: vi.fn(() => false)
    } as any;
}

describe('AgentUIBridge', () => {
    let bridge: AgentUIBridge;

    beforeEach(() => {
        bridge = new AgentUIBridge();
    });

    describe('Window Management', () => {
        it('should start with no windows when not initialized with one', () => {
            expect(bridge.getWindowCount()).toBe(0);
        });

        it('should initialize with a window if provided', () => {
            const window = createMockWindow();
            const bridgeWithWindow = new AgentUIBridge(window);
            expect(bridgeWithWindow.getWindowCount()).toBe(1);
        });

        it('should add windows', () => {
            const window1 = createMockWindow();
            const window2 = createMockWindow();

            bridge.addWindow(window1);
            expect(bridge.getWindowCount()).toBe(1);

            bridge.addWindow(window2);
            expect(bridge.getWindowCount()).toBe(2);
        });

        it('should not add duplicate windows', () => {
            const window = createMockWindow();

            bridge.addWindow(window);
            bridge.addWindow(window);

            expect(bridge.getWindowCount()).toBe(1);
        });

        it('should remove windows', () => {
            const window1 = createMockWindow();
            const window2 = createMockWindow();

            bridge.addWindow(window1);
            bridge.addWindow(window2);
            expect(bridge.getWindowCount()).toBe(2);

            bridge.removeWindow(window1);
            expect(bridge.getWindowCount()).toBe(1);
        });

        it('should clean up pending promises when window removed', () => {
            const window = createMockWindow();
            bridge.addWindow(window);

            // Create a pending confirmation
            const confirmPromise = bridge.requestConfirmation('test-id', { test: true });
            let resolved = false;
            confirmPromise.then(() => { resolved = true; });

            bridge.removeWindow(window);

            // Should resolve with false (denied)
            return confirmPromise.then((result) => {
                expect(result).toBe(false);
                expect(resolved).toBe(true);
            });
        });
    });

    describe('Broadcasting', () => {
        it('should broadcast to all windows', () => {
            const window1 = createMockWindow();
            const window2 = createMockWindow();

            bridge.addWindow(window1);
            bridge.addWindow(window2);

            bridge.broadcast('test-channel', { data: 'test' });

            expect(window1.webContents.send).toHaveBeenCalledWith('test-channel', { data: 'test' });
            expect(window2.webContents.send).toHaveBeenCalledWith('test-channel', { data: 'test' });
        });

        it('should skip destroyed windows', () => {
            const window1 = createMockWindow();
            const window2 = createMockWindow();
            window2.isDestroyed = vi.fn(() => true);

            bridge.addWindow(window1);
            bridge.addWindow(window2);

            bridge.broadcast('test-channel', { data: 'test' });

            expect(window1.webContents.send).toHaveBeenCalled();
            expect(window2.webContents.send).not.toHaveBeenCalled();
        });
    });

    describe('Confirmation Handling', () => {
        it('should handle confirmation requests', async () => {
            const confirmPromise = bridge.requestConfirmation('test-123', { tool: 'test' });

            // Simulate user approval
            bridge.handleConfirmResponse('test-123', true);

            const result = await confirmPromise;
            expect(result).toBe(true);
        });

        it('should handle confirmation denials', async () => {
            const confirmPromise = bridge.requestConfirmation('test-456', { tool: 'test' });

            bridge.handleConfirmResponse('test-456', false);

            const result = await confirmPromise;
            expect(result).toBe(false);
        });

        it('should ignore unknown confirmation IDs', () => {
            expect(() => {
                bridge.handleConfirmResponse('unknown-id', true);
            }).not.toThrow();
        });
    });

    describe('User Question Handling', () => {
        it('should handle user question requests', async () => {
            const window = createMockWindow();
            bridge.addWindow(window);

            const questionPromise = bridge.askUser('What is your name?');

            // Check that question was broadcast
            expect(window.webContents.send).toHaveBeenCalledWith(
                'agent:user-question',
                expect.objectContaining({
                    question: 'What is your name?'
                })
            );

            // Simulate user response
            const broadcastCall = window.webContents.send.mock.calls[0];
            const questionId = broadcastCall[1].id;

            bridge.handleUserQuestionResponse(questionId, 'Alice');

            const answer = await questionPromise;
            expect(answer).toBe('Alice');
        });

        it('should handle user questions with options', async () => {
            const window = createMockWindow();
            bridge.addWindow(window);

            bridge.askUser('Choose one', ['A', 'B', 'C']);

            expect(window.webContents.send).toHaveBeenCalledWith(
                'agent:user-question',
                expect.objectContaining({
                    question: 'Choose one',
                    options: ['A', 'B', 'C']
                })
            );
        });
    });

    describe('History Updates', () => {
        it('should broadcast history updates', () => {
            const window = createMockWindow();
            bridge.addWindow(window);

            const history = [{ role: 'user', content: 'Test' }];
            bridge.notifyHistoryUpdate(history);

            expect(window.webContents.send).toHaveBeenCalledWith('agent:history-update', history);
        });
    });
});
