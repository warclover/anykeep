# Epic & Stories: 知识分发中心

> **关联 PRD**: [prd-knowledge-distribution-unified.md](./prd-knowledge-distribution-unified.md)
> **版本**: 1.0.0
> **创建日期**: 2026-01-01

---

## Epic 概览

| Epic | 名称                    | 周期   | Story 数 | 优先级 |
| ---- | ----------------------- | ------ | -------- | ------ |
| E1   | 基础架构 + 手动导出迁移 | Week 1 | 5        | P0     |
| E2   | Obsidian 本地同步       | Week 2 | 4        | P0     |
| E3   | Notion 同步             | Week 3 | 5        | P0     |
| E4   | Webhook + RSS           | Week 4 | 4        | P1     |

---

## Epic 1: 基础架构 + 手动导出迁移

### 目标

建立知识分发中心的核心架构，将现有导出功能迁移到新架构中。

### 前置条件

- 现有 `src/lib/export/` 模块稳定运行
- 数据库迁移权限

---

### Story 1.1: 创建分发模块基础结构

**作为** 开发者
**我想要** 创建 `src/lib/distribution/` 模块的目录结构和接口定义
**以便于** 后续开发有统一的架构基础

#### 验收标准

```gherkin
Given 项目代码库
When 执行 Story 1.1
Then 创建以下目录结构:
  | 路径 |
  | src/lib/distribution/index.ts |
  | src/lib/distribution/types.ts |
  | src/lib/distribution/interfaces/adapter.interface.ts |
  | src/lib/distribution/interfaces/event-bus.interface.ts |
  | src/lib/distribution/interfaces/scheduler.interface.ts |
  | src/lib/distribution/core/ |
  | src/lib/distribution/adapters/ |
And 所有接口定义通过 TypeScript 编译
And 导出公共 API 可被其他模块 import
```

#### 任务拆分

| Task  | 描述                               | 预估 |
| ----- | ---------------------------------- | ---- |
| 1.1.1 | 创建目录结构和 index.ts            | 0.5h |
| 1.1.2 | 定义 `IDistributionAdapter` 接口   | 1h   |
| 1.1.3 | 定义 `IDistributionEventBus` 接口  | 0.5h |
| 1.1.4 | 定义 `IDistributionScheduler` 接口 | 0.5h |
| 1.1.5 | 定义 `types.ts` 共享类型           | 1h   |
| 1.1.6 | 编写接口单元测试                   | 1h   |

#### 技术细节

```typescript
// src/lib/distribution/types.ts

export type DistributionTargetType =
  | "obsidian"
  | "notion"
  | "webhook"
  | "rss"
  | "manual_export";

export type TriggerMode = "realtime" | "scheduled" | "manual";

export type DistributionStatus = "idle" | "syncing" | "error";

export interface DistributionTarget {
  id: string;
  userId: string;
  targetType: DistributionTargetType;
  name: string;
  enabled: boolean;
  trigger: {
    mode: TriggerMode;
    scheduleIntervalMinutes?: number;
  };
  filters?: DistributionFilters;
  targetConfig: Record<string, unknown>;
  status: DistributionStatus;
  lastSyncAt?: Date;
  lastError?: string;
  syncedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DistributionFilters {
  platforms?: string[];
  folders?: string[];
  tags?: string[];
  includeAiSummary?: boolean;
}

export interface DistributionRecord {
  id: string;
  targetId: string;
  bookmarkId: string;
  status: "pending" | "success" | "failed";
  distributedAt?: Date;
  externalId?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
}
```

---

### Story 1.2: 实现分发服务核心

**作为** 开发者
**我想要** 实现 `DistributionService` 核心编排逻辑
**以便于** 统一管理所有分发目标的执行

#### 验收标准

```gherkin
Given 已定义的接口
When 调用 DistributionService.distribute(targetId, bookmarkIds)
Then 服务从 Registry 获取对应 Adapter
And 调用 adapter.distribute() 执行分发
And 记录 DistributionRecord 到数据库
And 更新 DistributionTarget 的 lastSyncAt 和 syncedCount
And 如果失败，更新 lastError 和 status='error'
```

```gherkin
Given DistributionService
When Adapter 不存在
Then 抛出 AdapterNotFoundError
And 不创建任何 DistributionRecord
```

```gherkin
Given DistributionService
When 部分书签分发失败
Then 成功的书签标记为 success
And 失败的书签标记为 failed 并记录 errorMessage
And 返回 DistributionResult 包含成功/失败统计
```

#### 任务拆分

| Task  | 描述                                      | 预估 |
| ----- | ----------------------------------------- | ---- |
| 1.2.1 | 实现 `DistributionRegistry` 适配器注册表  | 1h   |
| 1.2.2 | 实现 `DistributionService.distribute()`   | 2h   |
| 1.2.3 | 实现 `DistributionService.getTargets()`   | 0.5h |
| 1.2.4 | 实现 `DistributionService.createTarget()` | 1h   |
| 1.2.5 | 实现 `DistributionService.updateTarget()` | 0.5h |
| 1.2.6 | 实现 `DistributionService.deleteTarget()` | 0.5h |
| 1.2.7 | 实现错误处理和重试逻辑                    | 1h   |
| 1.2.8 | 编写单元测试（mock adapter）              | 2h   |

#### 技术细节

```typescript
// src/lib/distribution/core/distribution.service.ts

import { IDistributionAdapter } from "../interfaces/adapter.interface";
import { DistributionRegistry } from "./distribution.registry";
import { createClient } from "@/lib/supabase/server";

export class DistributionService {
  constructor(
    private readonly registry: DistributionRegistry,
    private readonly supabase = createClient(),
  ) {}

  async distribute(
    targetId: string,
    bookmarkIds: string[],
  ): Promise<DistributionResult> {
    // 1. 获取 target 配置
    const target = await this.getTarget(targetId);
    if (!target) {
      throw new TargetNotFoundError(targetId);
    }

    // 2. 获取 adapter
    const adapter = this.registry.get(target.targetType);
    if (!adapter) {
      throw new AdapterNotFoundError(target.targetType);
    }

    // 3. 获取书签数据
    const bookmarks = await this.getBookmarks(bookmarkIds, target.filters);

    // 4. 更新状态为 syncing
    await this.updateTargetStatus(targetId, "syncing");

    try {
      // 5. 执行分发
      const result = await adapter.distribute(bookmarks, target);

      // 6. 记录结果
      await this.saveRecords(targetId, result.records);

      // 7. 更新状态
      await this.updateTargetStatus(targetId, "idle", {
        lastSyncAt: new Date(),
        syncedCount: target.syncedCount + result.distributedCount,
      });

      return result;
    } catch (error) {
      // 8. 错误处理
      await this.updateTargetStatus(targetId, "error", {
        lastError: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}
```

#### 边界情况

| 场景                          | 处理方式                       |
| ----------------------------- | ------------------------------ |
| bookmarkIds 为空数组          | 直接返回空结果，不调用 adapter |
| target 被禁用 (enabled=false) | 抛出 TargetDisabledError       |
| adapter.distribute() 超时     | 30s 超时，记录错误，允许重试   |
| 数据库连接失败                | 抛出 DatabaseError，不更新状态 |

---

### Story 1.3: 实现事件总线

**作为** 开发者
**我想要** 实现 `DistributionEventBus` 事件总线
**以便于** 解耦事件发布和订阅

#### 验收标准

```gherkin
Given EventBus 已初始化
When 发布 bookmark_created 事件
Then 所有订阅该事件的 handler 被调用
And handler 按订阅顺序执行
And 单个 handler 失败不影响其他 handler
```

```gherkin
Given EventBus 有订阅者
When 调用 unsubscribe 函数
Then 该订阅者不再接收事件
```

#### 任务拆分

| Task  | 描述                                        | 预估 |
| ----- | ------------------------------------------- | ---- |
| 1.3.1 | 实现内存版 EventBus                         | 1h   |
| 1.3.2 | 实现 publish() 方法                         | 0.5h |
| 1.3.3 | 实现 subscribe() 方法                       | 0.5h |
| 1.3.4 | 实现错误隔离（单个 handler 失败不影响其他） | 0.5h |
| 1.3.5 | 编写单元测试                                | 1h   |

#### 技术细节

```typescript
// src/lib/distribution/core/distribution.event-bus.ts

import { IDistributionEventBus, DistributionEvent } from "../interfaces";
import { logger } from "@/lib/logger";

type EventHandler = (event: DistributionEvent) => Promise<void>;

export class DistributionEventBus implements IDistributionEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  subscribe(
    eventType: DistributionEvent["type"],
    handler: EventHandler,
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // 返回取消订阅函数
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  async publish(event: DistributionEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    // 并行执行所有 handler，错误隔离
    const results = await Promise.allSettled(
      Array.from(handlers).map((handler) => handler(event)),
    );

    // 记录失败的 handler
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        logger.error("EventBus handler failed", {
          eventType: event.type,
          error: result.reason,
        });
      }
    });
  }
}
```

---

### Story 1.4: 数据库迁移

**作为** 开发者
**我想要** 创建分发相关的数据库表
**以便于** 存储分发目标配置和记录

#### 验收标准

```gherkin
Given 数据库迁移文件
When 执行 supabase db push
Then 创建 distribution_targets 表
And 创建 distribution_records 表
And 创建必要的索引
And 配置 RLS 策略（用户只能访问自己的数据）
```

#### 任务拆分

| Task  | 描述                         | 预估  |
| ----- | ---------------------------- | ----- |
| 1.4.1 | 创建迁移文件                 | 0.5h  |
| 1.4.2 | 定义 distribution_targets 表 | 0.5h  |
| 1.4.3 | 定义 distribution_records 表 | 0.5h  |
| 1.4.4 | 配置 RLS 策略                | 0.5h  |
| 1.4.5 | 创建索引                     | 0.25h |
| 1.4.6 | 本地测试迁移                 | 0.25h |
| 1.4.7 | 生成 TypeScript 类型         | 0.25h |

#### 技术细节

```sql
-- supabase/migrations/20260101000001_create_distribution_tables.sql

-- 分发目标配置表
CREATE TABLE distribution_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  target_type TEXT NOT NULL CHECK (target_type IN ('obsidian', 'notion', 'webhook', 'rss', 'manual_export')),
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,

  -- 触发配置
  trigger_mode TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_mode IN ('realtime', 'scheduled', 'manual')),
  schedule_interval_minutes INTEGER CHECK (schedule_interval_minutes > 0),

  -- 筛选条件
  filter_platforms TEXT[],
  filter_folders UUID[],
  filter_tags TEXT[],
  include_ai_summary BOOLEAN DEFAULT true,

  -- 目标特定配置 (JSONB)
  target_config JSONB NOT NULL DEFAULT '{}',

  -- 状态
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'syncing', 'error')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  synced_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- 约束：每个用户每种类型最多 5 个目标（防滥用）
  CONSTRAINT max_targets_per_type CHECK (true) -- 通过 trigger 实现
);

-- 分发记录表
CREATE TABLE distribution_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES distribution_targets(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  distributed_at TIMESTAMPTZ,
  external_id TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (target_id, bookmark_id)
);

-- RLS 策略
ALTER TABLE distribution_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own targets"
  ON distribution_targets
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own records"
  ON distribution_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM distribution_targets
      WHERE id = distribution_records.target_id
      AND user_id = auth.uid()
    )
  );

-- 索引
CREATE INDEX idx_distribution_targets_user ON distribution_targets(user_id);
CREATE INDEX idx_distribution_targets_type ON distribution_targets(target_type);
CREATE INDEX idx_distribution_targets_enabled ON distribution_targets(user_id, enabled) WHERE enabled = true;
CREATE INDEX idx_distribution_records_target ON distribution_records(target_id);
CREATE INDEX idx_distribution_records_status ON distribution_records(status) WHERE status = 'pending';
CREATE INDEX idx_distribution_records_bookmark ON distribution_records(bookmark_id);

-- 更新时间触发器
CREATE TRIGGER update_distribution_targets_updated_at
  BEFORE UPDATE ON distribution_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### Story 1.5: 实现 ManualExportAdapter

**作为** 开发者
**我想要** 将现有导出功能包装为 `ManualExportAdapter`
**以便于** 统一到分发中心架构中

#### 验收标准

```gherkin
Given ManualExportAdapter 已注册
When 调用 distribute() 方法
Then 内部调用现有 ExportService
And 返回导出文件的下载 URL 或 Blob
And 不修改现有 export 模块任何代码
```

```gherkin
Given ManualExportAdapter
When 导出格式为 obsidian
Then 调用 ObsidianFormatter 生成 Markdown
And 支持 ZIP 打包多文件
```

#### 任务拆分

| Task  | 描述                        | 预估  |
| ----- | --------------------------- | ----- |
| 1.5.1 | 创建 ManualExportAdapter 类 | 1h    |
| 1.5.2 | 实现 distribute() 包装逻辑  | 1h    |
| 1.5.3 | 实现 validateConfig()       | 0.5h  |
| 1.5.4 | 注册到 Registry             | 0.25h |
| 1.5.5 | 编写单元测试                | 1h    |
| 1.5.6 | 集成测试（端到端导出）      | 0.5h  |

#### 技术细节

```typescript
// src/lib/distribution/adapters/manual-export.adapter.ts

import { IDistributionAdapter, DistributionResult } from "../interfaces";
import { ExportService } from "@/lib/export/services/export.service";
import { DistributionTarget, Bookmark } from "../types";

export class ManualExportAdapter implements IDistributionAdapter {
  readonly type = "manual_export" as const;
  readonly displayName = "手动导出";
  readonly supportedPlatforms = ["web", "mobile", "desktop"] as const;

  constructor(private readonly exportService: ExportService) {}

  async initialize(): Promise<void> {
    // 无需初始化
  }

  async distribute(
    bookmarks: Bookmark[],
    config: DistributionTarget,
  ): Promise<DistributionResult> {
    const exportConfig = config.targetConfig as ManualExportConfig;

    // 调用现有导出服务
    const result = await this.exportService.export({
      bookmarks,
      format: exportConfig.format,
      fields: exportConfig.fields,
      options: exportConfig.options,
    });

    // 转换为统一格式
    return {
      success: true,
      distributedCount: bookmarks.length,
      failedCount: 0,
      records: bookmarks.map((b) => ({
        id: crypto.randomUUID(),
        targetId: config.id,
        bookmarkId: b.id,
        status: "success" as const,
        distributedAt: new Date(),
        createdAt: new Date(),
        retryCount: 0,
      })),
      // 特殊：返回下载 URL
      deliverable: {
        type: "download",
        url: result.downloadUrl,
        filename: result.filename,
        mimeType: result.mimeType,
      },
    };
  }

  async validateConfig(config: DistributionTarget): Promise<ValidationResult> {
    const exportConfig = config.targetConfig as ManualExportConfig;
    const errors: string[] = [];

    if (!exportConfig.format) {
      errors.push("导出格式不能为空");
    }

    const validFormats = ["csv", "json", "markdown", "obsidian", "html"];
    if (!validFormats.includes(exportConfig.format)) {
      errors.push(`不支持的导出格式: ${exportConfig.format}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async testConnection(): Promise<TestConnectionResult> {
    // 手动导出无需测试连接
    return { success: true };
  }
}

interface ManualExportConfig {
  format: "csv" | "json" | "markdown" | "obsidian" | "html";
  fields?: string[];
  options?: {
    includeAiSummary?: boolean;
    zipMultipleFiles?: boolean;
  };
}
```

---

## Epic 2: Obsidian 本地同步

### 目标

实现 Obsidian 本地文件夹同步功能（仅桌面端）。

### 前置条件

- Epic 1 完成
- Electron 桌面客户端环境

---

### Story 2.1: 实现 ObsidianAdapter

**作为** Obsidian 用户
**我想要** 配置本地 Vault 路径后，AnyKeep 自动将收藏同步为 Markdown 文件
**以便于** 在 Obsidian 中进行深度整理

#### 验收标准

```gherkin
Given 用户已配置 Obsidian Vault 路径
And 路径存在且可写入
When 新增收藏触发同步
Then 在指定目录创建 Markdown 文件
And 文件名格式: {{title}}-{{date}}.md
And 文件内容包含 YAML frontmatter
And 文件内容包含标题、URL、摘要、标签
```

```gherkin
Given 用户配置的路径不存在
When 尝试同步
Then 返回错误 "路径不存在或无写入权限"
And 不创建任何文件
And 更新 target 状态为 error
```

```gherkin
Given 同一书签已同步过
When 再次触发同步
Then 跳过该书签（幂等性）
And 返回 "已同步" 状态
```

#### 任务拆分

| Task  | 描述                                             | 预估 |
| ----- | ------------------------------------------------ | ---- |
| 2.1.1 | 创建 ObsidianAdapter 类                          | 0.5h |
| 2.1.2 | 实现路径验证逻辑                                 | 1h   |
| 2.1.3 | 实现 Markdown 文件生成（复用 ObsidianFormatter） | 1h   |
| 2.1.4 | 实现文件写入（Node.js fs）                       | 1h   |
| 2.1.5 | 实现幂等性检查（基于 bookmarkId 记录）           | 1h   |
| 2.1.6 | 实现文件名冲突处理                               | 0.5h |
| 2.1.7 | 编写单元测试（mock fs）                          | 1.5h |
| 2.1.8 | 编写集成测试（真实文件系统）                     | 1h   |

#### 技术细节

```typescript
// src/lib/distribution/adapters/obsidian.adapter.ts

import { IDistributionAdapter } from "../interfaces";
import { ObsidianFormatter } from "@/lib/export/formatters/obsidian.formatter";
import * as fs from "fs/promises";
import * as path from "path";

export class ObsidianAdapter implements IDistributionAdapter {
  readonly type = "obsidian" as const;
  readonly displayName = "Obsidian 本地同步";
  readonly supportedPlatforms = ["desktop"] as const; // 仅桌面端

  constructor(private readonly formatter: ObsidianFormatter) {}

  async distribute(
    bookmarks: Bookmark[],
    config: DistributionTarget,
  ): Promise<DistributionResult> {
    const obsConfig = config.targetConfig as ObsidianTargetConfig;
    const targetDir = path.join(obsConfig.vaultPath, obsConfig.folderName);

    // 确保目录存在
    await fs.mkdir(targetDir, { recursive: true });

    const records: DistributionRecord[] = [];

    for (const bookmark of bookmarks) {
      try {
        // 生成 Markdown 内容
        const content = this.formatter.format(bookmark, {
          template: obsConfig.template,
          useYamlFrontmatter: obsConfig.useYamlFrontmatter,
        });

        // 生成文件名
        const filename = this.generateFilename(
          bookmark,
          obsConfig.filenamePattern,
        );
        const filepath = path.join(targetDir, filename);

        // 检查是否已存在（幂等性）
        const exists = await this.fileExists(filepath);
        if (exists) {
          records.push({
            id: crypto.randomUUID(),
            targetId: config.id,
            bookmarkId: bookmark.id,
            status: "success",
            distributedAt: new Date(),
            externalId: filepath,
            createdAt: new Date(),
            retryCount: 0,
          });
          continue;
        }

        // 写入文件
        await fs.writeFile(filepath, content, "utf-8");

        records.push({
          id: crypto.randomUUID(),
          targetId: config.id,
          bookmarkId: bookmark.id,
          status: "success",
          distributedAt: new Date(),
          externalId: filepath,
          createdAt: new Date(),
          retryCount: 0,
        });
      } catch (error) {
        records.push({
          id: crypto.randomUUID(),
          targetId: config.id,
          bookmarkId: bookmark.id,
          status: "failed",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          createdAt: new Date(),
          retryCount: 0,
        });
      }
    }

    const successCount = records.filter((r) => r.status === "success").length;
    const failedCount = records.filter((r) => r.status === "failed").length;

    return {
      success: failedCount === 0,
      distributedCount: successCount,
      failedCount,
      records,
    };
  }

  async validateConfig(config: DistributionTarget): Promise<ValidationResult> {
    const obsConfig = config.targetConfig as ObsidianTargetConfig;
    const errors: string[] = [];

    // 检查路径
    if (!obsConfig.vaultPath) {
      errors.push("Vault 路径不能为空");
    } else {
      try {
        await fs.access(obsConfig.vaultPath, fs.constants.W_OK);
      } catch {
        errors.push("Vault 路径不存在或无写入权限");
      }
    }

    // 检查文件夹名
    if (!obsConfig.folderName) {
      errors.push("保存目录不能为空");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async testConnection(
    config: DistributionTarget,
  ): Promise<TestConnectionResult> {
    const validation = await this.validateConfig(config);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join("; "),
      };
    }

    // 尝试创建测试文件
    const obsConfig = config.targetConfig as ObsidianTargetConfig;
    const testFile = path.join(
      obsConfig.vaultPath,
      obsConfig.folderName,
      ".anykeep-test",
    );

    try {
      await fs.mkdir(path.dirname(testFile), { recursive: true });
      await fs.writeFile(testFile, "AnyKeep connection test");
      await fs.unlink(testFile);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `无法写入测试文件: ${error instanceof Error ? error.message : "Unknown"}`,
      };
    }
  }

  private generateFilename(bookmark: Bookmark, pattern: string): string {
    const date = new Date().toISOString().split("T")[0];
    const safeTitle = bookmark.title
      .replace(/[<>:"/\\|?*]/g, "-") // 移除非法字符
      .substring(0, 100); // 限制长度

    return (
      pattern
        .replace("{{title}}", safeTitle)
        .replace("{{date}}", date)
        .replace("{{id}}", bookmark.id.substring(0, 8)) + ".md"
    );
  }

  private async fileExists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }
}

interface ObsidianTargetConfig {
  vaultPath: string;
  folderName: string;
  filenamePattern: string;
  template: string;
  useYamlFrontmatter: boolean;
}
```

#### 边界情况

| 场景                       | 处理方式                       |
| -------------------------- | ------------------------------ |
| 文件名包含非法字符         | 替换为 `-`                     |
| 文件名过长                 | 截断为 100 字符                |
| 目录不存在                 | 自动创建（recursive）          |
| 磁盘空间不足               | 捕获异常，标记失败             |
| 文件被锁定（其他程序打开） | 捕获异常，标记失败，下次重试   |
| 非桌面端调用               | 抛出 PlatformNotSupportedError |

---

### Story 2.2: 实现 DistributionScheduler

**作为** 用户
**我想要** 配置定时同步后，系统自动按计划执行同步
**以便于** 无需手动触发

#### 验收标准

```gherkin
Given 用户配置了每 5 分钟同步一次
When 5 分钟过去
Then 系统自动触发同步
And 只同步自上次同步后的新增书签
```

```gherkin
Given 用户配置了实时同步 (realtime)
When 新增一条收藏
Then 立即触发同步（通过 EventBus）
And 同步延迟 < 10 秒
```

```gherkin
Given 同步正在进行中
When 再次触发同步
Then 跳过本次触发（防止重复执行）
And 记录日志 "同步已在进行中"
```

#### 任务拆分

| Task  | 描述                            | 预估 |
| ----- | ------------------------------- | ---- |
| 2.2.1 | 实现 DistributionScheduler 类   | 1h   |
| 2.2.2 | 实现定时任务管理（setInterval） | 1h   |
| 2.2.3 | 实现实时模式（EventBus 订阅）   | 1h   |
| 2.2.4 | 实现并发控制（防止重复执行）    | 1h   |
| 2.2.5 | 实现增量同步逻辑                | 1h   |
| 2.2.6 | 编写单元测试                    | 1.5h |

---

### Story 2.3: Obsidian 配置 UI

**作为** 用户
**我想要** 在分发中心配置 Obsidian 同步
**以便于** 设置 Vault 路径和同步规则

#### 验收标准

```gherkin
Given 用户在桌面端打开分发中心
When 点击"添加分发目标" → "Obsidian"
Then 显示配置表单:
  | 字段 | 类型 | 必填 |
  | Vault 路径 | 文件夹选择器 | 是 |
  | 保存目录 | 文本输入 | 是 |
  | 文件名模式 | 下拉选择 | 是 |
  | 同步方式 | 单选 | 是 |
  | 模板预览 | 只读文本 | - |
```

```gherkin
Given 用户在 Web 端打开分发中心
When 点击"Obsidian"选项
Then 显示提示 "Obsidian 同步仅支持桌面客户端"
And 提供下载桌面客户端链接
```

```gherkin
Given 配置表单已填写
When 点击"测试连接"
Then 调用 adapter.testConnection()
And 显示测试结果（成功/失败）
And 失败时显示具体错误信息
```

#### 任务拆分

| Task  | 描述                             | 预估 |
| ----- | -------------------------------- | ---- |
| 2.3.1 | 创建 ObsidianConfigForm 组件     | 2h   |
| 2.3.2 | 实现文件夹选择器（Electron API） | 1.5h |
| 2.3.3 | 实现模板预览                     | 1h   |
| 2.3.4 | 实现测试连接功能                 | 1h   |
| 2.3.5 | 实现 Web 端禁用提示              | 0.5h |
| 2.3.6 | 表单验证                         | 0.5h |
| 2.3.7 | 编写组件测试                     | 1h   |

---

### Story 2.4: 分发中心主页面

**作为** 用户
**我想要** 在分发中心查看所有已配置的分发目标
**以便于** 统一管理

#### 验收标准

```gherkin
Given 用户有 2 个已配置的分发目标
When 打开分发中心页面
Then 显示目标列表:
  | 目标 | 状态 | 最后同步 | 操作 |
  | Obsidian - 我的知识库 | ✅ 正常 | 5 分钟前 | 同步/编辑/删除 |
  | Notion - 阅读清单 | ⏳ 同步中 | - | 编辑/删除 |
```

```gherkin
Given 分发目标卡片
When 点击"立即同步"
Then 触发该目标的同步
And 显示同步进度
And 完成后更新"最后同步"时间
```

#### 任务拆分

| Task  | 描述                             | 预估  |
| ----- | -------------------------------- | ----- |
| 2.4.1 | 创建分发中心页面 `/distribution` | 1h    |
| 2.4.2 | 创建 DistributionTargetCard 组件 | 1.5h  |
| 2.4.3 | 创建 AddTargetDialog 组件        | 1.5h  |
| 2.4.4 | 实现目标列表加载                 | 0.5h  |
| 2.4.5 | 实现手动同步触发                 | 1h    |
| 2.4.6 | 实现删除确认                     | 0.5h  |
| 2.4.7 | 添加侧边栏入口                   | 0.25h |
| 2.4.8 | 编写组件测试                     | 1h    |

---

## Epic 3: Notion 同步

### 目标

实现 Notion OAuth 授权和 Database 同步功能。

### 前置条件

- Epic 1 完成
- Notion Integration 已创建（需要 Client ID 和 Secret）

---

### Story 3.1: Notion OAuth 流程

**作为** 用户
**我想要** 通过 OAuth 授权 AnyKeep 访问我的 Notion
**以便于** 自动同步收藏到 Notion Database

#### 验收标准

```gherkin
Given 用户点击"连接 Notion"
When 完成 OAuth 授权
Then 获取并存储 access_token
And 显示已连接的 Workspace 名称
And Token 加密存储到数据库
```

```gherkin
Given OAuth 授权失败
When 用户拒绝授权或超时
Then 显示错误信息
And 可以重新尝试授权
```

```gherkin
Given Token 已过期
When 尝试同步
Then 提示用户重新授权
And 清除旧 Token
```

#### 任务拆分

| Task  | 描述                                                    | 预估 |
| ----- | ------------------------------------------------------- | ---- |
| 3.1.1 | 创建 Notion Integration（Notion 开发者后台）            | 0.5h |
| 3.1.2 | 实现 OAuth 发起端点 `/api/distribution/notion/auth`     | 1h   |
| 3.1.3 | 实现 OAuth 回调端点 `/api/distribution/notion/callback` | 1.5h |
| 3.1.4 | 实现 Token 加密存储                                     | 1h   |
| 3.1.5 | 实现 Token 刷新/过期检测                                | 1h   |
| 3.1.6 | 创建 NotionConnectButton 组件                           | 1h   |
| 3.1.7 | 编写 OAuth 流程测试                                     | 1h   |

#### 技术细节

```typescript
// src/app/api/distribution/notion/auth/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID!;
const NOTION_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/distribution/notion/callback`;

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 生成 state 用于 CSRF 防护
  const state = crypto.randomUUID();

  // 存储 state 到 session（5 分钟有效）
  await supabase.from("oauth_states").insert({
    state,
    user_id: user.id,
    provider: "notion",
    expires_at: new Date(Date.now() + 5 * 60 * 1000),
  });

  const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
  authUrl.searchParams.set("client_id", NOTION_CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("owner", "user");
  authUrl.searchParams.set("redirect_uri", NOTION_REDIRECT_URI);
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
```

```typescript
// src/app/api/distribution/notion/callback/route.ts

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `/distribution?error=${encodeURIComponent("Notion 授权被拒绝")}`,
    );
  }

  // 验证 state
  const supabase = createClient();
  const { data: stateRecord } = await supabase
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .eq("provider", "notion")
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!stateRecord) {
    return NextResponse.redirect(
      `/distribution?error=${encodeURIComponent("授权已过期，请重试")}`,
    );
  }

  // 交换 Token
  const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(
        `${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`,
      ).toString("base64")}`,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: NOTION_REDIRECT_URI,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(
      `/distribution?error=${encodeURIComponent("获取 Token 失败")}`,
    );
  }

  const tokenData = await tokenResponse.json();

  // 加密存储 Token
  const encryptedToken = await encryptToken(tokenData.access_token);

  await supabase.from("distribution_oauth_tokens").upsert({
    user_id: stateRecord.user_id,
    provider: "notion",
    access_token: encryptedToken,
    workspace_id: tokenData.workspace_id,
    workspace_name: tokenData.workspace_name,
    expires_at: null, // Notion Token 不过期
  });

  // 清理 state
  await supabase.from("oauth_states").delete().eq("state", state);

  return NextResponse.redirect("/distribution?success=notion");
}
```

---

### Story 3.2: 实现 NotionAdapter

（结构与 ObsidianAdapter 类似，省略详细描述）

#### 任务拆分

| Task  | 描述                     | 预估 |
| ----- | ------------------------ | ---- |
| 3.2.1 | 创建 NotionAdapter 类    | 0.5h |
| 3.2.2 | 实现 Database 列表获取   | 1h   |
| 3.2.3 | 实现属性映射逻辑         | 1.5h |
| 3.2.4 | 实现页面创建             | 1.5h |
| 3.2.5 | 实现幂等性检查           | 1h   |
| 3.2.6 | 实现错误处理（API 限流） | 1h   |
| 3.2.7 | 编写单元测试             | 1.5h |

---

### Story 3.3: Notion 配置 UI

（结构与 Obsidian 配置 UI 类似，省略详细描述）

---

### Story 3.4: Notion Database 选择器

**作为** 用户
**我想要** 从我的 Notion Workspace 中选择目标 Database
**以便于** 指定同步位置

#### 验收标准

```gherkin
Given 已授权 Notion
When 打开 Database 选择器
Then 显示用户有权访问的所有 Database
And 显示 Database 名称和图标
And 支持搜索筛选
```

---

### Story 3.5: Notion 属性映射器

**作为** 用户
**我想要** 自定义 AnyKeep 字段与 Notion 属性的映射关系
**以便于** 适配我现有的 Database 结构

#### 验收标准

```gherkin
Given Database 已选择
When 配置属性映射
Then 显示 AnyKeep 可导出字段列表
And 显示 Notion Database 属性列表
And 支持拖拽或下拉选择映射
And 显示类型兼容性提示（如 tags → multi_select）
```

---

## Epic 4: Webhook + RSS

### 目标

实现 Webhook 推送和 RSS Feed 功能。

---

### Story 4.1: 实现 WebhookAdapter

#### 验收标准

```gherkin
Given 用户配置了 Webhook URL
When 触发同步
Then POST JSON 数据到用户 URL
And 包含签名 header (X-AnyKeep-Signature)
And 失败时重试最多 3 次（指数退避）
```

---

### Story 4.2: 实现 RssFeedAdapter

#### 验收标准

```gherkin
Given 用户启用 RSS Feed
When 访问 /api/distribution/rss/:feedToken
Then 返回 RSS 2.0 或 Atom 格式 XML
And 包含最近 50 条书签
And 支持 URL 参数筛选
```

---

### Story 4.3: Webhook 配置 UI

（省略详细描述）

---

### Story 4.4: RSS 配置 UI

**作为** 用户
**我想要** 获取我的专属 RSS Feed URL
**以便于** 在 RSS 阅读器中订阅

#### 验收标准

```gherkin
Given 用户启用 RSS
When 显示 RSS 配置
Then 显示唯一的 Feed URL
And 提供"复制链接"按钮
And 显示 URL 参数使用说明
And 可以重新生成 feedToken（安全考虑）
```

---

## 测试策略

### 单元测试

| 模块                | 覆盖目标              | 测试工具    |
| ------------------- | --------------------- | ----------- |
| DistributionService | 分发流程、错误处理    | Jest + Mock |
| Adapters            | 各 Adapter 的核心逻辑 | Jest + Mock |
| EventBus            | 事件发布订阅          | Jest        |
| Types               | 类型守卫函数          | Jest        |

### 集成测试

| 场景          | 测试内容            | 测试工具          |
| ------------- | ------------------- | ----------------- |
| Obsidian 同步 | 真实文件写入        | Jest + 临时目录   |
| Notion 同步   | API 调用（sandbox） | Jest + Nock       |
| Webhook 推送  | HTTP 请求           | Jest + MSW        |
| RSS 生成      | XML 格式验证        | Jest + XML Parser |

### E2E 测试

| 场景               | 测试内容           | 测试工具   |
| ------------------ | ------------------ | ---------- |
| 添加 Obsidian 目标 | 完整配置流程       | Playwright |
| Notion OAuth       | 授权流程模拟       | Playwright |
| 手动同步           | 触发同步并验证结果 | Playwright |

---

## 风险与缓解

| 风险              | 影响         | 缓解措施             |
| ----------------- | ------------ | -------------------- |
| Notion API 限流   | 同步延迟     | 实现队列 + 指数退避  |
| Electron API 变更 | 文件操作失败 | 封装抽象层，版本检测 |
| Token 泄露        | 安全风险     | 加密存储，HTTPS 传输 |
| 大量书签同步      | 性能问题     | 分批处理，后台任务   |

---

## 验收标准总结

### Epic 1 验收

- [ ] 分发模块目录结构创建完成
- [ ] DistributionService 核心功能可用
- [ ] EventBus 事件发布订阅正常
- [ ] 数据库迁移成功
- [ ] ManualExportAdapter 导出功能正常
- [ ] 单元测试覆盖率 > 80%

### Epic 2 验收

- [ ] ObsidianAdapter 文件写入正常
- [ ] 定时同步按计划执行
- [ ] 配置 UI 可用（桌面端）
- [ ] Web 端显示禁用提示
- [ ] 分发中心主页面可用

### Epic 3 验收

- [ ] Notion OAuth 流程完整
- [ ] Database 同步功能正常
- [ ] 属性映射配置可用
- [ ] Token 加密存储

### Epic 4 验收

- [ ] Webhook 推送正常（含签名）
- [ ] RSS Feed 生成正常
- [ ] URL 参数筛选可用
- [ ] 配置 UI 可用

---

_文档结束_
