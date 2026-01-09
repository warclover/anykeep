# AnyKeep AI 助手实用性增强方案

> **版本**: v1.1.0
> **日期**: 2025-01-08
> **状态**: 合规修正版
> **作者**: AI Assistant
> **修订说明**: v1.1.0 对照 AnyKeep 现有实现进行合规性修正，避免重复开发

---

## 0. 合规性声明

### 0.1 现有实现映射表

> ⚠️ **重要**: 本方案中多项功能已在 AnyKeep 代码库中实现。下表列出现有实现与本方案提议的映射关系。

| 方案提议模块                 | 现有实现                      | 文件路径                                                            | 版本  | 状态      |
| ---------------------------- | ----------------------------- | ------------------------------------------------------------------- | ----- | --------- |
| `ReferenceResolver`          | `ReferenceResolver`           | `src/lib/ai-memory/reference-resolver.ts`                           | 1.1.0 | ✅ 已实现 |
| `ConversationMemory`         | `SessionMemory`               | `src/lib/ai-memory/session-memory.ts`                               | 1.0.0 | ✅ 已实现 |
| `IntentInheritance`          | `ReferenceResolver.resolve()` | `src/lib/ai-memory/reference-resolver.ts`                           | 1.1.0 | ✅ 已实现 |
| `PreferencesStore`           | `PreferencesService`          | `src/lib/ai-agent/preferences/preferences-service.ts`               | -     | ✅ 已实现 |
| `BehaviorAnalyzer`           | `PreferenceLearningService`   | `src/lib/ai-agent/preferences/learning-service.ts`                  | -     | ✅ 已实现 |
| `SuggestionEngine`           | `ProactiveBriefingService`    | `src/lib/ai-agent/proactive-briefing/proactive-briefing-service.ts` | 1.0.0 | ✅ 已实现 |
| `StateMonitor`               | `DynamicContextBuilder`       | `src/lib/ai-agent/context/dynamic-context-builder.ts`               | -     | ✅ 已实现 |
| `QuickActionsService`        | -                             | -                                                                   | -     | ⏳ 待实现 |
| `EnhancedResult`             | -                             | -                                                                   | -     | ⏳ 待实现 |
| `ProactiveSuggestionPopover` | -                             | -                                                                   | -     | ⏳ 待实现 |
| `ResultVisualization`        | -                             | -                                                                   | -     | ⏳ 待实现 |

### 0.2 修正策略

本方案从"全新实现"调整为"增强现有实现"：

1. **后端服务层**: 引用现有模块，仅说明扩展点
2. **前端组件层**: 保留待实现的 UI 组件设计
3. **集成层**: 说明如何整合现有模块

---

## 1. 方案概述

### 1.1 背景

AnyKeep 已构建强大的 AI 能力基础（24 Skills、100+ Tools、UnifiedEngine），但在实际使用中仍存在以下问题：

| 问题               | 表现                             | 影响           |
| ------------------ | -------------------------------- | -------------- |
| **上下文理解不足** | 无法识别"那个"、"刚才的"等指代词 | 用户需重复输入 |
| **被动响应**       | AI 不会主动提供建议              | 功能发现率低   |
| **交互体验割裂**   | 结果无法直接操作                 | 需跳转页面完成 |
| **学习能力有限**   | 无法记住用户习惯                 | 重复解释偏好   |

### 1.2 设计目标

| 目标         | 说明             | 衡量指标             |
| ------------ | ---------------- | -------------------- |
| **更懂用户** | 理解上下文和指代 | 指代解析准确率 > 90% |
| **更主动**   | 基于状态主动建议 | 建议采纳率 > 30%     |
| **更便捷**   | 结果可直接操作   | 操作步骤减少 50%     |
| **更个性化** | 记住并学习偏好   | 偏好匹配度 > 80%     |

### 1.3 设计原则

| 原则           | 说明                             |
| -------------- | -------------------------------- |
| **渐进增强**   | 在现有架构上扩展，不破坏已有功能 |
| **用户可控**   | 所有主动行为可关闭，偏好可重置   |
| **透明可解释** | AI 决策有理由，用户可理解        |
| **性能优先**   | 增强功能不影响响应速度           |

---

## 2. 架构设计

### 2.1 增强模块架构（基于现有实现）

```
┌─────────────────────────────────────────────────────────────────┐
│                      UnifiedEngine (现有)                        │
└───────────────────────────────┬─────────────────────────────────┘
                                │
    ┌───────────────────────────┼───────────────────────────────┐
    │                           │                               │
    ▼                           ▼                               ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ Context         │      │ Proactive       │      │ Interaction     │
│ Enhancement     │      │ Service         │      │ Enhancement     │
│ (上下文增强)    │      │ (主动服务)       │      │ (交互增强)       │
│ ✅ 已实现       │      │ ✅ 已实现        │      │ ⏳ 待实现        │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                         │
┌────────┴────────┐      ┌────────┴────────┐      ┌────────┴────────┐
│ ReferenceResolver│      │ ProactiveBrief- │      │ • QuickActions  │
│ SessionMemory    │      │   ingService    │      │ • EnhancedResult│
│ PromptInjector   │      │ ContextBuilder  │      │ • Visualization │
└─────────────────┘      └─────────────────┘      └─────────────────┘
         │                        │                         │
         └────────────────────────┴─────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │ Learning Service          │
                    │ (学习服务) ✅ 已实现       │
                    │ • PreferencesService      │
                    │ • PreferenceLearningService│
                    └───────────────────────────┘
```

### 2.2 模块职责与现有实现

| 模块                       | 职责             | 现有实现                                            | 扩展需求        |
| -------------------------- | ---------------- | --------------------------------------------------- | --------------- |
| **ContextEnhancement**     | 上下文理解和增强 | `ReferenceResolver`, `SessionMemory`                | ⏳ 时间引用解析 |
| **ProactiveService**       | 主动建议生成     | `ProactiveBriefingService`, `DynamicContextBuilder` | ⏳ 更多触发规则 |
| **InteractionEnhancement** | 交互体验优化     | 无                                                  | ⏳ 全部待实现   |
| **LearningService**        | 用户偏好学习     | `PreferencesService`, `PreferenceLearningService`   | ⏳ 规则提取     |

---

## 3. 上下文理解增强（基于现有实现）

### 3.1 现有指代词解析器

> ✅ **已实现**: `src/lib/ai-memory/reference-resolver.ts` v1.1.0

**现有功能**：

- 指示代词解析（这个、那个、这些、那些）
- 序数引用解析（第N篇、最后一篇、前N条）
- 基于 SessionMemory 的上下文追踪

**扩展点**：

```typescript
// 文件: src/lib/ai-memory/reference-resolver.ts
// 扩展: 添加时间引用解析

/**
 * 【待扩展】时间引用解析
 *
 * 在 ReferenceResolver 中添加 resolveTemporal 方法
 */
interface TemporalReference {
  type: "recent_action" | "time_range";
  timeRange?: { start: Date; end: Date };
}

// 在 ReferenceResolver.resolve() 中添加:
// const temporals = this.extractTemporals(message);
// for (const temporal of temporals) {
//   const resolved = await this.resolveTemporal(temporal, state);
//   if (resolved) references.set(temporal.text, resolved);
// }
```

### 3.2 现有会话记忆

> ✅ **已实现**: `src/lib/ai-memory/session-memory.ts` v1.0.0

**现有功能**：

- 会话状态管理（创建、获取、更新）
- 消息历史记录
- 搜索结果缓存
- 提及实体追踪
- 自动过期清理

**扩展点**：

```typescript
// 文件: src/lib/ai-memory/session-memory.ts
// 扩展: 添加追问检测和上下文获取

/**
 * 【待扩展】追问检测
 */
isFollowUp(message: string): boolean {
  const followUpPatterns = [
    /^(那|然后|接着|继续)/,
    /^(还有|另外|此外)/,
    /^(为什么|怎么|什么意思)/,
  ];
  return followUpPatterns.some(p => p.test(message));
}

/**
 * 【待扩展】获取追问上下文
 */
getFollowUpContext(): FollowUpContext | null {
  // 返回最近的意图、实体、结果、工具调用
}
```

### 3.3 现有意图继承

> ✅ **已实现**: 通过 `ReferenceResolver` + `PromptInjector` 组合实现

**现有功能**：

- 意图分类 (`router/intent-classifier.ts`)
- 动态上下文注入 (`context/prompt-injector.ts`)
- 隐含意图规则 (`core/prompts/implicit-intent-rules.ts`)

**无需额外实现**：`IntentInheritanceService` 的功能已由现有模块组合覆盖。

---

## 4. 主动服务能力（基于现有实现）

### 4.1 现有状态监控

> ✅ **已实现**: `src/lib/ai-agent/context/dynamic-context-builder.ts`

**现有功能**：

- 用户收藏统计
- 时间感知（周活跃度）
- 会话状态追踪

**扩展点**：

```typescript
// 文件: src/lib/ai-agent/context/dynamic-context-builder.ts
// 扩展: 添加更多状态维度

/**
 * 【待扩展】扩展 UserContext 接口
 */
interface ExtendedUserContext extends UserContext {
  // 整理状态
  emptyFolders: number;
  duplicateCount: number;
  brokenLinks: number;

  // 学习状态
  pendingReviewCards: number;
  overdueCards: number;
  streakDays: number;

  // 使用模式
  frequentActions: ActionPattern[];
  preferredTimes: TimePattern[];
}
```

### 4.2 现有主动建议引擎

> ✅ **已实现**: `src/lib/ai-agent/proactive-briefing/proactive-briefing-service.ts` v1.0.0

**现有功能**：

- 离线期间变化统计
- 洞察生成
- 建议操作生成
- 自定义洞察生成器注册

**扩展点**：

```typescript
// 文件: src/lib/ai-agent/proactive-briefing/proactive-briefing-service.ts
// 扩展: 添加更多建议规则

// 使用 addInsightGenerator 添加自定义规则:
proactiveBriefingService.addInsightGenerator({
  name: "inbox_overflow_check",
  generate: async (userId, context) => {
    if (context.unclassifiedCount >= 50) {
      return {
        id: generateInsightId(),
        type: "action" as InsightType,
        priority: 85,
        title: "收件箱需要整理",
        description: `您有 ${context.unclassifiedCount} 条未分类书签`,
        // ...
      };
    }
    return null;
  },
});
```

### 4.3 待实现：时机感知服务

> ⏳ **待实现**: 基于用户活跃时间触发通知

```typescript
// 新建文件: src/lib/ai-agent/proactive-briefing/timing-service.ts

import { ProactiveBriefingService } from "./proactive-briefing-service";
import { createClient } from "@/lib/supabase/server";

export class TimingService {
  constructor(private proactiveBriefingService: ProactiveBriefingService) {}

  /**
   * 检查是否应该发送主动通知
   */
  async shouldNotify(userId: string): Promise<boolean> {
    const supabase = await createClient();
    // 获取用户偏好的活跃时段
    // 检查距离上次通知的间隔
    // 返回是否应该通知
  }
}
```

---

## 5. 交互体验优化（待实现）

> ⏳ **全部待实现**: 以下为新增 UI 组件

### 5.1 快捷操作系统

```typescript
// 新建文件: src/lib/ai-agent/interaction/quick-actions.ts

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  action: ActionConfig;
  context: "search_result" | "skill_output" | "message" | "global";
  condition?: string;
}

export class QuickActionsService {
  private actionRegistry: Map<string, QuickAction[]> = new Map();

  /**
   * 获取上下文相关的快捷操作
   */
  getActionsForContext(context: ActionContext): QuickAction[] {
    const contextActions = this.actionRegistry.get(context.type) || [];
    return contextActions.filter(
      (action) =>
        !action.condition || this.evaluateCondition(action.condition, context),
    );
  }

  /**
   * 注册默认快捷操作
   */
  private registerDefaultActions(): void {
    // 搜索结果上下文
    this.actionRegistry.set("search_result", [
      {
        id: "add_tag",
        label: "添加标签",
        icon: "tag",
        action: { type: "open_dialog", dialog: "add_tag" },
        context: "search_result",
      },
      {
        id: "move_to_folder",
        label: "移动到文件夹",
        icon: "folder",
        action: { type: "open_dialog", dialog: "move_folder" },
        context: "search_result",
      },
      {
        id: "generate_summary",
        label: "生成摘要",
        icon: "file-text",
        action: { type: "run_skill", skillId: "summary" },
        context: "search_result",
      },
      {
        id: "read_aloud",
        label: "语音朗读",
        icon: "volume-2",
        action: { type: "run_skill", skillId: "tts_synthesis" },
        context: "search_result",
      },
      {
        id: "create_flashcard",
        label: "创建复习卡",
        icon: "brain",
        action: { type: "run_skill", skillId: "active_recall" },
        context: "search_result",
      },
    ]);
  }
}
```

### 5.2 结果交互增强组件

```typescript
// 新建文件: src/components/ai/enhanced-result.tsx

interface EnhancedResultProps {
  result: SkillOutput;
  context: ResultContext;
}

export function EnhancedResult({ result, context }: EnhancedResultProps) {
  const { actions } = useQuickActions(context);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="relative group">
      {/* 悬浮快捷操作栏 */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <QuickActionBar actions={actions} target={result} />
      </div>

      {/* 渐进披露：默认摘要，点击展开详情 */}
      <CardContent>
        {/* ... */}
      </CardContent>

      {/* 底部操作区 */}
      {result.suggestedActions && (
        <CardFooter className="flex gap-2 flex-wrap">
          {result.suggestedActions.map(action => (
            <ActionButton key={action.id} action={action} />
          ))}
        </CardFooter>
      )}
    </Card>
  );
}
```

### 5.3 快捷操作栏组件

```typescript
// 新建文件: src/components/ai/quick-action-bar.tsx

interface QuickActionBarProps {
  actions: QuickAction[];
  target: unknown;
  orientation?: 'horizontal' | 'vertical';
}

export function QuickActionBar({ actions, target, orientation = 'horizontal' }: QuickActionBarProps) {
  const { executeAction, isExecuting } = useActionExecutor();

  return (
    <div className={cn(
      "flex gap-1 p-1 bg-background/80 backdrop-blur rounded-lg border shadow-sm",
      orientation === 'vertical' && "flex-col"
    )}>
      {actions.slice(0, 5).map(action => (
        <Tooltip key={action.id}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => executeAction(action, target)}
              disabled={isExecuting === action.id}
            >
              <Icon name={action.icon} className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{action.label}</TooltipContent>
        </Tooltip>
      ))}
      {/* 更多操作菜单 */}
    </div>
  );
}
```

### 5.4 可视化增强组件

```typescript
// 新建文件: src/components/ai/result-visualization.tsx

interface ResultVisualizationProps {
  type: 'stats' | 'trend' | 'distribution' | 'comparison';
  data: VisualizationData;
}

export function ResultVisualization({ type, data }: ResultVisualizationProps) {
  switch (type) {
    case 'stats':
      return <StatsCards data={data} />;
    case 'trend':
      return <TrendChart data={data} />;
    case 'distribution':
      return <DistributionChart data={data} />;
    case 'comparison':
      return <ComparisonChart data={data} />;
    default:
      return null;
  }
}
```

---

## 6. 学习能力增强（基于现有实现）

### 6.1 现有偏好持久化服务

> ✅ **已实现**: `src/lib/ai-agent/preferences/preferences-service.ts`

**现有功能**：

- 从 `profiles.ai_preferences` 读取偏好
- 偏好缓存（5分钟 TTL）
- 偏好更新

**扩展点**：

```typescript
// 文件: src/lib/ai-agent/preferences/preferences-service.ts
// 扩展: 添加纠正记录功能

/**
 * 【待扩展】记录用户纠正
 */
async recordCorrection(userId: string, correction: CorrectionRecord): Promise<void> {
  const current = await this.getPreferences(userId);
  const history = current.correctionHistory || [];

  history.push(correction);
  if (history.length > 100) history.shift();

  await this.updatePreferences(userId, { correctionHistory: history });
}
```

### 6.2 现有行为分析服务

> ✅ **已实现**: `src/lib/ai-agent/preferences/learning-service.ts`

**现有功能**：

- 异步行为记录
- 常用标签/文件夹学习
- 偏好自动更新

**扩展点**：

```typescript
// 文件: src/lib/ai-agent/preferences/learning-service.ts
// 扩展: 添加规则提取

/**
 * 【待扩展】从纠正历史中提取规则
 */
async learnFromCorrections(userId: string): Promise<LearnedRule[]> {
  const preferences = await this.preferencesService.getPreferences(userId);
  const corrections = preferences.correctionHistory || [];

  if (corrections.length < 5) return [];

  // 分析纠正模式，提取规则
  // ...
}
```

### 6.3 待实现：反馈闭环机制

> ⏳ **待实现**: 监听用户反馈事件，触发学习

```typescript
// 新建文件: src/lib/ai-agent/learning/feedback-loop.ts

import { PreferencesService } from "../preferences/preferences-service";
import { PreferenceLearningService } from "../preferences/learning-service";

export class FeedbackLoop {
  constructor(
    private preferencesService: PreferencesService,
    private learningService: PreferenceLearningService,
  ) {}

  /**
   * 处理建议被接受
   */
  async handleAccepted(
    userId: string,
    suggestionType: string,
    context: unknown,
  ): Promise<void> {
    // 记录成功案例
    // 增加相关偏好权重
  }

  /**
   * 处理结果被纠正
   */
  async handleCorrected(
    userId: string,
    original: unknown,
    corrected: unknown,
  ): Promise<void> {
    // 记录纠正
    // 触发规则学习
  }
}
```

---

## 7. 前端组件扩展（待实现）

### 7.1 主动建议浮层

```typescript
// 新建文件: src/components/ai/proactive-suggestion-popover.tsx

export function ProactiveSuggestionPopover() {
  const { suggestions, dismiss, execute } = useProactiveSuggestions();
  const [isOpen, setIsOpen] = useState(false);

  if (suggestions.length === 0) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed bottom-20 right-4 h-12 w-12 rounded-full bg-primary shadow-lg"
        >
          <Lightbulb className="h-6 w-6" />
          {suggestions.length > 1 && (
            <Badge className="absolute -top-1 -right-1">{suggestions.length}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-80">
        {/* 建议内容 */}
      </PopoverContent>
    </Popover>
  );
}
```

### 7.2 上下文感知输入框

```typescript
// 新建文件: src/components/ai/context-aware-input.tsx

export function ContextAwareInput({ onSubmit }: ContextAwareInputProps) {
  const [value, setValue] = useState('');
  const { resolvedReferences } = useReferenceResolver(value);
  const { suggestions } = useInputSuggestions(value);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 p-2 border rounded-lg">
        <Input value={value} onChange={(e) => setValue(e.target.value)} />
        <Button onClick={() => onSubmit(value)}>
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* 指代词解析预览 */}
      {resolvedReferences.size > 0 && (
        <div className="absolute -top-10 left-0 right-0 px-2">
          {/* 显示解析结果 */}
        </div>
      )}

      {/* 输入建议 */}
      {suggestions.length > 0 && (
        <div className="absolute top-full mt-1 bg-background border rounded-lg shadow-lg">
          {/* 显示建议列表 */}
        </div>
      )}
    </div>
  );
}
```

### 7.3 偏好设置面板

```typescript
// 新建文件: src/components/settings/ai-preferences-panel.tsx

export function AIPreferencesPanel() {
  const { preferences, updatePreferences, resetPreferences, isLoading } = useAIPreferences();

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 助手偏好</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 信任模式 */}
        {/* 响应风格 */}
        {/* 自动分类置信度阈值 */}
        {/* 常用标签 */}
        {/* 主动建议设置 */}
        {/* 偏好复习时间 */}
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={resetPreferences}>恢复默认设置</Button>
      </CardFooter>
    </Card>
  );
}
```

---

## 8. 实施计划（修订版）

### 8.1 Phase 1: 现有模块扩展 (Week 1)

| 天数    | 任务                               | 产出           | 依赖     |
| ------- | ---------------------------------- | -------------- | -------- |
| Day 1-2 | ReferenceResolver 添加时间引用解析 | 扩展指代解析器 | 现有实现 |
| Day 3-4 | SessionMemory 添加追问检测         | 扩展会话记忆   | 现有实现 |
| Day 5   | 测试扩展功能                       | 测试覆盖       | -        |

### 8.2 Phase 2: 主动服务扩展 (Week 2)

| 天数    | 任务                                  | 产出         | 依赖     |
| ------- | ------------------------------------- | ------------ | -------- |
| Day 6-7 | ProactiveBriefingService 添加更多规则 | 建议规则扩展 | 现有实现 |
| Day 8-9 | TimingService 实现                    | 时机感知服务 | 新增     |
| Day 10  | 测试 + 调优                           | 稳定版本     | -        |

### 8.3 Phase 3: 交互增强 (Week 3-4)

| 天数      | 任务                       | 产出         | 依赖 |
| --------- | -------------------------- | ------------ | ---- |
| Day 11-12 | QuickActionsService        | 快捷操作服务 | 新增 |
| Day 13-14 | EnhancedResult 组件        | 结果交互组件 | 新增 |
| Day 15-16 | QuickActionBar 组件        | 快捷操作栏   | 新增 |
| Day 17-18 | ResultVisualization        | 可视化组件   | 新增 |
| Day 19-20 | ProactiveSuggestionPopover | 建议浮层     | 新增 |

### 8.4 Phase 4: 学习能力扩展 (Week 5)

| 天数      | 任务                        | 产出       | 依赖     |
| --------- | --------------------------- | ---------- | -------- |
| Day 21-22 | PreferencesService 纠正记录 | 偏好扩展   | 现有实现 |
| Day 23-24 | FeedbackLoop 实现           | 反馈闭环   | 新增     |
| Day 25    | AIPreferencesPanel          | 偏好设置UI | 新增     |

---

## 9. 新增文件清单（修订版）

```
src/lib/ai-agent/
├── proactive-briefing/
│   └── timing-service.ts            # ⏳ 时机感知（新增）
├── interaction/
│   ├── quick-actions.ts             # ⏳ 快捷操作（新增）
│   └── action-executor.ts           # ⏳ 操作执行（新增）
└── learning/
    └── feedback-loop.ts             # ⏳ 反馈闭环（新增）

src/components/ai/
├── proactive-suggestion-popover.tsx # ⏳ 建议浮层（新增）
├── context-aware-input.tsx          # ⏳ 上下文输入（新增）
├── enhanced-result.tsx              # ⏳ 增强结果（新增）
├── quick-action-bar.tsx             # ⏳ 快捷操作栏（新增）
└── result-visualization.tsx         # ⏳ 结果可视化（新增）

src/components/settings/
└── ai-preferences-panel.tsx         # ⏳ 偏好设置面板（新增）

src/hooks/
├── use-proactive-suggestions.ts     # ⏳ 主动建议 Hook（新增）
├── use-reference-resolver.ts        # ⏳ 指代解析 Hook（新增）
├── use-quick-actions.ts             # ⏳ 快捷操作 Hook（新增）
└── use-ai-preferences.ts            # ⏳ AI 偏好 Hook（新增）
```

---

## 10. 合规性检查清单

| 检查项              | 状态 | 说明                                 |
| ------------------- | ---- | ------------------------------------ |
| 现有实现引用        | ✅   | 已映射所有现有模块                   |
| 文件路径正确性      | ✅   | 引用的现有文件路径已验证             |
| Supabase 访问模式   | ✅   | 使用 `createClient()` 而非构造器注入 |
| Feature Flag 一致性 | ✅   | 沿用现有 Feature Flag 命名规范       |
| 重复开发避免        | ✅   | 明确标注已实现/待实现                |
| 扩展点说明          | ✅   | 现有模块扩展有具体代码示例           |

---

## 11. 附录

### 11.1 现有 Feature Flags（参考）

```bash
# .env.local - 已存在的 Feature Flags
ENABLE_DYNAMIC_CONTEXT=true       # 动态上下文注入
ENABLE_PREFERENCE_LEARNING=true   # 偏好自动学习
ENABLE_PROACTIVE_BRIEFING=true    # 主动简报服务

# 本方案可能新增的 Feature Flags
ENABLE_TIMING_SERVICE=true        # 时机感知服务
ENABLE_QUICK_ACTIONS=true         # 快捷操作
ENABLE_RESULT_VISUALIZATION=true  # 结果可视化
ENABLE_FEEDBACK_LOOP=true         # 反馈闭环
```

### 11.2 版本历史

| 版本   | 日期       | 变更内容                                   |
| ------ | ---------- | ------------------------------------------ |
| v1.0.0 | 2025-01-08 | 初始版本                                   |
| v1.1.0 | 2025-01-08 | 合规性修正：对照现有实现重构，避免重复开发 |
