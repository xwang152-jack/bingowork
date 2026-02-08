/**
 * Task Complexity Analyzer
 *
 * Analyzes user messages to determine if TodoWrite should be used.
 * This helps enforce the "mandatory TodoWrite for complex tasks" requirement.
 */

import { logs } from '../../utils/logger';

export interface TaskAnalysis {
    requiresTodo: boolean;
    complexity: 'simple' | 'moderate' | 'complex';
    reason: string;
    estimatedSteps?: number;
    score: number;
}

interface Indicator {
    type: string;
    weight: number;
    count: number;
}

interface Pattern {
    regex: RegExp;
    weight: number;
    type: string;
}

export class TaskAnalyzer {
    // Minimum score to require TodoWrite
    private readonly THRESHOLD = 1;

    // Patterns for detecting multi-step tasks
    private readonly PATTERNS: Pattern[] = [
        // Multi-step keywords (high weight)
        { regex: /\b(create|build|implement|set up|develop|make)\b.*(component|module|feature|system|application|project|app|website)\b/gi, weight: 3, type: 'creation' },
        { regex: /\b(refactor|rewrite|migrate|convert|transform)\b/gi, weight: 2.5, type: 'refactoring' },
        { regex: /\b(test|debug|fix|resolve)\b.*\b(and|then|after|also|plus|additionally)\b/gi, weight: 2, type: 'sequential-work' },

        // File operations (medium weight)
        { regex: /\b(read|write|create|delete|modify|edit)\b.*\b(file|files)\b/gi, weight: 2, type: 'file-ops' },
        { regex: /\bmultiple\b.*(file|files|documents|steps|tasks)\b/gi, weight: 2, type: 'multiple-items' },
        { regex: /\beach\b.*(file|step|task|item)\b/gi, weight: 1.5, type: 'iterative' },

        // Time/sequence indicators (medium weight)
        { regex: /\b(first|then|next|after|finally|step \d+|1\.\s*2\.\s*3\.|firstly|secondly|lastly)\b/gi, weight: 1.5, type: 'sequential' },

        // Development workflows (high weight)
        { regex: /\b(set up|configure|install|initialize)\b.*(project|environment|dependencies)\b/gi, weight: 2.5, type: 'setup' },
        { regex: /\b(deploy|publish|release|build)\b.*(app|application|website|package)\b/gi, weight: 2, type: 'deployment' },
        { regex: /\b(add|implement|integrate)\b.*(feature|functionality|function|method)\b/gi, weight: 2, type: 'feature-work' },

        // Analysis/processing (medium weight)
        { regex: /\b(analyze|process|parse|extract|transform)\b.*(multiple|several|batch|all)\b/gi, weight: 1.5, type: 'batch-processing' },

        // UI/component creation (high weight)
        { regex: /\b(create|build|design|make)\b.*(page|screen|view|interface|ui|component|layout)\b/gi, weight: 2, type: 'ui-work' },

        // Database/backend work (high weight)
        { regex: /\b(create|add|modify|update)\b.*(database|schema|model|api|endpoint|route|controller)\b/gi, weight: 2, type: 'backend-work' },
    ];

    // Patterns that indicate simple tasks (negative weight)
    private readonly SIMPLE_PATTERNS: Pattern[] = [
        { regex: /\b(what|how|why|when|where|who|which|explain|tell me|show me)\b/gi, weight: -1, type: 'question' },
        { regex: /\b(read|open|view|show|display)\b\s+(?!.*and\s)/gi, weight: -0.5, type: 'simple-read' },
        { regex: /^\s*(what|how|tell|explain|is|are|do|does|can|could|would|should)\b/gi, weight: -1, type: 'simple-query' },
    ];

    /**
     * Analyze a user message to determine if TodoWrite is required
     */
    analyzeMessage(message: string): TaskAnalysis {
        const indicators = this.checkIndicators(message);

        // Calculate total score
        const score = this.calculateScore(indicators);

        // Determine complexity and requirements
        const result = this.determineComplexity(score, indicators, message);

        logs.agent.info(`[TaskAnalyzer] Score: ${score}, Requires Todo: ${result.requiresTodo}, Reason: ${result.reason}`);

        return result;
    }

    /**
     * Check for complexity indicators in the message
     */
    private checkIndicators(message: string): Indicator[] {
        const indicators: Indicator[] = [];

        // Check positive patterns (complexity indicators)
        for (const pattern of this.PATTERNS) {
            const matches = message.match(pattern.regex);
            if (matches) {
                indicators.push({
                    type: pattern.type,
                    weight: pattern.weight,
                    count: matches.length
                });
            }
        }

        // Check negative patterns (simplicity indicators)
        for (const pattern of this.SIMPLE_PATTERNS) {
            const matches = message.match(pattern.regex);
            if (matches) {
                indicators.push({
                    type: pattern.type,
                    weight: pattern.weight,
                    count: matches.length
                });
            }
        }

        return indicators;
    }

    /**
     * Calculate total complexity score
     */
    private calculateScore(indicators: Indicator[]): number {
        return indicators.reduce((sum, ind) => sum + (ind.weight * ind.count), 0);
    }

    /**
     * Determine complexity level and generate analysis result
     */
    private determineComplexity(score: number, indicators: Indicator[], _message: string): TaskAnalysis {
        let complexity: 'simple' | 'moderate' | 'complex';
        let reason: string;
        let estimatedSteps: number;

        // Count positive indicators
        const positiveIndicators = indicators.filter(i => i.weight > 0);
        const negativeIndicators = indicators.filter(i => i.weight < 0);

        // Adjust score based on negative indicators
        const adjustedScore = score + (negativeIndicators.reduce((sum, i) => sum + Math.abs(i.weight), 0) * 0.5);

        if (adjustedScore < 0 || negativeIndicators.length > positiveIndicators.length) {
            // Clearly a simple task
            complexity = 'simple';
            reason = this.getSimpleReason(negativeIndicators);
            estimatedSteps = 1;
        } else if (adjustedScore < this.THRESHOLD) {
            complexity = 'simple';
            reason = 'Single operation or simple query';
            estimatedSteps = 1;
        } else if (score < 6) {
            complexity = 'moderate';
            reason = this.getModerateReason(positiveIndicators);
            estimatedSteps = Math.max(2, Math.ceil(score / 2));
        } else {
            complexity = 'complex';
            reason = this.getComplexReason(positiveIndicators);
            estimatedSteps = Math.max(3, Math.ceil(score / 1.5));
        }

        return {
            requiresTodo: score >= this.THRESHOLD && negativeIndicators.length <= positiveIndicators.length,
            complexity,
            reason,
            estimatedSteps,
            score
        };
    }

    /**
     * Get reason for simple task classification
     */
    private getSimpleReason(indicators: Indicator[]): string {
        const types = indicators.map(i => i.type).join(', ');
        return `Simple task: ${types || 'single operation'}`;
    }

    /**
     * Get reason for moderate task classification
     */
    private getModerateReason(indicators: Indicator[]): string {
        const mainIndicators = indicators
            .filter(i => i.weight >= 1.5)
            .map(i => i.type)
            .slice(0, 2)
            .join(' and ');
        return `Multiple operations: ${mainIndicators || 'several steps'}`;
    }

    /**
     * Get reason for complex task classification
     */
    private getComplexReason(indicators: Indicator[]): string {
        const mainIndicators = indicators
            .filter(i => i.weight >= 2)
            .map(i => i.type)
            .slice(0, 3)
            .join(', ');
        return `Complex multi-step workflow: ${mainIndicators || 'multiple phases'}`;
    }

    /**
     * Check if a message is explicitly asking for information only
     */
    isInformationalQuery(message: string): boolean {
        const lower = message.toLowerCase().trim();

        // Check if it starts with question words
        const questionStart = /^(what|how|why|when|where|who|which|explain|tell me|show me|describe|define)/i;

        // Check if it's a short query (< 100 chars)
        const isShort = message.length < 100;

        // Check for absence of action verbs
        const hasActionVerbs = /\b(create|build|make|write|implement|add|modify|delete|fix|set up|install|deploy)\b/i.test(message);

        return questionStart.test(lower) && isShort && !hasActionVerbs;
    }
}
