/**
 * TokenBuffer - Batches token streaming to reduce IPC overhead
 *
 * This class accumulates tokens and flushes them periodically to reduce
 * the frequency of IPC communication, improving performance significantly.
 */

export class TokenBuffer {
    private buffer: string[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private totalBufferedChars = 0;

    constructor(
        private readonly onToken: (tokens: string) => void,
        private readonly batchSize: number = 10,      // Flush after N tokens
        private readonly flushInterval: number = 50   // Or every N milliseconds
    ) {}

    /**
     * Add a token to the buffer
     */
    add(token: string): void {
        this.buffer.push(token);
        this.totalBufferedChars += token.length;

        // Flush if we've reached the batch size
        if (this.buffer.length >= this.batchSize) {
            this.flush();
            return;
        }

        // Otherwise, schedule a delayed flush
        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => {
                this.flush();
            }, this.flushInterval);
        }
    }

    /**
     * Flush the buffer immediately
     */
    flush(): void {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        if (this.buffer.length > 0) {
            const combined = this.buffer.join('');
            this.onToken(combined);
            this.buffer = [];
            this.totalBufferedChars = 0;
        }
    }

    /**
     * Force flush and cleanup
     */
    destroy(): void {
        this.flush();
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
    }
}

/**
 * Create a token buffering wrapper for the onToken callback
 */
export function createTokenBuffer(
    onToken: (token: string) => void,
    batchSize?: number,
    flushInterval?: number
): TokenBuffer {
    return new TokenBuffer(onToken, batchSize, flushInterval);
}
