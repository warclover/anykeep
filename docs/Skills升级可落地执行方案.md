# AnyKeep AI Skills 升级 - 可落地执行方案

> **版本**: 1.0.0
> **日期**: 2025-12-23
> **状态**: 🟡 待审核
> **预计工期**: 3.5 周

---

## 目录

1. [执行概要](#1-执行概要)
2. [Phase 1: 整理类 Skills](#2-phase-1-整理类-skills)
3. [Phase 2: 研究类 Skills](#3-phase-2-研究类-skills)
4. [Phase 3: 洞察类 Skills](#4-phase-3-洞察类-skills)
5. [Phase 4: UI 增强](#5-phase-4-ui-增强)
6. [集成与发布](#6-集成与发布)
7. [验收标准](#7-验收标准)

---

## 1. 执行概要

### 1.1 目标产出

| 阶段     | 产出                 | 工期      |
| -------- | -------------------- | --------- |
| Phase 1  | 2 个整理类 Skills    | 5 天      |
| Phase 2  | 2 个研究类 Skills    | 5 天      |
| Phase 3  | 2 个洞察类 Skills    | 4 天      |
| Phase 4  | UI 增强组件          | 3 天      |
| **总计** | **6 个 Skills + UI** | **17 天** |

### 1.2 技术约束

```typescript
// 所有新 Skills 必须遵循的模式
// 参考: src/lib/ai-skills/skills/classify/classify.skill.ts

export class NewSkill extends BaseSkill<Input, Output> {
  readonly metadata: SkillMetadata = {
    /* ... */
  };
  readonly inputSchema = z.object({
    /* ... */
  });
  readonly outputSchema = z.object({
    /* ... */
  });

  protected async executeInternal(input, context): Promise<Output> {
    // 1. 通过 toolRegistry 复用现有 Tools
    // 2. 不直接访问数据库，通过服务层
    // 3. 返回结构化结果
  }
}
```

### 1.3 文件结构规划

```
src/lib/ai-skills/skills/
├── classify/                 # ✅ 现有
├── search/                   # ✅ 现有
├── summary/                  # ✅ 现有
│
├── organize/                 # 🆕 Phase 1
│   ├── index.ts
│   ├── types.ts
│   ├── smart-organize.skill.ts
│   └── folder-health.skill.ts
│
├── research/                 # 🆕 Phase 2
│   ├── index.ts
│   ├── types.ts
│   ├── topic-research.skill.ts
│   └── content-digest.skill.ts
│
├── insights/                 # 🆕 Phase 3
│   ├── index.ts
│   ├── types.ts
│   ├── collection-insights.skill.ts
│   └── interview-prep.skill.ts
│
└── index.ts                  # 更新：导出所有 Skills
```

---

## 2. Phase 1: 整理类 Skills (5天)

### 2.1 Skill 1: 智能整理助手 `smart_organize`

#### 文件: `src/lib/ai-skills/skills/organize/smart-organize.skill.ts`

```typescript
/**
 * SmartOrganizeSkill - 智能整理助手
 *
 * 功能：
 * - 分析收藏现状（分布、重复、未分类）
 * - 生成整理建议
 * - 支持批量执行整理操作
 */

import { z } from "zod";
import { BaseSkill } from "../../core/base-skill";
import type { SkillMetadata, SkillContext } from "../../core/types";
import { toolRegistry } from "@/lib/ai-agent/tools";

// ============================================
// Schema 定义
// ============================================

const InputSchema = z.object({
  scope: z
    .enum(["all", "unclassified", "folder", "duplicates"])
    .default("unclassified")
    .describe("整理范围"),
  folderId: z.number().int().positive().optional(),
  dryRun: z.boolean().default(true).describe("仅预览不执行"),
  maxSuggestions: z.number().int().min(1).max(20).default(10),
});

const SuggestionSchema = z.object({
  id: z.string(),
  action: z.enum(["move", "merge", "delete", "tag", "archive"]),
  description: z.string(),
  reason: z.string(),
  affectedItems: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
    }),
  ),
  targetFolderId: z.number().optional(),
  targetFolderName: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]),
});

const OutputSchema = z.object({
  summary: z.string(),
  stats: z.object({
    totalBookmarks: z.number(),
    unclassified: z.number(),
    duplicates: z.number(),
    emptyFolders: z.number(),
  }),
  suggestions: z.array(SuggestionSchema),
  executed: z.boolean(),
  executedCount: z.number().optional(),
});

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

// ============================================
// Skill 实现
// ============================================

export class SmartOrganizeSkill extends BaseSkill<Input, Output> {
  readonly metadata: SkillMetadata = {
    id: "smart_organize",
    name: "智能整理助手",
    description:
      "分析收藏现状，识别问题（未分类、重复、空文件夹），生成整理建议，可批量执行。",
    category: "organizing",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "analyze-distribution",
      "detect-duplicates",
      "suggest-organization",
      "batch-execute",
    ],
    requiresConfirmation: true,
    estimatedDurationMs: 5000,
    maxExecutionTimeMs: 30000,
  };

  readonly inputSchema = InputSchema;
  readonly outputSchema = OutputSchema;

  protected async executeInternal(
    input: Input,
    context: SkillContext,
  ): Promise<Output> {
    const { scope, folderId, dryRun, maxSuggestions } = input;
    const toolContext = { userId: context.userId };

    // Step 1: 收集统计数据（复用现有 Tools）
    const [statsResult, foldersResult] = await Promise.all([
      toolRegistry.execute("get_stats", {}, toolContext),
      toolRegistry.execute(
        "list_folders",
        { includeArchived: true },
        toolContext,
      ),
    ]);

    const stats = {
      totalBookmarks: statsResult.data?.total || 0,
      unclassified: statsResult.data?.unclassified || 0,
      duplicates: 0,
      emptyFolders: (foldersResult.data || []).filter(
        (f: any) => f.bookmarkCount === 0,
      ).length,
    };

    // Step 2: 获取待整理内容
    let targetBookmarks: any[] = [];
    if (scope === "unclassified" || scope === "all") {
      const inboxResult = await toolRegistry.execute(
        "get_folder_bookmarks",
        { folderId: null, limit: 50 },
        toolContext,
      );
      targetBookmarks = inboxResult.data?.bookmarks || [];
    }

    // Step 3: 生成建议
    const suggestions: z.infer<typeof SuggestionSchema>[] = [];

    if (targetBookmarks.length > 0) {
      suggestions.push({
        id: `organize-${Date.now()}`,
        action: "move",
        description: `将 ${targetBookmarks.length} 个未分类书签进行智能分类`,
        reason: "这些书签在「待整理」中，建议使用智能分类功能自动归档",
        affectedItems: targetBookmarks.slice(0, 10).map((b: any) => ({
          id: b.id,
          title: b.title,
        })),
        priority: targetBookmarks.length > 20 ? "high" : "medium",
      });
    }

    // Step 4: 执行（如果不是 dryRun）
    let executedCount = 0;
    if (!dryRun && suggestions.length > 0) {
      // 调用 auto_classify_inbox 执行自动分类
      const classifyResult = await toolRegistry.execute(
        "auto_classify_inbox",
        { limit: 20 },
        toolContext,
      );
      if (classifyResult.success) {
        executedCount = classifyResult.data?.classifiedCount || 0;
      }
    }

    return {
      summary: `共 ${stats.totalBookmarks} 个收藏，${stats.unclassified} 个待整理，生成 ${suggestions.length} 条建议。`,
      stats,
      suggestions: suggestions.slice(0, maxSuggestions),
      executed: !dryRun,
      executedCount: dryRun ? undefined : executedCount,
    };
  }
}

export const smartOrganizeSkill = new SmartOrganizeSkill();
```

#### 单元测试: `__tests__/smart-organize.skill.test.ts`

```typescript
import { smartOrganizeSkill } from "../smart-organize.skill";

describe("SmartOrganizeSkill", () => {
  describe("metadata", () => {
    it("should have correct id", () => {
      expect(smartOrganizeSkill.metadata.id).toBe("smart_organize");
    });

    it("should require confirmation", () => {
      expect(smartOrganizeSkill.metadata.requiresConfirmation).toBe(true);
    });
  });

  describe("input validation", () => {
    it("should accept empty input with defaults", () => {
      const result = smartOrganizeSkill.validateInput({});
      expect(result.scope).toBe("unclassified");
      expect(result.dryRun).toBe(true);
    });

    it("should reject invalid scope", () => {
      expect(() =>
        smartOrganizeSkill.validateInput({ scope: "invalid" }),
      ).toThrow();
    });
  });
});
```

#### 验收标准

| 编号 | 验收项   | 通过标准                                      |
| ---- | -------- | --------------------------------------------- |
| 1.1  | 输入验证 | 支持 scope/dryRun/maxSuggestions 参数         |
| 1.2  | 统计数据 | 返回 totalBookmarks/unclassified/emptyFolders |
| 1.3  | 建议生成 | 返回结构化的 suggestions 数组                 |
| 1.4  | 预览模式 | dryRun=true 时不执行任何操作                  |
| 1.5  | 执行模式 | dryRun=false 时调用 auto_classify_inbox       |
| 1.6  | 测试覆盖 | 单元测试覆盖率 > 80%                          |

---

### 2.2 Skill 2: 文件夹健康检查 `folder_health_check`

#### 文件: `src/lib/ai-skills/skills/organize/folder-health.skill.ts`

```typescript
/**
 * FolderHealthSkill - 文件夹健康检查
 */

import { z } from "zod";
import { BaseSkill } from "../../core/base-skill";
import type { SkillMetadata, SkillContext } from "../../core/types";
import { toolRegistry } from "@/lib/ai-agent/tools";

const InputSchema = z.object({
  includeArchived: z.boolean().default(false),
});

const IssueSchema = z.object({
  folderId: z.number(),
  folderName: z.string(),
  issueType: z.enum(["empty", "oversize", "similar", "deep_nesting"]),
  severity: z.enum(["critical", "warning", "info"]),
  description: z.string(),
  suggestion: z.string(),
});

const OutputSchema = z.object({
  healthScore: z.number().min(0).max(100),
  totalFolders: z.number(),
  issues: z.array(IssueSchema),
  summary: z.string(),
  recommendations: z.array(z.string()),
});

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

export class FolderHealthSkill extends BaseSkill<Input, Output> {
  readonly metadata: SkillMetadata = {
    id: "folder_health_check",
    name: "文件夹健康检查",
    description:
      "检查文件夹结构健康度，识别空文件夹、过大文件夹等问题，提供优化建议。",
    category: "organizing",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "health-score",
      "detect-empty",
      "detect-oversize",
      "recommendations",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 3000,
  };

  readonly inputSchema = InputSchema;
  readonly outputSchema = OutputSchema;

  protected async executeInternal(
    input: Input,
    context: SkillContext,
  ): Promise<Output> {
    const toolContext = { userId: context.userId };

    // 获取文件夹列表
    const foldersResult = await toolRegistry.execute(
      "list_folders",
      { includeArchived: input.includeArchived },
      toolContext,
    );

    const folders = foldersResult.data || [];
    const issues: z.infer<typeof IssueSchema>[] = [];

    // 检测问题
    for (const folder of folders) {
      if (folder.bookmarkCount === 0 && !folder.isArchived) {
        issues.push({
          folderId: folder.id,
          folderName: folder.name,
          issueType: "empty",
          severity: "warning",
          description: `「${folder.name}」是空文件夹`,
          suggestion: "建议删除或归档此空文件夹",
        });
      }

      if (folder.bookmarkCount > 100) {
        issues.push({
          folderId: folder.id,
          folderName: folder.name,
          issueType: "oversize",
          severity: folder.bookmarkCount > 200 ? "critical" : "warning",
          description: `「${folder.name}」包含 ${folder.bookmarkCount} 个书签`,
          suggestion: "建议拆分为更细粒度的子文件夹",
        });
      }
    }

    // 计算健康分数
    const healthScore = Math.max(0, 100 - issues.length * 10);

    // 生成建议
    const recommendations: string[] = [];
    const emptyCount = issues.filter((i) => i.issueType === "empty").length;
    if (emptyCount > 3) {
      recommendations.push(`有 ${emptyCount} 个空文件夹，建议批量清理`);
    }
    if (recommendations.length === 0) {
      recommendations.push("文件夹结构良好！");
    }

    return {
      healthScore,
      totalFolders: folders.length,
      issues,
      summary: `健康度 ${healthScore} 分，共 ${folders.length} 个文件夹，发现 ${issues.length} 个问题。`,
      recommendations,
    };
  }
}

export const folderHealthSkill = new FolderHealthSkill();
```

#### 验收标准

| 编号 | 验收项         | 通过标准                  |
| ---- | -------------- | ------------------------- |
| 2.1  | 获取文件夹     | 能获取所有文件夹列表      |
| 2.2  | 检测空文件夹   | issues 包含 empty 类型    |
| 2.3  | 检测过大文件夹 | issues 包含 oversize 类型 |
| 2.4  | 健康评分       | 返回 0-100 的 healthScore |
| 2.5  | 优化建议       | 返回 recommendations 数组 |

---

## 3. Phase 2: 研究类 Skills (5天)

### 3.1 Skill 3: 主题研究助手 `topic_research`

```typescript
// 核心实现逻辑
protected async executeInternal(input, context) {
  // 1. 语义搜索（复用 semantic_search Tool）
  const searchResult = await toolRegistry.execute("semantic_search", { query: input.topic }, context);

  // 2. 聚类分析（按标签分组）
  const clusters = this.clusterByTags(searchResult.data.bookmarks);

  // 3. 生成报告
  const report = this.generateReport(input.topic, clusters);

  return { topic: input.topic, items: searchResult.data.bookmarks, clusters, report };
}
```

#### 验收标准

| 编号 | 验收项   | 通过标准                          |
| ---- | -------- | --------------------------------- |
| 3.1  | 语义搜索 | 调用 semantic_search 返回相关结果 |
| 3.2  | 聚类分析 | 按标签生成 clusters               |
| 3.3  | Top Tags | 统计高频标签                      |
| 3.4  | 导出功能 | 支持 Markdown 格式导出            |

---

### 3.2 Skill 4: 内容摘要生成 `content_digest`

```typescript
// 核心实现逻辑
protected async executeInternal(input, context) {
  // 1. 根据来源获取书签
  const bookmarks = await this.getBookmarksBySource(input.source, input.folderId, context);

  // 2. 提取关键信息（从标签和标题）
  const keyPoints = this.extractKeyPoints(bookmarks);

  // 3. 生成摘要（支持 bullet/outline/narrative 格式）
  const digest = this.formatDigest(bookmarks, keyPoints, input.format);

  return { digest, keyPoints, itemCount: bookmarks.length };
}
```

#### 验收标准

| 编号 | 验收项     | 通过标准                      |
| ---- | ---------- | ----------------------------- |
| 4.1  | 三种来源   | 支持 folder/recent/bookmarks  |
| 4.2  | 三种格式   | 支持 bullet/outline/narrative |
| 4.3  | 关键点提取 | 返回 keyPoints 数组           |

---

## 4. Phase 3: 洞察类 Skills (4天)

### 4.1 Skill 5: 收藏洞察分析 `collection_insights`

```typescript
// 输出结构
{
  summary: "你共有 156 条收藏，主要集中在前端开发领域",
  interestProfile: {
    topCategories: ["前端", "React", "性能优化"],
    trendingTags: ["AI", "LLM"],
  },
  statistics: {
    byPlatform: { WECHAT: 42, BROWSER_CHROME: 68, ... },
    byMonth: { "2025-12": 23, "2025-11": 31, ... },
  },
  recommendations: ["建议清理 3 个空文件夹", "「前端」文件夹内容较多，建议拆分"],
}
```

### 4.2 Skill 6: 面试准备助手 `interview_prep`

```typescript
// 输出结构
{
  direction: "前端",
  techStack: "React",
  prepDays: 5,
  knowledgePoints: [
    { topic: "React Hooks", coverage: "high", resources: 12 },
    { topic: "性能优化", coverage: "medium", resources: 6 },
    { topic: "SSR", coverage: "low", resources: 2 },
  ],
  studyPlan: [
    { day: 1, focus: "React Hooks", tasks: [...] },
    { day: 2, focus: "状态管理", tasks: [...] },
  ],
  exportedContent: "...", // Markdown 格式的复习资料
}
```

---

## 5. Phase 4: UI 增强 (3天)

### 5.1 进度可视化组件

#### 文件: `src/components/ai/skill-progress.tsx`

```tsx
export function SkillProgress({ skillName, steps, currentStep, totalSteps }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex justify-between mb-2">
        <span>{skillName}</span>
        <span>
          {currentStep}/{totalSteps}
        </span>
      </div>
      <Progress value={(currentStep / totalSteps) * 100} />
      <div className="mt-2 space-y-1">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            {step.status === "completed" && (
              <CheckCircle className="text-green-500" />
            )}
            {step.status === "running" && <Loader2 className="animate-spin" />}
            {step.status === "pending" && <Clock className="text-muted" />}
            <span>{step.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5.2 交付物展示组件

#### 文件: `src/components/ai/skill-deliverable.tsx`

```tsx
export function SkillDeliverable({
  title,
  format,
  content,
  onDownload,
  onCopy,
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row justify-between">
        <CardTitle>{title}</CardTitle>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCopy}>
            <Copy />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDownload}>
            <Download />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="text-xs bg-muted p-3 rounded max-h-60 overflow-auto">
          {content.slice(0, 500)}
          {content.length > 500 && "..."}
        </pre>
      </CardContent>
    </Card>
  );
}
```

### 5.3 AI 面板集成

在 `ai-assistant-panel.tsx` 中添加 Skill 快捷入口：

```tsx
<div className="grid grid-cols-4 gap-2 p-2">
  <Button
    variant="outline"
    size="sm"
    onClick={() => runSkill("smart_organize")}
  >
    <Wand2 className="mr-1 h-4 w-4" />
    整理
  </Button>
  <Button
    variant="outline"
    size="sm"
    onClick={() => runSkill("topic_research")}
  >
    <Search className="mr-1 h-4 w-4" />
    研究
  </Button>
  <Button
    variant="outline"
    size="sm"
    onClick={() => runSkill("collection_insights")}
  >
    <BarChart className="mr-1 h-4 w-4" />
    洞察
  </Button>
  <Button
    variant="outline"
    size="sm"
    onClick={() => runSkill("content_digest")}
  >
    <FileText className="mr-1 h-4 w-4" />
    摘要
  </Button>
</div>
```

---

## 6. 集成与发布

### 6.1 注册新 Skills

```typescript
// src/lib/ai-skills/register.ts

import { smartOrganizeSkill, folderHealthSkill } from "./skills/organize";
import { topicResearchSkill, contentDigestSkill } from "./skills/research";
import { collectionInsightsSkill, interviewPrepSkill } from "./skills/insights";

const DEFAULT_SKILLS = [
  // 现有
  { skill: searchSkill, enabled: true },
  { skill: classifySkill, enabled: true },
  { skill: summarySkill, enabled: true },
  // Phase 1
  { skill: smartOrganizeSkill, enabled: true },
  { skill: folderHealthSkill, enabled: true },
  // Phase 2
  { skill: topicResearchSkill, enabled: true },
  { skill: contentDigestSkill, enabled: true },
  // Phase 3
  { skill: collectionInsightsSkill, enabled: true },
  { skill: interviewPrepSkill, enabled: true },
];
```

### 6.2 更新系统提示语

```typescript
// knowledge-agent.ts

const DEFAULT_SYSTEM_PROMPT = `...

## 高级 Skills

- smart_organize(scope?, dryRun?) → 智能整理收藏
- folder_health_check() → 文件夹健康检查
- topic_research(topic) → 主题研究
- content_digest(source, folderId?) → 内容摘要
- collection_insights() → 收藏洞察
- interview_prep(direction) → 面试准备

## 使用示例

用户: "帮我整理一下" → 调用 smart_organize()
用户: "准备前端面试" → 调用 interview_prep(direction="frontend")
`;
```

### 6.3 发布流程

```
Day 1-3:   Feature Flag 内测 (ai_skills_v2=false)
Day 4-5:   灰度 10%
Day 6-7:   灰度 50%
Day 8:     全量发布
```

---

## 7. 验收标准汇总

### 7.1 功能验收矩阵

| Skill               | 核心功能 | 输入验证 | 输出格式 | 错误处理 | 测试覆盖 |
| ------------------- | -------- | -------- | -------- | -------- | -------- |
| smart_organize      | ⬜       | ⬜       | ⬜       | ⬜       | ⬜       |
| folder_health_check | ⬜       | ⬜       | ⬜       | ⬜       | ⬜       |
| topic_research      | ⬜       | ⬜       | ⬜       | ⬜       | ⬜       |
| content_digest      | ⬜       | ⬜       | ⬜       | ⬜       | ⬜       |
| collection_insights | ⬜       | ⬜       | ⬜       | ⬜       | ⬜       |
| interview_prep      | ⬜       | ⬜       | ⬜       | ⬜       | ⬜       |

### 7.2 性能指标

| 指标           | 目标值 |
| -------------- | ------ |
| Skill 响应时间 | < 5s   |
| 内存增量       | < 10MB |
| 错误率         | < 1%   |
| 测试覆盖率     | > 80%  |

### 7.3 发布检查清单

- [ ] 所有 Skill 单元测试通过
- [ ] 集成测试通过
- [ ] 系统提示语更新
- [ ] UI 组件集成
- [ ] Feature Flag 配置
- [ ] 监控告警配置
- [ ] 用户文档更新

---

**请审核此可落地执行方案。**
