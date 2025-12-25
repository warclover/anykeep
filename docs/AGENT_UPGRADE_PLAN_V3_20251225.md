# AnyKeep Agent 能力升级方案 V3（深化版）

> **版本**: 3.2.0
> **日期**: 2025-12-25
> **核心理念**: 对标 YouMind，分批实施，精准突破
> **状态**: ✅ 用户已确认 + 实测验证 + UI 升级
> **更新**: V3.2 新增 Batch 7 - AI 交互 UI 升级（基于 YouMind 界面分析）

---

## 执行摘要

### YouMind AI 助手为何「感觉最智能」？

通过深入分析 4 份 YouMind 调研文档，BMad Master 找到了核心答案：

```
┌─────────────────────────────────────────────────────────────────┐
│              YouMind AI 智能的三大支柱                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1️⃣ 意图即执行                                                  │
│     用户说"有多少资料" → 直接调用 Tool → 返回准确数字             │
│     不是"我来帮你查一下"的敷衍，而是即时精准的结果                 │
│                                                                 │
│  2️⃣ 上下文连续                                                  │
│     "把刚才的待办清单保存为新页面"                                │
│     AI 记住了"刚才"，直接执行，无需用户重复                       │
│                                                                 │
│  3️⃣ 操作闭环                                                   │
│     不仅回答问题，还能执行操作                                   │
│     生成内容 → 确认 → 保存 → 反馈链接                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### AnyKeep 的现状对比

| 维度         | YouMind        | AnyKeep 现有能力             | 差距分析                 |
| ------------ | -------------- | ---------------------------- | ------------------------ |
| **架构**     | Agent + Tools  | ✅ 已有 95 Tools + 15 Skills | 架构具备                 |
| **数据感知** | 可统计查询     | ⚠️ 有 Tools 但调用不稳定     | 需优化                   |
| **内容理解** | 读取全文       | ⚠️ 有能力但场景覆盖弱        | 需深化                   |
| **操作执行** | 创建/更新/删除 | ⚠️ 有 Tools 但用户感知弱     | 需打磨                   |
| **意图理解** | 精准           | ❌ 易误判（核心问题）        | **必须修复**             |
| **响应风格** | 自然简洁       | ❌ 程序化                    | **必须改进**             |
| **上下文**   | 项目级记忆     | ❌ 无持久化                  | **必须实现（实测验证）** |

### 核心结论

> **AnyKeep 的问题不是架构不行，是执行不精准、体验不自然**

YouMind 智能的本质是：**意图理解准 + 工具调用对 + 响应简洁快**

AnyKeep 已有 95 个 Tools，但：

- 用户说"总结"，Agent 去"分类" → 意图理解错误
- 用户感觉在和"提示词模板"交互 → 响应不自然
- 核心场景（搜索、整理、萃取）不够深 → 竞争力弱

---

## 第一部分：YouMind 对标分析

### 1.1 YouMind AI 实测能力拆解

基于调研文档，YouMind AI 的关键交互：

**测试 1：数据感知**

```
用户：这个项目里有多少篇资料？

YouMind：
这个项目里共有 2 篇资料和 1 个创作内容：

资料：
1. 《Vibe Coding 入门指南》- 微信公众号 - 12月20日
2. 《Claude Code Quick Start》- 网页 - 12月19日

创作：
- Vibe Coding 实践待办清单
```

**分析**：

- 直接给结果，不说废话
- 分类清晰（资料 vs 创作）
- 包含元数据（来源、时间）

**测试 2：格式转化**

```
用户：帮我把第一篇文章的核心要点整理成待办清单

YouMind：
好的，我来帮你把《Vibe Coding 入门指南》整理成待办清单：

## Vibe Coding 实践待办清单

### 阶段一：环境准备
- [ ] 安装 Cursor IDE
- [ ] 配置 Claude API
...
```

**分析**：

- 理解"第一篇" → 上下文感知
- 阅读全文 → 提取要点
- 结构化输出 → Markdown 格式

**测试 3：操作执行**

```
用户：把刚才的待办清单保存为新页面

YouMind：
✅ 已创建新页面「Vibe Coding 实践待办清单」
[点击查看]
```

**分析**：

- 记住"刚才" → 上下文连续
- 执行操作 → 创建页面
- 反馈结果 → 提供链接

### 1.2 YouMind 智能体验的技术本质

```
┌─────────────────────────────────────────────────────────────┐
│                  YouMind 智能体验拆解                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   输入："帮我把第一篇文章整理成待办清单"                      │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ Step 1: 意图识别 (极快)                              │  │
│   │   - 检测到"整理成待办清单" → 格式转化意图             │  │
│   │   - 检测到"第一篇文章" → 需要定位具体资料             │  │
│   └─────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ Step 2: 工具编排 (精准)                              │  │
│   │   1. list_materials() → 获取资料列表                 │  │
│   │   2. 选择第一篇 (id=xxx)                             │  │
│   │   3. read_material_content(id) → 获取全文            │  │
│   └─────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ Step 3: 内容生成 (结构化)                            │  │
│   │   - LLM 基于全文生成待办清单                         │  │
│   │   - 输出 Markdown checkbox 格式                      │  │
│   └─────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ Step 4: 响应输出 (简洁)                              │  │
│   │   "好的，我来帮你整理：..."                          │  │
│   │   不说多余的话，直接给结果                           │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 AnyKeep 需要对标的核心点

| #   | YouMind 特点     | AnyKeep 现状       | 改进方向       |
| --- | ---------------- | ------------------ | -------------- |
| 1   | **意图识别极快** | 规则匹配有误判     | 增强消歧逻辑   |
| 2   | **工具编排精准** | Tools 多但调用不准 | 优化 Tool 选择 |
| 3   | **响应简洁直接** | 程序化、模板感     | 自然化响应     |
| 4   | **上下文连续**   | 无会话记忆         | 实现轻量记忆   |
| 5   | **操作可执行**   | 有 Tools 但体验弱  | 深化核心场景   |

---

## 第二部分：分批实施路线图（调整后）

### 总体规划

> ⚠️ **重要调整**：基于 YouMind 实测报告，将「上下文记忆」从 Batch 5 提升为 Batch 2
> **理由**：上下文记忆是搜索/整理/萃取的基础设施，没有记忆无法理解"刚才"、"这些"等指代

```
┌─────────────────────────────────────────────────────────────────┐
│              分批实施路线图（V3.1 调整后）                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Batch 1          Batch 2          Batch 3          Batch 4     │
│  ─────────        ─────────        ─────────        ─────────   │
│  意图精准化        上下文记忆        搜索体验          整理体验    │
│  (2周)            (2周)            (2周)            (2周)        │
│                   ⬆️ 提升!                                       │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐   │
│  │解决误判  │ ──▶ │会话记忆  │ ──▶ │做到精准  │ ──▶ │做到智能  │   │
│  │自然响应  │     │指代解析  │     │自然交互  │     │确认闭环  │   │
│  └─────────┘     └─────────┘     └─────────┘     └─────────┘   │
│                                                                 │
│  目标效果:                                                       │
│  "不再误判"       "记住我"        "找得准"        "整理好"       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Batch 5          Batch 6          [可选]                       │
│  ─────────        ─────────        ─────────                    │
│  知识萃取          自我进化          高级能力                     │
│  (2周)            (2周)            (持续)                        │
│                                                                 │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐                   │
│  │做到实用  │ ──▶ │纠错学习  │ ──▶ │主动智能  │                   │
│  │结构输出  │     │越用越准  │     │学习路径  │                   │
│  └─────────┘     └─────────┘     └─────────┘                   │
│                                                                 │
│  目标效果:                                                       │
│  "总结精"         "懂得学"        "主动帮"                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Batch 1：意图精准化（2周）

### 目标

> 解决"梳理内容总结纪要"被误判为"整理分类"的问题

### 1.1 问题根源

```typescript
// 当前规则（intent-classifier.ts:59-65）
{ pattern: /整理|清理|规整|梳理/, type: "organize", weight: 80 },
{ pattern: /摘要|总结|概括|速览/, type: "create", weight: 70 },

// "梳理内容总结纪要" 同时命中两条规则
// 由于 "梳理" 在前且权重高，被错误分类为 organize
```

### 1.2 解决方案

**核心改进：多候选消歧机制**

```typescript
// src/lib/ai-skills/router/intent-classifier-v2.ts

// 1. 收集所有匹配规则（不立即返回）
const candidates = this.collectAllMatches(message);

// 2. 如果多个候选，应用消歧规则
if (candidates.length > 1) {
  return this.disambiguate(message, candidates);
}

// 消歧规则示例
const DISAMBIGUATION_RULES = [
  {
    // "梳理...总结" → 实际意图是总结
    conflicts: ["organize", "create"],
    pattern: /(梳理|整理).{0,10}(总结|摘要|概括|纪要)/,
    winner: "create",
    reason: "动词+宾语结构，宾语是核心意图",
  },
  {
    // "总结并整理" → 实际意图是总结
    conflicts: ["create", "organize"],
    pattern: /(总结|摘要).{0,5}(并|后|再).{0,5}(整理|分类)/,
    winner: "create",
    reason: "主谓结构，第一个动词是主意图",
  },
  {
    // "找一下...那篇文章" → 搜索意图
    conflicts: ["query", "action"],
    pattern: /(找|搜).{0,20}(那篇|那个|文章|收藏)/,
    winner: "query",
    reason: "搜索特定内容",
  },
];
```

### 1.3 响应自然化

**当前问题**：

```
用户：帮我找一下最近的收藏

当前响应：
"根据您的请求，我正在为您搜索最近的收藏内容。以下是搜索结果：
1. xxx
2. xxx
请问还有其他需要帮助的吗？"

太程序化！
```

**改进后**：

```
用户：帮我找一下最近的收藏

改进响应：
"最近 7 天收藏了 5 条：

1. 《Vibe Coding 入门》- 微信 - 昨天
2. 《Claude 使用技巧》- B站 - 3天前
...

要看详情还是继续找？"

简洁、直接、有下一步引导
```

**实现方式**：

```typescript
// src/lib/ai-skills/response/response-style.ts

const RESPONSE_PRINCIPLES = {
  // 1. 不说废话
  avoidPhrases: ["根据您的请求", "我正在为您", "以下是", "请问还有其他"],

  // 2. 直接给结果
  directPatterns: {
    search: (count) => `找到 ${count} 个：`,
    list: (count) => `共 ${count} 条：`,
    stats: (stats) => `${stats.total} 条收藏，${stats.folders} 个文件夹`,
  },

  // 3. 有下一步
  followUpSuggestions: {
    search: ["看详情", "继续找", "筛选"],
    list: ["打开", "整理", "导出"],
  },
};
```

### 1.4 验收标准

| 测试用例                       | 预期行为                              | 优先级 |
| ------------------------------ | ------------------------------------- | ------ |
| "帮我梳理内容总结纪要"         | 识别为 `create:digest`，不是 organize | P0     |
| "整理一下最近的收藏做个总结"   | 识别为 `create:digest`                | P0     |
| "找一下之前那篇关于 AI 的文章" | 识别为 `query:search`                 | P0     |
| "有多少收藏？"                 | 直接返回数字，不说"让我查一下"        | P0     |
| 响应不包含"根据您的请求"       | 所有响应                              | P1     |

### 1.5 任务清单

| 任务                   | 工时    | 说明         |
| ---------------------- | ------- | ------------ |
| 实现 collectAllMatches | 2h      | 收集所有匹配 |
| 定义消歧规则（10条）   | 4h      | 覆盖常见歧义 |
| 实现 disambiguate 逻辑 | 4h      | 消歧算法     |
| 响应模板重构           | 4h      | 去程序化     |
| 编写测试用例（20个）   | 4h      | 覆盖各种场景 |
| 集成测试               | 2h      | 端到端验证   |
| **Batch 1 总计**       | **20h** | ~2周         |

---

## Batch 2：搜索体验（2周）

### 目标

> 对标 YouMind 的搜索体验：精准、自然、有用

### 2.1 YouMind 搜索体验分析

```
用户：找一下关于 AI 编程的资料

YouMind 响应：
找到 3 篇关于 AI 编程的资料：

1. 《Vibe Coding 入门指南》⭐
   微信公众号 · 12月20日 · 与问题高度相关

2. 《Claude Code Quick Start》
   网页 · 12月19日

3. 《AI 辅助开发实践》
   B站视频 · 12月15日

[打开第一篇] [查看全部]
```

**关键点**：

- 结果数量明确
- 相关度标记（⭐）
- 元数据展示
- 快捷操作

### 2.2 AnyKeep 搜索改进

**2.2.1 查询理解增强**

```typescript
// src/lib/ai-skills/search/query-understanding.ts

interface ParsedQuery {
  // 核心搜索词
  keywords: string[];

  // 时间范围
  timeRange?: {
    type: "relative" | "absolute";
    value: string; // "最近一周" / "12月"
    days?: number; // 转换为天数
  };

  // 来源平台
  platform?: string;

  // 模糊程度
  fuzzyLevel: "exact" | "fuzzy" | "vague";

  // 用户意图
  intent: "find_specific" | "browse" | "explore";
}

// 示例解析
// "找一下之前那篇关于 React 的文章"
// {
//   keywords: ["React"],
//   timeRange: { type: 'relative', value: '之前', days: 90 },
//   fuzzyLevel: 'vague',  // "那篇" 表示记忆模糊
//   intent: 'find_specific'
// }
```

**2.2.2 结果排序优化**

```typescript
// src/lib/ai-skills/search/result-ranker.ts

interface RankingFactors {
  // 标题匹配（40%）
  titleMatch: number;

  // 内容匹配（25%）
  contentMatch: number;

  // 时间相关（15%）
  recency: number;

  // 用户行为（10%）
  engagement: number;

  // 质量信号（10%）
  quality: number;
}

// 排序算法
function rank(results: SearchResult[], query: ParsedQuery): RankedResult[] {
  return results
    .map((r) => ({
      ...r,
      score: calculateScore(r, query),
      relevanceTag: getRelevanceTag(r, query), // "高度相关" / "相关"
    }))
    .sort((a, b) => b.score - a.score);
}
```

**2.2.3 响应格式优化**

```typescript
// 搜索结果响应模板
function formatSearchResponse(
  results: RankedResult[],
  query: ParsedQuery,
): string {
  if (results.length === 0) {
    return `没找到「${query.keywords.join(" ")}」相关的收藏\n\n试试：换几个关键词？`;
  }

  if (results.length === 1 && results[0].score > 0.9) {
    // 单一高置信结果
    return `找到了：\n\n${formatSingleResult(results[0])}`;
  }

  // 多结果
  const header = `找到 ${results.length} 个相关的：\n\n`;
  const list = results
    .slice(0, 5)
    .map((r, i) => formatListItem(r, i + 1))
    .join("\n");
  const footer =
    results.length > 5 ? `\n\n还有 ${results.length - 5} 个...` : "";

  return header + list + footer;
}

function formatListItem(result: RankedResult, index: number): string {
  const tag = result.relevanceTag === "high" ? " ⭐" : "";
  return `${index}. 《${result.title}》${tag}\n   ${result.platform} · ${result.timeAgo}`;
}
```

### 2.3 验收标准

| 测试用例                    | 预期行为                      | 优先级 |
| --------------------------- | ----------------------------- | ------ |
| "找一下之前那篇 React 文章" | 返回最相关的 1-3 篇，不是一堆 | P0     |
| "最近收藏了什么"            | 列出最近 7 天，按时间排序     | P0     |
| "有没有关于 AI 的收藏"      | 语义搜索，不只是关键词匹配    | P0     |
| 搜索结果显示来源和时间      | 每条都有元数据                | P1     |
| 高相关结果有标记            | ⭐ 或类似标识                 | P1     |

### 2.4 任务清单

| 任务                    | 工时    | 说明             |
| ----------------------- | ------- | ---------------- |
| QueryUnderstanding 实现 | 6h      | 解析自然语言查询 |
| ResultRanker 实现       | 8h      | 多因素排序       |
| 搜索响应模板            | 4h      | 自然化格式       |
| 搜索 Tool 优化          | 4h      | 集成新逻辑       |
| 测试用例                | 4h      | 各种搜索场景     |
| **Batch 2 总计**        | **26h** | ~2周             |

---

## Batch 3：整理体验（2周）

### 目标

> 对标 YouMind 的操作闭环：分析 → 方案 → 确认 → 执行 → 反馈

### 3.1 整理流程设计

```
┌─────────────────────────────────────────────────────────────┐
│                    智能整理工作流                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  用户："帮我整理一下最近的书签"                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Step 1: 分析 (自动)                                  │   │
│  │   - 获取最近 30 天书签                               │   │
│  │   - 分析主题分布                                     │   │
│  │   - 检测重复                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Step 2: 生成方案 (展示给用户)                        │   │
│  │                                                      │   │
│  │   "分析完成，发现：                                   │   │
│  │    • 47 条书签待整理                                 │   │
│  │    • 主要涉及 3 个主题：AI、前端、产品               │   │
│  │    • 5 组重复内容                                    │   │
│  │                                                      │   │
│  │    建议方案：                                        │   │
│  │    1. 创建「AI 技术」文件夹，移入 18 条              │   │
│  │    2. 创建「前端开发」文件夹，移入 15 条             │   │
│  │    3. 移入「产品设计」(已有)，14 条                  │   │
│  │    4. 去除 5 组重复                                  │   │
│  │                                                      │   │
│  │    [确认执行] [调整方案] [取消]"                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Step 3: 用户确认                                     │   │
│  │   - 可修改方案（换文件夹名等）                       │   │
│  │   - 确认后执行                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Step 4: 执行并反馈                                   │   │
│  │                                                      │   │
│  │   "✅ 整理完成：                                     │   │
│  │    • 创建 2 个新文件夹                               │   │
│  │    • 移动 47 条书签                                  │   │
│  │    • 清理 5 条重复                                   │   │
│  │                                                      │   │
│  │    [查看变更] [撤销]"                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 核心实现

```typescript
// src/lib/ai-skills/organize/organize-workflow.ts

export class OrganizeWorkflow {
  /**
   * 分析阶段
   */
  async analyze(userId: string, scope: OrganizeScope): Promise<AnalysisResult> {
    // 1. 获取书签
    const bookmarks = await this.fetchBookmarks(userId, scope);

    // 2. 主题聚类
    const topics = await this.clusterByTopic(bookmarks);

    // 3. 重复检测
    const duplicates = await this.detectDuplicates(bookmarks);

    return { bookmarks, topics, duplicates };
  }

  /**
   * 生成方案
   */
  async generatePlan(analysis: AnalysisResult): Promise<OrganizePlan> {
    const existingFolders = await this.getExistingFolders();

    const actions: OrganizeAction[] = [];

    for (const topic of analysis.topics) {
      // 尝试匹配现有文件夹
      const matched = this.matchFolder(topic.name, existingFolders);

      if (matched) {
        actions.push({
          type: "move",
          target: matched.name,
          bookmarkIds: topic.bookmarkIds,
          isNewFolder: false,
        });
      } else {
        actions.push({
          type: "create_and_move",
          target: topic.name,
          bookmarkIds: topic.bookmarkIds,
          isNewFolder: true,
        });
      }
    }

    // 添加去重操作
    if (analysis.duplicates.length > 0) {
      actions.push({
        type: "remove_duplicates",
        duplicates: analysis.duplicates,
      });
    }

    return { actions, summary: this.formatSummary(actions) };
  }

  /**
   * 执行方案
   */
  async execute(plan: OrganizePlan, userId: string): Promise<ExecutionResult> {
    // 创建快照（用于撤销）
    const snapshotId = await this.createSnapshot(userId);

    const results: ActionResult[] = [];

    for (const action of plan.actions) {
      const result = await this.executeAction(action, userId);
      results.push(result);
    }

    return {
      success: true,
      results,
      snapshotId, // 支持撤销
    };
  }
}
```

### 3.3 验收标准

| 测试用例             | 预期行为                         | 优先级 |
| -------------------- | -------------------------------- | ------ |
| "帮我整理最近的书签" | 先分析、再出方案、等确认、后执行 | P0     |
| 整理方案可调整       | 用户可修改文件夹名称等           | P0     |
| 执行后可撤销         | 提供撤销功能                     | P1     |
| 智能匹配现有文件夹   | 不重复创建相似文件夹             | P1     |

### 3.4 任务清单

| 任务                  | 工时    | 说明             |
| --------------------- | ------- | ---------------- |
| OrganizeWorkflow 实现 | 12h     | 分析、方案、执行 |
| 确认 UI 组件          | 6h      | 方案展示和确认   |
| 撤销机制              | 4h      | 快照和恢复       |
| 测试用例              | 4h      | 整理场景         |
| **Batch 3 总计**      | **26h** | ~2周             |

---

## Batch 4：知识萃取（2周）

### 目标

> 核心能力：从 N 篇收藏中总结归纳萃取知识

### 4.1 萃取流程设计

```
用户："帮我从最近收藏的 AI 文章中总结一份学习纪要"

Agent：
正在分析 8 篇关于 AI 的收藏...

## AI 学习纪要

### 核心概念
1. **Vibe Coding** - 让 AI 帮你写代码的新范式
   - 来源：《Vibe Coding 入门指南》
   - 核心：描述需求 → AI 生成 → 人工审核

2. **Prompt Engineering** - 与 AI 有效沟通的技巧
   - 来源：《Claude 使用技巧》《提示词进阶》
   - 核心：清晰、具体、有示例

### 关键要点
• AI 编程工具正在改变开发方式
• 掌握提示词技巧是关键技能
• 人机协作比单独使用更高效

### 学习建议
1. 先从简单任务开始尝试 AI 辅助
2. 记录有效的提示词模板
3. 关注 AI 工具的更新迭代

---
📚 基于 8 篇收藏总结
[导出 Markdown] [保存到笔记]
```

### 4.2 核心实现

```typescript
// src/lib/ai-skills/extract/knowledge-extractor.ts

export class KnowledgeExtractor {
  /**
   * 知识萃取
   */
  async extract(params: {
    bookmarkIds: number[];
    topic?: string;
    format: "summary" | "memo" | "outline";
  }): Promise<KnowledgeExtraction> {
    // 1. 获取内容
    const contents = await this.fetchContents(params.bookmarkIds);

    // 2. 识别主题（如未指定）
    const topic = params.topic || (await this.identifyTopic(contents));

    // 3. 提取要点
    const keyPoints = await this.extractKeyPoints(contents, topic);

    // 4. 提取概念
    const concepts = await this.extractConcepts(contents);

    // 5. 生成总结
    const summary = await this.generateSummary(keyPoints, concepts, topic);

    // 6. 格式化输出
    return this.formatOutput(
      {
        topic,
        keyPoints,
        concepts,
        summary,
        sources: contents,
      },
      params.format,
    );
  }

  /**
   * 提取关键要点（带来源标注）
   */
  private async extractKeyPoints(
    contents: Content[],
    topic: string,
  ): Promise<KeyPoint[]> {
    const prompt = `分析以下 ${contents.length} 篇关于「${topic}」的内容，提取核心要点：

${contents
  .map(
    (c, i) => `
【${i + 1}】${c.title}
${c.content.substring(0, 1500)}
`,
  )
  .join("\n")}

要求：
1. 提取 5-8 个核心要点
2. 每个要点标注来源（文章编号）
3. 合并相似观点，避免重复

输出 JSON：
{ "keyPoints": [{ "point": "...", "sources": [1, 3] }] }`;

    const response = await this.llm.generate(prompt);
    return JSON.parse(response).keyPoints;
  }
}
```

### 4.3 验收标准

| 测试用例                 | 预期行为                     | 优先级 |
| ------------------------ | ---------------------------- | ------ |
| "帮我总结最近的 AI 文章" | 正确识别为萃取意图，不是整理 | P0     |
| 萃取结果有来源标注       | 每个要点标明出处             | P0     |
| 支持导出                 | Markdown 格式导出            | P1     |
| 结构化输出               | 概念、要点、建议分层         | P1     |

### 4.4 任务清单

| 任务                    | 工时    | 说明         |
| ----------------------- | ------- | ------------ |
| KnowledgeExtractor 实现 | 12h     | 核心萃取逻辑 |
| 要点提取优化            | 6h      | 带来源标注   |
| 格式化输出              | 4h      | 多种格式     |
| 导出功能                | 4h      | Markdown 等  |
| **Batch 4 总计**        | **26h** | ~2周         |

---

## Batch 5：上下文记忆（2周）

### 目标

> 对标 YouMind 的上下文连续能力

### 5.1 记忆层级设计

```
┌─────────────────────────────────────────────────────────────┐
│                     记忆层级架构                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  L1: 会话记忆 (Session Memory)                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • 当前对话的上下文                                   │   │
│  │ • 最近 N 轮对话历史                                  │   │
│  │ • "刚才"、"上一个"等指代解析                        │   │
│  │ • 存储：内存 / Redis                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  L2: 短期记忆 (Short-term Memory)                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • 今日操作记录                                       │   │
│  │ • 最近访问的书签/文件夹                              │   │
│  │ • 临时偏好（如本次搜索范围）                         │   │
│  │ • 存储：数据库（7天过期）                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  L3: 长期记忆 (Long-term Memory) [后续]                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • 用户偏好（响应风格、常用操作）                     │   │
│  │ • 兴趣领域                                           │   │
│  │ • 历史纠错记录                                       │   │
│  │ • 存储：数据库（永久）                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 会话记忆实现

```typescript
// src/lib/ai-memory/session-memory.ts

export class SessionMemory {
  private cache: Map<string, ConversationState> = new Map();

  /**
   * 获取会话状态
   */
  getState(conversationId: string): ConversationState {
    return this.cache.get(conversationId) || this.createNewState();
  }

  /**
   * 更新会话状态
   */
  updateState(
    conversationId: string,
    update: Partial<ConversationState>,
  ): void {
    const current = this.getState(conversationId);
    this.cache.set(conversationId, {
      ...current,
      ...update,
      lastUpdated: Date.now(),
    });
  }

  /**
   * 解析指代词
   */
  resolveReference(text: string, state: ConversationState): ResolvedReference {
    // "刚才的总结" → 上一轮生成的内容
    if (/刚才|刚刚|上一个/.test(text)) {
      return {
        type: "previous_output",
        value: state.lastOutput,
      };
    }

    // "这些" → 上一轮搜索结果
    if (/这些|这几个/.test(text)) {
      return {
        type: "previous_results",
        value: state.lastSearchResults,
      };
    }

    // "那个文件夹" → 上一轮提到的文件夹
    if (/那个.{0,3}文件夹/.test(text)) {
      return {
        type: "mentioned_folder",
        value: state.mentionedFolders[0],
      };
    }

    return { type: "none", value: null };
  }
}

interface ConversationState {
  // 对话历史
  messages: Message[];

  // 上一轮输出
  lastOutput?: {
    type: "text" | "list" | "summary";
    content: unknown;
  };

  // 上一轮搜索结果
  lastSearchResults?: number[];

  // 提到的实体
  mentionedBookmarks: number[];
  mentionedFolders: number[];

  // 临时偏好
  tempPreferences: Record<string, unknown>;

  lastUpdated: number;
}
```

### 5.3 验收标准

| 测试用例           | 预期行为                   | 优先级 |
| ------------------ | -------------------------- | ------ |
| "把刚才的总结保存" | 正确识别"刚才"指上一轮输出 | P0     |
| "移到那个文件夹"   | 正确识别"那个"指之前提到的 | P0     |
| "这些都加上标签"   | 正确识别"这些"指搜索结果   | P1     |

### 5.4 任务清单

| 任务                 | 工时    | 说明             |
| -------------------- | ------- | ---------------- |
| SessionMemory 实现   | 8h      | 会话状态管理     |
| 指代词解析           | 6h      | "刚才"、"这些"等 |
| 状态持久化           | 4h      | Redis 或数据库   |
| 集成到 UnifiedEngine | 4h      | 上下文注入       |
| **Batch 5 总计**     | **22h** | ~2周             |

---

## Batch 6：自我进化（2周）

### 目标

> 让 Agent 从错误中学习，越用越准

### 6.1 纠错学习机制

```typescript
// src/lib/ai-learning/correction-learner.ts

export class CorrectionLearner {
  /**
   * 记录用户纠正
   */
  async recordCorrection(params: {
    userId: string;
    originalMessage: string;
    wrongIntent: IntentClassification;
    userCorrection: string; // 用户说"不是整理，是总结"
  }): Promise<void> {
    // 1. 提取正确意图
    const correctIntent = await this.inferCorrectIntent(params.userCorrection);

    // 2. 存储纠正记录
    await this.db.insert("intent_corrections", {
      user_id: params.userId,
      message: params.originalMessage,
      wrong_intent: params.wrongIntent.type,
      correct_intent: correctIntent.type,
      user_feedback: params.userCorrection,
      created_at: new Date(),
    });

    // 3. 检查是否需要新增规则
    await this.analyzeForNewRule(params.originalMessage, correctIntent);
  }

  /**
   * 应用学习结果
   */
  async applyLearning(
    message: string,
    baseIntent: IntentClassification,
  ): Promise<IntentClassification> {
    // 查询类似消息的纠正记录
    const corrections = await this.findSimilarCorrections(message);

    if (corrections.length > 0 && corrections[0].similarity > 0.85) {
      // 应用学习结果
      return {
        ...baseIntent,
        type: corrections[0].correct_intent,
        source: "learned",
      };
    }

    return baseIntent;
  }
}
```

### 6.2 任务清单

| 任务                     | 工时    | 说明         |
| ------------------------ | ------- | ------------ |
| 纠正记录数据表           | 2h      | 存储结构     |
| CorrectionLearner        | 8h      | 核心学习逻辑 |
| 纠正检测（用户说"不对"） | 4h      | 识别纠正信号 |
| 应用学习结果             | 4h      | 集成到分类器 |
| **Batch 6 总计**         | **18h** | ~2周         |

---

## 第三部分：工时与里程碑总览

### 工时汇总（V3.2 调整后）

| Batch    | 内容           | 工时     | 累计 | 调整说明                   |
| -------- | -------------- | -------- | ---- | -------------------------- |
| 1        | 意图精准化     | 20h      | 20h  | 不变                       |
| 2        | **上下文记忆** | 22h      | 42h  | ⬆️ 从 Batch 5 提升         |
| 3        | 搜索体验       | 26h      | 68h  | 原 Batch 2                 |
| 4        | 整理体验       | 26h      | 94h  | 原 Batch 3                 |
| 5        | 知识萃取       | 26h      | 120h | 原 Batch 4                 |
| 6        | 自我进化       | 18h      | 138h | 不变                       |
| 7        | **AI 交互 UI** | 36h      | 174h | 🆕 前端组件                |
| 7B       | **后端支撑**   | 50h      | 224h | 🆕 后端服务（可与 7 并行） |
| **总计** | -              | **224h** | -    | 并行后实际: ~180h          |

> 💡 **并行优化**: Batch 7 (前端) 与 Batch 7B (后端) 可并行开发
> 实际周期: 174h + 部分增量 = ~180h（节省约 40h）

### 里程碑（V3.2 调整后）

```
时间线（每 Batch 约 2 周）:

Batch 1 ─► Batch 2 ─► Batch 3 ─► Batch 4 ─► Batch 5 ─► Batch 6 ─► Batch 7+7B
  │          │          │          │          │          │          │
  ▼          ▼          ▼          ▼          ▼          ▼          ▼
不再误判    记住我     找得准     整理好     总结精     懂得学   UI+后端
           ⬆️提升                                                (并行)

M1: Agent 不再出现明显意图误判
M2: 具备上下文连续能力（"刚才"、"这些"指代解析）⬆️ 提升
M3: 搜索体验接近 YouMind 水平
M4: 整理形成闭环（分析→确认→执行）
M5: 知识萃取能力上线
M6: 具备初步自我学习能力
M7: AI 交互 UI 升级（工具选择器 + 快速操作栏 + 确认组件）🆕
M7B: 后端服务支撑（反馈、快照、笔记、上下文管理）🆕
```

### 阶段价值评估（V3.2 调整后）

| Batch | 用户价值   | 技术风险 | 建议                              |
| ----- | ---------- | -------- | --------------------------------- |
| 1     | ⭐⭐⭐⭐⭐ | 低       | **必做** - 解决核心痛点           |
| 2     | ⭐⭐⭐⭐⭐ | 中       | **必做** - 基础设施（实测验证）⬆️ |
| 3     | ⭐⭐⭐⭐⭐ | 低       | **必做** - 核心场景               |
| 4     | ⭐⭐⭐⭐   | 中       | **推荐** - 差异化                 |
| 5     | ⭐⭐⭐⭐   | 中       | **推荐** - 付费卖点               |
| 6     | ⭐⭐⭐     | 中       | 可选 - 长期价值                   |
| 7     | ⭐⭐⭐⭐⭐ | 低       | **必做** - UI 体验决定用户感知 🆕 |
| 7B    | ⭐⭐⭐⭐⭐ | 中       | **必做** - 7 的后端支撑 🆕        |

---

## 第四部分：与 YouMind 的差异化定位

### 不应该照搬的地方

| YouMind 特性    | 是否照搬 | 理由                               |
| --------------- | -------- | ---------------------------------- |
| 创作工作室定位  | ❌       | AnyKeep 是"知识管家"，不是创作工具 |
| 高定价 ($20/月) | ❌       | AnyKeep 走亲民路线                 |
| 复杂工作流      | ❌       | AnyKeep 强调"极简"                 |
| PDF/文档处理    | ❌       | 聚焦中国互联网内容                 |

### AnyKeep 应保持的优势

| 优势          | 说明                    |
| ------------- | ----------------------- |
| 智能分类 V4.2 | YouMind 无自动分类      |
| 防遗忘机制    | YouMind 无此功能        |
| 价格亲民      | ¥99/年 vs ¥200/年       |
| 移动端体验    | 系统分享快速收藏        |
| 中国平台适配  | 微信/B站/小红书深度支持 |

### 定位总结

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   YouMind                           AnyKeep                 │
│   ────────                          ────────                │
│                                                             │
│   AI 创作工作室                      AI 知识管家            │
│   创作者的第二大脑                   普通用户的外部记忆      │
│                                                             │
│   Input → Process → OUTPUT          收藏 → 存储 → 检索      │
│   (输出导向)                         (检索导向)              │
│                                                             │
│   $20/月                             ¥99/年                 │
│   全球创作者                         中国知识工作者         │
│                                                             │
│   对标点：                           差异点：                │
│   • AI 意图理解精准                  • 智能分类领先          │
│   • 对话体验自然                     • 价格亲民             │
│   • 操作执行闭环                     • 中国平台深度适配      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Batch 7：AI 交互 UI 升级（2周）

> **新增于 V3.2** - 基于 YouMind 界面分析
> **核心洞察**：YouMind 的"智能感"不仅来自算法，更来自 UI 层的显式工具暴露

### 目标

> 通过 UI 组件让用户明确知道 AI 能做什么，并可直接选择，形成端到端任务闭环

### 7.1 YouMind UI 模式分析

```
┌─────────────────────────────────────────────────────────────────────┐
│                YouMind 交互设计四大支柱                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐         │
│   │  Tool Picker │    │  Agent Mode  │    │ Model Select │         │
│   │  工具选择器   │    │   Agent切换   │    │  模型选择器   │         │
│   │              │    │              │    │              │         │
│   │ • 搜索互联网  │    │ • 对话模式   │    │ • Claude     │         │
│   │ • 写文档     │    │ • Agent模式  │    │ • Gemini     │         │
│   │ • 创建图片   │    │   (自主执行)  │    │ • GPT-5     │         │
│   │ • 创建图表   │    │              │    │              │         │
│   │ • 创建音频   │    │              │    │              │         │
│   └──────────────┘    └──────────────┘    └──────────────┘         │
│           │                   │                   │                 │
│           └───────────────────┴───────────────────┘                 │
│                               │                                     │
│                     ┌─────────▼─────────┐                          │
│                     │   Quick Actions   │                          │
│                     │    快速操作栏      │                          │
│                     │                   │                          │
│                     │ 📋复制 🔄重做 💾保存 │                          │
│                     │ 📤导出 👍反馈 📌保存 │                          │
│                     └───────────────────┘                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 AnyKeep AI 交互 UI 设计

#### 7.2.1 显式工具选择器（Tool Picker）

**核心价值**：用户主动选择工具 = 零意图误判

```typescript
// src/components/ai-chat/tool-picker.tsx

interface AnyKeepToolOption {
  id: string;
  icon: string;
  label: string;
  description: string;
  category: 'search' | 'manage' | 'create' | 'export';
}

const ANYKEEP_TOOLS: AnyKeepToolOption[] = [
  // 🔍 搜索类
  { id: 'search', icon: '🔍', label: '智能搜索', description: '语义搜索收藏内容' },
  { id: 'stats', icon: '📊', label: '数据统计', description: '查看收藏统计' },

  // 📁 管理类
  { id: 'organize', icon: '📁', label: '智能整理', description: '自动分类整理书签' },
  { id: 'tag', icon: '🏷️', label: '批量标签', description: '批量添加/移除标签' },
  { id: 'dedupe', icon: '🧹', label: '去重清理', description: '查找并清理重复' },

  // ✍️ 创作类
  { id: 'summarize', icon: '📝', label: '内容总结', description: '总结收藏内容' },
  { id: 'extract', icon: '💡', label: '知识萃取', description: '从多篇内容提取知识' },
  { id: 'review', icon: '📚', label: '知识回顾', description: '复习遗忘的收藏' },

  // 📤 导出类
  { id: 'export', icon: '📤', label: '数据导出', description: '导出为各种格式' },
];

// UI 组件
export function ToolPicker({ onSelect }: { onSelect: (tool: string) => void }) {
  return (
    <div className="flex gap-2 items-center">
      {/* 自动模式 - 默认 */}
      <Button variant="ghost" className="text-muted-foreground">
        <Sparkles className="w-4 h-4 mr-1" />
        自动
      </Button>

      {/* 工具下拉 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Wrench className="w-4 h-4 mr-1" />
            选择工具
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>🔍 搜索</DropdownMenuLabel>
            {ANYKEEP_TOOLS.filter(t => t.category === 'search').map(tool => (
              <DropdownMenuItem key={tool.id} onClick={() => onSelect(tool.id)}>
                <span className="mr-2">{tool.icon}</span>
                {tool.label}
                <span className="text-xs text-muted-foreground ml-auto">
                  {tool.description}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          {/* ... 其他分组 */}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

**交互流程**：

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Tool Picker 交互流程                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  模式 A: 自动模式（默认）                                             │
│  ────────────────────────                                           │
│  用户: "帮我找一下 AI 相关的文章"                                     │
│  系统: → IntentRouter 判断意图 → 调用 search tool → 返回结果         │
│                                                                      │
│  模式 B: 手动选择工具                                                 │
│  ────────────────────────                                           │
│  用户: [点击「智能整理」] → "最近一周的"                              │
│  系统: → 跳过意图识别 → 直接调用 organize tool → 执行整理流程         │
│                                                                      │
│  优势:                                                               │
│  • 用户明确选择 = 100% 意图准确率                                    │
│  • 减少"你理解错了"的挫败感                                          │
│  • 符合 YouMind 的交互模式                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 7.2.2 快速操作栏（Quick Actions Bar）

**核心价值**：AI 输出后，一键完成后续操作

```typescript
// src/components/ai-chat/quick-actions.tsx

interface QuickActionsProps {
  message: AIMessage;
  onAction: (action: QuickActionType) => void;
}

type QuickActionType =
  | 'copy'        // 复制内容
  | 'regenerate'  // 重新生成
  | 'save'        // 保存到笔记/收藏
  | 'export'      // 导出
  | 'feedback_up' // 点赞
  | 'feedback_down'; // 点踩

export function QuickActions({ message, onAction }: QuickActionsProps) {
  return (
    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Tooltip content="复制">
        <Button size="icon" variant="ghost" onClick={() => onAction('copy')}>
          <Copy className="w-4 h-4" />
        </Button>
      </Tooltip>

      <Tooltip content="重新生成">
        <Button size="icon" variant="ghost" onClick={() => onAction('regenerate')}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </Tooltip>

      <Tooltip content="保存">
        <Button size="icon" variant="ghost" onClick={() => onAction('save')}>
          <Bookmark className="w-4 h-4" />
        </Button>
      </Tooltip>

      <Tooltip content="导出">
        <Button size="icon" variant="ghost" onClick={() => onAction('export')}>
          <Download className="w-4 h-4" />
        </Button>
      </Tooltip>

      <Separator orientation="vertical" className="h-6" />

      <Tooltip content="有用">
        <Button size="icon" variant="ghost" onClick={() => onAction('feedback_up')}>
          <ThumbsUp className="w-4 h-4" />
        </Button>
      </Tooltip>

      <Tooltip content="没用">
        <Button size="icon" variant="ghost" onClick={() => onAction('feedback_down')}>
          <ThumbsDown className="w-4 h-4" />
        </Button>
      </Tooltip>
    </div>
  );
}
```

**与 Batch 6 (自我进化) 的协同**：

```
用户点击 👎 → 弹出"哪里不对？"选项:
  • 理解错了我的意图
  • 结果不准确
  • 格式不好
  • 其他

→ 记录到 CorrectionLearner
→ 触发自动学习
```

#### 7.2.3 执行确认组件（Action Confirmation）

**核心价值**：危险操作前确认，形成信任闭环

```typescript
// src/components/ai-chat/action-confirmation.tsx

interface ActionConfirmationProps {
  plan: OrganizePlan | ExportPlan | BatchTagPlan;
  onConfirm: () => void;
  onModify: () => void;
  onCancel: () => void;
}

export function ActionConfirmation({ plan, onConfirm, onModify, onCancel }: ActionConfirmationProps) {
  return (
    <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-600" />
          确认执行以下操作？
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 操作摘要 */}
        <div className="text-sm space-y-1">
          {plan.summary.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-muted-foreground">•</span>
              {item}
            </div>
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button onClick={onConfirm} className="flex-1">
            <Check className="w-4 h-4 mr-1" />
            确认执行
          </Button>
          <Button variant="outline" onClick={onModify}>
            <Edit className="w-4 h-4 mr-1" />
            调整
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
        </div>

        {/* 快捷设置 */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox id="always-allow" />
          <label htmlFor="always-allow">此类操作不再询问</label>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 7.2.4 上下文引用面板（Context Panel）

**核心价值**：让用户知道 AI "看到了什么"

```typescript
// src/components/ai-chat/context-panel.tsx

interface ContextPanelProps {
  references: ContextReference[];
  onRemove: (id: string) => void;
  onAdd: () => void;
}

interface ContextReference {
  id: string;
  type: 'bookmark' | 'folder' | 'search_result' | 'previous_output';
  title: string;
  preview?: string;
}

export function ContextPanel({ references, onRemove, onAdd }: ContextPanelProps) {
  if (references.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-lg">
      <span className="text-xs text-muted-foreground self-center">
        AI 正在参考：
      </span>

      {references.map(ref => (
        <Badge key={ref.id} variant="secondary" className="gap-1">
          {ref.type === 'bookmark' && <FileText className="w-3 h-3" />}
          {ref.type === 'folder' && <Folder className="w-3 h-3" />}
          {ref.type === 'search_result' && <Search className="w-3 h-3" />}
          {ref.title}
          <button onClick={() => onRemove(ref.id)} className="ml-1 hover:text-destructive">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}

      <Button size="sm" variant="ghost" onClick={onAdd}>
        <Plus className="w-3 h-3 mr-1" />
        添加
      </Button>
    </div>
  );
}
```

### 7.3 整合后的 AI Chat 界面

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AnyKeep AI 助手 - 新界面布局                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  📑 上下文面板                                                  │  │
│  │  AI 正在参考: [📄 Vibe Coding ×] [📁 AI学习 ×] [+ 添加]         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │  🧑 帮我整理一下最近一周的收藏                                   │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │  🤖 分析完成，发现 23 条待整理：                          │ │  │
│  │  │                                                         │ │  │
│  │  │  建议方案：                                              │ │  │
│  │  │  • 创建「AI 技术」文件夹，移入 12 条                      │ │  │
│  │  │  • 移入「前端开发」(已有)，8 条                          │ │  │
│  │  │  • 清理 3 条重复                                        │ │  │
│  │  │                                                         │ │  │
│  │  │  [✅ 确认执行] [✏️ 调整] [取消]                          │ │  │
│  │  │  ☐ 此类操作不再询问                                     │ │  │
│  │  │                                                         │ │  │
│  │  │  ─────────────────────────────────────────────          │ │  │
│  │  │  [📋] [🔄] [💾] [📤]  |  [👍] [👎]    ← 快速操作栏        │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  [✨ 自动] [🔧 选择工具 ▼]              [发送 ➤]              │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │ 描述你的任务...                                         │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.4 验收标准

| 测试用例                   | 预期行为                       | 优先级 |
| -------------------------- | ------------------------------ | ------ |
| 点击「智能整理」+ 输入范围 | 跳过意图识别，直接进入整理流程 | P0     |
| AI 返回整理方案            | 显示确认组件，等待用户确认     | P0     |
| 点击消息的「复制」按钮     | 复制 AI 输出到剪贴板           | P0     |
| 点击「👎」+ 选择原因       | 记录反馈到 CorrectionLearner   | P1     |
| 上下文面板显示引用         | 用户能看到 AI 参考了哪些内容   | P1     |

### 7.5 任务清单

| 任务                    | 工时    | 说明         |
| ----------------------- | ------- | ------------ |
| ToolPicker 组件         | 6h      | 工具选择下拉 |
| QuickActions 组件       | 4h      | 快速操作栏   |
| ActionConfirmation 组件 | 6h      | 执行确认     |
| ContextPanel 组件       | 4h      | 上下文引用   |
| AI Chat 界面重构        | 8h      | 整合所有组件 |
| 集成到 UnifiedEngine    | 4h      | 工具选择模式 |
| 测试用例                | 4h      | UI 交互测试  |
| **Batch 7 总计**        | **36h** | ~2.5周       |

### 7.6 与其他 Batch 的依赖关系

```
Batch 1 (意图精准化)
    │
    ├──→ Batch 7 (UI) 的工具选择可绕过意图识别
    │
Batch 3 (整理体验)
    │
    ├──→ Batch 7 (UI) 的确认组件复用整理方案展示
    │
Batch 6 (自我进化)
    │
    └──→ Batch 7 (UI) 的反馈按钮触发学习记录
```

---

## Batch 7B：后端实现支撑（3周）

> **新增于 V3.2** - Batch 7 UI 组件的后端支持
> **依赖关系**：Batch 7B 与 Batch 7 可并行开发（前后端分离）

### 7B.1 架构设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                   Batch 7 前后端架构                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     Frontend (Batch 7)                       │    │
│  │  ┌───────────┐ ┌───────────┐ ┌────────────┐ ┌────────────┐ │    │
│  │  │ToolPicker │ │QuickAction│ │ActionConfirm│ │ContextPanel│ │    │
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬──────┘ └─────┬──────┘ │    │
│  └────────┼─────────────┼─────────────┼──────────────┼────────┘    │
│           │             │             │              │              │
│           ▼             ▼             ▼              ▼              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                 API Layer (Next.js Routes)                   │    │
│  │                                                              │    │
│  │  POST /api/agent/unified     ← 扩展：支持 explicitTool       │    │
│  │  POST /api/agent/regenerate  ← 新增：重新生成                 │    │
│  │  POST /api/agent/feedback    ← 新增：用户反馈                 │    │
│  │  POST /api/agent/execute     ← 新增：确认执行                 │    │
│  │  POST /api/agent/undo        ← 新增：撤销操作                 │    │
│  │  POST /api/notes/save        ← 新增：保存 AI 输出             │    │
│  └──────────────────────────────────────────────────────────────┘    │
│           │             │             │              │              │
│           ▼             ▼             ▼              ▼              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  Backend Services (Batch 7B)                 │    │
│  │                                                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │    │
│  │  │ExplicitRouter│  │FeedbackStore │  │SnapshotMgr   │       │    │
│  │  │显式工具路由   │  │反馈存储服务   │  │快照管理器     │       │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │    │
│  │                                                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │    │
│  │  │NoteService   │  │PlanExecutor  │  │ContextMgr    │       │    │
│  │  │笔记保存服务   │  │方案执行器     │  │上下文管理器   │       │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7B.2 显式工具路由器（ExplicitToolRouter）

**对应 UI**: Tool Picker

**核心改动**：扩展 `/api/agent/unified` 接口

```typescript
// src/lib/ai-skills/router/explicit-tool-router.ts

export interface UnifiedRequestWithExplicitTool {
  message: string;
  userId: string;
  conversationId?: string;

  // 🆕 显式工具选择
  explicitTool?: {
    toolId: string; // 'search' | 'organize' | 'summarize' | ...
    skipIntentClassification: boolean; // 跳过意图识别
  };

  // 🆕 上下文引用
  contextReferences?: {
    bookmarkIds?: number[];
    folderIds?: number[];
    previousOutputId?: string;
  };
}

export class ExplicitToolRouter {
  private readonly toolMapping: Map<string, ToolHandler> = new Map([
    ["search", { handler: "SearchTool", intent: "query" }],
    ["stats", { handler: "StatsTool", intent: "query" }],
    ["organize", { handler: "OrganizeSkill", intent: "manage" }],
    ["tag", { handler: "BatchTagTool", intent: "manage" }],
    ["dedupe", { handler: "DedupeTool", intent: "manage" }],
    ["summarize", { handler: "SummarizeSkill", intent: "create" }],
    ["extract", { handler: "KnowledgeExtractSkill", intent: "create" }],
    ["review", { handler: "KnowledgeReviewSkill", intent: "create" }],
    ["export", { handler: "DataExportSkill", intent: "export" }],
  ]);

  /**
   * 处理显式工具请求
   */
  async route(request: UnifiedRequestWithExplicitTool): Promise<RouteResult> {
    const { explicitTool, message, contextReferences } = request;

    if (!explicitTool || !explicitTool.skipIntentClassification) {
      // 回退到正常意图识别流程
      return { mode: "auto", handler: null };
    }

    const toolConfig = this.toolMapping.get(explicitTool.toolId);
    if (!toolConfig) {
      throw new Error(`Unknown tool: ${explicitTool.toolId}`);
    }

    return {
      mode: "explicit",
      handler: toolConfig.handler,
      intent: toolConfig.intent,
      context: contextReferences,
      // 消息作为参数传递给工具
      toolParams: this.parseToolParams(message, explicitTool.toolId),
    };
  }

  /**
   * 从消息中解析工具参数
   */
  private parseToolParams(
    message: string,
    toolId: string,
  ): Record<string, unknown> {
    switch (toolId) {
      case "organize":
        return this.parseOrganizeParams(message);
      case "search":
        return { query: message };
      case "export":
        return this.parseExportParams(message);
      default:
        return { input: message };
    }
  }

  private parseOrganizeParams(message: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    if (/最近一周|这周|7天/.test(message)) {
      params.timeRange = "7d";
    } else if (/最近一个月|这个月|30天/.test(message)) {
      params.timeRange = "30d";
    } else if (/全部|所有/.test(message)) {
      params.timeRange = "all";
    }

    const topicMatch = message.match(/(?:关于|有关)(.+?)(?:的|$)/);
    if (topicMatch) {
      params.topic = topicMatch[1].trim();
    }

    return params;
  }

  private parseExportParams(message: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    if (/markdown|md/i.test(message)) params.format = "markdown";
    else if (/csv/i.test(message)) params.format = "csv";
    else if (/obsidian/i.test(message)) params.format = "obsidian";

    return params;
  }
}
```

### 7B.3 用户反馈服务（FeedbackService）

**对应 UI**: Quick Actions (👍👎)

```typescript
// src/lib/ai-feedback/feedback.service.ts

export interface FeedbackRecord {
  id: string;
  userId: string;
  conversationId: string;
  messageId: string;
  type: "positive" | "negative";
  negativeReason?:
    | "wrong_intent"
    | "inaccurate_result"
    | "bad_format"
    | "other";
  negativeComment?: string;
  originalMessage: string;
  classifiedIntent: string;
  toolUsed: string;
  createdAt: Date;
}

export class FeedbackService {
  constructor(
    private readonly db: SupabaseClient,
    private readonly correctionLearner?: CorrectionLearner, // Batch 6 协同
  ) {}

  /**
   * 记录用户反馈
   */
  async recordFeedback(
    feedback: Omit<FeedbackRecord, "id" | "createdAt">,
  ): Promise<void> {
    // 1. 存储反馈
    await this.db.from("ai_feedback").insert({
      ...feedback,
      created_at: new Date().toISOString(),
    });

    // 2. 如果是"理解错了意图"，触发 Batch 6 学习
    if (
      feedback.type === "negative" &&
      feedback.negativeReason === "wrong_intent" &&
      this.correctionLearner
    ) {
      await this.correctionLearner.recordCorrection({
        userId: feedback.userId,
        originalMessage: feedback.originalMessage,
        wrongIntent: { type: feedback.classifiedIntent },
        userCorrection: feedback.negativeComment || "",
      });
    }
  }

  /**
   * 获取反馈统计
   */
  async getFeedbackStats(userId: string): Promise<FeedbackStats> {
    const { data } = await this.db
      .from("ai_feedback")
      .select("type, negative_reason")
      .eq("user_id", userId);

    const total = data?.length || 0;
    const positive = data?.filter((f) => f.type === "positive").length || 0;

    return {
      total,
      positive,
      negative: total - positive,
      positiveRate: total > 0 ? positive / total : 0,
    };
  }
}
```

### 7B.4 快照管理器（SnapshotManager）

**对应 UI**: Action Confirmation (撤销功能)

```typescript
// src/lib/ai-snapshot/snapshot.manager.ts

export interface Snapshot {
  id: string;
  userId: string;
  operationType: "organize" | "batch_tag" | "dedupe" | "move";
  beforeState: {
    bookmarks: Array<{ id: number; folderId: number | null; tags: string[] }>;
  };
  operations: Operation[];
  createdAt: Date;
  expiresAt: Date; // 快照有效期（24 小时）
  isReverted: boolean;
}

export class SnapshotManager {
  private readonly SNAPSHOT_TTL_HOURS = 24;

  constructor(private readonly db: SupabaseClient) {}

  /**
   * 创建快照（执行操作前调用）
   */
  async createSnapshot(
    userId: string,
    operationType: Snapshot["operationType"],
    affectedBookmarkIds: number[],
  ): Promise<string> {
    // 获取受影响书签的当前状态
    const { data: bookmarks } = await this.db
      .from("bookmarks")
      .select("id, folder_id, tags")
      .in("id", affectedBookmarkIds)
      .eq("user_id", userId);

    const snapshot = {
      user_id: userId,
      operation_type: operationType,
      before_state: {
        bookmarks:
          bookmarks?.map((b) => ({
            id: b.id,
            folderId: b.folder_id,
            tags: b.tags || [],
          })) || [],
      },
      operations: [],
      expires_at: new Date(
        Date.now() + this.SNAPSHOT_TTL_HOURS * 3600000,
      ).toISOString(),
      is_reverted: false,
    };

    const { data } = await this.db
      .from("ai_operation_snapshots")
      .insert(snapshot)
      .select("id")
      .single();

    return data!.id;
  }

  /**
   * 撤销操作
   */
  async revert(snapshotId: string, userId: string): Promise<RevertResult> {
    const { data: snapshot } = await this.db
      .from("ai_operation_snapshots")
      .select("*")
      .eq("id", snapshotId)
      .eq("user_id", userId)
      .single();

    if (!snapshot) throw new Error("Snapshot not found");
    if (snapshot.is_reverted) throw new Error("Already reverted");
    if (new Date(snapshot.expires_at) < new Date())
      throw new Error("Snapshot expired");

    // 恢复书签状态
    let restored = 0;
    for (const bookmarkState of snapshot.before_state.bookmarks) {
      await this.db
        .from("bookmarks")
        .update({
          folder_id: bookmarkState.folderId,
          tags: bookmarkState.tags,
        })
        .eq("id", bookmarkState.id)
        .eq("user_id", userId);
      restored++;
    }

    // 标记已撤销
    await this.db
      .from("ai_operation_snapshots")
      .update({ is_reverted: true })
      .eq("id", snapshotId);

    return { restored, success: true };
  }
}
```

### 7B.5 笔记保存服务（NoteService）

**对应 UI**: Quick Actions (💾 保存)

```typescript
// src/lib/ai-notes/note.service.ts

export interface AIGeneratedNote {
  id: string;
  userId: string;
  sourceType: "ai_summary" | "ai_extraction" | "ai_review";
  title: string;
  content: string;
  relatedBookmarkIds: number[];
  createdAt: Date;
}

export class NoteService {
  constructor(private readonly db: SupabaseClient) {}

  /**
   * 保存 AI 生成的内容为笔记
   */
  async saveAsNote(params: {
    userId: string;
    content: string;
    title?: string;
    sourceType: AIGeneratedNote["sourceType"];
    relatedBookmarkIds?: number[];
  }): Promise<AIGeneratedNote> {
    const title =
      params.title || this.generateTitle(params.content, params.sourceType);

    const { data } = await this.db
      .from("ai_notes")
      .insert({
        user_id: params.userId,
        source_type: params.sourceType,
        title,
        content: params.content,
        related_bookmark_ids: params.relatedBookmarkIds || [],
      })
      .select()
      .single();

    return {
      id: data!.id,
      userId: data!.user_id,
      sourceType: data!.source_type,
      title: data!.title,
      content: data!.content,
      relatedBookmarkIds: data!.related_bookmark_ids,
      createdAt: new Date(data!.created_at),
    };
  }

  private generateTitle(content: string, sourceType: string): string {
    const prefixes = {
      ai_summary: "📝 AI 总结",
      ai_extraction: "💡 知识萃取",
      ai_review: "📚 复习笔记",
    };
    const firstLine = content
      .split("\n")[0]
      .replace(/^#+\s*/, "")
      .substring(0, 30);
    return `${prefixes[sourceType as keyof typeof prefixes]} - ${firstLine}...`;
  }
}
```

### 7B.6 上下文管理器（ContextManager）

**对应 UI**: Context Panel

```typescript
// src/lib/ai-context/context.manager.ts

export interface ConversationContext {
  conversationId: string;
  userId: string;
  references: {
    bookmarks: Array<{ id: number; title: string; content?: string }>;
    folders: Array<{ id: number; name: string; bookmarkCount: number }>;
    previousOutputs: Array<{ id: string; preview: string; content: string }>;
  };
}

export class ContextManager {
  private contexts: Map<string, ConversationContext> = new Map();

  constructor(private readonly db: SupabaseClient) {}

  /**
   * 添加书签到上下文
   */
  async addBookmarkReference(
    conversationId: string,
    userId: string,
    bookmarkId: number,
  ): Promise<void> {
    const context = this.getOrCreateContext(conversationId, userId);

    if (context.references.bookmarks.some((b) => b.id === bookmarkId)) return;

    const { data: bookmark } = await this.db
      .from("bookmarks")
      .select("id, title, ai_summary")
      .eq("id", bookmarkId)
      .eq("user_id", userId)
      .single();

    if (bookmark) {
      context.references.bookmarks.push({
        id: bookmark.id,
        title: bookmark.title,
        content: bookmark.ai_summary,
      });
    }
  }

  /**
   * 移除书签引用
   */
  removeBookmarkReference(
    conversationId: string,
    userId: string,
    bookmarkId: number,
  ): void {
    const context = this.getOrCreateContext(conversationId, userId);
    context.references.bookmarks = context.references.bookmarks.filter(
      (b) => b.id !== bookmarkId,
    );
  }

  /**
   * 构建 AI 请求的上下文字符串
   */
  buildContextForAI(conversationId: string, userId: string): string {
    const context = this.getOrCreateContext(conversationId, userId);
    const parts: string[] = [];

    if (context.references.bookmarks.length > 0) {
      parts.push("## 用户选择的书签：");
      for (const b of context.references.bookmarks) {
        parts.push(`- 《${b.title}》\n  ${b.content?.substring(0, 500) || ""}`);
      }
    }

    if (context.references.folders.length > 0) {
      parts.push("\n## 用户选择的文件夹：");
      for (const f of context.references.folders) {
        parts.push(`- 「${f.name}」(${f.bookmarkCount} 条)`);
      }
    }

    return parts.join("\n");
  }

  private getOrCreateContext(
    conversationId: string,
    userId: string,
  ): ConversationContext {
    const key = `${userId}:${conversationId}`;
    if (!this.contexts.has(key)) {
      this.contexts.set(key, {
        conversationId,
        userId,
        references: { bookmarks: [], folders: [], previousOutputs: [] },
      });
    }
    return this.contexts.get(key)!;
  }
}
```

### 7B.7 数据库迁移

```sql
-- supabase/migrations/20251225000002_add_ai_operation_tables.sql

-- 1. AI 反馈表
CREATE TABLE ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('positive', 'negative')),
  negative_reason TEXT,
  negative_comment TEXT,
  original_message TEXT NOT NULL,
  classified_intent TEXT NOT NULL,
  tool_used TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. AI 操作快照表
CREATE TABLE ai_operation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  before_state JSONB NOT NULL,
  operations JSONB NOT NULL DEFAULT '[]',
  expires_at TIMESTAMPTZ NOT NULL,
  is_reverted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. AI 笔记表
CREATE TABLE ai_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  related_bookmark_ids INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_ai_feedback_user ON ai_feedback(user_id);
CREATE INDEX idx_ai_snapshots_user ON ai_operation_snapshots(user_id);
CREATE INDEX idx_ai_snapshots_expires ON ai_operation_snapshots(expires_at);
CREATE INDEX idx_ai_notes_user ON ai_notes(user_id);

-- RLS
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_operation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feedback" ON ai_feedback FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own snapshots" ON ai_operation_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own notes" ON ai_notes FOR ALL USING (auth.uid() = user_id);
```

### 7B.8 API 端点汇总

| 端点                  | 方法        | 说明                    | 对应 UI            |
| --------------------- | ----------- | ----------------------- | ------------------ |
| `/api/agent/unified`  | POST        | 扩展：支持 explicitTool | ToolPicker         |
| `/api/agent/feedback` | POST        | 新增：用户反馈          | QuickActions 👍👎  |
| `/api/agent/undo`     | POST        | 新增：撤销操作          | ActionConfirmation |
| `/api/notes/save`     | POST        | 新增：保存笔记          | QuickActions 💾    |
| `/api/agent/context`  | POST/DELETE | 新增：管理上下文        | ContextPanel       |

### 7B.9 任务清单

| 任务                    | 工时    | 说明              | 前置依赖       |
| ----------------------- | ------- | ----------------- | -------------- |
| ExplicitToolRouter 实现 | 6h      | 显式工具路由      | Batch 1        |
| UnifiedEngine 扩展      | 4h      | 支持 explicitTool | -              |
| FeedbackService 实现    | 4h      | 反馈收集          | Batch 6 (可选) |
| SnapshotManager 实现    | 8h      | 快照与撤销        | Batch 4        |
| NoteService 实现        | 4h      | AI 输出保存       | -              |
| ContextManager 实现     | 6h      | 上下文管理        | Batch 2        |
| 数据库迁移              | 2h      | 3 张新表          | -              |
| API 端点开发            | 6h      | 5 个端点          | -              |
| 单元测试                | 6h      | 各服务测试        | -              |
| 集成测试                | 4h      | 前后端联调        | Batch 7        |
| **Batch 7B 总计**       | **50h** | ~3周              | -              |

### 7B.10 开发时序（前后端并行）

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Batch 7 + 7B 并行开发计划                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Week 1              Week 2              Week 3              Week 4   │
│  ─────────           ─────────           ─────────           ─────── │
│                                                                      │
│  ┌──────────────────────────────────────────────────────┐           │
│  │ 后端: DB迁移 + ExplicitToolRouter + ContextManager    │           │
│  │ 前端: ToolPicker + ContextPanel UI                   │           │
│  └──────────────────────────────────────────────────────┘           │
│                         │                                            │
│                         ▼                                            │
│  ┌──────────────────────────────────────────────────────┐           │
│  │ 后端: FeedbackService + NoteService + API            │           │
│  │ 前端: QuickActions UI                                │           │
│  └──────────────────────────────────────────────────────┘           │
│                         │                                            │
│                         ▼                                            │
│  ┌──────────────────────────────────────────────────────┐           │
│  │ 后端: SnapshotManager + 撤销 API                     │           │
│  │ 前端: ActionConfirmation UI                          │           │
│  └──────────────────────────────────────────────────────┘           │
│                         │                                            │
│                         ▼                                            │
│  ┌──────────────────────────────────────────────────────┐           │
│  │ 集成测试 + Bug 修复 + 优化                            │           │
│  └──────────────────────────────────────────────────────┘           │
│                                                                      │
│  💡 并行优势: Batch 7 (36h) + Batch 7B (50h) = 86h                   │
│              并行后实际周期: ~4 周（非 6 周）                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 附录：是否需要试用 YouMind？

如果您希望 BMad Master 亲自试用 YouMind AI 助手以获得更深入的体验洞察，请提供试用账号或授权。

可以进一步分析的维度：

- AI 响应延迟
- 多轮对话连贯性
- 错误处理方式
- 边界场景表现

---

**文档结束**

> 请审核后告知 BMad Master：
>
> 1. 分批实施的顺序是否合理？
> 2. 是否需要调整某些 Batch 的优先级？
> 3. 是否需要进一步深入某个具体模块？
