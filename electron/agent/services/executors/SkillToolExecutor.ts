/**
 * Skill Tool Executor
 *
 * Handles user-defined skills that provide instructions to the agent
 */

import {
    ToolExecutor,
    ToolExecutionContext,
    ToolInput,
    ToolResult,
    BaseToolExecutor
} from '../ToolExecutor';
import Anthropic from '@anthropic-ai/sdk';
import { SkillManager } from '../../skills/SkillManager';

// ============================================================================
// Skill Tool Executor
// ============================================================================

class SkillToolExecutor extends BaseToolExecutor {
    readonly name: string;
    readonly schema: Anthropic.Tool;

    constructor(
        private skillManager: SkillManager,
        skillName: string,
        skillSchema: Anthropic.Tool
    ) {
        super();
        this.name = skillName;
        this.schema = skillSchema;
    }

    isAllowedInMode(_mode: 'chat' | 'code' | 'cowork'): boolean {
        return true; // Skills are available in all modes
    }

    async execute(_input: ToolInput, _context: ToolExecutionContext): Promise<ToolResult> {
        const skillInfo = this.skillManager.getSkillInfo(this.name);
        if (!skillInfo) {
            return `Error: Skill ${this.name} not found.`;
        }

        return `[SKILL LOADED: ${this.name}]

SKILL DIRECTORY: ${skillInfo.skillDir}

Follow these instructions to complete the user's request. When the instructions reference Python modules in core/, create your script in the working directory and run it from the skill directory:

run_command: cd "${skillInfo.skillDir}" && python /path/to/your_script.py

Or add to the top of your script:
import sys; sys.path.insert(0, r"${skillInfo.skillDir}")

---
${skillInfo.instructions}
---`;
    }
}

// ============================================================================
// Dynamic Skill Tool Executor Factory
// ============================================================================

/**
 * Create skill tool executors dynamically from loaded skills
 */
export function createSkillToolExecutors(skillManager: SkillManager): ToolExecutor[] {
    const skills = skillManager.getTools();
    const executors: ToolExecutor[] = [];

    for (const skill of skills) {
        const skillName = skill.name;
        const skillSchema: Anthropic.Tool = {
            name: skillName,
            description: skill.description || `User-defined skill: ${skillName}`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            input_schema: (skill.input_schema as any) || {
                type: 'object',
                properties: {},
                required: []
            }
        };
        executors.push(new SkillToolExecutor(skillManager, skillName, skillSchema));
    }

    return executors;
}

/**
 * Check if a tool name is a skill
 */
export function isSkillTool(name: string, skillManager: SkillManager): boolean {
    return skillManager.getSkillInfo(name) !== undefined;
}
