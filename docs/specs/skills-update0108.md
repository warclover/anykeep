# AnyKeep Skills 化功能实现方案

> **版本**: v1.1.0
> **日期**: 2025-01-08
> **状态**: 待审核（已按规范修正）
> **作者**: AI Assistant

---

## 1. 方案概述

### 1.1 背景

AnyKeep 已实现 24 个 AI Skills，但部分成熟功能（如文件夹推荐、收件箱整理、搜索优化）仅以组件/Hook 形式存在，用户无法通过 AI 对话主动调用。本方案旨在将这些"隐藏能力"封装为 Skills，实现功能联动和任务闭环。

### 1.2 设计原则

| 原则         | 说明                                                             |
| ------------ | ---------------------------------------------------------------- |
| **规范优先** | 严格遵循 AnyKeep 现有 Skill 规范（BaseSkill/OrchestrationSkill） |
| **复用现有** | 封装已有 Hook/Service/Tool，通过适配层调用                       |
| **渐进增强** | Feature Flag 控制，逐步灰度发布                                  |
| **闭环联动** | Skills 之间可组合调用，形成完整工作流                            |

### 1.3 实现范围

| 优先级 | Skill 名称                | 类型 | 现有基础                   | 新增工作量 |
| ------ | ------------------------- | ---- | -------------------------- | ---------- |
| P0     | `inbox_triage`            | 编排 | useInboxOrganization + API | 低         |
| P0     | `folder_recommend`        | 原子 | folder-recommender.ts      | 低         |
| P0     | `search_optimize`         | 原子 | 无现成服务                 | 中         |
| P1     | `knowledge_graph_explore` | 编排 | GraphBuilderService        | 低         |
| P1     | `folder_health_check`     | 编排 | FolderHealthService        | 低         |
| P1     | `snapshot_compare`        | 原子 | compareSnapshotsTool       | 极低       |

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        UnifiedEngine                             │
│  (IntentRouter → ExecutionCoordinator → OutputEnhancer)         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
    原子模式              编排模式            新增 Skills
  skillRegistry        unifiedEngine          (本方案)
         │                    │                    │
    SearchSkill         DataExportSkill      InboxTriageSkill
    ClassifySkill       BatchOrganizeSkill   FolderRecommendSkill
    SummarySkill        InsightReportSkill   SearchOptimizeSkill
                                                   │
                              ┌────────────────────┘
                              ▼
                    服务适配层 (新增)
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
  InboxServiceAdapter  FolderServiceAdapter  GraphServiceAdapter
         │                    │                    │
         ▼                    ▼                    ▼
  useInboxOrganization  folder-recommender   GraphBuilderService
  (API 调用)            (函数调用)           (单例)
```

### 2.2 Skill 分类策略

| 类型       | 基类               | 执行模式 | 响应时间 | 适用场景                       |
| ---------- | ------------------ | -------- | -------- | ------------------------------ |
| **原子型** | BaseSkill          | 单步执行 | <2s      | 获取推荐、统计信息、快照对比   |
| **编排型** | OrchestrationSkill | 多步流式 | 5-15s    | 健康检查、图谱探索、收件箱整理 |

### 2.3 Category 分类规范

按照 AnyKeep 规范，所有 Skill 必须指定 category：

| Category        | 含义   | 适用 Skill                                          |
| --------------- | ------ | --------------------------------------------------- |
| `understanding` | 理解型 | knowledge_graph_explore                             |
| `organizing`    | 整理型 | inbox_triage, folder_recommend, folder_health_check |
| `learning`      | 学习型 | （本方案无）                                        |
| `utility`       | 工具型 | search_optimize, snapshot_compare                   |

---

## 3. 服务适配层设计

> **重要**: 为确保可落地实现，需要创建适配层封装现有 Hook/函数/Tool。

### 3.1 InboxServiceAdapter

封装 `useInboxOrganization` Hook 的 API 调用逻辑，供 Skill 使用：

```typescript
// src/lib/ai-skills/adapters/inbox-service.adapter.ts

import { createClient } from "@/lib/supabase/server";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";
import { logger } from "@/lib/logger";
import type { OrganizationAnalysis } from "@/lib/classification";

/**
 * 收件箱服务适配器
 * 封装 API 调用，供 InboxTriageSkill 使用
 */
export class InboxServiceAdapter {
  /**
   * 获取未分类书签的整理建议
   */
  async getOrganizationAnalysis(
    userId: string,
  ): Promise<OrganizationAnalysis | null> {
    try {
      // 直接调用 Supabase RPC 或复用 API 逻辑
      const supabase = await createClient();

      // 获取未分类书签
      const { data: unclassified, error } = await supabase
        .from("bookmarks")
        .select("id, title, url, platform, tags, created_at")
        .eq("user_id", userId)
        .is("folder_id", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        logger.error(
          { error, userId },
          "InboxAdapter: Failed to get unclassified bookmarks",
        );
        return null;
      }

      if (!unclassified || unclassified.length === 0) {
        return {
          suggestions: [],
          totalUnclassified: 0,
          clusterStatus: null,
        };
      }

      // TODO: 调用聚类分析服务生成建议
      // 复用现有 API 逻辑
      return {
        suggestions: [],
        totalUnclassified: unclassified.length,
        clusterStatus: null,
      };
    } catch (error) {
      logger.error({ error, userId }, "InboxAdapter: Error getting analysis");
      return null;
    }
  }

  /**
   * 应用整理建议
   */
  async applySuggestion(
    userId: string,
    suggestionId: number,
  ): Promise<boolean> {
    try {
      const response = await fetch(API_CLASSIFICATION.inbox, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId }),
      });
      return response.ok;
    } catch (error) {
      logger.error(
        { error, userId, suggestionId },
        "InboxAdapter: Apply suggestion failed",
      );
      return false;
    }
  }
}

// 单例导出
let inboxServiceAdapter: InboxServiceAdapter | null = null;

export function getInboxServiceAdapter(): InboxServiceAdapter {
  if (!inboxServiceAdapter) {
    inboxServiceAdapter = new InboxServiceAdapter();
  }
  return inboxServiceAdapter;
}
```

### 3.2 FolderServiceAdapter

封装 `folder-recommender.ts` 的函数调用：

```typescript
// src/lib/ai-skills/adapters/folder-service.adapter.ts

import { createClient } from "@/lib/supabase/server";
import {
  recommendFolder,
  generateFallbackFolderRecommendation,
} from "@/lib/ai-generator/folder/folder-recommender";
import type {
  FolderRecommendation,
  ExistingFolder,
} from "@/lib/ai-generator/types";
import { logger } from "@/lib/logger";

/**
 * 文件夹服务适配器
 */
export class FolderServiceAdapter {
  /**
   * 获取用户所有文件夹
   */
  async getUserFolders(userId: string): Promise<ExistingFolder[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("folders")
      .select(
        `
        id,
        name,
        bookmarks:bookmarks(count)
      `,
      )
      .eq("user_id", userId)
      .order("name");

    if (error) {
      logger.error({ error, userId }, "FolderAdapter: Failed to get folders");
      return [];
    }

    return (data || []).map((f) => ({
      id: f.id,
      name: f.name,
      bookmarkCount:
        (f.bookmarks as unknown as { count: number }[])?.[0]?.count || 0,
      topTags: [], // 可扩展
    }));
  }

  /**
   * 基于书签内容推荐文件夹
   */
  async recommendForBookmark(
    title: string,
    summary: string,
    tags: string[],
    userId: string,
  ): Promise<FolderRecommendation> {
    const existingFolders = await this.getUserFolders(userId);

    if (existingFolders.length === 0) {
      return generateFallbackFolderRecommendation(title, tags, []);
    }

    return recommendFolder(title, summary, tags, existingFolders);
  }

  /**
   * 分析未分类书签的主题分布，生成文件夹推荐
   */
  async analyzeAndRecommend(
    userId: string,
    maxRecommendations: number = 5,
  ): Promise<FolderRecommendation[]> {
    const supabase = await createClient();

    // 获取未分类书签
    const { data: unclassified } = await supabase
      .from("bookmarks")
      .select("id, title, summary, tags")
      .eq("user_id", userId)
      .is("folder_id", null)
      .limit(50);

    if (!unclassified || unclassified.length === 0) {
      return [];
    }

    const existingFolders = await this.getUserFolders(userId);
    const recommendations: FolderRecommendation[] = [];
    const seenFolders = new Set<string>();

    for (const bookmark of unclassified) {
      if (recommendations.length >= maxRecommendations) break;

      const rec = await recommendFolder(
        bookmark.title || "",
        bookmark.summary || "",
        bookmark.tags || [],
        existingFolders,
      );

      // 去重
      const key = rec.suggestNew
        ? `new:${rec.folderName}`
        : `existing:${rec.folderId}`;
      if (!seenFolders.has(key) && rec.confidence >= 60) {
        seenFolders.add(key);
        recommendations.push(rec);
      }
    }

    return recommendations;
  }
}

// 单例导出
let folderServiceAdapter: FolderServiceAdapter | null = null;

export function getFolderServiceAdapter(): FolderServiceAdapter {
  if (!folderServiceAdapter) {
    folderServiceAdapter = new FolderServiceAdapter();
  }
  return folderServiceAdapter;
}
```

---

## 4. P0 Skills 详细设计

### 4.1 InboxTriageSkill - 收件箱智能分拣

#### 4.1.1 功能定位

将 `InboxOrganizationBanner` 组件的整理能力封装为可对话调用的 Skill，用户可主动请求"帮我整理收件箱"。

#### 4.1.2 类型定义

```typescript
// src/lib/ai-skills/skills/inbox-triage/types.ts

import { z } from "zod";
import type { StepDefinition } from "../../orchestration/types";

// ============================================
// Steps 常量
// ============================================

export const INBOX_TRIAGE_STEPS: StepDefinition[] = [
  { id: "scan", name: "扫描收件箱", description: "检索未分类书签", weight: 20 },
  {
    id: "cluster",
    name: "聚类分析",
    description: "按主题聚类书签",
    weight: 30,
  },
  { id: "suggest", name: "生成建议", description: "制定整理方案", weight: 30 },
  {
    id: "prepare",
    name: "准备操作",
    description: "构建可执行动作",
    weight: 20,
  },
];

// ============================================
// Input Schema
// ============================================

export const InboxTriageInputSchema = z.object({
  autoExecute: z.boolean().default(false).describe("是否自动执行建议"),
  maxItems: z.number().min(1).max(200).default(50).describe("最大处理数量"),
  excludeFolderIds: z.array(z.number()).optional().describe("排除的文件夹 ID"),
});

export type InboxTriageInput = z.infer<typeof InboxTriageInputSchema>;

// ============================================
// Output Schema
// ============================================

export const InboxTriageOutputSchema = z.object({
  totalScanned: z.number(),
  clustersFound: z.number(),
  suggestionsGenerated: z.number(),
  executedCount: z.number().optional(),
});

export type InboxTriageOutput = z.infer<typeof InboxTriageOutputSchema>;

// ============================================
// 内部类型
// ============================================

export interface TriageSuggestion {
  id: string;
  action: "move" | "tag" | "archive";
  bookmarkIds: number[];
  targetFolder?: { id: number; name: string };
  tags?: string[];
  reason: string;
  confidence: number;
}
```

#### 4.1.3 Skill 实现

```typescript
// src/lib/ai-skills/skills/inbox-triage/inbox-triage.skill.ts

import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type {
  OrchestrationSkillMetadata,
  OrchestrationContext,
  OrchestrationStreamChunk,
} from "../../orchestration/types";
import { createClient } from "@/lib/supabase/server";
import {
  INBOX_TRIAGE_STEPS,
  InboxTriageInputSchema,
  InboxTriageOutputSchema,
  type InboxTriageInput,
  type InboxTriageOutput,
  type TriageSuggestion,
} from "./types";

export class InboxTriageSkill extends OrchestrationSkill<
  InboxTriageInput,
  InboxTriageOutput
> {
  // ✅ 完整的 metadata，符合 OrchestrationSkillMetadata 规范
  readonly metadata: OrchestrationSkillMetadata = {
    id: "inbox_triage",
    name: "收件箱智能分拣",
    description: "分析未分类书签，提供智能整理建议和一键执行",
    category: "organizing", // ✅ 必填
    version: "1.0.0",
    author: "AnyKeep", // ✅ 必填
    capabilities: ["analyze", "suggest", "batch-action"],
    steps: INBOX_TRIAGE_STEPS, // ✅ 使用外部常量
  };

  readonly inputSchema = InboxTriageInputSchema;
  readonly outputSchema = InboxTriageOutputSchema;

  // ✅ 无构造函数依赖注入

  /**
   * 解析用户输入
   */
  async parseInput(
    message: string,
    context: OrchestrationContext,
  ): Promise<InboxTriageInput> {
    const autoExecute = /自动|直接|立即/.test(message);
    const maxMatch = message.match(/(\d+)\s*条/);
    const maxItems = maxMatch ? Math.min(parseInt(maxMatch[1], 10), 200) : 50;

    return {
      autoExecute,
      maxItems,
      excludeFolderIds: [],
    };
  }

  /**
   * 流式执行
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const input = context.parsedInput as InboxTriageInput;

    // ✅ 直接创建 Supabase 客户端
    const supabase = await createClient();

    // ✅ 初始化进度
    this.initProgress(INBOX_TRIAGE_STEPS);

    // Step 1: 扫描收件箱
    yield* this.reportProgress("scan", 10, "正在扫描未分类书签...");

    const { data: unclassified, error } = await supabase
      .from("bookmarks")
      .select("id, title, url, platform, tags, created_at")
      .eq("user_id", context.userId)
      .is("folder_id", null)
      .order("created_at", { ascending: false })
      .limit(input.maxItems);

    if (error) {
      yield* this.emitError(`扫描失败: ${error.message}`);
      return;
    }

    if (!unclassified || unclassified.length === 0) {
      yield* this.emitText("✨ 收件箱已经很整洁，没有需要整理的书签！");
      yield* this.emitDone();
      return;
    }

    yield* this.reportProgress(
      "scan",
      20,
      `发现 ${unclassified.length} 条未分类书签`,
    );

    // Step 2: 聚类分析
    yield* this.reportProgress("cluster", 30, "正在分析内容主题...");

    // 按平台/标签简单聚类
    const clusters = this.clusterBookmarks(unclassified);
    yield* this.reportProgress(
      "cluster",
      50,
      `识别出 ${clusters.size} 个主题分组`,
    );

    // Step 3: 生成整理建议
    yield* this.reportProgress("suggest", 60, "正在生成整理建议...");
    const suggestions = await this.generateSuggestions(
      clusters,
      context.userId,
      supabase,
    );
    yield* this.reportProgress(
      "suggest",
      80,
      `生成 ${suggestions.length} 条整理建议`,
    );

    // Step 4: 准备操作
    yield* this.reportProgress("prepare", 90, "准备整理方案...");

    // ✅ 使用正确的交付物方法
    const deliverable = this.createDeliverable(
      "list", // ✅ 使用规范 DeliverableType
      "收件箱整理方案",
      {
        items: suggestions.map((s) => ({
          id: s.id,
          action: s.action,
          bookmarkCount: s.bookmarkIds.length,
          targetFolder: s.targetFolder?.name,
          tags: s.tags,
          confidence: s.confidence,
          reason: s.reason,
        })),
      },
      "json",
      {
        metadata: {
          subType: "action_plan", // ✅ 通过 metadata 传递子类型
          totalBookmarks: unclassified.length,
          suggestionsCount: suggestions.length,
        },
      },
    );
    yield* this.emitDeliverable(deliverable);

    // 输出文本摘要
    yield* this.emitText(
      `📋 已分析 ${unclassified.length} 条未分类书签，生成 ${suggestions.length} 条整理建议。\n` +
        `请在上方查看详细方案，点击"执行"按钮可一键应用。`,
    );

    yield* this.reportProgress("prepare", 100, "完成");
    yield* this.emitDone();
  }

  // ============================================
  // 私有辅助方法
  // ============================================

  private clusterBookmarks(
    bookmarks: Array<{
      id: number;
      title: string;
      platform?: string;
      tags?: string[];
    }>,
  ): Map<string, typeof bookmarks> {
    const clusters = new Map<string, typeof bookmarks>();

    for (const bookmark of bookmarks) {
      // 按平台聚类
      const key = bookmark.platform || "other";
      if (!clusters.has(key)) {
        clusters.set(key, []);
      }
      clusters.get(key)!.push(bookmark);
    }

    return clusters;
  }

  private async generateSuggestions(
    clusters: Map<
      string,
      Array<{ id: number; title: string; platform?: string; tags?: string[] }>
    >,
    userId: string,
    supabase: Awaited<ReturnType<typeof createClient>>,
  ): Promise<TriageSuggestion[]> {
    const suggestions: TriageSuggestion[] = [];

    // 获取用户现有文件夹
    const { data: folders } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", userId);

    const folderMap = new Map(
      (folders || []).map((f) => [f.name.toLowerCase(), f]),
    );

    for (const [platform, bookmarks] of clusters) {
      if (bookmarks.length < 3) continue;

      // 尝试匹配现有文件夹
      const matchedFolder = folderMap.get(platform.toLowerCase());

      suggestions.push({
        id: `cluster-${platform}`,
        action: matchedFolder ? "move" : "tag",
        bookmarkIds: bookmarks.map((b) => b.id),
        targetFolder: matchedFolder
          ? { id: matchedFolder.id, name: matchedFolder.name }
          : undefined,
        tags: matchedFolder ? undefined : [platform],
        reason: matchedFolder
          ? `${bookmarks.length} 条 ${platform} 内容，建议移动到「${matchedFolder.name}」`
          : `${bookmarks.length} 条 ${platform} 内容，建议添加标签`,
        confidence: matchedFolder ? 85 : 70,
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }
}
```

#### 4.1.4 触发意图规则

```typescript
// src/lib/ai-agent/classification/rules/inbox-triage.rules.ts

import type { IntentRule } from "../types";

export const inboxTriageRules: IntentRule[] = [
  {
    id: "inbox-triage-organize",
    patterns: [
      /整理.*(收件箱|inbox)/i,
      /收件箱.*整理/i,
      /(帮我|自动).*(分类|分拣|归档).*(未读|未整理|新)/i,
      /inbox.*(organize|triage|sort)/i,
    ],
    intent: { type: "action", subType: "inbox_triage" },
    confidence: 0.85,
    priority: 80,
  },
  {
    id: "inbox-triage-query",
    patterns: [
      /(有多少|几条).*(未整理|未分类|待处理)/i,
      /收件箱.*状态/i,
      /inbox.*(status|overview)/i,
    ],
    intent: { type: "query", subType: "inbox_status" },
    confidence: 0.8,
    priority: 75,
  },
];
```

#### 4.1.5 文件结构

```
src/lib/ai-skills/skills/inbox-triage/
├── index.ts                      # 模块导出
├── inbox-triage.skill.ts         # Skill 实现
├── types.ts                      # 类型 + Schema + Steps 常量
└── __tests__/
    └── inbox-triage.skill.test.ts
```

---

### 4.2 FolderRecommendSkill - 文件夹智能推荐

#### 4.2.1 功能定位

将 `folder-recommender.ts` 的推荐能力封装为 Skill，用户可主动询问"我应该创建什么文件夹"。

#### 4.2.2 类型定义

```typescript
// src/lib/ai-skills/skills/folder-recommend/types.ts

import { z } from "zod";

// ============================================
// Input Schema
// ============================================

export const FolderRecommendInputSchema = z.object({
  maxRecommendations: z.number().min(1).max(10).default(5),
  considerHierarchy: z.boolean().default(true),
  focusOnUnclassified: z.boolean().default(true),
});

export type FolderRecommendInput = z.infer<typeof FolderRecommendInputSchema>;

// ============================================
// Output Schema
// ============================================

export const FolderRecommendOutputSchema = z.object({
  recommendations: z.array(
    z.object({
      name: z.string(),
      isNew: z.boolean(),
      folderId: z.number().nullable(),
      reason: z.string(),
      matchingBookmarkCount: z.number(),
      confidence: z.number(),
    }),
  ),
  currentFolderCount: z.number(),
  unclassifiedCount: z.number(),
});

export type FolderRecommendOutput = z.infer<typeof FolderRecommendOutputSchema>;
```

#### 4.2.3 Skill 实现

```typescript
// src/lib/ai-skills/skills/folder-recommend/folder-recommend.skill.ts

import { BaseSkill } from "../../core/base-skill";
import type { SkillMetadata, SkillContext } from "../../core/types";
import { createClient } from "@/lib/supabase/server";
import { getFolderServiceAdapter } from "../../adapters/folder-service.adapter";
import {
  FolderRecommendInputSchema,
  FolderRecommendOutputSchema,
  type FolderRecommendInput,
  type FolderRecommendOutput,
} from "./types";

/**
 * 文件夹推荐 Skill
 *
 * 设计为原子 Skill（非编排），因为：
 * 1. 响应时间短（<2s）
 * 2. 单步执行，无需多阶段进度
 * 3. 输出为建议列表，无需复杂交付物
 */
export class FolderRecommendSkill extends BaseSkill<
  FolderRecommendInput,
  FolderRecommendOutput
> {
  // ✅ 完整的 metadata
  readonly metadata: SkillMetadata = {
    id: "folder_recommend",
    name: "文件夹智能推荐",
    description: "基于书签内容和使用习惯，推荐最佳文件夹结构",
    category: "organizing", // ✅ 必填
    version: "1.0.0",
    author: "AnyKeep", // ✅ 必填
    capabilities: ["analyze", "recommend"],
  };

  readonly inputSchema = FolderRecommendInputSchema;
  readonly outputSchema = FolderRecommendOutputSchema;

  // ✅ 无构造函数

  protected async executeInternal(
    input: FolderRecommendInput,
    context: SkillContext,
  ): Promise<FolderRecommendOutput> {
    const supabase = await createClient();
    const adapter = getFolderServiceAdapter();

    // 1. 获取现有文件夹数量
    const { count: folderCount } = await supabase
      .from("folders")
      .select("*", { count: "exact", head: true })
      .eq("user_id", context.userId);

    // 2. 获取未分类书签数量
    const { count: unclassifiedCount } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("folder_id", null);

    // 3. 生成推荐
    const recommendations = await adapter.analyzeAndRecommend(
      context.userId,
      input.maxRecommendations,
    );

    // 4. 转换为输出格式
    return {
      recommendations: recommendations.map((rec) => ({
        name: rec.folderName,
        isNew: rec.suggestNew,
        folderId: rec.folderId,
        reason: rec.reason,
        matchingBookmarkCount: 0, // TODO: 计算匹配数
        confidence: rec.confidence,
      })),
      currentFolderCount: folderCount || 0,
      unclassifiedCount: unclassifiedCount || 0,
    };
  }
}
```

#### 4.2.4 触发意图规则

```typescript
// src/lib/ai-agent/classification/rules/folder-recommend.rules.ts

import type { IntentRule } from "../types";

export const folderRecommendRules: IntentRule[] = [
  {
    id: "folder-recommend-create",
    patterns: [
      /推荐.*(文件夹|目录|分类)/i,
      /(建议|应该).*创建.*(文件夹|目录)/i,
      /(文件夹|目录).*建议/i,
      /folder.*(recommend|suggest)/i,
    ],
    intent: { type: "query", subType: "folder_recommend" },
    confidence: 0.85,
    priority: 80,
  },
];
```

---

### 4.3 SearchOptimizeSkill - 搜索优化助手

#### 4.3.1 功能定位

帮助用户优化搜索条件，提高搜索准确性。支持分析搜索问题并给出优化建议。

#### 4.3.2 类型定义

```typescript
// src/lib/ai-skills/skills/search-optimize/types.ts

import { z } from "zod";

// ============================================
// Input Schema
// ============================================

export const SearchOptimizeInputSchema = z.object({
  originalQuery: z.string().optional().describe("原始搜索词"),
  feedback: z.string().optional().describe("用户反馈（太多/太少/不相关）"),
  autoApply: z.boolean().default(false).describe("是否自动应用优化"),
});

export type SearchOptimizeInput = z.infer<typeof SearchOptimizeInputSchema>;

// ============================================
// Output Schema
// ============================================

export const SearchOptimizeOutputSchema = z.object({
  analysis: z
    .object({
      originalQuery: z.string(),
      issues: z.array(
        z.object({
          type: z.string(),
          suggestion: z.string(),
        }),
      ),
    })
    .nullable(),
  suggestions: z.array(
    z.object({
      optimizedQuery: z.string(),
      explanation: z.string(),
      expectedImprovement: z.string(),
    }),
  ),
  tips: z.array(z.string()),
});

export type SearchOptimizeOutput = z.infer<typeof SearchOptimizeOutputSchema>;
```

#### 4.3.3 Skill 实现

```typescript
// src/lib/ai-skills/skills/search-optimize/search-optimize.skill.ts

import { BaseSkill } from "../../core/base-skill";
import type { SkillMetadata, SkillContext } from "../../core/types";
import {
  SearchOptimizeInputSchema,
  SearchOptimizeOutputSchema,
  type SearchOptimizeInput,
  type SearchOptimizeOutput,
} from "./types";

/**
 * 搜索优化 Skill
 */
export class SearchOptimizeSkill extends BaseSkill<SearchOptimizeInput, SearchOptimizeOutput> {
  readonly metadata: SkillMetadata = {
    id: "search_optimize",
    name: "搜索优化助手",
    description: "分析搜索意图，优化搜索条件，提高搜索准确性",
    category: "utility",              // ✅ utility 类型
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["analyze", "suggest"],
  };

  readonly inputSchema = SearchOptimizeInputSchema;
  readonly outputSchema = SearchOptimizeOutputSchema;

  protected async executeInternal(
    input: SearchOptimizeInput,
    context: SkillContext
  ): Promise<SearchOptimizeOutput> {
    // 获取搜索历史（如果有）
    const searchHistory = context.memory?.searchResults || [];
    const lastSearch = searchHistory[searchHistory.length - 1];

    if (!lastSearch && !input.originalQuery) {
      // 没有搜索上下文，提供通用建议
      return this.generateSearchTips();
    }

    const query = input.originalQuery || lastSearch?.query || "";

    // 分析搜索问题
    const analysis = this.analyzeSearchIssue(query, input.feedback);

    // 生成优化建议
    const suggestions = this.generateOptimizations(analysis, query);

    return {
      analysis: {
        originalQuery: query,
        issues: analysis.issues,
      },
      suggestions,
      tips: this.getContextualTips(analysis),
    };
  }

  private analyzeSearchIssue(query: string, feedback?: string) {
    const issues: Array<{ type: string; suggestion: string }> = [];

    if (query.length < 3) {
      issues.push({ type: "too_short", suggestion: "尝试使用更具体的关键词" });
    }

    if (query.split(/\s+/).length > 5) {
      issues.push({ type: "too_complex", suggestion: "尝试简化查询，使用核心关键词" });
    }

    if (feedback) {
      if (/太多|太杂/.test(feedback)) {
        issues.push({ type: "too_broad", suggestion: "添加限定词（如时间、平台、标签）" });
      }
      if (/太少|找不到/.test(feedback)) {
        issues.push({ type: "too_narrow", suggestion: "尝试使用同义词或更宽泛的词" });
      }
      if (/不相关/.test(feedback)) {
        issues.push({ type: "irrelevant", suggestion: "尝试语义搜索模式" });
      }
    }

    return { issues };
  }

  private generateOptimizations(
    analysis: { issues: Array<{ type: string; suggestion: string }> },
    query: string
  ) {
    const suggestions: Array<{
      optimizedQuery: string;
      explanation: string;
      expectedImprovement: string;
    }> = [];

    for (const issue of analysis.issues) {
      switch (issue.type) {
        case "too_broad":
          suggestions.push({
            optimizedQuery: query.split(/\s+/).slice(0, 2).join(" "),
            explanation: "精简为核心关键词，减少噪音",
            expectedImprovement: "减少 50% 无关结果",
          });
          break;
        case "too_narrow":
          suggestions.push({
            optimizedQuery: query,
            explanation: "建议切换到语义搜索模式",
            expectedImprovement: "增加 30% 相关结果",
          });
          break;
      }
    }

    return suggestions;
  }

  private generateSearchTips(): SearchOptimizeOutput {
    return {
      analysis: null,
      suggestions: [],
      tips: [
        "💡 使用引号 \"精确匹配\" 搜索完整短语",
        "💡 使用 tag:标签名 语法筛选特定标签",
        "💡 使用 platform:微信 筛选特定平台",
        "💡 使用 before:2024-01-01 或 after:2024-01-01 筛选时间",
        "💡 搜索结果不满意？告诉我"太多"、"太少"或"不相关"，我来帮你优化",
      ],
    };
  }

  private getContextualTips(analysis: { issues: Array<{ type: string; suggestion: string }> }): string[] {
    const tips: string[] = [];

    if (analysis.issues.some(i => i.type === "too_broad")) {
      tips.push("💡 试试添加 platform:微信 或 tag:技术 来缩小范围");
    }

    if (analysis.issues.some(i => i.type === "too_narrow")) {
      tips.push("💡 试试用语义搜索，直接描述你想找什么内容");
    }

    return tips;
  }
}
```

---

## 5. P1 Skills 详细设计

### 5.1 KnowledgeGraphExploreSkill - 知识图谱探索

#### 5.1.1 功能定位

将 `GraphBuilderService` 的图谱能力封装为对话式探索 Skill。

#### 5.1.2 类型定义

```typescript
// src/lib/ai-skills/skills/knowledge-graph-explore/types.ts

import { z } from "zod";
import type { StepDefinition } from "../../orchestration/types";

export const KNOWLEDGE_GRAPH_STEPS: StepDefinition[] = [
  {
    id: "build",
    name: "构建图谱",
    description: "获取知识关联数据",
    weight: 30,
  },
  {
    id: "analyze",
    name: "分析结构",
    description: "识别核心节点和社区",
    weight: 30,
  },
  { id: "insight", name: "生成洞察", description: "提供学习建议", weight: 40 },
];

export const KnowledgeGraphExploreInputSchema = z.object({
  topic: z.string().optional().describe("聚焦的主题"),
  depth: z.number().min(1).max(3).default(2).describe("探索深度"),
  maxNodes: z.number().min(10).max(200).default(100).describe("最大节点数"),
});

export type KnowledgeGraphExploreInput = z.infer<
  typeof KnowledgeGraphExploreInputSchema
>;

export const KnowledgeGraphExploreOutputSchema = z.object({
  nodeCount: z.number(),
  edgeCount: z.number(),
  communityCount: z.number(),
  centralNodes: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      connectionCount: z.number(),
    }),
  ),
});

export type KnowledgeGraphExploreOutput = z.infer<
  typeof KnowledgeGraphExploreOutputSchema
>;
```

#### 5.1.3 Skill 实现

```typescript
// src/lib/ai-skills/skills/knowledge-graph-explore/knowledge-graph-explore.skill.ts

import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type {
  OrchestrationSkillMetadata,
  OrchestrationContext,
  OrchestrationStreamChunk,
} from "../../orchestration/types";
import { getGraphBuilderService } from "@/lib/knowledge-link/services/graph-builder.service";
import {
  KNOWLEDGE_GRAPH_STEPS,
  KnowledgeGraphExploreInputSchema,
  KnowledgeGraphExploreOutputSchema,
  type KnowledgeGraphExploreInput,
  type KnowledgeGraphExploreOutput,
} from "./types";

export class KnowledgeGraphExploreSkill extends OrchestrationSkill<
  KnowledgeGraphExploreInput,
  KnowledgeGraphExploreOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "knowledge_graph_explore",
    name: "知识图谱探索",
    description: "通过对话探索知识关联，发现学习盲区",
    category: "understanding", // ✅ understanding 类型
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["visualize", "analyze", "recommend"],
    steps: KNOWLEDGE_GRAPH_STEPS,
  };

  readonly inputSchema = KnowledgeGraphExploreInputSchema;
  readonly outputSchema = KnowledgeGraphExploreOutputSchema;

  async parseInput(
    message: string,
    context: OrchestrationContext,
  ): Promise<KnowledgeGraphExploreInput> {
    // 提取主题关键词
    const topicMatch = message.match(
      /(?:关于|探索|查看)\s*[「"']?([^「"']+)[」"']?\s*(?:的)?(?:图谱|关联|知识)/,
    );
    const topic = topicMatch?.[1];

    return {
      topic,
      depth: 2,
      maxNodes: 100,
    };
  }

  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const input = context.parsedInput as KnowledgeGraphExploreInput;

    // ✅ 使用现有的 GraphBuilderService 单例
    const graphService = getGraphBuilderService();

    this.initProgress(KNOWLEDGE_GRAPH_STEPS);

    // Step 1: 构建图谱
    yield* this.reportProgress("build", 10, "正在获取知识关联数据...");

    const graphData = await graphService.getGraphData(context.userId, {
      maxNodes: input.maxNodes,
      minStrength: 0.3,
    });

    yield* this.reportProgress(
      "build",
      30,
      `获取到 ${graphData.nodes.length} 个节点`,
    );

    // Step 2: 分析结构
    yield* this.reportProgress("analyze", 40, "正在分析知识结构...");

    const centralNodes = await graphService.getCentralNodes(context.userId, 5);
    const communities = await graphService.detectCommunities(context.userId);

    yield* this.reportProgress(
      "analyze",
      60,
      `发现 ${communities.size} 个知识社区`,
    );

    // Step 3: 生成洞察
    yield* this.reportProgress("insight", 70, "正在生成学习建议...");

    // 输出可视化数据
    const deliverable = this.createDeliverable(
      "graph", // ✅ 使用规范 DeliverableType
      "知识图谱",
      {
        nodes: graphData.nodes.slice(0, 50), // 限制前端渲染数量
        edges: graphData.edges.slice(0, 100),
        centralNodes: centralNodes.map((n) => ({
          id: n.id,
          title: n.title,
          connectionCount: n.connectionCount,
        })),
        stats: graphData.stats,
      },
      "json",
      {
        metadata: {
          renderHint: "force-directed-graph",
          communityCount: communities.size,
        },
      },
    );
    yield* this.emitDeliverable(deliverable);

    // 输出文本洞察
    const insights = this.formatInsights(centralNodes, communities, graphData);
    yield* this.emitText(insights);

    yield* this.reportProgress("insight", 100, "完成");
    yield* this.emitDone();
  }

  private formatInsights(
    centralNodes: Array<{ id: number; title: string; connectionCount: number }>,
    communities: Map<number, number[]>,
    graphData: {
      nodes: unknown[];
      edges: unknown[];
      stats: { totalLinks: number };
    },
  ): string {
    const lines: string[] = ["📊 **知识图谱分析结果**\n"];

    // 核心节点
    if (centralNodes.length > 0) {
      lines.push("**🌟 核心知识节点**（连接最多）：");
      centralNodes.slice(0, 3).forEach((node, i) => {
        lines.push(
          `${i + 1}. 「${node.title}」- ${node.connectionCount} 个关联`,
        );
      });
      lines.push("");
    }

    // 社区概览
    lines.push(`**🔗 知识社区**：共发现 ${communities.size} 个独立主题群`);
    lines.push(`**📈 关联密度**：${graphData.stats.totalLinks} 条知识链接`);

    return lines.join("\n");
  }
}
```

---

### 5.2 FolderHealthCheckSkill - 文件夹健康检查

复用现有的 `FolderHealthService`：

```typescript
// src/lib/ai-skills/skills/folder-health-check/types.ts

import { z } from "zod";
import type { StepDefinition } from "../../orchestration/types";

export const FOLDER_HEALTH_STEPS: StepDefinition[] = [
  { id: "scan", name: "扫描结构", description: "获取文件夹信息", weight: 20 },
  { id: "diagnose", name: "诊断问题", description: "分析健康状态", weight: 40 },
  { id: "suggest", name: "生成建议", description: "提供优化方案", weight: 40 },
];

export const FolderHealthCheckInputSchema = z.object({
  detailed: z.boolean().default(false),
});

export type FolderHealthCheckInput = z.infer<
  typeof FolderHealthCheckInputSchema
>;

export const FolderHealthCheckOutputSchema = z.object({
  status: z.enum(["healthy", "needs_attention", "critical"]),
  totalFolders: z.number(),
  healthyFolders: z.number(),
  mergeSuggestionsCount: z.number(),
  splitSuggestionsCount: z.number(),
});

export type FolderHealthCheckOutput = z.infer<
  typeof FolderHealthCheckOutputSchema
>;
```

```typescript
// src/lib/ai-skills/skills/folder-health-check/folder-health-check.skill.ts

import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type {
  OrchestrationSkillMetadata,
  OrchestrationContext,
  OrchestrationStreamChunk,
} from "../../orchestration/types";
import { FolderHealthService } from "@/lib/classification/services/folder-health.service";
import {
  FolderProfileRepository,
  SuggestionRepository,
} from "@/lib/classification/repositories";
import { createClient } from "@/lib/supabase/server";
import {
  FOLDER_HEALTH_STEPS,
  FolderHealthCheckInputSchema,
  FolderHealthCheckOutputSchema,
  type FolderHealthCheckInput,
  type FolderHealthCheckOutput,
} from "./types";

export class FolderHealthCheckSkill extends OrchestrationSkill<
  FolderHealthCheckInput,
  FolderHealthCheckOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "folder_health_check",
    name: "文件夹健康检查",
    description: "分析文件夹结构，发现问题并提供优化建议",
    category: "organizing",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["diagnose", "suggest", "action"],
    steps: FOLDER_HEALTH_STEPS,
  };

  readonly inputSchema = FolderHealthCheckInputSchema;
  readonly outputSchema = FolderHealthCheckOutputSchema;

  async parseInput(
    message: string,
    context: OrchestrationContext,
  ): Promise<FolderHealthCheckInput> {
    return { detailed: /详细|完整/.test(message) };
  }

  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const supabase = await createClient();

    // ✅ 创建服务实例（使用现有 FolderHealthService）
    const folderProfileRepo = new FolderProfileRepository(supabase);
    const suggestionRepo = new SuggestionRepository(supabase);
    const healthService = new FolderHealthService(
      folderProfileRepo,
      suggestionRepo,
      supabase,
    );

    this.initProgress(FOLDER_HEALTH_STEPS);

    // Step 1: 扫描
    yield* this.reportProgress("scan", 10, "正在扫描文件夹结构...");

    // Step 2: 诊断
    yield* this.reportProgress("diagnose", 30, "正在诊断问题...");
    const report = await healthService.checkHealth(context.userId);
    yield* this.reportProgress(
      "diagnose",
      60,
      `发现 ${report.foldersNeedingAttention} 个问题`,
    );

    // Step 3: 生成建议
    yield* this.reportProgress("suggest", 80, "正在生成优化建议...");

    // 输出健康报告
    const deliverable = this.createDeliverable(
      "report",
      "文件夹健康报告",
      {
        status: report.status,
        totalFolders: report.totalFolders,
        healthyFolders: report.healthyFolders,
        mergeSuggestions: report.mergeSuggestions,
        splitSuggestions: report.splitSuggestions,
      },
      "json",
      { metadata: { subType: "health_report" } },
    );
    yield* this.emitDeliverable(deliverable);

    // 输出文本摘要
    const statusEmoji =
      report.status === "healthy"
        ? "✅"
        : report.status === "needs_attention"
          ? "⚠️"
          : "🔴";
    yield* this.emitText(
      `${statusEmoji} **文件夹健康状态: ${report.status}**\n\n` +
        `- 总文件夹: ${report.totalFolders} 个\n` +
        `- 健康文件夹: ${report.healthyFolders} 个\n` +
        `- 合并建议: ${report.mergeSuggestions.length} 条\n` +
        `- 拆分建议: ${report.splitSuggestions.length} 条`,
    );

    yield* this.reportProgress("suggest", 100, "完成");
    yield* this.emitDone();
  }
}
```

---

### 5.3 SnapshotCompareSkill - 快照对比分析

封装现有的 `compareSnapshotsTool`：

```typescript
// src/lib/ai-skills/skills/snapshot-compare/types.ts

import { z } from "zod";

export const SnapshotCompareInputSchema = z.object({
  snapshotId: z.number().describe("当前快照 ID"),
  compareWithSnapshotId: z.number().optional().describe("对比目标快照 ID"),
  versionNumber: z.number().optional().describe("对比的历史版本号"),
});

export type SnapshotCompareInput = z.infer<typeof SnapshotCompareInputSchema>;

export const SnapshotCompareOutputSchema = z.object({
  hasChanges: z.boolean(),
  changeType: z.enum(["major", "minor", "none"]),
  summary: z.string(),
  similarityScore: z.number(),
  stats: z.object({
    addedLines: z.number(),
    removedLines: z.number(),
  }),
});

export type SnapshotCompareOutput = z.infer<typeof SnapshotCompareOutputSchema>;
```

```typescript
// src/lib/ai-skills/skills/snapshot-compare/snapshot-compare.skill.ts

import { BaseSkill } from "../../core/base-skill";
import type { SkillMetadata, SkillContext } from "../../core/types";
import { compareSnapshotsTool } from "@/lib/ai-agent/tools/snapshot/compare-snapshots.tool";
import {
  SnapshotCompareInputSchema,
  SnapshotCompareOutputSchema,
  type SnapshotCompareInput,
  type SnapshotCompareOutput,
} from "./types";

/**
 * 快照对比 Skill
 * 封装现有的 compareSnapshotsTool，作为原子 Skill 暴露
 */
export class SnapshotCompareSkill extends BaseSkill<
  SnapshotCompareInput,
  SnapshotCompareOutput
> {
  readonly metadata: SkillMetadata = {
    id: "snapshot_compare",
    name: "快照对比分析",
    description: "对比书签内容的历史快照，发现页面变化",
    category: "utility",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["compare", "highlight", "notify"],
  };

  readonly inputSchema = SnapshotCompareInputSchema;
  readonly outputSchema = SnapshotCompareOutputSchema;

  protected async executeInternal(
    input: SnapshotCompareInput,
    context: SkillContext,
  ): Promise<SnapshotCompareOutput> {
    // ✅ 直接调用现有 Tool
    const result = await compareSnapshotsTool.execute(
      {
        snapshotId: input.snapshotId,
        compareWithSnapshotId: input.compareWithSnapshotId,
        versionNumber: input.versionNumber,
      },
      { userId: context.userId },
    );

    if (!result.success || !result.data) {
      throw new Error(result.error || "快照对比失败");
    }

    const data = result.data;

    return {
      hasChanges: data.hasSignificantChanges,
      changeType: data.hasSignificantChanges
        ? "major"
        : data.stats.totalChanges > 0
          ? "minor"
          : "none",
      summary: data.summary,
      similarityScore: data.stats.similarityScore,
      stats: {
        addedLines: data.stats.addedLines,
        removedLines: data.stats.removedLines,
      },
    };
  }
}
```

---

## 6. 注册与配置

### 6.1 Skill 注册

```typescript
// src/lib/ai-skills/register.ts 扩展

import { skillRegistry } from "./core/skill-registry";
import { unifiedEngine } from "./engine/unified-engine";

// P0 Skills
import { InboxTriageSkill } from "./skills/inbox-triage";
import { FolderRecommendSkill } from "./skills/folder-recommend";
import { SearchOptimizeSkill } from "./skills/search-optimize";

// P1 Skills
import { KnowledgeGraphExploreSkill } from "./skills/knowledge-graph-explore";
import { FolderHealthCheckSkill } from "./skills/folder-health-check";
import { SnapshotCompareSkill } from "./skills/snapshot-compare";

export function registerNewSkills() {
  // ============================================
  // P0 Skills
  // ============================================

  // InboxTriageSkill - 编排类型
  if (process.env.ENABLE_INBOX_TRIAGE !== "false") {
    unifiedEngine.registerOrchestrationSkill(new InboxTriageSkill());
  }

  // FolderRecommendSkill - 原子类型
  if (process.env.ENABLE_FOLDER_RECOMMEND !== "false") {
    skillRegistry.register(new FolderRecommendSkill(), { enabled: true });
  }

  // SearchOptimizeSkill - 原子类型
  if (process.env.ENABLE_SEARCH_OPTIMIZE !== "false") {
    skillRegistry.register(new SearchOptimizeSkill(), { enabled: true });
  }

  // ============================================
  // P1 Skills
  // ============================================

  // KnowledgeGraphExploreSkill - 编排类型
  if (process.env.ENABLE_KNOWLEDGE_GRAPH_EXPLORE !== "false") {
    unifiedEngine.registerOrchestrationSkill(new KnowledgeGraphExploreSkill());
  }

  // FolderHealthCheckSkill - 编排类型
  if (process.env.ENABLE_FOLDER_HEALTH_CHECK !== "false") {
    unifiedEngine.registerOrchestrationSkill(new FolderHealthCheckSkill());
  }

  // SnapshotCompareSkill - 原子类型
  if (process.env.ENABLE_SNAPSHOT_COMPARE !== "false") {
    skillRegistry.register(new SnapshotCompareSkill(), { enabled: true });
  }
}
```

### 6.2 Feature Flag 配置

```bash
# .env.local

# P0 Skills (默认启用)
ENABLE_INBOX_TRIAGE=true
ENABLE_FOLDER_RECOMMEND=true
ENABLE_SEARCH_OPTIMIZE=true

# P1 Skills (默认启用)
ENABLE_KNOWLEDGE_GRAPH_EXPLORE=true
ENABLE_FOLDER_HEALTH_CHECK=true
ENABLE_SNAPSHOT_COMPARE=true
```

### 6.3 意图规则注册

```typescript
// src/lib/ai-agent/classification/rules/index.ts 扩展

import { inboxTriageRules } from "./inbox-triage.rules";
import { folderRecommendRules } from "./folder-recommend.rules";
import { searchOptimizeRules } from "./search-optimize.rules";
import { knowledgeGraphRules } from "./knowledge-graph.rules";
import { folderHealthRules } from "./folder-health.rules";
import { snapshotCompareRules } from "./snapshot-compare.rules";

export const newSkillRules: IntentRule[] = [
  ...inboxTriageRules,
  ...folderRecommendRules,
  ...searchOptimizeRules,
  ...knowledgeGraphRules,
  ...folderHealthRules,
  ...snapshotCompareRules,
];
```

---

## 7. 前端组件扩展

### 7.1 交付物渲染器映射

由于使用规范的 DeliverableType，前端只需扩展现有渲染器：

```typescript
// src/components/ai/deliverables/index.ts

import { ListDeliverable } from "./list-deliverable";
import { ReportDeliverable } from "./report-deliverable";
import { GraphDeliverable } from "./graph-deliverable";

export const deliverableRenderers: Record<
  string,
  React.ComponentType<{ data: unknown; metadata?: unknown }>
> = {
  // 现有渲染器
  document: DocumentDeliverable,
  report: ReportDeliverable,
  list: ListDeliverable,
  graph: GraphDeliverable,

  // 无需新增，通过 metadata.subType 区分：
  // - list + subType: action_plan → ActionPlanListRenderer
  // - report + subType: health_report → HealthReportRenderer
  // - graph + subType: force-directed-graph → ForceDirectedGraphRenderer
};
```

### 7.2 List 渲染器扩展（支持 action_plan 子类型）

```typescript
// src/components/ai/deliverables/list-deliverable.tsx

export function ListDeliverable({ data, metadata }: { data: unknown; metadata?: { subType?: string } }) {
  // 根据 subType 选择渲染方式
  if (metadata?.subType === "action_plan") {
    return <ActionPlanList data={data} />;
  }

  // 默认列表渲染
  return <DefaultList data={data} />;
}

function ActionPlanList({ data }: { data: { items: Array<{ id: string; action: string; bookmarkCount: number; confidence: number }> } }) {
  const [executedActions, setExecutedActions] = useState<Set<string>>(new Set());

  return (
    <Card className="mt-4 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          整理方案
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.items.map(item => (
          <div
            key={item.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border",
              executedActions.has(item.id) && "bg-muted opacity-60"
            )}
          >
            <div>
              <span className="font-medium">{item.action}</span>
              <span className="text-muted-foreground ml-2">
                {item.bookmarkCount} 条书签
              </span>
              <Badge variant="outline" className="ml-2">
                {item.confidence}%
              </Badge>
            </div>
            <Button
              size="sm"
              disabled={executedActions.has(item.id)}
              onClick={() => setExecutedActions(prev => new Set([...prev, item.id]))}
            >
              {executedActions.has(item.id) ? "已执行" : "执行"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

---

## 8. 测试策略

### 8.1 单元测试示例

```typescript
// src/lib/ai-skills/skills/inbox-triage/__tests__/inbox-triage.skill.test.ts

import { InboxTriageSkill } from "../inbox-triage.skill";
import { createMockOrchestrationContext } from "@/lib/ai-skills/__tests__/helpers";

describe("InboxTriageSkill", () => {
  let skill: InboxTriageSkill;

  beforeEach(() => {
    skill = new InboxTriageSkill();
  });

  describe("metadata", () => {
    it("should have valid metadata", () => {
      expect(skill.metadata.id).toBe("inbox_triage");
      expect(skill.metadata.category).toBe("organizing");
      expect(skill.metadata.author).toBe("AnyKeep");
      expect(skill.metadata.steps).toHaveLength(4);
    });
  });

  describe("parseInput", () => {
    it("should parse auto-execute intent", async () => {
      const context = createMockOrchestrationContext();
      const input = await skill.parseInput("自动整理收件箱", context);
      expect(input.autoExecute).toBe(true);
    });

    it("should parse max items from message", async () => {
      const context = createMockOrchestrationContext();
      const input = await skill.parseInput("整理 100 条未分类书签", context);
      expect(input.maxItems).toBe(100);
    });
  });

  describe("executeStream", () => {
    it("should emit progress chunks", async () => {
      const context = createMockOrchestrationContext({
        parsedInput: { autoExecute: false, maxItems: 50 },
      });

      const chunks: unknown[] = [];
      for await (const chunk of skill.executeStream(context)) {
        chunks.push(chunk);
      }

      const progressChunks = chunks.filter(
        (c) => (c as { type: string }).type === "progress",
      );
      expect(progressChunks.length).toBeGreaterThanOrEqual(4);
    });
  });
});
```

---

## 9. 实施计划

### 9.1 Phase 1: 适配层 + P0 Skills (Week 1-2)

| 天数     | 任务                                                   | 产出            |
| -------- | ------------------------------------------------------ | --------------- |
| Day 1    | 创建适配层 (InboxServiceAdapter, FolderServiceAdapter) | 2 个适配器      |
| Day 2-3  | InboxTriageSkill 实现 + 测试                           | Skill + 10 测试 |
| Day 4    | FolderRecommendSkill 实现 + 测试                       | Skill + 8 测试  |
| Day 5    | SearchOptimizeSkill 实现 + 测试                        | Skill + 8 测试  |
| Day 6-7  | 意图规则 + 注册集成                                    | 完整路由        |
| Day 8    | 前端 ListDeliverable 扩展                              | 组件更新        |
| Day 9-10 | 集成测试 + 修复                                        | 稳定版本        |

### 9.2 Phase 2: P1 Skills (Week 3-4)

| 天数      | 任务                       | 产出           |
| --------- | -------------------------- | -------------- |
| Day 11-12 | KnowledgeGraphExploreSkill | Skill + 可视化 |
| Day 13-14 | FolderHealthCheckSkill     | Skill + 报告   |
| Day 15    | SnapshotCompareSkill       | Skill + 对比   |
| Day 16-17 | 全量集成测试               | 回归通过       |
| Day 18-20 | 文档 + 发布                | 上线           |

### 9.3 验收标准

- [ ] 所有新 Skills 单元测试覆盖率 > 80%
- [ ] 集成测试全部通过
- [ ] 意图识别准确率 > 85%
- [ ] 前端交付物渲染正常
- [ ] Feature Flag 可控开关
- [ ] 无现有功能回归
- [ ] **所有 metadata 包含 category 和 author**
- [ ] **所有 DeliverableType 使用规范枚举值**
- [ ] **所有注册方式符合规范（原子用 skillRegistry，编排用 unifiedEngine）**

---

## 10. 附录

### 10.1 规范合规检查清单

| 检查项                                                   | 状态      |
| -------------------------------------------------------- | --------- |
| metadata.category 必填                                   | ✅ 已修正 |
| metadata.author 必填                                     | ✅ 已修正 |
| Steps 使用外部常量                                       | ✅ 已修正 |
| DeliverableType 使用规范枚举                             | ✅ 已修正 |
| 使用 createDeliverable() + emitDeliverable()             | ✅ 已修正 |
| 原子 Skill 用 skillRegistry.register()                   | ✅ 已修正 |
| 编排 Skill 用 unifiedEngine.registerOrchestrationSkill() | ✅ 已修正 |
| 无构造函数依赖注入                                       | ✅ 已修正 |
| 使用 createClient() 或单例服务                           | ✅ 已修正 |

### 10.2 新增文件清单

```
新增文件:
src/lib/ai-skills/adapters/
├── inbox-service.adapter.ts
├── folder-service.adapter.ts
└── index.ts

src/lib/ai-skills/skills/inbox-triage/
├── index.ts
├── inbox-triage.skill.ts
├── types.ts
└── __tests__/inbox-triage.skill.test.ts

src/lib/ai-skills/skills/folder-recommend/
├── index.ts
├── folder-recommend.skill.ts
├── types.ts
└── __tests__/folder-recommend.skill.test.ts

src/lib/ai-skills/skills/search-optimize/
├── index.ts
├── search-optimize.skill.ts
├── types.ts
└── __tests__/search-optimize.skill.test.ts

src/lib/ai-skills/skills/knowledge-graph-explore/
├── index.ts
├── knowledge-graph-explore.skill.ts
├── types.ts
└── __tests__/knowledge-graph-explore.skill.test.ts

src/lib/ai-skills/skills/folder-health-check/
├── index.ts
├── folder-health-check.skill.ts
├── types.ts
└── __tests__/folder-health-check.skill.test.ts

src/lib/ai-skills/skills/snapshot-compare/
├── index.ts
├── snapshot-compare.skill.ts
├── types.ts
└── __tests__/snapshot-compare.skill.test.ts

src/lib/ai-agent/classification/rules/
├── inbox-triage.rules.ts
├── folder-recommend.rules.ts
├── search-optimize.rules.ts
├── knowledge-graph.rules.ts
├── folder-health.rules.ts
└── snapshot-compare.rules.ts

修改文件:
src/lib/ai-skills/register.ts
src/lib/ai-agent/classification/rules/index.ts
src/components/ai/deliverables/list-deliverable.tsx
```

### 10.3 依赖服务状态

| 服务/函数            | 位置                           | 状态    | 调用方式                      |
| -------------------- | ------------------------------ | ------- | ----------------------------- |
| useInboxOrganization | `hooks/domain/ai/`             | ✅ 已有 | 通过适配器封装 API            |
| recommendFolder      | `lib/ai-generator/folder/`     | ✅ 已有 | 通过适配器封装                |
| GraphBuilderService  | `lib/knowledge-link/services/` | ✅ 已有 | 单例 getGraphBuilderService() |
| FolderHealthService  | `lib/classification/services/` | ✅ 已有 | 实例化调用                    |
| compareSnapshotsTool | `lib/ai-agent/tools/snapshot/` | ✅ 已有 | 直接调用 Tool                 |
