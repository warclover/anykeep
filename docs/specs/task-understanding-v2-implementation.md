# 任务理解层 v2.0 实施方案

**版本**: v1.1
**日期**: 2025-12-27
**作者**: BMad Master
**状态**: 待审核

> **v1.1 更新**：新增 System-Reminder 动态注入机制、增强置信度计算模块（借鉴 Claude Code Agent 架构）

---

## 一、方案概述

### 1.1 目标

在保持**零接管**设计原则的前提下，通过 Prompt 级优化提升 AI 助手的任务理解能力。

### 1.2 核心策略

| 策略                         | 说明                                               |
| ---------------------------- | -------------------------------------------------- |
| **置信度分层执行**           | 高置信度静默执行，低置信度轻量澄清                 |
| **隐含意图推断**             | 利用上下文和偏好推断用户真正目标                   |
| **风险分级守门**             | 破坏性操作必须确认，普通操作静默执行               |
| **System-Reminder 动态注入** | 基于用户数据主动提供有价值建议（借鉴 Claude Code） |
| **增强置信度计算**           | 多因素综合评估，提升理解准确性（借鉴 Claude Code） |
| **最小侵入改动**             | 仅修改 Prompt + 新增辅助模块，不改现有架构         |

### 1.3 设计约束

- ✅ 90% 场景静默执行（零接管）
- ✅ 仅 Prompt 级改动（无架构变更）
- ✅ Token 增量 < 20%
- ✅ 响应延迟增量 < 10%

---

## 二、文件变更清单

| 文件                                                       | 操作     | 说明                     |
| ---------------------------------------------------------- | -------- | ------------------------ |
| `src/lib/ai-agent/core/prompts/knowledge-agent.prompt.ts`  | 修改     | 重构 System Prompt       |
| `src/lib/ai-agent/core/prompts/response-templates.ts`      | 新增     | 响应模板定义             |
| `src/lib/ai-agent/core/prompts/implicit-intent-rules.ts`   | 新增     | 隐含意图推断规则         |
| `src/lib/ai-agent/context/system-reminder-injector.ts`     | **新增** | System-Reminder 动态注入 |
| `src/lib/ai-agent/context/enhanced-confidence.ts`          | **新增** | 增强置信度计算           |
| `src/lib/ai-agent/core/prompts/index.ts`                   | 修改     | 导出新模块               |
| `src/lib/ai-agent/context/index.ts`                        | 修改     | 导出新模块               |
| `src/lib/ai-agent/__tests__/task-understanding-v2.test.ts` | 新增     | 测试用例                 |

---

## 三、System Prompt 重构

### 3.1 新版 System Prompt

```typescript
// src/lib/ai-agent/core/prompts/knowledge-agent.prompt.ts

/**
 * KnowledgeAgent 系统提示语 v2.0
 *
 * 核心升级：
 * 1. 从"工具执行器"转向"智能助手"
 * 2. 置信度分层执行策略
 * 3. 隐含意图推断能力
 * 4. 风险分级守门机制
 *
 * @version 2.0.0
 * @since 2025-12-26
 */
export const KNOWLEDGE_AGENT_SYSTEM_PROMPT_V2 = `你是 AnyKeep 的 AI 知识助手，帮助用户零接管地管理收藏内容。

## 核心原则

1. **静默高效**：用户期望你直接完成任务，绝大多数情况不需要确认
2. **智能推断**：利用上下文和用户偏好推断隐含意图
3. **结果导向**：快速执行，简洁汇报

## 思维模式（内部思考，不输出给用户）

收到请求时，快速评估：

1. **理解意图**：用户明确想要什么？
2. **推断目标**：用户真正的目标是什么？（不是"整理"，是"让收藏更好管理"）
3. **评估置信度**：我对理解的确信程度？
4. **选择策略**：静默执行 / 执行+说明 / 轻量澄清

### 隐含意图推断规则

| 用户表达 | 隐含意图 | 默认行为 |
|----------|----------|----------|
| "整理 XX" | 分类/打标签，**不是删除** | 建议标签或文件夹分组 |
| "太多了" | 想要筛选/分组，**不是删除** | 提供分类方案或筛选建议 |
| "找不到 XX" | 想快速定位 | 搜索 + 展示最相关结果 |
| "最近的 XX" | 时间范围：7天内 | 按最近7天筛选 |
| "帮我看看" | 统计/概览，**不是操作** | 展示概况统计 |
| "那个" | 指代最近交互的内容 | 检查上下文最近收藏/操作 |
| "这些" | 指当前选中或最近列表 | 使用会话中的选中项 |
| "都" + 操作 | 批量操作，需确认范围 | 先说明范围再执行 |

### 置信度分层执行

| 置信度 | 策略 | 响应风格 |
|--------|------|----------|
| **≥85%** | 静默执行 | 简洁结果，不解释 |
| **60-84%** | 执行+说明 | 结果 + "我理解为X，如需调整告诉我" |
| **<60%** | 轻量澄清 | 提1个问题 + 推荐选项（可一键确认）|

### 风险分级

| 风险级别 | 操作类型 | 处理方式 |
|----------|----------|----------|
| **低** | 查询、搜索、统计 | 直接执行 |
| **中** | 添加标签、移动 | 执行 + 简要说明 |
| **高** | 删除、批量修改(>20条) | 必须确认后执行 |

## 快速判断规则

| 情况 | 处理方式 |
|------|----------|
| 上下文已有答案 | 直接回答，不调用工具 |
| 需要详细列表 | 调用 list_* 工具 |
| 需要搜索特定内容 | 调用 search_bookmarks |
| 需要执行操作 | 根据风险级别决定是否确认 |
| 信息不足无法判断 | 轻量澄清（带默认选项）|

## 响应模板

### 高置信度响应（静默执行）
\`\`\`
✅ [结果描述]
[可选：1行补充信息]
\`\`\`

### 中置信度响应（执行+说明）
\`\`\`
✅ [结果描述]
💡 我理解为 [你的理解]，如需调整可以告诉我。
\`\`\`

### 低置信度响应（轻量澄清）
\`\`\`
我理解你想 [初步理解]。请确认：
[问题]？
→ A. [推荐选项]（默认）
→ B. [备选]
\`\`\`

### 高风险操作响应
\`\`\`
⚠️ 即将 [操作描述]（影响 X 条内容）
确认执行？回复"确认"继续，或告诉我调整。
\`\`\`

## 工具使用

### 优先级原则
1. **能不调就不调**：上下文有答案就直接用
2. **简单优先**：count_total 优于 get_stats
3. **精确优先**：知道条件就用精确工具

### 可用工具

【查询类】
- list_recent(limit?) → 最近收藏
- list_by_folder(folder_id, limit?) → 指定文件夹
- list_by_platform(platform, limit?) → 指定平台
- search_bookmarks(query, limit?) → 搜索

【统计类】
- count_total() → 总数
- count_by_folder(folder_id) → 文件夹数量
- count_by_platform(platform) → 平台数量
- get_stats() → 详细统计（仅需图表时用）

【阅读类】
- read_bookmark(bookmark_id) → 读取单个书签详情

【智能列表类】
- list_smart_lists() → 获取智能列表
- get_smart_list_items(smartListId, limit?) → 列表内容
- get_smart_list_count(smartListId) → 列表数量

【智能处理类】
- classify(title, summary?, tags?) → 智能推荐分类文件夹
- summary(title, url, content?, mode?) → 生成摘要和标签

【操作类】（风险级别：中-高）
- batch_tags(bookmark_ids, tags, action) → 批量标签
- move_bookmarks(bookmark_ids, folder_id) → 批量移动

【导出类】
- export_bookmarks(format, filter?, bookmarkIds?) → 导出
- preview_export(format, previewCount?) → 预览导出
- list_export_formats() → 列出导出格式

### 平台代码
WECHAT / BILIBILI / XIAOHONGSHU / ZHIHU / WEIBO / DOUYIN / BROWSER_* / OTHER

## 错误处理

| 错误 | 处理 |
|------|------|
| "not found" | 静默重试：先查询获取正确 ID |
| 结果为空 | 放宽条件或换工具，告知用户 |
| 参数错误 | 静默修正后重试 |

## 约束

- 用中文回复
- 简洁直接，不要过度解释
- 批量操作(>20条)前必须确认
- 删除操作前必须确认
- **重要**：下方"用户数据概况"包含最新实时统计，直接引用回答`;
```

### 3.2 与旧版对比

| 维度       | 旧版       | 新版                | 变化     |
| ---------- | ---------- | ------------------- | -------- |
| 核心原则   | ReAct 思维 | 静默高效 + 智能推断 | 导向转变 |
| 隐含意图   | 无         | 8条推断规则         | **新增** |
| 置信度策略 | 无         | 3层分级执行         | **新增** |
| 风险分级   | "提示确认" | 明确3级 + 阈值      | 增强     |
| 响应模板   | 无         | 4种标准模板         | **新增** |
| Token 估算 | ~600       | ~750                | +25%     |

---

## 四、响应模板模块

### 4.1 新增文件

```typescript
// src/lib/ai-agent/core/prompts/response-templates.ts

/**
 * AI 响应模板定义
 *
 * 用于约束 AI 输出格式，保持一致性
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

/**
 * 置信度级别
 */
export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * 风险级别
 */
export type RiskLevel = "low" | "medium" | "high";

/**
 * 置信度阈值配置
 */
export const CONFIDENCE_THRESHOLDS = {
  /** 高置信度阈值 - 静默执行 */
  HIGH: 0.85,
  /** 中置信度阈值 - 执行+说明 */
  MEDIUM: 0.6,
} as const;

/**
 * 风险操作定义
 */
export const RISK_OPERATIONS = {
  /** 低风险：查询类操作 */
  LOW: ["list", "search", "count", "get", "read", "preview"],

  /** 中风险：修改类操作 */
  MEDIUM: ["add_tag", "move", "classify", "export"],

  /** 高风险：破坏性操作 */
  HIGH: ["delete", "remove", "batch_delete", "clear"],
} as const;

/**
 * 批量操作确认阈值
 */
export const BATCH_CONFIRMATION_THRESHOLD = 20;

/**
 * 响应模板 - Prompt 注入部分
 *
 * 这些模板会被注入到 System Prompt 中，指导 AI 输出格式
 */
export const RESPONSE_TEMPLATES_PROMPT = `
## 响应模板

### 高置信度响应（静默执行）
\`\`\`
✅ [结果描述]
[可选：1行补充信息]
\`\`\`

### 中置信度响应（执行+说明）
\`\`\`
✅ [结果描述]
💡 我理解为 [你的理解]，如需调整可以告诉我。
\`\`\`

### 低置信度响应（轻量澄清）
\`\`\`
我理解你想 [初步理解]。请确认：
[问题]？
→ A. [推荐选项]（默认）
→ B. [备选]
\`\`\`

### 高风险操作响应
\`\`\`
⚠️ 即将 [操作描述]（影响 X 条内容）
确认执行？回复"确认"继续，或告诉我调整。
\`\`\`
`;

/**
 * 获取置信度级别
 */
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return "high";
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return "medium";
  return "low";
}

/**
 * 判断操作风险级别
 */
export function getOperationRiskLevel(operation: string): RiskLevel {
  const op = operation.toLowerCase();

  if (RISK_OPERATIONS.HIGH.some((r) => op.includes(r))) return "high";
  if (RISK_OPERATIONS.MEDIUM.some((r) => op.includes(r))) return "medium";
  return "low";
}

/**
 * 判断是否需要确认
 */
export function requiresConfirmation(
  operation: string,
  affectedCount: number = 1,
): boolean {
  const riskLevel = getOperationRiskLevel(operation);

  // 高风险操作始终需要确认
  if (riskLevel === "high") return true;

  // 批量操作超过阈值需要确认
  if (affectedCount > BATCH_CONFIRMATION_THRESHOLD) return true;

  return false;
}
```

---

## 五、隐含意图推断规则

### 5.1 新增文件

```typescript
// src/lib/ai-agent/core/prompts/implicit-intent-rules.ts

/**
 * 隐含意图推断规则
 *
 * 用于从用户模糊表达中推断真正目标
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

/**
 * 隐含意图规则
 */
export interface ImplicitIntentRule {
  /** 规则 ID */
  id: string;
  /** 触发模式 */
  pattern: RegExp;
  /** 隐含目标 */
  implicitGoal: string;
  /** 隐含期望（不要做的事） */
  hiddenExpectation?: string;
  /** 默认行为建议 */
  defaultBehavior: string;
  /** 优先级 */
  priority: number;
}

/**
 * 默认隐含意图规则
 */
export const IMPLICIT_INTENT_RULES: ImplicitIntentRule[] = [
  {
    id: "organize-not-delete",
    pattern: /整理|清理|规整|梳理/,
    implicitGoal: "让收藏更有序、更易管理",
    hiddenExpectation: "不要删除任何内容（除非明确要求）",
    defaultBehavior: "建议标签或文件夹分组",
    priority: 90,
  },
  {
    id: "too-many-not-delete",
    pattern: /太多|好多|很多|一堆/,
    implicitGoal: "减少认知负担，更好地管理",
    hiddenExpectation: "不是要删除，是想分组/筛选",
    defaultBehavior: "提供分类方案或筛选建议",
    priority: 85,
  },
  {
    id: "cant-find-search",
    pattern: /找不到|在哪|哪里|怎么找/,
    implicitGoal: "快速定位目标内容",
    hiddenExpectation: "不需要列出所有，只要最相关的",
    defaultBehavior: "搜索 + 展示最相关结果",
    priority: 80,
  },
  {
    id: "recent-7days",
    pattern: /最近|近期|这几天/,
    implicitGoal: "查看近期活动",
    hiddenExpectation: "通常指7天内，不是全部历史",
    defaultBehavior: "按最近7天筛选",
    priority: 75,
  },
  {
    id: "look-at-overview",
    pattern: /看看|瞅瞅|看下|帮我看/,
    implicitGoal: "了解概况",
    hiddenExpectation: "不是要执行操作，是想看统计/概览",
    defaultBehavior: "展示概况统计",
    priority: 70,
  },
  {
    id: "that-one-context",
    pattern: /那个|那条|刚才那个/,
    implicitGoal: "引用最近交互的内容",
    hiddenExpectation: "需要从上下文推断具体指代",
    defaultBehavior: "检查上下文最近收藏/操作",
    priority: 95,
  },
  {
    id: "these-selected",
    pattern: /这些|这几个|选中的/,
    implicitGoal: "操作当前选中或最近列表",
    hiddenExpectation: "指代会话中的选中项",
    defaultBehavior: "使用会话中的选中项",
    priority: 90,
  },
  {
    id: "all-batch-confirm",
    pattern: /都|全部|所有/,
    implicitGoal: "批量操作",
    hiddenExpectation: "可能范围很大，需要确认",
    defaultBehavior: "先说明范围再执行",
    priority: 85,
  },
];

/**
 * 隐含意图规则 - Prompt 注入部分
 */
export const IMPLICIT_INTENT_RULES_PROMPT = `
### 隐含意图推断规则

| 用户表达 | 隐含意图 | 默认行为 |
|----------|----------|----------|
| "整理 XX" | 分类/打标签，**不是删除** | 建议标签或文件夹分组 |
| "太多了" | 想要筛选/分组，**不是删除** | 提供分类方案或筛选建议 |
| "找不到 XX" | 想快速定位 | 搜索 + 展示最相关结果 |
| "最近的 XX" | 时间范围：7天内 | 按最近7天筛选 |
| "帮我看看" | 统计/概览，**不是操作** | 展示概况统计 |
| "那个" | 指代最近交互的内容 | 检查上下文最近收藏/操作 |
| "这些" | 指当前选中或最近列表 | 使用会话中的选中项 |
| "都" + 操作 | 批量操作，需确认范围 | 先说明范围再执行 |
`;

/**
 * 匹配隐含意图规则
 */
export function matchImplicitIntent(
  message: string,
): ImplicitIntentRule | null {
  const sortedRules = [...IMPLICIT_INTENT_RULES].sort(
    (a, b) => b.priority - a.priority,
  );

  for (const rule of sortedRules) {
    if (rule.pattern.test(message)) {
      return rule;
    }
  }

  return null;
}

/**
 * 获取所有匹配的隐含意图
 */
export function matchAllImplicitIntents(message: string): ImplicitIntentRule[] {
  return IMPLICIT_INTENT_RULES.filter((rule) =>
    rule.pattern.test(message),
  ).sort((a, b) => b.priority - a.priority);
}
```

---

## 六、System-Reminder 动态注入机制（新增）

> **借鉴来源**：Claude Code Agent 的 `<system-reminder>` 标签动态注入机制

### 6.1 设计理念

Claude Code 在 Agent Loop 执行过程中，会基于状态检测动态注入 `<system-reminder>` 标签，让 AI 在对话中主动提供有价值的建议，而不是被动等待用户指令。

**AnyKeep 适配**：基于用户收藏数据特征，在合适时机主动提供整理建议。

### 6.2 新增文件

```typescript
// src/lib/ai-agent/context/system-reminder-injector.ts

/**
 * System-Reminder 动态注入器
 *
 * 基于用户数据状态，动态注入提醒到 System Prompt
 * 让 AI 能主动提供有价值的建议
 *
 * 借鉴：Claude Code Agent 的 <system-reminder> 机制
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { DynamicContext } from "./types";

/**
 * 提醒触发器配置
 */
export interface ReminderTrigger {
  /** 触发器 ID */
  id: string;
  /** 触发条件 */
  condition: (context: DynamicContext) => boolean;
  /** 提醒内容 */
  reminder: string;
  /** 优先级（越高越优先） */
  priority: number;
  /** 是否为主动建议（影响提醒风格） */
  isProactive: boolean;
}

/**
 * 默认提醒触发器
 */
export const REMINDER_TRIGGERS: ReminderTrigger[] = [
  {
    id: "long-inactive",
    condition: (ctx) =>
      ctx.stats.recentWeekCount === 0 && ctx.stats.totalBookmarks > 100,
    reminder:
      "用户已有一段时间未整理收藏（本周无新增），可在合适时机主动建议整理方案",
    priority: 80,
    isProactive: true,
  },
  {
    id: "platform-dominant",
    condition: (ctx) =>
      ctx.stats.topPlatform.count > ctx.stats.totalBookmarks * 0.6,
    reminder: `用户 ${"{topPlatform}"} 收藏占比超60%，可建议按主题/UP主分类`,
    priority: 70,
    isProactive: true,
  },
  {
    id: "untagged-many",
    condition: (ctx) => (ctx.stats.untaggedCount ?? 0) > 50,
    reminder: "用户有大量无标签收藏，在整理相关操作时可主动建议打标签",
    priority: 60,
    isProactive: true,
  },
  {
    id: "folder-empty",
    condition: (ctx) =>
      ctx.stats.topFolders.length > 0 &&
      ctx.stats.topFolders.some((f) => f.count === 0),
    reminder: "用户有空文件夹存在，可在整理时建议清理或使用",
    priority: 50,
    isProactive: false,
  },
  {
    id: "recent-activity-high",
    condition: (ctx) => ctx.stats.recentWeekCount > 30,
    reminder: "用户本周收藏活跃（30+条），可建议定期整理以保持有序",
    priority: 65,
    isProactive: true,
  },
  {
    id: "selected-items",
    condition: (ctx) => (ctx.session.selectedBookmarkIds?.length ?? 0) > 0,
    reminder: `用户当前选中了 ${"{selectedCount}"} 条书签，操作时优先考虑选中项`,
    priority: 90,
    isProactive: false,
  },
];

/**
 * 格式化提醒内容（替换占位符）
 */
function formatReminder(reminder: string, context: DynamicContext): string {
  return reminder
    .replace("{topPlatform}", context.stats.topPlatform.name)
    .replace(
      "{selectedCount}",
      String(context.session.selectedBookmarkIds?.length ?? 0),
    );
}

/**
 * 获取匹配的提醒列表
 *
 * @param context 动态上下文
 * @param maxReminders 最大提醒数量（默认2，避免干扰）
 */
export function getActiveReminders(
  context: DynamicContext,
  maxReminders: number = 2,
): ReminderTrigger[] {
  return REMINDER_TRIGGERS.filter((t) => t.condition(context))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxReminders);
}

/**
 * 注入 System-Reminder 到 Prompt
 *
 * @param basePrompt 基础 Prompt
 * @param context 动态上下文
 * @param options 注入选项
 */
export function injectSystemReminders(
  basePrompt: string,
  context: DynamicContext,
  options: { maxReminders?: number; enableProactive?: boolean } = {},
): string {
  const { maxReminders = 2, enableProactive = true } = options;

  let triggers = getActiveReminders(context, maxReminders);

  // 如果禁用主动建议，过滤掉 isProactive 的提醒
  if (!enableProactive) {
    triggers = triggers.filter((t) => !t.isProactive);
  }

  if (triggers.length === 0) {
    return basePrompt;
  }

  const reminderBlock = triggers
    .map(
      (t) =>
        `<system-reminder>${formatReminder(t.reminder, context)}</system-reminder>`,
    )
    .join("\n");

  return `${basePrompt}\n\n## 智能提醒\n\n${reminderBlock}`;
}

/**
 * 判断是否应该注入提醒
 *
 * 避免过度干扰：仅在特定条件下注入
 */
export function shouldInjectReminders(context: DynamicContext): boolean {
  // 有选中项时始终注入（非干扰性）
  if ((context.session.selectedBookmarkIds?.length ?? 0) > 0) {
    return true;
  }

  // 收藏数量较多时才考虑主动建议
  if (context.stats.totalBookmarks < 50) {
    return false;
  }

  return true;
}
```

### 6.3 使用示例

```typescript
// 在 prompt-injector.ts 中集成
import {
  injectSystemReminders,
  shouldInjectReminders,
} from "./system-reminder-injector";

export function buildFullPrompt(
  basePrompt: string,
  context: DynamicContext,
): string {
  let prompt = basePrompt;

  // 注入动态上下文
  prompt = mergeSystemPrompt(prompt, context);

  // 注入 System-Reminder（如果条件满足）
  if (shouldInjectReminders(context)) {
    prompt = injectSystemReminders(prompt, context);
  }

  return prompt;
}
```

---

## 七、增强置信度计算模块（新增）

> **借鉴来源**：Claude Code Agent 的多因素置信度评估机制

### 7.1 设计理念

Claude Code 的工具执行引擎使用多阶段验证流程，综合多个因素评估执行可信度。AnyKeep 借鉴这一机制，通过多因素综合计算提升意图理解的准确性。

### 7.2 新增文件

```typescript
// src/lib/ai-agent/context/enhanced-confidence.ts

/**
 * 增强置信度计算器
 *
 * 综合多个因素评估意图理解的置信度
 * 借鉴：Claude Code Agent 的多阶段验证机制
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type {
  IntentClassification,
  ExtractedEntity,
} from "@/lib/ai-skills/router/types";
import type { DynamicContext } from "./types";

/**
 * 置信度因素
 */
export interface ConfidenceFactor {
  /** 因素名称 */
  name: string;
  /** 权重（0-1） */
  weight: number;
  /** 分数（0-1） */
  score: number;
  /** 说明 */
  reason: string;
}

/**
 * 增强置信度结果
 */
export interface EnhancedConfidenceResult {
  /** 原始置信度 */
  originalConfidence: number;
  /** 增强后置信度 */
  enhancedConfidence: number;
  /** 各因素详情 */
  factors: ConfidenceFactor[];
  /** 置信度级别 */
  level: "high" | "medium" | "low";
  /** 建议的执行策略 */
  suggestedStrategy: "silent" | "explain" | "clarify";
}

/**
 * 获取意图类型所需的实体
 */
function getRequiredEntities(intentType: string): string[] {
  const requirements: Record<string, string[]> = {
    query: [],
    action: ["target"],
    organize: ["platform", "folder"],
    analyze: ["time"],
    learn: ["topic"],
    create: ["topic"],
  };
  return requirements[intentType] ?? [];
}

/**
 * 计算实体完整度
 */
function calculateEntityCompleteness(
  intent: IntentClassification,
): ConfidenceFactor {
  const requiredEntities = getRequiredEntities(intent.type);

  if (requiredEntities.length === 0) {
    return {
      name: "entity_completeness",
      weight: 0.15,
      score: 1.0,
      reason: "此意图类型无必需实体",
    };
  }

  const foundEntities = intent.entities.map((e) => e.type);
  const matchCount = requiredEntities.filter((e) =>
    foundEntities.includes(e as ExtractedEntity["type"]),
  ).length;
  const completeness = matchCount / requiredEntities.length;

  return {
    name: "entity_completeness",
    weight: 0.15,
    score: completeness,
    reason:
      completeness === 1
        ? "所有必需实体已提取"
        : `缺少实体: ${requiredEntities.filter((e) => !foundEntities.includes(e as ExtractedEntity["type"])).join(", ")}`,
  };
}

/**
 * 计算上下文相关度
 */
function calculateContextRelevance(
  intent: IntentClassification,
  context: DynamicContext,
): ConfidenceFactor {
  let score = 0.8; // 基础分
  let reason = "上下文相关度正常";

  // 整理意图但收藏太少
  if (intent.type === "organize" && context.stats.totalBookmarks < 10) {
    score = 0.5;
    reason = "收藏数量较少，整理意图可能不准确";
  }

  // 搜索意图但没有关键词实体
  if (
    intent.type === "query" &&
    intent.subType === "search" &&
    !intent.entities.some((e) => e.type === "topic")
  ) {
    score = 0.6;
    reason = "搜索意图但未提取到关键词";
  }

  // 平台相关但平台不匹配
  const platformEntity = intent.entities.find((e) => e.type === "platform");
  if (
    platformEntity &&
    context.stats.topPlatform.name.toLowerCase() !==
      platformEntity.value.toLowerCase()
  ) {
    // 提及的平台不是用户最常用的，略微降低置信度
    score *= 0.95;
    reason = "提及的平台非用户最常用";
  }

  return {
    name: "context_relevance",
    weight: 0.2,
    score,
    reason,
  };
}

/**
 * 计算历史行为匹配度
 */
function calculateHistoryMatch(
  intent: IntentClassification,
  context: DynamicContext,
): ConfidenceFactor {
  const frequentActions = context.preferences.frequentActions ?? [];

  if (frequentActions.length === 0) {
    return {
      name: "history_match",
      weight: 0.1,
      score: 0.7,
      reason: "无历史行为数据",
    };
  }

  const isFrequent = frequentActions.includes(intent.type);

  return {
    name: "history_match",
    weight: 0.1,
    score: isFrequent ? 1.0 : 0.7,
    reason: isFrequent ? "符合用户常见操作模式" : "非用户常见操作类型",
  };
}

/**
 * 计算消息清晰度
 */
function calculateMessageClarity(
  message: string,
  intent: IntentClassification,
): ConfidenceFactor {
  let score = 0.8;
  let reason = "消息清晰度正常";

  // 消息太短
  if (message.length < 5) {
    score = 0.5;
    reason = "消息过短，可能信息不足";
  }

  // 消息太长（可能包含多个意图）
  if (message.length > 100) {
    score = 0.7;
    reason = "消息较长，可能包含多个意图";
  }

  // 包含问号（可能是疑问而非指令）
  if (message.includes("?") || message.includes("？")) {
    if (intent.type !== "query") {
      score *= 0.9;
      reason = "消息为疑问句，但识别为非查询意图";
    }
  }

  return {
    name: "message_clarity",
    weight: 0.15,
    score,
    reason,
  };
}

/**
 * 计算增强置信度
 *
 * @param intent 意图分类结果
 * @param context 动态上下文
 * @param message 原始用户消息
 */
export function calculateEnhancedConfidence(
  intent: IntentClassification,
  context: DynamicContext,
  message: string,
): EnhancedConfidenceResult {
  const factors: ConfidenceFactor[] = [
    // 因素1：原始规则置信度
    {
      name: "rule_confidence",
      weight: 0.4,
      score: intent.confidence,
      reason: `规则匹配置信度: ${(intent.confidence * 100).toFixed(0)}%`,
    },
    // 因素2：实体完整度
    calculateEntityCompleteness(intent),
    // 因素3：上下文相关度
    calculateContextRelevance(intent, context),
    // 因素4：历史行为匹配
    calculateHistoryMatch(intent, context),
    // 因素5：消息清晰度
    calculateMessageClarity(message, intent),
  ];

  // 计算加权平均
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weightedSum = factors.reduce((sum, f) => sum + f.weight * f.score, 0);
  const enhancedConfidence = Math.min(
    1,
    Math.max(0, weightedSum / totalWeight),
  );

  // 确定置信度级别
  let level: "high" | "medium" | "low";
  let suggestedStrategy: "silent" | "explain" | "clarify";

  if (enhancedConfidence >= 0.85) {
    level = "high";
    suggestedStrategy = "silent";
  } else if (enhancedConfidence >= 0.6) {
    level = "medium";
    suggestedStrategy = "explain";
  } else {
    level = "low";
    suggestedStrategy = "clarify";
  }

  return {
    originalConfidence: intent.confidence,
    enhancedConfidence,
    factors,
    level,
    suggestedStrategy,
  };
}

/**
 * 快速计算增强置信度（不返回详情）
 */
export function getEnhancedConfidence(
  intent: IntentClassification,
  context: DynamicContext,
  message: string,
): number {
  return calculateEnhancedConfidence(intent, context, message)
    .enhancedConfidence;
}
```

### 7.3 使用示例

```typescript
// 在 UnifiedEngine 或 KnowledgeAgent 中集成
import { calculateEnhancedConfidence } from "../context/enhanced-confidence";
import { getConfidenceLevel } from "../core/prompts/response-templates";

async function processUserMessage(message: string, context: DynamicContext) {
  // 1. 意图分类
  const intent = await intentClassifier.classify(message);

  // 2. 增强置信度计算
  const confidenceResult = calculateEnhancedConfidence(
    intent,
    context,
    message,
  );

  // 3. 根据增强置信度选择策略
  const strategy = confidenceResult.suggestedStrategy;

  switch (strategy) {
    case "silent":
      // 静默执行
      return executeDirectly(intent);
    case "explain":
      // 执行 + 说明
      return executeWithExplanation(intent, confidenceResult);
    case "clarify":
      // 轻量澄清
      return askForClarification(intent, confidenceResult);
  }
}
```

---

## 八、导出索引更新

### 8.1 Prompts 模块导出

```typescript
// src/lib/ai-agent/core/prompts/index.ts

/**
 * Prompts 模块导出
 *
 * @version 2.0.0
 * @since 2025-12-26
 */

// 主 System Prompt
export {
  KNOWLEDGE_AGENT_SYSTEM_PROMPT,
  KNOWLEDGE_AGENT_SYSTEM_PROMPT_V2,
  REACT_THINKING_PROMPT,
  TOOL_CALLING_CONVENTION_PROMPT,
  LEGACY_SYSTEM_PROMPT,
} from "./knowledge-agent.prompt";

// 响应模板
export {
  CONFIDENCE_THRESHOLDS,
  RISK_OPERATIONS,
  BATCH_CONFIRMATION_THRESHOLD,
  RESPONSE_TEMPLATES_PROMPT,
  getConfidenceLevel,
  getOperationRiskLevel,
  requiresConfirmation,
  type ConfidenceLevel,
  type RiskLevel,
} from "./response-templates";

// 隐含意图规则
export {
  IMPLICIT_INTENT_RULES,
  IMPLICIT_INTENT_RULES_PROMPT,
  matchImplicitIntent,
  matchAllImplicitIntents,
  type ImplicitIntentRule,
} from "./implicit-intent-rules";
```

### 8.2 Context 模块导出

```typescript
// src/lib/ai-agent/context/index.ts

/**
 * Context 模块导出
 *
 * @version 2.0.0
 * @since 2025-12-27
 */

// 动态上下文构建
export {
  DynamicContextBuilder,
  createDynamicContextBuilder,
} from "./dynamic-context-builder";

// Prompt 注入
export {
  buildContextPrompt,
  buildMinimalContextPrompt,
  mergeSystemPrompt,
  estimateContextTokens,
} from "./prompt-injector";

// System-Reminder 动态注入（新增）
export {
  REMINDER_TRIGGERS,
  getActiveReminders,
  injectSystemReminders,
  shouldInjectReminders,
  type ReminderTrigger,
} from "./system-reminder-injector";

// 增强置信度计算（新增）
export {
  calculateEnhancedConfidence,
  getEnhancedConfidence,
  type ConfidenceFactor,
  type EnhancedConfidenceResult,
} from "./enhanced-confidence";

// 类型定义
export type { DynamicContext, TimeContext, StatsContext } from "./types";
```

---

## 九、Feature Flag 配置

### 9.1 新增配置项

```typescript
// 添加到 src/lib/ai-agent/config/feature-flags.ts

/**
 * 任务理解层 v2.0 Feature Flags
 */
export const TASK_UNDERSTANDING_V2_FLAGS = {
  /**
   * 启用 v2.0 System Prompt
   * @default true
   */
  ENABLE_V2_PROMPT: process.env.ENABLE_V2_PROMPT !== "false",

  /**
   * 启用置信度分层执行
   * @default true
   */
  ENABLE_CONFIDENCE_TIERING: process.env.ENABLE_CONFIDENCE_TIERING !== "false",

  /**
   * 启用隐含意图推断
   * @default true
   */
  ENABLE_IMPLICIT_INTENT: process.env.ENABLE_IMPLICIT_INTENT !== "false",

  /**
   * 高置信度阈值
   * @default 0.85
   */
  HIGH_CONFIDENCE_THRESHOLD: parseFloat(
    process.env.HIGH_CONFIDENCE_THRESHOLD || "0.85",
  ),

  /**
   * 中置信度阈值
   * @default 0.60
   */
  MEDIUM_CONFIDENCE_THRESHOLD: parseFloat(
    process.env.MEDIUM_CONFIDENCE_THRESHOLD || "0.60",
  ),

  /**
   * 批量操作确认阈值
   * @default 20
   */
  BATCH_CONFIRMATION_THRESHOLD: parseInt(
    process.env.BATCH_CONFIRMATION_THRESHOLD || "20",
    10,
  ),
} as const;
```

### 9.2 环境变量说明

```bash
# .env.local - 任务理解层 v2.0 配置

# 启用 v2.0 System Prompt (默认 true)
ENABLE_V2_PROMPT=true

# 启用置信度分层执行 (默认 true)
ENABLE_CONFIDENCE_TIERING=true

# 启用隐含意图推断 (默认 true)
ENABLE_IMPLICIT_INTENT=true

# 高置信度阈值 (默认 0.85)
HIGH_CONFIDENCE_THRESHOLD=0.85

# 中置信度阈值 (默认 0.60)
MEDIUM_CONFIDENCE_THRESHOLD=0.60

# 批量操作确认阈值 (默认 20)
BATCH_CONFIRMATION_THRESHOLD=20
```

---

## 十、测试用例

### 10.1 现有功能测试

```typescript
// src/lib/ai-agent/__tests__/task-understanding-v2.test.ts

/**
 * 任务理解层 v2.0 测试用例
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { describe, it, expect } from "vitest";
import {
  getConfidenceLevel,
  getOperationRiskLevel,
  requiresConfirmation,
  CONFIDENCE_THRESHOLDS,
} from "../core/prompts/response-templates";
import {
  matchImplicitIntent,
  matchAllImplicitIntents,
} from "../core/prompts/implicit-intent-rules";

describe("置信度分层", () => {
  describe("getConfidenceLevel", () => {
    it("高置信度 (≥0.85) 返回 high", () => {
      expect(getConfidenceLevel(0.85)).toBe("high");
      expect(getConfidenceLevel(0.9)).toBe("high");
      expect(getConfidenceLevel(1.0)).toBe("high");
    });

    it("中置信度 (0.60-0.84) 返回 medium", () => {
      expect(getConfidenceLevel(0.6)).toBe("medium");
      expect(getConfidenceLevel(0.7)).toBe("medium");
      expect(getConfidenceLevel(0.84)).toBe("medium");
    });

    it("低置信度 (<0.60) 返回 low", () => {
      expect(getConfidenceLevel(0.59)).toBe("low");
      expect(getConfidenceLevel(0.4)).toBe("low");
      expect(getConfidenceLevel(0.0)).toBe("low");
    });
  });

  describe("getOperationRiskLevel", () => {
    it("查询操作为低风险", () => {
      expect(getOperationRiskLevel("list_recent")).toBe("low");
      expect(getOperationRiskLevel("search_bookmarks")).toBe("low");
      expect(getOperationRiskLevel("count_total")).toBe("low");
    });

    it("修改操作为中风险", () => {
      expect(getOperationRiskLevel("add_tag")).toBe("medium");
      expect(getOperationRiskLevel("move_bookmarks")).toBe("medium");
      expect(getOperationRiskLevel("export_bookmarks")).toBe("medium");
    });

    it("删除操作为高风险", () => {
      expect(getOperationRiskLevel("delete_bookmark")).toBe("high");
      expect(getOperationRiskLevel("batch_delete")).toBe("high");
      expect(getOperationRiskLevel("remove_all")).toBe("high");
    });
  });

  describe("requiresConfirmation", () => {
    it("高风险操作始终需要确认", () => {
      expect(requiresConfirmation("delete", 1)).toBe(true);
      expect(requiresConfirmation("delete", 5)).toBe(true);
    });

    it("批量操作超过阈值需要确认", () => {
      expect(requiresConfirmation("move", 21)).toBe(true);
      expect(requiresConfirmation("add_tag", 50)).toBe(true);
    });

    it("低风险小批量操作不需要确认", () => {
      expect(requiresConfirmation("list", 10)).toBe(false);
      expect(requiresConfirmation("search", 5)).toBe(false);
    });

    it("中风险小批量操作不需要确认", () => {
      expect(requiresConfirmation("move", 10)).toBe(false);
      expect(requiresConfirmation("add_tag", 5)).toBe(false);
    });
  });
});

describe("隐含意图推断", () => {
  describe("matchImplicitIntent", () => {
    it('匹配"整理"为分类意图，非删除', () => {
      const result = matchImplicitIntent("帮我整理一下B站视频");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("organize-not-delete");
      expect(result?.hiddenExpectation).toContain("不要删除");
    });

    it('匹配"太多"为分组意图，非删除', () => {
      const result = matchImplicitIntent("收藏太多了");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("too-many-not-delete");
      expect(result?.hiddenExpectation).toContain("不是要删除");
    });

    it('匹配"找不到"为搜索意图', () => {
      const result = matchImplicitIntent("找不到那篇React文章");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("cant-find-search");
    });

    it('匹配"最近"为7天范围', () => {
      const result = matchImplicitIntent("最近收藏的");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("recent-7days");
    });

    it('匹配"帮我看看"为概览意图，非操作', () => {
      const result = matchImplicitIntent("帮我看看收藏情况");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("look-at-overview");
      expect(result?.hiddenExpectation).toContain("不是要执行操作");
    });

    it('匹配"那个"为上下文引用', () => {
      const result = matchImplicitIntent("删掉那个");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("that-one-context");
    });

    it('匹配"都"为批量操作，需确认', () => {
      const result = matchImplicitIntent("都删掉");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("all-batch-confirm");
    });

    it("无匹配返回 null", () => {
      const result = matchImplicitIntent("你好");
      expect(result).toBeNull();
    });
  });

  describe("matchAllImplicitIntents", () => {
    it("返回所有匹配的规则，按优先级排序", () => {
      const results = matchAllImplicitIntents("帮我整理一下最近太多的收藏");
      expect(results.length).toBeGreaterThanOrEqual(2);
      // 应按优先级降序排列
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].priority).toBeGreaterThanOrEqual(
          results[i].priority,
        );
      }
    });
  });
});

describe("场景集成测试", () => {
  describe("简单查询场景", () => {
    it("高置信度查询应静默执行", () => {
      const confidence = 0.9;
      const operation = "count_total";

      expect(getConfidenceLevel(confidence)).toBe("high");
      expect(getOperationRiskLevel(operation)).toBe("low");
      expect(requiresConfirmation(operation, 1)).toBe(false);
      // 预期行为：直接执行，简洁结果
    });
  });

  describe("模糊意图场景", () => {
    it("中置信度整理请求应执行+说明", () => {
      const message = "帮我整理一下";
      const confidence = 0.75;

      const implicitIntent = matchImplicitIntent(message);
      expect(implicitIntent?.id).toBe("organize-not-delete");
      expect(getConfidenceLevel(confidence)).toBe("medium");
      // 预期行为：执行 + "我理解为X，如需调整告诉我"
    });
  });

  describe("歧义场景", () => {
    it("低置信度指代应轻量澄清", () => {
      const message = "删掉那个";
      const confidence = 0.45;

      const implicitIntent = matchImplicitIntent(message);
      expect(implicitIntent?.id).toBe("that-one-context");
      expect(getConfidenceLevel(confidence)).toBe("low");
      // 预期行为：轻量澄清 + 推荐选项
    });
  });

  describe("高风险场景", () => {
    it("批量删除应强制确认", () => {
      const operation = "delete";
      const affectedCount = 50;

      expect(getOperationRiskLevel(operation)).toBe("high");
      expect(requiresConfirmation(operation, affectedCount)).toBe(true);
      // 预期行为：⚠️ 确认提示
    });
  });
});
```

### 10.2 System-Reminder 注入测试

```typescript
// src/lib/ai-agent/__tests__/system-reminder-injector.test.ts

import { describe, it, expect } from "vitest";
import {
  getActiveReminders,
  injectSystemReminders,
  shouldInjectReminders,
  REMINDER_TRIGGERS,
} from "../context/system-reminder-injector";
import type { DynamicContext } from "../context/types";

// Mock 上下文工厂
function createMockContext(
  overrides: Partial<DynamicContext> = {},
): DynamicContext {
  return {
    time: {
      current: "2025-12-27 14:30",
      period: "afternoon",
      isWeekend: false,
    },
    stats: {
      totalBookmarks: 100,
      recentWeekCount: 10,
      topPlatform: { name: "BILIBILI", count: 60 },
      topFolders: [{ id: "1", name: "技术", count: 30 }],
      untaggedCount: 20,
    },
    preferences: {
      frequentTags: ["前端", "React"],
      frequentActions: ["query", "search"],
    },
    recentActivity: {},
    session: {},
    ...overrides,
  } as DynamicContext;
}

describe("System-Reminder 注入器", () => {
  describe("getActiveReminders", () => {
    it("用户收藏活跃但一周无整理时触发提醒", () => {
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 150,
          recentWeekCount: 0,
          topPlatform: { name: "WECHAT", count: 50 },
          topFolders: [],
          untaggedCount: 30,
        },
      });

      const reminders = getActiveReminders(ctx);
      expect(reminders.some((r) => r.id === "long-inactive")).toBe(true);
    });

    it("单一平台占比超60%时建议分类", () => {
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 100,
          recentWeekCount: 10,
          topPlatform: { name: "BILIBILI", count: 70 },
          topFolders: [],
        },
      });

      const reminders = getActiveReminders(ctx);
      expect(reminders.some((r) => r.id === "platform-dominant")).toBe(true);
    });

    it("有选中项时优先提醒", () => {
      const ctx = createMockContext({
        session: { selectedBookmarkIds: ["1", "2", "3"] },
      });

      const reminders = getActiveReminders(ctx);
      expect(reminders.some((r) => r.id === "selected-items")).toBe(true);
      // selected-items 优先级最高 (90)
      if (reminders.length > 0) {
        expect(reminders[0].id).toBe("selected-items");
      }
    });

    it("限制最大提醒数量", () => {
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 200,
          recentWeekCount: 50,
          topPlatform: { name: "BILIBILI", count: 130 },
          topFolders: [{ id: "1", name: "空文件夹", count: 0 }],
          untaggedCount: 80,
        },
      });

      const reminders = getActiveReminders(ctx, 2);
      expect(reminders.length).toBeLessThanOrEqual(2);
    });
  });

  describe("shouldInjectReminders", () => {
    it("收藏数量少于50时不注入", () => {
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 30,
          recentWeekCount: 5,
          topPlatform: { name: "OTHER", count: 10 },
          topFolders: [],
        },
      });

      expect(shouldInjectReminders(ctx)).toBe(false);
    });

    it("有选中项时始终注入", () => {
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 10,
          recentWeekCount: 2,
          topPlatform: { name: "OTHER", count: 5 },
          topFolders: [],
        },
        session: { selectedBookmarkIds: ["1"] },
      });

      expect(shouldInjectReminders(ctx)).toBe(true);
    });

    it("收藏数量足够时注入", () => {
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 100,
          recentWeekCount: 10,
          topPlatform: { name: "WECHAT", count: 40 },
          topFolders: [],
        },
      });

      expect(shouldInjectReminders(ctx)).toBe(true);
    });
  });

  describe("injectSystemReminders", () => {
    it("正确注入提醒到 Prompt", () => {
      const basePrompt = "你是 AI 助手";
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 150,
          recentWeekCount: 0,
          topPlatform: { name: "WECHAT", count: 50 },
          topFolders: [],
        },
      });

      const result = injectSystemReminders(basePrompt, ctx);
      expect(result).toContain("## 智能提醒");
      expect(result).toContain("<system-reminder>");
    });

    it("无触发条件时不修改 Prompt", () => {
      const basePrompt = "你是 AI 助手";
      const ctx = createMockContext({
        stats: {
          totalBookmarks: 50,
          recentWeekCount: 5,
          topPlatform: { name: "OTHER", count: 10 },
          topFolders: [],
          untaggedCount: 5,
        },
      });

      const result = injectSystemReminders(basePrompt, ctx);
      expect(result).toBe(basePrompt);
    });
  });
});
```

### 10.3 增强置信度计算测试

```typescript
// src/lib/ai-agent/__tests__/enhanced-confidence.test.ts

import { describe, it, expect } from "vitest";
import {
  calculateEnhancedConfidence,
  getEnhancedConfidence,
} from "../context/enhanced-confidence";
import type { IntentClassification } from "@/lib/ai-skills/router/types";
import type { DynamicContext } from "../context/types";

// Mock 意图分类结果
function createMockIntent(
  overrides: Partial<IntentClassification> = {},
): IntentClassification {
  return {
    type: "query",
    subType: "search",
    confidence: 0.85,
    entities: [],
    requiresMultiStep: false,
    hasDeliverableExpectation: false,
    matchedRule: "test-rule",
    ...overrides,
  } as IntentClassification;
}

// Mock 上下文
function createMockContext(
  overrides: Partial<DynamicContext> = {},
): DynamicContext {
  return {
    time: {
      current: "2025-12-27 14:30",
      period: "afternoon",
      isWeekend: false,
    },
    stats: {
      totalBookmarks: 100,
      recentWeekCount: 10,
      topPlatform: { name: "BILIBILI", count: 40 },
      topFolders: [{ id: "1", name: "技术", count: 30 }],
    },
    preferences: {
      frequentTags: ["前端"],
      frequentActions: ["query", "search"],
    },
    recentActivity: {},
    session: {},
    ...overrides,
  } as DynamicContext;
}

describe("增强置信度计算", () => {
  describe("calculateEnhancedConfidence", () => {
    it("高原始置信度 + 完整实体 = 高增强置信度", () => {
      const intent = createMockIntent({
        type: "query",
        confidence: 0.95,
        entities: [],
      });
      const ctx = createMockContext();
      const message = "我有多少收藏";

      const result = calculateEnhancedConfidence(intent, ctx, message);

      expect(result.level).toBe("high");
      expect(result.suggestedStrategy).toBe("silent");
      expect(result.enhancedConfidence).toBeGreaterThanOrEqual(0.85);
    });

    it("中等原始置信度 = 中等增强置信度", () => {
      const intent = createMockIntent({
        type: "organize",
        confidence: 0.7,
        entities: [
          { type: "platform", value: "BILIBILI", confidence: 0.8, raw: "B站" },
        ],
      });
      const ctx = createMockContext();
      const message = "整理一下B站视频";

      const result = calculateEnhancedConfidence(intent, ctx, message);

      expect(result.level).toBe("medium");
      expect(result.suggestedStrategy).toBe("explain");
    });

    it("低原始置信度 + 消息过短 = 低增强置信度", () => {
      const intent = createMockIntent({
        type: "action",
        confidence: 0.45,
        entities: [],
      });
      const ctx = createMockContext();
      const message = "那个";

      const result = calculateEnhancedConfidence(intent, ctx, message);

      expect(result.level).toBe("low");
      expect(result.suggestedStrategy).toBe("clarify");
      expect(result.enhancedConfidence).toBeLessThan(0.6);
    });

    it("缺少必需实体时降低置信度", () => {
      const intent = createMockIntent({
        type: "organize",
        confidence: 0.85,
        entities: [], // 缺少 platform 或 folder 实体
      });
      const ctx = createMockContext();
      const message = "整理收藏";

      const result = calculateEnhancedConfidence(intent, ctx, message);

      // 原始 0.85 高置信度因缺少实体被降低
      expect(result.enhancedConfidence).toBeLessThan(0.85);
      expect(
        result.factors.some(
          (f) => f.name === "entity_completeness" && f.score < 1,
        ),
      ).toBe(true);
    });

    it("符合用户常见行为时加分", () => {
      const intent = createMockIntent({
        type: "query",
        confidence: 0.75,
      });
      const ctx = createMockContext({
        preferences: { frequentActions: ["query", "search"], frequentTags: [] },
      });
      const message = "搜索React文章";

      const result = calculateEnhancedConfidence(intent, ctx, message);

      const historyFactor = result.factors.find(
        (f) => f.name === "history_match",
      );
      expect(historyFactor?.score).toBe(1.0);
    });

    it("疑问句但非查询意图时降低置信度", () => {
      const intent = createMockIntent({
        type: "action",
        confidence: 0.8,
      });
      const ctx = createMockContext();
      const message = "你能帮我整理一下吗？";

      const result = calculateEnhancedConfidence(intent, ctx, message);

      const clarityFactor = result.factors.find(
        (f) => f.name === "message_clarity",
      );
      expect(clarityFactor?.score).toBeLessThan(1.0);
    });
  });

  describe("getEnhancedConfidence", () => {
    it("返回增强后的置信度数值", () => {
      const intent = createMockIntent({ confidence: 0.9 });
      const ctx = createMockContext();
      const message = "查看最近收藏";

      const confidence = getEnhancedConfidence(intent, ctx, message);

      expect(typeof confidence).toBe("number");
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });
  });
});
```

---

## 十一、实施步骤

### 11.1 Phase 1: 基础模块实现（2-3小时）

| 步骤 | 任务                             | 预计时间 |
| ---- | -------------------------------- | -------- |
| 1.1  | 创建 `response-templates.ts`     | 30分钟   |
| 1.2  | 创建 `implicit-intent-rules.ts`  | 30分钟   |
| 1.3  | 更新 `knowledge-agent.prompt.ts` | 45分钟   |
| 1.4  | 更新 `index.ts` 导出             | 15分钟   |
| 1.5  | 添加 Feature Flags               | 15分钟   |

### 11.2 Phase 2: 新增模块实现（2小时）

| 步骤 | 任务                               | 预计时间 |
| ---- | ---------------------------------- | -------- |
| 2.1  | 创建 `system-reminder-injector.ts` | 45分钟   |
| 2.2  | 创建 `enhanced-confidence.ts`      | 45分钟   |
| 2.3  | 更新 `context/index.ts` 导出       | 15分钟   |
| 2.4  | 集成到 `prompt-injector.ts`        | 15分钟   |

### 11.3 Phase 3: 测试验证（2-3小时）

| 步骤 | 任务                          | 预计时间 |
| ---- | ----------------------------- | -------- |
| 3.1  | 编写基础模块单元测试          | 45分钟   |
| 3.2  | 编写 System-Reminder 测试     | 30分钟   |
| 3.3  | 编写 Enhanced Confidence 测试 | 30分钟   |
| 3.4  | 运行测试套件                  | 15分钟   |
| 3.5  | 手动场景测试                  | 45分钟   |
| 3.6  | 修复问题                      | 30分钟   |

### 11.4 Phase 4: 集成切换（1小时）

| 步骤 | 任务                               | 预计时间 |
| ---- | ---------------------------------- | -------- |
| 4.1  | 更新 KnowledgeAgent 使用 v2 Prompt | 20分钟   |
| 4.2  | 端到端测试                         | 30分钟   |
| 4.3  | 文档更新                           | 10分钟   |

**总预计时间**：7-9 小时

---

## 十二、回滚方案

### 12.1 快速回滚

```typescript
// 通过环境变量禁用 v2 Prompt
ENABLE_V2_PROMPT = false;
```

### 12.2 代码回滚

```typescript
// 在 knowledge-agent.ts 中切换
import {
  KNOWLEDGE_AGENT_SYSTEM_PROMPT, // v1
  KNOWLEDGE_AGENT_SYSTEM_PROMPT_V2, // v2
} from "./prompts";

const systemPrompt = TASK_UNDERSTANDING_V2_FLAGS.ENABLE_V2_PROMPT
  ? KNOWLEDGE_AGENT_SYSTEM_PROMPT_V2
  : KNOWLEDGE_AGENT_SYSTEM_PROMPT;
```

---

## 十三、验收标准

### 13.1 功能验收

| 场景                  | 预期行为               | 验收状态 |
| --------------------- | ---------------------- | -------- |
| 简单查询 "有多少收藏" | 静默执行，直接返回数字 | ⬜       |
| 模糊请求 "帮我整理"   | 执行 + 说明理解        | ⬜       |
| 歧义表达 "那个"       | 轻量澄清 + 推荐选项    | ⬜       |
| 批量删除              | 强制确认提示           | ⬜       |
| 高置信度操作          | 无额外交互             | ⬜       |

### 13.2 性能验收

| 指标                | 目标   | 验收状态 |
| ------------------- | ------ | -------- |
| System Prompt Token | < +30% | ⬜       |
| 响应延迟            | < +10% | ⬜       |
| 测试通过率          | 100%   | ⬜       |

### 13.3 零接管验收

| 指标           | 目标  | 验收状态 |
| -------------- | ----- | -------- |
| 简单查询打扰率 | 0%    | ⬜       |
| 总体打扰率     | < 15% | ⬜       |

---

**文档结束**

_此方案由 BMad Master 生成，待 Xiafe 审核。_
