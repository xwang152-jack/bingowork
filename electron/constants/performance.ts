/**
 * Performance optimization constants
 * Configures timeouts, debouncing, and caching strategies
 */

export const PERFORMANCE_CONFIG = {
    /** Debounce delay for search/filter inputs (ms) */
    SEARCH_DEBOUNCE_MS: 300,

    /** Throttle delay for scroll events (ms) */
    SCROLL_THROTTLE_MS: 100,

    /** Delay before showing loading indicator (ms) */
    LOADING_DELAY_MS: 150,

    /** Delay before hiding loading indicator (ms) */
    LOADING_HIDE_DELAY_MS: 200,

    /** Maximum number of items to render without virtualization */
    MAX_NON_VIRTUAL_ITEMS: 100,

    /** Number of items to render beyond viewport (for virtualization) */
    OVERSCAN_COUNT: 3,

    /** Estimated item height for virtualization (px) */
    ESTIMATED_ITEM_HEIGHT: 60,

    /** Connection timeout for API calls (ms) */
    API_TIMEOUT_MS: 30000,

    /** Retry delay for failed requests (ms) */
    RETRY_DELAY_MS: 1000,

    /** Maximum number of retries */
    MAX_RETRIES: 3,

    /** Cache TTL for session data (ms) */
    SESSION_CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes

    /** Cache TTL for config data (ms) */
    CONFIG_CACHE_TTL_MS: 10 * 60 * 1000, // 10 minutes

    /** Debounce delay for auto-save (ms) */
    AUTOSAVE_DEBOUNCE_MS: 1000,

    /** Idle time before showing inactivity warning (ms) */
    INACTIVITY_WARNING_MS: 30 * 60 * 1000, // 30 minutes

    /** Idle time before auto-logout (ms) */
    AUTO_LOGOUT_MS: 60 * 60 * 1000, // 60 minutes
} as const;

/**
 * Animation and transition durations (ms)
 */
export const ANIMATION_DURATION = {
    FAST: 150,
    NORMAL: 200,
    SLOW: 300,
    VERY_SLOW: 500,
} as const;

/**
 * Batch update timing
 */
export const BATCH_CONFIG = {
    /** Maximum time to wait before flushing batch updates (ms) */
    MAX_BATCH_DELAY_MS: 50,

    /** Maximum number of updates to batch */
    MAX_BATCH_SIZE: 100,

    /** Minimum time between batch flushes (ms) */
    MIN_BATCH_INTERVAL_MS: 16, // ~60fps
} as const;

/**
 * Resource hints for performance
 */
export const RESOURCE_HINTS = {
    /** Domains to preconnect to */
    PRECONNECT_TO: [
        'https://open.bigmodel.cn',
    ],

    /** DNS prefetch domains */
    DNS_PREFETCH: [
        'open.bigmodel.cn',
    ],
} as const;
