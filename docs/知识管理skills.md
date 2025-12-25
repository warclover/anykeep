# AnyKeep 知识管理 Skills 设计文档

> **版本**: 1.0.0
> **日期**: 2025-12-24
> **状态**: 待审核
> **依赖**: AI能力升级方案 - Skills架构设计.md

---

## 目录

1. [概述](#1-概述)
2. [P0 Skills 详细设计](#2-p0-skills-详细设计)
3. [P1 Skills 详细设计](#3-p1-skills-详细设计)
4. [P2 Skills 详细设计](#4-p2-skills-详细设计)
5. [共享基础设施](#5-共享基础设施)
6. [实现路线图](#6-实现路线图)
7. [验收标准](#7-验收标准)

---

## 1. 概述

### 1.1 设计目标

基于现有 80+ Tools 和 Skills 架构，设计 9 个知识管理专项 Skills，解决用户知识管理的核心痛点：

| 痛点       | 解决方案                  | 对应 Skill          |
| ---------- | ------------------------- | ------------------- |
| 收藏后遗忘 | 间隔复习提醒 + 智能回顾   | `knowledge_review`  |
| 重复收藏   | 自动去重 + 过期检测       | `duplicate_cleanup` |
| 信息过载   | 一键摘要 + 要点提取       | `quick_digest`      |
| 标签混乱   | AI 标签推荐 + 标签规范化  | `smart_tagging`     |
| 没时间阅读 | 碎片时间规划 + 优先级排序 | `reading_planner`   |
| 孤立知识点 | 关联发现 + 知识串联       | `related_discovery` |
| 无法量化   | 周期报告 + 趋势分析       | `periodic_report`   |
| 学习无路径 | 领域学习路径生成          | `learning_path`     |
| 难以分享   | 专题打包 + 一键分享       | `share_bundle`      |

### 1.2 优先级划分

```
P0 (立即实现 - 1.5周)           P1 (次优先 - 2周)           P2 (后续 - 1.5周)
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│ knowledge_review   │     │ smart_tagging      │     │ periodic_report    │
│ duplicate_cleanup  │     │ reading_planner    │     │ learning_path      │
│ quick_digest       │     │ related_discovery  │     │ share_bundle       │
└────────────────────┘     └────────────────────┘     └────────────────────┘
```

### 1.3 依赖的现有 Tools

| Tool 分类     | 数量 | 关键 Tools                                 |
| ------------- | ---- | ------------------------------------------ |
| Query         | 10   | `get_stats`, `list_bookmarks`, `count_*`   |
| Search        | 2    | `semantic_search`, `search`                |
| Read          | 2    | `read_bookmark`                            |
| Folder        | 18   | `list_folders`, `get_folder_bookmarks`     |
| Bookmark      | 8    | `update_bookmark`, `toggle_*`              |
| Export        | 3    | `export_bookmarks`, `preview_export`       |
| Action        | 3    | `batch_tags`, `move_bookmarks`             |
| Smart List    | 8    | `create_smart_list`, `list_smart_lists`    |
| MD Collection | 8    | `list_md_collections`, `get_md_collection` |

---

## 2. P0 Skills 详细设计

### 2.1 知识回顾助手 `knowledge_review`

#### 2.1.1 功能概述

```yaml
名称: 知识回顾助手
ID: knowledge_review
描述: 基于艾宾浩斯遗忘曲线和间隔重复原理，帮助用户回顾重要收藏，巩固知识记忆
价值主张: "收藏不再遗忘，知识真正内化"
```

#### 2.1.2 触发意图

```typescript
const INTENTS = [
  "帮我复习一下收藏",
  "我想回顾学习资料",
  "有什么值得重温的",
  "该复习什么了",
  "回顾一下最近收藏",
  "巩固知识点",
];

const EXAMPLES = [
  "帮我回顾一下上周收藏的 React 文章",
  "我想复习面试相关的内容",
  "有哪些收藏该复习了",
  "推荐一些值得重温的好文章",
];
```

#### 2.1.3 执行流程

```
┌─────────────────────────────────────────────────────────────┐
│                    knowledge_review 执行流程                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 参数解析                                                │
│     ├── 时间范围: 今天 / 本周 / 本月 / 自定义               │
│     ├── 主题筛选: 文件夹 / 标签 / 关键词                    │
│     └── 回顾模式: 快速浏览 / 深度复习 / 测试模式            │
│                                                             │
│  2. 候选筛选                                                │
│     ├── 获取符合条件的书签                                  │
│     ├── 计算回顾优先级得分                                  │
│     └── 排除最近已回顾的内容                                │
│                                                             │
│  3. 智能排序                                                │
│     ├── 遗忘曲线权重 (距上次阅读时间)                       │
│     ├── 重要性权重 (是否标星、阅读次数)                     │
│     ├── 相关性权重 (与当前兴趣的匹配度)                     │
│     └── 多样性调整 (避免同一主题连续出现)                   │
│                                                             │
│  4. 内容生成                                                │
│     ├── 生成回顾卡片 (标题、摘要、关键点)                   │
│     ├── 关联推荐 (相似内容串联)                             │
│     └── 复习问题 (测试模式下)                               │
│                                                             │
│  5. 交付输出                                                │
│     ├── 回顾清单 (带优先级)                                 │
│     ├── 知识串联图                                          │
│     └── 后续建议                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2.1.4 技术实现

```typescript
// src/lib/ai-agent/skills/knowledge/knowledge-review.skill.ts

import { BaseSkill, SkillContext, SkillResult } from "../base-skill";
import { ReviewPriorityCalculator } from "./utils/review-priority";
import { ForgettingCurve } from "./utils/forgetting-curve";

interface ReviewParams {
  timeRange: "today" | "week" | "month" | "custom";
  customDateRange?: { start: Date; end: Date };
  topic?: string;
  folderId?: string;
  tags?: string[];
  mode: "quick" | "deep" | "quiz";
  limit: number;
}

interface ReviewItem {
  bookmark: Bookmark;
  priority: number;
  dueReason: string;
  keyPoints: string[];
  relatedIds: number[];
}

export class KnowledgeReviewSkill extends BaseSkill {
  id = "knowledge_review";
  name = "知识回顾助手";
  description = "基于遗忘曲线智能推荐需要复习的收藏内容";

  intents = ["回顾", "复习", "重温", "巩固", "温习"];
  requiredTools = [
    "list_bookmarks",
    "get_stats",
    "semantic_search",
    "read_bookmark",
    "toggle_bookmark_read",
  ];

  async execute(context: SkillContext): Promise<SkillResult> {
    // Step 1: 解析参数
    this.reportProgress("解析回顾需求...", 5);
    const params = await this.parseParams(context);

    // Step 2: 获取候选书签
    this.reportProgress("筛选候选内容...", 15);
    const candidates = await this.getCandidates(params, context);

    if (candidates.length === 0) {
      return {
        success: true,
        summary: "当前没有需要回顾的内容，继续保持学习！",
        nextSuggestions: ["添加新收藏", "浏览最近收藏"],
      };
    }

    // Step 3: 计算优先级
    this.reportProgress("计算回顾优先级...", 35);
    const prioritized = await this.calculatePriorities(candidates, context);

    // Step 4: 生成回顾内容
    this.reportProgress("生成回顾卡片...", 60);
    const reviewItems = await this.generateReviewItems(
      prioritized.slice(0, params.limit),
      params.mode,
      context,
    );

    // Step 5: 生成交付物
    this.reportProgress("准备回顾清单...", 85);
    const deliverable = await this.generateDeliverable(reviewItems, params);

    // Step 6: 更新回顾记录
    await this.updateReviewRecords(reviewItems, context);

    return {
      success: true,
      deliverable,
      summary: `为您准备了 ${reviewItems.length} 条需要回顾的内容`,
      nextSuggestions: [
        "开始回顾",
        "调整回顾范围",
        "导出回顾清单",
        "设置定期回顾提醒",
      ],
    };
  }

  private async getCandidates(
    params: ReviewParams,
    context: SkillContext,
  ): Promise<Bookmark[]> {
    // 构建查询条件
    const query: ListBookmarksParams = {
      limit: 200, // 先获取较多候选
      orderBy: "created_at",
      order: "desc",
    };

    // 时间范围筛选
    if (params.timeRange !== "custom") {
      const ranges = {
        today: 1,
        week: 7,
        month: 30,
      };
      query.daysAgo = ranges[params.timeRange];
    } else if (params.customDateRange) {
      query.startDate = params.customDateRange.start;
      query.endDate = params.customDateRange.end;
    }

    // 主题/文件夹筛选
    if (params.folderId) {
      query.folderId = params.folderId;
    }
    if (params.tags?.length) {
      query.tags = params.tags;
    }

    const result = await this.executeTool("list_bookmarks", query, context);
    return result.data || [];
  }

  private async calculatePriorities(
    bookmarks: Bookmark[],
    context: SkillContext,
  ): Promise<Array<Bookmark & { priority: number; dueReason: string }>> {
    const calculator = new ReviewPriorityCalculator();
    const curve = new ForgettingCurve();

    const scored = bookmarks.map((bookmark) => {
      // 基于遗忘曲线计算回顾紧迫度
      const forgettingScore = curve.calculate(
        bookmark.last_read_at || bookmark.created_at,
        bookmark.read_count || 0,
      );

      // 重要性得分
      const importanceScore = calculator.calculateImportance({
        isStarred: bookmark.is_starred,
        readCount: bookmark.read_count || 0,
        hasNotes: !!bookmark.notes,
        folderDepth: bookmark.folder_depth || 0,
      });

      // 综合得分
      const priority = forgettingScore * 0.6 + importanceScore * 0.4;

      // 确定回顾原因
      const dueReason = this.getDueReason(
        forgettingScore,
        importanceScore,
        bookmark,
      );

      return { ...bookmark, priority, dueReason };
    });

    // 按优先级排序并添加多样性调整
    return this.diversifyResults(
      scored.sort((a, b) => b.priority - a.priority),
    );
  }

  private getDueReason(
    forgettingScore: number,
    importanceScore: number,
    bookmark: Bookmark,
  ): string {
    if (forgettingScore > 0.8) {
      return "距上次阅读较久，建议复习巩固";
    }
    if (importanceScore > 0.8 && bookmark.is_starred) {
      return "重要收藏，值得深入回顾";
    }
    if (bookmark.read_count === 1) {
      return "只读过一次，需要二次巩固";
    }
    return "根据学习曲线推荐回顾";
  }

  private async generateReviewItems(
    bookmarks: Array<Bookmark & { priority: number; dueReason: string }>,
    mode: "quick" | "deep" | "quiz",
    context: SkillContext,
  ): Promise<ReviewItem[]> {
    const items: ReviewItem[] = [];

    for (const bookmark of bookmarks) {
      // 读取完整内容
      const content = await this.executeTool(
        "read_bookmark",
        { bookmarkId: bookmark.id },
        context,
      );

      // 生成关键点摘要
      const keyPoints = await this.extractKeyPoints(content.data, mode);

      // 查找相关内容
      const related = await this.findRelatedContent(bookmark, context);

      items.push({
        bookmark,
        priority: bookmark.priority,
        dueReason: bookmark.dueReason,
        keyPoints,
        relatedIds: related.map((r) => r.id),
      });
    }

    return items;
  }

  private async extractKeyPoints(
    content: BookmarkContent,
    mode: string,
  ): Promise<string[]> {
    const prompt =
      mode === "quick"
        ? `提取这篇文章的 3 个核心要点，每点不超过 20 字：\n${content.summary || content.title}`
        : `深度分析这篇文章，提取 5-7 个关键知识点：\n${content.content || content.summary}`;

    const result = await this.llm.generate(prompt);
    return this.parseKeyPoints(result);
  }
}
```

#### 2.1.5 数据模型扩展

```sql
-- 回顾记录表 (新增)
CREATE TABLE review_records (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  review_mode TEXT NOT NULL CHECK (review_mode IN ('quick', 'deep', 'quiz')),
  retention_score DECIMAL(3,2), -- 0-1 的记忆保持度评分
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, bookmark_id, reviewed_at::date) -- 每天每书签最多一条记录
);

-- 书签表扩展字段
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS read_count INTEGER DEFAULT 0;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS last_review_at TIMESTAMPTZ;
```

#### 2.1.6 UI 组件

```typescript
// src/components/ai/skills/knowledge-review/
├── ReviewCard.tsx          // 回顾卡片组件
├── ReviewList.tsx          // 回顾清单列表
├── ReviewProgress.tsx      // 回顾进度环
├── KeyPointHighlight.tsx   // 关键点高亮展示
├── QuizMode.tsx            // 测试模式组件
└── ReviewSettings.tsx      // 回顾设置面板
```

**ReviewCard 设计稿:**

```
┌─────────────────────────────────────────────────────────────┐
│  📖 知识回顾                                    [⚙️] [✕]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1 / 8                                              │   │
│  │                                                     │   │
│  │  🔥 React 18 并发特性深度解析                        │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │   │
│  │                                                     │   │
│  │  📌 关键要点:                                       │   │
│  │  • Concurrent Mode 允许渲染可中断                    │   │
│  │  • useTransition 用于非紧急状态更新                  │   │
│  │  • useDeferredValue 延迟低优先级更新                 │   │
│  │                                                     │   │
│  │  💡 回顾原因: 距上次阅读 14 天，建议复习巩固          │   │
│  │                                                     │   │
│  │  🔗 相关内容: React Hooks 进阶、状态管理对比         │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [◀ 上一条]  [已掌握 ✓]  [稍后复习]  [查看原文]  [下一条 ▶]  │
│                                                             │
│  ════════════════════════════════════════════════════════  │
│  回顾进度: ████████░░░░░░░░░░░░  4/8 完成                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2.1.7 交互示例

```
用户: 帮我复习一下最近的前端收藏

AI: 好的，我来为你准备前端相关的回顾内容。

    📊 分析完成：
    • 过去 30 天收藏了 47 篇前端文章
    • 其中 23 篇还未二次阅读
    • 8 篇重要收藏距上次阅读超过 2 周

    🎯 为你筛选了 8 篇最需要回顾的内容：

    1. ⭐ React 18 并发特性深度解析
       距上次阅读 14 天 · 重要收藏

    2. 🔥 TypeScript 5.0 新特性速览
       只读过 1 次 · 建议二次巩固

    3. 📚 前端性能优化完全指南
       距上次阅读 21 天 · 系统学习

    ... (显示更多)

    选择回顾模式：
    [快速浏览] [深度复习] [测试模式]
```

---

### 2.2 重复与过期清理 `duplicate_cleanup`

#### 2.2.1 功能概述

```yaml
名称: 重复与过期清理助手
ID: duplicate_cleanup
描述: 自动检测重复收藏和过期内容，提供智能清理建议
价值主张: "保持收藏库精简高效，告别信息冗余"
```

#### 2.2.2 触发意图

```typescript
const INTENTS = [
  "清理重复收藏",
  "检查过期内容",
  "去重",
  "有没有重复的",
  "清理无效链接",
  "整理冗余内容",
];
```

#### 2.2.3 执行流程

```
┌─────────────────────────────────────────────────────────────┐
│                   duplicate_cleanup 执行流程                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 全量扫描                                                │
│     ├── URL 完全匹配检测                                    │
│     ├── 标题相似度检测 (Levenshtein + 语义)                 │
│     └── 内容相似度检测 (Embedding 余弦相似度)               │
│                                                             │
│  2. 过期检测                                                │
│     ├── 链接有效性验证 (HEAD 请求)                          │
│     ├── 内容时效性分析 (年份、版本号)                       │
│     └── 404/无法访问标记                                    │
│                                                             │
│  3. 智能分组                                                │
│     ├── 完全重复组 (同 URL)                                 │
│     ├── 高度相似组 (相似度 > 0.85)                          │
│     ├── 可能相关组 (相似度 0.6-0.85)                        │
│     └── 过期/失效组                                         │
│                                                             │
│  4. 清理建议                                                │
│     ├── 保留推荐 (评估: 标星、笔记、阅读次数)               │
│     ├── 删除建议 (带理由)                                   │
│     └── 合并建议 (多版本合并为一)                           │
│                                                             │
│  5. 用户确认 & 执行                                         │
│     ├── 预览清理结果                                        │
│     ├── 支持逐条确认或批量确认                              │
│     └── 执行删除/归档操作                                   │
│                                                             │
│  6. 清理报告                                                │
│     ├── 清理统计 (删除数、释放空间)                         │
│     ├── 操作日志                                            │
│     └── 后续建议                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2.4 技术实现

```typescript
// src/lib/ai-agent/skills/cleanup/duplicate-cleanup.skill.ts

interface DuplicateGroup {
  type: "exact_url" | "similar_title" | "similar_content";
  similarity: number;
  items: Bookmark[];
  recommended: Bookmark; // 推荐保留的
  toDelete: Bookmark[]; // 建议删除的
  reason: string;
}

interface ExpiredItem {
  bookmark: Bookmark;
  reason: "broken_link" | "outdated_content" | "deprecated_version";
  details: string;
  suggestion: "delete" | "archive" | "update";
}

interface CleanupReport {
  duplicateGroups: DuplicateGroup[];
  expiredItems: ExpiredItem[];
  totalDuplicates: number;
  totalExpired: number;
  estimatedSavings: string; // 预计释放空间
}

export class DuplicateCleanupSkill extends BaseSkill {
  id = "duplicate_cleanup";
  name = "重复与过期清理助手";

  requiredTools = [
    "list_bookmarks",
    "semantic_search",
    "delete_bookmark",
    "batch_delete_bookmarks",
    "update_bookmark",
  ];

  async execute(context: SkillContext): Promise<SkillResult> {
    // Step 1: 扫描重复
    this.reportProgress("扫描重复内容...", 10);
    const duplicates = await this.scanDuplicates(context);

    // Step 2: 检测过期
    this.reportProgress("检测过期内容...", 40);
    const expired = await this.scanExpired(context);

    if (duplicates.length === 0 && expired.length === 0) {
      return {
        success: true,
        summary: "太棒了！你的收藏库非常整洁，没有发现重复或过期内容。",
        nextSuggestions: ["查看收藏统计", "开始新的整理"],
      };
    }

    // Step 3: 生成清理建议
    this.reportProgress("生成清理建议...", 60);
    const report = await this.generateReport(duplicates, expired);

    // Step 4: 用户确认
    const confirmed = await this.confirmWithUser(report);

    if (!confirmed.proceed) {
      return {
        success: true,
        summary: "已取消清理操作",
        deliverable: { type: "report", data: report },
      };
    }

    // Step 5: 执行清理
    this.reportProgress("执行清理操作...", 80);
    const results = await this.executeCleanup(confirmed.selections, context);

    // Step 6: 生成报告
    this.reportProgress("生成清理报告...", 95);

    return {
      success: true,
      deliverable: {
        type: "cleanup_report",
        data: {
          ...report,
          executed: results,
        },
      },
      summary: `清理完成：删除 ${results.deleted} 条重复，归档 ${results.archived} 条过期`,
      nextSuggestions: ["查看清理报告", "恢复已删除内容", "设置自动清理规则"],
    };
  }

  private async scanDuplicates(
    context: SkillContext,
  ): Promise<DuplicateGroup[]> {
    const groups: DuplicateGroup[] = [];

    // 获取所有书签
    const bookmarks = await this.getAllBookmarks(context);

    // 1. URL 完全匹配检测
    const urlGroups = this.groupByExactUrl(bookmarks);
    groups.push(...urlGroups.filter((g) => g.items.length > 1));

    // 2. 标题相似度检测
    const titleGroups = await this.groupBySimilarTitle(bookmarks);
    groups.push(...titleGroups);

    // 3. 内容相似度检测 (使用 embedding)
    const contentGroups = await this.groupBySimilarContent(bookmarks, context);
    groups.push(...contentGroups);

    // 去除已在其他组中的重复
    return this.deduplicateGroups(groups);
  }

  private groupByExactUrl(bookmarks: Bookmark[]): DuplicateGroup[] {
    const urlMap = new Map<string, Bookmark[]>();

    for (const bookmark of bookmarks) {
      const normalizedUrl = this.normalizeUrl(bookmark.url);
      const group = urlMap.get(normalizedUrl) || [];
      group.push(bookmark);
      urlMap.set(normalizedUrl, group);
    }

    return Array.from(urlMap.values())
      .filter((group) => group.length > 1)
      .map((items) => ({
        type: "exact_url" as const,
        similarity: 1.0,
        items,
        recommended: this.selectBestToKeep(items),
        toDelete: items.filter((i) => i !== this.selectBestToKeep(items)),
        reason: "URL 完全相同",
      }));
  }

  private selectBestToKeep(items: Bookmark[]): Bookmark {
    // 评分规则：标星 +10, 有笔记 +5, 阅读次数 +1/次, 最新 +2
    return items.reduce((best, current) => {
      const currentScore = this.calculateKeepScore(current);
      const bestScore = this.calculateKeepScore(best);
      return currentScore > bestScore ? current : best;
    });
  }

  private calculateKeepScore(bookmark: Bookmark): number {
    let score = 0;
    if (bookmark.is_starred) score += 10;
    if (bookmark.notes) score += 5;
    score += bookmark.read_count || 0;
    // 最新的加分
    score += new Date(bookmark.created_at).getTime() / 1e12;
    return score;
  }

  private async scanExpired(context: SkillContext): Promise<ExpiredItem[]> {
    const expired: ExpiredItem[] = [];
    const bookmarks = await this.getAllBookmarks(context);

    // 抽样检测链接有效性 (避免过多请求)
    const sampled = this.sampleForLinkCheck(bookmarks, 100);

    for (const bookmark of sampled) {
      // 检测链接
      const linkStatus = await this.checkLinkValidity(bookmark.url);
      if (!linkStatus.valid) {
        expired.push({
          bookmark,
          reason: "broken_link",
          details: `HTTP ${linkStatus.status}: ${linkStatus.message}`,
          suggestion: linkStatus.status === 404 ? "delete" : "archive",
        });
        continue;
      }

      // 检测内容时效性
      const freshness = this.analyzeContentFreshness(bookmark);
      if (freshness.outdated) {
        expired.push({
          bookmark,
          reason: "outdated_content",
          details: freshness.reason,
          suggestion: "archive",
        });
      }
    }

    return expired;
  }

  private analyzeContentFreshness(bookmark: Bookmark): {
    outdated: boolean;
    reason: string;
  } {
    // 检测标题中的年份
    const yearMatch = bookmark.title.match(/20[12]\d/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0]);
      const currentYear = new Date().getFullYear();
      if (currentYear - year >= 3) {
        return {
          outdated: true,
          reason: `内容来自 ${year} 年，可能已过时`,
        };
      }
    }

    // 检测版本号
    const versionMatch = bookmark.title.match(/v?(\d+)\.(\d+)/);
    if (versionMatch) {
      // 可以对接技术栈版本库进行对比
      // 这里简化处理
    }

    return { outdated: false, reason: "" };
  }
}
```

#### 2.2.5 UI 组件

```typescript
// src/components/ai/skills/duplicate-cleanup/
├── DuplicateGroupCard.tsx    // 重复组展示卡片
├── ExpiredItemCard.tsx       // 过期项展示卡片
├── CleanupPreview.tsx        // 清理预览面板
├── CleanupConfirmDialog.tsx  // 确认对话框
├── CleanupReport.tsx         // 清理报告展示
└── BatchSelectPanel.tsx      // 批量选择面板
```

**清理预览设计稿:**

```
┌─────────────────────────────────────────────────────────────┐
│  🧹 重复与过期清理                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 扫描结果:                                               │
│  ┌─────────────────┐ ┌─────────────────┐                   │
│  │   🔁 重复内容   │ │   ⏰ 过期内容   │                   │
│  │                 │ │                 │                   │
│  │      12 组      │ │      8 条       │                   │
│  │   (23 条可清理) │ │   (建议归档)    │                   │
│  └─────────────────┘ └─────────────────┘                   │
│                                                             │
│  ────────────────────────────────────────────────────────  │
│                                                             │
│  🔁 重复组 1/12                           [全选] [跳过]    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✅ 保留 (推荐)                                       │   │
│  │ ⭐ React Hooks 完全指南 - 2024 版                    │   │
│  │    收藏于 2024-12-01 · 已读 3 次 · 有笔记            │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ☑️ 删除                                              │   │
│  │    React Hooks 完全指南                              │   │
│  │    收藏于 2024-06-15 · 未读 · URL 相同               │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ☑️ 删除                                              │   │
│  │    React Hooks 指南                                  │   │
│  │    收藏于 2024-03-20 · 未读 · 标题相似度 92%         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [◀ 上一组]                                    [下一组 ▶]  │
│                                                             │
│  ════════════════════════════════════════════════════════  │
│  预计清理: 31 条 · 释放空间: ~2.3 MB                        │
│                                                             │
│  [取消]                    [预览报告]    [确认清理 (31)]   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 2.3 快速摘要生成 `quick_digest`

#### 2.3.1 功能概述

```yaml
名称: 快速摘要生成
ID: quick_digest
描述: 批量生成收藏内容摘要，提取核心观点，支持多种输出格式
价值主张: "5 分钟掌握 50 篇文章的精华"
```

#### 2.3.2 触发意图

```typescript
const INTENTS = [
  "帮我总结一下",
  "生成摘要",
  "提取要点",
  "快速了解",
  "概括内容",
  "做个笔记",
];
```

#### 2.3.3 执行流程

```
┌─────────────────────────────────────────────────────────────┐
│                    quick_digest 执行流程                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 范围确定                                                │
│     ├── 单条书签摘要                                        │
│     ├── 文件夹摘要                                          │
│     ├── 标签摘要                                            │
│     ├── 时间范围摘要 (今日/本周/本月新增)                   │
│     └── 自定义筛选摘要                                      │
│                                                             │
│  2. 内容获取                                                │
│     ├── 获取书签元数据                                      │
│     ├── 读取全文内容 (如有)                                 │
│     └── 获取 AI 已生成摘要 (如有)                           │
│                                                             │
│  3. 智能摘要                                                │
│     ├── 单篇摘要: 标题 + 核心观点 + 关键词                  │
│     ├── 聚合摘要: 主题分组 + 共性提炼 + 差异对比            │
│     └── 结构化输出: 大纲 / 思维导图 / Q&A                   │
│                                                             │
│  4. 格式输出                                                │
│     ├── 简洁模式: 每篇 1-2 句话                             │
│     ├── 标准模式: 每篇 3-5 个要点                           │
│     ├── 详细模式: 完整结构化笔记                            │
│     └── 对比模式: 多篇对比分析                              │
│                                                             │
│  5. 交付物                                                  │
│     ├── Markdown 文档                                       │
│     ├── 思维导图 (Markmap 格式)                             │
│     ├── 卡片式展示                                          │
│     └── 导出 (Obsidian / Notion / 本地文件)                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2.3.4 技术实现

```typescript
// src/lib/ai-agent/skills/content/quick-digest.skill.ts

type DigestScope =
  | { type: "single"; bookmarkId: number }
  | { type: "folder"; folderId: string }
  | { type: "tag"; tags: string[] }
  | { type: "timeRange"; range: "today" | "week" | "month" }
  | { type: "custom"; bookmarkIds: number[] };

type DigestMode = "concise" | "standard" | "detailed" | "comparison";

type OutputFormat = "markdown" | "mindmap" | "cards" | "json";

interface DigestResult {
  scope: string;
  totalItems: number;
  digest: DigestContent;
  metadata: {
    generatedAt: Date;
    processingTime: number;
    tokensUsed: number;
  };
}

interface DigestContent {
  title: string;
  overview: string;
  items: DigestItem[];
  themes?: Theme[]; // 聚合摘要时的主题分组
  comparison?: Comparison; // 对比模式
}

interface DigestItem {
  bookmark: BookmarkSummary;
  summary: string;
  keyPoints: string[];
  keywords: string[];
  readTime: string;
}

export class QuickDigestSkill extends BaseSkill {
  id = "quick_digest";
  name = "快速摘要生成";

  requiredTools = [
    "list_bookmarks",
    "list_by_folder",
    "list_by_tags",
    "read_bookmark",
    "export_bookmarks",
  ];

  async execute(context: SkillContext): Promise<SkillResult> {
    // Step 1: 解析范围
    this.reportProgress("解析摘要范围...", 5);
    const { scope, mode, format } = await this.parseParams(context);

    // Step 2: 获取书签
    this.reportProgress("获取目标内容...", 15);
    const bookmarks = await this.getBookmarksByScope(scope, context);

    if (bookmarks.length === 0) {
      return {
        success: false,
        summary: "没有找到符合条件的内容",
      };
    }

    if (bookmarks.length > 50) {
      // 提示用户缩小范围或使用聚合模式
      const confirmed = await this.confirmLargeScope(bookmarks.length);
      if (!confirmed) {
        return { success: false, summary: "已取消" };
      }
    }

    // Step 3: 生成摘要
    this.reportProgress("生成摘要中...", 30);
    const digest = await this.generateDigest(bookmarks, mode, context);

    // Step 4: 格式化输出
    this.reportProgress("格式化输出...", 80);
    const formatted = await this.formatOutput(digest, format);

    // Step 5: 生成交付物
    this.reportProgress("准备交付物...", 95);

    return {
      success: true,
      deliverable: {
        type: "digest",
        format,
        data: formatted,
        downloadable: true,
      },
      summary: `已生成 ${bookmarks.length} 篇内容的摘要`,
      nextSuggestions: [
        "导出为 Markdown",
        "生成思维导图",
        "分享摘要",
        "深入阅读某篇",
      ],
    };
  }

  private async generateDigest(
    bookmarks: Bookmark[],
    mode: DigestMode,
    context: SkillContext,
  ): Promise<DigestContent> {
    // 并行处理单篇摘要
    const items = await Promise.all(
      bookmarks.map((b) => this.generateItemDigest(b, mode, context)),
    );

    // 生成整体概览
    const overview = await this.generateOverview(items, mode);

    // 主题聚类 (标准/详细模式)
    let themes: Theme[] | undefined;
    if (mode !== "concise" && items.length > 5) {
      themes = await this.clusterByTheme(items);
    }

    // 对比分析 (对比模式)
    let comparison: Comparison | undefined;
    if (mode === "comparison") {
      comparison = await this.generateComparison(items);
    }

    return {
      title: this.generateTitle(bookmarks, mode),
      overview,
      items,
      themes,
      comparison,
    };
  }

  private async generateItemDigest(
    bookmark: Bookmark,
    mode: DigestMode,
    context: SkillContext,
  ): Promise<DigestItem> {
    // 尝试读取完整内容
    let content = bookmark.summary || "";
    try {
      const fullContent = await this.executeTool(
        "read_bookmark",
        { bookmarkId: bookmark.id },
        context,
      );
      content = fullContent.data?.content || content;
    } catch {
      // 使用已有摘要
    }

    // 根据模式生成不同详细程度的摘要
    const prompts = {
      concise: `用一句话概括这篇文章的核心内容（不超过 30 字）：\n${content}`,
      standard: `提取这篇文章的 3-5 个关键要点，每点不超过 20 字：\n${content}`,
      detailed: `生成这篇文章的详细笔记，包括：
        1. 核心观点（1-2 句）
        2. 关键要点（5-7 条）
        3. 重要细节或数据
        4. 实践建议（如有）
        文章内容：\n${content}`,
      comparison: `从以下维度分析这篇文章：
        1. 主要观点
        2. 论证方法
        3. 适用场景
        4. 局限性
        文章内容：\n${content}`,
    };

    const result = await this.llm.generate(prompts[mode]);

    return {
      bookmark: {
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        createdAt: bookmark.created_at,
      },
      summary: this.extractSummary(result),
      keyPoints: this.extractKeyPoints(result),
      keywords: this.extractKeywords(result, content),
      readTime: this.estimateReadTime(content),
    };
  }

  private async formatOutput(
    digest: DigestContent,
    format: OutputFormat,
  ): Promise<string | object> {
    switch (format) {
      case "markdown":
        return this.toMarkdown(digest);
      case "mindmap":
        return this.toMindmap(digest);
      case "cards":
        return this.toCards(digest);
      case "json":
        return digest;
      default:
        return this.toMarkdown(digest);
    }
  }

  private toMarkdown(digest: DigestContent): string {
    let md = `# ${digest.title}\n\n`;
    md += `> ${digest.overview}\n\n`;
    md += `---\n\n`;

    if (digest.themes) {
      for (const theme of digest.themes) {
        md += `## ${theme.name}\n\n`;
        for (const item of theme.items) {
          md += `### ${item.bookmark.title}\n`;
          md += `${item.summary}\n\n`;
          md += `**要点：**\n`;
          item.keyPoints.forEach((p) => (md += `- ${p}\n`));
          md += `\n🔗 [原文](${item.bookmark.url})\n\n`;
        }
      }
    } else {
      for (const item of digest.items) {
        md += `## ${item.bookmark.title}\n`;
        md += `${item.summary}\n\n`;
        md += `**要点：**\n`;
        item.keyPoints.forEach((p) => (md += `- ${p}\n`));
        md += `\n🔗 [原文](${item.bookmark.url})\n\n---\n\n`;
      }
    }

    return md;
  }

  private toMindmap(digest: DigestContent): string {
    // 生成 Markmap 格式
    let mm = `# ${digest.title}\n\n`;

    if (digest.themes) {
      for (const theme of digest.themes) {
        mm += `## ${theme.name}\n`;
        for (const item of theme.items) {
          mm += `### ${item.bookmark.title}\n`;
          item.keyPoints.forEach((p) => (mm += `#### ${p}\n`));
        }
      }
    } else {
      for (const item of digest.items) {
        mm += `## ${item.bookmark.title}\n`;
        item.keyPoints.forEach((p) => (mm += `### ${p}\n`));
      }
    }

    return mm;
  }
}
```

#### 2.3.5 UI 组件

```typescript
// src/components/ai/skills/quick-digest/
├── DigestScopeSelector.tsx   // 范围选择器
├── DigestModeSelector.tsx    // 模式选择器
├── DigestPreview.tsx         // 摘要预览
├── DigestCard.tsx            // 单条摘要卡片
├── DigestMindmap.tsx         // 思维导图视图
├── DigestExporter.tsx        // 导出选项
└── ThemeGroupView.tsx        // 主题分组视图
```

**摘要预览设计稿:**

```
┌─────────────────────────────────────────────────────────────┐
│  📝 快速摘要                               [Markdown] [▼]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📚 本周前端收藏摘要 (12 篇)                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                             │
│  > 本周收藏主要涵盖 React 性能优化、TypeScript 进阶和       │
│  > 前端工程化三个主题，其中 React 相关内容占比最高。        │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  🏷️ React 性能优化 (5 篇)                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📄 React 18 并发渲染深度解析                         │   │
│  │                                                     │   │
│  │ 介绍 React 18 的并发特性如何提升用户体验。          │   │
│  │                                                     │   │
│  │ • Concurrent Mode 允许渲染可中断                    │   │
│  │ • useTransition 管理非紧急更新                      │   │
│  │ • Suspense 优化数据加载体验                         │   │
│  │                                                     │   │
│  │ 🏷️ #React #性能优化 #并发                           │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [展开更多...]                                              │
│                                                             │
│  ════════════════════════════════════════════════════════  │
│                                                             │
│  [复制全部]  [导出 Markdown]  [生成思维导图]  [分享]        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. P1 Skills 详细设计

### 3.1 智能标签推荐 `smart_tagging`

#### 3.1.1 功能概述

```yaml
名称: 智能标签推荐
ID: smart_tagging
描述: 基于内容分析和用户历史，智能推荐并批量应用标签，建立一致的标签体系
价值主张: "告别标签混乱，建立个人知识分类体系"
```

#### 3.1.2 核心能力

```
┌─────────────────────────────────────────────────────────────┐
│                    smart_tagging 核心能力                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 标签推荐                                                │
│     ├── 基于内容语义分析推荐新标签                          │
│     ├── 基于用户历史标签习惯推荐                            │
│     └── 基于相似内容的标签迁移                              │
│                                                             │
│  2. 标签规范化                                              │
│     ├── 同义标签合并 (前端/Frontend → 前端开发)             │
│     ├── 层级标签建议 (React → 前端开发/React)               │
│     └── 标签拼写/格式统一                                   │
│                                                             │
│  3. 批量标签                                                │
│     ├── 未标签书签批量建议                                  │
│     ├── 按文件夹批量标签                                    │
│     └── 一键应用推荐标签                                    │
│                                                             │
│  4. 标签治理                                                │
│     ├── 标签使用统计和健康度报告                            │
│     ├── 低使用率标签清理建议                                │
│     └── 标签关系图谱                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 3.1.3 技术实现关键点

```typescript
// src/lib/ai-agent/skills/tagging/smart-tagging.skill.ts

interface TagSuggestion {
  tag: string;
  confidence: number; // 0-1
  source: "content" | "history" | "similar";
  reason: string;
}

interface TagNormalization {
  original: string[];
  normalized: string;
  affected: number; // 影响的书签数
}

export class SmartTaggingSkill extends BaseSkill {
  id = "smart_tagging";
  name = "智能标签推荐";

  requiredTools = [
    "list_bookmarks",
    "batch_tags",
    "semantic_search",
    "read_bookmark",
    "update_bookmark",
  ];

  async suggestTags(
    bookmark: Bookmark,
    context: SkillContext,
  ): Promise<TagSuggestion[]> {
    const suggestions: TagSuggestion[] = [];

    // 1. 基于内容分析
    const contentTags = await this.analyzeContent(bookmark);
    suggestions.push(...contentTags);

    // 2. 基于用户历史
    const historyTags = await this.analyzeHistory(bookmark, context);
    suggestions.push(...historyTags);

    // 3. 基于相似内容
    const similarTags = await this.findSimilarTags(bookmark, context);
    suggestions.push(...similarTags);

    // 去重并排序
    return this.deduplicateAndRank(suggestions);
  }

  async normalizeAllTags(context: SkillContext): Promise<TagNormalization[]> {
    // 获取所有标签及使用统计
    const tagStats = await this.getTagStatistics(context);

    // 使用 LLM 分析标签关系
    const normalizations = await this.analyzeSynonyms(tagStats);

    return normalizations;
  }
}
```

#### 3.1.4 交互示例

```
用户: 帮我整理一下标签

AI: 我来分析你的标签使用情况...

    📊 标签统计：
    • 共 47 个标签
    • 平均每书签 2.3 个标签
    • 18 篇书签无标签

    🔍 发现的问题：

    1. 同义标签 (建议合并):
       • "前端" "Frontend" "front-end" → "前端开发" (23 篇)
       • "JS" "JavaScript" "javascript" → "JavaScript" (15 篇)

    2. 低使用率标签 (仅 1-2 次使用):
       • "临时" "待处理" "收藏" 等 8 个

    3. 无标签书签 (18 篇):
       • 建议添加标签以便检索

    📝 我的建议：
    [合并同义标签] [清理低频标签] [为无标签书签推荐]
```

---

### 3.2 阅读时间规划 `reading_planner`

#### 3.2.1 功能概述

```yaml
名称: 阅读时间规划
ID: reading_planner
描述: 根据用户可用时间和收藏内容，生成个性化阅读计划
价值主张: "碎片时间也能高效阅读"
```

#### 3.2.2 核心能力

```
┌─────────────────────────────────────────────────────────────┐
│                   reading_planner 核心能力                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 时间评估                                                │
│     ├── 估算每篇内容阅读时间                                │
│     ├── 支持快速/标准/深度阅读模式                          │
│     └── 累计待阅读时间统计                                  │
│                                                             │
│  2. 优先级排序                                              │
│     ├── 时效性优先 (新闻/热点)                              │
│     ├── 重要性优先 (标星/笔记)                              │
│     ├── 主题连贯性 (同主题连续阅读)                         │
│     └── 学习路径优先 (基础→进阶)                            │
│                                                             │
│  3. 计划生成                                                │
│     ├── "5 分钟能读什么"                                    │
│     ├── "今天午休 30 分钟阅读计划"                          │
│     ├── "本周学习计划"                                      │
│     └── 自定义时间段规划                                    │
│                                                             │
│  4. 进度追踪                                                │
│     ├── 标记已完成/部分阅读                                 │
│     ├── 调整剩余计划                                        │
│     └── 阅读统计报告                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 3.2.3 交互示例

```
用户: 我有 15 分钟，推荐读点什么

AI: 好的，为你规划 15 分钟阅读计划 ⏱️

    基于你的未读收藏和兴趣偏好，推荐：

    📖 快速阅读组合 (约 14 分钟):

    1. 🔥 TypeScript 5.3 新特性速览
       ├── 预计 5 分钟 · 时效性高
       └── 与你关注的 TS 主题相关

    2. 💡 React Server Components 入门
       ├── 预计 6 分钟 · 热门话题
       └── 你已收藏相关进阶内容

    3. ⚡ 前端性能优化 3 个实用技巧
       ├── 预计 3 分钟 · 实用干货
       └── 可立即应用

    ────────────────────────────────
    总计: 3 篇 · 约 14 分钟

    [开始阅读] [换一批] [调整时间]
```

---

### 3.3 相关内容发现 `related_discovery`

#### 3.3.1 功能概述

```yaml
名称: 相关内容发现
ID: related_discovery
描述: 基于语义相似度发现收藏间的关联，构建知识网络
价值主张: "发现知识的隐藏联系，构建个人知识图谱"
```

#### 3.3.2 核心能力

```
┌─────────────────────────────────────────────────────────────┐
│                  related_discovery 核心能力                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 相似内容发现                                            │
│     ├── 基于 Embedding 的语义相似度                         │
│     ├── 基于标签/文件夹的结构相似度                         │
│     └── 基于引用/链接的关联发现                             │
│                                                             │
│  2. 知识串联                                                │
│     ├── "这篇文章还可以看..."                               │
│     ├── 主题深入路径 (入门→进阶→实践)                       │
│     └── 跨领域关联 (技术↔产品↔设计)                        │
│                                                             │
│  3. 知识图谱                                                │
│     ├── 可视化收藏关联网络                                  │
│     ├── 主题聚类展示                                        │
│     └── 知识断层识别 (缺少的连接点)                         │
│                                                             │
│  4. 推荐触发                                                │
│     ├── 阅读时推荐相关内容                                  │
│     ├── 收藏时推荐已有相关内容                              │
│     └── 定期推荐"你可能遗漏的关联"                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 3.3.3 技术实现关键点

```typescript
// src/lib/ai-agent/skills/discovery/related-discovery.skill.ts

interface RelatedItem {
  bookmark: Bookmark;
  similarity: number;
  relationshipType: "semantic" | "structural" | "reference";
  explanation: string;
}

interface KnowledgeCluster {
  id: string;
  name: string;
  bookmarks: Bookmark[];
  centroid: number[]; // Embedding 中心点
  connections: string[]; // 与其他聚类的连接
}

export class RelatedDiscoverySkill extends BaseSkill {
  id = "related_discovery";
  name = "相关内容发现";

  requiredTools = ["semantic_search", "list_bookmarks", "read_bookmark"];

  async findRelated(
    bookmarkId: number,
    limit: number = 10,
    context: SkillContext,
  ): Promise<RelatedItem[]> {
    const bookmark = await this.getBookmark(bookmarkId, context);

    // 1. 语义相似度搜索
    const semanticResults = await this.executeTool(
      "semantic_search",
      { query: bookmark.title + " " + (bookmark.summary || ""), limit: 20 },
      context,
    );

    // 2. 结构相似度 (同文件夹/同标签)
    const structuralResults = await this.findStructuralRelated(
      bookmark,
      context,
    );

    // 3. 合并并排序
    const merged = this.mergeResults(semanticResults.data, structuralResults);

    // 4. 生成关联解释
    return this.explainRelationships(bookmark, merged.slice(0, limit));
  }

  async buildKnowledgeGraph(
    context: SkillContext,
  ): Promise<KnowledgeCluster[]> {
    const bookmarks = await this.getAllBookmarks(context);

    // 使用 embedding 进行聚类
    const clusters = await this.clusterByEmbedding(bookmarks);

    // 计算聚类间的连接关系
    const withConnections = await this.calculateConnections(clusters);

    return withConnections;
  }
}
```

---

## 4. P2 Skills 详细设计

### 4.1 周期报告生成 `periodic_report`

```yaml
名称: 周期报告生成
ID: periodic_report
描述: 自动生成周报/月报，统计阅读情况，分析知识积累趋势
触发: 定时触发 或 "生成本周/月报告"
```

**输出示例:**

```markdown
# 📊 2024年第51周 知识管理报告

## 本周概览

- 新增收藏: 23 篇
- 已阅读: 18 篇 (78%)
- 整理操作: 移动 12 篇，标签 8 篇

## 主题分布

1. React 性能优化 (8 篇) ████████░░ 35%
2. TypeScript 进阶 (5 篇) █████░░░░░ 22%
3. 前端工程化 (4 篇) ████░░░░░░ 17%

## 知识洞察

- 📈 趋势: React 相关内容持续增长
- 💡 建议: 可以深入学习 React Server Components
- ⚠️ 提醒: 3 篇时效性内容即将过期

## 下周计划

- [ ] 完成 React 18 并发特性学习
- [ ] 整理 TypeScript 笔记
```

---

### 4.2 学习路径构建 `learning_path`

```yaml
名称: 学习路径构建
ID: learning_path
描述: 基于收藏内容，构建领域学习路径，从入门到精通
触发: "帮我规划 XX 学习路径"
```

**输出示例:**

```
📚 React 学习路径 (基于你的 47 篇收藏)

Level 1: 基础入门 ✅ 已掌握
├── React 官方教程
├── JSX 语法详解
└── 组件基础与生命周期

Level 2: 核心概念 🔄 进行中
├── ✅ React Hooks 完全指南
├── ✅ 状态管理基础
├── 📖 Context API 深入 (推荐阅读)
└── 📖 自定义 Hooks 实践

Level 3: 进阶实践 ⏳ 待开始
├── 性能优化技巧
├── React 18 新特性
└── Server Components

Level 4: 高级主题 ⏳ 待开始
├── 源码解析
├── 架构设计
└── 测试最佳实践

📌 下一步建议: 完成 Level 2 剩余内容
```

---

### 4.3 协作分享包 `share_bundle`

```yaml
名称: 协作分享包
ID: share_bundle
描述: 打包专题收藏，生成可分享的知识包
触发: "打包 XX 分享给同事"
```

**输出示例:**

```
📦 React 学习资料包

包含内容:
├── 📄 React 学习路径.md
├── 📚 精选文章 (23 篇)
│   ├── 入门篇 (5 篇)
│   ├── 进阶篇 (10 篇)
│   └── 实战篇 (8 篇)
├── 🗺️ 知识图谱.html
└── 📋 阅读清单.csv

分享选项:
[生成链接] [导出 ZIP] [发送邮件]
```

---

## 5. 共享基础设施

### 5.1 目录结构

```
src/lib/ai-agent/skills/
├── types.ts                    # 统一类型定义
├── base-skill.ts               # Skill 基类
├── skill-registry.ts           # Skill 注册表
├── skill-orchestrator.ts       # Skill 编排器
├── utils/                      # 共享工具
│   ├── forgetting-curve.ts     # 遗忘曲线算法
│   ├── similarity.ts           # 相似度计算
│   ├── clustering.ts           # 聚类算法
│   ├── read-time.ts            # 阅读时间估算
│   └── export-formatter.ts     # 输出格式化
├── knowledge/                  # 知识类 Skills
│   ├── knowledge-review.skill.ts
│   ├── related-discovery.skill.ts
│   └── learning-path.skill.ts
├── cleanup/                    # 清理类 Skills
│   └── duplicate-cleanup.skill.ts
├── content/                    # 内容类 Skills
│   ├── quick-digest.skill.ts
│   └── periodic-report.skill.ts
├── tagging/                    # 标签类 Skills
│   └── smart-tagging.skill.ts
├── planning/                   # 规划类 Skills
│   └── reading-planner.skill.ts
└── sharing/                    # 分享类 Skills
    └── share-bundle.skill.ts
```

### 5.2 共享类型定义

```typescript
// src/lib/ai-agent/skills/types.ts

export interface Skill {
  id: string;
  name: string;
  description: string;
  intents: string[];
  requiredTools: string[];
  execute: (context: SkillContext) => Promise<SkillResult>;
}

export interface SkillContext {
  userId: string;
  intent: ParsedIntent;
  conversationHistory: Message[];
  currentState: AppState;
}

export interface SkillResult {
  success: boolean;
  summary: string;
  deliverable?: Deliverable;
  nextSuggestions?: string[];
  error?: string;
}

export interface Deliverable {
  type: "report" | "digest" | "list" | "graph" | "plan";
  format: "markdown" | "json" | "html" | "mindmap";
  data: unknown;
  downloadable?: boolean;
  shareable?: boolean;
}
```

### 5.3 数据库扩展

```sql
-- 回顾记录表
CREATE TABLE review_records (...);

-- 阅读计划表
CREATE TABLE reading_plans (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  total_items INTEGER,
  completed_items INTEGER DEFAULT 0,
  total_minutes INTEGER,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 阅读计划项
CREATE TABLE reading_plan_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  plan_id BIGINT REFERENCES reading_plans(id),
  bookmark_id BIGINT REFERENCES bookmarks(id),
  order_index INTEGER,
  estimated_minutes INTEGER,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ
);

-- 标签别名/规范化映射
CREATE TABLE tag_normalizations (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  original_tag TEXT NOT NULL,
  normalized_tag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, original_tag)
);

-- 书签关联关系
CREATE TABLE bookmark_relations (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  source_id BIGINT REFERENCES bookmarks(id),
  target_id BIGINT REFERENCES bookmarks(id),
  relation_type TEXT NOT NULL, -- 'similar', 'prerequisite', 'followup'
  similarity DECIMAL(4,3),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_id, target_id, relation_type)
);
```

---

## 6. 实现路线图

### 6.1 时间规划

```
┌──────────────────────────────────────────────────────────────┐
│                        实现路线图                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Week 1 (Day 1-4): P0 Skills - Part 1                        │
│  ├── Day 1-2: knowledge_review 完整实现                      │
│  │   ├── Skill 核心逻辑                                      │
│  │   ├── 遗忘曲线算法                                        │
│  │   └── UI 组件 (ReviewCard, ReviewList)                    │
│  └── Day 3-4: duplicate_cleanup 完整实现                     │
│      ├── 重复检测算法                                        │
│      ├── 过期检测逻辑                                        │
│      └── UI 组件 (CleanupPreview, ConfirmDialog)             │
│                                                              │
│  Week 2 (Day 5-7): P0 Skills - Part 2                        │
│  ├── Day 5-6: quick_digest 完整实现                          │
│  │   ├── 摘要生成逻辑                                        │
│  │   ├── 多格式输出                                          │
│  │   └── UI 组件 (DigestPreview, Mindmap)                    │
│  └── Day 7: P0 集成测试 & Bug 修复                           │
│                                                              │
│  Week 3 (Day 8-11): P1 Skills                                │
│  ├── Day 8-9: smart_tagging                                  │
│  ├── Day 10: reading_planner                                 │
│  └── Day 11: related_discovery                               │
│                                                              │
│  Week 4 (Day 12-14): P2 Skills & 收尾                        │
│  ├── Day 12: periodic_report                                 │
│  ├── Day 13: learning_path + share_bundle                    │
│  └── Day 14: 全量测试 & 文档完善                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 依赖关系

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Skill 基础  │────►│ P0 Skills   │────►│ P1 Skills   │
│ 架构        │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │ 共享工具类   │     │ P2 Skills   │
                    └─────────────┘     └─────────────┘
```

### 6.3 工作量估算

| Skill             | 核心逻辑 | UI 组件 | 测试    | 总计    |
| ----------------- | -------- | ------- | ------- | ------- |
| knowledge_review  | 6h       | 4h      | 2h      | 12h     |
| duplicate_cleanup | 8h       | 4h      | 2h      | 14h     |
| quick_digest      | 6h       | 4h      | 2h      | 12h     |
| smart_tagging     | 6h       | 3h      | 2h      | 11h     |
| reading_planner   | 4h       | 3h      | 1h      | 8h      |
| related_discovery | 6h       | 3h      | 2h      | 11h     |
| periodic_report   | 4h       | 2h      | 1h      | 7h      |
| learning_path     | 4h       | 3h      | 1h      | 8h      |
| share_bundle      | 4h       | 2h      | 1h      | 7h      |
| **总计**          | **48h**  | **28h** | **14h** | **90h** |

---

## 7. 验收标准

### 7.1 功能验收

| Skill             | 验收标准                                         |
| ----------------- | ------------------------------------------------ |
| knowledge_review  | 能正确计算回顾优先级，支持 3 种回顾模式，UI 流畅 |
| duplicate_cleanup | URL 去重 100% 准确，相似度检测 >90% 准确率       |
| quick_digest      | 支持 4 种输出格式，50 篇文章摘要 <30s            |
| smart_tagging     | 标签推荐准确率 >80%，支持批量应用                |
| reading_planner   | 阅读时间估算误差 <20%，计划生成 <3s              |
| related_discovery | 相似内容发现准确率 >85%，支持图谱可视化          |
| periodic_report   | 自动生成周报，统计数据准确                       |
| learning_path     | 路径逻辑合理，支持进度追踪                       |
| share_bundle      | 支持 3 种分享格式，打包 <5s                      |

### 7.2 性能验收

| 指标           | 目标              |
| -------------- | ----------------- |
| Skill 响应时间 | 首次响应 <2s      |
| 批量处理速度   | 100 条/分钟       |
| 内存占用       | <200MB (单 Skill) |
| 并发支持       | 10 用户同时使用   |

### 7.3 用户体验验收

- [ ] 所有 Skill 有清晰的进度提示
- [ ] 错误信息友好可理解
- [ ] 支持操作撤销/恢复
- [ ] 交付物格式正确、可下载
- [ ] 移动端适配良好

---

## 附录

### A. 遗忘曲线算法

```typescript
// 基于艾宾浩斯遗忘曲线的记忆保持度计算
export class ForgettingCurve {
  calculate(lastReadAt: Date, readCount: number): number {
    const daysSinceRead = this.daysSince(lastReadAt);
    const retentionRate = Math.exp(-daysSinceRead / (10 * (readCount + 1)));
    return 1 - retentionRate; // 返回回顾紧迫度 (0-1)
  }

  // 推荐复习间隔: 1天、3天、7天、14天、30天
  getNextReviewDate(readCount: number): Date {
    const intervals = [1, 3, 7, 14, 30, 60];
    const interval = intervals[Math.min(readCount, intervals.length - 1)];
    return new Date(Date.now() + interval * 24 * 60 * 60 * 1000);
  }
}
```

### B. 阅读时间估算算法

```typescript
export function estimateReadTime(
  content: string,
  mode: "fast" | "normal" | "deep",
): number {
  const wordCount = content.length; // 中文按字数
  const wordsPerMinute = {
    fast: 500,
    normal: 300,
    deep: 150,
  };
  return Math.ceil(wordCount / wordsPerMinute[mode]);
}
```

---

**文档结束**

> 请审核以上设计方案，如有疑问或建议，欢迎讨论。
