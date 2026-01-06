# AI 模块依赖注入架构

## 概述

AnyKeep 的 AI 模块采用依赖注入容器模式管理服务实例，提供：

- **单例管理**：确保服务实例的唯一性
- **延迟初始化**：按需创建服务，优化启动性能
- **测试支持**：支持 Mock 注入，简化单元测试
- **事件驱动**：模块间通过事件总线解耦通信 (P2)

## 容器架构

```
┌────────────────────────────────────────────────────────────┐
│                    应用层 (API Routes)                      │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│                   AISkillsContainer                         │
│  ├── SkillRegistry                                          │
│  ├── OrchestrationEngine                                    │
│  ├── IntentRouter                                           │
│  └── SkillCascadeHandler (P2-4)                             │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│                   AIAgentContainer                          │
│  ├── PreferencesService                                     │
│  ├── PreferenceLearningService                              │
│  ├── ErrorRecoveryHandler                                   │
│  ├── EpisodicMemoryService                                  │
│  ├── InteractionLogger                                      │
│  └── ToolEventEmitter (P2-3)                                │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                    事件总线层 (P2)                           │
│  ├── SkillEventEmitter (P2-1)                               │
│  ├── CacheInvalidationService (P2-2)                        │
│  └── ToolEventEmitter (P2-3)                                │
└────────────────────────────────────────────────────────────┘
```

## P2: 事件驱动架构增强

### P2-1: AI Skill 步骤事件发布

Skill 执行的生命周期事件：

```typescript
// 事件类型
type SkillEvents =
  | "skill:execution_started"
  | "skill:execution_completed"
  | "skill:step_started"
  | "skill:step_completed"
  | "skill:deliverable_created"
  | "skill:confirmation_requested"
  | "skill:confirmation_responded"
  | "skill:cancelled";

// 使用示例
import { skillEventEmitter } from "@/lib/ai-skills/events";

// 在 Skill 中自动发射事件
// OrchestrationSkill 基类已集成事件发射
```

### P2-2: 事件驱动的缓存失效

```typescript
import { cacheInvalidationService } from "@/lib/cache";

// 初始化（应用启动时）
cacheInvalidationService.initialize();

// 添加自定义失效规则
cacheInvalidationService.addRule({
  id: "custom_rule",
  eventName: "classification:bookmark_classified",
  invalidator: (event) => {
    return [`bookmarks:${event.userId}:all`];
  },
});
```

### P2-3: AI Agent 工具调用事件

```typescript
// 事件类型
type ToolEvents =
  | "tool:call_started"
  | "tool:call_completed"
  | "tool:call_retry"
  | "tool:confirmation_requested"
  | "tool:confirmation_responded";

// ToolRegistry 自动发射事件，无需手动调用
// 订阅示例
import { eventBus } from "@/lib/shared/event-bus";
import { AIAgentToolEvents } from "@/lib/shared/event-bus/event-types";

eventBus.on(AIAgentToolEvents.CALL_COMPLETED, (event) => {
  console.log(`Tool ${event.toolName} completed in ${event.durationMs}ms`);
});
```

### P2-4: 跨 Skill 事件级联处理

```typescript
import {
  skillCascadeHandler,
  initSkillCascadeHandler,
} from "@/lib/ai-skills/events";

// 初始化（应用启动时）
initSkillCascadeHandler();

// 添加自定义级联规则
skillCascadeHandler.addRule({
  id: "custom_cascade",
  triggerSkillId: "batch_organize",
  onSuccessOnly: true,
  actionType: "custom",
  handler: async (event) => {
    // Skill 完成后的自定义处理
  },
});
```

## 使用方式

### 基本使用

```typescript
import { AISkillsContainer, getAISkillsContainer } from "@/lib/ai-skills";
import { createClient } from "@/lib/supabase/server";

// 1. 初始化容器（应用启动时）
const supabase = await createClient();
AISkillsContainer.initialize(supabase, {
  debug: process.env.NODE_ENV === "development",
});

// 2. 获取服务
const container = getAISkillsContainer();
const registry = container.getSkillRegistry();
const engine = container.getOrchestrationEngine();
const router = container.getIntentRouter();
```

### Agent 容器

```typescript
import { AIAgentContainer, getAIAgentContainer } from "@/lib/ai-agent";

// 初始化
AIAgentContainer.initialize(supabase, {
  debug: true,
  memory: {
    enableEpisodicMemory: true,
  },
});

// 获取服务
const container = getAIAgentContainer();
const preferencesService = container.getPreferencesService();
const learningService = container.getLearningService();
```

### 向后兼容

现有的单例导出仍然可用：

```typescript
// 这些仍然有效（向后兼容）
import { skillRegistry } from "@/lib/ai-skills";
import { intentRouter } from "@/lib/ai-skills";
import { preferencesService } from "@/lib/ai-agent";
```

## 测试支持

### 基本 Mock 注入

```typescript
import {
  setupTestContainer,
  createMockSkillRegistry,
} from "@/lib/ai-skills/__tests__/helpers/container-helpers";

describe("MySkillTest", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const mockRegistry = createMockSkillRegistry();
    mockRegistry.get.mockReturnValue(myMockSkill);

    const { cleanup: c } = setupTestContainer({
      overrides: { skillRegistry: mockRegistry },
    });
    cleanup = c;
  });

  afterEach(() => {
    cleanup();
  });

  it("should use mocked registry", () => {
    const container = getAISkillsContainer();
    expect(container.getSkillRegistry()).toBe(mockRegistry);
  });
});
```

### 完整 Mock 容器

```typescript
import { setupFullyMockedContainer } from "@/lib/ai-skills/__tests__/helpers/container-helpers";

describe("IntegrationTest", () => {
  it("should work with all mocks", () => {
    const { container, mocks, cleanup } = setupFullyMockedContainer();

    try {
      // 配置 mock 行为
      mocks.intentRouter.route.mockResolvedValue({
        mode: "orchestration",
        suggestedSkill: "knowledge_review",
        // ...
      });

      // 测试逻辑
      // ...
    } finally {
      cleanup();
    }
  });
});
```

### Jest Hooks 辅助

```typescript
import { createTestHooks } from "@/lib/ai-skills/__tests__/helpers/container-helpers";

describe("MyTest", () => {
  const { beforeEachHook, afterEachHook, getContainer } = createTestHooks({
    config: { debug: false },
  });

  beforeEach(beforeEachHook);
  afterEach(afterEachHook);

  it("test case", () => {
    const container = getContainer();
    // ...
  });
});
```

## 可观测性

容器与 telemetry 系统集成，提供追踪和指标能力：

### 追踪

```typescript
import {
  withSkillTracing,
  withRouterTracing,
  AI_SPAN_NAMES,
} from "@/lib/ai-skills/observability";

// 自动追踪 Skill 执行
const result = await withSkillTracing("search", context, async (span) => {
  span.setAttribute("query", searchQuery);
  return await executeSearch();
});
```

### 指标

```typescript
import {
  recordSkillExecution,
  recordRoutingResult,
  trackActiveSkill,
} from "@/lib/ai-skills/observability";

// 记录执行指标
recordSkillExecution("search", durationMs, {
  success: true,
  category: "search",
  tokensUsed: 150,
});

// 跟踪活跃 Skill
const release = trackActiveSkill("search");
try {
  // 执行逻辑
} finally {
  release();
}
```

## 配置选项

### AISkillsContainerConfig

| 选项                  | 类型                        | 默认值  | 说明           |
| --------------------- | --------------------------- | ------- | -------------- |
| `orchestrationEngine` | `OrchestrationEngineConfig` | -       | 编排引擎配置   |
| `intentRouter`        | `IntentRouterConfig`        | -       | 意图路由器配置 |
| `debug`               | `boolean`                   | `false` | 启用调试日志   |

### AIAgentContainerConfig

| 选项                          | 类型      | 默认值  | 说明         |
| ----------------------------- | --------- | ------- | ------------ |
| `debug`                       | `boolean` | `false` | 启用调试日志 |
| `memory.enableEpisodicMemory` | `boolean` | `true`  | 启用情景记忆 |
| `memory.enableInteractionLog` | `boolean` | `true`  | 启用交互日志 |

## 迁移指南

### 从单例迁移到容器

**之前**：

```typescript
import { skillRegistry } from "@/lib/ai-skills";
import { preferencesService } from "@/lib/ai-agent";

const skills = skillRegistry.getAll();
const prefs = await preferencesService.getPreferences(userId);
```

**之后**：

```typescript
import { getAISkillsContainer } from "@/lib/ai-skills";
import { getAIAgentContainer } from "@/lib/ai-agent";

const skillsContainer = getAISkillsContainer();
const agentContainer = getAIAgentContainer();

const skills = skillsContainer.getSkillRegistry().getAll();
const prefs = await agentContainer
  .getPreferencesService()
  .getPreferences(userId);
```

### 渐进式迁移策略

1. **Phase 1**：新代码使用容器模式
2. **Phase 2**：关键路径迁移到容器
3. **Phase 3**：全量迁移（可选）

> 注意：由于完全向后兼容，无需强制全量迁移

## API 参考

### AISkillsContainer

```typescript
class AISkillsContainer {
  // 静态方法
  static initialize(supabase: SupabaseClient, config?: AISkillsContainerConfig): AISkillsContainer;
  static getInstance(): AISkillsContainer;
  static tryGetInstance(): AISkillsContainer | null;
  static isInitialized(): boolean;
  static reset(): void;

  // 服务获取器
  getSkillRegistry(): SkillRegistry;
  getOrchestrationEngine(): OrchestrationEngine;
  getIntentRouter(): IntentRouter;
  getSupabase(): SupabaseClient;

  // 测试支持
  setOverrides(overrides: AISkillsContainerOverrides): void;
  clearOverrides(): void;
  getAllServices(): { ... };
  getStats(): { ... };
}
```

### AIAgentContainer

```typescript
class AIAgentContainer {
  // 静态方法
  static initialize(supabase: SupabaseClient, config?: AIAgentContainerConfig): AIAgentContainer;
  static getInstance(): AIAgentContainer;
  static tryGetInstance(): AIAgentContainer | null;
  static isInitialized(): boolean;
  static reset(): void;

  // 服务获取器
  getPreferencesService(): PreferencesService;
  getLearningService(): PreferenceLearningService;
  getErrorRecoveryHandler(): ErrorRecoveryHandler;
  getEpisodicMemoryService(): EpisodicMemoryService;
  getInteractionLogger(): InteractionLogger;
  getSupabase(): SupabaseClient;

  // 测试支持
  setOverrides(overrides: AIAgentContainerOverrides): void;
  clearOverrides(): void;
  getAllServices(): { ... };
  getStats(): { ... };
}
```

## 最佳实践

1. **初始化时机**：在应用启动时初始化容器，确保 Supabase 客户端可用
2. **获取方式**：优先使用 `getAISkillsContainer()` / `getAIAgentContainer()`
3. **测试清理**：测试后始终调用 `cleanup()` 或 `reset()`
4. **避免直接实例化**：不要直接 `new` 服务类，使用容器获取
5. **Mock 粒度**：按需 Mock，无需 Mock 不涉及的服务
