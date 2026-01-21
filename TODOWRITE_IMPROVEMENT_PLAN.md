# TodoWrite 工具改进方案

## 一、当前状态分析

### 1.1 现有实现

**文件位置**: `electron/agent/services/executors/CoreToolExecutors.ts`

**核心功能**:
- 支持 `add`, `update`, `delete`, `list` 四种操作
- 存储位置: `.bingowork-todo.json`
- 仅在 `cowork` 模式下可用

**提示词指示** (`PromptService.ts:122-131`):
```typescript
<planning_and_verification>
    - For complex requests, you MUST start with a <plan> block.
    - Inside <plan>, list the steps you will take as <task> items.
    - - Use todo_write to track tasks in complex workflows.
    - Example:
      <plan>
        <task>Analyze requirements</task>
        <task>Create implementation plan</task>
        <task>Write code</task>
      </plan>
</planning_and_verification>
```

### 1.2 问题识别

| 问题 | 描述 | 影响 |
|-----|------|------|
| **依赖 AI 自觉** | 完全依赖 AI 模型理解并执行提示词指示 | 不一致的使用行为 |
| **无强制机制** | 没有代码层面的强制要求 | 复杂任务可能不使用 |
| **缺少检测** | 无法检测任务是否应该使用 TodoWrite | 用户体验不一致 |
| **UI 集成不完整** | 右侧边栏只显示，不支持交互 | 用户无法直接操作 |

---

## 二、改进方案

### 方案 A: 增强 Prompt 工程 (轻量级)

**优先级**: 低
**实施难度**: 低
**预期效果**: 10-20% 提升

#### A1. 强化提示词指示

在 `PromptService.ts` 中增加更明确的 TodoWrite 使用规则：

```typescript
// 在 <planning_and_verification> 中添加
<todo_mandatory_requirements>
    MANDATORY TODO_WRITE USAGE:
    You MUST use todo_write for ANY task that involves:
    - 3 or more tool calls
    - Multiple file operations
    - Multi-step workflows
    - Any task taking longer than 2 minutes

    WORKFLOW:
    1. Before ANY tool use, check: "Does this task meet TodoWrite criteria?"
    2. If YES: Call todo_write FIRST to create the task list
    3. Mark tasks as in_progress when starting
    4. Mark tasks as completed when done
    5. If NO: Proceed without TodoWrite (simple queries, single operations)

    EXAMPLES OF WHEN TO USE TODO_WRITE:
    ✅ "Create a React component" → Use TodoWrite (multi-step)
    ✅ "Refactor this file" → Use TodoWrite (multiple operations)
    ✅ "Set up the project" → Use TodoWrite (complex workflow)
    ❌ "What's the capital of France?" → Skip (simple query)
    ❌ "Read this file" → Skip (single operation)
    ❌ "Fix this typo" → Skip (trivial change)
</todo_mandatory_requirements>
```

#### A2. 在工具描述中强化

修改 `TodoWriteSchema` 的 description：

```typescript
const TodoWriteSchema: Anthropic.Tool = {
    name: 'todo_write',
    description: `**CRITICAL: MANDATORY FOR MULTI-STEP TASKS**

    Create and manage a task list for tracking progress.

    WHEN YOU MUST USE THIS TOOL:
    - Tasks with 3+ steps
    - Multiple file operations
    - Complex workflows
    - Any work taking >2 minutes

    WHEN TO SKIP:
    - Simple questions (single response)
    - Single file read/write
    - Trivial fixes (<10 seconds)

    This is NOT optional for complex tasks - users expect to see progress tracking.`,
    // ... rest of schema
};
```

---

### 方案 B: 任务复杂度检测 (中量级)

**优先级**: 中
**实施难度**: 中
**预期效果**: 40-60% 提升

#### B1. 添加任务分析器

创建新文件 `electron/agent/services/TaskAnalyzer.ts`:

```typescript
/**
 * Task Complexity Analyzer
 *
 * Analyzes user messages to determine if TodoWrite should be used.
 */

export interface TaskAnalysis {
    requiresTodo: boolean;
    complexity: 'simple' | 'moderate' | 'complex';
    reason: string;
    estimatedSteps?: number;
}

export class TaskAnalyzer {
    /**
     * Analyze a user message to determine if TodoWrite is required
     */
    analyzeMessage(message: string): TaskAnalysis {
        const indicators = this.checkIndicators(message);
        const complexity = this.calculateComplexity(indicators);

        return {
            requiresTodo: complexity.score >= this.THRESHOLD,
            complexity: complexity.level,
            reason: complexity.reason,
            estimatedSteps: complexity.estimatedSteps
        };
    }

    private readonly THRESHOLD = 3; // Minimum score to require TodoWrite

    private checkIndicators(message: string): Indicator[] {
        const lower = message.toLowerCase();
        const indicators: Indicator[] = [];

        // Multi-step keywords
        const multiStepPatterns = [
            /\b(create|build|implement|set up|develop|make)\b/gi,
            /\b(component|module|feature|system|application|project)\b/gi,
            /\b(refactor|rewrite|migrate|convert)\b/gi,
            /\b(test|debug|fix|resolve)\b.*\b(and|then|after|also)\b/gi,
        ];

        // File operation patterns
        const filePatterns = [
            /\b(read|write|create|delete|modify)\b.*\b(file|files)\b/gi,
            /\bmultiple\b/gi,
            /\beach\b/gi,
        ];

        // Time indicators
        const timePatterns = [
            /\b(first|then|next|after|finally|step)\b/gi,
        ];

        // Check patterns
        for (const pattern of multiStepPatterns) {
            const matches = lower.match(pattern);
            if (matches) {
                indicators.push({ type: 'multi-step', weight: 2, count: matches.length });
            }
        }

        for (const pattern of filePatterns) {
            const matches = lower.match(pattern);
            if (matches) {
                indicators.push({ type: 'file-ops', weight: 1.5, count: matches.length });
            }
        }

        for (const pattern of timePatterns) {
            const matches = lower.match(pattern);
            if (matches) {
                indicators.push({ type: 'sequential', weight: 1, count: matches.length });
            }
        }

        return indicators;
    }

    private calculateComplexity(indicators: Indicator[]): {
        score: number;
        level: 'simple' | 'moderate' | 'complex';
        reason: string;
        estimatedSteps: number;
    } {
        const score = indicators.reduce((sum, ind) => sum + (ind.weight * ind.count), 0);
        const estimatedSteps = Math.max(2, Math.ceil(score / 1.5));

        let level: 'simple' | 'moderate' | 'complex';
        let reason: string;

        if (score < 2) {
            level = 'simple';
            reason = 'Single operation or simple query';
        } else if (score < 5) {
            level = 'moderate';
            reason = 'Multiple related operations';
        } else {
            level = 'complex';
            reason = 'Complex multi-step workflow';
        }

        return { score, level, reason, estimatedSteps };
    }
}

interface Indicator {
    type: string;
    weight: number;
    count: number;
}
```

#### B2. 在 AgentRuntime 中集成

修改 `AgentRuntime.ts`，在处理用户消息时添加检测：

```typescript
import { TaskAnalyzer } from './services/TaskAnalyzer';

export class AgentRuntime {
    private taskAnalyzer = new TaskAnalyzer();

    public async processUserMessage(userMessage: string, images?: string[]): Promise<void> {
        // Only analyze in cowork mode
        if (this.workMode === 'cowork') {
            const analysis = this.taskAnalyzer.analyzeMessage(userMessage);

            if (analysis.requiresTodo) {
                // Inject a system reminder to use TodoWrite
                const reminder = `
<SYSTEM REMINDER>
This task has been analyzed as ${analysis.complexity} complexity.
Reason: ${analysis.reason}
Estimated steps: ${analysis.estimatedSteps}

YOU MUST USE todo_write TOOL BEFORE PROCEEDING.
Create a task list first, then begin execution.
</SYSTEM REMINDER>
`;
                // Prepend to user message or add as system message
                userMessage = reminder + '\n\n' + userMessage;
            }
        }

        // Continue with normal processing...
    }
}
```

---

### 方案 C: 主动式 Todo 创建 (重量级)

**优先级**: 高
**实施难度**: 高
**预期效果**: 80-95% 提升

#### C1. 自动 Todo 创建机制

在开始工具执行前，如果检测到复杂任务，自动创建 Todo 列表：

```typescript
/**
 * Auto-create Todo list for complex tasks
 */
private async ensureTodoList(userMessage: string): Promise<void> {
    if (this.workMode !== 'cowork') return;

    const analysis = this.taskAnalyzer.analyzeMessage(userMessage);

    if (analysis.requiresTodo) {
        // Check if Todo already exists
        const { permissionManager } = await import('./security/PermissionManager');
        const folders = permissionManager.getAuthorizedFolders();
        if (folders.length === 0) return;

        const todoPath = `${folders[0]}/.bingowork-todo.json`;

        try {
            const exists = await fs.access(todoPath).then(() => true).catch(() => false);

            if (!exists) {
                // Auto-generate initial Todo list based on analysis
                const { CoreTools } = await import('./tools/CoreTools');
                const coreTools = new CoreTools();

                const initialTodos = this.generateInitialTodos(userMessage, analysis);

                await coreTools.todoWrite({
                    action: 'overwrite',
                    path: todoPath,
                    content: JSON.stringify(initialTodos, null, 2)
                }, todoPath);

                // Notify user
                this.broadcast('agent:todo-auto-created', {
                    todos: initialTodos,
                    reason: analysis.reason
                });
            }
        } catch (error) {
            console.error('Failed to auto-create Todo list:', error);
        }
    }
}

private generateInitialTodos(message: string, analysis: TaskAnalysis): TodoItem[] {
    // Use LLM to generate initial task breakdown
    // This is a simplified version
    return [
        {
            content: 'Analyze requirements',
            status: 'pending',
            activeForm: 'Analyzing requirements'
        },
        {
            content: 'Create implementation plan',
            status: 'pending',
            activeForm: 'Creating implementation plan'
        },
        {
            content: 'Execute implementation',
            status: 'pending',
            activeForm: 'Executing implementation'
        }
    ];
}
```

#### C2. 工具执行拦截

在 `ToolRegistry` 中添加拦截逻辑：

```typescript
async executeTool(
    name: string,
    input: Record<string, unknown>,
    streamCallback?: (chunk: string, type: 'stdout' | 'stderr') => void
): Promise<string> {
    // Intercept tool calls to check TodoWrite usage
    if (this.workMode === 'cowork' && name !== 'todo_write' && name !== 'ask_user_question') {
        const hasTodo = await this.checkActiveTodo();

        if (!hasTodo && this.currentTaskComplexity >= this.THRESHOLD) {
            // Warning: TodoWrite should be used first
            const warning = `
<SYSTEM WARNING>
You are about to execute tools without using todo_write first.
This task appears to be complex (score: ${this.currentTaskComplexity}).

Consider:
1. Calling todo_write first to create a task list
2. This helps users track progress

Continuing with tool execution...
</SYSTEM WARNING>
`;
            // Could add this as a system message or log
            console.warn('[ToolRegistry] TodoWrite not used for complex task');
        }
    }

    // Continue with normal tool execution
    // ...
}

private async checkActiveTodo(): Promise<boolean> {
    const { permissionManager } = await import('../../security/PermissionManager');
    const folders = permissionManager.getAuthorizedFolders();
    if (folders.length === 0) return false;

    const todoPath = `${folders[0]}/.bingowork-todo.json`;

    try {
        await fs.access(todoPath);
        const content = await fs.readFile(todoPath, 'utf-8');
        const todos = JSON.parse(content);
        return todos.items && todos.items.length > 0;
    } catch {
        return false;
    }
}
```

---

### 方案 D: UI 交互增强 (用户体验)

**优先级**: 中
**实施难度**: 中
**预期效果**: 提升用户感知和可用性

#### D1. 右侧边栏交互支持

修改 `src/components/layout/RightSidebar.tsx`，添加用户交互：

```typescript
// 当前只支持显示，添加以下功能：
const [todoList, setTodoList] = useState<TodoItem[]>([]);

// 添加：点击切换完成状态
const toggleTodoComplete = async (index: number) => {
    const newTodos = [...todoList];
    newTodos[index].completed = !newTodos[index].completed;

    // 调用 todo_write 更新
    await window.ipcRenderer.invoke('todo:update', {
        index,
        completed: newTodos[index].completed
    });

    setTodoList(newTodos);
};

// 添加：添加新任务
const addNewTodo = async (content: string) => {
    await window.ipcRenderer.invoke('todo:add', { content });
    // 刷新列表
    loadTodoList();
};

// 添加：删除任务
const deleteTodo = async (index: number) => {
    await window.ipcRenderer.invoke('todo:delete', { index });
    loadTodoList();
};
```

#### D2. 添加操作按钮

```tsx
// 在 Todo 区块添加操作栏
<div className="flex items-center justify-between mb-2">
    <span>任务</span>
    <div className="flex gap-1">
        <button
            onClick={handleAddTodo}
            className="p-1 hover:bg-white/50 rounded"
            title="添加任务"
        >
            <Plus size={14} />
        </button>
        <button
            onClick={refreshTodos}
            className="p-1 hover:bg-white/50 rounded"
            title="刷新"
        >
            <RefreshCw size={14} />
        </button>
    </div>
</div>
```

---

## 三、推荐实施路径

### 阶段 1: 快速改进 (1-2 天)

1. **实施方案 A1**: 强化提示词指示
2. **实施方案 A2**: 增强工具描述

**预期效果**: 15-20% 使用率提升

### 阶段 2: 智能检测 (3-5 天)

1. **实施方案 B1**: 创建 TaskAnalyzer
2. **实施方案 B2**: 集成到 AgentRuntime

**预期效果**: 50% 使用率提升

### 阶段 3: 强制机制 (1 周)

1. **实施方案 C1**: 自动 Todo 创建
2. **实施方案 C2**: 工具执行拦截

**预期效果**: 80%+ 使用率

### 阶段 4: UX 增强 (3-4 天)

1. **实施方案 D1**: UI 交互支持
2. **实施方案 D2**: 操作按钮

**预期效果**: 用户满意度显著提升

---

## 四、风险评估

| 风险 | 描述 | 缓解措施 |
|-----|------|---------|
| **过度强制** | 自动创建 Todo 可能干扰用户 | 添加用户配置选项 |
| **误判复杂度** | 简单任务被标记为复杂 | 调整检测阈值，允许覆盖 |
| **性能影响** | 每次消息都执行分析 | 缓存分析结果，轻量级算法 |
| **模型对抗** | AI 可能忽略系统提醒 | 多层提醒，工具级拦截 |

---

## 五、成功指标

| 指标 | 当前 | 目标 | 测量方法 |
|-----|------|------|---------|
| **复杂任务 Todo 使用率** | ~30% | 80% | 分析日志数据 |
| **用户满意度** | N/A | 4.5/5 | 用户反馈调查 |
| **任务完成时间** | 基准 | -10% | 任务时长对比 |
| **重复任务率** | N/A | -20% | 任务重新创建频率 |

---

## 六、总结

TodoWrite 工具的改进需要多层次的方法：

1. **提示词层面**: 强化 AI 理解和使用意图
2. **检测层面**: 智能识别需要 Todo 的任务
3. **强制层面**: 自动创建和拦截机制
4. **体验层面**: 用户可直接交互的 UI

建议按照阶段实施路径逐步推进，每个阶段都进行效果评估和调整。最终目标是让复杂任务的 TodoWrite 使用率达到 80% 以上，同时保持对简单任务的非侵入性。
