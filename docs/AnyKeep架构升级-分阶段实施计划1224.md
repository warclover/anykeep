# AnyKeep 架构升级 - 分阶段实施计划

> **版本**: 1.0.0
> **作者**: Winston (首席架构师)
> **创建日期**: 2024-12-24
> **状态**: 待审核

---

## 目录

1. [执行摘要](#一执行摘要)
2. [现有功能清单](#二现有功能清单)
3. [Phase 0: 立即行动](#三phase-0-立即行动1-周)
4. [Phase 1: 短期优化](#四phase-1-短期优化2-3-周)
5. [Phase 2: 中期重构](#五phase-2-中期重构4-6-周)
6. [Phase 3: 长期完善](#六phase-3-长期完善持续)
7. [回滚方案](#七回滚方案)
8. [验收标准](#八验收标准)
9. [风险控制](#九风险控制)

---

## 一、执行摘要

### 1.1 升级目标

| 目标                    | 描述                                   | 优先级 |
| ----------------------- | -------------------------------------- | ------ |
| **API 路由治理**        | 167 端点重组为分层结构                 | P0     |
| **确认系统统一**        | Agent + Skills 双轨合并为 Effect Layer | P0     |
| **Classification 解耦** | 17 子模块拆分为 4 个独立模块           | P1     |
| **日志系统规范**        | 298 处 console 统一为 clientLogger     | P1     |
| **代码质量提升**        | Provider 嵌套优化、长组件拆分          | P2     |

### 1.2 时间线概览

```
Week 1          Week 2-3         Week 4-6         Week 7+
┌──────────┐   ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Phase 0  │ → │ Phase 1  │  →  │ Phase 2  │  →  │ Phase 3  │
│ 立即行动  │   │ 短期优化  │     │ 中期重构  │     │ 长期完善  │
└──────────┘   └──────────┘     └──────────┘     └──────────┘
  API 隔离       API 合并          Effect Layer     文档完善
  ESLint 规则    模块解耦          Provider 优化    持续优化
  前端适配器     日志迁移          组件拆分
```

### 1.3 核心原则

1. **功能零丢失**: 每个 Phase 完成后，所有现有功能必须可用
2. **增量发布**: 每个 Task 独立可发布，不阻塞业务
3. **可观测验收**: 每个 Task 有明确的验收标准
4. **快速回滚**: 每个 Phase 有独立的回滚方案

---

## 二、现有功能清单

### 2.1 页面功能清单（24 个页面）

| #   | 页面         | 路径                          | 功能描述                       | 涉及 API                          |
| --- | ------------ | ----------------------------- | ------------------------------ | --------------------------------- |
| 1   | 首页         | `/home`                       | 书签列表、平台筛选、批量操作   | `/bookmarks/*`, `/folders/*`      |
| 2   | 书签详情     | `/bookmark/[id]`              | 查看、编辑、删除书签           | `/bookmarks/[id]/*`               |
| 3   | 搜索         | `/search`                     | 语义搜索、全文搜索             | `/search`                         |
| 4   | 文件夹管理   | `/folders`                    | 文件夹 CRUD、排序、嵌套        | `/folders/*`                      |
| 5   | 批量操作     | `/batch`                      | 批量标签、批量移动             | `/bookmarks/batch-*`              |
| 6   | 数据导出     | `/export`                     | 多格式导出（CSV/MD/JSON/HTML） | `/user/export`                    |
| 7   | 收件箱       | `/inbox`                      | 待分类书签、分类建议           | `/classification/*`               |
| 8   | 标签管理     | `/tags`                       | 标签列表、标签图谱             | `/tags/*`                         |
| 9   | 设置         | `/settings`                   | 用户偏好、通知设置             | `/settings/*`, `/user/*`          |
| 10  | AI 设置      | `/settings/ai`                | AI 功能配置                    | `/settings/ai-folder`             |
| 11  | AI 报告      | `/settings/ai-reports`        | AI 演化报告                    | `/folder-evolution/*`             |
| 12  | 消息中心     | `/messages`                   | 消息列表、未读消息             | `/messages/*`                     |
| 13  | 待处理消息   | `/messages/pending`           | 待确认分类                     | `/classification/confirmations/*` |
| 14  | 活动记录     | `/activity`                   | 操作历史                       | N/A                               |
| 15  | 分析统计     | `/analytics`                  | 收藏统计、趋势分析             | `/classification/analytics`       |
| 16  | 文件夹健康度 | `/folder-health`              | 文件夹优化建议                 | `/classification/folder-health/*` |
| 17  | 图书管理员   | `/librarian`                  | 智能整理建议                   | `/librarian/*`                    |
| 18  | MD 集合      | `/md-collections`             | Markdown 文档管理              | `/md-collections/*`               |
| 19  | MD 详情      | `/md-collections/[id]`        | MD 文档详情                    | `/md-collections/[id]/*`          |
| 20  | AI 测试      | `/ai-test`                    | AI 功能测试                    | `/agent/*`                        |
| 21  | 分类调试器   | `/classification-debugger`    | 分类调试工具                   | `/classification/debug`           |
| 22  | 分类对比     | `/dev/classification-compare` | 分类版本对比                   | `/classification/ab-test`         |
| 23  | 分类追踪     | `/dev/classification-trace`   | 分类决策追踪                   | `/classification/trace`           |
| 24  | AI 摘要调试  | `/debug/ai-summary`           | 摘要生成调试                   | `/debug/ai-summary`               |

### 2.2 API 端点清单（167 个端点）

#### A. 核心业务 API（58 个）

| 模块            | 端点数 | 关键端点                                                                |
| --------------- | ------ | ----------------------------------------------------------------------- |
| **bookmarks**   | 13     | `GET/POST /bookmarks`, `GET/PUT/DELETE /bookmarks/[id]`, `batch-*`      |
| **folders**     | 15     | `GET/POST /folders`, `GET/PUT/DELETE /folders/[id]`, `reorder`, `merge` |
| **search**      | 1      | `GET /search`                                                           |
| **tags**        | 4      | `GET /tags/*`, `synonyms`, `graph`                                      |
| **messages**    | 5      | `GET/POST /messages`, `batch-read`, `unread-count`                      |
| **smart-lists** | 6      | CRUD + `preview`, `reorder`                                             |
| **snapshots**   | 7      | CRUD + `process`, `batch`, `quota`                                      |
| **summary**     | 7      | `generate`, `batch`, `feedback`, `stats`, `health`                      |

#### B. AI 功能 API（25 个）

| 模块               | 端点数 | 关键端点                                       |
| ------------------ | ------ | ---------------------------------------------- |
| **agent**          | 4      | `unified`, `chat`, `confirm`, `stats`          |
| **ai**             | 3      | `vision-analyze`, `quick-actions`, `providers` |
| **knowledge-link** | 4      | `graph`, `related/[bookmarkId]`, `stats`       |
| **librarian**      | 2      | `analysis`, `patrol`                           |
| **reclassify**     | 3      | `check`, `suggestions`, `POST /reclassify`     |

#### C. 分类系统 API（28 个）- 需重点重组

| 子模块         | 端点数 | 端点列表                                                                                                          |
| -------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| **核心分类**   | 4      | `classify`, `test`, `debug`, `trace`                                                                              |
| **确认管理**   | 4      | `confirmations`, `confirmations/[id]`, `confirmations/batch`, `cluster-confirm`                                   |
| **建议管理**   | 3      | `cluster-suggestions`, `cluster-stats`, `inbox`                                                                   |
| **配置管理**   | 4      | `settings`, `ab-test`, `analytics`, `statistics`                                                                  |
| **兴趣档案**   | 4      | `interests`, `interests/custom`, `interest-profile`, `interest-profile/analyze`                                   |
| **文件夹档案** | 5      | `folders/profiles`, `folders/profiles/[id]`, `folders/profiles/summary`, `folder-health`, `folder-health/summary` |
| **来源档案**   | 2      | `source-profiles`, `source-profiles/[id]`                                                                         |
| **其他**       | 2      | `history`, `feedback`                                                                                             |

#### D. 文件夹演化 API（10 个）

| 端点                | 功能       |
| ------------------- | ---------- |
| `merge-suggestions` | 合并建议   |
| `split-suggestions` | 拆分建议   |
| `confirm-merge`     | 确认合并   |
| `confirm-split`     | 确认拆分   |
| `rename`            | 重命名建议 |
| `history`           | 演化历史   |
| `reports`           | 演化报告   |
| `snapshot/[id]`     | 快照详情   |
| `undo/[id]`         | 撤销操作   |

#### E. 管理/调试 API（16 个）- 需隔离

| 模块            | 端点数 | 端点列表                                                                                                                                                             |
| --------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**       | 2      | `classification-config`, `embedding-ab-test`                                                                                                                         |
| **cron**        | 7      | `classification-optimize`, `cleanup-snapshots`, `generate-monthly-reports`, `multi-vector-migration`, `process-job-queue`, `smart-sorting`, `update-folder-profiles` |
| **dev**         | 4      | `process-snapshots`, `reprocess-snapshot`, `snapshots-debug`, `test-wechat-parse`                                                                                    |
| **debug**       | 1      | `ai-summary`                                                                                                                                                         |
| **maintenance** | 2      | `check`, `trigger`                                                                                                                                                   |

#### F. 其他 API（30 个）

| 模块                 | 端点数 | 关键端点                                                                                         |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| **browser-bookmark** | 4      | `export`, `history`, `fetch-metadata`, `validate`                                                |
| **wechat-article**   | 4      | CRUD + `export`, `refetch`                                                                       |
| **user**             | 6      | `settings`, `trust-mode`, `summary-mode`, `export`, `delete`                                     |
| **settings**         | 5      | `profile`, `ai-folder`, `notifications`, `trust-mode`, `usage-tags`                              |
| **confirmations**    | 2      | `GET /confirmations`, `GET/PUT/DELETE /confirmations/[id]`                                       |
| **embedding**        | 1      | `migrate`                                                                                        |
| **其他**             | 8      | `auth/login`, `init`, `upload`, `image-proxy`, `share-target`, `metrics`, `llm-usage`, `sources` |

### 2.3 AI Skills 清单（21 个）

#### A. 编排 Skills（11 个）

| Skill ID            | 名称         | 功能                 | 状态      |
| ------------------- | ------------ | -------------------- | --------- |
| `knowledge_review`  | 知识复习助手 | 艾宾浩斯曲线复习计划 | ✅ 已实现 |
| `data_export`       | 数据导出助手 | 多格式导出           | ✅ 已实现 |
| `insight_report`    | 洞察报告助手 | 活跃度分析、趋势洞察 | ✅ 已实现 |
| `batch_organize`    | 智能整理助手 | 自动分类、去重、归档 | ✅ 已实现 |
| `duplicate_cleanup` | 去重清理助手 | 检测和清理重复书签   | ✅ 已实现 |
| `reading_planner`   | 阅读计划助手 | 个性化阅读计划       | ✅ 已实现 |
| `smart_tagging`     | 智能标签助手 | AI 自动标签生成      | ✅ 已实现 |
| `learning_path`     | 学习路径规划 | 个性化学习路线       | ✅ 已实现 |
| `periodic_report`   | 周期报告生成 | 周/月报告自动生成    | ✅ 已实现 |
| `quick_digest`      | 快速摘要助手 | 批量内容摘要         | ✅ 已实现 |
| `related_discovery` | 相关内容发现 | 发现相关收藏         | ✅ 已实现 |
| `share_bundle`      | 分享包生成   | 打包分享收藏         | ✅ 已实现 |

#### B. 原子 Skills（3 个）

| Skill ID   | 名称 | 功能       |
| ---------- | ---- | ---------- |
| `classify` | 分类 | 单书签分类 |
| `search`   | 搜索 | 语义搜索   |
| `summary`  | 摘要 | 生成摘要   |

### 2.4 核心组件清单

| 组件目录          | 组件数 | 关键组件                                                                               |
| ----------------- | ------ | -------------------------------------------------------------------------------------- |
| `bookmark/`       | 15+    | `virtual-bookmark-list`, `virtual-bookmark-grid`, `bookmark-card`, `bookmark-detail-*` |
| `home/`           | 10+    | `home-page-client`, `home-toolbar`, `home-dialogs`, `home-batch-toolbar`               |
| `folders/`        | 8+     | `folder-tree`, `folder-item`, `create-folder-dialog`                                   |
| `ai/`             | 10+    | `ai-panel-content`, `ai-deliverable-card`, `ai-chat-*`                                 |
| `classification/` | 12+    | `pending-confirmations-*`, `classification-feedback-*`                                 |
| `export/`         | 8+     | `export-dialog-v2`, `export-preview`, `export-progress`                                |
| `batch/`          | 5+     | `batch-page-client`, `batch-tag-dialog`, `batch-toolbar`                               |
| `search/`         | 5+     | `search-page-client`, `search-results`                                                 |

### 2.5 数据库功能清单

| 类别         | 数量 | 说明                     |
| ------------ | ---- | ------------------------ |
| **数据表**   | 25+  | 核心业务表 + AI 功能表   |
| **RLS 策略** | 173  | 行级安全策略             |
| **索引**     | 100+ | 复合索引 + HNSW 向量索引 |
| **函数**     | 70+  | 搜索、批量操作、统计函数 |
| **迁移文件** | 118  | 版本控制的数据库变更     |

---

## 三、Phase 0: 立即行动（1 周）

### 3.1 概述

| 指标     | 值                           |
| -------- | ---------------------------- |
| **目标** | 基础设施准备，不影响现有功能 |
| **工期** | 5 个工作日                   |
| **风险** | 低                           |
| **回滚** | 直接回滚代码                 |

### 3.2 Task 0.1: 隔离管理/调试 API

#### 目标

将 16 个管理/调试 API 移动到 `/api/admin/` 和 `/api/internal/` 目录

#### 前端工作

| #      | 任务                       | 文件                             | 验收标准              |
| ------ | -------------------------- | -------------------------------- | --------------------- |
| F0.1.1 | 创建 API 路径常量文件      | `src/lib/constants/api-paths.ts` | 所有 API 路径集中管理 |
| F0.1.2 | 更新 admin API 调用路径    | `src/components/settings/*`      | 使用新常量，功能正常  |
| F0.1.3 | 更新 cron 监控页面（如有） | `src/app/(main)/*/page.tsx`      | 页面正常加载          |

#### 后端工作

| #      | 任务                         | 文件变更                                         | 验收标准              |
| ------ | ---------------------------- | ------------------------------------------------ | --------------------- |
| B0.1.1 | 创建 `/api/admin/` 目录结构  | 新建目录                                         | 目录存在              |
| B0.1.2 | 移动 `classification-config` | `api/admin/ → api/admin/classification-config/`  | API 可访问            |
| B0.1.3 | 移动 `embedding-ab-test`     | `api/admin/ → api/admin/embedding-ab-test/`      | API 可访问            |
| B0.1.4 | 创建 `/api/internal/` 目录   | 新建目录                                         | 目录存在              |
| B0.1.5 | 移动 7 个 cron API           | `api/cron/* → api/internal/cron/*`               | 所有 cron 正常触发    |
| B0.1.6 | 移动 4 个 dev API            | `api/dev/* → api/internal/dev/*`                 | 调试功能正常          |
| B0.1.7 | 移动 debug API               | `api/debug/* → api/internal/debug/*`             | 调试功能正常          |
| B0.1.8 | 移动 maintenance API         | `api/maintenance/* → api/internal/maintenance/*` | 维护功能正常          |
| B0.1.9 | 添加旧路径重定向（兼容）     | 各原路径 `route.ts`                              | 旧路径返回 301 重定向 |

#### 目录结构变更

```
src/app/api/
├── admin/                        # 管理员 API（新）
│   ├── classification-config/
│   │   └── route.ts
│   └── embedding-ab-test/
│       └── route.ts
│
├── internal/                     # 内部 API（新）
│   ├── cron/
│   │   ├── classification-optimize/
│   │   ├── cleanup-snapshots/
│   │   ├── generate-monthly-reports/
│   │   ├── multi-vector-migration/
│   │   ├── process-job-queue/
│   │   ├── smart-sorting/
│   │   └── update-folder-profiles/
│   ├── dev/
│   │   ├── process-snapshots/
│   │   ├── reprocess-snapshot/
│   │   ├── snapshots-debug/
│   │   └── test-wechat-parse/
│   ├── debug/
│   │   └── ai-summary/
│   └── maintenance/
│       ├── check/
│       └── trigger/
│
├── bookmarks/                    # 不变
├── folders/                      # 不变
└── ...
```

#### 验收清单

- [ ] `/api/admin/classification-config` 返回 200
- [ ] `/api/admin/embedding-ab-test` 返回 200
- [ ] 所有 7 个 `/api/internal/cron/*` 端点可访问
- [ ] 所有 4 个 `/api/internal/dev/*` 端点可访问
- [ ] `/api/internal/debug/ai-summary` 可访问
- [ ] `/api/internal/maintenance/*` 可访问
- [ ] 旧路径 `/api/cron/*` 返回 301 重定向
- [ ] 前端设置页面功能正常
- [ ] Cron 任务正常执行（检查日志）

---

### 3.3 Task 0.2: 添加 ESLint no-console 规则

#### 目标

禁止直接使用 console，强制使用 clientLogger

#### 前端工作

| #      | 任务                   | 文件                         | 验收标准                         |
| ------ | ---------------------- | ---------------------------- | -------------------------------- |
| F0.2.1 | 更新 ESLint 配置       | `.eslintrc.js`               | 添加 no-console 规则             |
| F0.2.2 | 扩展 clientLogger 功能 | `src/lib/client-logger.ts`   | 支持更多日志级别和上下文         |
| F0.2.3 | 创建迁移脚本           | `scripts/migrate-console.ts` | 自动替换 console 为 clientLogger |

#### ESLint 配置

```javascript
// .eslintrc.js 追加规则
module.exports = {
  rules: {
    // 禁止 console，但允许 warn 和 error 在开发环境
    "no-console": [
      "error",
      {
        allow: ["warn", "error"], // 暂时允许，后续逐步迁移
      },
    ],
  },
  overrides: [
    {
      // 允许在特定文件中使用 console
      files: ["src/lib/client-logger.ts", "scripts/**/*.ts"],
      rules: {
        "no-console": "off",
      },
    },
  ],
};
```

#### clientLogger 增强

```typescript
// src/lib/client-logger.ts 增强版
import * as Sentry from "@sentry/nextjs";

interface LogContext {
  [key: string]: unknown;
}

interface LoggerConfig {
  enableSentry: boolean;
  enableRemote: boolean;
}

const config: LoggerConfig = {
  enableSentry: process.env.NODE_ENV === "production",
  enableRemote: false, // 未来可启用远程日志
};

export const clientLogger = {
  debug(context: LogContext | string, message?: string): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(formatMessage("debug", context, message));
    }
  },

  info(context: LogContext | string, message?: string): void {
    if (process.env.NODE_ENV === "development") {
      console.info(formatMessage("info", context, message));
    }
  },

  warn(context: LogContext | string, message?: string): void {
    const formatted = formatMessage("warn", context, message);
    console.warn(formatted);

    if (config.enableSentry) {
      Sentry.captureMessage(formatted, "warning");
    }
  },

  error(context: LogContext | string, message?: string, error?: Error): void {
    const formatted = formatMessage("error", context, message);
    console.error(formatted);

    if (config.enableSentry) {
      Sentry.captureException(error || new Error(formatted));
    }
  },

  // 新增：性能日志
  perf(label: string, duration: number): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[PERF] ${label}: ${duration}ms`);
    }
  },

  // 新增：带组的日志
  group(label: string): void {
    if (process.env.NODE_ENV === "development") {
      console.group(label);
    }
  },

  groupEnd(): void {
    if (process.env.NODE_ENV === "development") {
      console.groupEnd();
    }
  },
};
```

#### 验收清单

- [ ] `npm run lint` 检测到 console 使用
- [ ] `src/lib/client-logger.ts` 功能增强完成
- [ ] 新代码不允许直接使用 console
- [ ] 现有 console 使用被标记为警告（暂不阻断构建）

---

### 3.4 Task 0.3: 创建前端确认系统统一适配器

#### 目标

创建统一的确认处理 Hook，屏蔽 Agent 和 Skills 确认的差异

#### 前端工作

| #      | 任务              | 文件                                              | 验收标准    |
| ------ | ----------------- | ------------------------------------------------- | ----------- |
| F0.3.1 | 创建统一确认 Hook | `src/hooks/domain/ai/use-unified-confirmation.ts` | Hook 可用   |
| F0.3.2 | 创建确认类型定义  | `src/types/confirmation.ts`                       | 类型完整    |
| F0.3.3 | 更新 AIChatPanel  | `src/components/ai/ai-panel-content.tsx`          | 使用新 Hook |
| F0.3.4 | 更新确认 UI 组件  | `src/components/ai/ai-confirmation-*`             | 视觉一致    |

#### 代码实现

```typescript
// src/types/confirmation.ts
export interface UnifiedConfirmation {
  id: string;
  source: "tool" | "skill";
  mode: "atomic" | "orchestration";
  title: string;
  message: string;
  options: ConfirmOption[];
  preview?: unknown;
  expiresAt: string;
  metadata?: Record<string, unknown>;
}

export interface ConfirmOption {
  id: string;
  label: string;
  variant: "default" | "destructive" | "outline";
  icon?: string;
}

export interface ConfirmationResult {
  confirmed: boolean;
  optionId: string;
  timestamp: string;
}
```

```typescript
// src/hooks/domain/ai/use-unified-confirmation.ts
import { useCallback, useState } from "react";
import type {
  UnifiedConfirmation,
  ConfirmationResult,
} from "@/types/confirmation";

interface UseUnifiedConfirmationReturn {
  pendingConfirmation: UnifiedConfirmation | null;
  handleConfirmation: (
    confirmation: UnifiedConfirmation,
    result: ConfirmationResult,
  ) => Promise<void>;
  clearConfirmation: () => void;
}

export function useUnifiedConfirmation(): UseUnifiedConfirmationReturn {
  const [pendingConfirmation, setPendingConfirmation] =
    useState<UnifiedConfirmation | null>(null);

  const handleConfirmation = useCallback(
    async (confirmation: UnifiedConfirmation, result: ConfirmationResult) => {
      const { source, mode, id } = confirmation;

      try {
        if (source === "tool") {
          // Tool 确认：调用 /api/agent/confirm
          await fetch("/api/agent/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              confirmationId: id,
              action: result.confirmed ? "confirm" : "cancel",
              optionId: result.optionId,
            }),
          });
        } else {
          // Skill 确认：通过流式响应返回
          // 确认结果会在下一次流式块中处理
          // 这里只需要更新本地状态
        }

        setPendingConfirmation(null);
      } catch (error) {
        clientLogger.error({ confirmation, result, error }, "确认处理失败");
        throw error;
      }
    },
    [],
  );

  const clearConfirmation = useCallback(() => {
    setPendingConfirmation(null);
  }, []);

  return {
    pendingConfirmation,
    handleConfirmation,
    clearConfirmation,
  };
}
```

```typescript
// src/hooks/domain/ai/use-stream-chunk-handler.ts
// 统一处理流式块，识别确认请求

import { useCallback } from "react";
import type { UnifiedStreamChunk } from "@/lib/ai-skills/output/types";
import type { UnifiedConfirmation } from "@/types/confirmation";

export function useStreamChunkHandler(
  onConfirmation: (confirmation: UnifiedConfirmation) => void,
) {
  const handleChunk = useCallback(
    (chunk: UnifiedStreamChunk) => {
      if (chunk.type === "confirmation") {
        // 转换为统一格式
        const unified: UnifiedConfirmation = {
          id: chunk.data.id,
          source: detectSource(chunk),
          mode: chunk.data.mode || "atomic",
          title: chunk.data.title,
          message: chunk.data.message,
          options: chunk.data.options,
          preview: chunk.data.preview,
          expiresAt: chunk.data.expiresAt,
        };
        onConfirmation(unified);
      }

      // 处理其他类型的块...
    },
    [onConfirmation],
  );

  return { handleChunk };
}

function detectSource(chunk: UnifiedStreamChunk): "tool" | "skill" {
  // 根据块的特征判断来源
  if (chunk.data?.toolName) return "tool";
  if (chunk.data?.skillId) return "skill";
  return "skill"; // 默认为 skill
}
```

#### 验收清单

- [ ] `use-unified-confirmation.ts` 创建完成
- [ ] 类型定义 `confirmation.ts` 完成
- [ ] AIChatPanel 使用新 Hook
- [ ] Tool 确认流程正常（删除书签需确认）
- [ ] Skill 确认流程正常（BatchOrganize 需确认）
- [ ] 确认 UI 视觉一致（统一的确认对话框样式）

---

### 3.5 Task 0.4: 创建 API 路径常量文件

#### 目标

集中管理所有 API 路径，为后续重组做准备

#### 前端工作

| #      | 任务                  | 文件                             | 验收标准           |
| ------ | --------------------- | -------------------------------- | ------------------ |
| F0.4.1 | 创建 API 路径常量     | `src/lib/constants/api-paths.ts` | 所有 API 路径定义  |
| F0.4.2 | 创建 API 路径工具函数 | `src/lib/utils/api.ts`           | 路径生成函数       |
| F0.4.3 | 逐步替换硬编码路径    | 各组件/hooks                     | 使用常量替代字符串 |

#### 代码实现

```typescript
// src/lib/constants/api-paths.ts
export const API_PATHS = {
  // ==================== 书签 ====================
  bookmarks: {
    list: "/api/bookmarks",
    detail: (id: number) => `/api/bookmarks/${id}`,
    related: (id: number) => `/api/bookmarks/${id}/related`,
    restore: (id: number) => `/api/bookmarks/${id}/restore`,
    permanent: (id: number) => `/api/bookmarks/${id}/permanent`,
    batchDelete: "/api/bookmarks/batch-delete",
    batchMove: "/api/bookmarks/batch-move",
    batchRestore: "/api/bookmarks/batch-restore",
    batchStatus: "/api/bookmarks/batch-status",
    batchImport: "/api/bookmarks/batch-import",
    batchTags: "/api/bookmarks/batch-tags",
    suggestions: "/api/bookmarks/suggestions",
    generateTags: "/api/bookmarks/generate-tags",
    embeddings: "/api/bookmarks/embeddings",
    metadata: "/api/bookmarks/metadata",
    validate: "/api/bookmarks/validate",
  },

  // ==================== 文件夹 ====================
  folders: {
    list: "/api/folders",
    detail: (id: number) => `/api/folders/${id}`,
    bookmarks: (id: number) => `/api/folders/${id}/bookmarks`,
    archive: (id: number) => `/api/folders/${id}/archive`,
    lock: (id: number) => `/api/folders/${id}/lock`,
    merge: (id: number) => `/api/folders/${id}/merge`,
    moveGroup: (id: number) => `/api/folders/${id}/move-group`,
    batchCreate: "/api/folders/batch-create",
    batchLockStatus: "/api/folders/batch-lock-status",
    connections: "/api/folders/connections",
    reorder: "/api/folders/reorder",
    suggestions: "/api/folders/suggestions",
    inbox: "/api/folders/inbox",
    fixEmbeddings: "/api/folders/fix-embeddings",
  },

  // ==================== AI Agent ====================
  agent: {
    unified: "/api/agent/unified",
    chat: "/api/agent/chat",
    confirm: "/api/agent/confirm",
    stats: "/api/agent/stats",
  },

  // ==================== 分类 ====================
  classification: {
    classify: "/api/classification/classify",
    test: "/api/classification/test",
    debug: "/api/classification/debug",
    trace: "/api/classification/trace",
    reason: (bookmarkId: number) => `/api/classification/${bookmarkId}/reason`,

    // 确认管理
    confirmations: {
      list: "/api/classification/confirmations",
      detail: (id: string) => `/api/classification/confirmations/${id}`,
      batch: "/api/classification/confirmations/batch",
    },

    // 建议
    clusterSuggestions: "/api/classification/cluster-suggestions",
    clusterStats: "/api/classification/cluster-stats",
    clusterConfirm: "/api/classification/cluster-confirm",
    inbox: "/api/classification/inbox",

    // 配置
    settings: "/api/classification/settings",
    abTest: "/api/classification/ab-test",
    analytics: "/api/classification/analytics",
    statistics: "/api/classification/statistics",
    history: "/api/classification/history",
    feedback: "/api/classification/feedback",

    // 兴趣档案
    interests: {
      list: "/api/classification/interests",
      custom: "/api/classification/interests/custom",
    },
    interestProfile: {
      get: "/api/classification/interest-profile",
      analyze: "/api/classification/interest-profile/analyze",
    },

    // 文件夹档案
    folderProfiles: {
      list: "/api/classification/folders/profiles",
      detail: (id: number) => `/api/classification/folders/profiles/${id}`,
      summary: "/api/classification/folders/profiles/summary",
    },
    folderHealth: {
      get: "/api/classification/folder-health",
      summary: "/api/classification/folder-health/summary",
    },

    // 来源档案
    sourceProfiles: {
      list: "/api/classification/source-profiles",
      detail: (id: string) => `/api/classification/source-profiles/${id}`,
    },

    // 阶段
    stage: "/api/classification/stage",
  },

  // ==================== 管理员 (新路径) ====================
  admin: {
    classificationConfig: "/api/admin/classification-config",
    embeddingAbTest: "/api/admin/embedding-ab-test",
  },

  // ==================== 内部 (新路径) ====================
  internal: {
    cron: {
      classificationOptimize: "/api/internal/cron/classification-optimize",
      cleanupSnapshots: "/api/internal/cron/cleanup-snapshots",
      generateMonthlyReports: "/api/internal/cron/generate-monthly-reports",
      multiVectorMigration: "/api/internal/cron/multi-vector-migration",
      processJobQueue: "/api/internal/cron/process-job-queue",
      smartSorting: "/api/internal/cron/smart-sorting",
      updateFolderProfiles: "/api/internal/cron/update-folder-profiles",
    },
    dev: {
      processSnapshots: "/api/internal/dev/process-snapshots",
      reprocessSnapshot: "/api/internal/dev/reprocess-snapshot",
      snapshotsDebug: "/api/internal/dev/snapshots-debug",
      testWechatParse: "/api/internal/dev/test-wechat-parse",
    },
    debug: {
      aiSummary: "/api/internal/debug/ai-summary",
    },
    maintenance: {
      check: "/api/internal/maintenance/check",
      trigger: "/api/internal/maintenance/trigger",
    },
  },

  // ==================== 其他模块 ====================
  search: "/api/search",

  tags: {
    list: "/api/tags",
    related: (tag: string) => `/api/tags/${encodeURIComponent(tag)}/related`,
    synonyms: "/api/tags/synonyms",
    graph: "/api/tags/graph",
  },

  messages: {
    list: "/api/messages",
    detail: (id: string) => `/api/messages/${id}`,
    batchRead: "/api/messages/batch-read",
    unreadCount: "/api/messages/unread-count",
  },

  smartLists: {
    list: "/api/smart-lists",
    detail: (id: number) => `/api/smart-lists/${id}`,
    preview: "/api/smart-lists/preview",
    reorder: "/api/smart-lists/reorder",
    initPresets: "/api/smart-lists/init-presets",
  },

  // ... 其他模块
} as const;

// 类型导出
export type ApiPaths = typeof API_PATHS;
```

#### 验收清单

- [ ] `api-paths.ts` 包含所有 167 个端点
- [ ] 类型定义完整，支持 IDE 自动补全
- [ ] 至少 10 个组件/hooks 使用新常量
- [ ] 无新的硬编码 API 路径引入

---

### 3.6 Phase 0 总验收

| 验收项      | 验收标准                             | 验收人     |
| ----------- | ------------------------------------ | ---------- |
| API 隔离    | 16 个 API 成功移动，旧路径重定向正常 | Backend    |
| ESLint 规则 | no-console 规则生效，不阻断构建      | Frontend   |
| 确认适配器  | Tool 和 Skill 确认都能正常处理       | Full Stack |
| API 常量    | 所有路径集中管理，类型完整           | Frontend   |
| 功能验证    | 所有 24 个页面功能正常               | QA         |
| 回归测试    | 现有测试全部通过                     | CI         |

---

## 四、Phase 1: 短期优化（2-3 周）

### 4.1 概述

| 指标     | 值                             |
| -------- | ------------------------------ |
| **目标** | API 合并、模块解耦、日志规范化 |
| **工期** | 10-15 个工作日                 |
| **风险** | 中                             |
| **回滚** | 分支回滚 + 数据库迁移回滚      |

### 4.2 Task 1.1: 合并 Classification API（28→12）

#### 目标

将 28 个分类相关 API 合并为 12 个，减少端点数量

#### API 合并映射

```
当前 (28 个)                           合并后 (12 个)
─────────────────────────────────────────────────────────────
/classification/classify               → /classification/classify
/classification/test                   ↘
/classification/debug                  → /classification/debug (合并)
/classification/trace                  ↗

/classification/confirmations          → /classification/confirmations
/classification/confirmations/[id]     → /classification/confirmations/[id]
/classification/confirmations/batch    → /classification/confirmations/batch
/classification/cluster-confirm        ↗

/classification/cluster-suggestions    ↘
/classification/cluster-stats          → /classification/suggestions (合并)
/classification/inbox                  ↗

/classification/settings               → /classification/settings
/classification/ab-test               ↗
/classification/analytics              ↘
/classification/statistics             → /classification/analytics (合并)
/classification/history                ↗

/classification/interests              ↘
/classification/interests/custom       → /classification/interests (合并)
/classification/interest-profile       → /classification/profiles/interest
/classification/interest-profile/analyze ↗

/classification/folders/profiles       ↘
/classification/folders/profiles/[id]  → /classification/profiles/folder (合并)
/classification/folders/profiles/summary ↗
/classification/folder-health          → /classification/health
/classification/folder-health/summary  ↗

/classification/source-profiles        → /classification/profiles/source
/classification/source-profiles/[id]   ↗

/classification/feedback               → /classification/feedback
/classification/stage                  → /classification/stage
/classification/[bookmarkId]/reason   → /classification/reason/[bookmarkId]
```

#### 后端工作

| #      | 任务                              | 工作内容                                    | 工期   |
| ------ | --------------------------------- | ------------------------------------------- | ------ |
| B1.1.1 | 创建合并后的路由文件              | 12 个新 route.ts                            | 2 天   |
| B1.1.2 | 合并 debug/test/trace 逻辑        | 统一调试端点                                | 1 天   |
| B1.1.3 | 合并 analytics/statistics/history | 统一分析端点                                | 1 天   |
| B1.1.4 | 合并 suggestions 相关             | cluster-suggestions + cluster-stats + inbox | 1 天   |
| B1.1.5 | 合并 profiles 相关                | folder/source/interest profiles             | 1 天   |
| B1.1.6 | 添加旧路径重定向                  | 28 个重定向                                 | 0.5 天 |
| B1.1.7 | 更新 OpenAPI 文档                 | 如有                                        | 0.5 天 |

#### 前端工作

| #      | 任务               | 工作内容   | 工期   |
| ------ | ------------------ | ---------- | ------ |
| F1.1.1 | 更新 api-paths.ts  | 新路径映射 | 0.5 天 |
| F1.1.2 | 更新分类相关 hooks | 使用新路径 | 1 天   |
| F1.1.3 | 更新分类相关组件   | 使用新路径 | 1 天   |
| F1.1.4 | 更新设置页面       | 分类配置   | 0.5 天 |

#### 新 API 结构

```typescript
// 合并后的 API 结构
/api/classification/
├── classify/                  # 核心分类
│   └── route.ts              # POST: 执行分类
├── debug/                     # 调试（合并 test/debug/trace）
│   └── route.ts              # GET: 调试信息, POST: 测试分类
├── confirmations/             # 确认管理
│   ├── route.ts              # GET: 列表, POST: 批量确认
│   └── [id]/
│       └── route.ts          # GET/PUT/DELETE: 单个确认
├── suggestions/               # 建议（合并 cluster-*）
│   └── route.ts              # GET: 获取建议, POST: 确认建议
├── settings/                  # 设置（合并 ab-test）
│   └── route.ts              # GET/PUT: 分类设置
├── analytics/                 # 分析（合并 statistics/history）
│   └── route.ts              # GET: 分析数据
├── profiles/                  # 档案（新结构）
│   ├── interest/
│   │   └── route.ts          # GET/PUT: 兴趣档案
│   ├── folder/
│   │   └── route.ts          # GET: 文件夹档案
│   └── source/
│       └── route.ts          # GET: 来源档案
├── health/                    # 健康度（合并 folder-health）
│   └── route.ts              # GET: 健康度报告
├── interests/                 # 兴趣（合并 custom）
│   └── route.ts              # GET/POST/DELETE: 兴趣管理
├── feedback/                  # 反馈
│   └── route.ts              # POST: 提交反馈
├── stage/                     # 阶段
│   └── route.ts              # GET: 分类阶段
└── reason/
    └── [bookmarkId]/
        └── route.ts          # GET: 分类原因
```

#### 验收清单

- [ ] 12 个新端点全部可访问
- [ ] 28 个旧端点返回 301 重定向
- [ ] 分类调试器页面功能正常
- [ ] 收件箱页面功能正常
- [ ] 分类确认流程正常
- [ ] 分类分析数据正确

---

### 4.3 Task 1.2: 提取 user-profile 模块

#### 目标

将用户档案相关代码从 classification 中分离

#### 后端工作

| #      | 任务                         | 工作内容                | 工期   |
| ------ | ---------------------------- | ----------------------- | ------ |
| B1.2.1 | 创建 user-profile 模块目录   | `src/lib/user-profile/` | 0.5 天 |
| B1.2.2 | 迁移 interest-profile 代码   | 类型、服务、仓库        | 1 天   |
| B1.2.3 | 迁移 source-profile 代码     | 类型、服务、仓库        | 1 天   |
| B1.2.4 | 更新 classification 模块导入 | 使用新模块              | 0.5 天 |
| B1.2.5 | 添加模块导出                 | index.ts                | 0.5 天 |

#### 新模块结构

```
src/lib/user-profile/
├── interest/
│   ├── interest-profile.service.ts
│   ├── interest-profile.repository.ts
│   ├── interest-analyzer.ts
│   └── types.ts
├── source/
│   ├── source-profile.service.ts
│   ├── source-profile.repository.ts
│   └── types.ts
├── types.ts                   # 共享类型
├── errors.ts                  # 错误定义
└── index.ts                   # 模块导出
```

#### 验收清单

- [ ] `src/lib/user-profile/` 模块创建完成
- [ ] interest-profile 功能正常
- [ ] source-profile 功能正常
- [ ] classification 模块无编译错误
- [ ] 相关页面功能正常

---

### 4.4 Task 1.3: 合并 folder 系列模块

#### 目标

将 folder/folder-operations/folder-organization 合并为统一模块

#### 后端工作

| #      | 任务                          | 工作内容           | 工期   |
| ------ | ----------------------------- | ------------------ | ------ |
| B1.3.1 | 分析三个模块的功能重叠        | 生成合并映射       | 0.5 天 |
| B1.3.2 | 创建新的 folder 模块结构      | 目录结构           | 0.5 天 |
| B1.3.3 | 迁移 folder 核心代码          | CRUD 操作          | 1 天   |
| B1.3.4 | 迁移 folder-operations 代码   | 合并/拆分/排序     | 1 天   |
| B1.3.5 | 迁移 folder-organization 代码 | 自动整理算法       | 1 天   |
| B1.3.6 | 删除旧模块，更新导入          | 清理代码           | 0.5 天 |
| B1.3.7 | 移动 folder-evolution UI 组件 | 到 components 目录 | 0.5 天 |

#### 新模块结构

```
src/lib/folder/
├── core/                      # 核心 CRUD
│   ├── folder.service.ts
│   ├── folder.repository.ts
│   ├── folder.types.ts
│   └── folder.errors.ts
├── operations/                # 操作（原 folder-operations）
│   ├── merge.service.ts
│   ├── split.service.ts
│   ├── reorder.service.ts
│   └── lock.service.ts
├── organization/              # 整理（原 folder-organization）
│   ├── organization.service.ts
│   ├── strategies/
│   │   ├── smart-sort.strategy.ts
│   │   └── auto-classify.strategy.ts
│   └── analyzers/
│       └── folder-health.analyzer.ts
├── evolution/                 # 演化分析（非 UI）
│   ├── evolution.service.ts
│   ├── report.generator.ts
│   └── types.ts
└── index.ts

src/components/folder-evolution/  # UI 组件（移动位置）
├── merge-suggestion-card.tsx
├── split-suggestion-card.tsx
├── rename-confirm-dialog.tsx
└── ...
```

#### 验收清单

- [ ] 新 folder 模块编译通过
- [ ] 文件夹 CRUD 功能正常
- [ ] 文件夹合并/拆分功能正常
- [ ] 文件夹自动排序功能正常
- [ ] 文件夹健康度分析正常
- [ ] 文件夹演化报告正常
- [ ] 旧模块完全删除

---

### 4.5 Task 1.4: 日志迁移（298 处 console → clientLogger）

#### 目标

将所有 console.log/error/warn 替换为 clientLogger

#### 工作分解

| #      | 任务                     | 文件范围                     | 工期   |
| ------ | ------------------------ | ---------------------------- | ------ |
| F1.4.1 | 创建迁移脚本             | `scripts/migrate-console.ts` | 0.5 天 |
| F1.4.2 | 迁移 hooks 目录          | ~30 处                       | 0.5 天 |
| F1.4.3 | 迁移 lib 目录            | ~100 处                      | 1 天   |
| F1.4.4 | 迁移 components 目录     | ~80 处                       | 1 天   |
| F1.4.5 | 迁移 app 目录            | ~88 处                       | 1 天   |
| F1.4.6 | 更新 ESLint 规则为 error | 阻断构建                     | 0.5 天 |

#### 迁移脚本

```typescript
// scripts/migrate-console.ts
import { readFile, writeFile } from "fs/promises";
import { glob } from "glob";

async function migrateConsole() {
  const files = await glob("src/**/*.{ts,tsx}", {
    ignore: ["src/lib/client-logger.ts", "scripts/**"],
  });

  for (const file of files) {
    let content = await readFile(file, "utf-8");
    let modified = false;

    // 检查是否有 console 使用
    if (/console\.(log|info|warn|error|debug)/.test(content)) {
      // 添加 clientLogger 导入（如果没有）
      if (!content.includes("from '@/lib/client-logger'")) {
        content = `import { clientLogger } from '@/lib/client-logger';\n${content}`;
      }

      // 替换 console.log → clientLogger.info
      content = content.replace(
        /console\.log\((.*?)\)/g,
        "clientLogger.info($1)",
      );

      // 替换 console.info → clientLogger.info
      content = content.replace(
        /console\.info\((.*?)\)/g,
        "clientLogger.info($1)",
      );

      // 替换 console.warn → clientLogger.warn
      content = content.replace(
        /console\.warn\((.*?)\)/g,
        "clientLogger.warn($1)",
      );

      // 替换 console.error → clientLogger.error
      content = content.replace(
        /console\.error\((.*?)\)/g,
        "clientLogger.error($1)",
      );

      // 替换 console.debug → clientLogger.debug
      content = content.replace(
        /console\.debug\((.*?)\)/g,
        "clientLogger.debug($1)",
      );

      modified = true;
    }

    if (modified) {
      await writeFile(file, content);
      console.log(`Migrated: ${file}`);
    }
  }
}

migrateConsole();
```

#### 验收清单

- [ ] `grep -r "console\.(log|error|warn)" src/` 返回 0 结果
- [ ] 所有日志使用 clientLogger
- [ ] ESLint no-console 规则为 error 级别
- [ ] `npm run lint` 无 console 相关错误
- [ ] 开发环境日志正常输出
- [ ] 生产环境错误日志上报到 Sentry

---

### 4.6 Task 1.5: 实现后端 ConfirmationAdapter

#### 目标

在后端创建确认适配层，统一 Tool 和 Skill 确认的处理

#### 后端工作

| #      | 任务                                  | 工作内容                                            | 工期   |
| ------ | ------------------------------------- | --------------------------------------------------- | ------ |
| B1.5.1 | 创建 Effect 类型定义                  | `src/lib/ai-skills/effects/types.ts`                | 0.5 天 |
| B1.5.2 | 创建 ConfirmationAdapter              | `src/lib/ai-skills/effects/confirmation-adapter.ts` | 1 天   |
| B1.5.3 | 修改 KnowledgeAgent 使用适配器        | 集成                                                | 1 天   |
| B1.5.4 | 修改 OrchestrationEngine 使用适配器   | 集成                                                | 0.5 天 |
| B1.5.5 | 标记 /api/agent/confirm 为 deprecated | 添加警告头                                          | 0.5 天 |

#### 代码实现

```typescript
// src/lib/ai-skills/effects/types.ts
export interface EffectContext {
  requestId: string;
  userId: string;
  conversationId?: string;
  mode: "atomic" | "orchestration";
  source: "tool" | "skill";
}

export interface Effect<T = unknown> {
  type: "confirmation" | "notification" | "audit";
  payload: T;
  context: EffectContext;
}

export interface ConfirmationPayload {
  id: string;
  title: string;
  message: string;
  options: ConfirmOption[];
  preview?: unknown;
  timeout: number;
  metadata?: Record<string, unknown>;
}

export interface ConfirmOption {
  id: string;
  label: string;
  variant: "default" | "destructive" | "outline";
  isDefault?: boolean;
}

export type ConfirmationEffect = Effect<ConfirmationPayload> & {
  type: "confirmation";
  onConfirm?: () => Promise<void>;
  onCancel?: () => Promise<void>;
};
```

```typescript
// src/lib/ai-skills/effects/confirmation-adapter.ts
import { ConfirmationEffect, EffectContext, ConfirmOption } from "./types";
import { UnifiedStreamChunk } from "../output/types";

interface ToolConfirmationConfig {
  title: string;
  message: string;
  options?: ConfirmOption[];
  preview?: unknown;
  timeout?: number;
}

export class ConfirmationAdapter {
  private context: EffectContext;

  constructor(context: EffectContext) {
    this.context = context;
  }

  /**
   * 将 Tool 确认包装为统一的 ConfirmationEffect
   */
  wrapToolConfirmation(
    toolName: string,
    params: unknown,
    config: ToolConfirmationConfig,
  ): ConfirmationEffect {
    return {
      type: "confirmation",
      payload: {
        id: this.generateId(),
        title: config.title,
        message: config.message,
        options: config.options || this.getDefaultOptions(),
        preview: config.preview,
        timeout: config.timeout || 5 * 60 * 1000, // 5 分钟
        metadata: {
          toolName,
          params,
        },
      },
      context: {
        ...this.context,
        source: "tool",
      },
    };
  }

  /**
   * 将 Skill 确认包装为统一的 ConfirmationEffect
   */
  wrapSkillConfirmation(
    skillId: string,
    step: number,
    config: ToolConfirmationConfig,
  ): ConfirmationEffect {
    return {
      type: "confirmation",
      payload: {
        id: this.generateId(),
        title: config.title,
        message: config.message,
        options: config.options || this.getDefaultOptions(),
        preview: config.preview,
        timeout: config.timeout || 5 * 60 * 1000,
        metadata: {
          skillId,
          step,
        },
      },
      context: {
        ...this.context,
        source: "skill",
      },
    };
  }

  /**
   * 转换为统一的流式输出块
   */
  toStreamChunk(effect: ConfirmationEffect): UnifiedStreamChunk {
    return {
      type: "confirmation",
      data: {
        id: effect.payload.id,
        source: effect.context.source,
        mode: effect.context.mode,
        title: effect.payload.title,
        message: effect.payload.message,
        options: effect.payload.options,
        preview: effect.payload.preview,
        expiresAt: new Date(Date.now() + effect.payload.timeout).toISOString(),
        metadata: effect.payload.metadata,
      },
    };
  }

  private generateId(): string {
    return `confirm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private getDefaultOptions(): ConfirmOption[] {
    return [
      { id: "confirm", label: "确认", variant: "default", isDefault: true },
      { id: "cancel", label: "取消", variant: "outline" },
    ];
  }
}
```

#### 验收清单

- [ ] ConfirmationAdapter 创建完成
- [ ] KnowledgeAgent 使用新适配器
- [ ] OrchestrationEngine 使用新适配器
- [ ] Tool 确认流程正常（删除书签）
- [ ] Skill 确认流程正常（BatchOrganize）
- [ ] `/api/agent/confirm` 响应头包含 Deprecation 警告
- [ ] 前端确认 UI 无变化（兼容）

---

### 4.7 Phase 1 总验收

| 验收项      | 验收标准                           | 验收人     |
| ----------- | ---------------------------------- | ---------- |
| API 合并    | Classification API 从 28 减少到 12 | Backend    |
| 模块解耦    | user-profile 独立模块可用          | Backend    |
| folder 合并 | 三个模块合并为一个                 | Backend    |
| 日志迁移    | 0 处 console 使用                  | Frontend   |
| 确认适配器  | Tool/Skill 确认统一处理            | Full Stack |
| 功能验证    | 所有 24 个页面功能正常             | QA         |
| 性能测试    | 响应时间无明显增加                 | QA         |
| 回归测试    | 现有测试全部通过                   | CI         |

---

## 五、Phase 2: 中期重构（4-6 周）

### 5.1 概述

| 指标     | 值                                  |
| -------- | ----------------------------------- |
| **目标** | Effect Layer 完整实现、代码质量提升 |
| **工期** | 20-30 个工作日                      |
| **风险** | 中高                                |
| **回滚** | 分支回滚 + Feature Flag             |

### 5.2 Task 2.1: 实现完整 Effect Layer

#### 目标

构建完整的副作用统一层，支持确认、通知、审计

#### 后端工作（2 周）

| #      | 任务                      | 工作内容         | 工期 |
| ------ | ------------------------- | ---------------- | ---- |
| B2.1.1 | 创建 EffectManager 核心类 | 副作用管理器     | 2 天 |
| B2.1.2 | 创建 ConfirmationService  | 合并两套确认系统 | 2 天 |
| B2.1.3 | 创建 NotificationService  | 统一通知服务     | 1 天 |
| B2.1.4 | 创建 AuditLogService      | 审计日志服务     | 1 天 |
| B2.1.5 | 集成到 UnifiedEngine      | 替换现有确认逻辑 | 2 天 |
| B2.1.6 | 废弃 /api/agent/confirm   | 删除旧端点       | 1 天 |
| B2.1.7 | 编写迁移文档              | 文档             | 1 天 |

#### 前端工作（1 周）

| #      | 任务                            | 工作内容       | 工期 |
| ------ | ------------------------------- | -------------- | ---- |
| F2.1.1 | 更新确认 Hook 使用 Effect Layer | 适配新接口     | 1 天 |
| F2.1.2 | 创建 NotificationContext        | 统一通知状态   | 1 天 |
| F2.1.3 | 更新 AIChatPanel                | 移除旧确认逻辑 | 1 天 |
| F2.1.4 | 测试所有确认场景                | 回归测试       | 2 天 |

#### Effect Layer 完整结构

```
src/lib/ai-skills/effects/
├── types.ts                     # 类型定义
├── effect-manager.ts            # 核心管理器
├── services/
│   ├── confirmation.service.ts  # 确认服务
│   ├── notification.service.ts  # 通知服务
│   └── audit-log.service.ts     # 审计服务
├── handlers/
│   ├── confirmation.handler.ts  # 确认处理器
│   └── notification.handler.ts  # 通知处理器
└── index.ts                     # 模块导出
```

### 5.3 Task 2.2: 重构 Provider 嵌套

#### 目标

将 8 层 Provider 嵌套优化为分组模式

#### 前端工作（1 周）

| #      | 任务                           | 工作内容                                 | 工期   |
| ------ | ------------------------------ | ---------------------------------------- | ------ |
| F2.2.1 | 创建 Provider Composition 工具 | `src/lib/utils/compose-providers.ts`     | 0.5 天 |
| F2.2.2 | 分组 Core Providers            | Theme/Sidebar/User/Session               | 1 天   |
| F2.2.3 | 分组 Feature Providers         | Onboarding/HomePage/Navigation/KeepAlive | 1 天   |
| F2.2.4 | 更新 RootProviders             | 使用新结构                               | 0.5 天 |
| F2.2.5 | 性能测试                       | 验证无性能回退                           | 1 天   |

#### 代码实现

```typescript
// src/lib/utils/compose-providers.tsx
import React, { ReactNode, ComponentType } from 'react';

type ProviderComponent = ComponentType<{ children: ReactNode }>;

export function composeProviders(
  ...providers: ProviderComponent[]
): ProviderComponent {
  return providers.reduce(
    (Composed, Provider) =>
      function ComposedProvider({ children }: { children: ReactNode }) {
        return (
          <Composed>
            <Provider>{children}</Provider>
          </Composed>
        );
      },
    ({ children }: { children: ReactNode }) => <>{children}</>
  );
}
```

```typescript
// src/components/providers/root-providers.tsx (重构后)
import { composeProviders } from '@/lib/utils/compose-providers';

// 核心 Providers（必须按顺序）
const CoreProviders = composeProviders(
  ThemeProvider,
  SidebarProvider,
  UserProvider,
  SessionHeartbeatProvider
);

// 功能 Providers（可独立）
const FeatureProviders = composeProviders(
  OnboardingProvider,
  HomePageProvider,
  NavigationProvider,
  KeepAliveProvider,
  MessageNotificationProvider
);

export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <CoreProviders>
      <FeatureProviders>{children}</FeatureProviders>
    </CoreProviders>
  );
}
```

### 5.4 Task 2.3: 拆分长组件

#### 目标

将 3 个超长组件拆分为更小的模块

#### 前端工作（1.5 周）

| #      | 任务                                    | 工作内容     | 工期   |
| ------ | --------------------------------------- | ------------ | ------ |
| F2.3.1 | 分析 home-page-client.tsx (852 行)      | 确定拆分方案 | 0.5 天 |
| F2.3.2 | 拆分 HomeToolbar                        | 工具栏组件   | 0.5 天 |
| F2.3.3 | 拆分 HomeBookmarkList                   | 书签列表     | 0.5 天 |
| F2.3.4 | 拆分 HomeDialogs                        | 对话框集合   | 0.5 天 |
| F2.3.5 | 拆分 HomeEmptyState                     | 空状态       | 0.5 天 |
| F2.3.6 | 分析并拆分 classification-settings-card | 设置卡片     | 1 天   |
| F2.3.7 | 分析并拆分 bookmark-detail-client       | 书签详情     | 1 天   |
| F2.3.8 | 更新导入路径                            | 各相关文件   | 0.5 天 |

#### 拆分后结构

```
src/components/home/
├── home-page-client.tsx        # 容器（<200 行）
├── home-toolbar.tsx            # 工具栏
├── home-bookmark-list.tsx      # 书签列表
├── home-bookmark-grid.tsx      # 书签网格
├── home-dialogs.tsx            # 对话框集合
├── home-empty-state.tsx        # 空状态
├── home-loading.tsx            # 加载状态
├── home-error.tsx              # 错误状态
└── hooks/
    ├── use-home-view-mode.ts
    ├── use-home-mutations.ts
    ├── use-home-batch.ts
    ├── use-home-filters.ts
    └── use-home-dialogs.ts
```

### 5.5 Task 2.4: 添加 API 版本控制

#### 目标

为所有 API 添加 /v1/ 版本前缀

#### 后端工作（1 周）

| #      | 任务                     | 工作内容                      | 工期   |
| ------ | ------------------------ | ----------------------------- | ------ |
| B2.4.1 | 创建 `/api/v1/` 目录结构 | 新目录                        | 0.5 天 |
| B2.4.2 | 移动核心 API 到 v1       | bookmarks, folders, search 等 | 2 天   |
| B2.4.3 | 添加旧路径重定向         | 所有旧路径                    | 1 天   |
| B2.4.4 | 更新 API 文档            | 版本说明                      | 0.5 天 |

#### 前端工作（0.5 周）

| #      | 任务              | 工作内容     | 工期   |
| ------ | ----------------- | ------------ | ------ |
| F2.4.1 | 更新 api-paths.ts | 添加 v1 前缀 | 0.5 天 |
| F2.4.2 | 全局替换 API 路径 | 使用新常量   | 1 天   |
| F2.4.3 | 测试所有功能      | 回归测试     | 1 天   |

### 5.6 Phase 2 总验收

| 验收项        | 验收标准                 | 验收人   |
| ------------- | ------------------------ | -------- |
| Effect Layer  | 确认、通知、审计服务可用 | Backend  |
| Provider 优化 | 嵌套层级从 8 减少到 2    | Frontend |
| 组件拆分      | 3 个长组件拆分完成       | Frontend |
| API 版本控制  | 所有 API 使用 /v1/ 前缀  | Backend  |
| 功能验证      | 所有 24 个页面功能正常   | QA       |
| 性能测试      | 首屏加载时间无明显增加   | QA       |
| 回归测试      | 现有测试全部通过         | CI       |

---

## 六、Phase 3: 长期完善（持续）

### 6.1 Task 3.1: 完善 Classification 解耦

- 清理 v3 迁移残留代码
- 提取 classification-learning 模块
- 提取 classification-admin 模块

### 6.2 Task 3.2: 生成 OpenAPI 文档

- 为所有 API 添加 OpenAPI 注释
- 生成 Swagger UI 文档页面
- 添加 API 变更日志

### 6.3 Task 3.3: 统一目录命名

- 制定命名规范（单数/复数）
- 逐步重命名不一致的目录
- 更新所有导入路径

### 6.4 Task 3.4: 添加数据库审计日志

- 启用 pgaudit 扩展
- 配置审计策略
- 创建审计日志查询接口

---

## 七、回滚方案

### 7.1 Phase 0 回滚

```bash
# 代码回滚
git revert HEAD~n  # n = 提交数

# 无数据库变更，无需回滚数据库
```

### 7.2 Phase 1 回滚

```bash
# 代码回滚
git checkout phase-0-complete
git branch -D phase-1
git checkout -b phase-1

# 如果有数据库变更
npm run supabase:db:reset
npm run supabase:db:push
```

### 7.3 Phase 2 回滚

```bash
# 使用 Feature Flag 禁用新功能
# 在 .env.local 中设置
NEXT_PUBLIC_ENABLE_EFFECT_LAYER=false

# 代码回滚（如果 Feature Flag 不足）
git checkout phase-1-complete
```

### 7.4 紧急回滚流程

1. **发现问题** → 记录问题详情
2. **评估影响** → 判断是否需要回滚
3. **通知团队** → 发布回滚公告
4. **执行回滚** → 按上述方案执行
5. **验证恢复** → 确认功能正常
6. **事后分析** → 记录经验教训

---

## 八、验收标准

### 8.1 功能验收矩阵

| 功能模块     | Phase 0 | Phase 1 | Phase 2 | 验收方式 |
| ------------ | ------- | ------- | ------- | -------- |
| 首页书签列表 | ✅      | ✅      | ✅      | 手动测试 |
| 书签 CRUD    | ✅      | ✅      | ✅      | API 测试 |
| 文件夹管理   | ✅      | ✅      | ✅      | 手动测试 |
| 语义搜索     | ✅      | ✅      | ✅      | API 测试 |
| AI Skills    | ✅      | ✅      | ✅      | 集成测试 |
| 智能分类     | ✅      | ✅      | ✅      | 手动测试 |
| 批量操作     | ✅      | ✅      | ✅      | 手动测试 |
| 数据导出     | ✅      | ✅      | ✅      | 手动测试 |
| 确认流程     | ✅      | ✅      | ✅      | 手动测试 |
| 消息通知     | ✅      | ✅      | ✅      | 手动测试 |

### 8.2 性能验收标准

| 指标             | 基准值 | 验收标准 |
| ---------------- | ------ | -------- |
| 首屏加载时间     | 2.5s   | < 3s     |
| API 平均响应时间 | 200ms  | < 300ms  |
| 内存占用（首页） | 80MB   | < 100MB  |
| Lighthouse 分数  | 85     | > 80     |

### 8.3 代码质量标准

| 指标                | 验收标准     |
| ------------------- | ------------ |
| TypeScript 严格模式 | 启用，无 any |
| ESLint 错误         | 0            |
| 测试覆盖率          | > 70%        |
| 无未使用代码        | 0 警告       |

---

## 九、风险控制

### 9.1 风险矩阵

| 风险                        | 可能性 | 影响 | 缓解措施                   |
| --------------------------- | ------ | ---- | -------------------------- |
| API 重组导致前端大量修改    | 高     | 中   | 使用 API 常量文件统一管理  |
| Classification 解耦引入 bug | 中     | 高   | 完整的集成测试覆盖         |
| 重构影响发布进度            | 中     | 中   | 分阶段实施，每阶段独立发布 |
| 团队学习新模式成本          | 低     | 低   | 编写迁移指南和示例代码     |
| 回滚失败                    | 低     | 高   | 每阶段测试回滚流程         |

### 9.2 监控指标

| 指标         | 监控方式 | 告警阈值 |
| ------------ | -------- | -------- |
| API 错误率   | Sentry   | > 1%     |
| 响应时间 P95 | Metrics  | > 500ms  |
| 页面错误率   | Sentry   | > 0.5%   |
| 构建失败     | CI       | 任何失败 |

### 9.3 沟通计划

| 时间点       | 沟通内容           | 沟通对象 |
| ------------ | ------------------ | -------- |
| Phase 开始前 | 计划说明、风险提示 | 全团队   |
| 每日         | 进度同步           | 开发团队 |
| Phase 完成后 | 验收报告、问题汇总 | 全团队   |
| 发现重大问题 | 紧急通知、回滚决策 | 全团队   |

---

## 十、附录

### A. API 路径完整映射表

（详见 `src/lib/constants/api-paths.ts`）

### B. 组件拆分详细设计

（详见各 Task 描述）

### C. 数据库迁移脚本

（如需要，在执行时创建）

### D. 测试用例清单

（基于验收矩阵创建）

---

**文档维护**:

| 版本  | 日期       | 修改内容 | 作者    |
| ----- | ---------- | -------- | ------- |
| 1.0.0 | 2024-12-24 | 初始版本 | Winston |

---

> _"A complex system that works is invariably found to have evolved from a simple system that worked."_ — John Gall
