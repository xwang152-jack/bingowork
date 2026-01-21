/**
 * IPC Channel Constants
 * Centralized definition of all IPC channel names used in the application
 * Prevents typos and enables easy refactoring
 */

/**
 * Agent-related IPC channels
 */
export const AGENT_CHANNELS = {
  // Messaging
  SEND_MESSAGE: 'agent:send-message',
  SEND_MESSAGE_ALIAS: 'agent:sendMessage', // Alias for compatibility
  ABORT: 'agent:abort',

  // Events (from main to renderer)
  STREAM_TOKEN: 'agent:stream-token',
  HISTORY_UPDATE: 'agent:history-update',
  STAGE: 'agent:stage',
  TOOL_CALL: 'agent:tool-call',
  TOOL_RESULT: 'agent:tool-result',
  TOOL_OUTPUT_STREAM: 'agent:tool-output-stream',
  CONFIRM_REQUEST: 'agent:confirm-request',
  USER_QUESTION: 'agent:user-question',
  ARTIFACT_CREATED: 'agent:artifact-created',
  ERROR: 'agent:error',
  STATUS: 'agent:status',

  // Confirmation responses
  CONFIRM_RESPONSE: 'agent:confirm-response',
  USER_QUESTION_RESPONSE: 'agent:user-question-response',

  // Session management
  NEW_SESSION: 'agent:new-session',

  // Authorization
  AUTHORIZE_FOLDER: 'agent:authorize-folder',
  GET_AUTHORIZED_FOLDERS: 'agent:get-authorized-folders',
  SET_WORKING_DIR: 'agent:set-working-dir',
  SET_WORK_MODE: 'agent:set-work-mode',
} as const;

/**
 * Session management IPC channels
 */
export const SESSION_CHANNELS = {
  CREATE: 'session:create',
  LIST: 'session:list',
  GET: 'session:get',
  LOAD: 'session:load',
  SAVE: 'session:save',
  DELETE: 'session:delete',
  RENAME: 'session:rename',
  CURRENT: 'session:current',
} as const;

/**
 * Configuration management IPC channels
 */
export const CONFIG_CHANNELS = {
  GET_ALL: 'config:get-all',
  SET_ALL: 'config:set-all',
  GET_API_KEY: 'config:get-api-key',
  SET_MODEL: 'config:set-model',
  UPDATED: 'config:updated', // Event: config updated notification
} as const;

/**
 * Model management IPC channels
 */
export const MODEL_CHANNELS = {
  GET_STATE: 'models:get-state',
  SET_ACTIVE: 'models:set-active',
  UPDATE_PROVIDER: 'models:update-provider',
  ADD_CUSTOM_MODEL: 'models:add-custom-model',
  DELETE_CUSTOM_MODEL: 'models:delete-custom-model',
  CHECK_CONNECTION: 'models:check-connection',
  UPDATED: 'models:updated', // Event: model registry updated
} as const;

/**
 * Permission management IPC channels
 */
export const PERMISSION_CHANNELS = {
  LIST: 'permissions:list',
  REVOKE: 'permissions:revoke',
  CLEAR: 'permissions:clear',
} as const;

/**
 * Window management IPC channels
 */
export const WINDOW_CHANNELS = {
  MINIMIZE: 'window:minimize',
  MAXIMIZE: 'window:maximize',
  CLOSE: 'window:close',
} as const;

/**
 * Dialog IPC channels
 */
export const DIALOG_CHANNELS = {
  SELECT_FOLDER: 'dialog:select-folder',
} as const;

/**
 * Shell operations IPC channels
 */
export const SHELL_CHANNELS = {
  OPEN_PATH: 'shell:open-path',
} as const;

/**
 * Floating ball IPC channels
 */
export const FLOATING_BALL_CHANNELS = {
  TOGGLE: 'floating-ball:toggle',
  SHOW_MAIN: 'floating-ball:show-main',
  START_DRAG: 'floating-ball:start-drag',
  MOVE: 'floating-ball:move',
  STATE_CHANGED: 'floating-ball:state-changed', // Event
} as const;

/**
 * Global shortcut IPC channels
 */
export const SHORTCUT_CHANNELS = {
  UPDATE: 'shortcut:update',
} as const;

/**
 * MCP (Model Context Protocol) IPC channels
 */
export const MCP_CHANNELS = {
  GET_CONFIG: 'mcp:get-config',
  SAVE_CONFIG: 'mcp:save-config',
} as const;

/**
 * Skills management IPC channels
 */
export const SKILLS_CHANNELS = {
  LIST: 'skills:list',
  GET: 'skills:get',
  SAVE: 'skills:save',
  DELETE: 'skills:delete',
} as const;

/**
 * Todo management IPC channels
 */
export const TODO_CHANNELS = {
  LIST: 'todo:list',
  REFRESH: 'todo:refresh',
  UPDATED: 'todo:updated',
} as const;

/**
 * All IPC channels grouped by category
 */
export const IPC_CHANNELS = {
  AGENT: AGENT_CHANNELS,
  SESSION: SESSION_CHANNELS,
  CONFIG: CONFIG_CHANNELS,
  MODEL: MODEL_CHANNELS,
  PERMISSION: PERMISSION_CHANNELS,
  WINDOW: WINDOW_CHANNELS,
  DIALOG: DIALOG_CHANNELS,
  SHELL: SHELL_CHANNELS,
  FLOATING_BALL: FLOATING_BALL_CHANNELS,
  SHORTCUT: SHORTCUT_CHANNELS,
  MCP: MCP_CHANNELS,
  SKILLS: SKILLS_CHANNELS,
  TODO: TODO_CHANNELS,
} as const;

/**
 * Type-safe channel names
 */
export type IpcChannel =
  | (typeof AGENT_CHANNELS)[keyof typeof AGENT_CHANNELS]
  | (typeof SESSION_CHANNELS)[keyof typeof SESSION_CHANNELS]
  | (typeof CONFIG_CHANNELS)[keyof typeof CONFIG_CHANNELS]
  | (typeof MODEL_CHANNELS)[keyof typeof MODEL_CHANNELS]
  | (typeof PERMISSION_CHANNELS)[keyof typeof PERMISSION_CHANNELS]
  | (typeof WINDOW_CHANNELS)[keyof typeof WINDOW_CHANNELS]
  | (typeof DIALOG_CHANNELS)[keyof typeof DIALOG_CHANNELS]
  | (typeof SHELL_CHANNELS)[keyof typeof SHELL_CHANNELS]
  | (typeof FLOATING_BALL_CHANNELS)[keyof typeof FLOATING_BALL_CHANNELS]
  | (typeof SHORTCUT_CHANNELS)[keyof typeof SHORTCUT_CHANNELS]
  | (typeof MCP_CHANNELS)[keyof typeof MCP_CHANNELS]
  | (typeof SKILLS_CHANNELS)[keyof typeof SKILLS_CHANNELS]
  | (typeof TODO_CHANNELS)[keyof typeof TODO_CHANNELS];

/**
 * Event-only channels (main → renderer, one-way communication)
 */
export const EVENT_CHANNELS = {
  [AGENT_CHANNELS.STREAM_TOKEN]: true,
  [AGENT_CHANNELS.HISTORY_UPDATE]: true,
  [AGENT_CHANNELS.STAGE]: true,
  [AGENT_CHANNELS.TOOL_CALL]: true,
  [AGENT_CHANNELS.TOOL_RESULT]: true,
  [AGENT_CHANNELS.TOOL_OUTPUT_STREAM]: true,
  [AGENT_CHANNELS.CONFIRM_REQUEST]: true,
  [AGENT_CHANNELS.USER_QUESTION]: true,
  [AGENT_CHANNELS.ARTIFACT_CREATED]: true,
  [AGENT_CHANNELS.ERROR]: true,
  [AGENT_CHANNELS.STATUS]: true,
  [CONFIG_CHANNELS.UPDATED]: true,
  [MODEL_CHANNELS.UPDATED]: true,
  [FLOATING_BALL_CHANNELS.STATE_CHANGED]: true,
  [TODO_CHANNELS.UPDATED]: true,
} as const;

/**
 * Check if a channel is an event-only channel
 */
export function isEventChannel(channel: IpcChannel): boolean {
  return channel in EVENT_CHANNELS;
}

/**
 * Get all event channels
 */
export function getEventChannels(): readonly string[] {
  return Object.keys(EVENT_CHANNELS) as readonly string[];
}
