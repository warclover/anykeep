# AnyKeep Agent 能力升级方案 V2

> **版本**: 2.0.0
> **日期**: 2025-12-25
> **状态**: 待审核
> **核心理念**: 不堆功能，深耕核心场景，做真正有用的 AI 助手

---

## 执行摘要

### 问题诊断

通过分析用户反馈和现有代码，发现核心问题：

**案例分析**：用户说"帮我梳理内容总结纪要"，Agent 开始分类书签

```typescript
// 当前意图分类器的问题
// 规则 1（权重80）: /整理|清理|规整|梳理/ → organize
// 规则 2（权重70）: /摘要|总结|概括|速览/ → create/digest

// "梳理内容总结纪要" 同时包含"梳理"和"总结"
// 由于"梳理"规则权重更高，被错误分类为 organize
```

**根本问题**：

1. **单词匹配而非语义理解** - "梳理内容总结" 应理解为"生成总结"，而非"整理分类"
2. **缺乏消歧机制** - 多个规则匹配时无法智能选择
3. **响应程序化** - 让用户感觉在和提示词模板交互

### 升级目标

> **让 Agent 成为 AnyKeep 的「超级用户」— 比用户更懂如何使用 AnyKeep 管理知识**

聚焦 **3 个核心场景**，做到极致：

| 场景     | 用户期望           | 当前状态 | 目标状态  |
| -------- | ------------------ | -------- | --------- |
| 智能搜索 | 快速找到想要的收藏 | 基本可用 | 精准+自然 |
| 智能整理 | 结构化分类书签     | 待验证   | 高效+可控 |
| 知识萃取 | 从N篇收藏总结知识  | 易误判   | 准确+实用 |

### 产品定位适配

| 用户类型 | Agent 角色 | 核心能力                   |
| -------- | ---------- | -------------------------- |
| 免费用户 | 管家型     | 搜索 + 基础整理            |
| 付费用户 | 助教型     | 搜索 + 深度整理 + 知识萃取 |

### 交互风格

- **主基调**：简洁高效，直接给结果
- **补充**：重要操作先确认
- **禁止**：啰嗦、程序化、模板感

---

## 第一部分：意图理解精准化

### 1.1 问题根源分析

当前 IntentClassifier 的核心缺陷：

```
用户输入: "帮我梳理内容总结纪要"

当前处理流程:
┌─────────────────────────────────────────────────────┐
│ 遍历规则（按权重排序）                                │
│                                                     │
│ 规则1: /整理|清理|规整|梳理/ (权重80)                 │
│        ↓ 匹配 "梳理"                                │
│        → 返回 organize/cleanup                      │
│                                                     │
│ 规则2: /摘要|总结|概括|速览/ (权重70)                 │
│        ← 未被检查（已经返回了）                       │
└─────────────────────────────────────────────────────┘

错误输出: { type: "organize", subType: "cleanup" }
正确输出应该是: { type: "create", subType: "digest" }
```

### 1.2 解决方案：多阶段意图识别

```
改进后的处理流程:
┌─────────────────────────────────────────────────────┐
│                                                     │
│ 阶段1: 收集所有匹配规则（不立即返回）                  │
│                                                     │
│ 规则1: /整理|清理|规整|梳理/ → organize (匹配)        │
│ 规则2: /摘要|总结|概括|速览/ → create (匹配)          │
│                                                     │
│ 候选列表: [organize, create]                         │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 阶段2: 冲突消解                                      │
│                                                     │
│ 检测到冲突: organize vs create                       │
│                                                     │
│ 应用消解规则:                                        │
│ - "梳理...总结" → 动词+宾语结构，宾语"总结"是核心意图  │
│ - "总结纪要" 是名词短语，强化 create 意图             │
│                                                     │
│ 消解结果: create/digest                              │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 阶段3: 置信度校验                                    │
│                                                     │
│ 置信度 = 0.75 (中等)                                 │
│ 阈值 = 0.85 (需要确认)                               │
│                                                     │
│ 触发用户确认（可选）                                  │
│                                                     │
└─────────────────────────────────────────────────────┘

输出: { type: "create", subType: "digest", confidence: 0.75 }
```

### 1.3 核心实现

#### 1.3.1 增强型意图分类器

```typescript
// src/lib/ai-skills/router/intent-classifier-v2.ts

/**
 * 语义消歧规则
 * 当多个意图同时匹配时，根据语法结构确定真实意图
 */
const DISAMBIGUATION_RULES: DisambiguationRule[] = [
  {
    // "梳理...总结" / "整理...摘要" → 实际意图是总结
    conflicts: ["organize", "create"],
    pattern: /(梳理|整理).{0,10}(总结|摘要|概括|纪要)/,
    winner: "create",
    reason: "动词+宾语结构，宾语是核心意图",
  },
  {
    // "总结并整理" / "摘要后分类" → 实际意图是总结
    conflicts: ["create", "organize"],
    pattern: /(总结|摘要).{0,5}(并|后|再).{0,5}(整理|分类)/,
    winner: "create",
    reason: "主谓结构，第一个动词是主意图",
  },
  {
    // "整理一下，做个总结" → 实际意图是总结
    conflicts: ["organize", "create"],
    pattern: /(整理|梳理).{0,10}(做个?|生成|写个?).{0,5}(总结|摘要)/,
    winner: "create",
    reason: "目的状语，最终目的是总结",
  },
  {
    // "找一下...关于xx的文章" → 搜索意图
    conflicts: ["query", "create"],
    pattern: /(找|搜|查).{0,10}(关于|有关).{0,20}(的|文章|内容)/,
    winner: "query",
    reason: "搜索特定内容",
  },
];

/**
 * 核心场景优先级（AnyKeep 特化）
 *
 * 当无法消歧时，根据 AnyKeep 核心场景优先级决定
 */
const CORE_SCENARIO_PRIORITY: Record<string, number> = {
  // Top 3 核心场景
  "query:search": 100, // 智能搜索
  "create:digest": 95, // 知识萃取/总结
  "organize:classify": 90, // 智能整理

  // 次要场景
  "query:list": 80,
  "query:count": 75,
  "organize:cleanup": 70,
  "organize:dedupe": 70,

  // 其他
  "action:*": 60,
  "analyze:*": 50,
  "learn:*": 40,
  "chitchat:*": 10,
};

export class IntentClassifierV2 {
  /**
   * 分类用户意图（增强版）
   */
  async classify(message: string): Promise<IntentClassification> {
    // 阶段1: 收集所有匹配规则
    const candidates = this.collectAllMatches(message);

    // 无匹配，返回默认
    if (candidates.length === 0) {
      return this.getDefaultClassification(message);
    }

    // 单一匹配，直接返回
    if (candidates.length === 1) {
      return this.buildResult(candidates[0], message);
    }

    // 阶段2: 多候选消歧
    const resolved = this.disambiguate(message, candidates);

    // 阶段3: 构建结果
    return this.buildResult(resolved, message);
  }

  /**
   * 收集所有匹配的规则（不立即返回）
   */
  private collectAllMatches(message: string): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const rule of this.rules) {
      const match = rule.pattern.exec(message);
      if (match) {
        matches.push({
          rule,
          matchIndex: match.index,
          matchLength: match[0].length,
          matchedText: match[0],
        });
      }
    }

    return matches;
  }

  /**
   * 消歧：从多个候选中确定真实意图
   */
  private disambiguate(message: string, candidates: RuleMatch[]): RuleMatch {
    // 1. 尝试语义消歧规则
    const conflictTypes = candidates.map((c) => c.rule.type);

    for (const disambigRule of DISAMBIGUATION_RULES) {
      // 检查是否匹配冲突类型
      const hasConflict = disambigRule.conflicts.every((t) =>
        conflictTypes.includes(t as IntentType),
      );

      if (hasConflict && disambigRule.pattern.test(message)) {
        // 找到消歧规则适用
        const winner = candidates.find(
          (c) => c.rule.type === disambigRule.winner,
        );
        if (winner) {
          logger.debug(
            {
              message: message.substring(0, 50),
              candidates: conflictTypes,
              winner: disambigRule.winner,
              reason: disambigRule.reason,
            },
            "IntentClassifier: Disambiguation applied",
          );
          return winner;
        }
      }
    }

    // 2. 无适用消歧规则，使用核心场景优先级
    return this.selectByCorePriority(candidates);
  }

  /**
   * 根据核心场景优先级选择
   */
  private selectByCorePriority(candidates: RuleMatch[]): RuleMatch {
    const scored = candidates.map((c) => {
      const key = `${c.rule.type}:${c.rule.subType}`;
      const wildcardKey = `${c.rule.type}:*`;
      const priority =
        CORE_SCENARIO_PRIORITY[key] ?? CORE_SCENARIO_PRIORITY[wildcardKey] ?? 0;
      return { candidate: c, priority };
    });

    scored.sort((a, b) => b.priority - a.priority);
    return scored[0].candidate;
  }
}
```

#### 1.3.2 意图确认机制

当置信度不足时，主动向用户确认：

```typescript
// src/lib/ai-skills/router/intent-confirmer.ts

export interface ConfirmationRequest {
  question: string;
  options: Array<{
    label: string;
    intent: IntentClassification;
  }>;
}

export class IntentConfirmer {
  private readonly CONFIDENCE_THRESHOLD = 0.75;

  /**
   * 判断是否需要确认
   */
  shouldConfirm(result: IntentClassification): boolean {
    // 1. 置信度低于阈值
    if (result.confidence < this.CONFIDENCE_THRESHOLD) {
      return true;
    }

    // 2. 检测到歧义（多个高权重匹配）
    if (result.hasAmbiguity) {
      return true;
    }

    return false;
  }

  /**
   * 生成确认请求
   */
  generateConfirmation(
    message: string,
    candidates: IntentClassification[],
  ): ConfirmationRequest {
    // 根据候选生成自然语言确认
    const options = candidates.slice(0, 3).map((c) => ({
      label: this.intentToLabel(c),
      intent: c,
    }));

    return {
      question: this.generateQuestion(message, candidates),
      options,
    };
  }

  private intentToLabel(intent: IntentClassification): string {
    const labels: Record<string, string> = {
      "create:digest": "生成内容总结",
      "organize:cleanup": "整理分类书签",
      "organize:classify": "自动分类",
      "query:search": "搜索书签",
      "query:list": "列出书签",
      "analyze:insight": "分析洞察",
    };
    return labels[`${intent.type}:${intent.subType}`] ?? "其他操作";
  }

  private generateQuestion(
    message: string,
    candidates: IntentClassification[],
  ): string {
    // 简洁的确认问题
    if (candidates.length === 2) {
      const [a, b] = candidates;
      return `您是想「${this.intentToLabel(a)}」还是「${this.intentToLabel(b)}」？`;
    }
    return "请确认您想要的操作：";
  }
}
```

### 1.4 实施任务

| 任务                   | 优先级 | 工时    | 说明               |
| ---------------------- | ------ | ------- | ------------------ |
| 实现 collectAllMatches | P0     | 2h      | 收集所有匹配规则   |
| 实现语义消歧规则       | P0     | 4h      | 处理常见歧义场景   |
| 定义核心场景优先级     | P0     | 1h      | AnyKeep 特化优先级 |
| 实现 IntentConfirmer   | P1     | 3h      | 低置信度时确认     |
| 编写测试用例           | P0     | 4h      | 覆盖各种歧义场景   |
| **小计**               | -      | **14h** | -                  |

---

## 第二部分：核心场景深度优化

### 2.1 场景一：智能搜索

**用户期望**：快速找到想要的那篇收藏

**当前问题**：

- 搜索结果排序不够智能
- 模糊搜索能力弱
- 结果呈现程序化

#### 2.1.1 搜索理解增强

```typescript
// src/lib/ai-skills/search/search-query-parser.ts

/**
 * 搜索查询解析器
 * 将自然语言转换为结构化搜索参数
 */
export class SearchQueryParser {
  /**
   * 解析用户搜索意图
   */
  parse(query: string): ParsedSearchQuery {
    return {
      // 核心关键词（必须包含）
      keywords: this.extractKeywords(query),

      // 时间范围
      timeRange: this.parseTimeRange(query),

      // 来源平台
      platform: this.parsePlatform(query),

      // 内容类型
      contentType: this.parseContentType(query),

      // 模糊程度（用户记忆不清时）
      fuzzyLevel: this.detectFuzzyLevel(query),

      // 排序偏好
      sortPreference: this.parseSortPreference(query),
    };
  }

  /**
   * 检测模糊程度
   * 用户说"之前收藏的那篇"表示记忆模糊
   */
  private detectFuzzyLevel(query: string): "exact" | "fuzzy" | "vague" {
    // 精确搜索信号
    if (/标题是|叫做|名字是/.test(query)) {
      return "exact";
    }

    // 模糊搜索信号
    if (/那篇|那个|好像|大概|之前|以前/.test(query)) {
      return "vague";
    }

    // 默认模糊搜索
    return "fuzzy";
  }

  /**
   * 解析时间范围
   */
  private parseTimeRange(query: string): TimeRange | null {
    const patterns: Array<{ pattern: RegExp; range: TimeRange }> = [
      { pattern: /今天/, range: { days: 1 } },
      { pattern: /昨天/, range: { days: 2, offset: 1 } },
      { pattern: /最近一?周|这周/, range: { days: 7 } },
      { pattern: /最近一?个?月|这个?月/, range: { days: 30 } },
      { pattern: /之前|以前/, range: { days: 90 } }, // 模糊时间，扩大范围
      { pattern: /(\d+)天[前内]/, range: (m) => ({ days: parseInt(m[1]) }) },
    ];

    for (const { pattern, range } of patterns) {
      const match = query.match(pattern);
      if (match) {
        return typeof range === "function" ? range(match) : range;
      }
    }

    return null;
  }
}
```

#### 2.1.2 搜索结果优化

```typescript
// src/lib/ai-skills/search/search-ranker.ts

/**
 * 搜索结果排序器
 * 多因素综合排序，返回最相关的结果
 */
export class SearchRanker {
  /**
   * 综合排序
   */
  rank(results: SearchResult[], query: ParsedSearchQuery): RankedResult[] {
    return results
      .map((result) => ({
        ...result,
        score: this.calculateScore(result, query),
      }))
      .sort((a, b) => b.score - a.score);
  }

  private calculateScore(
    result: SearchResult,
    query: ParsedSearchQuery,
  ): number {
    let score = 0;

    // 1. 标题匹配度（权重最高）
    score += this.titleMatchScore(result.title, query.keywords) * 40;

    // 2. 关键词覆盖度
    score += this.keywordCoverage(result, query.keywords) * 25;

    // 3. 时间相关性（最近的优先，但不绝对）
    score += this.recencyScore(result.createdAt, query.timeRange) * 15;

    // 4. 用户行为信号（点击过、收藏时长等）
    score += this.engagementScore(result) * 10;

    // 5. 内容质量（有摘要、有标签的优先）
    score += this.qualityScore(result) * 10;

    return score;
  }

  /**
   * 标题匹配评分
   * 支持模糊匹配和同义词
   */
  private titleMatchScore(title: string, keywords: string[]): number {
    let score = 0;

    for (const keyword of keywords) {
      // 精确匹配
      if (title.toLowerCase().includes(keyword.toLowerCase())) {
        score += 1;
        continue;
      }

      // 模糊匹配（编辑距离）
      const fuzzyScore = this.fuzzyMatch(title, keyword);
      if (fuzzyScore > 0.7) {
        score += fuzzyScore * 0.8;
      }
    }

    return Math.min(score / keywords.length, 1);
  }
}
```

#### 2.1.3 搜索响应自然化

```typescript
// src/lib/ai-skills/search/search-responder.ts

/**
 * 搜索响应生成器
 * 生成自然、简洁的搜索结果呈现
 */
export class SearchResponder {
  /**
   * 生成搜索响应
   */
  generate(results: RankedResult[], query: ParsedSearchQuery): SearchResponse {
    const count = results.length;

    // 无结果
    if (count === 0) {
      return this.noResultResponse(query);
    }

    // 单一高置信结果
    if (
      count === 1 ||
      (results[0].score > 0.9 && results[0].score - results[1]?.score > 0.3)
    ) {
      return this.singleResultResponse(results[0], query);
    }

    // 多个结果
    return this.multiResultResponse(results.slice(0, 5), query);
  }

  /**
   * 单一结果响应（最简洁）
   */
  private singleResultResponse(
    result: RankedResult,
    query: ParsedSearchQuery,
  ): SearchResponse {
    // 不说废话，直接给结果
    return {
      type: "single",
      text: `找到了：`,
      results: [result],
      // 快捷操作
      actions: [
        { label: "打开", action: "open", bookmarkId: result.id },
        { label: "详情", action: "detail", bookmarkId: result.id },
      ],
    };
  }

  /**
   * 多结果响应
   */
  private multiResultResponse(
    results: RankedResult[],
    query: ParsedSearchQuery,
  ): SearchResponse {
    return {
      type: "multiple",
      text: `找到 ${results.length} 个相关结果：`,
      results,
      // 如果第一个明显更相关，提示
      highlight: results[0].score > 0.8 ? 0 : undefined,
    };
  }

  /**
   * 无结果响应
   */
  private noResultResponse(query: ParsedSearchQuery): SearchResponse {
    // 给出有用的建议，而不是空洞的"未找到"
    const suggestions = this.generateSuggestions(query);

    return {
      type: "empty",
      text: `没找到相关内容`,
      suggestions,
    };
  }

  private generateSuggestions(query: ParsedSearchQuery): string[] {
    const suggestions: string[] = [];

    // 建议扩大时间范围
    if (query.timeRange) {
      suggestions.push("试试扩大时间范围");
    }

    // 建议换关键词
    if (query.keywords.length > 0) {
      suggestions.push("换几个关键词试试");
    }

    return suggestions;
  }
}
```

### 2.2 场景二：智能整理

**用户期望**：帮我整理乱七八糟的书签，并实现结构化的分类

**核心设计**：

- 先分析再整理（让用户看到方案）
- 结构化分类建议
- 确认后执行
- 可回滚

#### 2.2.1 整理方案生成

```typescript
// src/lib/ai-skills/organize/organize-planner.ts

export interface OrganizePlan {
  // 分析结果
  analysis: {
    totalBookmarks: number;
    unorganized: number; // 未分类数量
    duplicates: number; // 重复数量
    topTopics: string[]; // 主要主题
  };

  // 建议的分类结构
  proposedStructure: FolderStructure[];

  // 预计变更
  changes: {
    toMove: number; // 将移动的书签数
    toCreate: number; // 将创建的文件夹数
    toMerge: number; // 建议合并的文件夹
  };

  // 执行方式
  executionMode: "auto" | "step-by-step" | "preview-only";
}

export class OrganizePlanner {
  /**
   * 生成整理方案
   */
  async generatePlan(
    userId: string,
    scope: OrganizeScope,
  ): Promise<OrganizePlan> {
    // 1. 获取待整理的书签
    const bookmarks = await this.fetchBookmarks(userId, scope);

    // 2. 分析内容主题
    const topics = await this.analyzeTopics(bookmarks);

    // 3. 生成分类结构建议
    const structure = await this.proposeStructure(topics, bookmarks);

    // 4. 计算变更影响
    const changes = this.calculateChanges(bookmarks, structure);

    return {
      analysis: {
        totalBookmarks: bookmarks.length,
        unorganized: bookmarks.filter((b) => !b.folderId).length,
        duplicates: await this.countDuplicates(bookmarks),
        topTopics: topics.slice(0, 5).map((t) => t.name),
      },
      proposedStructure: structure,
      changes,
      executionMode: "preview-only", // 默认只预览，需用户确认
    };
  }

  /**
   * 分析主题聚类
   */
  private async analyzeTopics(bookmarks: Bookmark[]): Promise<TopicCluster[]> {
    // 使用嵌入向量进行聚类
    const embeddings = await this.getEmbeddings(bookmarks);
    const clusters = this.clusterByEmbedding(embeddings);

    // 为每个聚类生成标签
    return clusters.map((cluster) => ({
      name: this.generateClusterName(cluster),
      bookmarks: cluster.items,
      confidence: cluster.cohesion,
    }));
  }

  /**
   * 生成分类结构建议
   */
  private async proposeStructure(
    topics: TopicCluster[],
    bookmarks: Bookmark[],
  ): Promise<FolderStructure[]> {
    // 获取现有文件夹结构
    const existingFolders = await this.getExistingFolders();

    // 智能匹配：优先使用现有文件夹
    const structure: FolderStructure[] = [];

    for (const topic of topics) {
      // 尝试匹配现有文件夹
      const matchedFolder = this.findMatchingFolder(
        topic.name,
        existingFolders,
      );

      if (matchedFolder) {
        structure.push({
          type: "existing",
          folderId: matchedFolder.id,
          name: matchedFolder.name,
          bookmarksToAdd: topic.bookmarks.map((b) => b.id),
        });
      } else {
        // 建议创建新文件夹
        structure.push({
          type: "new",
          name: topic.name,
          bookmarksToAdd: topic.bookmarks.map((b) => b.id),
        });
      }
    }

    return structure;
  }
}
```

#### 2.2.2 整理确认与执行

```typescript
// src/lib/ai-skills/organize/organize-executor.ts

export class OrganizeExecutor {
  /**
   * 生成确认消息
   */
  generateConfirmation(plan: OrganizePlan): ConfirmationMessage {
    return {
      summary: this.formatPlanSummary(plan),
      details: plan.proposedStructure.map((s) => ({
        folder: s.name,
        action: s.type === "new" ? "新建" : "使用现有",
        count: s.bookmarksToAdd.length,
      })),
      actions: [
        { id: "confirm", label: "确认执行", primary: true },
        { id: "modify", label: "调整方案" },
        { id: "cancel", label: "取消" },
      ],
    };
  }

  private formatPlanSummary(plan: OrganizePlan): string {
    const { changes, analysis } = plan;
    const parts: string[] = [];

    if (changes.toCreate > 0) {
      parts.push(`创建 ${changes.toCreate} 个新文件夹`);
    }
    if (changes.toMove > 0) {
      parts.push(`移动 ${changes.toMove} 个书签`);
    }
    if (changes.toMerge > 0) {
      parts.push(`合并 ${changes.toMerge} 个重复文件夹`);
    }

    return `整理方案：${parts.join("，")}`;
  }

  /**
   * 执行整理（带事务和回滚）
   */
  async execute(plan: OrganizePlan, userId: string): Promise<OrganizeResult> {
    // 创建快照（用于回滚）
    const snapshot = await this.createSnapshot(userId);

    try {
      const results: OrganizeStepResult[] = [];

      // 1. 创建新文件夹
      for (const item of plan.proposedStructure.filter(
        (s) => s.type === "new",
      )) {
        const folder = await this.createFolder(userId, item.name);
        results.push({
          step: "create_folder",
          folderId: folder.id,
          name: item.name,
        });
      }

      // 2. 移动书签
      for (const item of plan.proposedStructure) {
        await this.moveBookmarks(item.bookmarksToAdd, item.folderId);
        results.push({
          step: "move_bookmarks",
          count: item.bookmarksToAdd.length,
          toFolder: item.name,
        });
      }

      return {
        success: true,
        results,
        snapshotId: snapshot.id, // 返回快照ID，支持回滚
      };
    } catch (error) {
      // 执行失败，自动回滚
      await this.rollback(snapshot);
      throw error;
    }
  }
}
```

### 2.3 场景三：知识萃取

**用户期望**：从N篇收藏中总结归纳萃取知识

**核心设计**：

- 正确识别"总结"意图（vs 整理）
- 多文档综合分析
- 结构化知识输出
- 可导出

#### 2.3.1 知识萃取引擎

```typescript
// src/lib/ai-skills/extract/knowledge-extractor.ts

export interface KnowledgeExtraction {
  // 主题
  topic: string;

  // 核心要点
  keyPoints: Array<{
    point: string;
    sources: number[]; // 来源书签ID
    importance: "high" | "medium" | "low";
  }>;

  // 概念关系
  concepts: Array<{
    name: string;
    definition?: string;
    relatedConcepts: string[];
  }>;

  // 综合总结
  summary: string;

  // 知识空白（提到但未深入的点）
  gaps?: string[];

  // 元信息
  meta: {
    sourceCount: number;
    totalWords: number;
    extractedAt: Date;
  };
}

export class KnowledgeExtractor {
  /**
   * 从多篇内容中萃取知识
   */
  async extract(params: {
    bookmarkIds: number[];
    userId: string;
    focus?: string; // 可选的关注点
  }): Promise<KnowledgeExtraction> {
    // 1. 获取书签内容
    const bookmarks = await this.fetchBookmarksWithContent(params.bookmarkIds);

    // 2. 内容预处理
    const documents = bookmarks.map((b) => ({
      id: b.id,
      title: b.title,
      content: b.content || b.description || "",
      url: b.url,
    }));

    // 3. 主题识别
    const topic = params.focus || (await this.identifyMainTopic(documents));

    // 4. 要点提取
    const keyPoints = await this.extractKeyPoints(documents, topic);

    // 5. 概念提取
    const concepts = await this.extractConcepts(documents);

    // 6. 生成综合总结
    const summary = await this.generateSummary(keyPoints, concepts, topic);

    // 7. 识别知识空白
    const gaps = await this.identifyGaps(documents, keyPoints);

    return {
      topic,
      keyPoints,
      concepts,
      summary,
      gaps,
      meta: {
        sourceCount: documents.length,
        totalWords: documents.reduce((sum, d) => sum + d.content.length, 0),
        extractedAt: new Date(),
      },
    };
  }

  /**
   * 提取关键要点
   */
  private async extractKeyPoints(
    documents: Document[],
    topic: string,
  ): Promise<KeyPoint[]> {
    const prompt = `分析以下${documents.length}篇关于「${topic}」的内容，提取核心要点：

${documents
  .map(
    (d, i) => `
【文档${i + 1}】${d.title}
${d.content.substring(0, 2000)}
`,
  )
  .join("\n")}

要求：
1. 提取 5-10 个核心要点
2. 每个要点标注来源文档编号
3. 评估重要性（high/medium/low）
4. 避免重复，合并相似观点

输出 JSON 格式：
{
  "keyPoints": [
    {
      "point": "要点描述",
      "sources": [1, 3],
      "importance": "high"
    }
  ]
}`;

    const response = await this.llm.generate(prompt);
    return JSON.parse(response).keyPoints;
  }

  /**
   * 生成综合总结
   */
  private async generateSummary(
    keyPoints: KeyPoint[],
    concepts: Concept[],
    topic: string,
  ): Promise<string> {
    const prompt = `基于以下要点和概念，生成关于「${topic}」的综合总结：

要点：
${keyPoints.map((p) => `- ${p.point}`).join("\n")}

概念：
${concepts.map((c) => `- ${c.name}: ${c.definition}`).join("\n")}

要求：
1. 300-500字
2. 逻辑清晰，结构化
3. 突出核心观点
4. 使用简洁语言`;

    return await this.llm.generate(prompt);
  }
}
```

#### 2.3.2 萃取结果呈现

```typescript
// src/lib/ai-skills/extract/extraction-presenter.ts

export class ExtractionPresenter {
  /**
   * 格式化萃取结果（简洁版，用于对话）
   */
  formatForChat(extraction: KnowledgeExtraction): string {
    const highPoints = extraction.keyPoints
      .filter((p) => p.importance === "high")
      .slice(0, 5);

    let output = `## ${extraction.topic}\n\n`;
    output += `**核心要点**：\n`;
    output += highPoints.map((p) => `• ${p.point}`).join("\n");
    output += `\n\n**总结**：\n${extraction.summary}`;

    if (extraction.gaps && extraction.gaps.length > 0) {
      output += `\n\n**可进一步了解**：${extraction.gaps.slice(0, 3).join("、")}`;
    }

    return output;
  }

  /**
   * 格式化为可导出文档
   */
  formatForExport(
    extraction: KnowledgeExtraction,
    format: "markdown" | "notion" | "obsidian",
  ): string {
    switch (format) {
      case "markdown":
        return this.toMarkdown(extraction);
      case "notion":
        return this.toNotion(extraction);
      case "obsidian":
        return this.toObsidian(extraction);
    }
  }

  private toMarkdown(extraction: KnowledgeExtraction): string {
    let md = `# ${extraction.topic}\n\n`;
    md += `> 萃取自 ${extraction.meta.sourceCount} 篇内容\n\n`;

    md += `## 核心要点\n\n`;
    for (const point of extraction.keyPoints) {
      const importance =
        point.importance === "high"
          ? "🔴"
          : point.importance === "medium"
            ? "🟡"
            : "🟢";
      md += `${importance} ${point.point}\n`;
    }

    md += `\n## 关键概念\n\n`;
    for (const concept of extraction.concepts) {
      md += `### ${concept.name}\n`;
      if (concept.definition) {
        md += `${concept.definition}\n`;
      }
      if (concept.relatedConcepts.length > 0) {
        md += `相关：${concept.relatedConcepts.join("、")}\n`;
      }
      md += "\n";
    }

    md += `## 综合总结\n\n${extraction.summary}\n`;

    return md;
  }
}
```

### 2.4 实施任务

| 场景     | 任务                | 优先级 | 工时    |
| -------- | ------------------- | ------ | ------- |
| **搜索** | SearchQueryParser   | P0     | 4h      |
|          | SearchRanker        | P0     | 6h      |
|          | SearchResponder     | P0     | 4h      |
|          | 搜索测试            | P0     | 4h      |
| **整理** | OrganizePlanner     | P0     | 8h      |
|          | OrganizeExecutor    | P0     | 6h      |
|          | 确认UI组件          | P1     | 4h      |
|          | 整理测试            | P0     | 4h      |
| **萃取** | KnowledgeExtractor  | P0     | 12h     |
|          | ExtractionPresenter | P1     | 4h      |
|          | 导出功能            | P1     | 4h      |
|          | 萃取测试            | P0     | 4h      |
| **小计** | -                   | -      | **64h** |

---

## 第三部分：响应自然化

### 3.1 去程序化设计

**问题**：用户感觉在和提示词模板交互

**解决方案**：

#### 3.1.1 响应模板库

```typescript
// src/lib/ai-skills/response/response-templates.ts

/**
 * 响应变体库
 * 同一意图的多种表达方式，避免机械重复
 */
export const RESPONSE_VARIANTS = {
  // 搜索成功（单结果）
  "search.single_result": ["找到了：", "这个应该是：", "应该是这篇："],

  // 搜索成功（多结果）
  "search.multiple_results": [
    (count: number) => `找到 ${count} 个相关的：`,
    (count: number) => `有 ${count} 篇可能相关：`,
    (count: number) => `搜到 ${count} 个结果：`,
  ],

  // 搜索无结果
  "search.no_result": [
    "没找到相关内容",
    "这个好像没有收藏过",
    "没搜到，换几个关键词试试？",
  ],

  // 整理确认
  "organize.confirm": [
    (plan: string) => `整理方案：${plan}\n确认执行？`,
    (plan: string) => `建议这样整理：${plan}\n可以吗？`,
  ],

  // 总结完成
  "extract.complete": ["总结好了：", "这是萃取的要点："],

  // 操作确认
  "action.confirm": [
    (action: string) => `确定要${action}吗？`,
    (action: string) => `即将${action}，确认？`,
  ],
};

/**
 * 响应生成器
 */
export class ResponseGenerator {
  private usedVariants: Map<string, number> = new Map();

  /**
   * 获取响应变体（避免连续重复）
   */
  getVariant(key: string, ...args: unknown[]): string {
    const variants = RESPONSE_VARIANTS[key];
    if (!variants) {
      return "";
    }

    // 避免连续使用同一变体
    const lastUsed = this.usedVariants.get(key) ?? -1;
    let index = Math.floor(Math.random() * variants.length);

    // 如果只有2个变体且刚用过，切换到另一个
    if (variants.length === 2 && index === lastUsed) {
      index = 1 - index;
    }
    // 如果有3个以上，尽量不重复
    else if (variants.length > 2 && index === lastUsed) {
      index = (index + 1) % variants.length;
    }

    this.usedVariants.set(key, index);

    const variant = variants[index];
    return typeof variant === "function" ? variant(...args) : variant;
  }
}
```

#### 3.1.2 上下文感知响应

```typescript
// src/lib/ai-skills/response/context-aware-responder.ts

export class ContextAwareResponder {
  /**
   * 根据上下文调整响应风格
   */
  adaptResponse(baseResponse: string, context: ResponseContext): string {
    let response = baseResponse;

    // 1. 根据用户历史调整简洁度
    if (context.userPreference === "concise") {
      response = this.makeMoreConcise(response);
    }

    // 2. 根据连续对话调整
    if (context.isFollowUp) {
      // 后续对话不需要重复上下文
      response = this.removeRedundantContext(response, context.previousTurn);
    }

    // 3. 根据时间段调整（可选）
    // 例如深夜可能更简短

    return response;
  }

  private makeMoreConcise(response: string): string {
    // 移除礼貌性语气词
    return response
      .replace(/^(好的|好，|嗯，|让我)/, "")
      .replace(/[哦哈呢嘛]([，。！])/g, "$1")
      .trim();
  }

  private removeRedundantContext(response: string, previous: string): string {
    // 如果上一轮已经提到过相同的内容，简化
    // 例如上一轮说了"在【技术】文件夹中"，这一轮不需要再说
    return response;
  }
}
```

### 3.2 实施任务

| 任务                       | 优先级 | 工时    |
| -------------------------- | ------ | ------- |
| 响应变体库设计             | P1     | 4h      |
| ResponseGenerator 实现     | P1     | 3h      |
| ContextAwareResponder 实现 | P2     | 4h      |
| **小计**                   | -      | **11h** |

---

## 第四部分：自我进化机制

### 4.1 轻量级反馈学习

不需要复杂的记忆系统，先实现轻量级的反馈循环。

#### 4.1.1 意图纠错学习

```typescript
// src/lib/ai-skills/learning/intent-correction-learner.ts

/**
 * 意图纠错学习器
 * 当用户纠正 Agent 的误判时，记录并学习
 */
export class IntentCorrectionLearner {
  /**
   * 记录纠错
   */
  async recordCorrection(params: {
    userId: string;
    originalMessage: string;
    wrongIntent: IntentClassification;
    correctIntent: IntentClassification;
    userCorrection: string; // 用户纠正的原话
  }): Promise<void> {
    // 存储纠错记录
    await this.db.insert("intent_corrections", {
      user_id: params.userId,
      message: params.originalMessage,
      wrong_type: params.wrongIntent.type,
      wrong_subtype: params.wrongIntent.subType,
      correct_type: params.correctIntent.type,
      correct_subtype: params.correctIntent.subType,
      user_correction: params.userCorrection,
      created_at: new Date(),
    });

    // 分析是否需要添加新规则
    await this.analyzeForNewRule(params);
  }

  /**
   * 分析是否需要新增消歧规则
   */
  private async analyzeForNewRule(params: CorrectionParams): Promise<void> {
    // 查询类似的纠错记录
    const similar = await this.findSimilarCorrections(params.originalMessage);

    // 如果同类纠错超过3次，考虑添加规则
    if (similar.length >= 3) {
      const pattern = this.extractCommonPattern(similar);
      if (pattern) {
        logger.info(
          {
            pattern,
            examples: similar.slice(0, 3),
          },
          "IntentCorrectionLearner: Suggesting new disambiguation rule",
        );

        // 可以自动添加或通知开发者
        await this.suggestNewRule(pattern, params.correctIntent);
      }
    }
  }

  /**
   * 应用学习到的模式
   */
  async applyLearnedPatterns(
    message: string,
    baseClassification: IntentClassification,
  ): Promise<IntentClassification> {
    // 查询是否有类似消息的纠错记录
    const correction = await this.findApplicableCorrection(message);

    if (correction && correction.confidence > 0.8) {
      return {
        ...baseClassification,
        type: correction.correctType,
        subType: correction.correctSubType,
        source: "learned",
      };
    }

    return baseClassification;
  }
}
```

#### 4.1.2 用户偏好记忆

```typescript
// src/lib/ai-skills/learning/preference-memory.ts

/**
 * 用户偏好记忆
 * 记住用户的操作习惯和偏好
 */
export interface UserPreferenceMemory {
  // 响应风格偏好
  responseStyle: {
    preferredLength: "short" | "medium" | "long";
    likeConfirmation: boolean;
  };

  // 搜索习惯
  searchHabits: {
    defaultTimeRange: string;
    frequentKeywords: string[];
  };

  // 整理偏好
  organizePreferences: {
    preferredFolderStructure: "flat" | "nested";
    autoTagEnabled: boolean;
  };
}

export class PreferenceMemoryService {
  /**
   * 从用户行为推断偏好
   */
  async inferPreferences(
    userId: string,
  ): Promise<Partial<UserPreferenceMemory>> {
    const behaviors = await this.getUserBehaviors(userId, { days: 30 });

    return {
      responseStyle: {
        preferredLength: this.inferLengthPreference(behaviors),
        likeConfirmation: this.inferConfirmationPreference(behaviors),
      },
      searchHabits: {
        frequentKeywords: this.extractFrequentKeywords(behaviors),
      },
    };
  }

  private inferLengthPreference(
    behaviors: Behavior[],
  ): "short" | "medium" | "long" {
    // 分析用户对不同长度响应的互动情况
    const lengthInteractions = behaviors
      .filter((b) => b.type === "response_interaction")
      .map((b) => ({
        length: b.responseLength,
        engaged: b.userEngaged, // 是否有后续操作
      }));

    // 计算各长度的互动率
    const stats = this.groupAndStats(lengthInteractions, "length", "engaged");

    // 返回互动率最高的长度
    return stats.sort((a, b) => b.rate - a.rate)[0]?.length ?? "medium";
  }
}
```

### 4.2 实施任务

| 任务                    | 优先级 | 工时    |
| ----------------------- | ------ | ------- |
| 意图纠错数据表          | P1     | 2h      |
| IntentCorrectionLearner | P1     | 6h      |
| 纠错规则分析逻辑        | P2     | 4h      |
| PreferenceMemoryService | P2     | 6h      |
| **小计**                | -      | **18h** |

---

## 第五部分：实施计划

### 5.1 总工时估算

| 模块           | 工时     | 优先级 |
| -------------- | -------- | ------ |
| 意图理解精准化 | 14h      | P0     |
| 智能搜索优化   | 18h      | P0     |
| 智能整理优化   | 22h      | P0     |
| 知识萃取优化   | 24h      | P0     |
| 响应自然化     | 11h      | P1     |
| 自我进化机制   | 18h      | P1-P2  |
| **总计**       | **107h** | -      |

### 5.2 分阶段执行

```
Phase 1: 意图精准化 (1周)
├── IntentClassifierV2 实现
├── 语义消歧规则
├── 意图确认机制
└── 测试验证

Phase 2: 核心场景优化 (2周)
├── Week 1: 搜索 + 整理
│   ├── SearchQueryParser
│   ├── SearchRanker
│   ├── OrganizePlanner
│   └── OrganizeExecutor
│
└── Week 2: 知识萃取
    ├── KnowledgeExtractor
    ├── ExtractionPresenter
    └── 导出功能

Phase 3: 体验优化 (1周)
├── 响应自然化
├── 意图纠错学习
└── 用户偏好记忆
```

### 5.3 验收标准

| 场景         | 验收标准                              |
| ------------ | ------------------------------------- |
| **意图理解** | "梳理内容总结纪要" 正确识别为总结意图 |
| **智能搜索** | 模糊描述能找到正确结果                |
| **智能整理** | 生成合理分类方案并确认后执行          |
| **知识萃取** | 从多篇内容生成结构化总结              |
| **响应风格** | 用户不感觉在和模板对话                |

---

## 第六部分：技术架构调整

### 6.1 模块依赖图

```
┌─────────────────────────────────────────────────────────┐
│                  /api/agent/unified                      │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 IntentClassifierV2                       │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │ collectAll    │→ │ disambiguate  │→ │ confirm?    │ │
│  │ Matches       │  │               │  │             │ │
│  └───────────────┘  └───────────────┘  └─────────────┘ │
└───────────────────────────┬─────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐
│ SearchEngine    │ │ OrganizeEngine│ │ ExtractEngine   │
│                 │ │               │ │                 │
│ - QueryParser   │ │ - Planner     │ │ - Extractor     │
│ - Ranker        │ │ - Executor    │ │ - Presenter     │
│ - Responder     │ │ - Confirmer   │ │                 │
└─────────────────┘ └───────────────┘ └─────────────────┘
              │             │             │
              └─────────────┼─────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 ResponseGenerator                        │
│  ┌───────────────┐  ┌───────────────────────────────┐  │
│  │ Variants      │  │ ContextAwareResponder         │  │
│  └───────────────┘  └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 Learning Layer                           │
│  ┌───────────────────┐  ┌─────────────────────────────┐│
│  │ IntentCorrection  │  │ PreferenceMemory            ││
│  │ Learner           │  │                             ││
│  └───────────────────┘  └─────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 6.2 新增数据表

```sql
-- 意图纠错记录表
CREATE TABLE intent_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  wrong_type TEXT NOT NULL,
  wrong_subtype TEXT,
  correct_type TEXT NOT NULL,
  correct_subtype TEXT,
  user_correction TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用户偏好表（轻量级）
CREATE TABLE user_agent_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  response_style JSONB DEFAULT '{}',
  search_habits JSONB DEFAULT '{}',
  organize_preferences JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_corrections_user ON intent_corrections(user_id);
CREATE INDEX idx_corrections_wrong ON intent_corrections(wrong_type, wrong_subtype);
```

---

## 总结

### 核心变化

| 方面     | V1 方案          | V2 方案（本方案）  |
| -------- | ---------------- | ------------------ |
| **思路** | 堆功能           | 深耕核心场景       |
| **重点** | 主动智能、多模态 | 意图精准、执行准确 |
| **工时** | 542h             | 107h               |
| **周期** | 18周             | 4周                |
| **风险** | 中高             | 低                 |

### 预期效果

1. **意图理解准确率**: 75% → 95%
2. **搜索满意度**: 基本可用 → 精准+自然
3. **整理任务成功率**: 待验证 → 高效+可控
4. **知识萃取准确性**: 易误判 → 准确+实用
5. **用户感受**: 程序化 → 自然智能

### 下一步

请审核本方案，特别是：

1. 三个核心场景的优先级是否正确？
2. 意图消歧规则是否覆盖了主要歧义场景？
3. 响应风格设计是否符合预期？

---

**文档结束**
