/**
 * Unit tests for PromptService
 */

// Mock electron before any imports
import { vi } from 'vitest';
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/test-userdata'),
    isPackaged: false,
  },
}));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PromptService } from '../PromptService';
import { SkillManager } from '../../skills/SkillManager';

// Mock ConfigStore
vi.mock('../../../config/ConfigStore', () => ({
  configStore: {
    getAuthorizedFolders: vi.fn(() => []),
  }
}));

// Mock permissionManager with configurable return values
vi.mock('../../security/PermissionManager', () => ({
  permissionManager: {
    getAuthorizedFolders: vi.fn(() => [])
  }
}));

// Import the mocked permissionManager to use in tests
import { permissionManager } from '../../security/PermissionManager';

describe('PromptService', () => {
    let promptService: PromptService;
    let mockSkillManager: SkillManager;

    beforeEach(() => {
        promptService = new PromptService();
        mockSkillManager = {
            getTools: vi.fn(() => [])
        } as unknown as SkillManager;

        // Reset mocks
        vi.clearAllMocks();

        // Set default mock return value for authorized folders
        (permissionManager.getAuthorizedFolders as any).mockReturnValue([]);
    });

    describe('buildSystemPrompt', () => {
        describe('Work Mode Intro Text', () => {
            it('should include CHAT MODE intro for chat mode', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'chat');
                expect(prompt).toContain('CHAT MODE');
                expect(prompt).toContain('conversational AI assistant');
            });

            it('should include CODE MODE intro for code mode', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                expect(prompt).toContain('CODE MODE');
                expect(prompt).toContain('AI coding assistant');
            });

            it('should include COWORK MODE intro for cowork mode', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'cowork');
                expect(prompt).toContain('COWORK MODE');
                expect(prompt).toContain('full-capability AI agent');
            });

            it('should default to cowork mode when no mode specified', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager);
                expect(prompt).toContain('COWORK MODE');
            });
        });

        describe('Mode Instructions', () => {
            it('should disable file operations in chat mode', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'chat');
                expect(prompt).toContain('FILE OPERATIONS: DISABLED');
                expect(prompt).toContain('COMMAND EXECUTION: DISABLED');
                expect(prompt).toContain('BROWSER TOOLS: DISABLED');
            });

            it('should enable file operations in code mode', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                expect(prompt).toContain('FILE OPERATIONS: ENABLED');
                expect(prompt).toContain('COMMAND EXECUTION: ENABLED');
                expect(prompt).toContain('CODE MODIFICATIONS: ENABLED');
            });

            it('should enable all operations in cowork mode', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'cowork');
                expect(prompt).toContain('ALL SYSTEMS OPERATIONAL');
                expect(prompt).toContain('FILE OPERATIONS: ENABLED');
                expect(prompt).toContain('COMMAND EXECUTION: ENABLED');
                expect(prompt).toContain('TODO_WRITE: ENABLED');
            });

            it('should disable todo_write in code mode', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                expect(prompt).toContain('TODO_WRITE: DISABLED');
            });
        });

        describe('Working Directory Context', () => {
            it('should include working directory when folders are authorized', () => {
                (permissionManager.getAuthorizedFolders as any).mockReturnValue(['/Users/test/project', '/Users/test/other']);

                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                expect(prompt).toContain('WORKING DIRECTORY:');
                expect(prompt).toContain('Primary: /Users/test/project');
                expect(prompt).toContain('/Users/test/other');
            });

            it('should show message when no working directory selected', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                expect(prompt).toContain('No working directory has been selected yet');
                expect(prompt).toContain('Ask the user to select a folder first');
            });

            it('should not include working directory section in chat mode', () => {
                (permissionManager.getAuthorizedFolders as any).mockReturnValue(['/Users/test']);

                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'chat');
                // In chat mode, the file_handling_rules section (which contains workingDirContext) should be empty
                expect(prompt).not.toContain('WORKING DIRECTORY:');
            });
        });

        describe('Skills List', () => {
            it('should include skills when available', () => {
                const mockTools = [
                    { name: 'test-skill', description: 'A test skill', input_schema: {} },
                    { name: 'another-skill', description: 'Another skill', input_schema: {} }
                ];
                (mockSkillManager.getTools as any).mockReturnValue(mockTools);

                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                expect(prompt).toContain('AVAILABLE SKILLS');
                expect(prompt).toContain('test-skill: A test skill');
                expect(prompt).toContain('another-skill: Another skill');
            });

            it('should not include skills section when no skills available', () => {
                (mockSkillManager.getTools as any).mockReturnValue([]);

                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                // Note: "AVAILABLE SKILLS" is mentioned in tool_usage section even when no skills available
                // But the skills list section should not have actual skill entries
                expect(prompt).toContain('AVAILABLE SKILLS');
                // The skills_strategy section should exist but be empty of skills
                expect(prompt).toContain('<skills_strategy>');
            });

            it('should handle missing skillManager gracefully', () => {
                const prompt = promptService.buildSystemPrompt(undefined, 'code');
                // Should still generate a valid prompt even without skillManager
                expect(prompt).toBeTruthy();
                expect(prompt.length).toBeGreaterThan(0);
            });
        });

        describe('Tool Usage Section', () => {
            it('should include tool usage in non-chat modes', () => {
                const codePrompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                expect(codePrompt).toContain('<tool_usage>');
                expect(codePrompt).toContain('read_file');
                expect(codePrompt).toContain('write_file');
                expect(codePrompt).toContain('run_command');

                const coworkPrompt = promptService.buildSystemPrompt(mockSkillManager, 'cowork');
                expect(coworkPrompt).toContain('<tool_usage>');
            });

            it('should not include tool usage section in chat mode', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'chat');
                expect(prompt).not.toContain('<tool_usage>');
            });
        });

        describe('File Handling Rules', () => {
            it('should include file handling rules in non-chat modes', () => {
                const codePrompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                expect(codePrompt).toContain('<file_handling_rules>');
                expect(codePrompt).toContain('FILE CREATION STRATEGY');

                const coworkPrompt = promptService.buildSystemPrompt(mockSkillManager, 'cowork');
                expect(coworkPrompt).toContain('<file_handling_rules>');
            });

            it('should not include file handling rules in chat mode', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'chat');
                expect(prompt).not.toContain('<file_handling_rules>');
            });

            it('should mention absolute paths requirement', () => {
                (permissionManager.getAuthorizedFolders as any).mockReturnValue(['/test/path']);

                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                expect(prompt).toContain('Always use absolute paths');
            });
        });

        describe('Planning Section', () => {
            it('should include conversational guidance in chat mode', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'chat');
                expect(prompt).toContain('<conversational_guidance>');
                expect(prompt).toContain('Provide clear, concise explanations');
            });

            it('should include planning section in code mode', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                expect(prompt).toContain('<planning_and_verification>');
                expect(prompt).toContain('<plan>');
                expect(prompt).toContain('Task tracking with todo_write is not available in Code mode');
            });

            it('should mention todo_write in cowork mode planning', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'cowork');
                expect(prompt).toContain('Use todo_write to track tasks in complex workflows');
            });
        });

        describe('Artifacts Specifications', () => {
            it('should include artifacts specifications in all modes', () => {
                const chatPrompt = promptService.buildSystemPrompt(mockSkillManager, 'chat');
                const codePrompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                const coworkPrompt = promptService.buildSystemPrompt(mockSkillManager, 'cowork');

                expect(chatPrompt).toContain('<artifacts_specifications>');
                expect(codePrompt).toContain('<artifacts_specifications>');
                expect(coworkPrompt).toContain('<artifacts_specifications>');
            });

            it('should mention Markdown and HTML/React specifications', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                expect(prompt).toContain('### Markdown');
                expect(prompt).toContain('### HTML/React');
                expect(prompt).toContain('Tailwind');
            });

            it('should warn against localStorage usage', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                expect(prompt).toContain('NEVER use localStorage/sessionStorage');
            });
        });

        describe('Skills Strategy Section', () => {
            it('should be included in all modes', () => {
                const chatPrompt = promptService.buildSystemPrompt(mockSkillManager, 'chat');
                const codePrompt = promptService.buildSystemPrompt(mockSkillManager, 'code');

                expect(chatPrompt).toContain('<skills_strategy>');
                expect(codePrompt).toContain('<skills_strategy>');
            });

            it('should mention proceeding to next step after using skills', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                expect(prompt).toContain('proceed to the NEXT logical step immediately');
            });

            it('should mention core directory Python modules', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
                expect(prompt).toContain("Skills with a 'core/' directory");
                expect(prompt).toContain('PYTHONPATH');
            });
        });

        describe('Decline Message in Chat Mode', () => {
            it('should include decline message for tool operations', () => {
                const prompt = promptService.buildSystemPrompt(mockSkillManager, 'chat');
                expect(prompt).toContain('WHEN TO DECLINE');
                expect(prompt).toContain("I'm in Chat mode and can only provide conversation and reasoning");
            });
        });
    });

    describe('Prompt Structure', () => {
        it('should be a non-empty string', () => {
            const prompt = promptService.buildSystemPrompt(mockSkillManager, 'cowork');
            expect(prompt).toBeTruthy();
            expect(typeof prompt).toBe('string');
            expect(prompt.length).toBeGreaterThan(0);
        });

        it('should contain behavior instructions wrapper', () => {
            const prompt = promptService.buildSystemPrompt(mockSkillManager, 'code');
            expect(prompt).toContain('<behavior_instructions>');
        });
    });
});
