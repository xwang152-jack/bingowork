/**
 * Type definitions for Agent-related operations
 * Provides type-safe alternatives to using `any`
 */

/**
 * API Error response from LLM providers
 */
export interface ApiError {
  status?: number;
  message?: string;
  code?: string;
  type?: string;
}

/**
 * Type guard for API errors
 */
export function isApiError(obj: unknown): obj is ApiError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ('status' in obj || 'message' in obj || 'code' in obj)
  );
}

/**
 * LLM Provider configuration
 */
export interface LLMConfig {
  apiKey: string;
  model: string;
  apiUrl: string;
  provider: 'anthropic' | 'openai' | 'minimax';
}

/**
 * Tool execution input
 */
export interface ToolInput {
  [key: string]: unknown;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * User message with optional images
 */
export interface UserMessageWithImages {
  content: string;
  images: string[];
}

/**
 * User message (string or object with images)
 */
export type UserMessage = string | UserMessageWithImages;

/**
 * Type guard for user message with images
 */
export function isUserMessageWithImages(msg: UserMessage): msg is UserMessageWithImages {
  return typeof msg === 'object' && msg !== null && 'content' in msg && 'images' in msg;
}

/**
 * Image data in base64 format
 */
export interface Base64Image {
  mediaType: string;
  data: string;
}

/**
 * Parse base64 image data
 */
export function parseBase64Image(imageData: string): Base64Image | null {
  const match = imageData.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mediaType: match[1],
    data: match[2],
  };
}

/**
 * Agent configuration options
 */
export interface AgentConfig {
  apiKey: string;
  window: Electron.BrowserWindow;
  model: string;
  apiUrl: string;
  provider: 'anthropic' | 'openai' | 'minimax';
  eventSink?: AgentEventSink;
}

/**
 * Agent event sink for logging events
 */
export interface AgentEventSink {
  logEvent: (type: string, payload: unknown) => void;
}

/**
 * Tool execution callbacks
 */
export interface ToolCallbacks {
  requestConfirmation: (tool: string, description: string, args: Record<string, unknown>) => Promise<boolean>;
  onArtifactCreated: (artifact: { path: string; name: string; type: string }) => void;
  askUser: (question: string, options?: string[]) => Promise<string>;
  onToolStream?: (chunk: string, type: 'stdout' | 'stderr') => void;
}

/**
 * Tool request confirmation data
 */
export interface ToolConfirmationRequest {
  id: string;
  tool: string;
  description: string;
  args: Record<string, unknown>;
  token?: string;
}

/**
 * Tool confirmation response
 */
export interface ToolConfirmationResponse {
  id: string;
  approved: boolean;
  remember?: boolean;
}

/**
 * User question request
 */
export interface UserQuestionRequest {
  id: string;
  question: string;
  options?: string[];
}

/**
 * User question response
 */
export interface UserQuestionResponse {
  id: string;
  answer: string;
}

/**
 * Agent stage information
 */
export interface AgentStageInfo {
  stage: 'IDLE' | 'THINKING' | 'PLANNING' | 'EXECUTING' | 'FEEDBACK';
  detail?: unknown;
}

/**
 * Tool call event data
 */
export interface ToolCallEvent {
  callId: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result event data
 */
export interface ToolResultEvent {
  callId: string;
  status: 'done' | 'error';
  error?: string;
}

/**
 * Tool output stream event data
 */
export interface ToolOutputStreamEvent {
  callId: string;
  chunk: string;
  type: 'stdout' | 'stderr';
}

/**
 * Agent artifact created event data
 */
export interface ArtifactCreatedEvent {
  path: string;
  name: string;
  type: string;
}

/**
 * Agent with optional work mode setter
 */
export interface AgentWithWorkMode {
  setWorkMode?: (mode: 'chat' | 'code' | 'cowork') => void;
}

/**
 * Cast agent to AgentWithWorkMode type safely
 */
export function asAgentWithWorkMode(agent: unknown): AgentWithWorkMode | null {
  if (
    typeof agent === 'object' &&
    agent !== null &&
    'setWorkMode' in agent &&
    typeof (agent as AgentWithWorkMode).setWorkMode === 'function'
  ) {
    return agent as AgentWithWorkMode;
  }
  return null;
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  id: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Session data
 */
export interface Session extends SessionMetadata {
  messages: Array<{
    role: string;
    content: string | Array<{ type: string; [key: string]: unknown }>;
  }>;
}

/**
 * Permission data
 */
export interface PermissionData {
  tool: string;
  pathPattern?: string;
  grantedAt: number;
}

/**
 * Config update data
 */
export interface ConfigUpdateData {
  provider?: string;
  apiKeys?: Record<string, string>;
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  authorizedFolders?: string[];
  networkAccess?: boolean;
  browserAccess?: boolean;
  shortcut?: string;
  workMode?: 'chat' | 'code' | 'cowork';
}

/**
 * Shell open path result
 */
export interface ShellOpenPathResult {
  success: boolean;
  path?: string;
  method?: 'openPath' | 'showItemInFolder';
  error?: string;
  candidates?: string;
}
