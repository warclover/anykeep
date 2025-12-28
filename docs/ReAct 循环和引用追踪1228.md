# AnyKeep AI 智能化增强实施计划

> **目标**：实现 ReAct 循环和引用追踪系统，提升 AI 助手的智能感
> **预估工期**：10-12 天
> **设计理念**：符合「零接管」原则，无缝集成现有架构

---

## 设计决策

### 1. 思考过程可见性（符合零接管原则）

- **普通用户**：完全隐藏思考过程，只看到最终结果
- **Pro 用户**：可在设置中开启「显示 AI 思考过程」（默认关闭）
- **实现**：通过 `user.settings.showAiThinking` 控制

### 2. 引用追踪触发时机

- **策略**：所有搜索工具调用自动启用（search + semantic_search）
- **理由**：提供更智能的体验，用户无需手动配置
- **实现**：在 OutputEnhancer 中自动检测搜索结果

### 3. 实施策略

- **整体实施**：作为一个完整的 PR，确保两个功能无缝集成
- **渐进发布**：通过 Feature Flags 控制，先内测后全量

---

## 一、架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        UnifiedEngine                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐ │
│  │InputPreprocessor │ →  │ExecutionCoordinator│ → │OutputEnhancer │ │
│  └──────────────────┘    └────────┬─────────┘    └───────┬───────┘ │
│                                   │                      │          │
│                    ┌──────────────┴──────────────┐       │          │
│                    ▼                             ▼       ▼          │
│         ┌──────────────────┐           ┌──────────────────────┐    │
│         │ ReactLoopExecutor│           │  CitationEnricher    │    │
│         │     (新增)       │           │      (新增)          │    │
│         │                  │           │                      │    │
│         │ Think → Act →    │           │ 搜索结果 → [^1] →   │    │
│         │ Observe 循环     │           │ 引用列表            │    │
│         └──────────────────┘           └──────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、实施阶段

### 阶段 1：ReAct 循环增强 (4 天)

#### 1.1 创建类型定义

**文件**：`src/lib/ai-agent/react/types.ts` (新建)

```typescript
export type ReactPhase = "think" | "act" | "observe";

export interface ReactRoundState {
  round: number;
  phase: ReactPhase;
  thinking?: string;
  toolCalls?: Array<{ name: string; args: unknown; result?: unknown }>;
  observation?: string;
  goalAchieved: boolean;
  shouldContinue: boolean;
}

export interface ReactLoopConfig {
  maxRounds?: number; // 默认 5
  showThinking?: boolean; // 默认 true
  thinkingTimeoutMs?: number; // 默认 5000
}
```

#### 1.2 实现 ReAct Prompt 构建器

**文件**：`src/lib/ai-agent/react/react-prompt-builder.ts` (新建)

- `buildReactPrompt()` - 构建增强提示
- `buildThinkingPrompt()` - 思考阶段提示
- `buildObservationPrompt()` - 观察阶段提示

#### 1.3 实现 ReAct 循环执行器

**文件**：`src/lib/ai-agent/react/react-loop-executor.ts` (新建)

```typescript
export class ReactLoopExecutor {
  async *executeWithReact(
    input: string,
    context: AgentContext,
    atomicExecutor: AtomicExecutor,
  ): AsyncGenerator<UnifiedStreamChunk> {
    for (let round = 1; round <= maxRounds; round++) {
      // 1. THINK: 分析当前状态
      yield { type: "thinking", data: { phase: "react_think", ... } };

      // 2. ACT: 调用工具或生成响应
      for await (const chunk of atomicExecutor(input, context)) {
        yield chunk;
      }

      // 3. OBSERVE: 分析结果，决定是否继续
      if (goalAchieved || noToolCalls) break;
    }
  }
}
```

#### 1.4 集成到 ExecutionCoordinator

**文件**：`src/lib/ai-skills/engine/execution-coordinator.ts` (修改)

```typescript
// 在 executeAtomic() 方法中添加
if (FeatureFlags.ENABLE_REACT_LOOP && this.reactExecutor) {
  yield *
    this.reactExecutor.executeWithReact(input, context, this.atomicExecutor);
} else {
  yield * this.atomicExecutor(input, context);
}
```

#### 1.5 添加 Feature Flag

**文件**：`src/lib/ai-agent/config/feature-flags.ts` (修改)

```typescript
get ENABLE_REACT_LOOP(): boolean {
  return process.env.ENABLE_REACT_LOOP === "true";
}
```

#### 1.6 编写测试

**文件**：`src/lib/ai-agent/react/__tests__/react-loop-executor.test.ts` (新建)

- 正常循环流程 (1-5 轮)
- 提前达成目标退出
- 最大轮次限制
- 超时处理

---

### 阶段 2：引用追踪系统 (4 天)

#### 2.1 创建类型定义

**文件**：`src/lib/ai-agent/citation/types.ts` (新建)

```typescript
export interface Citation {
  index: number; // 引用编号 (1-based)
  bookmarkId: number;
  title: string;
  url: string;
  platform?: string;
}

export interface CitationIndex {
  conversationId: string;
  citations: Map<number, Citation>;
  nextIndex: number;
}
```

#### 2.2 实现引用索引器

**文件**：`src/lib/ai-agent/citation/citation-indexer.ts` (新建)

```typescript
export class CitationIndexer {
  // 为搜索结果建立引用索引
  indexSearchResults(conversationId, searchResults, query): CitationIndex;

  // 获取书签的引用编号
  getCitation(conversationId, bookmarkId): Citation | null;

  // 获取所有引用
  getAllCitations(conversationId): Citation[];
}
```

#### 2.3 实现引用标注器

**文件**：`src/lib/ai-agent/citation/citation-annotator.ts` (新建)

```typescript
export class CitationAnnotator {
  // 在文本中插入引用标注
  // "根据第一篇文章..." → "根据第一篇文章[^1]..."
  annotate(text: string, citations: Citation[]): CitationAnnotationResult;
}
```

#### 2.4 实现引用渲染器

**文件**：`src/lib/ai-agent/citation/citation-renderer.ts` (新建)

```typescript
export class CitationRenderer {
  // 生成引用列表 Markdown
  // ---
  // **参考来源**
  // [^1]: [标题](url)
  renderReferences(citations: Citation[]): string;
}
```

#### 2.5 实现引用增强器

**文件**：`src/lib/ai-agent/citation/citation-enricher.ts` (新建)

```typescript
export class CitationEnricher {
  // 处理搜索结果，建立引用索引
  processSearchResults(conversationId, searchResults, query): CitationChunk;

  // 增强 AI 响应文本（添加引用标注 + 引用列表）
  enrichResponse(text: string, conversationId: string): string;
}
```

#### 2.6 扩展输出类型

**文件**：`src/lib/ai-skills/output/types.ts` (修改)

```typescript
// 扩展 ThinkingChunk.phase
phase: "react_think" | "react_act" | "react_observe" | ...

// 新增 CitationChunk
export interface CitationChunk {
  type: "citation";
  data: {
    indexed: boolean;
    totalCitations: number;
    citationSummary: Array<{ index: number; title: string; bookmarkId: number }>;
  };
}
```

#### 2.7 集成到 OutputEnhancer

**文件**：`src/lib/ai-skills/engine/output-enhancer.ts` (修改)

- 检测搜索工具调用结果
- 建立引用索引
- 在 done 块中增强文本

#### 2.8 更新 Prompt 添加引用指导

**文件**：`src/lib/ai-agent/core/prompts/knowledge-agent.prompt.ts` (修改)

```typescript
const CITATION_GUIDANCE = `
## 引用规范
当回答基于搜索结果时，使用"第N篇"引用，系统会自动转换为脚注。
示例: "根据第一篇文章[^1]，React 18 引入了..."
`;
```

#### 2.9 添加 Feature Flag

**文件**：`src/lib/ai-agent/config/feature-flags.ts` (修改)

```typescript
get ENABLE_CITATION_TRACKING(): boolean {
  return process.env.ENABLE_CITATION_TRACKING === "true";
}
```

#### 2.10 编写测试

**文件**：`src/lib/ai-agent/citation/__tests__/` (新建)

- `citation-indexer.test.ts`
- `citation-annotator.test.ts`
- `citation-renderer.test.ts`
- `citation-enricher.test.ts`

---

### 阶段 3：前端集成 (2-3 天)

#### 3.1 更新 SSE 解析器

**文件**：`src/hooks/use-ai-chat.ts` (修改)

- 处理 `thinking` 块 (ReAct 阶段)
- 处理 `citation` 块

#### 3.2 思考过程展示组件

**文件**：`src/components/ai/react-thinking-display.tsx` (新建)

- 显示 ReAct 循环的每一轮
- 支持折叠/展开

#### 3.3 引用渲染组件

**文件**：`src/components/ai/citation-reference.tsx` (新建)

- 渲染 `[^N]` 为可点击链接
- Tooltip 显示书签标题

---

### 阶段 4：测试与文档 (1-2 天)

#### 4.1 集成测试

**文件**：`src/lib/ai-agent/__tests__/integration/react-citation-integration.test.ts`

#### 4.2 E2E 测试

**文件**：`e2e/ai-react-citation.spec.ts`

#### 4.3 更新文档

- `docs/AI_CAPABILITY_CONFIG.md` - 添加新 Feature Flags 说明
- `CLAUDE.md` - 更新 AI 架构章节

---

## 三、关键文件索引

| 操作 | 文件路径                                                  |
| ---- | --------------------------------------------------------- |
| 新建 | `src/lib/ai-agent/react/types.ts`                         |
| 新建 | `src/lib/ai-agent/react/react-prompt-builder.ts`          |
| 新建 | `src/lib/ai-agent/react/react-loop-executor.ts`           |
| 新建 | `src/lib/ai-agent/react/index.ts`                         |
| 新建 | `src/lib/ai-agent/citation/types.ts`                      |
| 新建 | `src/lib/ai-agent/citation/citation-indexer.ts`           |
| 新建 | `src/lib/ai-agent/citation/citation-annotator.ts`         |
| 新建 | `src/lib/ai-agent/citation/citation-renderer.ts`          |
| 新建 | `src/lib/ai-agent/citation/citation-enricher.ts`          |
| 新建 | `src/lib/ai-agent/citation/index.ts`                      |
| 修改 | `src/lib/ai-skills/engine/execution-coordinator.ts`       |
| 修改 | `src/lib/ai-skills/engine/output-enhancer.ts`             |
| 修改 | `src/lib/ai-skills/output/types.ts`                       |
| 修改 | `src/lib/ai-agent/config/feature-flags.ts`                |
| 修改 | `src/lib/ai-agent/core/prompts/knowledge-agent.prompt.ts` |
| 新建 | `src/components/ai/react-thinking-display.tsx`            |
| 新建 | `src/components/ai/citation-reference.tsx`                |

---

## 四、风险与缓解

| 风险                      | 缓解措施                             |
| ------------------------- | ------------------------------------ |
| ReAct 多轮循环增加延迟    | Feature Flag 默认关闭；设置每轮超时  |
| 引用标注错误              | 仅标注高置信度匹配；提供手动关闭选项 |
| 新 Chunk 类型导致前端报错 | 前端添加 unknown type 容错           |
| ReAct 无限循环            | 硬性最大轮次限制 (5)；总超时保护     |

---

## 五、验收标准

### ReAct 循环

- [ ] 用户可在 UI 中看到 AI 的思考过程
- [ ] 最多 5 轮循环后自动终止
- [ ] 达成目标后提前退出
- [ ] Feature Flag 可正常开关

### 引用追踪

- [ ] 搜索结果自动建立引用索引
- [ ] AI 响应中包含 `[^N]` 格式引用
- [ ] 响应末尾包含引用列表
- [ ] 引用可点击跳转到书签

---

## 六、环境变量与用户设置

### Feature Flags（系统级）

```bash
# .env.local
ENABLE_REACT_LOOP=false        # ReAct 循环（默认关闭，灰度发布用）
ENABLE_CITATION_TRACKING=true  # 引用追踪（默认开启，自动对所有搜索启用）
```

### 用户设置（个人偏好）

```typescript
// profiles.ai_preferences 字段扩展
interface AiPreferences {
  // ... 现有字段
  showAiThinking?: boolean; // 显示 AI 思考过程（仅 Pro 用户可见，默认 false）
}
```

---

## 七、与现有系统的集成点

### 1. 零接管模式集成

- ReAct 循环的思考过程 → 复用现有 `ThinkingChunk` 类型
- 置信度计算 → 复用 `enhanced-confidence.ts`

### 2. 记忆系统集成

- 引用索引 → 复用 `SessionMemory.lastSearchResults`
- 序数引用 → 复用 `ReferenceResolver`

### 3. 输出层集成

- 引用标注 → 在 `OutputEnhancer.enhance()` 中处理
- 引用列表 → 追加到 `DoneChunk.data.summary`

### 4. 用户设置集成

- `showAiThinking` → 扩展现有 `profiles.ai_preferences`
- 设置页面 → 复用现有 AI 设置 UI
