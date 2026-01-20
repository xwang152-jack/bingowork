/**
 * Centralized configuration constants for Bingowork
 * All magic numbers and configuration values should be defined here
 */

// ============================================
// Agent Configuration
// ============================================
export const AGENT_CONFIG = {
    /** Maximum number of agent iterations before stopping */
    MAX_ITERATIONS: 30,
    /** Maximum tokens for LLM responses */
    MAX_TOKENS: 4096,
    /** Delay in ms before retrying a failed operation */
    RETRY_DELAY_MS: 5000,
    /** Timeout for agent operations */
    AGENT_TIMEOUT_MS: 300000, // 5 minutes
} as const;

// ============================================
// Tool Timeouts
// ============================================
export const TOOL_TIMEOUTS = {
    /** Command execution timeout (2 minutes) */
    COMMAND: 120_000,
    /** Browser operations timeout (30 seconds) */
    BROWSER: 30_000,
    /** File operations timeout (10 seconds) */
    FILE: 10_000,
    /** Default tool timeout */
    DEFAULT: 10_000,
    /** Maximum output characters from command execution */
    MAX_OUTPUT_CHARS: 1_000_000,
} as const;

// ============================================
// UI Timeouts
// ============================================
export const UI_TIMEOUTS = {
    /** Auto-collapse floating ball after inactivity */
    FLOATING_BALL_COLLAPSE: 3000,
    /** Delay before focusing input */
    INPUT_FOCUS_DELAY: 100,
    /** Toast notification dismiss delay */
    TOAST_DISMISS: 2000,
    /** Settings save confirmation delay */
    SETTINGS_SAVED: 2000,
    /** Debounce delay for search/filter inputs */
    SEARCH_DEBOUNCE: 300,
} as const;

// ============================================
// UI Dimensions
// ============================================
export const UI_DIMENSIONS = {
    /** Floating ball - collapsed size */
    FLOATING_BALL_COLLAPSED_SIZE: 64,
    /** Floating ball - expanded width */
    FLOATING_BALL_EXPANDED_WIDTH: 340,
    /** Floating ball - expanded height */
    FLOATING_BALL_EXPANDED_HEIGHT: 320,
} as const;

// ============================================
// Window Configuration
// ============================================
export const WINDOW_CONFIG = {
    /** Main window dimensions */
    MAIN: {
        WIDTH: 900,
        HEIGHT: 700,
        MIN_WIDTH: 600,
        MIN_HEIGHT: 400,
    },
    /** Floating ball window dimensions */
    FLOATING_BALL: {
        WIDTH: 500,
        HEIGHT: 600,
        MIN_WIDTH: 400,
        MIN_HEIGHT: 300,
    },
    /** Settings window dimensions */
    SETTINGS: {
        WIDTH: 700,
        HEIGHT: 600,
    },
} as const;

// ============================================
// Storage Limits
// ============================================
export const STORAGE_LIMITS = {
    /** Maximum number of sessions to store */
    MAX_SESSIONS: 100,
    /** Maximum number of messages per session */
    MAX_MESSAGES_PER_SESSION: 10000,
    /** Maximum error history entries */
    MAX_ERROR_HISTORY: 100,
    /** Maximum model history entries */
    MAX_MODEL_HISTORY: 20,
    /** Maximum LLM profiles to store */
    MAX_LLM_PROFILES: 20,
} as const;

// ============================================
// File Size Limits
// ============================================
export const FILE_SIZE_LIMITS = {
    /** Maximum file size for reading (10MB) */
    MAX_READ_SIZE: 10 * 1024 * 1024,
    /** Maximum image size for upload (5MB) */
    MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    /** Maximum command length */
    MAX_COMMAND_LENGTH: 8000,
} as const;

// ============================================
// Application Identifiers
// ============================================
export const APP_IDENTIFIERS = {
    /** Application ID for Windows */
    APP_USER_MODEL_ID: 'com.bingowork.app',
    /** Custom protocol for deep linking */
    PROTOCOL: 'bingowork',
    /** Config store name */
    CONFIG_STORE_NAME: 'bingowork-config',
    /** Session store name */
    SESSION_STORE_NAME: 'bingowork-sessions',
    /** Task database name */
    TASK_DATABASE_NAME: 'bingowork-tasks.db',
} as const;

// ============================================
// Security Configuration
// ============================================
export const SECURITY_CONFIG = {
    /** Paths that should never be accessed */
    SENSITIVE_PATHS: [
        '/etc/',
        '/usr/bin/',
        '/usr/sbin/',
        '/bin/',
        '/sbin/',
        '/var/root/',
        '/private/etc/',
        '/private/var/root/',
        '.ssh/',
        '.bashrc',
        '.zshrc',
        '.bash_profile',
        '.profile',
        '.bash_history',
        '.zsh_history',
        '.env',
    ],
    /** Dangerous command patterns to block */
    DANGEROUS_COMMAND_PATTERNS: [
        /(^|\s)sudo(\s|$)/i,
        /(^|\s)su(\s|$)/i,
        /(^|\s)shutdown(\s|$)/i,
        /(^|\s)reboot(\s|$)/i,
        /(^|\s)halt(\s|$)/i,
        /(^|\s)poweroff(\s|$)/i,
        /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;:/, // Fork bomb
        /(^|\s)rm\s+-rf\s+\/(\s|$)/i,
        /(^|\s)rm\s+-rf\s+--no-preserve-root(\s|$)/i,
        /(^|\s)mkfs(\.|(\s|$))/i,
        /(^|\s)diskutil\s+erase(disk|volume)(\s|$)/i,
        /(^|\s)dd\s+if=/i,
        /(^|\s)reg\s+delete(\s|$)/i,
        /(^|\s)bcdedit(\s|$)/i,
        /(^|\s)crontab(\s|$)/i,
        /(^|\s)chattr(\s|$)/i,
        /(^|\s)passwd(\s|$)/i,
        /(^|\s)visudo(\s|$)/i,
        /(^|\s)userdel(\s|$)/i,
        /(^|\s)groupdel(\s|$)/i,
    ],
    /** Download and execute patterns to block */
    DOWNLOAD_EXECUTE_PATTERNS: [
        /(curl|wget)\b[^|]*\|\s*(sh|bash|zsh|python|node|perl|ruby|php)\b/i,
        /(powershell|pwsh)\b.*\b(iwr|invoke-webrequest)\b.*\|\s*(iex|invoke-expression)\b/i,
    ],
    /** Network-related command tokens */
    NETWORK_COMMAND_TOKENS: [
        'curl',
        'wget',
        'git',
        'npm',
        'yarn',
        'pnpm',
        'pip',
        'pip3',
        'brew',
        'apt',
        'apt-get',
        'yum',
        'dnf',
        'pacman',
        'powershell',
        'pwsh',
        'Invoke-WebRequest',
        'iwr',
        'nc',
        'ncat',
        'telnet',
        'ssh',
        'scp',
        'sftp',
        'ping',
        'nslookup',
        'dig',
        'host',
        'traceroute',
    ],
    /** Allowed image MIME types */
    ALLOWED_IMAGE_TYPES: [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/webp',
        'image/svg+xml',
    ],
} as const;

// ============================================
// Error Messages (Chinese)
// ============================================
export const ERROR_MESSAGES = {
    COMMAND_EMPTY: '命令不能为空',
    COMMAND_TOO_LONG: '命令过长，已拒绝执行',
    COMMAND_HAS_NULL_BYTE: '命令包含非法字符，已拒绝执行',
    DANGEROUS_COMMAND: '检测到高风险系统命令，已强制拦截',
    SENSITIVE_PATH_BLOCKED: (path: string) => `检测到尝试修改敏感路径 (${path})，已强制拦截`,
    DOWNLOAD_EXECUTE_BLOCKED: '检测到下载并直接执行链路，已强制拦截',
    NETWORK_DISABLED: '当前已关闭网络访问，已拒绝可能联网的命令',
    PERMISSION_DENIED: '权限不足，无法执行此操作',
    FILE_NOT_FOUND: '文件不存在',
    FILE_TOO_LARGE: (maxSize: string) => `文件过大，最大允许 ${maxSize}`,
    INVALID_IMAGE_TYPE: '不支持的图片格式',
    NETWORK_ERROR: '网络请求失败',
    AGENT_TIMEOUT: 'Agent 操作超时',
    LLM_ERROR: 'AI 模型响应错误',
    UNKNOWN_ERROR: '发生未知错误',
} as const;

// ============================================
// Success Messages (Chinese)
// ============================================
export const SUCCESS_MESSAGES = {
    FILE_SAVED: '文件已保存',
    SETTINGS_SAVED: '设置已保存',
    COPIED_TO_CLIPBOARD: '已复制到剪贴板',
    SESSION_CREATED: '新会话已创建',
    SESSION_DELETED: '会话已删除',
    PERMISSION_GRANTED: '权限已授予',
} as const;
