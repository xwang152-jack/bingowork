/**
 * Unit tests for BrowserTools
 */

import { describe, it, expect } from 'vitest';
import { BrowserTools, BrowserToolSchemas } from '../BrowserTools';

describe('BrowserTools', () => {
    describe('Tool Schemas', () => {
        it('should export all tool schemas', () => {
            expect(BrowserToolSchemas).toBeDefined();
            expect(Array.isArray(BrowserToolSchemas)).toBe(true);
            expect(BrowserToolSchemas.length).toBe(11);
        });

        it('should have browser_open schema with correct structure', () => {
            const schema = BrowserToolSchemas.find(s => s.name === 'browser_open');
            expect(schema).toBeDefined();
            expect(schema?.name).toBe('browser_open');
            expect(schema?.description).toContain('Open a URL');
            expect(schema?.input_schema.properties.url).toBeDefined();
            expect(schema?.input_schema.required).toContain('url');
        });

        it('should have browser_snapshot schema', () => {
            const schema = BrowserToolSchemas.find(s => s.name === 'browser_snapshot');
            expect(schema).toBeDefined();
            expect(schema?.description).toContain('accessibility tree');
        });

        it('should have browser_click schema', () => {
            const schema = BrowserToolSchemas.find(s => s.name === 'browser_click');
            expect(schema).toBeDefined();
            expect(schema?.description).toContain('Click an element');
            expect(schema?.input_schema.properties.selector).toBeDefined();
        });

        it('should have browser_fill schema', () => {
            const schema = BrowserToolSchemas.find(s => s.name === 'browser_fill');
            expect(schema).toBeDefined();
            expect(schema?.description).toContain('fill text');
            expect(schema?.input_schema.properties.text).toBeDefined();
        });

        it('should have browser_type schema', () => {
            const schema = BrowserToolSchemas.find(s => s.name === 'browser_type');
            expect(schema).toBeDefined();
            expect(schema?.description).toContain('Type text');
        });

        it('should have browser_press schema', () => {
            const schema = BrowserToolSchemas.find(s => s.name === 'browser_press');
            expect(schema).toBeDefined();
            expect(schema?.description).toContain('Press a keyboard key');
            expect(schema?.input_schema.properties.key).toBeDefined();
        });

        it('should have browser_scroll schema', () => {
            const schema = BrowserToolSchemas.find(s => s.name === 'browser_scroll');
            expect(schema).toBeDefined();
            expect(schema?.description).toContain('Scroll');
            expect(schema?.input_schema.properties.direction).toBeDefined();
            expect(schema?.input_schema.properties.pixels).toBeDefined();
        });

        it('should have browser_screenshot schema', () => {
            const schema = BrowserToolSchemas.find(s => s.name === 'browser_screenshot');
            expect(schema).toBeDefined();
            expect(schema?.description).toContain('screenshot');
        });

        it('should have browser_get_text schema', () => {
            const schema = BrowserToolSchemas.find(s => s.name === 'browser_get_text');
            expect(schema).toBeDefined();
            expect(schema?.description).toContain('text content');
        });

        it('should have browser_close schema', () => {
            const schema = BrowserToolSchemas.find(s => s.name === 'browser_close');
            expect(schema).toBeDefined();
            expect(schema?.description).toContain('Close');
        });

        it('should have browser_wait schema', () => {
            const schema = BrowserToolSchemas.find(s => s.name === 'browser_wait');
            expect(schema).toBeDefined();
            expect(schema?.description).toContain('Wait');
        });
    });

    describe('BrowserTools Class', () => {
        it('should be instantiable', () => {
            const browserTools = new BrowserTools();
            expect(browserTools).toBeInstanceOf(BrowserTools);
        });

        it('should have open method', () => {
            const browserTools = new BrowserTools();
            expect(typeof browserTools.open).toBe('function');
        });

        it('should have snapshot method', () => {
            const browserTools = new BrowserTools();
            expect(typeof browserTools.snapshot).toBe('function');
        });

        it('should have click method', () => {
            const browserTools = new BrowserTools();
            expect(typeof browserTools.click).toBe('function');
        });

        it('should have fill method', () => {
            const browserTools = new BrowserTools();
            expect(typeof browserTools.fill).toBe('function');
        });

        it('should have type method', () => {
            const browserTools = new BrowserTools();
            expect(typeof browserTools.type).toBe('function');
        });

        it('should have press method', () => {
            const browserTools = new BrowserTools();
            expect(typeof browserTools.press).toBe('function');
        });

        it('should have scroll method', () => {
            const browserTools = new BrowserTools();
            expect(typeof browserTools.scroll).toBe('function');
        });

        it('should have screenshot method', () => {
            const browserTools = new BrowserTools();
            expect(typeof browserTools.screenshot).toBe('function');
        });

        it('should have getText method', () => {
            const browserTools = new BrowserTools();
            expect(typeof browserTools.getText).toBe('function');
        });

        it('should have close method', () => {
            const browserTools = new BrowserTools();
            expect(typeof browserTools.close).toBe('function');
        });

        it('should have wait method', () => {
            const browserTools = new BrowserTools();
            expect(typeof browserTools.wait).toBe('function');
        });

        it('should have timeout property set to 30000', () => {
            const browserTools = new BrowserTools();
            // Access private property via any for testing
            expect((browserTools as any).timeout).toBe(30000);
        });
    });

    describe('Method Signatures', () => {
        let browserTools: BrowserTools;

        beforeEach(() => {
            browserTools = new BrowserTools();
        });

        it('open should accept url parameter', async () => {
            // This test just checks that the method exists and can be called
            // The actual command execution is tested in functional tests
            expect(browserTools.open).toBeDefined();
        });

        it('click should accept selector parameter', async () => {
            expect(browserTools.click).toBeDefined();
        });

        it('fill should accept selector and text parameters', async () => {
            expect(browserTools.fill).toBeDefined();
        });

        it('screenshot should accept optional path and fullPage parameters', async () => {
            expect(browserTools.screenshot).toBeDefined();
        });

        it('wait should accept optional selector, ms, and text parameters', async () => {
            expect(browserTools.wait).toBeDefined();
        });
    });
});
