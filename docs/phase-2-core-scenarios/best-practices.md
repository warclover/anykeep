# Phase 2 最佳实践参考

> **版本**: 2.0.0
> **日期**: 2025-12-25
> **用途**: 为 Phase 2 各任务提供业界最佳实践参考
> **整合**: V3 实施计划 (Batch 2-5) 详细设计

---

## 目录

- [2.1 上下文记忆 - 会话状态管理](#21-上下文记忆---会话状态管理)
- [3.1 查询理解增强 - 时间解析](#31-查询理解增强---时间解析)
- [3.2 结果相关度排序 - BM25 + 语义混合](#32-结果相关度排序---bm25--语义混合)
- [3.3 搜索结果格式化与响应自然化](#33-搜索结果格式化与响应自然化)
- [4.1 整理工作流设计 - Saga Pattern](#41-整理工作流设计---saga-pattern)
- [4.2 方案执行引擎](#42-方案执行引擎)
- [4.3 整理确认 UI 设计](#43-整理确认-ui-设计)
- [5.1 知识萃取服务](#51-知识萃取服务)

---

## 2.1 上下文记忆 - 会话状态管理

> **来源**: V3 计划 Batch 2 (提升为基础设施)
> **核心价值**: 解析"刚才"、"这些"、"那个"等指代词，实现对话连续性

### 记忆层级架构

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
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 会话记忆实现

```typescript
// src/lib/ai-memory/session-memory.ts

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

  private createNewState(): ConversationState {
    return {
      messages: [],
      mentionedBookmarks: [],
      mentionedFolders: [],
      tempPreferences: {},
      lastUpdated: Date.now(),
    };
  }
}
```

### 验收标准

| 测试用例           | 预期行为                   | 优先级 |
| ------------------ | -------------------------- | ------ |
| "把刚才的总结保存" | 正确识别"刚才"指上一轮输出 | P0     |
| "移到那个文件夹"   | 正确识别"那个"指之前提到的 | P0     |
| "这些都加上标签"   | 正确识别"这些"指搜索结果   | P1     |

---

## 3.1 查询理解增强 - 时间解析

> **来源**: V3 计划 Batch 3
> **核心价值**: 精准解析自然语言查询，支持时间范围、平台筛选、模糊程度识别

### V3 增强：ParsedQuery 完整结构

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
    start?: Date;
    end?: Date;
  };

  // 来源平台
  platform?: string;

  // 模糊程度（影响搜索策略）
  fuzzyLevel: "exact" | "fuzzy" | "vague";

  // 用户意图
  intent: "find_specific" | "browse" | "explore";

  // 原始文本
  originalText: string;

  // 置信度
  confidence: number;
}

// 示例解析
// "找一下之前那篇关于 React 的文章"
// {
//   keywords: ["React"],
//   timeRange: { type: 'relative', value: '之前', days: 90 },
//   fuzzyLevel: 'vague',  // "那篇" 表示记忆模糊
//   intent: 'find_specific',
//   confidence: 0.7
// }
```

### chrono-node 时间解析库

[chrono-node](https://github.com/wanasit/chrono) 是一个强大的自然语言日期解析库，支持多种语言和日期格式。

#### 基础用法

```typescript
import * as chrono from "chrono-node";

// 基础解析
chrono.parseDate("An appointment on Sep 12-13");
// Fri Sep 12 2014 12:00:00 GMT-0500 (CDT)

// 相对日期解析（基于参考日期）
chrono.parseDate("Friday", new Date(2012, 7, 23));
// Fri Aug 24 2012 12:00:00 GMT+0900 (JST)

// 向前解析（只返回未来日期）
chrono.parseDate("Friday", referenceDate, { forwardDate: true });
// Fri Aug 31 2012 12:00:00 GMT+0900 (JST)
```

#### 解析结果结构

```typescript
interface ParsedResult {
  refDate: Date; // 参考日期
  index: number; // 匹配文本的起始索引
  text: string; // 被解析的文本片段
  start: ParsedComponents; // 开始时间组件
  end?: ParsedComponents; // 结束时间组件（可选）
  date: () => Date; // 返回开始日期的函数
}

interface ParsedComponents {
  get: (c: Component) => number | null; // 获取组件值
  isCertain: (c: Component) => boolean; // 组件是否确定
  date: () => Date; // 创建 Date 对象
}

// 使用示例
const results = chrono.parse("I have an appointment tomorrow from 10 to 11 AM");
results[0].start.get("day"); // 14
results[0].start.get("hour"); // 10
results[0].end.date(); // Sun Dec 14 2014 11:00:00
```

#### 应用到 AnyKeep: QueryParser 设计

```typescript
import * as chrono from "chrono-node";
import { zhHans } from "chrono-node/locales/zh";

interface TimeRange {
  start: Date;
  end: Date;
  text: string; // 原始文本（用于 debug）
  confidence: number; // 解析置信度
}

interface ParsedQuery {
  keywords: string[]; // 提取的关键词
  timeRange: TimeRange | null; // 时间范围
  platforms: string[]; // 平台筛选
  tags: string[]; // 标签筛选
  originalText: string; // 原始查询
}

export class QueryParser {
  private chronoParser = chrono.zh.casual.clone();

  // 添加中文时间表达式扩展
  constructor() {
    // 扩展"上周"、"最近3天"等中文表达
    this.addChineseTimeExpressions();
  }

  private addChineseTimeExpressions() {
    this.chronoParser.parsers.push({
      pattern: () => /最近(\d+)天/,
      extract: (context, match) => {
        const days = parseInt(match[1]);
        const ref = context.refDate;
        return {
          day: ref.getDate(),
          month: ref.getMonth() + 1,
          year: ref.getFullYear(),
          // 设置为 N 天前到现在
        };
      },
    });
  }

  parse(query: string, refDate: Date = new Date()): ParsedQuery {
    // 1. 解析时间范围
    const timeResults = this.chronoParser.parse(query, refDate);
    let timeRange: TimeRange | null = null;

    if (timeResults.length > 0) {
      const result = timeResults[0];
      timeRange = {
        start: result.start.date(),
        end: result.end?.date() ?? new Date(),
        text: result.text,
        confidence: this.calculateConfidence(result),
      };
    }

    // 2. 移除时间表达式后提取关键词
    let cleanedQuery = query;
    if (timeRange) {
      cleanedQuery = query.replace(timeRange.text, "").trim();
    }

    // 3. 提取平台和标签
    const platforms = this.extractPlatforms(cleanedQuery);
    const tags = this.extractTags(cleanedQuery);
    const keywords = this.extractKeywords(cleanedQuery, platforms, tags);

    return {
      keywords,
      timeRange,
      platforms,
      tags,
      originalText: query,
    };
  }

  private calculateConfidence(result: chrono.ParsedResult): number {
    // 根据组件确定性计算置信度
    let score = 0.5;
    if (result.start.isCertain("day")) score += 0.2;
    if (result.start.isCertain("month")) score += 0.2;
    if (result.start.isCertain("year")) score += 0.1;
    return Math.min(score, 1.0);
  }

  private extractPlatforms(query: string): string[] {
    const platformPatterns: Record<string, RegExp> = {
      wechat: /微信|公众号/,
      bilibili: /B站|bilibili|哔哩/,
      xiaohongshu: /小红书|红书/,
      zhihu: /知乎/,
      weibo: /微博/,
      browser: /浏览器|书签/,
    };

    return Object.entries(platformPatterns)
      .filter(([_, pattern]) => pattern.test(query))
      .map(([platform]) => platform);
  }

  private extractTags(query: string): string[] {
    // 提取 # 开头的标签
    const tagPattern = /#(\S+)/g;
    const matches = query.matchAll(tagPattern);
    return Array.from(matches).map((m) => m[1]);
  }

  private extractKeywords(
    query: string,
    platforms: string[],
    tags: string[],
  ): string[] {
    // 移除平台和标签相关词后的剩余关键词
    let cleaned = query;

    // 移除平台词
    cleaned = cleaned.replace(
      /微信|公众号|B站|bilibili|哔哩|小红书|红书|知乎|微博|浏览器|书签/g,
      "",
    );

    // 移除标签
    cleaned = cleaned.replace(/#\S+/g, "");

    // 移除停用词
    const stopWords = [
      "的",
      "了",
      "吗",
      "呢",
      "啊",
      "那",
      "这",
      "有",
      "找",
      "搜",
      "查",
    ];
    stopWords.forEach((word) => {
      cleaned = cleaned.replace(new RegExp(word, "g"), "");
    });

    // 分词（简化版：按空格和标点分割）
    return cleaned.split(/[\s，。！？、]+/).filter((w) => w.length > 0);
  }
}
```

#### 中文时间表达式映射

```typescript
export const CHINESE_TIME_EXPRESSIONS: Record<
  string,
  (ref: Date) => { start: Date; end: Date }
> = {
  今天: (ref) => ({
    start: startOfDay(ref),
    end: endOfDay(ref),
  }),
  昨天: (ref) => ({
    start: startOfDay(subDays(ref, 1)),
    end: endOfDay(subDays(ref, 1)),
  }),
  前天: (ref) => ({
    start: startOfDay(subDays(ref, 2)),
    end: endOfDay(subDays(ref, 2)),
  }),
  本周: (ref) => ({
    start: startOfWeek(ref, { weekStartsOn: 1 }),
    end: endOfWeek(ref, { weekStartsOn: 1 }),
  }),
  上周: (ref) => ({
    start: startOfWeek(subWeeks(ref, 1), { weekStartsOn: 1 }),
    end: endOfWeek(subWeeks(ref, 1), { weekStartsOn: 1 }),
  }),
  本月: (ref) => ({
    start: startOfMonth(ref),
    end: endOfMonth(ref),
  }),
  上月: (ref) => ({
    start: startOfMonth(subMonths(ref, 1)),
    end: endOfMonth(subMonths(ref, 1)),
  }),
  最近一周: (ref) => ({
    start: subDays(ref, 7),
    end: ref,
  }),
  最近一个月: (ref) => ({
    start: subMonths(ref, 1),
    end: ref,
  }),
};

// 正则匹配 "最近N天/周/月"
const RECENT_PATTERN = /最近(\d+)(天|周|月)/;

function parseRecentExpression(
  text: string,
  ref: Date,
): { start: Date; end: Date } | null {
  const match = text.match(RECENT_PATTERN);
  if (!match) return null;

  const count = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case "天":
      return { start: subDays(ref, count), end: ref };
    case "周":
      return { start: subWeeks(ref, count), end: ref };
    case "月":
      return { start: subMonths(ref, count), end: ref };
    default:
      return null;
  }
}
```

#### 测试用例

```typescript
describe("QueryParser", () => {
  const parser = new QueryParser();
  const fixedDate = new Date("2024-12-25T10:00:00");

  test('解析"上周的AI文章"', () => {
    const result = parser.parse("上周的AI文章", fixedDate);
    expect(result.keywords).toContain("AI");
    expect(result.keywords).toContain("文章");
    expect(result.timeRange?.start).toEqual(/* 上周一 */);
    expect(result.timeRange?.end).toEqual(/* 上周日 */);
  });

  test('解析"最近3天收藏的微信文章"', () => {
    const result = parser.parse("最近3天收藏的微信文章", fixedDate);
    expect(result.keywords).toContain("文章");
    expect(result.platforms).toContain("wechat");
    expect(result.timeRange?.start).toEqual(subDays(fixedDate, 3));
  });

  test('解析"找一下那篇讲AI的"', () => {
    const result = parser.parse("找一下那篇讲AI的", fixedDate);
    expect(result.keywords).toContain("AI");
    expect(result.timeRange).toBeNull(); // 无时间范围
  });
});
```

---

## 3.2 结果相关度排序 - BM25 + 语义混合

### 业界参考

#### PostgreSQL 混合搜索方案

根据 2025 年最新的 PostgreSQL 混合搜索实践，有几个主要方案：

1. **VectorChord-BM25** - 比 Elasticsearch 快 3 倍的原生 BM25 实现
2. **pg_textsearch (Tiger Data)** - 现代 BM25 + pgvector 混合检索
3. **ParadeDB pg_search** - 生产级全文搜索

> 参考:
>
> - [VectorChord-BM25](https://blog.vectorchord.ai/vectorchord-bm25-revolutionize-postgresql-search-with-bm25-ranking-3x-faster-than-elasticsearch)
> - [pg_textsearch by Tiger Data](https://www.tigerdata.com/blog/introducing-pg_textsearch-true-bm25-ranking-hybrid-retrieval-postgres)
> - [ParadeDB Hybrid Search Manual](https://www.paradedb.com/blog/hybrid-search-in-postgresql-the-missing-manual)

#### 为什么 BM25 优于原生 PostgreSQL 全文搜索

PostgreSQL 原生全文搜索 (`tsvector` + `tsquery`) 有根本限制：

- `ts_rank` 只考虑词频，不考虑**逆文档频率**
- 无**文档长度归一化**，长文档天然占优

BM25 通过三个智能信号解决排序问题：

1. **词频 (TF)** - 词在文档中出现次数
2. **逆文档频率 (IDF)** - 罕见词权重更高
3. **文档长度归一化** - 防止长文档主导结果

### 应用到 AnyKeep: 混合排序实现

#### 方案选择

由于 AnyKeep 使用 Supabase 托管 PostgreSQL，无法安装 VectorChord-BM25 等扩展。我们采用**应用层混合排序**策略：

```typescript
interface ScoredBookmark {
  bookmark: Bookmark;
  scores: {
    vector: number; // 向量相似度 (0-1)
    title: number; // 标题匹配度 (0-1)
    recency: number; // 时间新鲜度 (0-1)
    engagement: number; // 用户互动 (0-1)
  };
  finalScore: number; // 加权总分
}

interface RankingWeights {
  vector: number; // 35%
  title: number; // 30%
  recency: number; // 20%
  engagement: number; // 15%
}

const DEFAULT_WEIGHTS: RankingWeights = {
  vector: 0.35,
  title: 0.3,
  recency: 0.2,
  engagement: 0.15,
};
```

#### 标题匹配度计算（简化 BM25）

```typescript
interface TitleMatchResult {
  score: number;
  matchType: "exact" | "fuzzy" | "partial" | "none";
}

export function calculateTitleMatch(
  title: string,
  keywords: string[],
): TitleMatchResult {
  if (!keywords.length) {
    return { score: 0, matchType: "none" };
  }

  const normalizedTitle = title.toLowerCase();

  // 精确匹配（所有关键词连续出现）
  const exactPattern = keywords.join(".*?");
  if (new RegExp(exactPattern, "i").test(normalizedTitle)) {
    return { score: 1.0, matchType: "exact" };
  }

  // 模糊匹配（所有关键词出现，顺序无关）
  const allPresent = keywords.every((kw) =>
    normalizedTitle.includes(kw.toLowerCase()),
  );
  if (allPresent) {
    return { score: 0.8, matchType: "fuzzy" };
  }

  // 部分匹配（部分关键词出现）
  const matchCount = keywords.filter((kw) =>
    normalizedTitle.includes(kw.toLowerCase()),
  ).length;

  if (matchCount > 0) {
    const ratio = matchCount / keywords.length;
    return { score: ratio * 0.6, matchType: "partial" };
  }

  return { score: 0, matchType: "none" };
}
```

#### 时间新鲜度计算

```typescript
export function calculateRecencyScore(
  createdAt: Date,
  referenceDate: Date = new Date(),
): number {
  const daysDiff = differenceInDays(referenceDate, createdAt);

  // 指数衰减：半衰期 30 天
  // 公式: score = e^(-λ * days), λ = ln(2) / halfLife
  const halfLife = 30;
  const lambda = Math.LN2 / halfLife;

  return Math.exp(-lambda * daysDiff);
}

// 示例：
// 今天: 1.0
// 7天前: 0.85
// 30天前: 0.5
// 90天前: 0.125
```

#### 用户互动评分

```typescript
interface EngagementMetrics {
  viewCount: number;
  lastViewedAt: Date | null;
  isFavorite: boolean;
}

export function calculateEngagementScore(metrics: EngagementMetrics): number {
  let score = 0;

  // 浏览次数（对数缩放，避免极端值）
  const viewScore = Math.log10(metrics.viewCount + 1) / 3; // max ~0.33
  score += Math.min(viewScore, 0.33);

  // 最近浏览加成
  if (metrics.lastViewedAt) {
    const daysSinceView = differenceInDays(new Date(), metrics.lastViewedAt);
    if (daysSinceView < 7) score += 0.33;
    else if (daysSinceView < 30) score += 0.17;
  }

  // 收藏加成
  if (metrics.isFavorite) score += 0.34;

  return Math.min(score, 1.0);
}
```

#### 混合排序器

```typescript
export class HybridRanker {
  constructor(private weights: RankingWeights = DEFAULT_WEIGHTS) {}

  rank(
    bookmarks: Bookmark[],
    vectorScores: Map<string, number>, // bookmarkId → similarity
    keywords: string[],
  ): ScoredBookmark[] {
    const scored = bookmarks.map((bookmark) => {
      const scores = {
        vector: vectorScores.get(bookmark.id) ?? 0,
        title: calculateTitleMatch(bookmark.title, keywords).score,
        recency: calculateRecencyScore(bookmark.createdAt),
        engagement: calculateEngagementScore({
          viewCount: bookmark.viewCount ?? 0,
          lastViewedAt: bookmark.lastViewedAt,
          isFavorite: bookmark.isFavorite ?? false,
        }),
      };

      const finalScore =
        scores.vector * this.weights.vector +
        scores.title * this.weights.title +
        scores.recency * this.weights.recency +
        scores.engagement * this.weights.engagement;

      return { bookmark, scores, finalScore };
    });

    // 按最终分数降序排列
    return scored.sort((a, b) => b.finalScore - a.finalScore);
  }
}
```

#### RRF (Reciprocal Rank Fusion) 替代方案

```typescript
/**
 * RRF 融合多个排序结果
 * 公式: RRF(d) = Σ 1/(k + rank_i(d))
 * 其中 k 通常取 60
 */
export function reciprocalRankFusion(
  rankings: Map<string, number>[], // 多个排序结果: bookmarkId → rank
  k: number = 60,
): Map<string, number> {
  const rrfScores = new Map<string, number>();

  for (const ranking of rankings) {
    for (const [bookmarkId, rank] of ranking) {
      const currentScore = rrfScores.get(bookmarkId) ?? 0;
      rrfScores.set(bookmarkId, currentScore + 1 / (k + rank));
    }
  }

  return rrfScores;
}

// 使用示例
const vectorRanking = new Map([
  ["id1", 1],
  ["id2", 2],
  ["id3", 3],
]);
const titleRanking = new Map([
  ["id2", 1],
  ["id1", 2],
  ["id3", 3],
]);
const recencyRanking = new Map([
  ["id3", 1],
  ["id1", 2],
  ["id2", 3],
]);

const fused = reciprocalRankFusion([
  vectorRanking,
  titleRanking,
  recencyRanking,
]);
// id1: 1/61 + 1/62 + 1/62 = 0.0485
// id2: 1/62 + 1/61 + 1/63 = 0.0482
// id3: 1/63 + 1/63 + 1/61 = 0.0478
```

---

## 3.3 搜索结果格式化与响应自然化

> **来源**: V3 计划 Batch 3
> **核心改进**: 去程序化响应，直接给结果，有下一步引导

### 响应自然化原则

```typescript
// src/lib/ai-skills/response/response-style.ts

const RESPONSE_PRINCIPLES = {
  // 1. 不说废话 - 避免这些开场白
  avoidPhrases: [
    "根据您的请求",
    "我正在为您",
    "以下是",
    "请问还有其他",
    "让我帮您查一下",
  ],

  // 2. 直接给结果
  directPatterns: {
    search: (count: number) => `找到 ${count} 个：`,
    list: (count: number) => `共 ${count} 条：`,
    stats: (stats: Stats) => `${stats.total} 条收藏，${stats.folders} 个文件夹`,
    empty: (query: string) => `没找到「${query}」相关的收藏`,
  },

  // 3. 有下一步引导
  followUpSuggestions: {
    search: ["看详情", "继续找", "筛选"],
    list: ["打开", "整理", "导出"],
    empty: ["换几个关键词", "看看全部"],
  },
};
```

### 对比示例

**当前问题响应（程序化）**：

```
用户：帮我找一下最近的收藏

当前响应：
"根据您的请求，我正在为您搜索最近的收藏内容。以下是搜索结果：
1. xxx
2. xxx
请问还有其他需要帮助的吗？"

太程序化！❌
```

**改进后响应（自然化）**：

```
用户：帮我找一下最近的收藏

改进响应：
"最近 7 天收藏了 5 条：

1. 《Vibe Coding 入门》- 微信 - 昨天
2. 《Claude 使用技巧》- B站 - 3天前
...

要看详情还是继续找？"

简洁、直接、有下一步引导 ✅
```

### 结果分组与展示

```typescript
interface FormattedSearchResult {
  totalCount: number;
  displayedCount: number;
  hasMore: boolean;
  groups: ResultGroup[];
  summary: string; // 自然语言摘要
  followUpSuggestions: Suggestion[];
}

interface ResultGroup {
  label: string; // "高度相关" | "可能相关"
  items: ScoredBookmark[];
  collapsed: boolean; // 是否默认折叠
}

export function formatSearchResults(
  scored: ScoredBookmark[],
  limit: number = 10,
): FormattedSearchResult {
  // 按分数分组
  const highlyRelevant = scored.filter((s) => s.finalScore >= 0.7);
  const maybeRelevant = scored.filter(
    (s) => s.finalScore >= 0.4 && s.finalScore < 0.7,
  );

  const groups: ResultGroup[] = [];

  if (highlyRelevant.length > 0) {
    groups.push({
      label: "高度相关",
      items: highlyRelevant.slice(0, limit),
      collapsed: false,
    });
  }

  if (maybeRelevant.length > 0 && highlyRelevant.length < limit) {
    groups.push({
      label: "可能相关",
      items: maybeRelevant.slice(0, limit - highlyRelevant.length),
      collapsed: highlyRelevant.length >= 3,
    });
  }

  const displayedCount = groups.reduce((sum, g) => sum + g.items.length, 0);

  return {
    totalCount: scored.length,
    displayedCount,
    hasMore: scored.length > displayedCount,
    groups,
    summary: generateSummary(scored, highlyRelevant.length),
    followUpSuggestions: generateFollowUps(scored, groups),
  };
}

function generateSummary(
  scored: ScoredBookmark[],
  highRelevantCount: number,
): string {
  if (scored.length === 0) {
    return "没有找到相关内容";
  }

  if (highRelevantCount > 0) {
    return `找到 ${highRelevantCount} 篇高度相关内容`;
  }

  return `找到 ${scored.length} 篇可能相关内容`;
}
```

---

## 4.1 整理工作流设计 - Saga Pattern

> **来源**: V3 计划 Batch 4
> **核心目标**: 对标 YouMind 的操作闭环：分析 → 方案 → 确认 → 执行 → 反馈

### V3 整理流程设计

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

### V3 OrganizeWorkflow 核心实现

```typescript
// src/lib/ai-skills/organize/organize-workflow.ts

interface OrganizeAction {
  type: "move" | "create_and_move" | "remove_duplicates";
  target: string;
  bookmarkIds: number[];
  isNewFolder: boolean;
}

interface OrganizePlan {
  actions: OrganizeAction[];
  summary: string;
}

export class OrganizeWorkflow {
  /**
   * 分析阶段
   */
  async analyze(userId: string, scope: OrganizeScope): Promise<AnalysisResult> {
    // 1. 获取书签
    const bookmarks = await this.fetchBookmarks(userId, scope);

    // 2. 主题聚类（使用 embedding 相似度）
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
        target: "",
        bookmarkIds: analysis.duplicates.flatMap((d) => d.duplicateIds),
        isNewFolder: false,
      });
    }

    return { actions, summary: this.formatSummary(actions) };
  }

  /**
   * 执行方案
   */
  async execute(plan: OrganizePlan, userId: string): Promise<ExecutionResult> {
    // 创建快照（用于撤销）
    const snapshotId = await this.createSnapshot(userId, plan);

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

  private formatSummary(actions: OrganizeAction[]): string {
    const lines: string[] = [];

    for (const action of actions) {
      if (action.type === "create_and_move") {
        lines.push(
          `创建「${action.target}」文件夹，移入 ${action.bookmarkIds.length} 条`,
        );
      } else if (action.type === "move") {
        lines.push(
          `移入「${action.target}」(已有)，${action.bookmarkIds.length} 条`,
        );
      } else if (action.type === "remove_duplicates") {
        lines.push(`去除 ${action.bookmarkIds.length} 组重复`);
      }
    }

    return lines.join("\n");
  }
}
```

### Saga Pattern 核心概念

Saga 模式用于管理分布式事务，核心思想是将长事务拆分为一系列本地事务，每个事务都有对应的补偿操作。

> 参考:
>
> - [Microsoft Azure - Saga Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga)
> - [Microservices.io - Saga Pattern](https://microservices.io/patterns/data/saga.html)
> - [Temporal - Compensating Actions](https://temporal.io/blog/compensating-actions-part-of-a-complete-breakfast-with-sagas)

### 应用到 AnyKeep: 整理工作流

#### 工作流阶段

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 分析    │ → │ 方案    │ → │ 确认    │ → │ 执行    │ → │ 报告    │
│ analyze │    │ plan    │    │ confirm │    │ execute │    │ report  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
  收集数据      生成方案      用户审核      执行操作      生成报告
  识别问题      预估影响      调整方案      记录快照      提供撤销
```

#### Saga 步骤定义

```typescript
interface SagaStep<T, R> {
  name: string;
  execute: (context: T) => Promise<R>;
  compensate: (context: T, result: R) => Promise<void>;
  maxRetries?: number;
  timeout?: number;
}

interface OrganizeSagaContext {
  userId: string;
  bookmarkIds: string[];
  plan: OrganizePlan;
  snapshots: OperationSnapshot[];
  results: OperationResult[];
}

interface OrganizePlan {
  id: string;
  operations: OrganizeOperation[];
  createdAt: Date;
  estimatedDuration: number;
}

interface OrganizeOperation {
  type: "move" | "tag" | "merge" | "archive" | "delete";
  targets: string[]; // bookmark IDs
  params: Record<string, unknown>;
}

interface OperationSnapshot {
  operationId: string;
  beforeState: BookmarkState[];
  timestamp: Date;
}
```

#### Saga 编排器

```typescript
export class SagaOrchestrator<T> {
  private steps: SagaStep<T, unknown>[] = [];
  private completedSteps: Array<{
    step: SagaStep<T, unknown>;
    result: unknown;
  }> = [];

  addStep<R>(step: SagaStep<T, R>): this {
    this.steps.push(step as SagaStep<T, unknown>);
    return this;
  }

  async execute(context: T): Promise<void> {
    for (const step of this.steps) {
      try {
        const result = await this.executeWithRetry(step, context);
        this.completedSteps.push({ step, result });
      } catch (error) {
        // 执行补偿操作（逆序）
        await this.compensate(context);
        throw new SagaExecutionError(step.name, error);
      }
    }
  }

  private async executeWithRetry<R>(
    step: SagaStep<T, R>,
    context: T,
  ): Promise<R> {
    const maxRetries = step.maxRetries ?? 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return (await Promise.race([
          step.execute(context),
          this.timeout(step.timeout ?? 30000),
        ])) as R;
      } catch (error) {
        lastError = error as Error;
        await this.delay(Math.pow(2, attempt) * 1000); // 指数退避
      }
    }

    throw lastError;
  }

  private async compensate(context: T): Promise<void> {
    // 逆序执行补偿
    for (let i = this.completedSteps.length - 1; i >= 0; i--) {
      const { step, result } = this.completedSteps[i];
      try {
        await step.compensate(context, result);
      } catch (error) {
        console.error(`Compensation failed for step ${step.name}:`, error);
        // 补偿失败继续执行其他补偿
      }
    }
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Step timeout")), ms),
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

#### 整理 Saga 实现

```typescript
const analyzeStep: SagaStep<OrganizeSagaContext, AnalysisResult> = {
  name: "analyze",
  execute: async (ctx) => {
    // 分析书签，识别重复、可归类等
    const bookmarks = await fetchBookmarks(ctx.bookmarkIds);
    return analyzeBookmarks(bookmarks);
  },
  compensate: async () => {
    // 分析步骤无需补偿
  },
};

const snapshotStep: SagaStep<OrganizeSagaContext, OperationSnapshot[]> = {
  name: "snapshot",
  execute: async (ctx) => {
    // 创建操作前快照
    const snapshots = await createSnapshots(ctx.bookmarkIds);
    ctx.snapshots = snapshots;
    return snapshots;
  },
  compensate: async (ctx, snapshots) => {
    // 删除快照
    await deleteSnapshots(snapshots.map((s) => s.operationId));
  },
};

const executeStep: SagaStep<OrganizeSagaContext, OperationResult[]> = {
  name: "execute",
  execute: async (ctx) => {
    const results: OperationResult[] = [];

    for (const operation of ctx.plan.operations) {
      const result = await executeOperation(operation);
      results.push(result);
      ctx.results.push(result);
    }

    return results;
  },
  compensate: async (ctx) => {
    // 从快照恢复
    for (const snapshot of ctx.snapshots) {
      await restoreFromSnapshot(snapshot);
    }
  },
};

// 构建 Saga
export function createOrganizeSaga(): SagaOrchestrator<OrganizeSagaContext> {
  return new SagaOrchestrator<OrganizeSagaContext>()
    .addStep(analyzeStep)
    .addStep(snapshotStep)
    .addStep(executeStep);
}
```

### 语义锁 (Semantic Lock)

防止并发操作冲突：

```typescript
interface BookmarkState {
  id: string;
  status: "idle" | "organizing" | "moving" | "deleting";
  lockedBy: string | null; // sagaId
  lockedAt: Date | null;
}

export class SemanticLock {
  async acquire(bookmarkIds: string[], sagaId: string): Promise<boolean> {
    // 使用数据库事务获取锁
    const result = await db.transaction(async (tx) => {
      // 检查是否有其他操作锁定
      const locked = await tx.query(
        `
        SELECT id FROM bookmarks
        WHERE id = ANY($1) AND status != 'idle'
      `,
        [bookmarkIds],
      );

      if (locked.rows.length > 0) {
        return false;
      }

      // 获取锁
      await tx.query(
        `
        UPDATE bookmarks
        SET status = 'organizing', locked_by = $1, locked_at = NOW()
        WHERE id = ANY($2)
      `,
        [sagaId, bookmarkIds],
      );

      return true;
    });

    return result;
  }

  async release(bookmarkIds: string[], sagaId: string): Promise<void> {
    await db.query(
      `
      UPDATE bookmarks
      SET status = 'idle', locked_by = NULL, locked_at = NULL
      WHERE id = ANY($1) AND locked_by = $2
    `,
      [bookmarkIds, sagaId],
    );
  }
}
```

---

## 4.2 方案执行引擎

### 操作类型定义

```typescript
type OperationType = "move" | "tag" | "merge" | "archive" | "delete";

interface BaseOperation {
  id: string;
  type: OperationType;
  targets: string[];
  status: "pending" | "executing" | "completed" | "failed" | "compensated";
}

interface MoveOperation extends BaseOperation {
  type: "move";
  params: {
    targetFolderId: string;
  };
}

interface TagOperation extends BaseOperation {
  type: "tag";
  params: {
    addTags: string[];
    removeTags: string[];
  };
}

interface MergeOperation extends BaseOperation {
  type: "merge";
  params: {
    primaryId: string; // 保留的书签
    duplicateIds: string[]; // 合并后删除的书签
    mergeStrategy: "keep_newest" | "keep_most_complete" | "manual";
  };
}

interface ArchiveOperation extends BaseOperation {
  type: "archive";
  params: {
    reason?: string;
  };
}

interface DeleteOperation extends BaseOperation {
  type: "delete";
  params: {
    permanent: boolean;
  };
}

type OrganizeOperation =
  | MoveOperation
  | TagOperation
  | MergeOperation
  | ArchiveOperation
  | DeleteOperation;
```

### 操作执行器

```typescript
interface OperationExecutor {
  execute(operation: OrganizeOperation): Promise<OperationResult>;
  compensate(
    operation: OrganizeOperation,
    snapshot: OperationSnapshot,
  ): Promise<void>;
  estimate(operation: OrganizeOperation): OperationEstimate;
}

interface OperationResult {
  operationId: string;
  success: boolean;
  affectedCount: number;
  error?: string;
  duration: number;
}

interface OperationEstimate {
  duration: number; // 预估耗时（毫秒）
  affectedCount: number; // 影响书签数
  riskLevel: "low" | "medium" | "high";
  warnings: string[];
}

export class MoveExecutor implements OperationExecutor {
  async execute(operation: MoveOperation): Promise<OperationResult> {
    const startTime = Date.now();

    try {
      // 检查目标文件夹存在
      const folder = await db.folders.findById(operation.params.targetFolderId);
      if (!folder) {
        throw new Error("目标文件夹不存在");
      }

      // 批量移动
      await db.bookmarks.updateMany(
        { id: { in: operation.targets } },
        { folderId: operation.params.targetFolderId },
      );

      return {
        operationId: operation.id,
        success: true,
        affectedCount: operation.targets.length,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        operationId: operation.id,
        success: false,
        affectedCount: 0,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  async compensate(
    operation: MoveOperation,
    snapshot: OperationSnapshot,
  ): Promise<void> {
    // 恢复原始文件夹
    for (const state of snapshot.beforeState) {
      await db.bookmarks.update({ id: state.id }, { folderId: state.folderId });
    }
  }

  estimate(operation: MoveOperation): OperationEstimate {
    return {
      duration: operation.targets.length * 10, // 10ms per bookmark
      affectedCount: operation.targets.length,
      riskLevel: "low",
      warnings: [],
    };
  }
}

export class DeleteExecutor implements OperationExecutor {
  async execute(operation: DeleteOperation): Promise<OperationResult> {
    const startTime = Date.now();

    try {
      if (operation.params.permanent) {
        // 永久删除
        await db.bookmarks.deleteMany({
          id: { in: operation.targets },
        });
      } else {
        // 软删除（移到回收站）
        await db.bookmarks.updateMany(
          { id: { in: operation.targets } },
          { deletedAt: new Date(), status: "deleted" },
        );
      }

      return {
        operationId: operation.id,
        success: true,
        affectedCount: operation.targets.length,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        operationId: operation.id,
        success: false,
        affectedCount: 0,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  async compensate(
    operation: DeleteOperation,
    snapshot: OperationSnapshot,
  ): Promise<void> {
    if (operation.params.permanent) {
      // 永久删除无法恢复，需要从快照重建
      for (const state of snapshot.beforeState) {
        await db.bookmarks.create(state);
      }
    } else {
      // 软删除可恢复
      await db.bookmarks.updateMany(
        { id: { in: operation.targets } },
        { deletedAt: null, status: "active" },
      );
    }
  }

  estimate(operation: DeleteOperation): OperationEstimate {
    const warnings: string[] = [];
    let riskLevel: "low" | "medium" | "high" = "low";

    if (operation.params.permanent) {
      warnings.push("永久删除无法恢复，请确认");
      riskLevel = "high";
    }

    if (operation.targets.length > 50) {
      warnings.push(`将删除 ${operation.targets.length} 条书签`);
      riskLevel = operation.params.permanent ? "high" : "medium";
    }

    return {
      duration: operation.targets.length * 5,
      affectedCount: operation.targets.length,
      riskLevel,
      warnings,
    };
  }
}
```

### 执行器工厂

```typescript
export class ExecutorFactory {
  private executors: Map<OperationType, OperationExecutor> = new Map();

  constructor() {
    this.executors.set("move", new MoveExecutor());
    this.executors.set("tag", new TagExecutor());
    this.executors.set("merge", new MergeExecutor());
    this.executors.set("archive", new ArchiveExecutor());
    this.executors.set("delete", new DeleteExecutor());
  }

  get(type: OperationType): OperationExecutor {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new Error(`Unknown operation type: ${type}`);
    }
    return executor;
  }
}
```

---

## 4.3 整理确认 UI 设计

### 确认对话框设计

参考 Notion、Linear 等产品的确认流程设计：

```tsx
interface OrganizePlanConfirmProps {
  plan: OrganizePlan;
  estimates: OperationEstimate[];
  onConfirm: () => void;
  onModify: (modifiedPlan: OrganizePlan) => void;
  onCancel: () => void;
}

export function OrganizePlanConfirm({
  plan,
  estimates,
  onConfirm,
  onModify,
  onCancel,
}: OrganizePlanConfirmProps) {
  const totalAffected = estimates.reduce((sum, e) => sum + e.affectedCount, 0);
  const totalDuration = estimates.reduce((sum, e) => sum + e.duration, 0);
  const highRiskCount = estimates.filter((e) => e.riskLevel === "high").length;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            确认整理方案
          </DialogTitle>
          <DialogDescription>
            以下操作将影响 {totalAffected} 条书签
          </DialogDescription>
        </DialogHeader>

        {/* 操作列表 */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {plan.operations.map((op, index) => (
            <OperationItem
              key={op.id}
              operation={op}
              estimate={estimates[index]}
              onRemove={() => {
                const modified = {
                  ...plan,
                  operations: plan.operations.filter((o) => o.id !== op.id),
                };
                onModify(modified);
              }}
            />
          ))}
        </div>

        {/* 警告信息 */}
        {highRiskCount > 0 && (
          <Alert variant="warning" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              有 {highRiskCount} 个高风险操作，请仔细确认
            </AlertDescription>
          </Alert>
        )}

        {/* 底部信息 */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            预计耗时：{formatDuration(totalDuration)}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              取消
            </Button>
            <Button onClick={onConfirm}>确认执行</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OperationItem({
  operation,
  estimate,
  onRemove,
}: {
  operation: OrganizeOperation;
  estimate: OperationEstimate;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between p-3 rounded-lg border",
        estimate.riskLevel === "high" &&
          "border-destructive/50 bg-destructive/5",
      )}
    >
      <div className="flex items-start gap-3">
        <OperationIcon type={operation.type} />
        <div>
          <div className="font-medium">{getOperationLabel(operation)}</div>
          <div className="text-sm text-muted-foreground">
            影响 {estimate.affectedCount} 条书签
          </div>
          {estimate.warnings.map((warning, i) => (
            <div key={i} className="text-sm text-orange-600 mt-1">
              ⚠️ {warning}
            </div>
          ))}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

### 执行进度展示

```tsx
interface OrganizeProgressProps {
  plan: OrganizePlan;
  currentOperation: number;
  results: OperationResult[];
  onCancel: () => void;
}

export function OrganizeProgress({
  plan,
  currentOperation,
  results,
  onCancel,
}: OrganizeProgressProps) {
  const progress = (currentOperation / plan.operations.length) * 100;
  const hasError = results.some((r) => !r.success);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">执行中...</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          取消
        </Button>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="text-sm text-muted-foreground text-center">
        {currentOperation} / {plan.operations.length} 完成
      </div>

      {/* 操作状态列表 */}
      <div className="space-y-2">
        {plan.operations.map((op, index) => {
          const result = results[index];
          let status: "pending" | "running" | "success" | "error" = "pending";

          if (index < currentOperation) {
            status = result?.success ? "success" : "error";
          } else if (index === currentOperation) {
            status = "running";
          }

          return (
            <div key={op.id} className="flex items-center gap-2 text-sm">
              <StatusIcon status={status} />
              <span
                className={cn(status === "pending" && "text-muted-foreground")}
              >
                {getOperationLabel(op)}
              </span>
            </div>
          );
        })}
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>部分操作失败，可点击"撤销"恢复</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

### 结果报告与撤销

```tsx
interface OrganizeReportProps {
  plan: OrganizePlan;
  results: OperationResult[];
  onUndo: () => void;
  onClose: () => void;
}

export function OrganizeReport({
  plan,
  results,
  onUndo,
  onClose,
}: OrganizeReportProps) {
  const successCount = results.filter((r) => r.success).length;
  const totalAffected = results.reduce((sum, r) => sum + r.affectedCount, 0);
  const allSuccess = successCount === results.length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        {allSuccess ? (
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        ) : (
          <AlertCircle className="h-8 w-8 text-orange-500" />
        )}
        <div>
          <h3 className="font-semibold text-lg">
            {allSuccess ? "整理完成" : "部分完成"}
          </h3>
          <p className="text-sm text-muted-foreground">
            成功执行 {successCount}/{results.length} 个操作， 共处理{" "}
            {totalAffected} 条书签
          </p>
        </div>
      </div>

      {/* 详细结果 */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        {results.map((result, index) => (
          <div
            key={result.operationId}
            className="flex items-center gap-2 text-sm"
          >
            {result.success ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <X className="h-4 w-4 text-destructive" />
            )}
            <span>{getOperationLabel(plan.operations[index])}</span>
            {!result.success && (
              <span className="text-destructive">({result.error})</span>
            )}
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onUndo} className="gap-2">
          <Undo2 className="h-4 w-4" />
          撤销全部操作
        </Button>
        <Button onClick={onClose}>完成</Button>
      </div>

      {/* 撤销提示 */}
      <p className="text-xs text-muted-foreground text-center">
        可在 24 小时内撤销此次操作
      </p>
    </div>
  );
}
```

---

## 5.1 知识萃取服务

> **来源**: V3 计划 Batch 5 (知识萃取)
> **核心能力**: 从 N 篇收藏中总结归纳萃取知识

### 萃取流程设计

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

### KnowledgeExtractor 核心实现

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

### 验收标准

| 测试用例                 | 预期行为                     | 优先级 |
| ------------------------ | ---------------------------- | ------ |
| "帮我总结最近的 AI 文章" | 正确识别为萃取意图，不是整理 | P0     |
| 萃取结果有来源标注       | 每个要点标明出处             | P0     |
| 支持导出                 | Markdown 格式导出            | P1     |
| 结构化输出               | 概念、要点、建议分层         | P1     |

---

## 验证脚本参考

### 查询解析验证

```typescript
// scripts/validate-query-parser.ts

interface QueryTestCase {
  input: string;
  expected: {
    hasTimeRange: boolean;
    platforms?: string[];
    keywordsContain?: string[];
  };
  description: string;
}

const TEST_CASES: QueryTestCase[] = [
  {
    input: "上周的AI文章",
    expected: { hasTimeRange: true, keywordsContain: ["AI", "文章"] },
    description: "时间范围 + 关键词",
  },
  {
    input: "最近3天收藏的微信公众号",
    expected: { hasTimeRange: true, platforms: ["wechat"] },
    description: "相对时间 + 平台",
  },
  {
    input: "找一下那篇讲深度学习的",
    expected: { hasTimeRange: false, keywordsContain: ["深度学习"] },
    description: "模糊搜索",
  },
  {
    input: "B站收藏的视频",
    expected: { hasTimeRange: false, platforms: ["bilibili"] },
    description: "平台筛选",
  },
];

async function validateQueryParser() {
  const parser = new QueryParser();
  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    const result = parser.parse(testCase.input);
    let success = true;

    // 验证时间范围
    if (testCase.expected.hasTimeRange !== !!result.timeRange) {
      success = false;
    }

    // 验证平台
    if (testCase.expected.platforms) {
      const platformsMatch = testCase.expected.platforms.every((p) =>
        result.platforms.includes(p),
      );
      if (!platformsMatch) success = false;
    }

    // 验证关键词
    if (testCase.expected.keywordsContain) {
      const keywordsMatch = testCase.expected.keywordsContain.every((k) =>
        result.keywords.some((rk) => rk.includes(k)),
      );
      if (!keywordsMatch) success = false;
    }

    if (success) {
      passed++;
      console.log(`✅ ${testCase.description}: ${testCase.input}`);
    } else {
      failed++;
      console.log(`❌ ${testCase.description}: ${testCase.input}`);
      console.log(`   Expected:`, testCase.expected);
      console.log(`   Got:`, result);
    }
  }

  console.log(`\nResults: ${passed}/${passed + failed} passed`);

  if (passed / (passed + failed) < 0.9) {
    process.exit(1);
  }
}
```

### Saga 执行验证

```typescript
// scripts/validate-saga.ts

async function validateSaga() {
  const saga = createOrganizeSaga();

  // 测试正常执行
  console.log("Testing normal execution...");
  const context: OrganizeSagaContext = {
    userId: "test-user",
    bookmarkIds: ["bm1", "bm2", "bm3"],
    plan: mockPlan,
    snapshots: [],
    results: [],
  };

  await saga.execute(context);
  assert(context.results.length === mockPlan.operations.length);
  console.log("✅ Normal execution passed");

  // 测试失败回滚
  console.log("Testing failure compensation...");
  const failingSaga = createOrganizeSaga();
  // 注入失败点
  try {
    await failingSaga.execute(failingContext);
  } catch (error) {
    // 验证补偿被执行
    assert(failingContext.snapshots.length === 0); // 快照应被清理
    console.log("✅ Compensation passed");
  }
}
```

---

## 参考资料

1. [chrono-node - Natural Language Date Parser](https://github.com/wanasit/chrono)
2. [VectorChord-BM25 - PostgreSQL BM25 Search](https://blog.vectorchord.ai/vectorchord-bm25-revolutionize-postgresql-search-with-bm25-ranking-3x-faster-than-elasticsearch)
3. [pg_textsearch - Hybrid Retrieval in Postgres](https://www.tigerdata.com/blog/introducing-pg_textsearch-true-bm25-ranking-hybrid-retrieval-postgres)
4. [ParadeDB - Hybrid Search Manual](https://www.paradedb.com/blog/hybrid-search-in-postgresql-the-missing-manual)
5. [Microsoft Azure - Saga Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga)
6. [Microservices.io - Saga Pattern](https://microservices.io/patterns/data/saga.html)
7. [Temporal - Compensating Actions with Sagas](https://temporal.io/blog/compensating-actions-part-of-a-complete-breakfast-with-sagas)
8. [The Saga Pattern with TypeScript](https://kisztof.medium.com/the-saga-pattern-unleashed-a-deep-dive-into-distributed-transactions-with-typescript-f7ee55d53e2d)
