import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Browser Tool Schemas
export const BrowserOpenSchema = {
    name: "browser_open",
    description: "Open a URL in the browser. This starts a browser session if not already running.",
    input_schema: {
        type: "object" as const,
        properties: {
            url: { type: "string", description: "The URL to navigate to." }
        },
        required: ["url"]
    }
};

export const BrowserSnapshotSchema = {
    name: "browser_snapshot",
    description: "Get the accessibility tree of the current page with element refs. Use this to understand page structure and find elements to interact with.",
    input_schema: {
        type: "object" as const,
        properties: {}
    }
};

export const BrowserClickSchema = {
    name: "browser_click",
    description: "Click an element on the page. Use refs from snapshot (e.g., @e1) or CSS selectors.",
    input_schema: {
        type: "object" as const,
        properties: {
            selector: { type: "string", description: "Element ref (e.g., @e1) or CSS selector." }
        },
        required: ["selector"]
    }
};

export const BrowserFillSchema = {
    name: "browser_fill",
    description: "Clear and fill text into an input element.",
    input_schema: {
        type: "object" as const,
        properties: {
            selector: { type: "string", description: "Element ref (e.g., @e1) or CSS selector." },
            text: { type: "string", description: "Text to fill into the input." }
        },
        required: ["selector", "text"]
    }
};

export const BrowserTypeSchema = {
    name: "browser_type",
    description: "Type text into an element (appends to existing content).",
    input_schema: {
        type: "object" as const,
        properties: {
            selector: { type: "string", description: "Element ref (e.g., @e1) or CSS selector." },
            text: { type: "string", description: "Text to type." }
        },
        required: ["selector", "text"]
    }
};

export const BrowserPressSchema = {
    name: "browser_press",
    description: "Press a keyboard key (e.g., Enter, Tab, Control+a).",
    input_schema: {
        type: "object" as const,
        properties: {
            key: { type: "string", description: "Key to press (e.g., 'Enter', 'Tab', 'Control+a')." }
        },
        required: ["key"]
    }
};

export const BrowserScrollSchema = {
    name: "browser_scroll",
    description: "Scroll the page in a direction.",
    input_schema: {
        type: "object" as const,
        properties: {
            direction: { type: "string", description: "Scroll direction: up, down, left, or right." },
            pixels: { type: "number", description: "Number of pixels to scroll. Default is 500." }
        },
        required: ["direction"]
    }
};

export const BrowserScreenshotSchema = {
    name: "browser_screenshot",
    description: "Take a screenshot of the current page.",
    input_schema: {
        type: "object" as const,
        properties: {
            path: { type: "string", description: "Path to save the screenshot. If not provided, saves to current directory." },
            fullPage: { type: "boolean", description: "Capture full page instead of visible viewport." }
        }
    }
};

export const BrowserGetTextSchema = {
    name: "browser_get_text",
    description: "Get the text content of an element.",
    input_schema: {
        type: "object" as const,
        properties: {
            selector: { type: "string", description: "Element ref (e.g., @e1) or CSS selector." }
        },
        required: ["selector"]
    }
};

export const BrowserCloseSchema = {
    name: "browser_close",
    description: "Close the browser session.",
    input_schema: {
        type: "object" as const,
        properties: {}
    }
};

export const BrowserWaitSchema = {
    name: "browser_wait",
    description: "Wait for an element to appear, for a specific time, or for page load.",
    input_schema: {
        type: "object" as const,
        properties: {
            selector: { type: "string", description: "CSS selector to wait for (optional)." },
            ms: { type: "number", description: "Milliseconds to wait (optional)." },
            text: { type: "string", description: "Text to wait for (optional)." }
        }
    }
};

// All browser tool schemas for easy registration
export const BrowserToolSchemas = [
    BrowserOpenSchema,
    BrowserSnapshotSchema,
    BrowserClickSchema,
    BrowserFillSchema,
    BrowserTypeSchema,
    BrowserPressSchema,
    BrowserScrollSchema,
    BrowserScreenshotSchema,
    BrowserGetTextSchema,
    BrowserCloseSchema,
    BrowserWaitSchema
];

export class BrowserTools {
    private timeout = 30000; // 30 second timeout

    private async runBrowserCommand(command: string): Promise<string> {
        try {
            const { stdout, stderr } = await execAsync(`agent-browser ${command}`, {
                timeout: this.timeout,
                maxBuffer: 1024 * 1024 * 5,
                encoding: 'utf-8'
            });
            let result = stdout || '';
            if (stderr) result += `\nSTDERR: ${stderr}`;
            return result || 'Command completed.';
        } catch (error: unknown) {
            const err = error as { stdout?: string; stderr?: string; message?: string };
            let errorMsg = `Browser command failed: ${command}\n`;
            if (err.stdout) errorMsg += `STDOUT: ${err.stdout}\n`;
            if (err.stderr) errorMsg += `STDERR: ${err.stderr}\n`;
            errorMsg += `Error: ${err.message || String(error)}`;
            return errorMsg;
        }
    }

    async open(args: { url: string }): Promise<string> {
        return this.runBrowserCommand(`open "${args.url}"`);
    }

    async snapshot(): Promise<string> {
        return this.runBrowserCommand('snapshot');
    }

    async click(args: { selector: string }): Promise<string> {
        return this.runBrowserCommand(`click "${args.selector}"`);
    }

    async fill(args: { selector: string; text: string }): Promise<string> {
        return this.runBrowserCommand(`fill "${args.selector}" "${args.text}"`);
    }

    async type(args: { selector: string; text: string }): Promise<string> {
        return this.runBrowserCommand(`type "${args.selector}" "${args.text}"`);
    }

    async press(args: { key: string }): Promise<string> {
        return this.runBrowserCommand(`press "${args.key}"`);
    }

    async scroll(args: { direction: string; pixels?: number }): Promise<string> {
        const px = args.pixels || 500;
        return this.runBrowserCommand(`scroll ${args.direction} ${px}`);
    }

    async screenshot(args: { path?: string; fullPage?: boolean }): Promise<string> {
        let cmd = 'screenshot';
        if (args.path) cmd += ` "${args.path}"`;
        if (args.fullPage) cmd += ' --full';
        return this.runBrowserCommand(cmd);
    }

    async getText(args: { selector: string }): Promise<string> {
        return this.runBrowserCommand(`get text "${args.selector}"`);
    }

    async close(): Promise<string> {
        return this.runBrowserCommand('close');
    }

    async wait(args: { selector?: string; ms?: number; text?: string }): Promise<string> {
        if (args.selector) return this.runBrowserCommand(`wait "${args.selector}"`);
        if (args.ms) return this.runBrowserCommand(`wait ${args.ms}`);
        if (args.text) return this.runBrowserCommand(`wait --text "${args.text}"`);
        return 'No wait condition specified.';
    }
}
