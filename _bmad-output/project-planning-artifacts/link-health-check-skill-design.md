# 失效链接检测 Skill 设计文档

> **版本**: v1.0
> **日期**: 2025-12-27
> **状态**: 待审核
> **预计工作量**: 2-3 周

---

## 目录

1. [功能概述](#1-功能概述)
2. [技术架构](#2-技术架构)
3. [数据库设计](#3-数据库设计)
4. [后端 Skill 设计](#4-后端-skill-设计)
5. [API 接口设计](#5-api-接口设计)
6. [前端界面设计](#6-前端界面设计)
7. [AI 集成设计](#7-ai-集成设计)
8. [性能与安全](#8-性能与安全)
9. [测试策略](#9-测试策略)
10. [实现计划](#10-实现计划)

---

## 1. 功能概述

### 1.1 核心价值

> **用户痛点**：收藏的链接时间久了可能失效（404、网站关闭、内容删除），用户打开时才发现，体验很差。
>
> **解决方案**：定期/手动检测链接健康状态，提前发现问题，提供修复建议。

### 1.2 功能清单

| 功能             | 描述                            | 优先级 |
| ---------------- | ------------------------------- | ------ |
| **链接健康检测** | 批量检测书签 URL 是否可访问     | P0     |
| **问题分类**     | 区分 404/超时/SSL 错误/重定向等 | P0     |
| **健康报告**     | 生成检测报告，展示问题分布      | P0     |
| **修复建议**     | 提供 Wayback Machine 归档链接   | P1     |
| **批量修复**     | 一键更新/删除/归档失效链接      | P1     |
| **定时检测**     | 后台定期检测（可选）            | P2     |
| **变更检测**     | 检测内容是否发生重大变化        | P2     |

### 1.3 用户场景

```
场景1: 手动触发检测
用户："帮我检查一下收藏有没有失效的链接"
AI：正在扫描 342 条收藏...发现 12 条问题链接（8个404，3个超时，1个SSL错误）

场景2: 查看健康报告
用户：点击侧边栏「链接健康」进入专属页面，查看历史检测记录和当前状态

场景3: 修复失效链接
用户：在检测报告中选择失效链接，点击「查找归档版本」或「删除」
```

---

## 2. 技术架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户交互层                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  AI 对话触发     │  │  /link-health   │  │  侧边栏入口     │  │
│  │  "检查失效链接"  │  │  专属页面        │  │  健康指示器     │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
└───────────┼─────────────────────┼─────────────────────┼──────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API 层                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  POST /api/agent/unified        (AI 统一入口)                ││
│  │  POST /api/link-health/check    (手动触发检测)               ││
│  │  GET  /api/link-health/status   (获取检测状态)               ││
│  │  GET  /api/link-health/history  (获取历史记录)               ││
│  │  POST /api/link-health/fix      (执行修复操作)               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Skill 执行层                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   LinkHealthCheckSkill                       ││
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         ││
│  │  │ 收集    │→ │ 检测    │→ │ 分类    │→ │ 报告    │         ││
│  │  │ 书签    │  │ URL     │  │ 问题    │  │ 生成    │         ││
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘         ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────────┐  │
│  │                     支撑服务                               │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │  │
│  │  │UrlChecker   │  │WaybackFinder│  │HealthReporter   │    │  │
│  │  │(并发检测)    │  │(归档查找)    │  │(报告生成)       │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        数据层                                    │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ link_health_     │  │ bookmarks        │                     │
│  │ checks           │  │ (更新 health_    │                     │
│  │ (检测历史)        │  │  status 字段)    │                     │
│  └──────────────────┘  └──────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 目录结构（符合 AnyKeep-Tools-Skills-Development-Guide.md 规范）

```
src/
├── lib/
│   └── ai-skills/
│       └── skills/
│           └── link-health-check/           # 新增 Orchestration Skill 目录
│               ├── index.ts                 # 导出入口 (必须)
│               ├── link-health-check.skill.ts  # Skill 主实现 (必须)
│               ├── types.ts                 # 类型定义 (必须)
│               ├── schema.ts                # Zod Schema (必须)
│               ├── services/                # 服务层 (可选，复杂 Skill)
│               │   ├── index.ts
│               │   ├── url-checker.ts       # URL 检测服务
│               │   ├── wayback-finder.ts    # Wayback 归档查找
│               │   └── health-reporter.ts   # 报告生成
│               └── __tests__/               # 测试 (必须)
│                   ├── link-health-check.skill.test.ts
│                   ├── link-health-check.integration.test.ts
│                   ├── url-checker.test.ts
│                   └── wayback-finder.test.ts
│
├── app/
│   ├── api/
│   │   └── link-health/                     # 新增 API 目录
│   │       ├── check/route.ts               # 触发检测
│   │       ├── status/route.ts              # 获取状态
│   │       ├── history/route.ts             # 历史记录
│   │       └── fix/route.ts                 # 执行修复
│   │
│   └── (main)/
│       └── link-health/                     # 新增页面
│           ├── page.tsx                     # 页面入口
│           └── loading.tsx                  # 加载状态
│
├── components/
│   └── link-health/                         # 新增组件目录
│       ├── link-health-page-client.tsx      # 页面客户端组件
│       ├── health-check-trigger.tsx         # 检测触发按钮
│       ├── health-check-progress.tsx        # 检测进度
│       ├── health-report-card.tsx           # 报告卡片
│       ├── problem-link-list.tsx            # 问题链接列表
│       ├── fix-action-dialog.tsx            # 修复操作对话框
│       └── health-status-badge.tsx          # 健康状态徽章
│
└── hooks/
    └── link-health/                         # 新增 Hooks
        ├── use-health-check.ts              # 检测操作 Hook
        └── use-health-history.ts            # 历史记录 Hook

supabase/
└── migrations/
    └── 20250101_add_link_health.sql         # 数据库迁移
```

---

## 3. 数据库设计

### 3.1 新增表：link_health_checks

```sql
-- 链接健康检测历史表
CREATE TABLE link_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 检测范围
  scope TEXT NOT NULL DEFAULT 'all',  -- 'all' | 'folder' | 'selected'
  folder_id INTEGER REFERENCES folders(id),
  bookmark_ids INTEGER[],  -- 仅当 scope='selected' 时使用

  -- 检测结果统计
  total_checked INTEGER NOT NULL DEFAULT 0,
  healthy_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  slow_count INTEGER NOT NULL DEFAULT 0,
  redirect_count INTEGER NOT NULL DEFAULT 0,

  -- 问题详情（JSONB 存储）
  problems JSONB NOT NULL DEFAULT '[]',
  -- 结构: [{ bookmarkId, url, status, errorType, errorMessage, responseTime, checkedAt }]

  -- 状态
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress INTEGER NOT NULL DEFAULT 0,  -- 0-100

  -- 时间戳
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 索引
  CONSTRAINT valid_scope CHECK (scope IN ('all', 'folder', 'selected')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

-- 索引
CREATE INDEX idx_link_health_checks_user_id ON link_health_checks(user_id);
CREATE INDEX idx_link_health_checks_status ON link_health_checks(status);
CREATE INDEX idx_link_health_checks_created_at ON link_health_checks(created_at DESC);

-- RLS 策略
ALTER TABLE link_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own health checks"
  ON link_health_checks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health checks"
  ON link_health_checks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health checks"
  ON link_health_checks FOR UPDATE
  USING (auth.uid() = user_id);
```

### 3.2 扩展表：bookmarks

```sql
-- 为 bookmarks 表添加健康状态字段
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS health_checked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS health_error_type TEXT,
ADD COLUMN IF NOT EXISTS health_response_time_ms INTEGER;

-- 添加约束
ALTER TABLE bookmarks
ADD CONSTRAINT valid_health_status
CHECK (health_status IN ('unknown', 'healthy', 'slow', 'redirect', 'failed'));

-- 索引
CREATE INDEX idx_bookmarks_health_status ON bookmarks(health_status)
WHERE deleted_at IS NULL;

COMMENT ON COLUMN bookmarks.health_status IS '链接健康状态: unknown/healthy/slow/redirect/failed';
COMMENT ON COLUMN bookmarks.health_checked_at IS '最后检测时间';
COMMENT ON COLUMN bookmarks.health_error_type IS '错误类型: not_found/timeout/ssl_error/dns_error/connection_refused';
COMMENT ON COLUMN bookmarks.health_response_time_ms IS '响应时间（毫秒）';
```

### 3.3 类型定义

```typescript
// src/lib/ai-skills/skills/link-health-check/types.ts

/**
 * 健康状态枚举
 */
export type HealthStatus =
  | "unknown"
  | "healthy"
  | "slow"
  | "redirect"
  | "failed";

/**
 * 错误类型枚举
 */
export type HealthErrorType =
  | "not_found" // 404
  | "timeout" // 请求超时
  | "ssl_error" // SSL 证书问题
  | "dns_error" // DNS 解析失败
  | "connection_refused" // 连接被拒绝
  | "content_changed" // 内容已变更（可选）
  | "paywall" // 付费墙
  | "login_required"; // 需要登录

/**
 * 单个链接检测结果
 */
export interface LinkCheckResult {
  bookmarkId: number;
  url: string;
  status: HealthStatus;
  httpStatus?: number;
  responseTimeMs?: number;
  errorType?: HealthErrorType;
  errorMessage?: string;
  redirectUrl?: string;
  waybackUrl?: string; // Wayback Machine 归档链接
  checkedAt: Date;
}

/**
 * 检测输入参数
 */
export interface LinkHealthCheckInput {
  scope: "all" | "folder" | "selected";
  folderId?: number;
  bookmarkIds?: number[];
  includeWayback?: boolean; // 是否查找 Wayback 归档
  timeout?: number; // 超时时间（毫秒），默认 10000
  concurrency?: number; // 并发数，默认 5
}

/**
 * 检测输出结果
 */
export interface LinkHealthCheckOutput {
  checkId: string; // 检测记录 ID
  stats: {
    totalChecked: number;
    healthyCount: number;
    failedCount: number;
    slowCount: number;
    redirectCount: number;
  };
  problems: LinkCheckResult[];
  summary: string;
  suggestions: string[];
  generatedAt: string;
}

/**
 * 修复操作类型
 */
export type FixAction = "delete" | "archive" | "update_url" | "ignore";

/**
 * 修复操作请求
 */
export interface FixActionRequest {
  bookmarkId: number;
  action: FixAction;
  newUrl?: string; // 当 action='update_url' 时使用
}

/**
 * 配置常量
 */
export const LINK_HEALTH_CONFIG = {
  /** 默认超时时间（毫秒） */
  DEFAULT_TIMEOUT_MS: 10000,

  /** 最大超时时间（毫秒） */
  MAX_TIMEOUT_MS: 30000,

  /** 默认并发数 */
  DEFAULT_CONCURRENCY: 5,

  /** 最大并发数 */
  MAX_CONCURRENCY: 10,

  /** 慢响应阈值（毫秒） */
  SLOW_THRESHOLD_MS: 5000,

  /** 单次最大检测数量 */
  MAX_CHECK_LIMIT: 500,

  /** 批次大小 */
  BATCH_SIZE: 50,

  /** Wayback Machine API */
  WAYBACK_API: "https://archive.org/wayback/available",

  /** 需要跳过的协议 */
  SKIP_PROTOCOLS: ["javascript:", "data:", "blob:", "file:"],
} as const;
```

---

## 4. 后端 Skill 设计

### 4.1 Skill 主类

```typescript
// src/lib/ai-skills/skills/link-health-check/link-health-check.skill.ts

import { z } from "zod";
import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { UrlChecker } from "./services/url-checker";
import { WaybackFinder } from "./services/wayback-finder";
import { HealthReporter } from "./services/health-reporter";
import type {
  LinkHealthCheckInput,
  LinkHealthCheckOutput,
  LinkCheckResult,
  HealthStatus,
} from "./types";
import { LINK_HEALTH_CONFIG } from "./types";
import {
  LinkHealthCheckInputSchema,
  LinkHealthCheckOutputSchema,
} from "./schema";

// ============================================
// 步骤定义
// ============================================

const HEALTH_CHECK_STEPS = [
  {
    id: "collect",
    name: "收集数据",
    description: "获取待检测的书签",
    weight: 10,
  },
  {
    id: "check",
    name: "检测链接",
    description: "批量检测 URL 可访问性",
    weight: 60,
  },
  {
    id: "classify",
    name: "分类问题",
    description: "对检测结果进行分类",
    weight: 10,
  },
  {
    id: "wayback",
    name: "查找归档",
    description: "为失效链接查找归档版本",
    weight: 10,
  },
  {
    id: "report",
    name: "生成报告",
    description: "生成健康检测报告",
    weight: 10,
  },
];

// ============================================
// LinkHealthCheckSkill 实现
// ============================================

export class LinkHealthCheckSkill extends OrchestrationSkill<
  LinkHealthCheckInput,
  LinkHealthCheckOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "link_health_check",
    name: "链接健康检测",
    description:
      "智能检测收藏链接的可访问性，发现失效链接并提供修复建议，保持收藏夹健康。",
    category: "maintenance",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "batch-check",
      "error-classification",
      "wayback-lookup",
      "fix-suggestions",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 30000,
    maxExecutionTimeMs: 120000,
    deliverableTypes: ["report", "list"],
    outputFormats: ["markdown", "json"],
    steps: HEALTH_CHECK_STEPS,
  };

  readonly inputSchema = LinkHealthCheckInputSchema;
  readonly outputSchema = LinkHealthCheckOutputSchema;

  private urlChecker = new UrlChecker();
  private waybackFinder = new WaybackFinder();
  private healthReporter = new HealthReporter();

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<LinkHealthCheckInput> {
    const input: LinkHealthCheckInput = {
      scope: "all",
      includeWayback: true,
      timeout: LINK_HEALTH_CONFIG.DEFAULT_TIMEOUT_MS,
      concurrency: LINK_HEALTH_CONFIG.DEFAULT_CONCURRENCY,
    };

    // 解析范围
    if (/选中|selected|这些/.test(message)) {
      input.scope = "selected";
    } else if (/文件夹|folder/.test(message)) {
      input.scope = "folder";
    }

    // 解析是否查找归档
    if (/不.*归档|no.*wayback|跳过归档/.test(message)) {
      input.includeWayback = false;
    }

    // 解析超时时间
    const timeoutMatch = message.match(/(\d+)\s*秒?超时|timeout\s*(\d+)/i);
    if (timeoutMatch) {
      const seconds = parseInt(timeoutMatch[1] || timeoutMatch[2]);
      input.timeout = Math.min(
        seconds * 1000,
        LINK_HEALTH_CONFIG.MAX_TIMEOUT_MS,
      );
    }

    return input;
  }

  /**
   * 流式执行链接健康检测
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as LinkHealthCheckInput;

    // 初始化进度
    this.initProgress(HEALTH_CHECK_STEPS);

    try {
      // Step 1: 收集数据
      yield* this.reportProgress("收集数据", 5, "正在获取书签列表...");
      yield* this.emitText("🔍 **开始链接健康检测**\n\n");

      const bookmarks = await this.fetchBookmarks(context.userId, input);

      if (bookmarks.length === 0) {
        yield* this.emitText("没有找到需要检测的书签。");
        yield* this.emitDone(true, "没有需要检测的书签");
        return;
      }

      yield* this.reportProgress(
        "收集数据",
        10,
        `获取到 ${bookmarks.length} 条书签`,
      );
      yield* this.emitText(`📚 共 **${bookmarks.length}** 条书签待检测\n\n`);

      // 创建检测记录
      const checkId = await this.createCheckRecord(
        context.userId,
        input,
        bookmarks.length,
      );

      // Step 2: 批量检测链接
      yield* this.reportProgress("检测链接", 15, "开始检测链接可访问性...");

      const results: LinkCheckResult[] = [];
      const batchSize = LINK_HEALTH_CONFIG.BATCH_SIZE;
      const totalBatches = Math.ceil(bookmarks.length / batchSize);

      for (let i = 0; i < totalBatches; i++) {
        // 检查是否取消
        if (this.isCancelled(context)) {
          yield* this.emitCancelled("检测已取消", "用户取消");
          await this.updateCheckStatus(checkId, "cancelled");
          return;
        }

        const batch = bookmarks.slice(i * batchSize, (i + 1) * batchSize);
        const batchResults = await this.urlChecker.checkBatch(batch, {
          timeout: input.timeout ?? LINK_HEALTH_CONFIG.DEFAULT_TIMEOUT_MS,
          concurrency:
            input.concurrency ?? LINK_HEALTH_CONFIG.DEFAULT_CONCURRENCY,
        });

        results.push(...batchResults);

        // 更新进度
        const progress = 15 + Math.round(((i + 1) / totalBatches) * 45);
        yield* this.reportProgress(
          "检测链接",
          progress,
          `已检测 ${results.length}/${bookmarks.length} 条`,
        );

        // 实时输出问题
        const newProblems = batchResults.filter((r) => r.status !== "healthy");
        if (newProblems.length > 0) {
          yield* this.emitText(`⚠️ 发现 ${newProblems.length} 条问题链接\n`);
        }
      }

      // Step 3: 分类问题
      yield* this.reportProgress("分类问题", 65, "正在分析检测结果...");

      const stats = this.calculateStats(results);
      const problems = results.filter((r) => r.status !== "healthy");

      yield* this.emitText(`\n## 📊 检测结果\n\n`);
      yield* this.emitText(`| 状态 | 数量 | 占比 |\n`);
      yield* this.emitText(`|------|------|------|\n`);
      yield* this.emitText(
        `| ✅ 正常 | ${stats.healthyCount} | ${this.percent(stats.healthyCount, stats.totalChecked)} |\n`,
      );
      yield* this.emitText(
        `| ❌ 失效 | ${stats.failedCount} | ${this.percent(stats.failedCount, stats.totalChecked)} |\n`,
      );
      yield* this.emitText(
        `| 🐢 缓慢 | ${stats.slowCount} | ${this.percent(stats.slowCount, stats.totalChecked)} |\n`,
      );
      yield* this.emitText(
        `| 🔀 重定向 | ${stats.redirectCount} | ${this.percent(stats.redirectCount, stats.totalChecked)} |\n\n`,
      );

      // Step 4: 查找 Wayback 归档（仅对失效链接）
      if (input.includeWayback && stats.failedCount > 0) {
        yield* this.reportProgress("查找归档", 70, "正在查找归档版本...");

        const failedResults = problems.filter((p) => p.status === "failed");
        const waybackResults = await this.waybackFinder.findArchives(
          failedResults.slice(0, 20), // 限制查找数量
        );

        // 更新归档链接
        for (const result of problems) {
          const wayback = waybackResults.find(
            (w) => w.bookmarkId === result.bookmarkId,
          );
          if (wayback?.waybackUrl) {
            result.waybackUrl = wayback.waybackUrl;
          }
        }

        const foundCount = waybackResults.filter((w) => w.waybackUrl).length;
        if (foundCount > 0) {
          yield* this.emitText(`🗄️ 找到 **${foundCount}** 个归档版本\n\n`);
        }
      }

      yield* this.reportProgress("查找归档", 80, "归档查找完成");

      // Step 5: 生成报告
      yield* this.reportProgress("生成报告", 85, "正在生成健康报告...");

      // 输出问题详情（最多显示 10 条）
      if (problems.length > 0) {
        yield* this.emitText(`## ⚠️ 问题链接详情\n\n`);

        for (const [index, problem] of problems.slice(0, 10).entries()) {
          const statusIcon = this.getStatusIcon(problem.status);
          const errorInfo = problem.errorType
            ? ` (${this.getErrorTypeName(problem.errorType)})`
            : "";

          yield* this.emitText(
            `### ${index + 1}. ${problem.url.slice(0, 50)}...\n`,
          );
          yield* this.emitText(
            `- **状态**: ${statusIcon} ${this.getStatusName(problem.status)}${errorInfo}\n`,
          );

          if (problem.httpStatus) {
            yield* this.emitText(`- **HTTP状态码**: ${problem.httpStatus}\n`);
          }

          if (problem.waybackUrl) {
            yield* this.emitText(
              `- **归档版本**: [查看归档](${problem.waybackUrl})\n`,
            );
          }

          yield* this.emitText(`\n`);
        }

        if (problems.length > 10) {
          yield* this.emitText(
            `*...还有 ${problems.length - 10} 条问题链接*\n\n`,
          );
        }
      }

      // 更新书签健康状态
      await this.updateBookmarkHealthStatus(context.userId, results);

      // 更新检测记录
      await this.updateCheckRecord(checkId, stats, problems);

      // 生成建议
      const suggestions = this.generateSuggestions(stats, problems);
      const summary = this.generateSummary(stats);

      const output: LinkHealthCheckOutput = {
        checkId,
        stats,
        problems,
        summary,
        suggestions,
        generatedAt: new Date().toISOString(),
      };

      // 输出交付物
      const deliverable = this.createDeliverable(
        "report",
        "链接健康检测报告",
        output,
        "markdown",
        {
          downloadable: true,
          metadata: { ...stats },
        },
      );

      yield* this.emitDeliverable(deliverable);

      // 输出建议
      yield* this.emitSuggestions(
        suggestions.map((s, i) => ({
          text: s,
          label: `建议 ${i + 1}`,
          action: "fix",
          icon: "💡",
        })),
      );

      // 如果有问题，提供修复确认
      if (stats.failedCount > 0) {
        yield* this.emitConfirmation(
          "处理失效链接",
          `发现 ${stats.failedCount} 条失效链接，您希望如何处理？`,
          [
            { id: "delete_all", label: "全部删除", danger: true },
            { id: "archive_all", label: "全部归档" },
            { id: "manual", label: "手动处理" },
            { id: "ignore", label: "暂时忽略" },
          ],
        );
      }

      yield* this.reportProgress("完成", 100, "检测完成");
      yield* this.emitDone(true, summary);

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          checkId,
          ...stats,
          durationMs: Date.now() - startTime,
        },
        "LinkHealthCheckSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "LinkHealthCheckSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "链接检测失败",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "链接检测失败");
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private async fetchBookmarks(
    userId: string,
    input: LinkHealthCheckInput,
  ): Promise<Array<{ id: number; url: string; title: string }>> {
    const supabase = await createClient();

    let query = supabase
      .from("bookmarks")
      .select("id, url, title")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    switch (input.scope) {
      case "folder":
        if (input.folderId) {
          query = query.eq("folder_id", input.folderId);
        }
        break;
      case "selected":
        if (input.bookmarkIds?.length) {
          query = query.in("id", input.bookmarkIds);
        }
        break;
    }

    const { data, error } = await query.limit(
      LINK_HEALTH_CONFIG.MAX_CHECK_LIMIT,
    );

    if (error) {
      throw new Error(`获取书签失败: ${error.message}`);
    }

    // 过滤无效 URL
    return (data || []).filter((b) => {
      try {
        const url = new URL(b.url);
        return !LINK_HEALTH_CONFIG.SKIP_PROTOCOLS.some(
          (p) => url.protocol === p,
        );
      } catch {
        return false;
      }
    });
  }

  private async createCheckRecord(
    userId: string,
    input: LinkHealthCheckInput,
    totalCount: number,
  ): Promise<string> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("link_health_checks")
      .insert({
        user_id: userId,
        scope: input.scope,
        folder_id: input.folderId,
        bookmark_ids: input.bookmarkIds,
        total_checked: totalCount,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`创建检测记录失败: ${error.message}`);
    }

    return data.id;
  }

  private async updateCheckRecord(
    checkId: string,
    stats: LinkHealthCheckOutput["stats"],
    problems: LinkCheckResult[],
  ): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from("link_health_checks")
      .update({
        healthy_count: stats.healthyCount,
        failed_count: stats.failedCount,
        slow_count: stats.slowCount,
        redirect_count: stats.redirectCount,
        problems: JSON.stringify(problems),
        status: "completed",
        progress: 100,
        completed_at: new Date().toISOString(),
      })
      .eq("id", checkId);
  }

  private async updateCheckStatus(
    checkId: string,
    status: string,
  ): Promise<void> {
    const supabase = await createClient();
    await supabase
      .from("link_health_checks")
      .update({ status, completed_at: new Date().toISOString() })
      .eq("id", checkId);
  }

  private async updateBookmarkHealthStatus(
    userId: string,
    results: LinkCheckResult[],
  ): Promise<void> {
    const supabase = await createClient();

    // 批量更新书签健康状态
    for (const result of results) {
      await supabase
        .from("bookmarks")
        .update({
          health_status: result.status,
          health_checked_at: result.checkedAt.toISOString(),
          health_error_type: result.errorType,
          health_response_time_ms: result.responseTimeMs,
        })
        .eq("id", result.bookmarkId)
        .eq("user_id", userId);
    }
  }

  private calculateStats(
    results: LinkCheckResult[],
  ): LinkHealthCheckOutput["stats"] {
    return {
      totalChecked: results.length,
      healthyCount: results.filter((r) => r.status === "healthy").length,
      failedCount: results.filter((r) => r.status === "failed").length,
      slowCount: results.filter((r) => r.status === "slow").length,
      redirectCount: results.filter((r) => r.status === "redirect").length,
    };
  }

  private percent(count: number, total: number): string {
    if (total === 0) return "0%";
    return `${Math.round((count / total) * 100)}%`;
  }

  private getStatusIcon(status: HealthStatus): string {
    switch (status) {
      case "healthy":
        return "✅";
      case "failed":
        return "❌";
      case "slow":
        return "🐢";
      case "redirect":
        return "🔀";
      default:
        return "❓";
    }
  }

  private getStatusName(status: HealthStatus): string {
    switch (status) {
      case "healthy":
        return "正常";
      case "failed":
        return "失效";
      case "slow":
        return "响应缓慢";
      case "redirect":
        return "已重定向";
      default:
        return "未知";
    }
  }

  private getErrorTypeName(errorType: string): string {
    const names: Record<string, string> = {
      not_found: "404 未找到",
      timeout: "请求超时",
      ssl_error: "SSL 证书错误",
      dns_error: "DNS 解析失败",
      connection_refused: "连接被拒绝",
      content_changed: "内容已变更",
      paywall: "付费墙",
      login_required: "需要登录",
    };
    return names[errorType] || errorType;
  }

  private generateSummary(stats: LinkHealthCheckOutput["stats"]): string {
    const parts: string[] = [];
    parts.push(`检测了 **${stats.totalChecked}** 条链接`);

    if (stats.failedCount === 0) {
      parts.push("全部正常，无失效链接！");
    } else {
      parts.push(`发现 **${stats.failedCount}** 条失效`);
    }

    if (stats.slowCount > 0) {
      parts.push(`**${stats.slowCount}** 条响应缓慢`);
    }

    return parts.join("，") + "。";
  }

  private generateSuggestions(
    stats: LinkHealthCheckOutput["stats"],
    problems: LinkCheckResult[],
  ): string[] {
    const suggestions: string[] = [];

    if (stats.failedCount === 0) {
      suggestions.push("您的收藏链接全部健康，继续保持！");
      suggestions.push("建议每月检测一次，及时发现失效链接");
      return suggestions;
    }

    if (stats.failedCount > 10) {
      suggestions.push("失效链接较多，建议分批处理");
    }

    const withWayback = problems.filter((p) => p.waybackUrl);
    if (withWayback.length > 0) {
      suggestions.push(
        `${withWayback.length} 条链接有归档版本，可考虑更新链接`,
      );
    }

    const timeouts = problems.filter((p) => p.errorType === "timeout");
    if (timeouts.length > 0) {
      suggestions.push(
        `${timeouts.length} 条链接超时，可能是网络问题，建议稍后重试`,
      );
    }

    suggestions.push("可以选择删除、归档或更新失效链接");
    suggestions.push("定期检测可以保持收藏夹健康");

    return suggestions;
  }
}

// ============================================
// 导出
// ============================================

export const linkHealthCheckSkill = new LinkHealthCheckSkill();
```

### 4.2 URL 检测服务

```typescript
// src/lib/ai-skills/skills/link-health-check/services/url-checker.ts

import { logger } from "@/lib/logger";
import type { LinkCheckResult, HealthStatus, HealthErrorType } from "../types";
import { LINK_HEALTH_CONFIG } from "../types";

interface CheckOptions {
  timeout: number;
  concurrency: number;
}

interface Bookmark {
  id: number;
  url: string;
  title: string;
}

/**
 * URL 健康检测服务
 *
 * 特点：
 * - 并发控制，避免过载
 * - HEAD 请求优先，减少带宽
 * - 超时处理
 * - 重试机制
 */
export class UrlChecker {
  /**
   * 批量检测 URL
   */
  async checkBatch(
    bookmarks: Bookmark[],
    options: CheckOptions,
  ): Promise<LinkCheckResult[]> {
    const results: LinkCheckResult[] = [];
    const { timeout, concurrency } = options;

    // 分批并发执行
    for (let i = 0; i < bookmarks.length; i += concurrency) {
      const batch = bookmarks.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((b) => this.checkSingle(b, timeout)),
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 检测单个 URL
   */
  private async checkSingle(
    bookmark: Bookmark,
    timeout: number,
  ): Promise<LinkCheckResult> {
    const startTime = Date.now();

    try {
      // 先尝试 HEAD 请求
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let response: Response;
      try {
        response = await fetch(bookmark.url, {
          method: "HEAD",
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "User-Agent": "AnyKeep-LinkChecker/1.0",
          },
        });
      } catch {
        // HEAD 失败时尝试 GET
        response = await fetch(bookmark.url, {
          method: "GET",
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "User-Agent": "AnyKeep-LinkChecker/1.0",
          },
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const responseTime = Date.now() - startTime;
      const status = this.classifyStatus(response.status, responseTime);

      return {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        status,
        httpStatus: response.status,
        responseTimeMs: responseTime,
        redirectUrl: response.redirected ? response.url : undefined,
        checkedAt: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const { status, errorType, errorMessage } = this.classifyError(error);

      return {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        status,
        errorType,
        errorMessage,
        responseTimeMs: responseTime,
        checkedAt: new Date(),
      };
    }
  }

  /**
   * 根据 HTTP 状态码分类
   */
  private classifyStatus(
    httpStatus: number,
    responseTime: number,
  ): HealthStatus {
    if (httpStatus >= 200 && httpStatus < 300) {
      if (responseTime > LINK_HEALTH_CONFIG.SLOW_THRESHOLD_MS) {
        return "slow";
      }
      return "healthy";
    }

    if (httpStatus >= 300 && httpStatus < 400) {
      return "redirect";
    }

    return "failed";
  }

  /**
   * 分类错误类型
   */
  private classifyError(error: unknown): {
    status: HealthStatus;
    errorType: HealthErrorType;
    errorMessage: string;
  } {
    const message = error instanceof Error ? error.message : String(error);

    // 超时
    if (message.includes("abort") || message.includes("timeout")) {
      return {
        status: "failed",
        errorType: "timeout",
        errorMessage: "请求超时",
      };
    }

    // SSL 错误
    if (message.includes("SSL") || message.includes("certificate")) {
      return {
        status: "failed",
        errorType: "ssl_error",
        errorMessage: "SSL 证书错误",
      };
    }

    // DNS 错误
    if (message.includes("ENOTFOUND") || message.includes("getaddrinfo")) {
      return {
        status: "failed",
        errorType: "dns_error",
        errorMessage: "DNS 解析失败",
      };
    }

    // 连接拒绝
    if (message.includes("ECONNREFUSED") || message.includes("refused")) {
      return {
        status: "failed",
        errorType: "connection_refused",
        errorMessage: "连接被拒绝",
      };
    }

    return {
      status: "failed",
      errorType: "not_found",
      errorMessage: message,
    };
  }
}
```

### 4.3 Wayback Machine 归档查找服务

```typescript
// src/lib/ai-skills/skills/link-health-check/services/wayback-finder.ts

import { logger } from "@/lib/logger";
import type { LinkCheckResult } from "../types";
import { LINK_HEALTH_CONFIG } from "../types";

interface WaybackResult {
  bookmarkId: number;
  originalUrl: string;
  waybackUrl?: string;
  timestamp?: string;
}

/**
 * Wayback Machine 归档查找服务
 */
export class WaybackFinder {
  /**
   * 批量查找归档版本
   */
  async findArchives(
    failedResults: LinkCheckResult[],
  ): Promise<WaybackResult[]> {
    const results: WaybackResult[] = [];

    // 并发限制为 3，避免过度请求 Archive.org
    const concurrency = 3;

    for (let i = 0; i < failedResults.length; i += concurrency) {
      const batch = failedResults.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((r) => this.findSingle(r)),
      );
      results.push(...batchResults);

      // 添加延迟，避免被限流
      if (i + concurrency < failedResults.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * 查找单个 URL 的归档版本
   */
  private async findSingle(result: LinkCheckResult): Promise<WaybackResult> {
    try {
      const apiUrl = `${LINK_HEALTH_CONFIG.WAYBACK_API}?url=${encodeURIComponent(result.url)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "AnyKeep-LinkChecker/1.0",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          bookmarkId: result.bookmarkId,
          originalUrl: result.url,
        };
      }

      const data = await response.json();

      if (data.archived_snapshots?.closest?.available) {
        return {
          bookmarkId: result.bookmarkId,
          originalUrl: result.url,
          waybackUrl: data.archived_snapshots.closest.url,
          timestamp: data.archived_snapshots.closest.timestamp,
        };
      }

      return {
        bookmarkId: result.bookmarkId,
        originalUrl: result.url,
      };
    } catch (error) {
      logger.warn(
        {
          url: result.url,
          error: error instanceof Error ? error.message : String(error),
        },
        "WaybackFinder: Failed to find archive",
      );

      return {
        bookmarkId: result.bookmarkId,
        originalUrl: result.url,
      };
    }
  }
}
```

---

## 5. API 接口设计

### 5.1 触发检测 API

```typescript
// src/app/api/link-health/check/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { linkHealthCheckSkill } from "@/lib/ai-skills/skills/link-health-check";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 120; // 最长 2 分钟

/**
 * POST /api/link-health/check
 * 触发链接健康检测
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json();
    const input = await linkHealthCheckSkill.parseInput(body.message || "", {
      userId: user.id,
      params: body,
    });

    // 合并用户提供的参数
    if (body.scope) input.scope = body.scope;
    if (body.folderId) input.folderId = body.folderId;
    if (body.bookmarkIds) input.bookmarkIds = body.bookmarkIds;
    if (body.includeWayback !== undefined)
      input.includeWayback = body.includeWayback;

    // 创建 SSE 流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of linkHealthCheckSkill.executeStream({
            userId: user.id,
            params: input,
          })) {
            const data = JSON.stringify(chunk) + "\n";
            controller.enqueue(encoder.encode(`data: ${data}\n`));
          }
          controller.close();
        } catch (error) {
          logger.error({ error }, "Link health check stream error");
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    logger.error({ error }, "Link health check failed");
    return NextResponse.json({ error: "检测失败" }, { status: 500 });
  }
}
```

### 5.2 获取检测状态 API

```typescript
// src/app/api/link-health/status/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/link-health/status
 * 获取最新的检测状态
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 获取最新的检测记录
    const { data, error } = await supabase
      .from("link_health_checks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    // 获取书签健康统计
    const { data: healthStats } = await supabase
      .from("bookmarks")
      .select("health_status")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    const stats = {
      total: healthStats?.length || 0,
      healthy:
        healthStats?.filter((b) => b.health_status === "healthy").length || 0,
      failed:
        healthStats?.filter((b) => b.health_status === "failed").length || 0,
      slow: healthStats?.filter((b) => b.health_status === "slow").length || 0,
      unknown:
        healthStats?.filter((b) => b.health_status === "unknown").length || 0,
    };

    return NextResponse.json({
      lastCheck: data || null,
      stats,
    });
  } catch (error) {
    return NextResponse.json({ error: "获取状态失败" }, { status: 500 });
  }
}
```

### 5.3 获取历史记录 API

```typescript
// src/app/api/link-health/history/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/link-health/history
 * 获取检测历史记录
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    const { data, error, count } = await supabase
      .from("link_health_checks")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      records: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    return NextResponse.json({ error: "获取历史失败" }, { status: 500 });
  }
}
```

### 5.4 执行修复操作 API

```typescript
// src/app/api/link-health/fix/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  FixActionRequest,
  FixAction,
} from "@/lib/ai-skills/skills/link-health-check/types";

/**
 * POST /api/link-health/fix
 * 执行修复操作
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json();
    const { actions } = body as { actions: FixActionRequest[] };

    if (!actions || !Array.isArray(actions)) {
      return NextResponse.json({ error: "无效的请求" }, { status: 400 });
    }

    const results: Array<{
      bookmarkId: number;
      success: boolean;
      error?: string;
    }> = [];

    for (const action of actions) {
      try {
        switch (action.action) {
          case "delete":
            await supabase
              .from("bookmarks")
              .update({ deleted_at: new Date().toISOString() })
              .eq("id", action.bookmarkId)
              .eq("user_id", user.id);
            break;

          case "archive":
            await supabase
              .from("bookmarks")
              .update({
                is_archived: true,
                health_status: "failed",
              })
              .eq("id", action.bookmarkId)
              .eq("user_id", user.id);
            break;

          case "update_url":
            if (action.newUrl) {
              await supabase
                .from("bookmarks")
                .update({
                  url: action.newUrl,
                  health_status: "unknown",
                  health_checked_at: null,
                })
                .eq("id", action.bookmarkId)
                .eq("user_id", user.id);
            }
            break;

          case "ignore":
            // 标记为已忽略（不再提醒）
            await supabase
              .from("bookmarks")
              .update({ health_status: "ignored" })
              .eq("id", action.bookmarkId)
              .eq("user_id", user.id);
            break;
        }

        results.push({ bookmarkId: action.bookmarkId, success: true });
      } catch (error) {
        results.push({
          bookmarkId: action.bookmarkId,
          success: false,
          error: error instanceof Error ? error.message : "操作失败",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      results,
      summary: `成功处理 ${successCount}/${actions.length} 条`,
    });
  } catch (error) {
    logger.error({ error }, "Fix action failed");
    return NextResponse.json({ error: "修复失败" }, { status: 500 });
  }
}
```

---

## 6. 前端界面设计

### 6.1 页面结构

```
/link-health
├── 页面头部
│   ├── 标题 "链接健康检测"
│   ├── 上次检测时间
│   └── 触发检测按钮
│
├── 健康概览卡片
│   ├── 健康链接数（绿色）
│   ├── 失效链接数（红色）
│   ├── 缓慢链接数（黄色）
│   └── 未检测数（灰色）
│
├── 检测进度（检测中显示）
│   ├── 进度条
│   ├── 当前步骤
│   └── 实时数据
│
├── 问题链接列表
│   ├── 筛选器（全部/失效/缓慢/重定向）
│   ├── 链接卡片列表
│   │   ├── URL（可点击）
│   │   ├── 状态徽章
│   │   ├── 错误详情
│   │   ├── 归档链接（如有）
│   │   └── 操作按钮（删除/归档/更新）
│   └── 批量操作工具栏
│
└── 历史记录
    └── 检测历史列表（可折叠）
```

### 6.2 页面组件

```typescript
// src/app/(main)/link-health/page.tsx

import { Metadata } from "next";
import { LinkHealthPageClient } from "@/components/link-health/link-health-page-client";

export const metadata: Metadata = {
  title: "链接健康检测 - AnyKeep",
  description: "检测收藏链接的可访问性，发现并修复失效链接",
};

export default function LinkHealthPage() {
  return <LinkHealthPageClient />;
}
```

```typescript
// src/components/link-health/link-health-page-client.tsx

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Trash2,
  Archive,
  ExternalLink,
} from "lucide-react";
import { useHealthCheck } from "@/hooks/link-health/use-health-check";
import { useHealthHistory } from "@/hooks/link-health/use-health-history";
import { HealthCheckProgress } from "./health-check-progress";
import { ProblemLinkList } from "./problem-link-list";
import { HealthStatusBadge } from "./health-status-badge";
import { FixActionDialog } from "./fix-action-dialog";
import { formatRelativeTime } from "@/lib/utils/date";

export function LinkHealthPageClient() {
  const {
    isChecking,
    progress,
    currentStep,
    results,
    startCheck,
    cancelCheck,
  } = useHealthCheck();

  const { status, history, refresh } = useHealthHistory();

  const [selectedLinks, setSelectedLinks] = useState<number[]>([]);
  const [showFixDialog, setShowFixDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");

  // 筛选问题链接
  const filteredProblems = results?.problems?.filter(p => {
    if (activeTab === "all") return true;
    if (activeTab === "failed") return p.status === "failed";
    if (activeTab === "slow") return p.status === "slow";
    if (activeTab === "redirect") return p.status === "redirect";
    return true;
  }) || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">链接健康检测</h1>
          <p className="text-muted-foreground">
            {status?.lastCheck?.completed_at
              ? `上次检测: ${formatRelativeTime(status.lastCheck.completed_at)}`
              : "尚未进行过检测"}
          </p>
        </div>
        <Button
          onClick={() => startCheck({ scope: "all" })}
          disabled={isChecking}
        >
          {isChecking ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              检测中...
            </>
          ) : (
            <>
              <Activity className="mr-2 h-4 w-4" />
              开始检测
            </>
          )}
        </Button>
      </div>

      {/* 健康概览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              健康链接
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-2xl font-bold">{status?.stats?.healthy || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              失效链接
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-2xl font-bold text-red-500">
                {status?.stats?.failed || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              响应缓慢
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-yellow-500 mr-2" />
              <span className="text-2xl font-bold text-yellow-500">
                {status?.stats?.slow || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              待检测
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Activity className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-2xl font-bold text-gray-400">
                {status?.stats?.unknown || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 检测进度（检测中显示） */}
      {isChecking && (
        <HealthCheckProgress
          progress={progress}
          currentStep={currentStep}
          onCancel={cancelCheck}
        />
      )}

      {/* 问题链接列表 */}
      {results?.problems && results.problems.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>问题链接</CardTitle>
              {selectedLinks.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFixDialog(true)}
                  >
                    批量处理 ({selectedLinks.length})
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">
                  全部 ({results.problems.length})
                </TabsTrigger>
                <TabsTrigger value="failed">
                  失效 ({results.problems.filter(p => p.status === "failed").length})
                </TabsTrigger>
                <TabsTrigger value="slow">
                  缓慢 ({results.problems.filter(p => p.status === "slow").length})
                </TabsTrigger>
                <TabsTrigger value="redirect">
                  重定向 ({results.problems.filter(p => p.status === "redirect").length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                <ProblemLinkList
                  problems={filteredProblems}
                  selectedIds={selectedLinks}
                  onSelectionChange={setSelectedLinks}
                  onFix={(bookmarkId, action) => {
                    // 处理单个修复
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* 批量修复对话框 */}
      <FixActionDialog
        open={showFixDialog}
        onOpenChange={setShowFixDialog}
        bookmarkIds={selectedLinks}
        onComplete={() => {
          setSelectedLinks([]);
          refresh();
        }}
      />
    </div>
  );
}
```

### 6.3 问题链接列表组件

```typescript
// src/components/link-health/problem-link-list.tsx

"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Trash2,
  Archive,
  Link2,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { LinkCheckResult } from "@/lib/ai-skills/skills/link-health-check/types";

interface ProblemLinkListProps {
  problems: LinkCheckResult[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onFix: (bookmarkId: number, action: string) => void;
}

export function ProblemLinkList({
  problems,
  selectedIds,
  onSelectionChange,
  onFix,
}: ProblemLinkListProps) {
  const toggleSelection = (id: number) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const toggleAll = () => {
    if (selectedIds.length === problems.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(problems.map(p => p.bookmarkId));
    }
  };

  const getStatusBadge = (problem: LinkCheckResult) => {
    switch (problem.status) {
      case "failed":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            失效
          </Badge>
        );
      case "slow":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            缓慢 ({problem.responseTimeMs}ms)
          </Badge>
        );
      case "redirect":
        return (
          <Badge variant="outline">
            <Link2 className="h-3 w-3 mr-1" />
            重定向
          </Badge>
        );
      default:
        return null;
    }
  };

  const getErrorDetail = (problem: LinkCheckResult) => {
    if (!problem.errorType) return null;

    const errorNames: Record<string, string> = {
      not_found: "404 页面不存在",
      timeout: "请求超时",
      ssl_error: "SSL 证书错误",
      dns_error: "域名解析失败",
      connection_refused: "服务器拒绝连接",
    };

    return (
      <span className="text-xs text-muted-foreground">
        {errorNames[problem.errorType] || problem.errorMessage}
      </span>
    );
  };

  return (
    <div className="space-y-2">
      {/* 全选 */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <Checkbox
          checked={selectedIds.length === problems.length && problems.length > 0}
          onCheckedChange={toggleAll}
        />
        <span className="text-sm text-muted-foreground">
          {selectedIds.length > 0
            ? `已选择 ${selectedIds.length} 条`
            : "全选"}
        </span>
      </div>

      {/* 链接列表 */}
      {problems.map(problem => (
        <div
          key={problem.bookmarkId}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
        >
          <Checkbox
            checked={selectedIds.includes(problem.bookmarkId)}
            onCheckedChange={() => toggleSelection(problem.bookmarkId)}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <a
                href={problem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium truncate hover:underline"
              >
                {problem.url}
              </a>
              <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            </div>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge(problem)}
              {getErrorDetail(problem)}
            </div>
            {problem.waybackUrl && (
              <a
                href={problem.waybackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline mt-1 inline-flex items-center gap-1"
              >
                🗄️ 查看归档版本
              </a>
            )}
          </div>

          <div className="flex items-center gap-1">
            {problem.waybackUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onFix(problem.bookmarkId, "update_url")}
                title="更新为归档链接"
              >
                <Link2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFix(problem.bookmarkId, "archive")}
              title="归档"
            >
              <Archive className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFix(problem.bookmarkId, "delete")}
              title="删除"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      {problems.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          没有发现问题链接 🎉
        </div>
      )}
    </div>
  );
}
```

### 6.4 侧边栏健康指示器

```typescript
// 在侧边栏添加健康状态入口
// src/components/layout/sidebar.tsx 中添加

import { Activity } from "lucide-react";
import { useHealthStatus } from "@/hooks/link-health/use-health-status";

function SidebarHealthIndicator() {
  const { stats } = useHealthStatus();
  const hasProblems = (stats?.failed || 0) > 0;

  return (
    <Link
      href="/link-health"
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:bg-accent",
        pathname === "/link-health" && "bg-accent"
      )}
    >
      <div className="relative">
        <Activity className="h-4 w-4" />
        {hasProblems && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
        )}
      </div>
      <span>链接健康</span>
      {hasProblems && (
        <Badge variant="destructive" className="ml-auto">
          {stats.failed}
        </Badge>
      )}
    </Link>
  );
}
```

---

## 7. AI 集成设计

### 7.1 注册到 UnifiedEngine（支持开关控制）

```typescript
// src/lib/ai-skills/register.ts 中添加

import { linkHealthCheckSkill } from "./skills/link-health-check";

// 在 initializeUnifiedEngine 函数中添加（支持 Feature Flag）
if (process.env.ENABLE_LINK_HEALTH_CHECK !== "false") {
  unifiedEngine.registerOrchestrationSkill(linkHealthCheckSkill);
  logger.info("LinkHealthCheckSkill registered");
}
```

**Feature Flag 配置**：

```bash
# .env.local
ENABLE_LINK_HEALTH_CHECK=true   # 默认启用，设为 false 可禁用
```

**特性**：

- 独立模块，不影响其他 Skill
- 可通过环境变量动态开关
- 禁用时不会注册到 UnifiedEngine，AI 无法调用

### 7.2 意图模式匹配

```typescript
// src/lib/ai-skills/config/intent-patterns.ts 中添加

export const LINK_HEALTH_INTENT_PATTERNS = [
  // 中文
  /检[测查].*链接|链接.*检[测查]/,
  /失效.*链接|链接.*失效/,
  /死链|坏链/,
  /链接.*健康|健康.*检[测查]/,
  /404|无法访问/,
  /收藏.*能.*打开/,

  // 英文
  /check.*link|link.*check/i,
  /dead.*link|broken.*link/i,
  /link.*health/i,
  /404|inaccessible/i,
];

// 在 intent-classifier.ts 中添加意图类型
export type IntentType =
  | "search"
  | "manage"
  | "analyze"
  | "export"
  | "review"
  | "link_health" // 新增
  | "unknown";
```

### 7.3 自然语言触发示例

```
用户：帮我检查一下有没有失效的链接
AI：🔍 开始链接健康检测...

用户：我的收藏有多少404了
AI：正在检测链接可访问性...

用户：check dead links
AI：Starting link health check...

用户：清理一下打不开的收藏
AI：正在扫描失效链接，发现后会提供处理建议...
```

---

## 8. 性能与安全

### 8.1 性能优化

| 优化点        | 措施                           |
| ------------- | ------------------------------ |
| **并发控制**  | 默认 5 并发，最大 10，避免过载 |
| **HEAD 优先** | 先用 HEAD 请求，失败再 GET     |
| **批次处理**  | 每批 50 条，分批处理           |
| **超时控制**  | 默认 10 秒超时，可配置         |
| **增量更新**  | 只更新变化的健康状态           |
| **缓存结果**  | 24 小时内不重复检测同一 URL    |

### 8.2 安全考虑

| 风险点        | 防护措施                              |
| ------------- | ------------------------------------- |
| **IP 封禁**   | 使用合理的并发和延迟，添加 User-Agent |
| **SSRF 攻击** | 仅检测用户自己的书签，不接受任意 URL  |
| **资源耗尽**  | 单次最多 500 条，超时控制             |
| **数据泄露**  | RLS 策略确保用户只能访问自己的数据    |

### 8.3 错误处理

```typescript
// 错误分类和处理策略
const ERROR_HANDLING = {
  timeout: {
    retryable: true,
    maxRetries: 1,
    suggestion: "网络可能不稳定，建议稍后重试",
  },
  ssl_error: {
    retryable: false,
    maxRetries: 0,
    suggestion: "网站证书有问题，可能不安全",
  },
  dns_error: {
    retryable: false,
    maxRetries: 0,
    suggestion: "域名可能已不存在",
  },
  not_found: {
    retryable: false,
    maxRetries: 0,
    suggestion: "页面已被删除，可尝试查找归档版本",
  },
};
```

---

## 9. 测试策略

### 9.1 单元测试

```typescript
// src/lib/ai-skills/skills/link-health-check/__tests__/url-checker.test.ts

describe("UrlChecker", () => {
  it("should detect healthy URL", async () => {
    // Mock fetch 返回 200
  });

  it("should detect 404 URL", async () => {
    // Mock fetch 返回 404
  });

  it("should handle timeout", async () => {
    // Mock fetch 超时
  });

  it("should classify slow response", async () => {
    // Mock 慢响应
  });

  it("should handle SSL error", async () => {
    // Mock SSL 错误
  });
});
```

### 9.2 集成测试

```typescript
// src/lib/ai-skills/skills/link-health-check/__tests__/link-health-check.skill.test.ts

describe("LinkHealthCheckSkill", () => {
  it("should complete health check flow", async () => {
    // 测试完整流程
  });

  it("should generate correct report", async () => {
    // 测试报告生成
  });

  it("should handle cancellation", async () => {
    // 测试取消功能
  });

  it("should find wayback archives", async () => {
    // 测试归档查找
  });
});
```

### 9.3 E2E 测试

```typescript
// e2e/link-health.spec.ts

test("user can run link health check", async ({ page }) => {
  await page.goto("/link-health");
  await page.click('button:has-text("开始检测")');
  await expect(page.locator(".progress")).toBeVisible();
  await expect(page.locator(".results")).toBeVisible({ timeout: 60000 });
});
```

---

## 10. 实现计划

### 10.1 Sprint 分解

| Sprint       | 时间 | 交付物                               |
| ------------ | ---- | ------------------------------------ |
| **Sprint 1** | 3天  | 数据库迁移 + 类型定义 + URL 检测服务 |
| **Sprint 2** | 3天  | Skill 主类 + Wayback 服务 + 单元测试 |
| **Sprint 3** | 2天  | API 接口 + 注册到 UnifiedEngine      |
| **Sprint 4** | 3天  | 前端页面 + 组件 + Hooks              |
| **Sprint 5** | 2天  | 集成测试 + 侧边栏入口 + 文档         |

### 10.2 验收标准

- [ ] 能通过 AI 对话触发检测："帮我检查失效链接"
- [ ] 能在 /link-health 页面手动触发检测
- [ ] 检测结果实时流式展示
- [ ] 能识别 404/超时/SSL 错误/DNS 错误
- [ ] 能查找 Wayback Machine 归档
- [ ] 能批量删除/归档/更新失效链接
- [ ] 侧边栏显示健康状态指示器
- [ ] 单元测试覆盖率 > 80%
- [ ] 性能：500 条链接 < 2 分钟

---

---

## 11. 开发 Checklist（基于 AnyKeep-Tools-Skills-Development-Guide.md）

### 11.1 开发前

```markdown
- [x] 确认 Skill 类型: Orchestration Skill（多步骤、流式输出、用户确认）
- [x] 定义清晰的输入/输出接口
- [x] 检查是否有现有 Skill 可复用（参考 duplicate-cleanup.skill.ts）
- [x] 设计步骤和权重
- [x] 确认需要用户确认（删除/归档操作）
- [x] 定义交付物类型（report）
```

### 11.2 开发中

```markdown
- [ ] 使用 Zod 定义 inputSchema 和 outputSchema
- [ ] 添加完整的字段描述 (.describe())
- [ ] 实现 parseInput 方法（自然语言解析）
- [ ] 实现 executeStream 方法（流式执行）
- [ ] 使用 ProgressReporter 报告进度
- [ ] 处理用户确认流程
- [ ] 生成交付物（createDeliverable）
- [ ] 添加后续建议（emitSuggestions）
- [ ] 定义正确的 metadata（含 OrchestrationSkillMetadata 字段）
- [ ] 导出单例实例
```

### 11.3 开发后

```markdown
- [ ] 编写单元测试（覆盖率 > 80%）
- [ ] 编写集成测试
- [ ] 在 register.ts 中注册到 UnifiedEngine
- [ ] 添加意图分类规则（intent-classifier.ts）
- [ ] 添加 Skill 映射（mode-selector.ts）
- [ ] 更新 CLAUDE.md 文档
- [ ] 更新侧边栏入口
- [ ] 添加数据库迁移
```

### 11.4 代码审查 Checklist

```markdown
## 类型安全

- [ ] 无 any 类型
- [ ] 完整的 Zod Schema
- [ ] 正确的类型导出

## 错误处理

- [ ] try/catch 包裹异步操作
- [ ] 用户友好的错误消息
- [ ] 错误可重试标记（retryable）

## 性能

- [ ] 批量操作优化（并发控制）
- [ ] 进度报告节流（100ms）
- [ ] 无内存泄漏

## 安全

- [ ] 用户隔离（eq('user_id', context.userId)）
- [ ] 输入验证（Zod Schema）
- [ ] 危险操作确认（删除/批量操作）

## 测试

- [ ] 单元测试覆盖
- [ ] 边界条件测试
- [ ] 错误路径测试
- [ ] 集成测试（完整流程）
```

---

## 12. 命名规范对照表

| 项目        | 规范                        | 本设计使用                                             |
| ----------- | --------------------------- | ------------------------------------------------------ |
| Skill ID    | `snake_case`                | `link_health_check` ✅                                 |
| 类名        | `PascalCase` + `Skill` 后缀 | `LinkHealthCheckSkill` ✅                              |
| 文件名      | `kebab-case` + `.skill.ts`  | `link-health-check.skill.ts` ✅                        |
| Schema 变量 | `camelCase` + `Schema` 后缀 | `linkHealthCheckInputSchema` ✅                        |
| 实例导出    | `camelCase` + `Skill` 后缀  | `linkHealthCheckSkill` ✅                              |
| 步骤 ID     | `kebab-case`                | `collect`, `check`, `classify`, `wayback`, `report` ✅ |

---

**文档结束 - 等待审核**

---

> **下一步行动**：
>
> 1. 确认设计方案是否符合预期
> 2. 评审技术实现路径是否可行
> 3. 确定 Sprint 1 的启动时间
> 4. 开始按 Checklist 逐项实现
