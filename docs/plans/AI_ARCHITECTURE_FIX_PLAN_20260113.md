# AnyKeep AI 架构修复计划

> **版本**: v1.0
> **创建日期**: 2026-01-13
> **审查基准**: AI 统一引擎 + Skills + Tools + Workflow 全面诊断
> **预计总工时**: 8-12 小时
> **优先级**: 🔴 P0 阻塞级 → 🟠 P1 重要 → 🟡 P2 优化

---

## 📋 执行摘要

本计划基于 2026-01-13 的全面架构审查，发现 **11 个关键问题**，其中 **4 个 P0 级别** 会直接导致功能失效。本计划与 [架构升级V4-0112.md](./架构升级V4-0112.md) 协调，优先修复阻塞问题。

### 问题分布

| 系统          | P0    | P1    | P2    | 总计   |
| ------------- | ----- | ----- | ----- | ------ |
| Skills 系统   | 1     | 1     | 0     | 2      |
| Tools 系统    | 1     | 1     | 0     | 2      |
| Workflow 系统 | 1     | 1     | 1     | 3      |
| UnifiedEngine | 1     | 1     | 2     | 4      |
| **总计**      | **4** | **4** | **3** | **11** |

### 时间线

```
Day 1 (4h)     Day 2 (4h)      Day 3 (2-4h)
├─ P0 #1-4 ──────┤─ P1 #5-8 ────────┤─ P2 验证 ──────┤
```

---

## 🔴 P0 阻塞级问题（必须立即修复）

### P0-1: `chat` Skill 映射存在但未实现

**影响**: 所有 `action:*` 和 `chitchat:*` 意图请求会失败

**文件**: [skill-mappings.ts](../../src/lib/ai-skills/config/skill-mappings.ts)

**当前代码** (问题):

```typescript
// 第 XX 行
{ key: "action:*", skillId: "chat", mode: "orchestration", ... },
{ key: "chitchat:*", skillId: "chat", mode: "orchestration", ... },
```

**修复方案 A (推荐 - 10分钟)**:

将 `chat` 映射改为走 Atomic 模式（KnowledgeAgent 直接处理）：

```typescript
// 删除或注释掉这两行映射
// { key: "action:*", skillId: "chat", ... },
// { key: "chitchat:*", skillId: "chat", ... },

// 或者将 mode 改为 "atomic"
{ key: "action:*", skillId: null, mode: "atomic", enabled: true },
{ key: "chitchat:*", skillId: null, mode: "atomic", enabled: true },
```

**修复方案 B (可选 - 2小时)**:

创建 ChatSkill 实现：

```bash
mkdir -p src/lib/ai-skills/skills/chat
touch src/lib/ai-skills/skills/chat/chat.skill.ts
touch src/lib/ai-skills/skills/chat/types.ts
touch src/lib/ai-skills/skills/chat/index.ts
```

**验证命令**:

```bash
npm test -- --testPathPattern="skill-mappings"
npm test -- --testPathPattern="intent-router"
```

---

### P0-2: Workflow 模式早期返回，跳过输出增强

**影响**: 工作流响应缺少记忆注入、引用追踪、建议注入

**文件**: [unified-engine.ts:431-435](../../src/lib/ai-skills/engine/unified-engine.ts#L431-L435)

**当前代码** (问题):

```typescript
if (workflowResult) {
  yield * this.streamWorkflowResponse(workflowResult);
  return; // ⚠️ 直接返回，跳过 OutputEnhancer
}
```

**修复方案 (30分钟)**:

```typescript
if (workflowResult) {
  // 方案 1: 最小改动 - 添加基本的输出增强
  yield* this.streamWorkflowResponseWithEnhancements(workflowResult, context);
  return;
}

// 新增方法
private async *streamWorkflowResponseWithEnhancements(
  result: WorkflowExecuteResult,
  context: EngineContext
): AsyncGenerator<UnifiedStreamChunk> {
  // 1. 发送工作流启动信息
  yield {
    type: "workflow_started",
    data: {
      workflowId: result.workflowId,
      workflowName: result.workflowName,
      executionId: result.executionId,
    },
  };

  // 2. 发送工作流响应文本
  yield {
    type: "text",
    data: { text: result.message },
  };

  // 3. 记录到情景记忆 (OutputEnhancer 的核心功能)
  if (FeatureFlags.ENABLE_EPISODIC_MEMORY && context.episodicMemoryService) {
    try {
      await context.episodicMemoryService.recordInteraction({
        userId: context.userId,
        conversationId: context.conversationId,
        userMessage: context.input,
        assistantResponse: result.message,
        intent: { type: "workflow", subType: result.workflowId },
        timestamp: new Date(),
      });
    } catch (error) {
      logger.warn("Failed to record workflow memory", { error });
    }
  }

  // 4. 发送完成信号
  yield {
    type: "done",
    data: { success: true, mode: "workflow" },
  };
}
```

**验证命令**:

```bash
npm test -- --testPathPattern="unified-engine"
npm test -- --testPathPattern="workflow"
```

---

### P0-3: 两个 Core Tools 缺失/命名不匹配

**影响**: `list_tags` 查询失败，`get_bookmark` 调用失败

**文件**: [tool-layers.ts](../../src/lib/ai-agent/tools/tool-layers.ts)

#### 问题 3a: `list_tags` 缺失

**修复方案 (20分钟)**:

创建 `list-tags.tool.ts`:

```typescript
// src/lib/ai-agent/tools/query/list-tags.tool.ts

import { z } from "zod";
import { createTool } from "../tool-factory";
import { createClient } from "@/lib/supabase/server";

export const listTagsTool = createTool({
  name: "list_tags",
  description: "列出用户的所有标签及其使用次数",
  category: "query",
  riskLevel: "low",

  inputSchema: z.object({
    limit: z.number().optional().default(50).describe("返回的最大标签数量"),
    orderBy: z
      .enum(["name", "count"])
      .optional()
      .default("count")
      .describe("排序方式"),
  }),

  outputSchema: z.object({
    tags: z.array(
      z.object({
        name: z.string(),
        count: z.number(),
      }),
    ),
    total: z.number(),
  }),

  execute: async (input, context) => {
    const supabase = await createClient();

    // 查询用户所有书签的标签
    const { data, error } = await supabase
      .from("bookmarks")
      .select("tags")
      .eq("user_id", context.userId)
      .not("tags", "is", null);

    if (error) throw error;

    // 统计标签频次
    const tagCounts = new Map<string, number>();
    for (const row of data || []) {
      for (const tag of row.tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // 排序
    let tags = Array.from(tagCounts.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    if (input.orderBy === "name") {
      tags.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      tags.sort((a, b) => b.count - a.count);
    }

    // 限制数量
    tags = tags.slice(0, input.limit);

    return {
      tags,
      total: tagCounts.size,
    };
  },
});
```

#### 问题 3b: `get_bookmark` vs `read_bookmark` 命名不匹配

**修复方案 (5分钟)**:

在 `tool-layers.ts` 中将 `get_bookmark` 改为 `read_bookmark`:

```typescript
// tool-layers.ts
// 找到 CORE_TOOLS 数组，将 "get_bookmark" 改为 "read_bookmark"
export const CORE_TOOLS = [
  "search",
  "semantic_search",
  "list",
  "count",
  "list_tags", // 确认此项存在
  "read_bookmark", // 从 get_bookmark 改为 read_bookmark
  // ...
];
```

**验证命令**:

```bash
npm test -- --testPathPattern="tools"
npm run type-check
```

---

### P0-4: 增强置信度计算缺少用户数据

**影响**: 置信度分层策略选择不准确

**文件**:

- [unified-engine.ts:209-246](../../src/lib/ai-skills/engine/unified-engine.ts#L209-L246)
- [unified/route.ts](../../src/app/api/agent/unified/route.ts)

**当前问题**:

```typescript
// unified-engine.ts
private createMinimalDynamicContext(context: EngineContext): DynamicContext {
  return {
    totalBookmarks: 0,       // ⚠️ 总是 0
    recentWeekCount: 0,      // ⚠️ 总是 0
    topFolders: [],          // ⚠️ 总是空
    // ...
  };
}
```

**修复方案 (1小时)**:

**Step 1**: 在 API 入口预加载用户数据

```typescript
// src/app/api/agent/unified/route.ts

// 在现有的 getQuickStats 调用处，确保数据被传递到 context
const quickStats = await getQuickStats(userId);

const engineContext: EngineContext = {
  // ... 现有字段

  // 🆕 新增：用户数据统计
  totalBookmarks: quickStats.totalBookmarks,
  totalFolders: quickStats.totalFolders,
  recentWeekCount: quickStats.recentWeekCount,
  topFolders: quickStats.topFolders,
  tags: quickStats.tags,
};
```

**Step 2**: 在 EngineContext 类型中添加字段

```typescript
// src/lib/ai-skills/engine/types.ts

export interface EngineContext {
  // ... 现有字段

  // 🆕 新增：用户数据上下文
  totalBookmarks?: number;
  totalFolders?: number;
  recentWeekCount?: number;
  topFolders?: Array<{ id: number; name: string; count: number }>;
  tags?: string[];
}
```

**Step 3**: 修改 createMinimalDynamicContext 使用实际数据

```typescript
// src/lib/ai-skills/engine/unified-engine.ts

private createMinimalDynamicContext(context: EngineContext): DynamicContext {
  return {
    totalBookmarks: context.totalBookmarks ?? 0,
    recentWeekCount: context.recentWeekCount ?? 0,
    topFolders: context.topFolders ?? [],
    tags: context.tags ?? [],
    // ... 其他字段
  };
}
```

**验证命令**:

```bash
npm test -- --testPathPattern="enhanced-confidence"
npm test -- --testPathPattern="unified-engine"
```

---

## 🟠 P1 重要问题（应该尽快修复）

### P1-5: 7 个 Skills 已实现但无意图映射

**影响**: 用户无法通过自然语言触发这些功能

**文件**: [skill-mappings.ts](../../src/lib/ai-skills/config/skill-mappings.ts)

**需要添加的映射**:

```typescript
// src/lib/ai-skills/config/skill-mappings.ts

// 在 SKILL_MAPPINGS 数组中添加：

// Bilibili 字幕提取
{
  key: "create:bilibili",
  skillId: "bilibili_transcript",
  mode: "orchestration",
  minComplexity: "medium",
  enabled: true,
  triggers: ["B站", "bilibili", "字幕", "视频文字稿"],
},

// 微信文章摘要
{
  key: "create:wechat",
  skillId: "wechat_digest",
  mode: "orchestration",
  minComplexity: "medium",
  enabled: true,
  triggers: ["微信", "公众号", "文章摘要"],
},

// 链接健康检查
{
  key: "action:link_health",
  skillId: "link_health_check",
  mode: "orchestration",
  minComplexity: "medium",
  enabled: true,
  triggers: ["检查链接", "失效链接", "链接健康"],
},

// 内容变更监控
{
  key: "action:content_monitor",
  skillId: "content_change_monitor",
  mode: "orchestration",
  minComplexity: "high",
  enabled: true,
  triggers: ["监控", "变更检测", "页面更新"],
},

// 收件箱摘要
{
  key: "query:inbox",
  skillId: "inbox_digest",
  mode: "orchestration",
  minComplexity: "medium",
  enabled: true,
  triggers: ["收件箱", "未读摘要", "通知汇总"],
},

// 分类 (基础 Skill)
{
  key: "action:classify",
  skillId: "classify",
  mode: "orchestration",
  minComplexity: "simple",
  enabled: true,
  triggers: ["分类", "归类", "自动分类"],
},

// 摘要 (基础 Skill)
{
  key: "create:summary",
  skillId: "summary",
  mode: "orchestration",
  minComplexity: "simple",
  enabled: true,
  triggers: ["摘要", "总结", "概述"],
},
```

**预计工时**: 30 分钟

---

### P1-6: `summarize_unread` 命名不一致

**影响**: 工具选择时可能调用失败

**文件**: [tool-layers.ts](../../src/lib/ai-agent/tools/tool-layers.ts)

**修复方案 (5分钟)**:

统一命名为 `summarize_unread_messages`:

```typescript
// 在 tool-layers.ts 中查找并修改
// 将 "summarize_unread" 改为 "summarize_unread_messages"
```

---

### P1-7: 5 个 Feature Flags 缺少定义

**影响**: 新 Skills 无法通过 Feature Flag 控制

**文件**: [feature-flags.ts](../../src/lib/ai-agent/config/feature-flags.ts)

**修复方案 (20分钟)**:

```typescript
// src/lib/ai-agent/config/feature-flags.ts

// 添加缺失的 Feature Flags

get ENABLE_FOLDER_RECOMMEND(): boolean {
  return process.env.ENABLE_FOLDER_RECOMMEND !== "false";
}

get ENABLE_SEARCH_OPTIMIZE(): boolean {
  return process.env.ENABLE_SEARCH_OPTIMIZE !== "false";
}

get ENABLE_KNOWLEDGE_GRAPH_EXPLORE(): boolean {
  return process.env.ENABLE_KNOWLEDGE_GRAPH_EXPLORE !== "false";
}

get ENABLE_FOLDER_HEALTH_CHECK(): boolean {
  return process.env.ENABLE_FOLDER_HEALTH_CHECK !== "false";
}

get ENABLE_SNAPSHOT_COMPARE(): boolean {
  return process.env.ENABLE_SNAPSHOT_COMPARE !== "false";
}
```

同时在 `feature-flag-registry.ts` 中注册：

```typescript
// src/lib/ai-agent/config/feature-flag-registry.ts

{
  name: "ENABLE_FOLDER_RECOMMEND",
  description: "启用文件夹智能推荐 Skill",
  defaultValue: true,
  module: "skills",
  phase: "beta",
  integrationPoints: [
    { file: "src/lib/ai-skills/register.ts", location: "registerSkills()", type: "execute" }
  ],
},
// ... 其他 4 个类似
```

---

### P1-8: Workflow 与 IntentAnalyzer 独立运行

**影响**: 两个系统可能对同一请求做出冲突判断

**文件**:

- [unified-engine.ts](../../src/lib/ai-skills/engine/unified-engine.ts)
- [intent-analyzer.ts](../../src/lib/ai-skills/router/intent-analyzer.ts)

**修复方案 (2小时)** - 建议作为后续优化：

**方案 A (最小改动)**: 在 IntentRouter 中添加 Workflow 检测前置

```typescript
// src/lib/ai-skills/router/intent-router.ts

async route(input: string, context: EngineContext): Promise<RouteResult> {
  // 🆕 新增：优先检查 Workflow 意图
  if (FeatureFlags.ENABLE_WORKFLOW_CONVERSATION_TRIGGER) {
    const workflowMatch = await this.tryMatchWorkflow(input, context.userId);
    if (workflowMatch && workflowMatch.confidence >= 0.7) {
      return {
        mode: "workflow",
        workflowId: workflowMatch.workflowId,
        confidence: workflowMatch.confidence,
        source: "workflow_matcher",
      };
    }
  }

  // 继续常规路由...
  return this.routeToAtomicOrOrchestration(input, context);
}
```

**方案 B (完整重构)**: 统一意图分析器（更大改动，建议单独计划）

---

## 🟡 P2 优化问题（可以后续处理）

### P2-9: ReAct 循环在 ExecutionCoordinator 内部硬编码

**影响**: 中间思考步骤不可见，RouteResult 无法反映 ReAct 状态

**建议**: 在 `RouteResult` 中添加 `useReact` 标志，由 ModeSelector 决定

---

### P2-10: 编排 Skill 异步错误处理不完整

**影响**: 可能存在资源泄漏

**当前代码**:

```typescript
if (adaptedChunk.type === "error" && adaptedChunk.data.retryable) {
  hasError = true;
  break; // ⚠️ 生成器未正确清理
}
```

**修复建议**:

```typescript
// 在 break 前调用 finally
try {
  // ... 执行逻辑
} finally {
  // 确保生成器被正确关闭
  if (typeof generator.return === "function") {
    await generator.return();
  }
}
```

---

### P2-11: Workflow 异步完成无通知机制

**影响**: 用户发起工作流后不知道执行结果

**建议**: 添加 WebSocket 或 Supabase Realtime 推送

---

## 📅 执行计划

### Day 1: P0 问题修复 (4小时)

| 时间        | 任务                          | 预计耗时 |
| ----------- | ----------------------------- | -------- |
| 09:00-09:15 | P0-1: 修复 chat Skill 映射    | 15 min   |
| 09:15-09:45 | P0-2: Workflow 输出增强       | 30 min   |
| 09:45-10:15 | P0-3a: 创建 list_tags Tool    | 30 min   |
| 10:15-10:25 | P0-3b: 修复 get_bookmark 命名 | 10 min   |
| 10:25-11:25 | P0-4: 增强置信度数据注入      | 60 min   |
| 11:25-12:00 | 运行测试验证                  | 35 min   |

### Day 2: P1 问题修复 (4小时)

| 时间        | 任务                       | 预计耗时 |
| ----------- | -------------------------- | -------- |
| 09:00-09:30 | P1-5: 添加 7 个 Skill 映射 | 30 min   |
| 09:30-09:40 | P1-6: 修复命名不一致       | 10 min   |
| 09:40-10:00 | P1-7: 添加 Feature Flags   | 20 min   |
| 10:00-12:00 | P1-8: Workflow 集成优化    | 120 min  |
| 12:00-12:30 | 运行测试验证               | 30 min   |

### Day 3: 验证与文档 (2-4小时)

| 时间        | 任务                | 预计耗时 |
| ----------- | ------------------- | -------- |
| 09:00-10:00 | 端到端测试          | 60 min   |
| 10:00-11:00 | 更新 CLAUDE.md 文档 | 60 min   |
| 11:00-12:00 | P2 问题评估和记录   | 60 min   |

---

## ✅ 验证清单

### P0 修复后验证

```bash
# 1. 类型检查
npm run type-check

# 2. Skills 测试
npm test -- --testPathPattern="ai-skills" --coverage

# 3. Tools 测试
npm test -- --testPathPattern="tools"

# 4. Workflow 测试
npm test -- --testPathPattern="workflow"

# 5. 意图路由测试
npm test -- --testPathPattern="intent"

# 6. 完整构建
npm run build

# 7. Feature Flags 验证
npm run check:feature-flags
```

### 手动验证场景

| 场景          | 输入           | 预期结果              |
| ------------- | -------------- | --------------------- |
| chat 意图     | "你好"         | 正常响应（不报错）    |
| Workflow 触发 | "检查书签健康" | 工作流启动 + 记忆记录 |
| list_tags     | "我有哪些标签" | 返回标签列表          |
| 置信度分层    | "搜索 React"   | 高置信度静默执行      |

---

## 📁 涉及文件清单

### 需要修改的文件

| 文件                                               | 修改类型   | 优先级 |
| -------------------------------------------------- | ---------- | ------ |
| `src/lib/ai-skills/config/skill-mappings.ts`       | 修改映射   | P0/P1  |
| `src/lib/ai-skills/engine/unified-engine.ts`       | 添加方法   | P0     |
| `src/lib/ai-agent/tools/tool-layers.ts`            | 修复命名   | P0/P1  |
| `src/lib/ai-skills/engine/types.ts`                | 扩展类型   | P0     |
| `src/app/api/agent/unified/route.ts`               | 注入数据   | P0     |
| `src/lib/ai-agent/config/feature-flags.ts`         | 添加 Flags | P1     |
| `src/lib/ai-agent/config/feature-flag-registry.ts` | 注册 Flags | P1     |

### 需要创建的文件

| 文件                                             | 功能           | 优先级 |
| ------------------------------------------------ | -------------- | ------ |
| `src/lib/ai-agent/tools/query/list-tags.tool.ts` | list_tags 实现 | P0     |

---

## 🔗 与现有计划的协调

本修复计划与 [架构升级V4-0112.md](./架构升级V4-0112.md) 的关系：

| 本计划任务          | V4 计划对应      | 依赖关系       |
| ------------------- | ---------------- | -------------- |
| P0-4 增强置信度数据 | Phase 0 参数透传 | 互补           |
| P1-8 Workflow 集成  | 不涉及           | 独立           |
| P0-1/2/3 基础修复   | 前置依赖         | **必须先完成** |

**建议执行顺序**:

1. ✅ 本计划 P0 问题 → 确保基础功能正常
2. ✅ V4 Phase 0 参数透传 → 完善参数传递
3. ✅ 本计划 P1 问题 → 补全功能覆盖
4. ✅ V4 Phase 1 核心三件套 → 性能优化

---

## 📊 成功指标

| 指标                | 修复前        | 修复后目标     |
| ------------------- | ------------- | -------------- |
| Skills 映射完整度   | 23/31 (74%)   | 30/31 (97%)    |
| Tools 可用率        | 82/84 (97.6%) | 84/84 (100%)   |
| Workflow 输出一致性 | 不一致        | 与其他模式一致 |
| 置信度计算准确性    | 低（缺数据）  | 高（完整数据） |
| Feature Flags 覆盖  | 9/14 (64%)    | 14/14 (100%)   |

---

_文档版本: v1.0_
_创建: 2026-01-13_
_作者: Winston (Architect)_
