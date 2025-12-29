# 🌟 北极星计划 (North Star Plan)

## AnyKeep 架构升级详细实施方案 v1.0

| 文档属性 | 值                         |
| -------- | -------------------------- |
| **版本** | 1.0.0                      |
| **日期** | 2025-12-29                 |
| **作者** | Winston (System Architect) |
| **审批** | Xiafe (CTO)                |
| **状态** | 待评审                     |

---

## 📋 目录

1. [执行摘要](#1-执行摘要)
2. [现状分析](#2-现状分析)
3. [目标架构](#3-目标架构)
4. [Phase 1: 服务层抽取与统一摄入](#4-phase-1-服务层抽取与统一摄入)
5. [Phase 2: 异步任务队列](#5-phase-2-异步任务队列)
6. [Phase 3: AI 架构标准化](#6-phase-3-ai-架构标准化)
7. [Phase 4: 前端数据层升级](#7-phase-4-前端数据层升级)
8. [数据库迁移计划](#8-数据库迁移计划)
9. [风险与缓解策略](#9-风险与缓解策略)
10. [验收标准](#10-验收标准)

---

## 1. 执行摘要

### 1.1 项目背景

AnyKeep 经过快速迭代，已发展为功能丰富的智能内容聚合平台。当前代码库包含：

| 指标            | 数值       |
| --------------- | ---------- |
| API 路由数      | 203 个     |
| AI Tools        | 50+ 个     |
| AI Skills       | 26+ 个     |
| 数据库迁移      | 155 个     |
| React Hooks     | 40+ 个     |
| TypeScript 文件 | 169 个     |
| 代码行数        | ~33,000 行 |

### 1.2 核心问题

经过代码库深度分析，确认了以下架构债务：

| 问题             | 严重度 | 现状                                                          |
| ---------------- | ------ | ------------------------------------------------------------- |
| **业务逻辑泄露** | 🔴 高  | 203 个 API Routes 中约 60% 包含内联业务逻辑                   |
| **数据流割裂**   | 🔴 高  | `/api/bookmarks/` 与 `/api/browser-bookmark/` 两条独立管道    |
| **服务层分散**   | 🟡 中  | 无统一 `/src/services/`，逻辑散落在 30+ 个 `src/lib/*` 子模块 |
| **AI 同步调用**  | 🟡 中  | 部分 AI 处理阻塞主线程，缺乏完整的任务队列                    |
| **前端状态管理** | 🟡 中  | 自定义 SWR 模式，缺乏统一的请求去重和乐观更新                 |

### 1.3 目标架构

```
从: Next.js Monolith (功能堆砌型)
到: Modular Monolith (模块化单体 + 领域驱动)
```

**核心转型方向**：

1. **统一摄入层** - 所有数据源走同一管道
2. **服务层抽取** - API Routes 仅做 HTTP 适配
3. **事件驱动 AI** - 异步队列解耦 AI 处理
4. **Tool 插件化** - MCP 标准接口，动态注册

### 1.4 时间规划

| Phase   | 名称                 | 时长   | 优先级 |
| ------- | -------------------- | ------ | ------ |
| Phase 1 | 服务层抽取与统一摄入 | 3-4 周 | P0     |
| Phase 2 | 异步任务队列         | 2-3 周 | P0     |
| Phase 3 | AI 架构标准化        | 3-4 周 | P1     |
| Phase 4 | 前端数据层升级       | 2-3 周 | P1     |

**总计**: 10-14 周（约 3 个月）

---

## 2. 现状分析

### 2.1 当前目录结构

```
src/
├── app/
│   ├── (auth)/              # 认证页面
│   ├── (main)/              # 主应用页面
│   └── api/                 # 203 个 API Routes ⚠️
│       ├── admin/           # 管理功能 (6 个)
│       ├── agent/           # AI 代理 (9 个)
│       ├── ai/              # AI 功能 (8 个)
│       ├── bookmarks/       # 收藏 CRUD (15 个) ⚠️ 逻辑过重
│       ├── browser-bookmark/# 浏览器书签 (4 个) ⚠️ 独立管道
│       ├── classification/  # 智能分类 (15+ 个)
│       ├── folders/         # 文件夹 (10 个)
│       ├── synthesis/       # 主题合成 (5 个)
│       └── internal/cron/   # 定时任务 (8 个)
├── components/              # 69 个组件
├── hooks/                   # 40+ Hooks ⚠️ 无统一数据层
├── lib/                     # 服务散落在此 ⚠️
│   ├── ai-agent/            # AI 代理核心
│   ├── ai-skills/           # 编排 Skills
│   ├── classification/      # 分类子系统
│   ├── browser-bookmark/    # 浏览器书签
│   ├── export/              # 导出服务
│   └── ...                  # 30+ 其他模块
└── types/                   # 类型定义
```

### 2.2 API Route 典型问题

**问题示例**: `/api/bookmarks/[id]/route.ts` (490 行)

```typescript
// ❌ 当前: 业务逻辑内联
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  // 1. Auth 验证 (20 行)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. 参数验证 (10 行)
  const { id } = await params;

  // 3. 数据查询 (50 行) ⚠️ 业务逻辑
  const { data, error } = await supabase
    .from("bookmarks")
    .select(BOOKMARK_DETAIL_FIELDS)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  // 4. 错误处理 (30 行)
  // 5. 响应构建 (20 行)
  return NextResponse.json({ ...data });
}
```

**目标**: 压缩至 < 50 行，业务逻辑下沉至 Service。

### 2.3 摄入管道对比

| 维度       | `/api/bookmarks/batch-import` | `/api/browser-bookmark/*`  |
| ---------- | ----------------------------- | -------------------------- |
| 目标表     | `bookmarks`                   | `browser_bookmarks`        |
| URL 去重   | ✅ url_hash                   | ✅ url                     |
| 向量生成   | ✅ generateEmbedding()        | ❌ 无                      |
| AI 分类    | ✅ classifyBookmarkV2()       | ❌ 无                      |
| 元数据获取 | ✅ detectPlatformFromUrl()    | ✅ fetch-metadata 独立 API |
| 批量大小   | 100 条/批                     | 无限制                     |

**问题**: 两套逻辑，维护成本翻倍。

### 2.4 AI 架构现状

**UnifiedEngine v3.0 架构**:

```
┌─────────────────────────────────────────────────────────────┐
│                 /api/agent/unified (入口)                    │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    UnifiedEngine                              │
│  ├── InputPreprocessor      (请求预处理)                      │
│  ├── IntentRouter           (意图路由 - 4 个分类器)           │
│  │   ├── IntentClassifier   (意图分类)                        │
│  │   ├── ComplexityEvaluator(复杂度评估)                      │
│  │   ├── EnhancedConfidence (增强置信度)                      │
│  │   └── ModeSelector       (模式选择)                        │
│  ├── ExecutionCoordinator   (执行协调)                        │
│  │   ├── Atomic Mode        → KnowledgeAgent                 │
│  │   └── Orchestration Mode → OrchestrationEngine            │
│  ├── OutputEnhancer         (输出增强)                        │
│  └── EffectManager          (副作用管理)                      │
└──────────────────────────────────────────────────────────────┘
```

**现有问题**:

1. **Tool 数量膨胀**: 50+ Tools 分布在 15 个目录，缺乏统一注册表
2. **意图路由过于复杂**: 4 个分类器串联，维护成本高
3. **部分同步调用**: 批量操作时可能阻塞前端

---

## 3. 目标架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │  Web App    │  │ Mobile App  │  │ Browser Ext │                 │
│  │ (Next.js)   │  │ (Capacitor) │  │  (Chrome)   │                 │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 │
└─────────┼────────────────┼────────────────┼─────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Next.js API Routes (瘦控制器)                                │   │
│  │  - Auth Middleware                                            │   │
│  │  - Request Validation (Zod)                                   │   │
│  │  - Error Handler                                              │   │
│  │  - Rate Limiter                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Service Layer (NEW)                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ Bookmark   │  │  Folder    │  │ Ingestion  │  │   Export   │    │
│  │  Service   │  │  Service   │  │  Service   │  │  Service   │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ AI Gateway │  │ Classifi-  │  │  Search    │  │  Analytics │    │
│  │  Service   │  │ cation Svc │  │  Service   │  │  Service   │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Repository     │  │   Job Queue     │  │   AI Engine     │
│    Layer        │  │   (Async)       │  │   (Plugin)      │
│                 │  │                 │  │                 │
│ - BookmarkRepo  │  │ - Task Producer │  │ - Tool Registry │
│ - FolderRepo    │  │ - Task Consumer │  │ - Skill Engine  │
│ - UserRepo      │  │ - Retry Logic   │  │ - MCP Adapter   │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Infrastructure Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │  Supabase   │  │  Supabase   │  │   OpenAI    │                 │
│  │  PostgreSQL │  │   Realtime  │  │  DeepSeek   │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 目录结构规划

```
src/
├── app/
│   ├── (auth)/
│   ├── (main)/
│   └── api/                    # 瘦控制器 (< 50 行/文件)
│       └── v1/                 # API 版本管理 (NEW)
│
├── services/                   # 🆕 统一服务层
│   ├── core/
│   │   ├── base.service.ts     # 服务基类
│   │   ├── database.service.ts # Supabase 封装
│   │   └── cache.service.ts    # 缓存服务
│   ├── domain/
│   │   ├── bookmark.service.ts # 书签服务
│   │   ├── folder.service.ts   # 文件夹服务
│   │   ├── ingestion.service.ts# 🆕 统一摄入
│   │   ├── search.service.ts   # 搜索服务
│   │   └── export.service.ts   # 导出服务
│   ├── ai/
│   │   ├── ai-gateway.service.ts # AI 网关
│   │   └── classification.service.ts
│   └── index.ts                # 统一导出
│
├── repositories/               # 🆕 数据访问层
│   ├── bookmark.repository.ts
│   ├── folder.repository.ts
│   └── base.repository.ts
│
├── jobs/                       # 🆕 异步任务
│   ├── producers/
│   │   └── task.producer.ts
│   ├── consumers/
│   │   ├── embedding.consumer.ts
│   │   ├── classification.consumer.ts
│   │   └── metadata.consumer.ts
│   └── types.ts
│
├── contracts/                  # 🆕 DTO 与契约
│   ├── requests/
│   │   ├── bookmark.request.ts
│   │   └── folder.request.ts
│   ├── responses/
│   │   ├── bookmark.response.ts
│   │   └── folder.response.ts
│   └── schemas/                # Zod Schemas
│
├── lib/                        # 工具与基础设施
│   ├── ai-agent/               # AI 代理 (重构)
│   │   └── tools/              # MCP 标准化
│   └── ...
│
├── hooks/                      # 前端 Hooks (升级)
│   ├── queries/                # 🆕 TanStack Query
│   └── mutations/              # 🆕 Mutations
│
└── components/
```

### 3.3 核心设计原则

| 原则                  | 描述                     | 实施方式                    |
| --------------------- | ------------------------ | --------------------------- |
| **Service-First**     | API Route 仅做 HTTP 适配 | 所有业务逻辑在 `/services/` |
| **Async-Default**     | AI 任务异步化            | Job Queue 驱动              |
| **Unified Ingestion** | 统一数据入口             | IngestionService 单一管道   |
| **AI as Plugin**      | AI 能力插件化            | MCP 标准接口                |
| **DTO Isolation**     | 数据契约隔离             | Request/Response DTOs       |

---

## 4. Phase 1: 服务层抽取与统一摄入

### 4.1 目标

- **目标 1**: 建立统一的 `/src/services/` 层
- **目标 2**: API Route 代码量压缩 80%
- **目标 3**: 合并书签摄入管道

### 4.2 服务层架构

#### 4.2.1 基础服务类

```typescript
// src/services/core/base.service.ts

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { createLogger } from "@/lib/logger";

export abstract class BaseService {
  protected readonly supabase: SupabaseClient<Database>;
  protected readonly logger: ReturnType<typeof createLogger>;
  protected readonly userId: string;

  constructor(
    supabase: SupabaseClient<Database>,
    userId: string,
    serviceName: string,
  ) {
    this.supabase = supabase;
    this.userId = userId;
    this.logger = createLogger(serviceName);
  }

  /**
   * 执行带事务的操作
   */
  protected async withTransaction<T>(operation: () => Promise<T>): Promise<T> {
    // PostgreSQL 事务封装
    try {
      await this.supabase.rpc("begin_transaction");
      const result = await operation();
      await this.supabase.rpc("commit_transaction");
      return result;
    } catch (error) {
      await this.supabase.rpc("rollback_transaction");
      throw error;
    }
  }

  /**
   * 统一错误处理
   */
  protected handleError(error: unknown, context: string): never {
    this.logger.error({ error, context }, "Service error");

    if (error instanceof ServiceError) {
      throw error;
    }

    throw new ServiceError(
      "INTERNAL_ERROR",
      `Operation failed: ${context}`,
      error,
    );
  }
}

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
```

#### 4.2.2 书签服务

```typescript
// src/services/domain/bookmark.service.ts

import { BaseService, ServiceError } from "../core/base.service";
import { BookmarkRepository } from "@/repositories/bookmark.repository";
import {
  CreateBookmarkRequest,
  UpdateBookmarkRequest,
  BookmarkResponse,
  BookmarkListResponse,
} from "@/contracts";
import { z } from "zod";

// DTO Schemas
export const CreateBookmarkSchema = z.object({
  url: z.string().url(),
  title: z.string().max(500).optional(),
  folderId: z.string().uuid().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(10000).optional(),
});

export const BookmarkQuerySchema = z.object({
  folderId: z.string().uuid().optional(),
  platform: z.string().optional(),
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  orderBy: z.enum(["created_at", "updated_at", "title"]).default("created_at"),
  orderDir: z.enum(["asc", "desc"]).default("desc"),
});

export class BookmarkService extends BaseService {
  private readonly repository: BookmarkRepository;

  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, userId, "BookmarkService");
    this.repository = new BookmarkRepository(supabase, userId);
  }

  /**
   * 创建书签 (通过 IngestionService 调用)
   */
  async create(input: CreateBookmarkRequest): Promise<BookmarkResponse> {
    const validated = CreateBookmarkSchema.parse(input);

    this.logger.info({ url: validated.url }, "Creating bookmark");

    // 检查重复
    const existing = await this.repository.findByUrl(validated.url);
    if (existing) {
      throw new ServiceError("DUPLICATE", "Bookmark already exists");
    }

    // 创建书签
    const bookmark = await this.repository.create({
      url: validated.url,
      title: validated.title || this.extractTitleFromUrl(validated.url),
      folder_id: validated.folderId,
      user_tags: validated.tags,
      notes: validated.notes,
      user_id: this.userId,
      status: "PENDING", // 等待 AI 处理
    });

    return this.toResponse(bookmark);
  }

  /**
   * 获取书签列表
   */
  async list(
    query: z.infer<typeof BookmarkQuerySchema>,
  ): Promise<BookmarkListResponse> {
    const validated = BookmarkQuerySchema.parse(query);

    const { data, total } = await this.repository.findMany(validated);

    return {
      items: data.map(this.toResponse),
      total,
      limit: validated.limit,
      offset: validated.offset,
    };
  }

  /**
   * 获取单个书签
   */
  async getById(id: string): Promise<BookmarkResponse> {
    const bookmark = await this.repository.findById(id);

    if (!bookmark) {
      throw new ServiceError("NOT_FOUND", `Bookmark ${id} not found`);
    }

    return this.toResponse(bookmark);
  }

  /**
   * 更新书签
   */
  async update(
    id: string,
    input: UpdateBookmarkRequest,
  ): Promise<BookmarkResponse> {
    const bookmark = await this.repository.update(id, input);

    if (!bookmark) {
      throw new ServiceError("NOT_FOUND", `Bookmark ${id} not found`);
    }

    return this.toResponse(bookmark);
  }

  /**
   * 删除书签 (软删除)
   */
  async delete(id: string): Promise<void> {
    const success = await this.repository.softDelete(id);

    if (!success) {
      throw new ServiceError("NOT_FOUND", `Bookmark ${id} not found`);
    }
  }

  /**
   * 批量操作
   */
  async batchMove(ids: string[], targetFolderId: string): Promise<number> {
    return this.withTransaction(async () => {
      // 验证目标文件夹存在
      const folderExists = await this.supabase
        .from("folders")
        .select("id")
        .eq("id", targetFolderId)
        .eq("user_id", this.userId)
        .single();

      if (!folderExists.data) {
        throw new ServiceError("NOT_FOUND", "Target folder not found");
      }

      return this.repository.batchUpdate(ids, { folder_id: targetFolderId });
    });
  }

  /**
   * DTO 转换
   */
  private toResponse(bookmark: DatabaseBookmark): BookmarkResponse {
    return {
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title,
      description: bookmark.description,
      platform: bookmark.platform,
      folderId: bookmark.folder_id,
      aiSummary: bookmark.ai_summary,
      aiTags: bookmark.ai_tags,
      userTags: bookmark.user_tags,
      notes: bookmark.notes,
      isRead: bookmark.is_read,
      isStarred: bookmark.is_starred,
      status: bookmark.status,
      createdAt: bookmark.created_at,
      updatedAt: bookmark.updated_at,
    };
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }
}
```

#### 4.2.3 统一摄入服务

```typescript
// src/services/domain/ingestion.service.ts

import { BaseService } from "../core/base.service";
import { BookmarkService } from "./bookmark.service";
import { TaskProducer } from "@/jobs/producers/task.producer";
import { z } from "zod";

/**
 * 摄入来源类型
 */
export type IngestionSource =
  | "web" // 网页手动添加
  | "api" // API 调用
  | "browser" // 浏览器导入
  | "mobile" // 移动端分享
  | "extension"; // 浏览器扩展

/**
 * 摄入请求 Schema
 */
export const IngestionRequestSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
  folderId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  source: z.enum(["web", "api", "browser", "mobile", "extension"]),
  metadata: z.record(z.unknown()).optional(),
});

export type IngestionRequest = z.infer<typeof IngestionRequestSchema>;

/**
 * 摄入结果
 */
export interface IngestionResult {
  bookmarkId: string;
  status: "created" | "duplicate" | "queued";
  message: string;
}

/**
 * 批量摄入结果
 */
export interface BatchIngestionResult {
  total: number;
  created: number;
  duplicates: number;
  queued: number;
  errors: Array<{ url: string; error: string }>;
}

/**
 * 统一摄入服务
 *
 * 所有数据源（网页、API、浏览器导入、移动端）统一走此服务
 *
 * Pipeline 流程:
 * 1. Normalize   - URL 标准化
 * 2. Deduplicate - 重复检测
 * 3. Persist     - 写入数据库 (status=PENDING)
 * 4. Enqueue     - 推送异步任务队列
 */
export class IngestionService extends BaseService {
  private readonly bookmarkService: BookmarkService;
  private readonly taskProducer: TaskProducer;

  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, userId, "IngestionService");
    this.bookmarkService = new BookmarkService(supabase, userId);
    this.taskProducer = new TaskProducer(supabase);
  }

  /**
   * 单条摄入
   */
  async ingest(request: IngestionRequest): Promise<IngestionResult> {
    const validated = IngestionRequestSchema.parse(request);

    this.logger.info(
      {
        url: validated.url,
        source: validated.source,
      },
      "Ingesting bookmark",
    );

    // Step 1: Normalize URL
    const normalizedUrl = this.normalizeUrl(validated.url);

    // Step 2: Check duplicate
    const existing = await this.checkDuplicate(normalizedUrl);
    if (existing) {
      return {
        bookmarkId: existing.id,
        status: "duplicate",
        message: "Bookmark already exists",
      };
    }

    // Step 3: Create bookmark with PENDING status
    const bookmark = await this.createPendingBookmark(validated, normalizedUrl);

    // Step 4: Enqueue async tasks
    await this.enqueueProcessingTasks(bookmark.id, validated.source);

    return {
      bookmarkId: bookmark.id,
      status: "queued",
      message: "Bookmark created, processing in background",
    };
  }

  /**
   * 批量摄入 (用于浏览器导入等)
   */
  async batchIngest(
    requests: IngestionRequest[],
    options: {
      batchSize?: number;
      skipDuplicates?: boolean;
    } = {},
  ): Promise<BatchIngestionResult> {
    const { batchSize = 100, skipDuplicates = true } = options;

    this.logger.info(
      {
        count: requests.length,
        batchSize,
      },
      "Starting batch ingestion",
    );

    const result: BatchIngestionResult = {
      total: requests.length,
      created: 0,
      duplicates: 0,
      queued: 0,
      errors: [],
    };

    // 分批处理
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);

      // 批量去重
      const urls = batch.map((r) => this.normalizeUrl(r.url));
      const existingUrls = await this.batchCheckDuplicates(urls);

      for (const request of batch) {
        try {
          const normalizedUrl = this.normalizeUrl(request.url);

          if (existingUrls.has(normalizedUrl)) {
            if (skipDuplicates) {
              result.duplicates++;
              continue;
            }
          }

          const ingested = await this.ingest(request);

          if (ingested.status === "queued") {
            result.created++;
            result.queued++;
          } else if (ingested.status === "duplicate") {
            result.duplicates++;
          }
        } catch (error) {
          result.errors.push({
            url: request.url,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    this.logger.info(result, "Batch ingestion completed");
    return result;
  }

  /**
   * URL 标准化
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);

      // 移除 tracking 参数
      const trackingParams = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "gclid",
        "ref",
        "source",
      ];
      trackingParams.forEach((param) => parsed.searchParams.delete(param));

      // 标准化
      parsed.protocol = parsed.protocol.toLowerCase();
      parsed.hostname = parsed.hostname.toLowerCase();

      // 移除尾部斜杠
      let normalized = parsed.toString();
      if (normalized.endsWith("/") && parsed.pathname === "/") {
        normalized = normalized.slice(0, -1);
      }

      return normalized;
    } catch {
      return url;
    }
  }

  /**
   * 检查重复
   */
  private async checkDuplicate(url: string): Promise<{ id: string } | null> {
    const { data } = await this.supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", this.userId)
      .eq("url", url)
      .is("deleted_at", null)
      .single();

    return data;
  }

  /**
   * 批量检查重复
   */
  private async batchCheckDuplicates(urls: string[]): Promise<Set<string>> {
    const { data } = await this.supabase
      .from("bookmarks")
      .select("url")
      .eq("user_id", this.userId)
      .in("url", urls)
      .is("deleted_at", null);

    return new Set(data?.map((d) => d.url) || []);
  }

  /**
   * 创建待处理书签
   */
  private async createPendingBookmark(
    request: IngestionRequest,
    normalizedUrl: string,
  ): Promise<{ id: string }> {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .insert({
        user_id: this.userId,
        url: normalizedUrl,
        title: request.title || this.extractDomain(normalizedUrl),
        description: request.description,
        folder_id: request.folderId,
        user_tags: request.tags,
        platform: this.detectPlatform(normalizedUrl),
        status: "PENDING",
        source: request.source,
        metadata: request.metadata,
      })
      .select("id")
      .single();

    if (error) {
      throw new ServiceError("DB_ERROR", "Failed to create bookmark", error);
    }

    return data;
  }

  /**
   * 推送异步处理任务
   */
  private async enqueueProcessingTasks(
    bookmarkId: string,
    source: IngestionSource,
  ): Promise<void> {
    // 任务优先级基于来源
    const priority = source === "browser" ? 5 : 10; // 浏览器导入优先级较低

    await this.taskProducer.produce([
      {
        type: "FETCH_METADATA",
        payload: { bookmarkId },
        priority,
      },
      {
        type: "GENERATE_EMBEDDING",
        payload: { bookmarkId },
        priority,
        dependsOn: "FETCH_METADATA",
      },
      {
        type: "AUTO_CLASSIFY",
        payload: { bookmarkId },
        priority,
        dependsOn: "GENERATE_EMBEDDING",
      },
    ]);
  }

  /**
   * 平台检测
   */
  private detectPlatform(url: string): string {
    const hostname = new URL(url).hostname.toLowerCase();

    const platformMap: Record<string, string> = {
      "mp.weixin.qq.com": "wechat",
      "weixin.qq.com": "wechat",
      "bilibili.com": "bilibili",
      "www.bilibili.com": "bilibili",
      "xiaohongshu.com": "xiaohongshu",
      "www.xiaohongshu.com": "xiaohongshu",
      "zhihu.com": "zhihu",
      "www.zhihu.com": "zhihu",
      "juejin.cn": "juejin",
      "github.com": "github",
      "twitter.com": "twitter",
      "x.com": "twitter",
      "youtube.com": "youtube",
      "www.youtube.com": "youtube",
    };

    for (const [domain, platform] of Object.entries(platformMap)) {
      if (hostname.includes(domain)) {
        return platform;
      }
    }

    return "web";
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }
}
```

### 4.3 API Route 重构示例

**重构前**: `/api/bookmarks/[id]/route.ts` (490 行)

**重构后**:

```typescript
// src/app/api/v1/bookmarks/[id]/route.ts (< 50 行)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BookmarkService } from "@/services/domain/bookmark.service";
import { withAuth, withErrorHandler } from "@/lib/api/middleware";
import { UpdateBookmarkSchema } from "@/contracts/schemas";

/**
 * GET /api/v1/bookmarks/:id
 * 获取单个书签详情
 */
export const GET = withErrorHandler(
  withAuth(async (request: NextRequest, { params, user }) => {
    const { id } = await params;
    const supabase = await createClient();

    const service = new BookmarkService(supabase, user.id);
    const bookmark = await service.getById(id);

    return NextResponse.json(bookmark, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  }),
);

/**
 * PATCH /api/v1/bookmarks/:id
 * 更新书签
 */
export const PATCH = withErrorHandler(
  withAuth(async (request: NextRequest, { params, user }) => {
    const { id } = await params;
    const body = await request.json();
    const validated = UpdateBookmarkSchema.parse(body);

    const supabase = await createClient();
    const service = new BookmarkService(supabase, user.id);
    const bookmark = await service.update(id, validated);

    return NextResponse.json(bookmark);
  }),
);

/**
 * DELETE /api/v1/bookmarks/:id
 * 删除书签 (软删除)
 */
export const DELETE = withErrorHandler(
  withAuth(async (request: NextRequest, { params, user }) => {
    const { id } = await params;

    const supabase = await createClient();
    const service = new BookmarkService(supabase, user.id);
    await service.delete(id);

    return new NextResponse(null, { status: 204 });
  }),
);
```

### 4.4 中间件设计

```typescript
// src/lib/api/middleware.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ServiceError } from "@/services/core/base.service";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api-middleware");

/**
 * Auth 中间件
 */
export function withAuth<T extends (...args: any[]) => any>(handler: T) {
  return async (request: NextRequest, context: any) => {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_ERROR" },
        { status: 401 },
      );
    }

    return handler(request, { ...context, user });
  };
}

/**
 * 统一错误处理中间件
 */
export function withErrorHandler<T extends (...args: any[]) => any>(
  handler: T,
) {
  return async (request: NextRequest, context: any) => {
    try {
      return await handler(request, context);
    } catch (error) {
      logger.error({ error, url: request.url }, "API Error");

      if (error instanceof ServiceError) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404,
          DUPLICATE: 409,
          VALIDATION: 400,
          FORBIDDEN: 403,
          INTERNAL_ERROR: 500,
        };

        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: statusMap[error.code] || 500 },
        );
      }

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", details: error.errors },
          { status: 400 },
        );
      }

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}

/**
 * 速率限制中间件
 */
export function withRateLimit(limit: number, windowMs: number) {
  // 使用 Supabase 存储计数
  return function <T extends (...args: any[]) => any>(handler: T) {
    return async (request: NextRequest, context: any) => {
      // Rate limit 逻辑
      return handler(request, context);
    };
  };
}
```

### 4.5 验收标准

| 验收项           | 标准                        | 验证方式     |
| ---------------- | --------------------------- | ------------ |
| API Route 代码量 | 每个 Route < 50 行          | 代码审查     |
| 服务层覆盖       | 100% API 调用 Service       | 调用链路检查 |
| 摄入管道统一     | 所有来源走 IngestionService | 单元测试     |
| 错误处理         | 100% ServiceError 标准化    | 错误日志审计 |
| DTO 隔离         | Request/Response 完全分离   | 类型检查     |

### 4.6 迁移策略

```
Week 1:
├── 创建 /src/services/ 目录结构
├── 实现 BaseService 和 ServiceError
├── 实现 BookmarkService (迁移 /api/bookmarks/[id])
└── 添加中间件 (withAuth, withErrorHandler)

Week 2:
├── 实现 IngestionService
├── 迁移 /api/bookmarks/batch-import
├── 迁移 /api/browser-bookmark/* (复用 IngestionService)
└── 废弃 browser_bookmarks 表 (数据迁移)

Week 3:
├── 实现 FolderService
├── 实现 SearchService
├── 迁移剩余 /api/bookmarks/* 端点
└── 迁移 /api/folders/* 端点

Week 4:
├── 集成测试
├── 性能基准测试
├── 文档更新
└── 代码审查
```

---

## 5. Phase 2: 异步任务队列

### 5.1 目标

- **目标 1**: AI 处理完全异步化
- **目标 2**: 批量导入不阻塞 API
- **目标 3**: 任务失败自动重试

### 5.2 任务队列架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Producer (API/Service)                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  IngestionService.ingest() → TaskProducer.produce()         │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      system_jobs Table (PostgreSQL)                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  id | type | payload | status | priority | retry_count | ... │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Metadata       │  │  Embedding      │  │  Classification │
│  Consumer       │  │  Consumer       │  │  Consumer       │
│                 │  │                 │  │                 │
│ - Fetch OG tags │  │ - OpenAI API    │  │ - AI Classify   │
│ - Extract title │  │ - pgvector      │  │ - Folder assign │
│ - Favicon       │  │ - Update DB     │  │ - Auto tagging  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Supabase Realtime                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  bookmarks.status: PENDING → COMPLETED                       │    │
│  │  → Notify Frontend via WebSocket                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 数据库 Schema

```sql
-- supabase/migrations/YYYYMMDD_create_system_jobs.sql

-- 任务类型枚举
CREATE TYPE job_type AS ENUM (
  'FETCH_METADATA',
  'GENERATE_EMBEDDING',
  'AUTO_CLASSIFY',
  'DEEP_CRAWL',
  'CLEANUP_TRASH',
  'VALIDATE_LINKS',
  'PROFILE_UPDATE'
);

-- 任务状态枚举
CREATE TYPE job_status AS ENUM (
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

-- 任务表
CREATE TABLE system_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 任务信息
  type job_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',

  -- 状态管理
  status job_status NOT NULL DEFAULT 'PENDING',
  priority INT NOT NULL DEFAULT 10,  -- 1-100, 越小优先级越高

  -- 重试机制
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  last_error TEXT,

  -- 依赖关系
  depends_on UUID REFERENCES system_jobs(id),

  -- 所有者
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id UUID REFERENCES bookmarks(id) ON DELETE CASCADE,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ DEFAULT now(),  -- 延迟执行

  -- 锁机制 (防止并发消费)
  locked_by TEXT,
  locked_at TIMESTAMPTZ
);

-- 索引优化
CREATE INDEX idx_system_jobs_pending
  ON system_jobs (priority, scheduled_for)
  WHERE status = 'PENDING' AND locked_by IS NULL;

CREATE INDEX idx_system_jobs_user
  ON system_jobs (user_id, status, created_at DESC);

CREATE INDEX idx_system_jobs_bookmark
  ON system_jobs (bookmark_id, type);

-- 获取并锁定待处理任务的函数
CREATE OR REPLACE FUNCTION claim_pending_jobs(
  p_worker_id TEXT,
  p_job_types job_type[],
  p_limit INT DEFAULT 10
)
RETURNS SETOF system_jobs
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM system_jobs
    WHERE status = 'PENDING'
      AND type = ANY(p_job_types)
      AND locked_by IS NULL
      AND scheduled_for <= now()
      AND (depends_on IS NULL OR
           EXISTS (
             SELECT 1 FROM system_jobs dep
             WHERE dep.id = system_jobs.depends_on
               AND dep.status = 'COMPLETED'
           ))
    ORDER BY priority, created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE system_jobs
  SET
    locked_by = p_worker_id,
    locked_at = now(),
    status = 'RUNNING',
    started_at = now()
  FROM claimed
  WHERE system_jobs.id = claimed.id
  RETURNING system_jobs.*;
END;
$$;

-- 完成任务
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id UUID,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_success THEN
    UPDATE system_jobs
    SET
      status = 'COMPLETED',
      completed_at = now(),
      locked_by = NULL,
      locked_at = NULL
    WHERE id = p_job_id;
  ELSE
    UPDATE system_jobs
    SET
      status = CASE
        WHEN retry_count >= max_retries THEN 'FAILED'::job_status
        ELSE 'PENDING'::job_status
      END,
      retry_count = retry_count + 1,
      last_error = p_error,
      locked_by = NULL,
      locked_at = NULL,
      scheduled_for = now() + (power(2, retry_count) * interval '1 minute')  -- 指数退避
    WHERE id = p_job_id;
  END IF;
END;
$$;

-- RLS 策略
ALTER TABLE system_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
  ON system_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- 允许服务角色完全访问
CREATE POLICY "Service role full access"
  ON system_jobs
  USING (auth.role() = 'service_role');
```

### 5.4 任务生产者

```typescript
// src/jobs/producers/task.producer.ts

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { createLogger } from "@/lib/logger";

const logger = createLogger("TaskProducer");

export type JobType =
  | "FETCH_METADATA"
  | "GENERATE_EMBEDDING"
  | "AUTO_CLASSIFY"
  | "DEEP_CRAWL"
  | "CLEANUP_TRASH"
  | "VALIDATE_LINKS"
  | "PROFILE_UPDATE";

export interface TaskDefinition {
  type: JobType;
  payload: Record<string, unknown>;
  priority?: number;
  dependsOn?: JobType;
  scheduledFor?: Date;
  maxRetries?: number;
}

export class TaskProducer {
  private readonly supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 生产单个任务
   */
  async produce(task: TaskDefinition, userId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from("system_jobs")
      .insert({
        type: task.type,
        payload: task.payload,
        priority: task.priority ?? 10,
        max_retries: task.maxRetries ?? 3,
        scheduled_for: task.scheduledFor?.toISOString(),
        user_id: userId,
        bookmark_id: task.payload.bookmarkId as string | undefined,
      })
      .select("id")
      .single();

    if (error) {
      logger.error({ error, task }, "Failed to produce task");
      throw error;
    }

    logger.info({ jobId: data.id, type: task.type }, "Task produced");
    return data.id;
  }

  /**
   * 生产批量任务 (带依赖关系)
   */
  async produceBatch(
    tasks: TaskDefinition[],
    userId: string,
  ): Promise<string[]> {
    const jobIds: string[] = [];
    const typeToJobId = new Map<JobType, string>();

    // 按依赖顺序排序
    const sorted = this.topologicalSort(tasks);

    for (const task of sorted) {
      let dependsOnId: string | undefined;

      // 解析依赖
      if (task.dependsOn && typeToJobId.has(task.dependsOn)) {
        dependsOnId = typeToJobId.get(task.dependsOn);
      }

      const { data, error } = await this.supabase
        .from("system_jobs")
        .insert({
          type: task.type,
          payload: task.payload,
          priority: task.priority ?? 10,
          max_retries: task.maxRetries ?? 3,
          scheduled_for: task.scheduledFor?.toISOString(),
          depends_on: dependsOnId,
          user_id: userId,
          bookmark_id: task.payload.bookmarkId as string | undefined,
        })
        .select("id")
        .single();

      if (error) {
        logger.error({ error, task }, "Failed to produce batch task");
        continue;
      }

      jobIds.push(data.id);
      typeToJobId.set(task.type, data.id);
    }

    logger.info({ count: jobIds.length }, "Batch tasks produced");
    return jobIds;
  }

  /**
   * 拓扑排序 (处理依赖)
   */
  private topologicalSort(tasks: TaskDefinition[]): TaskDefinition[] {
    const graph = new Map<JobType, TaskDefinition>();
    const inDegree = new Map<JobType, number>();
    const result: TaskDefinition[] = [];

    // 初始化
    for (const task of tasks) {
      graph.set(task.type, task);
      inDegree.set(task.type, 0);
    }

    // 计算入度
    for (const task of tasks) {
      if (task.dependsOn && graph.has(task.dependsOn)) {
        inDegree.set(task.type, (inDegree.get(task.type) || 0) + 1);
      }
    }

    // BFS
    const queue = tasks.filter((t) => (inDegree.get(t.type) || 0) === 0);

    while (queue.length > 0) {
      const task = queue.shift()!;
      result.push(task);

      for (const t of tasks) {
        if (t.dependsOn === task.type) {
          const degree = (inDegree.get(t.type) || 1) - 1;
          inDegree.set(t.type, degree);
          if (degree === 0) {
            queue.push(t);
          }
        }
      }
    }

    return result;
  }
}
```

### 5.5 任务消费者

```typescript
// src/jobs/consumers/base.consumer.ts

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { createLogger } from "@/lib/logger";
import { JobType } from "../producers/task.producer";

export interface JobContext {
  jobId: string;
  type: JobType;
  payload: Record<string, unknown>;
  userId: string;
  bookmarkId?: string;
  retryCount: number;
}

export abstract class BaseConsumer {
  protected readonly supabase: SupabaseClient<Database>;
  protected readonly logger: ReturnType<typeof createLogger>;
  protected readonly workerId: string;
  protected readonly jobTypes: JobType[];

  private isRunning = false;
  private pollInterval = 5000; // 5 秒

  constructor(
    supabase: SupabaseClient<Database>,
    jobTypes: JobType[],
    consumerName: string,
  ) {
    this.supabase = supabase;
    this.jobTypes = jobTypes;
    this.workerId = `${consumerName}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.logger = createLogger(consumerName);
  }

  /**
   * 启动消费者
   */
  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info({ workerId: this.workerId }, "Consumer started");

    while (this.isRunning) {
      try {
        await this.pollAndProcess();
      } catch (error) {
        this.logger.error({ error }, "Poll error");
      }

      await this.sleep(this.pollInterval);
    }
  }

  /**
   * 停止消费者
   */
  stop(): void {
    this.isRunning = false;
    this.logger.info("Consumer stopping");
  }

  /**
   * 拉取并处理任务
   */
  private async pollAndProcess(): Promise<void> {
    // 使用 RPC 函数原子性获取任务
    const { data: jobs, error } = await this.supabase.rpc(
      "claim_pending_jobs",
      {
        p_worker_id: this.workerId,
        p_job_types: this.jobTypes,
        p_limit: 5,
      },
    );

    if (error) {
      this.logger.error({ error }, "Failed to claim jobs");
      return;
    }

    if (!jobs || jobs.length === 0) {
      return;
    }

    this.logger.info({ count: jobs.length }, "Claimed jobs");

    // 并发处理任务
    await Promise.allSettled(
      jobs.map((job) =>
        this.processJob({
          jobId: job.id,
          type: job.type,
          payload: job.payload,
          userId: job.user_id,
          bookmarkId: job.bookmark_id,
          retryCount: job.retry_count,
        }),
      ),
    );
  }

  /**
   * 处理单个任务
   */
  private async processJob(context: JobContext): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info(
        { jobId: context.jobId, type: context.type },
        "Processing job",
      );

      await this.execute(context);

      await this.completeJob(context.jobId, true);

      this.logger.info(
        {
          jobId: context.jobId,
          duration: Date.now() - startTime,
        },
        "Job completed",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      this.logger.error(
        {
          jobId: context.jobId,
          error: errorMessage,
          retryCount: context.retryCount,
        },
        "Job failed",
      );

      await this.completeJob(context.jobId, false, errorMessage);
    }
  }

  /**
   * 完成任务
   */
  private async completeJob(
    jobId: string,
    success: boolean,
    error?: string,
  ): Promise<void> {
    await this.supabase.rpc("complete_job", {
      p_job_id: jobId,
      p_success: success,
      p_error: error,
    });
  }

  /**
   * 子类实现具体处理逻辑
   */
  protected abstract execute(context: JobContext): Promise<void>;

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

```typescript
// src/jobs/consumers/embedding.consumer.ts

import { BaseConsumer, JobContext } from "./base.consumer";
import { generateEmbedding } from "@/lib/embedding";

export class EmbeddingConsumer extends BaseConsumer {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, ["GENERATE_EMBEDDING"], "EmbeddingConsumer");
  }

  protected async execute(context: JobContext): Promise<void> {
    const { bookmarkId } = context.payload as { bookmarkId: string };

    // 获取书签内容
    const { data: bookmark } = await this.supabase
      .from("bookmarks")
      .select("title, description, ai_summary, content")
      .eq("id", bookmarkId)
      .single();

    if (!bookmark) {
      throw new Error(`Bookmark ${bookmarkId} not found`);
    }

    // 生成向量
    const textToEmbed = [
      bookmark.title,
      bookmark.description,
      bookmark.ai_summary,
      bookmark.content?.slice(0, 2000), // 限制长度
    ]
      .filter(Boolean)
      .join("\n");

    const embedding = await generateEmbedding(textToEmbed);

    // 更新数据库
    const { error } = await this.supabase
      .from("bookmarks")
      .update({
        embedding,
        status: "EMBEDDING_DONE",
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookmarkId);

    if (error) {
      throw error;
    }
  }
}
```

### 5.6 Cron 触发器

```typescript
// src/app/api/internal/cron/process-jobs/route.ts

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { EmbeddingConsumer } from "@/jobs/consumers/embedding.consumer";
import { ClassificationConsumer } from "@/jobs/consumers/classification.consumer";
import { MetadataConsumer } from "@/jobs/consumers/metadata.consumer";

/**
 * Cron Job: 每分钟执行
 * 触发方式: Vercel Cron 或 Supabase pg_cron
 */
export async function GET(request: Request) {
  // 验证 Cron Secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // 启动消费者 (每个处理 5 个任务)
  const consumers = [
    new EmbeddingConsumer(supabase),
    new ClassificationConsumer(supabase),
    new MetadataConsumer(supabase),
  ];

  const results = await Promise.allSettled(
    consumers.map(async (consumer) => {
      // 单次执行模式 (不循环)
      await consumer.processBatch(5);
    }),
  );

  return NextResponse.json({
    success: true,
    processed: results.filter((r) => r.status === "fulfilled").length,
  });
}
```

### 5.7 前端实时更新

```typescript
// src/hooks/use-bookmark-realtime.ts

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useBookmarkRealtime(userId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("bookmark-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const { new: bookmark, old: oldBookmark } = payload;

          // 状态变化通知
          if (
            oldBookmark.status === "PENDING" &&
            bookmark.status === "COMPLETED"
          ) {
            toast.success(`"${bookmark.title}" 处理完成`);

            // 刷新查询缓存
            queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
          }

          if (bookmark.status === "FAILED") {
            toast.error(`"${bookmark.title}" 处理失败`);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
```

### 5.8 验收标准

| 验收项        | 标准               | 验证方式     |
| ------------- | ------------------ | ------------ |
| AI 调用异步化 | 100% 通过队列      | 调用链路追踪 |
| 批量导入延迟  | API < 500ms 返回   | 性能测试     |
| 任务重试      | 指数退避 3 次      | 日志审计     |
| 实时通知      | 状态变更 < 1s 推送 | E2E 测试     |

---

## 6. Phase 3: AI 架构标准化

### 6.1 目标

- **目标 1**: Tool 接口 MCP 标准化
- **目标 2**: 简化意图路由为 Planning → Execution
- **目标 3**: 混合检索提升召回率

### 6.2 MCP 标准 Tool 接口

```typescript
// src/lib/ai-agent/tools/types.ts

import { z } from "zod";

/**
 * MCP 标准 Tool 接口
 * 参考: Model Context Protocol
 */
export interface MCPTool<TInput = unknown, TOutput = unknown> {
  /** 工具唯一标识 */
  name: string;

  /** 工具描述 (用于 LLM 选择) */
  description: string;

  /** 输入 Schema (Zod) */
  inputSchema: z.ZodSchema<TInput>;

  /** 输出 Schema (可选) */
  outputSchema?: z.ZodSchema<TOutput>;

  /** 工具分类 */
  category: ToolCategory;

  /** 风险等级 */
  riskLevel: "low" | "medium" | "high";

  /** 是否需要确认 */
  requiresConfirmation: boolean;

  /** 执行函数 */
  execute: (
    context: ToolContext,
    input: TInput,
  ) => Promise<ToolResult<TOutput>>;
}

export type ToolCategory =
  | "query" // 查询类 (只读)
  | "action" // 操作类 (写入)
  | "analysis" // 分析类
  | "export" // 导出类
  | "system"; // 系统类

export interface ToolContext {
  userId: string;
  sessionId: string;
  supabase: SupabaseClient<Database>;
  abortSignal?: AbortSignal;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    executionTimeMs: number;
    affectedCount?: number;
    warnings?: string[];
  };
}
```

### 6.3 Tool 注册表

```typescript
// src/lib/ai-agent/tools/registry.ts

import { MCPTool, ToolCategory, ToolContext, ToolResult } from "./types";
import { createLogger } from "@/lib/logger";

const logger = createLogger("ToolRegistry");

class ToolRegistry {
  private tools = new Map<string, MCPTool>();
  private categories = new Map<ToolCategory, Set<string>>();

  /**
   * 注册工具
   */
  register<TInput, TOutput>(tool: MCPTool<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      logger.warn({ name: tool.name }, "Tool already registered, overwriting");
    }

    this.tools.set(tool.name, tool as MCPTool);

    // 分类索引
    if (!this.categories.has(tool.category)) {
      this.categories.set(tool.category, new Set());
    }
    this.categories.get(tool.category)!.add(tool.name);

    logger.info(
      { name: tool.name, category: tool.category },
      "Tool registered",
    );
  }

  /**
   * 获取工具
   */
  get(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  /**
   * 按分类获取
   */
  getByCategory(category: ToolCategory): MCPTool[] {
    const names = this.categories.get(category) || new Set();
    return Array.from(names).map((n) => this.tools.get(n)!);
  }

  /**
   * 获取所有工具描述 (供 LLM 使用)
   */
  getToolDescriptions(): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: this.zodToJsonSchema(tool.inputSchema),
    }));
  }

  /**
   * 执行工具
   */
  async execute<TOutput>(
    name: string,
    context: ToolContext,
    input: unknown,
  ): Promise<ToolResult<TOutput>> {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found`,
      };
    }

    const startTime = Date.now();

    try {
      // 验证输入
      const validatedInput = tool.inputSchema.parse(input);

      // 执行
      const result = await tool.execute(context, validatedInput);

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTimeMs: Date.now() - startTime,
        },
      } as ToolResult<TOutput>;
    } catch (error) {
      logger.error({ error, tool: name }, "Tool execution failed");

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    }
  }

  /**
   * Zod Schema 转 JSON Schema
   */
  private zodToJsonSchema(schema: z.ZodSchema): Record<string, unknown> {
    // 使用 zod-to-json-schema 库
    return zodToJsonSchema(schema);
  }

  /**
   * 统计信息
   */
  getStats(): { total: number; byCategory: Record<string, number> } {
    const byCategory: Record<string, number> = {};
    this.categories.forEach((tools, category) => {
      byCategory[category] = tools.size;
    });

    return {
      total: this.tools.size,
      byCategory,
    };
  }
}

// 单例
export const toolRegistry = new ToolRegistry();

// 自动注册装饰器
export function RegisterTool<TInput, TOutput>(
  tool: MCPTool<TInput, TOutput>,
): void {
  toolRegistry.register(tool);
}
```

### 6.4 Tool 实现示例

```typescript
// src/lib/ai-agent/tools/bookmark/search-bookmarks.tool.ts

import { z } from "zod";
import { MCPTool, ToolContext, ToolResult, RegisterTool } from "../registry";

const SearchInputSchema = z.object({
  query: z.string().min(1).max(500),
  filters: z
    .object({
      folderId: z.string().uuid().optional(),
      platform: z.string().optional(),
      tags: z.array(z.string()).optional(),
      dateRange: z
        .object({
          start: z.string().datetime().optional(),
          end: z.string().datetime().optional(),
        })
        .optional(),
    })
    .optional(),
  limit: z.number().min(1).max(50).default(20),
  searchType: z.enum(["semantic", "keyword", "hybrid"]).default("hybrid"),
});

type SearchInput = z.infer<typeof SearchInputSchema>;

interface SearchOutput {
  results: Array<{
    id: string;
    title: string;
    url: string;
    summary: string;
    score: number;
  }>;
  total: number;
  searchType: string;
}

const searchBookmarksTool: MCPTool<SearchInput, SearchOutput> = {
  name: "search_bookmarks",
  description: `搜索用户收藏的书签。支持语义搜索、关键词搜索和混合搜索。
可通过 filters 筛选特定文件夹、平台、标签或时间范围。
返回按相关性排序的结果列表。`,

  inputSchema: SearchInputSchema,

  category: "query",
  riskLevel: "low",
  requiresConfirmation: false,

  async execute(
    context: ToolContext,
    input: SearchInput,
  ): Promise<ToolResult<SearchOutput>> {
    const { query, filters, limit, searchType } = input;

    let results: SearchOutput["results"] = [];

    if (searchType === "semantic" || searchType === "hybrid") {
      // 语义搜索
      const { data: semanticResults } = await context.supabase.rpc(
        "match_bookmarks",
        {
          query_embedding: await generateEmbedding(query),
          match_count: limit,
          filter_user_id: context.userId,
          filter_folder_id: filters?.folderId,
        },
      );

      results = semanticResults || [];
    }

    if (searchType === "keyword" || searchType === "hybrid") {
      // 全文搜索
      const { data: keywordResults } = await context.supabase
        .from("bookmarks")
        .select("id, title, url, ai_summary")
        .eq("user_id", context.userId)
        .textSearch("fts", query, { type: "websearch" })
        .limit(limit);

      if (searchType === "hybrid") {
        // RRF 融合
        results = reciprocalRankFusion(results, keywordResults || []);
      } else {
        results = keywordResults || [];
      }
    }

    // 应用过滤器
    if (filters?.platform) {
      results = results.filter((r) => r.platform === filters.platform);
    }

    return {
      success: true,
      data: {
        results: results.slice(0, limit),
        total: results.length,
        searchType,
      },
    };
  },
};

// 注册工具
RegisterTool(searchBookmarksTool);
```

### 6.5 Planning → Execution 模型

```typescript
// src/lib/ai-agent/planner/types.ts

/**
 * 执行计划
 */
export interface ExecutionPlan {
  id: string;
  intent: string;
  confidence: number;
  steps: PlanStep[];
  estimatedDuration: number;
  riskLevel: "low" | "medium" | "high";
}

export interface PlanStep {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  outputVariable?: string; // 用于步骤间传参
  condition?: string; // 条件执行
  onError?: "skip" | "abort" | "retry";
}

/**
 * 执行计划 Prompt
 */
export const PLANNER_SYSTEM_PROMPT = `
你是一个任务规划器。根据用户请求和可用工具，生成一个执行计划。

## 可用工具
{{tools}}

## 输出格式
返回 JSON 格式的执行计划:
{
  "intent": "用户意图简述",
  "confidence": 0.0-1.0,
  "steps": [
    {
      "id": "step_1",
      "tool": "工具名称",
      "params": { "参数": "值" },
      "outputVariable": "$result_1"
    },
    {
      "id": "step_2",
      "tool": "工具名称",
      "params": { "query": "$result_1.data" }
    }
  ],
  "riskLevel": "low|medium|high"
}

## 规则
1. 只使用可用工具列表中的工具
2. 步骤间可通过 $变量名 传递数据
3. 高风险操作需要用户确认
4. 尽量减少步骤数量
`;
```

```typescript
// src/lib/ai-agent/planner/planner.ts

import { ExecutionPlan, PlanStep } from "./types";
import { toolRegistry } from "../tools/registry";
import { generateWithAI } from "@/lib/ai/generate";

export class TaskPlanner {
  /**
   * 生成执行计划
   */
  async plan(userMessage: string): Promise<ExecutionPlan> {
    const tools = toolRegistry.getToolDescriptions();

    const response = await generateWithAI({
      model: "deepseek-chat",
      systemPrompt: PLANNER_SYSTEM_PROMPT.replace(
        "{{tools}}",
        JSON.stringify(tools, null, 2),
      ),
      userMessage,
      responseFormat: "json_object",
    });

    const plan = JSON.parse(response) as ExecutionPlan;
    plan.id = crypto.randomUUID();

    return this.validatePlan(plan);
  }

  /**
   * 验证计划
   */
  private validatePlan(plan: ExecutionPlan): ExecutionPlan {
    for (const step of plan.steps) {
      const tool = toolRegistry.get(step.tool);

      if (!tool) {
        throw new Error(`Unknown tool: ${step.tool}`);
      }

      // 验证参数
      try {
        tool.inputSchema.parse(step.params);
      } catch (error) {
        throw new Error(`Invalid params for ${step.tool}: ${error}`);
      }
    }

    return plan;
  }
}
```

```typescript
// src/lib/ai-agent/executor/plan-executor.ts

import { ExecutionPlan, PlanStep } from "../planner/types";
import { toolRegistry } from "../tools/registry";
import { ToolContext, ToolResult } from "../tools/types";

export class PlanExecutor {
  private context: ToolContext;
  private variables = new Map<string, unknown>();

  constructor(context: ToolContext) {
    this.context = context;
  }

  /**
   * 执行计划
   */
  async execute(plan: ExecutionPlan): AsyncGenerator<ExecutionEvent> {
    yield { type: "plan_start", plan };

    for (const step of plan.steps) {
      yield { type: "step_start", step };

      try {
        // 解析参数中的变量引用
        const resolvedParams = this.resolveVariables(step.params);

        // 执行工具
        const result = await toolRegistry.execute(
          step.tool,
          this.context,
          resolvedParams
        );

        // 存储输出变量
        if (step.outputVariable && result.success) {
          this.variables.set(step.outputVariable, result.data);
        }

        yield { type: "step_complete", step, result };

        if (!result.success && step.onError === "abort") {
          yield { type: "plan_abort", reason: result.error };
          return;
        }

      } catch (error) {
        yield { type: "step_error", step, error };

        if (step.onError === "abort") {
          yield { type: "plan_abort", reason: String(error) };
          return;
        }
      }
    }

    yield { type: "plan_complete" };
  }

  /**
   * 解析变量引用
   */
  private resolveVariables(params: Record<string, unknown>): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value.startsWith("$")) {
        // 解析 $result_1.data.items 格式
        const parts = value.slice(1).split(".");
        let current: unknown = this.variables.get(parts[0]);

        for (let i = 1; i < parts.length && current != null; i++) {
          current = (current as Record<string, unknown>)[parts[i]];
        }

        resolved[key] = current;
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }
}

export type ExecutionEvent =
  | { type: "plan_start"; plan: ExecutionPlan }
  | { type: "step_start"; step: PlanStep }
  | { type: "step_complete"; step: PlanStep; result: ToolResult }
  | { type: "step_error"; step: PlanStep; error: unknown }
  | { type: "plan_complete" }
  | { type: "plan_abort"; reason: string };
```

### 6.6 混合检索升级

```sql
-- supabase/migrations/YYYYMMDD_add_hybrid_search.sql

-- 添加全文搜索向量列
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(ai_summary, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'C')
  ) STORED;

-- 创建 GIN 索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_fts ON bookmarks USING gin(fts);

-- 混合搜索函数
CREATE OR REPLACE FUNCTION hybrid_search(
  p_user_id UUID,
  p_query TEXT,
  p_query_embedding vector(1024),
  p_match_count INT DEFAULT 20,
  p_semantic_weight FLOAT DEFAULT 0.6,
  p_keyword_weight FLOAT DEFAULT 0.3,
  p_recency_weight FLOAT DEFAULT 0.1
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  url TEXT,
  ai_summary TEXT,
  score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic AS (
    SELECT
      b.id,
      1 - (b.embedding <=> p_query_embedding) AS semantic_score,
      ROW_NUMBER() OVER (ORDER BY b.embedding <=> p_query_embedding) AS semantic_rank
    FROM bookmarks b
    WHERE b.user_id = p_user_id
      AND b.deleted_at IS NULL
      AND b.embedding IS NOT NULL
    ORDER BY b.embedding <=> p_query_embedding
    LIMIT p_match_count * 2
  ),
  keyword AS (
    SELECT
      b.id,
      ts_rank(b.fts, websearch_to_tsquery('simple', p_query)) AS keyword_score,
      ROW_NUMBER() OVER (ORDER BY ts_rank(b.fts, websearch_to_tsquery('simple', p_query)) DESC) AS keyword_rank
    FROM bookmarks b
    WHERE b.user_id = p_user_id
      AND b.deleted_at IS NULL
      AND b.fts @@ websearch_to_tsquery('simple', p_query)
    ORDER BY ts_rank(b.fts, websearch_to_tsquery('simple', p_query)) DESC
    LIMIT p_match_count * 2
  ),
  combined AS (
    SELECT
      COALESCE(s.id, k.id) AS id,
      -- RRF 融合 (k=60)
      (p_semantic_weight * COALESCE(1.0 / (60 + s.semantic_rank), 0)) +
      (p_keyword_weight * COALESCE(1.0 / (60 + k.keyword_rank), 0)) +
      (p_recency_weight * (1.0 / (1 + EXTRACT(EPOCH FROM (now() - b.created_at)) / 86400 / 30))) AS combined_score
    FROM semantic s
    FULL OUTER JOIN keyword k ON s.id = k.id
    JOIN bookmarks b ON b.id = COALESCE(s.id, k.id)
  )
  SELECT
    b.id,
    b.title,
    b.url,
    b.ai_summary,
    c.combined_score AS score
  FROM combined c
  JOIN bookmarks b ON b.id = c.id
  ORDER BY c.combined_score DESC
  LIMIT p_match_count;
END;
$$;
```

### 6.7 验收标准

| 验收项          | 标准                    | 验证方式    |
| --------------- | ----------------------- | ----------- |
| Tool MCP 标准化 | 100% 迁移完成           | Schema 验证 |
| 意图路由简化    | Planning+Execution 两步 | 代码审查    |
| 混合检索        | 召回率提升 20%          | A/B 测试    |
| Tool 注册表     | 自动发现                | 启动日志    |

---

## 7. Phase 4: 前端数据层升级

### 7.1 目标

- **目标 1**: 迁移到 TanStack Query
- **目标 2**: 实现乐观更新
- **目标 3**: 支持离线访问 (PWA)

### 7.2 TanStack Query 配置

```typescript
// src/lib/query/client.ts

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 分钟
      gcTime: 30 * 60 * 1000, // 30 分钟
      retry: 3,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

```typescript
// src/app/providers.tsx

"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/lib/query/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### 7.3 Query Hooks

```typescript
// src/hooks/queries/use-bookmarks.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookmarkResponse, BookmarkListResponse } from "@/contracts";

// Query Keys
export const bookmarkKeys = {
  all: ["bookmarks"] as const,
  lists: () => [...bookmarkKeys.all, "list"] as const,
  list: (filters: BookmarkFilters) =>
    [...bookmarkKeys.lists(), filters] as const,
  details: () => [...bookmarkKeys.all, "detail"] as const,
  detail: (id: string) => [...bookmarkKeys.details(), id] as const,
};

// 列表查询
export function useBookmarks(filters: BookmarkFilters) {
  return useQuery({
    queryKey: bookmarkKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.set(key, String(value));
      });

      const response = await fetch(`/api/v1/bookmarks?${params}`);
      if (!response.ok) throw new Error("Failed to fetch bookmarks");
      return response.json() as Promise<BookmarkListResponse>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// 详情查询
export function useBookmark(id: string) {
  return useQuery({
    queryKey: bookmarkKeys.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/v1/bookmarks/${id}`);
      if (!response.ok) throw new Error("Failed to fetch bookmark");
      return response.json() as Promise<BookmarkResponse>;
    },
    enabled: !!id,
  });
}

// 创建 Mutation
export function useCreateBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBookmarkRequest) => {
      const response = await fetch("/api/v1/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create bookmark");
      return response.json() as Promise<BookmarkResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
    },
  });
}

// 删除 Mutation (乐观更新)
export function useDeleteBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/v1/bookmarks/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete bookmark");
    },

    // 乐观更新
    onMutate: async (deletedId) => {
      // 取消进行中的请求
      await queryClient.cancelQueries({ queryKey: bookmarkKeys.lists() });

      // 快照当前数据
      const previousLists = queryClient.getQueriesData({
        queryKey: bookmarkKeys.lists(),
      });

      // 乐观更新
      queryClient.setQueriesData(
        { queryKey: bookmarkKeys.lists() },
        (old: BookmarkListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.filter((b) => b.id !== deletedId),
            total: old.total - 1,
          };
        },
      );

      return { previousLists };
    },

    // 错误回滚
    onError: (err, deletedId, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },

    // 完成后重新获取
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
    },
  });
}

// 批量移动 (乐观更新)
export function useBatchMoveBookmarks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ids,
      targetFolderId,
    }: {
      ids: string[];
      targetFolderId: string;
    }) => {
      const response = await fetch("/api/v1/bookmarks/batch-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, targetFolderId }),
      });
      if (!response.ok) throw new Error("Failed to move bookmarks");
    },

    onMutate: async ({ ids, targetFolderId }) => {
      await queryClient.cancelQueries({ queryKey: bookmarkKeys.lists() });

      const previousLists = queryClient.getQueriesData({
        queryKey: bookmarkKeys.lists(),
      });

      // 乐观更新: 移动书签到目标文件夹
      queryClient.setQueriesData(
        { queryKey: bookmarkKeys.lists() },
        (old: BookmarkListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((b) =>
              ids.includes(b.id) ? { ...b, folderId: targetFolderId } : b,
            ),
          };
        },
      );

      return { previousLists };
    },

    onError: (err, vars, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
    },
  });
}
```

### 7.4 无限滚动

```typescript
// src/hooks/queries/use-infinite-bookmarks.ts

import { useInfiniteQuery } from "@tanstack/react-query";
import { BookmarkListResponse } from "@/contracts";

export function useInfiniteBookmarks(filters: Omit<BookmarkFilters, "offset">) {
  return useInfiniteQuery({
    queryKey: [...bookmarkKeys.list(filters), "infinite"],

    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.set(key, String(value));
      });
      params.set("offset", String(pageParam));

      const response = await fetch(`/api/v1/bookmarks?${params}`);
      if (!response.ok) throw new Error("Failed to fetch bookmarks");
      return response.json() as Promise<BookmarkListResponse>;
    },

    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce(
        (sum, page) => sum + page.items.length,
        0,
      );
      if (loadedCount >= lastPage.total) return undefined;
      return loadedCount;
    },

    initialPageParam: 0,
  });
}
```

### 7.5 组件使用示例

```typescript
// src/components/bookmark/bookmark-list.tsx

"use client";

import { useInfiniteBookmarks } from "@/hooks/queries/use-infinite-bookmarks";
import { useDeleteBookmark } from "@/hooks/queries/use-bookmarks";
import { Virtuoso } from "react-virtuoso";
import { toast } from "sonner";

export function BookmarkList({ folderId }: { folderId?: string }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteBookmarks({ folderId, limit: 20 });

  const deleteBookmark = useDeleteBookmark();

  const allBookmarks = data?.pages.flatMap(page => page.items) || [];

  const handleDelete = async (id: string) => {
    try {
      await deleteBookmark.mutateAsync(id);
      toast.success("书签已删除");
    } catch (error) {
      toast.error("删除失败");
    }
  };

  if (isLoading) return <BookmarkListSkeleton />;
  if (error) return <ErrorState error={error} />;
  if (allBookmarks.length === 0) return <EmptyState />;

  return (
    <Virtuoso
      data={allBookmarks}
      endReached={() => hasNextPage && fetchNextPage()}
      itemContent={(index, bookmark) => (
        <BookmarkItem
          key={bookmark.id}
          bookmark={bookmark}
          onDelete={() => handleDelete(bookmark.id)}
        />
      )}
      components={{
        Footer: () => isFetchingNextPage ? <LoadingMore /> : null,
      }}
    />
  );
}
```

### 7.6 PWA 离线支持

```typescript
// src/lib/sw/service-worker.ts

/// <reference lib="webworker" />

const CACHE_NAME = "anykeep-v1";
const API_CACHE_NAME = "anykeep-api-v1";

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// 安装
self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
});

// 激活
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});

// 请求拦截
self.addEventListener("fetch", (event: FetchEvent) => {
  const url = new URL(event.request.url);

  // API 请求: 网络优先，离线回退缓存
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 缓存 GET 请求
          if (event.request.method === "GET" && response.status === 200) {
            const clone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // 静态资源: 缓存优先
  event.respondWith(
    caches
      .match(event.request)
      .then((cached) => cached || fetch(event.request)),
  );
});
```

### 7.7 验收标准

| 验收项              | 标准                      | 验证方式 |
| ------------------- | ------------------------- | -------- |
| TanStack Query 迁移 | 100% Hooks 迁移           | 代码审查 |
| 乐观更新            | 删除/移动操作 < 50ms 响应 | 性能测试 |
| 离线访问            | 核心功能可用              | PWA 测试 |
| 缓存命中            | 重复请求 0 网络           | DevTools |

---

## 8. 数据库迁移计划

### 8.1 迁移时间线

```
Week 1-2 (Phase 1):
├── 20250106_create_system_jobs.sql          # 任务队列表
├── 20250107_add_bookmark_status_enum.sql    # 书签状态枚举
└── 20250108_migrate_browser_bookmarks.sql   # 浏览器书签迁移

Week 3-4 (Phase 2):
├── 20250113_add_job_functions.sql           # 任务处理函数
└── 20250114_configure_job_cron.sql          # Cron 配置

Week 5-6 (Phase 3):
├── 20250120_add_hybrid_search.sql           # 混合搜索
└── 20250121_add_tool_usage_logs.sql         # Tool 使用日志

Week 7-8 (Phase 4):
└── 20250127_cleanup_deprecated.sql          # 清理废弃表/列
```

### 8.2 数据迁移策略

#### 浏览器书签合并

```sql
-- 20250108_migrate_browser_bookmarks.sql

-- 1. 添加 source 列 (如不存在)
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';

-- 2. 迁移数据 (批量)
INSERT INTO bookmarks (
  user_id, url, title, folder_id, source, created_at, updated_at
)
SELECT
  user_id,
  url,
  title,
  NULL,  -- 稍后分配文件夹
  'browser',
  created_at,
  updated_at
FROM browser_bookmarks
ON CONFLICT (user_id, url) DO NOTHING;

-- 3. 标记迁移状态
UPDATE browser_bookmarks SET migrated = true WHERE migrated IS NULL;

-- 4. (稍后) 删除旧表
-- DROP TABLE browser_bookmarks;  -- 在验证无误后执行
```

### 8.3 回滚策略

每个迁移都应包含回滚脚本:

```sql
-- 回滚示例
-- rollback_20250108_migrate_browser_bookmarks.sql

-- 1. 删除迁移的数据
DELETE FROM bookmarks WHERE source = 'browser';

-- 2. 移除列
ALTER TABLE bookmarks DROP COLUMN IF EXISTS source;

-- 3. 恢复标记
UPDATE browser_bookmarks SET migrated = NULL;
```

---

## 9. 风险与缓解策略

### 9.1 风险矩阵

| 风险           | 可能性 | 影响 | 缓解策略                             |
| -------------- | ------ | ---- | ------------------------------------ |
| API 兼容性破坏 | 高     | 高   | 版本化 API (/v1/)，保持旧端点 3 个月 |
| 数据迁移丢失   | 中     | 高   | 迁移前全量备份，分批执行             |
| 性能回归       | 中     | 中   | 每阶段基准测试，A/B 对比             |
| 团队学习曲线   | 中     | 中   | 培训文档，代码示例，Pair Programming |
| AI 中断        | 低     | 高   | 队列持久化，自动重试，降级模式       |

### 9.2 回滚计划

每个 Phase 完成后保留 2 周观察期:

1. **代码回滚**: Git revert 到上一个稳定版本
2. **数据回滚**: 执行对应的回滚 SQL 脚本
3. **配置回滚**: Feature Flag 切换到旧行为

### 9.3 监控指标

| 指标             | 阈值       | 告警        |
| ---------------- | ---------- | ----------- |
| API 响应时间 P99 | < 500ms    | > 1s 触发   |
| 错误率           | < 0.1%     | > 1% 触发   |
| 任务队列积压     | < 1000     | > 5000 触发 |
| AI Token 使用    | < 100k/day | > 200k 触发 |

---

## 10. 验收标准

### 10.1 整体验收

| Phase   | 验收标准                                 | 负责人        | 截止日期 |
| ------- | ---------------------------------------- | ------------- | -------- |
| Phase 1 | API Route < 50 行，IngestionService 统一 | Backend Lead  | +4 周    |
| Phase 2 | AI 异步化 100%，队列重试正常             | Backend Lead  | +7 周    |
| Phase 3 | Tool MCP 化，混合搜索上线                | AI Lead       | +11 周   |
| Phase 4 | TanStack Query 迁移，PWA 离线            | Frontend Lead | +14 周   |

### 10.2 技术验收清单

- [ ] 所有单元测试通过 (≥ 90% 覆盖率)
- [ ] 集成测试通过
- [ ] 性能基准测试无回归
- [ ] 安全扫描无高危漏洞
- [ ] 文档更新完成
- [ ] 代码审查通过

### 10.3 业务验收清单

- [ ] 核心功能正常 (收藏、搜索、AI 问答)
- [ ] 批量导入正常 (1000 条 < 10s)
- [ ] 移动端兼容性验证
- [ ] 用户反馈收集 (Beta 测试)

---

## 附录

### A. 参考文档

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [TanStack Query Documentation](https://tanstack.com/query)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

### B. 术语表

| 术语                  | 定义                                     |
| --------------------- | ---------------------------------------- |
| **Ingestion**         | 数据摄入，将外部数据导入系统的过程       |
| **MCP**               | Model Context Protocol，AI 工具标准接口  |
| **RRF**               | Reciprocal Rank Fusion，检索结果融合算法 |
| **Optimistic Update** | 乐观更新，UI 先更新后请求的策略          |
| **Service Layer**     | 服务层，封装业务逻辑的架构层             |

### C. 变更日志

| 版本  | 日期       | 变更     |
| ----- | ---------- | -------- |
| 1.0.0 | 2025-12-29 | 初始版本 |

---

_本文档由 Winston (System Architect) 编写_
_如有问题请联系架构团队_
