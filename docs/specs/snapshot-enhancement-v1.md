# 快照系统增强规范 v1.0

> **优先级**: P2 - 中优先级
> **版本**: v1.0
> **日期**: 2025-12-27
> **状态**: 待审核

---

## 1. 概述

### 1.1 目标

增强 AnyKeep 快照系统，支持：

1. **快照对比** - 检测同一页面不同时间点的内容变化
2. **内容变更监控** - 自动监控重要页面，发现变化时通知用户

### 1.2 核心功能

| 功能                     | 类型  | 说明                                      |
| ------------------------ | ----- | ----------------------------------------- |
| `compare_snapshots`      | Tool  | AI Agent 可调用的快照对比工具（原子操作） |
| `content_change_monitor` | Skill | 编排型技能，支持完整监控流程（多步编排）  |

### 1.3 设计原则

- **最小侵入**: 复用现有快照基础设施，避免大规模重构
- **渐进增强**: 历史版本支持作为可选功能，不影响现有快照逻辑
- **成本可控**: 合理的配额限制，防止资源滥用
- **规范一致**: 完全遵循 AnyKeep 现有 Tools/Skills 设计规范

---

## 2. 架构变更

### 2.1 快照历史版本支持

**当前限制**: `idx_snapshots_bookmark_unique` 约束限制每个书签只有一个有效快照

**解决方案**: 引入 `snapshot_versions` 表存储历史版本

```
┌─────────────────────┐       ┌─────────────────────┐
│  bookmark_snapshots │       │  snapshot_versions  │
│  (当前有效快照)      │  1:N  │  (历史版本存档)      │
│                     │ ────► │                     │
│  id, bookmark_id,   │       │  id, snapshot_id,   │
│  content, hash...   │       │  content, hash,     │
│                     │       │  archived_at        │
└─────────────────────┘       └─────────────────────┘
```

**版本保留策略**:

- 免费用户: 保留 1 个历史版本
- Pro 用户: 保留 3 个历史版本
- 超出时自动删除最旧版本

### 2.2 页面监控基础设施

```
┌─────────────────────┐       ┌─────────────────────┐
│    page_monitors    │       │  monitor_check_logs │
│    (监控配置)        │  1:N  │  (检查记录)          │
│                     │ ────► │                     │
│  id, bookmark_id,   │       │  id, monitor_id,    │
│  interval, status   │       │  result, checked_at │
└─────────────────────┘       └─────────────────────┘
         │
         │ 触发
         ▼
┌─────────────────────┐
│     Job Queue       │
│  (check_page_change)│
└─────────────────────┘
```

---

## 3. 数据库设计

### 3.1 snapshot_versions 表

```sql
-- 快照历史版本表
CREATE TABLE snapshot_versions (
    id BIGSERIAL PRIMARY KEY,

    -- 关联当前快照
    snapshot_id BIGINT NOT NULL REFERENCES bookmark_snapshots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,

    -- 存档的内容（从原快照复制）
    readable_content TEXT,
    readable_text_content TEXT,
    readable_excerpt TEXT,
    content_hash VARCHAR(64) NOT NULL,
    word_count INT,

    -- 存储路径（如果有）
    html_storage_path TEXT,

    -- 版本元数据
    version_number INT NOT NULL DEFAULT 1,
    original_captured_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 约束
    CONSTRAINT unique_snapshot_version UNIQUE (snapshot_id, version_number)
);

-- 索引
CREATE INDEX idx_snapshot_versions_snapshot ON snapshot_versions(snapshot_id);
CREATE INDEX idx_snapshot_versions_user ON snapshot_versions(user_id);
CREATE INDEX idx_snapshot_versions_bookmark ON snapshot_versions(bookmark_id);
CREATE INDEX idx_snapshot_versions_archived ON snapshot_versions(archived_at);

-- RLS 策略
ALTER TABLE snapshot_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshot versions"
    ON snapshot_versions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage versions"
    ON snapshot_versions FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
```

### 3.2 page_monitors 表

```sql
-- 页面监控配置表
CREATE TABLE page_monitors (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,

    -- 监控配置
    check_interval VARCHAR(20) NOT NULL DEFAULT 'daily',
    -- 可选值: 'every_6h', 'twice_daily', 'daily', 'weekly', 'custom'
    custom_interval_hours INT, -- 仅当 check_interval = 'custom' 时使用

    -- 调度信息
    last_checked_at TIMESTAMPTZ,
    next_check_at TIMESTAMPTZ,

    -- 基线快照（用于对比）
    baseline_snapshot_id BIGINT REFERENCES bookmark_snapshots(id),
    baseline_content_hash VARCHAR(64),
    baseline_captured_at TIMESTAMPTZ,

    -- 状态管理
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- 可选值: 'active', 'paused', 'failed', 'deleted'
    consecutive_failures INT NOT NULL DEFAULT 0,
    last_error_message TEXT,

    -- 变更统计
    change_count INT NOT NULL DEFAULT 0,
    last_change_at TIMESTAMPTZ,

    -- 通知设置
    notification_enabled BOOLEAN NOT NULL DEFAULT true,

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 约束：每个书签只能有一个活跃监控
    CONSTRAINT unique_active_monitor UNIQUE (user_id, bookmark_id)
);

-- 索引
CREATE INDEX idx_monitors_user ON page_monitors(user_id);
CREATE INDEX idx_monitors_status ON page_monitors(status) WHERE status = 'active';
CREATE INDEX idx_monitors_next_check ON page_monitors(next_check_at) WHERE status = 'active';
CREATE INDEX idx_monitors_bookmark ON page_monitors(bookmark_id);

-- RLS 策略
ALTER TABLE page_monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own monitors"
    ON page_monitors FOR ALL
    USING (auth.uid() = user_id);
```

### 3.3 monitor_check_logs 表

```sql
-- 监控检查日志表
CREATE TABLE monitor_check_logs (
    id BIGSERIAL PRIMARY KEY,
    monitor_id BIGINT NOT NULL REFERENCES page_monitors(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 检查结果
    check_result VARCHAR(20) NOT NULL,
    -- 可选值: 'no_change', 'changed', 'failed', 'skipped'

    -- 变更详情（仅当 changed 时）
    previous_hash VARCHAR(64),
    current_hash VARCHAR(64),
    similarity_score DECIMAL(5,2), -- 0.00 - 100.00
    change_summary TEXT,

    -- 错误信息（仅当 failed 时）
    error_message TEXT,

    -- 时间戳
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INT, -- 检查耗时

    -- 关联的快照（如果创建了新版本）
    new_snapshot_id BIGINT REFERENCES bookmark_snapshots(id),
    archived_version_id BIGINT REFERENCES snapshot_versions(id)
);

-- 索引
CREATE INDEX idx_check_logs_monitor ON monitor_check_logs(monitor_id);
CREATE INDEX idx_check_logs_user ON monitor_check_logs(user_id);
CREATE INDEX idx_check_logs_checked ON monitor_check_logs(checked_at);
CREATE INDEX idx_check_logs_result ON monitor_check_logs(check_result);

-- RLS 策略
ALTER TABLE monitor_check_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own check logs"
    ON monitor_check_logs FOR SELECT
    USING (auth.uid() = user_id);
```

---

## 4. Tool: compare_snapshots

### 4.1 文件结构

```
src/lib/ai-agent/tools/snapshot/
├── index.ts                      # 模块导出
├── types.ts                      # 类型定义
├── compare-snapshots.tool.ts     # Tool 实现
└── __tests__/
    └── compare-snapshots.tool.test.ts
```

### 4.2 类型定义

```typescript
// src/lib/ai-agent/tools/snapshot/types.ts

import { z } from "zod";

// 参数 Schema
export const compareSnapshotsParamsSchema = z.object({
  bookmark_id: z.number().int().positive().describe("书签 ID"),
  snapshot_id_old: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("旧快照 ID（可选，默认为历史版本）"),
  snapshot_id_new: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("新快照 ID（可选，默认为当前版本）"),
  diff_mode: z
    .enum(["summary", "detailed"])
    .optional()
    .default("summary")
    .describe("对比模式：summary=简要摘要，detailed=详细差异"),
});

export type CompareSnapshotsParams = z.infer<
  typeof compareSnapshotsParamsSchema
>;

// 返回结果类型
export interface CompareSnapshotsResult {
  hasChanges: boolean;
  similarityScore: number; // 0-100
  changeSummary: string;
  addedSections?: string[];
  removedSections?: string[];
  stats?: {
    addedChars: number;
    removedChars: number;
    addedSectionsCount: number;
    removedSectionsCount: number;
  };
  oldCapturedAt: string;
  newCapturedAt: string;
}
```

### 4.3 Tool 描述（增强型）

```typescript
// src/lib/ai-agent/tools/snapshot/descriptions.ts

export const SNAPSHOT_TOOL_DESCRIPTIONS = {
  compare_snapshots: `对比同一书签的两个快照版本，检测内容变化。

**使用场景**：
- 用户想知道某个页面最近有什么更新
- 检测收藏的文章是否被修改
- 查看网页内容的历史变化

**参数说明**：
- bookmark_id: 必填，要对比的书签 ID
- snapshot_id_old: 可选，旧版本快照 ID（默认使用历史版本）
- snapshot_id_new: 可选，新版本快照 ID（默认使用当前版本）
- diff_mode: 可选，'summary' 返回简要摘要，'detailed' 返回详细差异

**返回内容**：
- hasChanges: 是否有变化
- similarityScore: 相似度评分（0-100）
- changeSummary: 变化摘要（如"新增约 150 字，删除约 23 字"）
- addedSections/removedSections: 详细模式下返回具体变化片段`,
};

// 增强型描述（用于 LLM 选择工具）
export const COMPARE_SNAPSHOTS_ENHANCED: EnhancedToolDescription = {
  name: "compare_snapshots",
  description: "对比同一书签的两个快照版本，检测内容变化",
  whenToUse: [
    "用户询问页面/文章是否有更新",
    "用户想知道内容变化了什么",
    "用户说「这个页面改了吗」「有什么新内容」",
    "需要对比两个时间点的网页内容",
  ],
  whenNotToUse: [
    "用户只是想查看当前内容（用 read_bookmark）",
    "用户想创建新快照（用 create_snapshot）",
    "书签没有历史版本",
  ],
  examples: [
    "这篇文章更新了吗？",
    "帮我看看这个页面有什么变化",
    "对比一下新旧版本",
    "检测内容变化",
  ],
};
```

### 4.4 Tool 实现

```typescript
// src/lib/ai-agent/tools/snapshot/compare-snapshots.tool.ts

import { diffWords, diffSentences } from "diff";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { Tool, ToolContext, ToolResult } from "@/lib/ai-agent/tools/types";
import {
  compareSnapshotsParamsSchema,
  CompareSnapshotsParams,
  CompareSnapshotsResult,
} from "./types";
import { SNAPSHOT_TOOL_DESCRIPTIONS } from "./descriptions";

export const compareSnapshotsTool: Tool<
  CompareSnapshotsParams,
  CompareSnapshotsResult
> = {
  definition: {
    name: "compare_snapshots",
    description: SNAPSHOT_TOOL_DESCRIPTIONS.compare_snapshots,
    parameters: compareSnapshotsParamsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },

  async execute(
    params: CompareSnapshotsParams,
    context: ToolContext,
  ): Promise<ToolResult<CompareSnapshotsResult>> {
    const startTime = performance.now();
    const { userId } = context;
    const { bookmark_id, snapshot_id_old, snapshot_id_new, diff_mode } = params;

    try {
      const supabase = await createClient();

      // 1. 获取当前快照
      let currentSnapshot;
      if (snapshot_id_new) {
        const { data, error } = await supabase
          .from("bookmark_snapshots")
          .select("*")
          .eq("id", snapshot_id_new)
          .eq("user_id", userId)
          .single();

        if (error || !data) {
          return {
            success: false,
            error: `未找到快照 ID ${snapshot_id_new}`,
            errorCode: "SNAPSHOT_NOT_FOUND",
          };
        }
        currentSnapshot = data;
      } else {
        // 获取书签的活跃快照
        const { data, error } = await supabase
          .from("bookmark_snapshots")
          .select("*")
          .eq("bookmark_id", bookmark_id)
          .eq("user_id", userId)
          .eq("status", "completed")
          .order("captured_at", { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          return {
            success: false,
            error: "该书签没有快照，请先创建快照",
            errorCode: "NO_SNAPSHOT",
          };
        }
        currentSnapshot = data;
      }

      // 2. 获取历史版本
      let previousSnapshot;
      if (snapshot_id_old) {
        const { data, error } = await supabase
          .from("bookmark_snapshots")
          .select("*")
          .eq("id", snapshot_id_old)
          .eq("user_id", userId)
          .single();

        if (error || !data) {
          return {
            success: false,
            error: `未找到旧快照 ID ${snapshot_id_old}`,
            errorCode: "OLD_SNAPSHOT_NOT_FOUND",
          };
        }
        previousSnapshot = data;
      } else {
        // 获取最新的历史版本
        const { data, error } = await supabase
          .from("snapshot_versions")
          .select("*")
          .eq("snapshot_id", currentSnapshot.id)
          .eq("user_id", userId)
          .order("version_number", { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          return {
            success: false,
            error: "没有历史版本可供对比，该快照可能是首次创建",
            errorCode: "NO_PREVIOUS_VERSION",
          };
        }
        previousSnapshot = {
          content_hash: data.content_hash,
          readable_text_content: data.readable_text_content,
          captured_at: data.original_captured_at,
        };
      }

      // 3. 快速哈希对比
      if (currentSnapshot.content_hash === previousSnapshot.content_hash) {
        return {
          success: true,
          data: {
            hasChanges: false,
            similarityScore: 100,
            changeSummary: "内容完全相同，没有变化",
            oldCapturedAt: previousSnapshot.captured_at,
            newCapturedAt: currentSnapshot.captured_at,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 4. 详细文本对比
      const oldText = previousSnapshot.readable_text_content || "";
      const newText = currentSnapshot.readable_text_content || "";

      const diffResult =
        diff_mode === "detailed"
          ? diffWords(oldText, newText)
          : diffSentences(oldText, newText);

      // 5. 计算统计
      const added: string[] = [];
      const removed: string[] = [];
      let addedChars = 0;
      let removedChars = 0;

      for (const part of diffResult) {
        if (part.added) {
          const trimmed = part.value.trim();
          if (trimmed) {
            added.push(trimmed);
            addedChars += part.value.length;
          }
        } else if (part.removed) {
          const trimmed = part.value.trim();
          if (trimmed) {
            removed.push(trimmed);
            removedChars += part.value.length;
          }
        }
      }

      // 6. 计算相似度
      const totalLength = Math.max(oldText.length, newText.length);
      const changedLength = addedChars + removedChars;
      const similarityScore =
        totalLength > 0
          ? Math.round((1 - changedLength / (totalLength * 2)) * 100)
          : 100;

      // 7. 生成摘要
      const changeSummary = generateChangeSummary(
        addedChars,
        removedChars,
        added,
        removed,
      );

      logger.info(
        {
          toolName: "compare_snapshots",
          userId,
          bookmarkId: bookmark_id,
          hasChanges: true,
          similarityScore: Math.max(0, similarityScore),
        },
        "Snapshot comparison completed",
      );

      return {
        success: true,
        data: {
          hasChanges: true,
          similarityScore: Math.max(0, similarityScore),
          changeSummary,
          addedSections:
            diff_mode === "detailed" ? added.slice(0, 10) : undefined,
          removedSections:
            diff_mode === "detailed" ? removed.slice(0, 10) : undefined,
          stats: {
            addedChars,
            removedChars,
            addedSectionsCount: added.length,
            removedSectionsCount: removed.length,
          },
          oldCapturedAt: previousSnapshot.captured_at,
          newCapturedAt: currentSnapshot.captured_at,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "快照对比失败";

      logger.error(
        {
          toolName: "compare_snapshots",
          userId,
          bookmarkId: bookmark_id,
          error: errorMessage,
        },
        "Snapshot comparison failed",
      );

      return {
        success: false,
        error: errorMessage,
        errorCode: "COMPARISON_ERROR",
      };
    }
  },
};

function generateChangeSummary(
  addedChars: number,
  removedChars: number,
  added: string[],
  removed: string[],
): string {
  const parts: string[] = [];

  if (addedChars > 0) {
    parts.push(`新增约 ${addedChars} 字`);
  }
  if (removedChars > 0) {
    parts.push(`删除约 ${removedChars} 字`);
  }

  if (added.length > 0 && added[0].length > 20) {
    parts.push(`新增内容包括: "${added[0].slice(0, 50)}..."`);
  }

  return parts.join("，") || "内容有细微变化";
}
```

### 4.5 模块导出

```typescript
// src/lib/ai-agent/tools/snapshot/index.ts

export { compareSnapshotsTool } from "./compare-snapshots.tool";
export * from "./types";
export * from "./descriptions";

// 导出数组用于批量注册
import { compareSnapshotsTool } from "./compare-snapshots.tool";

export const snapshotTools = [compareSnapshotsTool];
```

### 4.6 注册到全局

```typescript
// 在 src/lib/ai-agent/tools/index.ts 中添加

import { snapshotTools } from "./snapshot";

export function registerDefaultTools(): void {
  // ... 现有注册
  toolRegistry.registerAll(snapshotTools);
}
```

---

## 5. Skill: content_change_monitor

### 5.1 文件结构

```
src/lib/ai-skills/skills/content-change-monitor/
├── index.ts                           # 模块导出
├── types.ts                           # 类型定义 + Zod Schema
├── content-change-monitor.skill.ts    # Skill 主类
├── services/
│   ├── monitor.service.ts             # 监控服务
│   └── check.service.ts               # 检查服务
└── __tests__/
    └── content-change-monitor.skill.test.ts
```

### 5.2 Feature Flag

```bash
# .env.local
ENABLE_CONTENT_CHANGE_MONITOR=true  # 默认启用
```

### 5.3 类型定义

```typescript
// src/lib/ai-skills/skills/content-change-monitor/types.ts

import { z } from "zod";

// 检查间隔类型
export type CheckInterval =
  | "every_6h"
  | "twice_daily"
  | "daily"
  | "weekly"
  | "custom";

// 输入 Schema
export const ContentChangeMonitorInputSchema = z.object({
  bookmarkId: z.number().int().positive().describe("要监控的书签 ID"),
  checkInterval: z
    .enum(["every_6h", "twice_daily", "daily", "weekly"])
    .optional()
    .default("daily")
    .describe("检查频率"),
  notificationEnabled: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否启用通知"),
});

export type ContentChangeMonitorInput = z.infer<
  typeof ContentChangeMonitorInputSchema
>;

// 输出 Schema
export const ContentChangeMonitorOutputSchema = z.object({
  monitorId: z.number().describe("监控 ID"),
  bookmarkId: z.number().describe("书签 ID"),
  bookmarkTitle: z.string().describe("书签标题"),
  checkInterval: z.string().describe("检查频率"),
  checkIntervalLabel: z.string().describe("检查频率（显示文本）"),
  nextCheckAt: z.string().describe("下次检查时间"),
  baselineCapturedAt: z.string().describe("基线快照时间"),
  message: z.string().describe("确认消息"),
});

export type ContentChangeMonitorOutput = z.infer<
  typeof ContentChangeMonitorOutputSchema
>;

// 监控配额类型
export interface MonitorQuota {
  usedCount: number;
  maxCount: number;
  canCreate: boolean;
  allowedIntervals: CheckInterval[];
  maxVersions: number;
  membership: string;
}

// 页面监控记录类型
export interface PageMonitor {
  id: number;
  userId: string;
  bookmarkId: number;
  checkInterval: CheckInterval;
  customIntervalHours?: number;
  lastCheckedAt?: string;
  nextCheckAt: string;
  baselineSnapshotId?: number;
  baselineContentHash?: string;
  baselineCapturedAt?: string;
  status: "active" | "paused" | "failed" | "deleted";
  consecutiveFailures: number;
  lastErrorMessage?: string;
  changeCount: number;
  lastChangeAt?: string;
  notificationEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 5.4 配额常量

```typescript
// src/lib/ai-skills/skills/content-change-monitor/constants.ts

import { CheckInterval } from "./types";

export const MONITOR_QUOTA = {
  FREE: {
    maxCount: 5,
    maxVersions: 1,
    allowedIntervals: ["daily", "weekly"] as CheckInterval[],
  },
  PRO: {
    maxCount: 50,
    maxVersions: 3,
    allowedIntervals: [
      "every_6h",
      "twice_daily",
      "daily",
      "weekly",
      "custom",
    ] as CheckInterval[],
  },
} as const;

export const CHECK_INTERVAL_LABELS: Record<CheckInterval, string> = {
  every_6h: "每 6 小时",
  twice_daily: "每天 2 次",
  daily: "每天",
  weekly: "每周",
  custom: "自定义",
};

export const CHECK_INTERVAL_HOURS: Record<CheckInterval, number> = {
  every_6h: 6,
  twice_daily: 12,
  daily: 24,
  weekly: 168,
  custom: 24, // 默认
};

// 保护机制常量
export const MONITOR_PROTECTION = {
  MAX_CHECKS_PER_MINUTE: 100, // 系统每分钟最多检查数
  MAX_CONCURRENT_PER_USER: 3, // 单用户同时检查数
  RETRY_DELAY_HOURS: 1, // 失败后重试延迟
  MAX_CONSECUTIVE_FAILURES: 3, // 连续失败暂停阈值
  CHECK_TIMEOUT_MS: 30000, // 单次检查超时
};
```

### 5.5 执行步骤

| 步骤 | ID              | 名称         | 进度 |
| ---- | --------------- | ------------ | ---- |
| 1    | check_quota     | 检查监控配额 | 10%  |
| 2    | validate        | 验证书签     | 15%  |
| 3    | create_baseline | 创建基线快照 | 35%  |
| 4    | setup_monitor   | 配置监控任务 | 30%  |
| 5    | confirm         | 确认启动     | 10%  |

### 5.6 触发方式

**自然语言触发词**:

- "监控这个页面"
- "追踪这个链接的变化"
- "页面有更新通知我"
- "帮我盯着这个网站"
- "这个文章更新了告诉我"
- "设置内容监控"

### 5.7 Skill 实现

```typescript
// src/lib/ai-skills/skills/content-change-monitor/content-change-monitor.skill.ts

import { BaseSkill } from "@/lib/ai-skills/core/base-skill";
import { SkillMetadata, SkillContext } from "@/lib/ai-skills/core/types";
import { createClient } from "@/lib/supabase/server";
import { SnapshotService } from "@/lib/snapshot/snapshot.service";
import { logger } from "@/lib/logger";
import {
  ContentChangeMonitorInput,
  ContentChangeMonitorInputSchema,
  ContentChangeMonitorOutput,
  ContentChangeMonitorOutputSchema,
  MonitorQuota,
  CheckInterval,
} from "./types";
import {
  MONITOR_QUOTA,
  CHECK_INTERVAL_LABELS,
  CHECK_INTERVAL_HOURS,
} from "./constants";

export class ContentChangeMonitorSkill extends BaseSkill<
  ContentChangeMonitorInput,
  ContentChangeMonitorOutput
> {
  readonly metadata: SkillMetadata = {
    id: "content_change_monitor",
    name: "内容变更监控助手",
    description:
      "监控重要页面的内容变化，发现更新时自动通知。支持设置检查频率，适合追踪博客、新闻、文档等经常更新的页面。",
    category: "utility",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "page-monitoring", // 页面监控
      "change-detection", // 变更检测
      "scheduled-check", // 定时检查
      "notification", // 通知推送
    ],
    deliverableTypes: ["config"], // 输出类型：配置
    outputFormats: ["json"], // 输出格式
    requiresConfirmation: false,
    estimatedDurationMs: 5000,
    maxExecutionTimeMs: 30000,
  };

  readonly inputSchema = ContentChangeMonitorInputSchema;
  readonly outputSchema = ContentChangeMonitorOutputSchema;

  protected async executeInternal(
    input: ContentChangeMonitorInput,
    context: SkillContext,
  ): Promise<ContentChangeMonitorOutput> {
    const { userId } = context;
    const { bookmarkId, checkInterval, notificationEnabled } = input;

    const supabase = await createClient();

    // 1. 检查配额
    const quota = await this.getUserQuota(userId);

    if (!quota.canCreate) {
      throw new Error(
        `监控配额已满（${quota.usedCount}/${quota.maxCount}），请删除不需要的监控或升级到 Pro`,
      );
    }

    // 检查频率权限
    if (!quota.allowedIntervals.includes(checkInterval)) {
      throw new Error(
        `当前会员等级不支持「${CHECK_INTERVAL_LABELS[checkInterval]}」检查频率，请选择其他频率或升级到 Pro`,
      );
    }

    // 2. 检查书签是否存在
    const { data: bookmark, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("id, title, url")
      .eq("id", bookmarkId)
      .eq("user_id", userId)
      .single();

    if (bookmarkError || !bookmark) {
      throw new Error(`未找到书签 ID ${bookmarkId}`);
    }

    // 3. 检查是否已有监控
    const { data: existingMonitor } = await supabase
      .from("page_monitors")
      .select("id")
      .eq("bookmark_id", bookmarkId)
      .eq("user_id", userId)
      .neq("status", "deleted")
      .single();

    if (existingMonitor) {
      throw new Error(`该书签已有监控配置，请先删除或修改现有监控`);
    }

    // 4. 确保有基线快照
    let snapshot = await SnapshotService.getActiveSnapshot(userId, bookmarkId);

    if (!snapshot) {
      // 创建新快照
      const result = await SnapshotService.createSnapshot(userId, bookmarkId, {
        type: "basic",
        triggerSource: "monitor",
      });

      if (!result.success || !result.snapshot) {
        throw new Error(`创建基线快照失败: ${result.error}`);
      }

      snapshot = result.snapshot;
    }

    // 5. 计算下次检查时间
    const nextCheckAt = this.calculateNextCheckTime(checkInterval);

    // 6. 创建监控记录
    const { data: monitor, error: monitorError } = await supabase
      .from("page_monitors")
      .insert({
        user_id: userId,
        bookmark_id: bookmarkId,
        check_interval: checkInterval,
        baseline_snapshot_id: snapshot.id,
        baseline_content_hash: snapshot.content_hash,
        baseline_captured_at: snapshot.captured_at,
        next_check_at: nextCheckAt.toISOString(),
        notification_enabled: notificationEnabled,
        status: "active",
      })
      .select()
      .single();

    if (monitorError || !monitor) {
      throw new Error(`创建监控失败: ${monitorError?.message}`);
    }

    logger.info(
      {
        skillId: this.metadata.id,
        userId,
        bookmarkId,
        monitorId: monitor.id,
        checkInterval,
      },
      "Content change monitor created",
    );

    // 7. 构建返回结果
    const message = this.generateConfirmMessage(
      bookmark.title,
      checkInterval,
      nextCheckAt,
    );

    return {
      monitorId: monitor.id,
      bookmarkId,
      bookmarkTitle: bookmark.title,
      checkInterval,
      checkIntervalLabel: CHECK_INTERVAL_LABELS[checkInterval],
      nextCheckAt: nextCheckAt.toISOString(),
      baselineCapturedAt: snapshot.captured_at,
      message,
    };
  }

  private async getUserQuota(userId: string): Promise<MonitorQuota> {
    const supabase = await createClient();

    // 获取用户会员等级
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", userId)
      .single();

    const membership = profile?.membership_type || "free";
    const quotaConfig =
      MONITOR_QUOTA[membership.toUpperCase() as keyof typeof MONITOR_QUOTA] ||
      MONITOR_QUOTA.FREE;

    // 统计当前监控数量
    const { count } = await supabase
      .from("page_monitors")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "deleted");

    const usedCount = count || 0;

    return {
      usedCount,
      maxCount: quotaConfig.maxCount,
      canCreate: usedCount < quotaConfig.maxCount,
      allowedIntervals: quotaConfig.allowedIntervals as CheckInterval[],
      maxVersions: quotaConfig.maxVersions,
      membership,
    };
  }

  private calculateNextCheckTime(interval: CheckInterval): Date {
    const now = new Date();
    const hours = CHECK_INTERVAL_HOURS[interval];
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }

  private generateConfirmMessage(
    bookmarkTitle: string,
    checkInterval: CheckInterval,
    nextCheckAt: Date,
  ): string {
    return `✅ 已启动内容监控

📄 **监控页面**: ${bookmarkTitle}
⏰ **检查频率**: ${CHECK_INTERVAL_LABELS[checkInterval]}
📅 **下次检查**: ${nextCheckAt.toLocaleString("zh-CN")}

当页面内容发生变化时，我会立即通知您。您可以随时说"暂停监控"或"取消监控"来管理。`;
  }
}
```

### 5.8 模块导出

```typescript
// src/lib/ai-skills/skills/content-change-monitor/index.ts

export { ContentChangeMonitorSkill } from "./content-change-monitor.skill";
export * from "./types";
export * from "./constants";

// 创建实例用于注册
import { ContentChangeMonitorSkill } from "./content-change-monitor.skill";

export const contentChangeMonitorSkill = new ContentChangeMonitorSkill();
```

### 5.9 注册到全局

```typescript
// 在 src/lib/ai-skills/skills/register.ts 中添加

import { contentChangeMonitorSkill } from "./content-change-monitor";
import { unifiedEngine } from "../engine/unified-engine";

export function registerAllSkills(): void {
  // ... 现有注册

  // 内容变更监控（支持 Feature Flag 开关）
  if (process.env.ENABLE_CONTENT_CHANGE_MONITOR !== "false") {
    unifiedEngine.registerOrchestrationSkill(contentChangeMonitorSkill);
  }
}
```

### 5.10 意图路由配置

```typescript
// 添加到 src/lib/ai-agent/router/intent-classifier.ts

// 意图规则
{
  intentType: "monitor:page_change",
  pattern: /监控.{0,3}(页面|链接|网站|文章)|追踪.{0,3}变化|更新.{0,3}通知|盯着.{0,3}(网站|页面)/i,
  confidence: 0.85
}

// 添加到 src/lib/ai-agent/router/mode-selector.ts

// Skill 映射
"monitor:page_change": {
  skillId: "content_change_monitor",
  name: "内容变更监控助手",
  minComplexity: "simple",
  enabled: true
}
```

---

## 6. 消息类型扩展

### 6.1 新增消息类型

```typescript
// 添加到 src/lib/messages/types.ts

export type MessageType =
  // ... 现有类型
  | "page_content_changed" // 页面内容变化
  | "page_monitor_failed" // 监控检查失败
  | "page_monitor_quota_reached"; // 监控配额已满

// 添加到 MESSAGE_TYPE_LEVEL_MAP
export const MESSAGE_TYPE_LEVEL_MAP: Record<MessageType, MessageLevel> = {
  // ... 现有映射
  page_content_changed: "normal",
  page_monitor_failed: "normal",
  page_monitor_quota_reached: "important",
};
```

### 6.2 消息模板

```typescript
// 添加到 src/lib/messages/message-templates.ts

export const MESSAGE_TEMPLATES: Record<MessageType, MessageTemplate> = {
  // ... 现有模板

  page_content_changed: {
    title: (data) => `📝 「${data.bookmarkTitle}」内容有更新`,
    content: (data) => data.changeSummary || "页面内容发生了变化",
    actionUrl: (data) => `/home?bookmark=${data.bookmarkId}&compare=true`,
    actionLabel: "查看变化",
    defaultPriority: 5,
  },

  page_monitor_failed: {
    title: (data) => `⚠️ 「${data.bookmarkTitle}」监控检查失败`,
    content: (data) =>
      `连续 ${data.failureCount} 次检查失败，监控已暂停。原因: ${data.errorMessage}`,
    actionUrl: (data) => `/settings/monitors?id=${data.monitorId}`,
    actionLabel: "查看详情",
    defaultPriority: 5,
  },

  page_monitor_quota_reached: {
    title: () => "监控配额已满",
    content: (data) =>
      `您已使用 ${data.usedCount}/${data.maxCount} 个监控名额，升级 Pro 可解锁更多`,
    actionUrl: () => "/settings/subscription",
    actionLabel: "升级 Pro",
    defaultPriority: 7,
  },
};
```

---

## 7. Job Queue 任务类型

### 7.1 新增任务类型

```typescript
// 添加到 src/lib/job-queue/types.ts

export type JobType =
  // ... 现有类型
  | "check_page_change" // 检查页面变化
  | "cleanup_old_versions"; // 清理旧版本

export interface CheckPageChangePayload {
  monitorId: number;
  userId: string;
  bookmarkId: number;
  baselineHash: string;
}

export interface CleanupOldVersionsPayload {
  userId: string;
  maxVersions: number;
}
```

---

## 8. API 端点设计

### 8.1 监控管理 API

| 端点                        | 方法   | 功能         |
| --------------------------- | ------ | ------------ |
| `/api/monitors`             | GET    | 获取监控列表 |
| `/api/monitors`             | POST   | 创建监控     |
| `/api/monitors/[id]`        | GET    | 获取监控详情 |
| `/api/monitors/[id]`        | PATCH  | 更新监控配置 |
| `/api/monitors/[id]`        | DELETE | 删除监控     |
| `/api/monitors/[id]/pause`  | POST   | 暂停监控     |
| `/api/monitors/[id]/resume` | POST   | 恢复监控     |
| `/api/monitors/quota`       | GET    | 获取监控配额 |

### 8.2 快照对比 API

| 端点                           | 方法 | 功能             |
| ------------------------------ | ---- | ---------------- |
| `/api/snapshots/[id]/compare`  | GET  | 对比两个版本     |
| `/api/snapshots/[id]/versions` | GET  | 获取历史版本列表 |

---

## 9. 实现计划

### Phase 1: 基础设施（预计 2 天）

- [ ] 数据库迁移: `snapshot_versions` 表
- [ ] 数据库迁移: `page_monitors` 表
- [ ] 数据库迁移: `monitor_check_logs` 表
- [ ] 安装 `diff` 依赖包
- [ ] 配额常量定义
- [ ] 消息类型扩展

### Phase 2: Tool 实现（预计 1 天）

- [ ] `compare_snapshots` Tool 实现
- [ ] 版本归档逻辑
- [ ] Tool 注册
- [ ] 单元测试

### Phase 3: Skill 实现（预计 2 天）

- [ ] `ContentChangeMonitorSkill` 实现
- [ ] `MonitorService` 服务层
- [ ] Skill 注册
- [ ] 集成测试

### Phase 4: 后台任务（预计 1 天）

- [ ] `check_page_change` 任务处理器
- [ ] 定时调度器（触发待检查的监控）
- [ ] 版本清理任务

### Phase 5: API & 前端（预计 2 天）

- [ ] 监控管理 API 端点
- [ ] 监控列表页面
- [ ] 监控设置组件
- [ ] 变更对比 UI

---

## 10. 附录

### 10.1 依赖包

```json
{
  "dependencies": {
    "diff": "^5.2.0"
  }
}
```

### 10.2 相关文档

- [现有快照系统](../snapshot-system.md)
- [AI Tools 设计规范](../../ai-agent/TOOLS_GUIDE.md)
- [AI Skills 设计规范](../../ai-skills/NEW_SKILLS_GUIDE.md)
- [消息系统文档](../../messages-system.md)

### 10.3 变更历史

| 日期       | 版本 | 变更内容                                         |
| ---------- | ---- | ------------------------------------------------ |
| 2025-12-27 | v1.0 | 初始规范文档，符合 AnyKeep Tools/Skills 设计规范 |
