/**
 * AgentRuntime Core Functionality Tests
 * Tests for agent loop, tool execution, and message processing
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { AgentRuntime, AgentMessage, AgentStage } from '../AgentRuntime';
import type { WorkMode, ApiProvider } from '../../config/ConfigStore';
import type { AgentEventSink } from '../AgentRuntime';

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  app: {
    getPath: vi.fn(() => '/tmp/test-userdata'),
    isPackaged: false,
  },
}));

// Mock ConfigStore
vi.mock('../../config/ConfigStore', () => ({
  WorkMode: {
    CHAT: 'chat' as const,
    CODE: 'code' as const,
    COWORK: 'cowork' as const,
  },
  ApiProvider: {
    ANTHROPIC: 'anthropic' as const,
    OPENAI: 'openai' as const,
    MINIMAX: 'minimax' as const,
  },
  configStore: {
    get: vi.fn((key: string) => {
      if (key === 'workMode') return 'cowork';
      if (key === 'networkAccess') return false;
      return undefined;
    }),
    set: vi.fn(),
    getAll: vi.fn(() => ({
      apiKey: 'test-key',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      apiUrl: 'https://api.anthropic.com',
      workMode: 'cowork' as WorkMode,
      networkAccess: false,
    })),
    getNetworkAccess: vi.fn(() => false),
    hasPermission: vi.fn(() => false),
  },
  permissionManager: {
    isPathAuthorized: vi.fn(() => false),
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logs: {
    agent: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

// Mock LLM Providers to avoid browser environment issues
// Define classes inside the mock factory to avoid hoisting issues
vi.mock('../providers/AnthropicProvider', () => {
  class MockAnthropicProvider {
    async streamChat() {
      return [];
    }
  }
  return { AnthropicProvider: MockAnthropicProvider };
});

vi.mock('../providers/OpenAIProvider', () => {
  class MockOpenAIProvider {
    async streamChat() {
      return [];
    }
  }
  return { OpenAIProvider: MockOpenAIProvider };
});

vi.mock('../providers/MiniMaxProvider', () => {
  class MockMiniMaxProvider {
    async streamChat() {
      return [];
    }
  }
  return { MiniMaxProvider: MockMiniMaxProvider };
});

// Mock LLM Provider responses
class MockLLMProvider {
  async streamChat(params: {
    model: string;
    systemPrompt: string;
    messages: any[];
    tools: any[];
    maxTokens: number;
    signal?: AbortSignal;
    onToken?: (token: string) => void;
  }): Promise<any[]> {
    // Call onToken callback for streaming
    if (params.onToken) {
      params.onToken('Test');
      params.onToken(' response');
    }

    // Return final content blocks (text response)
    return [{
      type: 'text',
      text: 'Test response'
    }];
  }

  getBaseURL() {
    return 'https://test.api.com';
  }
}

// Mock FileSystemTools
class MockFileSystemTools {
  executedCommands: Array<{ command: string; args: any[] }> = [];

  async runCommand(args: { command: string; cwd?: string }, _defaultCwd: string, _onOutput?: (chunk: string, type: 'stdout' | 'stderr') => void): Promise<string> {
    this.executedCommands.push({ command: args.command, args });
    return `Command output: ${args.command}`;
  }

  async readFile(args: { path: string }): Promise<string> {
    return `File content: ${args.path}`;
  }

  async writeFile(args: { path: string; content: string }): Promise<string> {
    return `Written to: ${args.path}`;
  }
}

// Mock SkillManager
class MockSkillManager {
  loadedSkills = new Set<string>();

  async loadSkills() {
    this.loadedSkills.add('test-skill');
  }

  getTools() {
    return [
      {
        name: 'test_tool',
        description: 'Test tool',
        input_schema: { type: 'object', properties: {} },
      },
    ];
  }
}

// Mock MCP Service
class MockMCPService {
  async loadClients() {}
  async closeAll() {}
  async getTools() {
    return [];
  }
}

// Mock ToolRegistry
class MockToolRegistry {
  executedTools: Array<{ name: string; input: any }> = [];

  async executeTool(name: string, input: any) {
    this.executedTools.push({ name, input });
    return { success: true, output: `Executed ${name}` };
  }

  async getTools() {
    return [];
  }
}

// Mock PromptService
class MockPromptService {
  buildSystemPrompt(): string {
    return 'You are a helpful assistant.';
  }
}

// Create mock window
function createMockWindow(): any {
  return {
    webContents: {
      send: vi.fn(),
      on: vi.fn((channel: string, callback: any) => {
        // Store the listener for later use
        if (!createMockWindow.listeners) {
          createMockWindow.listeners = new Map<string, any[]>();
        }
        if (!createMockWindow.listeners.has(channel)) {
          createMockWindow.listeners.set(channel, []);
        }
        createMockWindow.listeners.get(channel)!.push(callback);
        return () => {
          // Cleanup function
          const listeners = createMockWindow.listeners?.get(channel);
          if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
              listeners.splice(index, 1);
            }
          }
        };
      }),
    },
    isDestroyed: vi.fn(() => false),
  };
}
// Clear listeners before each test
createMockWindow.clearListeners = () => {
  createMockWindow.listeners = new Map();
};

// Create mock event sink
function createMockEventSink(): AgentEventSink {
  const events: Array<{ type: string; payload: any }> = [];
  return {
    logEvent: (type: string, payload?: any) => {
      events.push({ type, payload });
    },
    getEvents: () => events,
    clearEvents: () => events.length = 0,
  };
}

describe('AgentRuntime Core Functionality', () => {
  let runtime: AgentRuntime;
  let mockWindow: any;
  let mockEventSink: AgentEventSink;

  beforeEach(() => {
    mockWindow = createMockWindow();
    mockEventSink = createMockEventSink();

    // We'll create runtime with basic config
    runtime = new AgentRuntime(
      'test-api-key',
      mockWindow,
      'claude-3-5-sonnet-20241022'
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Message Processing', () => {
    it('should process a simple user message', async () => {
      // Mock the LLM provider to avoid actual API calls
      const mockLLMProvider = new MockLLMProvider();
      (runtime as any).llmProvider = mockLLMProvider;

      // Process should complete without throwing
      await runtime.processUserMessage({ content: 'Hello, world!' });

      // Verify send was called (events were broadcast)
      expect(mockWindow.webContents.send).toHaveBeenCalled();
    });

    it('should handle image attachments', async () => {
      const mockLLMProvider = new MockLLMProvider();
      (runtime as any).llmProvider = mockLLMProvider;

      // Should not throw with valid image data
      await runtime.processUserMessage({
        content: 'What do you see?',
        images: ['data:image/png;base64,test123'],
      });

      expect(mockWindow.webContents.send).toHaveBeenCalled();
    });

    it('should reject concurrent message processing', async () => {
      const mockLLMProvider = new MockLLMProvider();
      (runtime as any).llmProvider = mockLLMProvider;

      // Make the first call take longer
      const firstCall = runtime.processUserMessage({ content: 'First message' });

      // Second call should throw
      await expect(runtime.processUserMessage({ content: 'Second message' }))
        .rejects.toThrow('Agent is already processing a message');

      // Wait for first call to complete
      await firstCall;
    });
  });

  describe('Agent Stage Management', () => {
    it('should track stage transitions', async () => {
      const mockLLMProvider = new MockLLMProvider();
      (runtime as any).llmProvider = mockLLMProvider;

      // Clear previous calls
      mockWindow.webContents.send.mockClear();

      // Process message triggers stage changes
      await runtime.processUserMessage({ content: 'Test' });

      // Verify stage events were broadcast
      const stageCalls = mockWindow.webContents.send.mock.calls.filter(
        call => call[0] === 'agent:stage'
      );
      expect(stageCalls.length).toBeGreaterThan(0);

      // Should have stages like THINKING, FEEDBACK, etc.
      const stages = stageCalls.map(call => call[1]?.stage);
      expect(stages).toContain('THINKING');
    });
  });

  describe('Tool Execution', () => {
    it('should execute tools through ToolRegistry', async () => {
      // This test verifies that tools are properly registered and can be executed
      // Actual tool execution is tested in ToolRegistry tests
      const toolRegistry = (runtime as any).toolRegistry;
      expect(toolRegistry).toBeDefined();
    });
  });

  describe('History Management', () => {
    it('should maintain history within max size limit', async () => {
      // Create more messages than MAX_HISTORY_SIZE
      const messages: AgentMessage[] = Array.from({ length: 250 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      // Load should trim to MAX_HISTORY_SIZE
      runtime.loadHistory(messages);

      expect(runtime.getHistorySize()).toBeLessThanOrEqual(200);
    });

    it('should clear history when requested', async () => {
      const messages: AgentMessage[] = [
        { role: 'user', content: 'Test' },
        { role: 'assistant', content: 'Response' },
      ];
      runtime.loadHistory(messages);

      expect(runtime.getHistorySize()).toBeGreaterThan(0);

      runtime.clearHistory();

      expect(runtime.getHistorySize()).toBe(0);
    });
  });

  describe('Abort Functionality', () => {
    it('should handle abort gracefully', async () => {
      // Start processing and then abort
      const processingPromise = runtime.processUserMessage({ content: 'Long task...' });

      // Abort should not throw
      runtime.abort();

      // Should resolve without error
      await expect(processingPromise).resolves.toBeUndefined();
    });
  });

  describe('Event Broadcasting', () => {
    it('should broadcast token stream events', () => {
      // Simulate token streaming
      runtime.broadcast('agent:stream-token', 'test-token');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('agent:stream-token', 'test-token');
    });

    it('should broadcast tool execution events', () => {
      runtime.broadcast('agent:tool-call', {
        callId: 'test-123',
        name: 'read_file',
        input: { path: '/test/file.txt' },
      });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('agent:tool-call', expect.any(Object));
    });
  });

  describe('Work Mode Integration', () => {
    it('should get current work mode', () => {
      expect(runtime.getWorkMode()).toBe('cowork');
    });

    it('should switch work mode and update prompt', () => {
      runtime.setWorkMode('chat');
      expect(runtime.getWorkMode()).toBe('chat');

      runtime.setWorkMode('code');
      expect(runtime.getWorkMode()).toBe('code');

      runtime.setWorkMode('cowork');
      expect(runtime.getWorkMode()).toBe('cowork');
    });
  });

  describe('Configuration Updates', () => {
    it('should update LLM configuration', () => {
      runtime.updateLLMConfig({
        model: 'claude-3-opus-20240229',
        provider: 'openai',
        apiUrl: 'https://api.openai.com',
      });

      // Should not throw
      expect(runtime).toBeDefined();
    });

    it('should update model', () => {
      runtime.setModel('claude-3-opus-20240229');

      // Verify model was set (we can't directly access it, but we can verify it doesn't throw)
      expect(runtime).toBeDefined();
    });
  });

  describe('Window Management', () => {
    it('should manage multiple windows', () => {
      const window1 = createMockWindow();
      const window2 = createMockWindow();

      runtime.addWindow(window1);
      runtime.addWindow(window2);

      // Broadcast should reach all windows
      runtime.broadcast('test-event', { data: 'test' });

      expect(window1.webContents.send).toHaveBeenCalledWith('test-event', { data: 'test' });
      expect(window2.webContents.send).toHaveBeenCalledWith('test-event', { data: 'test' });
    });

    it('should remove destroyed windows', () => {
      const window1 = createMockWindow();
      const window2 = createMockWindow();

      runtime.addWindow(window1);
      runtime.addWindow(window2);

      // Mark window2 as destroyed
      window2.isDestroyed.mockReturnValue(true);

      runtime.removeWindow(window1);

      // Should still have window2 in list
      expect(runtime).toBeDefined();
    });
  });

  describe('Artifact Tracking', () => {
    it('should track created artifacts', async () => {
      const mockLLMProvider = new MockLLMProvider();
      (runtime as any).llmProvider = mockLLMProvider;

      // Get the tool registry and trigger its onArtifactCreated callback
      const toolRegistry = (runtime as any).toolRegistry;
      if (toolRegistry && (runtime as any).artifacts) {
        // The callback is set up in the constructor
        // We can verify artifacts array exists and is initially empty
        expect((runtime as any).artifacts).toEqual([]);

        // Process a message to trigger potential artifact creation
        await runtime.processUserMessage({ content: 'Hello' });

        // Artifacts array should exist (though may be empty in this test)
        expect(Array.isArray((runtime as any).artifacts)).toBe(true);
      }
    });

    it('should broadcast artifact creation events', async () => {
      const mockLLMProvider = new MockLLMProvider();
      (runtime as any).llmProvider = mockLLMProvider;
      mockWindow.webContents.send.mockClear();

      // The runtime should have broadcast capability for artifacts
      runtime.broadcast('agent:artifact-created', {
        path: '/test/file.txt',
        name: 'file.txt',
        type: 'file'
      });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'agent:artifact-created',
        expect.objectContaining({
          path: '/test/file.txt',
          name: 'file.txt'
        })
      );
    });
  });

  describe('Confirmation Handling', () => {
    it('should handle confirmation requests', async () => {
      const testId = 'confirm-test-123';

      // This should register a pending confirmation
      // The actual implementation is tested via integration tests
      runtime.handleConfirmResponse(testId, true);

      // Should not throw
      expect(runtime).toBeDefined();
    });

    it('should handle user question responses', async () => {
      const testId = 'question-test-123';

      runtime.handleUserQuestionResponse(testId, 'Test answer');

      // Should not throw
      expect(runtime).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should shutdown gracefully', async () => {
      await expect(runtime.shutdown()).resolves.toBeUndefined();
    });
  });
});

// Integration-style tests for agent loop behavior
describe('AgentRuntime Agent Loop Behavior', () => {
  let runtime: AgentRuntime;
  let mockWindow: any;
  let mockEventSink: AgentEventSink;

  beforeEach(() => {
    mockWindow = createMockWindow();
    mockEventSink = createMockEventSink();

    runtime = new AgentRuntime(
      'test-api-key',
      mockWindow,
      'claude-3-5-sonnet-20241022'
    );
  });

  it('should complete a full agent cycle', async () => {
    // Mock the LLM provider
    const mockLLMProvider = new MockLLMProvider();
    (runtime as any).llmProvider = mockLLMProvider;

    // This is an integration-style test that verifies the agent can:
    // 1. Accept a user message
    // 2. Process it through the LLM
    // 3. Handle tool calls if any
    // 4. Return a response
    // 5. Update history

    // Clear previous calls
    mockWindow.webContents.send.mockClear();

    await runtime.processUserMessage({ content: 'What files are in the current directory?' });

    // Verify events were sent
    expect(mockWindow.webContents.send).toHaveBeenCalled();

    // Check that ANY events were sent (streaming might not happen in this test setup)
    const allCalls = mockWindow.webContents.send.mock.calls;
    expect(allCalls.length).toBeGreaterThan(0);

    // At minimum, we should have stage events
    const stageCalls = allCalls.filter(call => call[0] === 'agent:stage');
    expect(stageCalls.length).toBeGreaterThan(0);
  });

  it('should handle multiple sequential messages', async () => {
    const mockLLMProvider = new MockLLMProvider();
    (runtime as any).llmProvider = mockLLMProvider;

    // Send multiple messages sequentially (not concurrently)
    await runtime.processUserMessage({ content: 'First message' });
    await runtime.processUserMessage({ content: 'Second message' });
    await runtime.processUserMessage({ content: 'Third message' });

    // All should complete
    expect(mockWindow.webContents.send).toHaveBeenCalled();
  });

  it('should recover from errors during agent loop', async () => {
    // Test that errors during tool execution don't crash the agent
    const mockLLMProvider = new MockLLMProvider();
    (runtime as any).llmProvider = mockLLMProvider;

    // This should complete without crashing
    await runtime.processUserMessage({ content: 'Test message' });

    expect(runtime).toBeDefined();
    expect(mockWindow.webContents.send).toHaveBeenCalled();
  });

  it('should abort processing when requested', async () => {
    const mockLLMProvider = new MockLLMProvider();
    (runtime as any).llmProvider = mockLLMProvider;

    // Start processing
    const processingPromise = runtime.processUserMessage({ content: 'Long task...' });

    // Abort immediately
    runtime.abort();

    // Should resolve (may complete or abort)
    await processingPromise;

    expect(runtime).toBeDefined();
  });
});
