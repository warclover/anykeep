# AI 摘要服务架构升级实施方案 V2.0

> **文档版本**: 2.0
> **创建日期**: 2025-12-12
> **最后更新**: 2025-12-12
> **状态**: ✅ 已完成 (P0-P7)
> **架构师**: Winston (AI Architect)

## 实施进度

| 阶段                        | 状态    | 完成日期   | 测试覆盖 |
| --------------------------- | ------- | ---------- | -------- |
| P0 模块拆分 + 四层架构      | ✅ 完成 | 2025-12-12 | 76 tests |
| P1 DeepSeek Provider        | ✅ 完成 | 2025-12-12 | 76 tests |
| P2 阿里百炼云 Provider      | ✅ 完成 | 2025-12-12 | 76 tests |
| P3 EventBus + JobQueue 集成 | ✅ 完成 | 2025-12-12 | 76 tests |
| P4 SummaryConfigService     | ✅ 完成 | 2025-12-12 | 85 tests |
| P5 QualityTrackerService    | ✅ 完成 | 2025-12-12 | 85 tests |
| P5.5 用户反馈 API           | ✅ 完成 | 2025-12-12 | 85 tests |
| P5.6 质量统计 API           | ✅ 完成 | 2025-12-12 | 85 tests |
| P6 摘要 API 层              | ✅ 完成 | 2025-12-12 | 97 tests |
| P7 事件集成测试             | ✅ 完成 | 2025-12-12 | 97 tests |

**总测试覆盖**: 97 个测试，2 个测试套件，全部通过

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [架构设计](#2-架构设计)
3. [文件结构](#3-文件结构)
4. [接口定义](#4-接口定义)
5. [Provider 设计](#5-provider-设计)
6. [迁移策略](#6-迁移策略)
7. [分阶段交付计划](#7-分阶段交付计划)
8. [风险与缓解](#8-风险与缓解)

---

## 1. 执行摘要

### 1.1 升级目标

| 维度         | 当前状态         | 目标状态              |
| ------------ | ---------------- | --------------------- |
| **质量**     | 单一模型，无回退 | 多模型支持 + 智能路由 |
| **性能**     | 同步阻塞调用     | 异步队列 + 批量处理   |
| **用户体验** | 等待 3-8 秒      | 即时响应 + 流式更新   |
| **解耦程度** | 与分类强耦合     | 事件驱动完全解耦      |
| **可观测性** | 无质量追踪       | 完整监控 + 用户反馈   |

### 1.2 核心原则

```
┌─────────────────────────────────────────────────────────────────┐
│                      核心设计原则                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ 复用 > 重建：复用现有 EventBus、JobQueue、ConfigCenter      │
│  ✅ 遵循现有模式：四层架构（API → 服务 → Provider → 仓库）       │
│  ✅ 事件驱动解耦：通过 summary:completed 事件触发下游            │
│  ✅ 渐进式升级：V1 → V2 平滑过渡，支持灰度发布                   │
│  ✅ 多模型支持：DeepSeek 为主，阿里百炼云为备                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 预期工作量

| 阶段 | 任务                          | 工作量 | 累计       |
| ---- | ----------------------------- | ------ | ---------- |
| P0   | 模块拆分 + 四层架构           | 2-3 天 | 2-3 天     |
| P1   | Provider 接口 + DeepSeek 迁移 | 1 天   | 3-4 天     |
| P2   | 阿里百炼云 Provider           | 1 天   | 4-5 天     |
| P3   | EventBus + JobQueue 接入      | 0.5 天 | 4.5-5.5 天 |
| P4   | 配置中心扩展                  | 0.5 天 | 5-6 天     |
| P5   | 质量追踪系统                  | 2 天   | 7-8 天     |

---

## 2. 架构设计

### 2.1 目标架构图

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     AnyKeep 统一智能引擎 (V4.2+)                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      共享基础设施层 (已有)                              │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │  EventBus   │  │ JobQueue    │  │ ConfigCenter │  │ ServiceFactory│ │ │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  └──────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              ▲                                              │
│           ┌──────────────────┼──────────────────┐                           │
│           │                  │                  │                           │
│   ┌───────┴───────┐  ┌───────┴───────┐  ┌───────┴───────┐                  │
│   │  摘要服务      │  │  分类服务      │  │  自组织服务    │                  │
│   │  (V2.0 升级)   │  │  (V4.2 ✅)    │  │  (V4.2 ✅)    │                  │
│   │               │  │               │  │               │                  │
│   │ ┌───────────┐ │  │               │  │               │                  │
│   │ │Provider层 │ │  │               │  │               │                  │
│   │ │┌─────────┐│ │  │               │  │               │                  │
│   │ ││DeepSeek ││ │  │               │  │               │                  │
│   │ │├─────────┤│ │  │               │  │               │                  │
│   │ ││百炼云   ││ │  │               │  │               │                  │
│   │ │├─────────┤│ │  │               │  │               │                  │
│   │ ││Ollama   ││ │  │               │  │               │                  │
│   │ │└─────────┘│ │  │               │  │               │                  │
│   │ └───────────┘ │  │               │  │               │                  │
│   └───────┬───────┘  └───────────────┘  └───────────────┘                  │
│           │                                                                 │
│           │  summary:completed                                              │
│           └─────────────────────────► SystemCoordinator                     │
│                                              │                              │
│                                              ▼                              │
│                                    classification:bookmark_classified        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 四层架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                         API 层                                   │
│  src/app/api/summary/                                           │
│  - 请求验证、权限检查                                            │
│  - 调用服务层，返回响应                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        服务层                                    │
│  src/lib/summary/services/                                      │
│  - SummaryService: 核心业务逻辑                                  │
│  - ContentFetcherService: 内容提取                               │
│  - QualityTrackerService: 质量追踪                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Provider 层                                │
│  src/lib/summary/providers/                                     │
│  - ISummaryProvider: 统一接口                                    │
│  - DeepSeekProvider: DeepSeek 实现                               │
│  - AliyunBailianProvider: 阿里百炼云实现                          │
│  - OllamaProvider: 本地模型实现（未来）                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        仓库层                                    │
│  src/lib/summary/repositories/                                  │
│  - SummaryRepository: 摘要数据访问                               │
│  - QualityLogRepository: 质量日志访问                            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 事件流设计

```
时序图：摘要生成 → 分类 → 画像更新

┌──────┐    ┌───────────┐    ┌─────────┐    ┌──────────────┐    ┌────────┐
│ API  │    │ Summary   │    │ Event   │    │ Classification│   │ Profile│
│      │    │ Service   │    │ Bus     │    │ Service       │   │ Service│
└──┬───┘    └─────┬─────┘    └────┬────┘    └──────┬────────┘   └────┬───┘
   │              │               │                │                 │
   │ 1. POST      │               │                │                 │
   │─────────────>│               │                │                 │
   │              │               │                │                 │
   │ 2. 异步处理   │               │                │                 │
   │<─ ─ ─ ─ ─ ─ ─│               │                │                 │
   │   (立即返回)  │               │                │                 │
   │              │               │                │                 │
   │              │ 3. 生成摘要    │                │                 │
   │              │───────────────│                │                 │
   │              │               │                │                 │
   │              │ 4. summary:   │                │                 │
   │              │    completed  │                │                 │
   │              │──────────────>│                │                 │
   │              │               │                │                 │
   │              │               │ 5. 触发分类     │                 │
   │              │               │───────────────>│                 │
   │              │               │                │                 │
   │              │               │                │ 6. 分类完成      │
   │              │               │<───────────────│                 │
   │              │               │                │                 │
   │              │               │ 7. 更新画像    │                 │
   │              │               │────────────────────────────────>│
   │              │               │                │                 │
```

---

## 3. 文件结构

### 3.1 新增文件结构

```
src/lib/summary/                          # 摘要服务模块（新建）
├── index.ts                              # 统一导出
├── summary.types.ts                      # 类型定义
├── summary.config.ts                     # 配置（扩展 ConfigCenter）
│
├── providers/                            # Provider 层
│   ├── index.ts                          # Provider 导出
│   ├── provider.interface.ts             # 统一接口定义
│   ├── provider.factory.ts               # Provider 工厂
│   ├── deepseek.provider.ts              # DeepSeek 实现
│   ├── aliyun-bailian.provider.ts        # 阿里百炼云实现
│   └── ollama.provider.ts                # Ollama 本地模型（未来）
│
├── services/                             # 服务层
│   ├── index.ts                          # 服务导出
│   ├── summary.service.ts                # 核心摘要生成服务
│   ├── content-fetcher.service.ts        # 内容提取服务
│   ├── quality-tracker.service.ts        # 质量追踪服务
│   └── summary-factory.ts                # 服务工厂
│
├── repositories/                         # 仓库层
│   ├── index.ts                          # 仓库导出
│   ├── summary.repository.ts             # 摘要数据访问
│   └── quality-log.repository.ts         # 质量日志访问
│
├── prompts/                              # Prompt 模板（从现有迁移）
│   ├── index.ts                          # Prompt 导出
│   ├── article.prompt.ts                 # 文章类型
│   ├── tutorial.prompt.ts                # 教程类型
│   ├── video.prompt.ts                   # 视频类型
│   └── tool.prompt.ts                    # 工具类型
│
└── __tests__/                            # 测试
    ├── summary.service.test.ts
    ├── providers.test.ts
    └── quality-tracker.test.ts

src/app/api/summary/                      # API 路由（新建）
├── route.ts                              # POST: 创建摘要
├── [id]/
│   └── route.ts                          # GET: 获取摘要详情
├── batch/
│   └── route.ts                          # POST: 批量创建
└── regenerate/
    └── route.ts                          # POST: 重新生成
```

### 3.2 需修改的现有文件

| 文件路径                                             | 修改类型 | 说明                                  |
| ---------------------------------------------------- | -------- | ------------------------------------- |
| `src/lib/utils/ai-generator.ts`                      | 重构     | 拆分到 summary 模块，保留向后兼容导出 |
| `src/lib/classification/prompts/`                    | 迁移     | 移动到 `summary/prompts/`             |
| `src/lib/classification/config/ai-summary-config.ts` | 扩展     | 添加多 Provider 配置                  |
| `src/app/api/bookmarks/route.ts`                     | 修改     | 调用新的 SummaryService               |
| `src/lib/shared/event-bus/event-types.ts`            | 扩展     | 添加 Provider 相关事件                |

### 3.3 数据库变更

```sql
-- 新增：质量追踪表
CREATE TABLE summary_quality_logs (
  id BIGSERIAL PRIMARY KEY,
  bookmark_id BIGINT REFERENCES bookmarks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 输入追踪
  content_length INTEGER,
  content_type TEXT,                    -- article, tutorial, video, tool

  -- Provider 追踪
  provider_used TEXT NOT NULL,          -- deepseek, aliyun-bailian, ollama
  model_used TEXT NOT NULL,             -- deepseek-chat, qwen-turbo, etc.
  prompt_version TEXT,                  -- v1, v2

  -- 输出追踪
  summary_length INTEGER,
  tags_count INTEGER,
  latency_ms INTEGER,
  tokens_input INTEGER,
  tokens_output INTEGER,

  -- 质量评估
  auto_quality_score DECIMAL(3,2),      -- 自动评分 0-1
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  user_feedback TEXT,

  -- 错误追踪
  error_code TEXT,
  error_message TEXT,
  fallback_used BOOLEAN DEFAULT FALSE,

  -- 审计
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_summary_quality_logs_user_id ON summary_quality_logs(user_id);
CREATE INDEX idx_summary_quality_logs_provider ON summary_quality_logs(provider_used);
CREATE INDEX idx_summary_quality_logs_created_at ON summary_quality_logs(created_at);

-- RLS 策略
ALTER TABLE summary_quality_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quality logs"
  ON summary_quality_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert quality logs"
  ON summary_quality_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

---

## 4. 接口定义

### 4.1 Provider 接口

```typescript
// src/lib/summary/providers/provider.interface.ts

/**
 * 摘要生成结果
 */
export interface SummaryResult {
  /** 摘要文本（V1）或 JSON 字符串（V2） */
  summary: string;
  /** 生成的标签 */
  tags: string[];
  /** 摘要版本 */
  version: 1 | 2;
  /** 结构化摘要（仅 V2） */
  structured?: StructuredSummary;
  /** Token 使用量 */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** 处理耗时 (ms) */
  latencyMs: number;
}

/**
 * 摘要生成输入
 */
export interface SummaryInput {
  /** 书签 ID */
  bookmarkId: number;
  /** 用户 ID */
  userId: string;
  /** 标题 */
  title: string;
  /** URL */
  url?: string;
  /** 描述 */
  description?: string;
  /** 正文内容 */
  content?: string;
  /** 内容类型 */
  contentType?: ContentType;
  /** 现有文件夹名称（用于标签参考） */
  existingFolderNames?: string[];
}

/**
 * Provider 配置
 */
export interface ProviderConfig {
  /** API 密钥 */
  apiKey: string;
  /** API 基础 URL */
  baseUrl: string;
  /** 模型名称 */
  model: string;
  /** 超时时间 (ms) */
  timeoutMs: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 温度参数 */
  temperature: number;
  /** 最大输出 token */
  maxTokens: number;
}

/**
 * Provider 健康状态
 */
export interface ProviderHealth {
  /** 是否可用 */
  available: boolean;
  /** 延迟 (ms) */
  latencyMs?: number;
  /** 错误信息 */
  error?: string;
  /** 检查时间 */
  checkedAt: string;
}

/**
 * 摘要 Provider 接口
 * 所有 AI Provider 必须实现此接口
 */
export interface ISummaryProvider {
  /** Provider 名称 */
  readonly name: string;

  /** Provider 优先级（数字越小越优先） */
  readonly priority: number;

  /**
   * 生成摘要
   * @param input 摘要输入
   * @returns 摘要结果
   */
  generateSummary(input: SummaryInput): Promise<SummaryResult>;

  /**
   * 健康检查
   * @returns 健康状态
   */
  healthCheck(): Promise<ProviderHealth>;

  /**
   * 估算成本
   * @param tokenCount Token 数量
   * @returns 成本（分）
   */
  estimateCost(tokenCount: number): number;

  /**
   * 获取配置
   * @returns Provider 配置
   */
  getConfig(): ProviderConfig;

  /**
   * 是否支持流式输出
   */
  supportsStreaming(): boolean;

  /**
   * 流式生成摘要（可选）
   * @param input 摘要输入
   * @returns AsyncGenerator
   */
  generateSummaryStream?(
    input: SummaryInput,
  ): AsyncGenerator<string, SummaryResult, unknown>;
}
```

### 4.2 服务接口

```typescript
// src/lib/summary/services/summary.service.ts

import type {
  ISummaryProvider,
  SummaryInput,
  SummaryResult,
} from "../providers";
import { eventBus } from "@/lib/shared/event-bus";
import type { SummaryCompletedEvent } from "@/lib/shared/event-bus/event-types";

/**
 * 摘要服务配置
 */
export interface SummaryServiceConfig {
  /** 是否启用回退 */
  enableFallback: boolean;
  /** 最大重试次数 */
  maxRetries: number;
  /** 是否发布事件 */
  emitEvents: boolean;
  /** 是否追踪质量 */
  trackQuality: boolean;
  /** 输出版本 */
  outputVersion: 1 | 2;
}

/**
 * 摘要生成选项
 */
export interface GenerateOptions {
  /** 强制使用指定 Provider */
  forceProvider?: string;
  /** 是否需要分类 */
  needsClassification?: boolean;
  /** 跳过质量追踪 */
  skipQualityTracking?: boolean;
}

/**
 * 摘要服务接口
 */
export interface ISummaryService {
  /**
   * 生成摘要
   * @param input 摘要输入
   * @param options 生成选项
   * @returns 摘要结果
   */
  generate(
    input: SummaryInput,
    options?: GenerateOptions,
  ): Promise<SummaryResult>;

  /**
   * 批量生成摘要
   * @param inputs 摘要输入数组
   * @param options 生成选项
   * @returns 摘要结果数组
   */
  generateBatch(
    inputs: SummaryInput[],
    options?: GenerateOptions,
  ): Promise<Array<SummaryResult | Error>>;

  /**
   * 重新生成摘要
   * @param bookmarkId 书签 ID
   * @param options 生成选项
   * @returns 摘要结果
   */
  regenerate(
    bookmarkId: number,
    options?: GenerateOptions,
  ): Promise<SummaryResult>;

  /**
   * 获取所有 Provider 健康状态
   * @returns Provider 健康状态映射
   */
  getProvidersHealth(): Promise<Map<string, ProviderHealth>>;

  /**
   * 获取服务统计
   * @returns 服务统计
   */
  getStats(): Promise<SummaryServiceStats>;
}

/**
 * 服务统计
 */
export interface SummaryServiceStats {
  totalGenerated: number;
  successRate: number;
  averageLatencyMs: number;
  providerUsage: Record<string, number>;
  fallbackRate: number;
}
```

### 4.3 仓库接口

```typescript
// src/lib/summary/repositories/summary.repository.ts

import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * 摘要仓库接口
 */
export interface ISummaryRepository {
  /**
   * 更新书签摘要
   */
  updateBookmarkSummary(
    bookmarkId: number,
    summary: string,
    tags: string[],
  ): Promise<void>;

  /**
   * 获取书签摘要
   */
  getBookmarkSummary(bookmarkId: number): Promise<{
    summary: string | null;
    tags: string[];
  }>;

  /**
   * 批量更新摘要
   */
  batchUpdateSummaries(
    updates: Array<{
      bookmarkId: number;
      summary: string;
      tags: string[];
    }>,
  ): Promise<void>;
}

/**
 * 质量日志仓库接口
 */
export interface IQualityLogRepository {
  /**
   * 记录质量日志
   */
  logQuality(log: QualityLogEntry): Promise<void>;

  /**
   * 获取质量统计
   */
  getQualityStats(
    userId: string,
    timeRange?: { start: Date; end: Date },
  ): Promise<QualityStats>;

  /**
   * 记录用户反馈
   */
  recordUserFeedback(
    bookmarkId: number,
    rating: number,
    feedback?: string,
  ): Promise<void>;
}

/**
 * 质量日志条目
 */
export interface QualityLogEntry {
  bookmarkId: number;
  userId: string;
  contentLength: number;
  contentType: string;
  providerUsed: string;
  modelUsed: string;
  promptVersion: string;
  summaryLength: number;
  tagsCount: number;
  latencyMs: number;
  tokensInput: number;
  tokensOutput: number;
  autoQualityScore?: number;
  errorCode?: string;
  errorMessage?: string;
  fallbackUsed: boolean;
}
```

---

## 5. Provider 设计

### 5.1 DeepSeek Provider

```typescript
// src/lib/summary/providers/deepseek.provider.ts

import type {
  ISummaryProvider,
  SummaryInput,
  SummaryResult,
  ProviderConfig,
  ProviderHealth,
} from "./provider.interface";
import { logger } from "@/lib/logger";

/**
 * DeepSeek Provider 配置
 */
const DEFAULT_CONFIG: ProviderConfig = {
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  timeoutMs: 30000,
  maxRetries: 2,
  temperature: 0.7,
  maxTokens: 2000,
};

/**
 * DeepSeek Provider 实现
 */
export class DeepSeekProvider implements ISummaryProvider {
  readonly name = "deepseek";
  readonly priority = 1; // 最高优先级

  private config: ProviderConfig;

  constructor(config?: Partial<ProviderConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async generateSummary(input: SummaryInput): Promise<SummaryResult> {
    const startTime = Date.now();

    try {
      const { systemPrompt, userPrompt, temperature } =
        this.buildPrompts(input);

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_tokens: this.config.maxTokens,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DeepSeek API error: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("DeepSeek API returned empty content");
      }

      const parsed = this.parseResponse(content);

      return {
        ...parsed,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "DeepSeekProvider: generateSummary failed",
      );
      throw error;
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      return {
        available: response.ok,
        latencyMs: Date.now() - startTime,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : "Unknown error",
        checkedAt: new Date().toISOString(),
      };
    }
  }

  estimateCost(tokenCount: number): number {
    // DeepSeek 定价：约 ¥0.001/1K tokens
    return Math.ceil((tokenCount / 1000) * 0.1);
  }

  getConfig(): ProviderConfig {
    return { ...this.config, apiKey: "***" }; // 隐藏 API Key
  }

  supportsStreaming(): boolean {
    return true;
  }

  private buildPrompts(input: SummaryInput): {
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
  } {
    // 从现有 prompts 模块获取
    // TODO: 迁移 getPromptConfigV2 和 buildTypeSpecificPromptV2
    return {
      systemPrompt: "...",
      userPrompt: "...",
      temperature: this.config.temperature,
    };
  }

  private parseResponse(content: string): {
    summary: string;
    tags: string[];
    version: 1 | 2;
    structured?: StructuredSummary;
  } {
    // 从现有 ai-generator 迁移解析逻辑
    // TODO: 迁移 parseAIResponseV2
    return {
      summary: content,
      tags: [],
      version: 2,
    };
  }
}
```

### 5.2 阿里百炼云 Provider

````typescript
// src/lib/summary/providers/aliyun-bailian.provider.ts

import type {
  ISummaryProvider,
  SummaryInput,
  SummaryResult,
  ProviderConfig,
  ProviderHealth,
} from "./provider.interface";
import { logger } from "@/lib/logger";

/**
 * 阿里百炼云 Provider 配置
 *
 * 关键信息：
 * - 支持 OpenAI 兼容接口
 * - BASE_URL: https://dashscope.aliyuncs.com/compatible-mode/v1
 * - 支持模型: qwen-turbo, qwen-plus, qwen-max
 * - 环境变量: DASHSCOPE_API_KEY
 *
 * @see https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope
 */
const DEFAULT_CONFIG: ProviderConfig = {
  apiKey: process.env.DASHSCOPE_API_KEY || "",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  model: "qwen-turbo", // 默认使用 turbo，性价比最高
  timeoutMs: 30000,
  maxRetries: 2,
  temperature: 0.7,
  maxTokens: 2000,
};

/**
 * 阿里百炼云支持的模型
 */
export const ALIYUN_MODELS = {
  /** 通义千问 Turbo - 速度快，成本低 */
  QWEN_TURBO: "qwen-turbo",
  /** 通义千问 Plus - 平衡性能 */
  QWEN_PLUS: "qwen-plus",
  /** 通义千问 Max - 最强性能 */
  QWEN_MAX: "qwen-max",
  /** 通义千问 Long - 长上下文 */
  QWEN_LONG: "qwen-long",
} as const;

/**
 * 模型定价（每 1K tokens，单位：分）
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "qwen-turbo": { input: 0.3, output: 0.6 },
  "qwen-plus": { input: 0.8, output: 2 },
  "qwen-max": { input: 2, output: 6 },
  "qwen-long": { input: 0.5, output: 2 },
};

/**
 * 阿里百炼云 Provider 实现
 *
 * 特点：
 * - 使用 OpenAI 兼容接口，代码复用度高
 * - 支持通义千问全系列模型
 * - 国内网络访问稳定
 * - 可作为 DeepSeek 的备选方案
 */
export class AliyunBailianProvider implements ISummaryProvider {
  readonly name = "aliyun-bailian";
  readonly priority = 2; // 次优先级，作为 fallback

  private config: ProviderConfig;

  constructor(config?: Partial<ProviderConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async generateSummary(input: SummaryInput): Promise<SummaryResult> {
    const startTime = Date.now();

    try {
      const { systemPrompt, userPrompt, temperature } =
        this.buildPrompts(input);

      // 使用 OpenAI 兼容接口
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_tokens: this.config.maxTokens,
          // 阿里百炼特有参数
          stream: false,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;

        // 处理特定错误
        if (response.status === 401) {
          throw new Error("阿里百炼云 API Key 无效或未配置");
        }
        if (response.status === 429) {
          throw new Error("阿里百炼云 API 请求频率超限");
        }

        throw new Error(
          `阿里百炼云 API 错误: ${response.status} - ${errorMessage}`,
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("阿里百炼云 API 返回空内容");
      }

      const parsed = this.parseResponse(content);

      return {
        ...parsed,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          provider: this.name,
          model: this.config.model,
        },
        "AliyunBailianProvider: generateSummary failed",
      );
      throw error;
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      // 使用简单请求测试连通性
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      return {
        available: response.ok,
        latencyMs: Date.now() - startTime,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : "Unknown error",
        checkedAt: new Date().toISOString(),
      };
    }
  }

  estimateCost(tokenCount: number): number {
    const pricing =
      MODEL_PRICING[this.config.model] || MODEL_PRICING["qwen-turbo"];
    // 假设输入输出 1:1 比例
    const inputCost = (tokenCount / 2 / 1000) * pricing.input;
    const outputCost = (tokenCount / 2 / 1000) * pricing.output;
    return Math.ceil(inputCost + outputCost);
  }

  getConfig(): ProviderConfig {
    return { ...this.config, apiKey: "***" }; // 隐藏 API Key
  }

  supportsStreaming(): boolean {
    return true; // 阿里百炼云支持流式输出
  }

  /**
   * 流式生成摘要
   */
  async *generateSummaryStream(
    input: SummaryInput,
  ): AsyncGenerator<string, SummaryResult, unknown> {
    const startTime = Date.now();
    const { systemPrompt, userPrompt, temperature } = this.buildPrompts(input);

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
        max_tokens: this.config.maxTokens,
        stream: true, // 启用流式
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let usage = { inputTokens: 0, outputTokens: 0 };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk
          .split("\n")
          .filter((line) => line.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6); // Remove 'data: '
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || "";
            if (content) {
              fullContent += content;
              yield content;
            }

            // 更新 usage（最后一个 chunk 包含）
            if (parsed.usage) {
              usage = {
                inputTokens: parsed.usage.prompt_tokens || 0,
                outputTokens: parsed.usage.completion_tokens || 0,
              };
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const result = this.parseResponse(fullContent);

    return {
      ...result,
      usage,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * 切换模型
   * 用于智能路由场景
   */
  switchModel(model: string): void {
    if (Object.values(ALIYUN_MODELS).includes(model as any)) {
      this.config.model = model;
    } else {
      logger.warn(
        { model },
        "AliyunBailianProvider: Unknown model, using default",
      );
    }
  }

  private buildPrompts(input: SummaryInput): {
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
  } {
    // 复用与 DeepSeek 相同的 Prompt 逻辑
    // 阿里百炼云对中文支持更好，可以使用更简洁的 Prompt
    return {
      systemPrompt:
        "你是一个专业的内容摘要助手。请根据用户提供的内容，生成简洁准确的摘要和相关标签。",
      userPrompt: this.buildUserPrompt(input),
      temperature: this.config.temperature,
    };
  }

  private buildUserPrompt(input: SummaryInput): string {
    const parts: string[] = [];

    parts.push(`标题: ${input.title}`);

    if (input.url) {
      parts.push(`URL: ${input.url}`);
    }

    if (input.description) {
      parts.push(`描述: ${input.description}`);
    }

    if (input.content) {
      // 截断过长内容
      const truncated =
        input.content.length > 10000
          ? input.content.slice(0, 10000) + "...[内容已截断]"
          : input.content;
      parts.push(`正文: ${truncated}`);
    }

    parts.push("");
    parts.push("请输出 JSON 格式：");
    parts.push("```json");
    parts.push("{");
    parts.push('  "tldr": "一句话总结",');
    parts.push('  "key_points": ["要点1", "要点2", "要点3"],');
    parts.push(
      '  "keywords": ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5"],',
    );
    parts.push('  "sentiment": "positive/neutral/negative",');
    parts.push('  "reading_time": 5');
    parts.push("}");
    parts.push("```");

    return parts.join("\n");
  }

  private parseResponse(content: string): {
    summary: string;
    tags: string[];
    version: 1 | 2;
    structured?: StructuredSummary;
  } {
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;

      const parsed = JSON.parse(jsonStr);

      return {
        summary: JSON.stringify(parsed),
        tags: parsed.keywords || [],
        version: 2,
        structured: {
          tldr: parsed.tldr || "",
          keyPoints: parsed.key_points || [],
          keywords: parsed.keywords || [],
          sentiment: parsed.sentiment || "neutral",
          readingTime: parsed.reading_time || 0,
          actionItems: parsed.action_items || [],
        },
      };
    } catch {
      // JSON 解析失败，返回纯文本
      return {
        summary: content,
        tags: [],
        version: 1,
      };
    }
  }
}
````

### 5.3 Provider 工厂

```typescript
// src/lib/summary/providers/provider.factory.ts

import type { ISummaryProvider, ProviderHealth } from "./provider.interface";
import { DeepSeekProvider } from "./deepseek.provider";
import { AliyunBailianProvider } from "./aliyun-bailian.provider";
import { logger } from "@/lib/logger";

/**
 * Provider 工厂配置
 */
export interface ProviderFactoryConfig {
  /** 启用的 Provider 列表 */
  enabledProviders: string[];
  /** 是否启用回退 */
  enableFallback: boolean;
  /** 健康检查间隔 (ms) */
  healthCheckIntervalMs: number;
}

const DEFAULT_CONFIG: ProviderFactoryConfig = {
  enabledProviders: ["deepseek", "aliyun-bailian"],
  enableFallback: true,
  healthCheckIntervalMs: 60000, // 1 分钟
};

/**
 * Provider 工厂
 * 管理所有 Provider 实例，支持健康检查和智能路由
 */
export class ProviderFactory {
  private providers: Map<string, ISummaryProvider> = new Map();
  private healthCache: Map<string, ProviderHealth> = new Map();
  private config: ProviderFactoryConfig;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ProviderFactoryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeProviders();
  }

  /**
   * 初始化所有启用的 Provider
   */
  private initializeProviders(): void {
    for (const name of this.config.enabledProviders) {
      const provider = this.createProvider(name);
      if (provider) {
        this.providers.set(name, provider);
      }
    }

    // 启动健康检查
    if (this.config.healthCheckIntervalMs > 0) {
      this.startHealthCheck();
    }
  }

  /**
   * 创建 Provider 实例
   */
  private createProvider(name: string): ISummaryProvider | null {
    switch (name) {
      case "deepseek":
        if (!process.env.DEEPSEEK_API_KEY) {
          logger.warn("DeepSeek API Key not configured, skipping");
          return null;
        }
        return new DeepSeekProvider();

      case "aliyun-bailian":
        if (!process.env.DASHSCOPE_API_KEY) {
          logger.warn("DashScope API Key not configured, skipping");
          return null;
        }
        return new AliyunBailianProvider();

      default:
        logger.warn({ name }, "Unknown provider");
        return null;
    }
  }

  /**
   * 获取可用的 Provider
   * 按优先级排序，跳过不健康的 Provider
   */
  async getAvailableProvider(): Promise<ISummaryProvider> {
    // 按优先级排序
    const sortedProviders = Array.from(this.providers.values()).sort(
      (a, b) => a.priority - b.priority,
    );

    for (const provider of sortedProviders) {
      const health = this.healthCache.get(provider.name);

      // 如果缓存中健康状态可用，直接返回
      if (health?.available) {
        return provider;
      }

      // 如果没有缓存或缓存过期，实时检查
      if (!health || this.isHealthCacheExpired(health)) {
        const newHealth = await provider.healthCheck();
        this.healthCache.set(provider.name, newHealth);

        if (newHealth.available) {
          return provider;
        }
      }
    }

    throw new Error("No available provider");
  }

  /**
   * 获取指定 Provider
   */
  getProvider(name: string): ISummaryProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * 获取所有 Provider 健康状态
   */
  async getAllHealth(): Promise<Map<string, ProviderHealth>> {
    const results = new Map<string, ProviderHealth>();

    for (const [name, provider] of this.providers) {
      const health = await provider.healthCheck();
      this.healthCache.set(name, health);
      results.set(name, health);
    }

    return results;
  }

  /**
   * 启动定期健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      for (const [name, provider] of this.providers) {
        try {
          const health = await provider.healthCheck();
          this.healthCache.set(name, health);
        } catch (error) {
          logger.error({ name, error }, "Health check failed");
        }
      }
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * 停止健康检查
   */
  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  private isHealthCacheExpired(health: ProviderHealth): boolean {
    const checkedAt = new Date(health.checkedAt).getTime();
    const now = Date.now();
    return now - checkedAt > this.config.healthCheckIntervalMs;
  }
}

// 全局单例
let globalFactory: ProviderFactory | null = null;

export function getProviderFactory(): ProviderFactory {
  if (!globalFactory) {
    globalFactory = new ProviderFactory();
  }
  return globalFactory;
}

export function resetProviderFactory(): void {
  if (globalFactory) {
    globalFactory.stopHealthCheck();
    globalFactory = null;
  }
}
```

---

## 6. 迁移策略

### 6.1 迁移原则

```
┌─────────────────────────────────────────────────────────────────┐
│                      迁移原则                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 向后兼容：保留原有导出，避免破坏现有调用                      │
│  2. 渐进式迁移：先新建模块，再逐步切换调用方                      │
│  3. 特性开关：通过环境变量控制新旧实现切换                        │
│  4. 回滚能力：任何时候都能快速切回旧实现                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 迁移步骤

#### Step 1: 创建新模块（不影响现有代码）

```bash
# 创建目录结构
mkdir -p src/lib/summary/{providers,services,repositories,prompts,__tests__}

# 创建基础文件
touch src/lib/summary/index.ts
touch src/lib/summary/summary.types.ts
touch src/lib/summary/summary.config.ts
```

#### Step 2: 迁移 Prompt 模板

```typescript
// src/lib/summary/prompts/index.ts
// 重新导出现有 prompts，保持兼容

export {
  getPromptConfig,
  buildTypeSpecificPrompt,
  getPromptConfigV2,
  buildTypeSpecificPromptV2,
} from "@/lib/classification/prompts";

// 未来：逐步迁移到本模块
// export * from './article.prompt';
// export * from './tutorial.prompt';
```

#### Step 3: 实现 Provider 层

```typescript
// 按照 5.1-5.3 的设计实现
// 先实现 DeepSeek Provider
// 再实现阿里百炼云 Provider
```

#### Step 4: 实现服务层

```typescript
// src/lib/summary/services/summary.service.ts
// 核心服务实现

import { ProviderFactory, getProviderFactory } from "../providers";
import { eventBus } from "@/lib/shared/event-bus";
import type { SummaryCompletedEvent } from "@/lib/shared/event-bus/event-types";

export class SummaryService implements ISummaryService {
  private providerFactory: ProviderFactory;
  private config: SummaryServiceConfig;

  constructor(config?: Partial<SummaryServiceConfig>) {
    this.providerFactory = getProviderFactory();
    this.config = {
      enableFallback: true,
      maxRetries: 2,
      emitEvents: true,
      trackQuality: true,
      outputVersion: 2,
      ...config,
    };
  }

  async generate(
    input: SummaryInput,
    options?: GenerateOptions,
  ): Promise<SummaryResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let fallbackUsed = false;

    // 获取 Provider
    const provider = options?.forceProvider
      ? this.providerFactory.getProvider(options.forceProvider)
      : await this.providerFactory.getAvailableProvider();

    if (!provider) {
      throw new Error("No provider available");
    }

    try {
      const result = await provider.generateSummary(input);

      // 发布事件
      if (this.config.emitEvents) {
        this.emitSummaryCompleted(
          input,
          result,
          options?.needsClassification ?? true,
        );
      }

      // 追踪质量
      if (this.config.trackQuality && !options?.skipQualityTracking) {
        await this.trackQuality(input, result, provider.name, fallbackUsed);
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 尝试 fallback
      if (this.config.enableFallback) {
        fallbackUsed = true;
        const fallbackProvider = await this.getFallbackProvider(provider.name);

        if (fallbackProvider) {
          const result = await fallbackProvider.generateSummary(input);

          if (this.config.emitEvents) {
            this.emitSummaryCompleted(
              input,
              result,
              options?.needsClassification ?? true,
            );
          }

          if (this.config.trackQuality) {
            await this.trackQuality(input, result, fallbackProvider.name, true);
          }

          return result;
        }
      }

      throw lastError;
    }
  }

  private emitSummaryCompleted(
    input: SummaryInput,
    result: SummaryResult,
    needsClassification: boolean,
  ): void {
    const event: SummaryCompletedEvent = {
      userId: input.userId,
      bookmarkId: input.bookmarkId,
      summaryVersion: result.version,
      tagsGenerated: result.tags.length,
      processingTimeMs: result.latencyMs,
      needsClassification,
      timestamp: new Date().toISOString(),
    };

    eventBus.emit("summary:completed", event);
  }

  // ... 其他方法
}
```

#### Step 5: 修改现有调用方

```typescript
// src/lib/utils/ai-generator.ts
// 添加向后兼容导出

import { SummaryService } from "@/lib/summary/services";

// 保留原有函数签名，内部调用新服务
export async function generateAIContent(
  request: AIGenerateRequest,
): Promise<AIGenerateResult> {
  // 检查是否启用新实现
  if (process.env.USE_NEW_SUMMARY_SERVICE === "true") {
    const service = new SummaryService();
    const result = await service.generate({
      bookmarkId: 0, // 兼容旧接口
      userId: "",
      title: request.title,
      url: request.url,
      description: request.description,
      content: request.content,
      existingFolderNames: request.existingFolderNames,
    });

    return {
      summary: result.summary,
      tags: result.tags,
      contentType: undefined,
      contentTypeConfidence: undefined,
    };
  }

  // 旧实现...
}
```

#### Step 6: 更新 API 路由

```typescript
// src/app/api/bookmarks/route.ts
// 切换到新服务

import { SummaryService } from "@/lib/summary/services";

// 在创建书签后调用
const summaryService = new SummaryService();
const summaryResult = await summaryService.generate({
  bookmarkId: newBookmark.id,
  userId,
  title: crawlResult.title,
  url,
  description: crawlResult.description,
  content: crawlResult.content,
});
```

### 6.3 回滚方案

```typescript
// .env.local
// 回滚开关

# 禁用新摘要服务，使用旧实现
USE_NEW_SUMMARY_SERVICE=false

# 禁用阿里百炼云 Provider
DISABLE_ALIYUN_BAILIAN=true

# 强制使用 V1 输出格式
AI_SUMMARY_JSON_OUTPUT=false
```

---

## 7. 分阶段交付计划

### P0: 模块拆分 + 四层架构 (2-3 天)

#### 目标

- 创建 `src/lib/summary/` 模块结构
- 定义核心接口和类型
- 搭建四层架构骨架

#### 任务清单

| 序号 | 任务                                         | 优先级 | 工作量 |
| ---- | -------------------------------------------- | ------ | ------ |
| P0.1 | 创建目录结构和基础文件                       | 必须   | 2h     |
| P0.2 | 定义 Provider 接口 (`provider.interface.ts`) | 必须   | 2h     |
| P0.3 | 定义服务接口 (`summary.service.ts` 接口)     | 必须   | 2h     |
| P0.4 | 定义仓库接口和类型                           | 必须   | 2h     |
| P0.5 | 迁移 Prompt 模板（重导出）                   | 必须   | 1h     |
| P0.6 | 编写基础单元测试                             | 建议   | 3h     |

#### 交付物

- [ ] `src/lib/summary/` 目录结构
- [ ] `src/lib/summary/summary.types.ts`
- [ ] `src/lib/summary/providers/provider.interface.ts`
- [ ] `src/lib/summary/services/index.ts` (接口定义)
- [ ] `src/lib/summary/repositories/index.ts` (接口定义)

#### 验收标准

- TypeScript 编译通过
- 接口定义清晰完整
- 单元测试覆盖接口定义

---

### P1: Provider 接口 + DeepSeek 迁移 (1 天)

#### 目标

- 实现 DeepSeek Provider
- 迁移现有 DeepSeek 调用逻辑
- 实现 Provider 工厂

#### 任务清单

| 序号 | 任务                    | 优先级 | 工作量 |
| ---- | ----------------------- | ------ | ------ |
| P1.1 | 实现 `DeepSeekProvider` | 必须   | 3h     |
| P1.2 | 实现 `ProviderFactory`  | 必须   | 2h     |
| P1.3 | 迁移 Prompt 构建逻辑    | 必须   | 2h     |
| P1.4 | 迁移响应解析逻辑        | 必须   | 1h     |
| P1.5 | 编写 Provider 测试      | 建议   | 2h     |

#### 交付物

- [ ] `src/lib/summary/providers/deepseek.provider.ts`
- [ ] `src/lib/summary/providers/provider.factory.ts`
- [ ] Provider 单元测试

#### 验收标准

- DeepSeek Provider 可正常生成摘要
- 与现有 `ai-generator.ts` 输出一致
- 测试覆盖率 > 80%

---

### P2: 阿里百炼云 Provider (1 天)

#### 目标

- 实现阿里百炼云 Provider
- 支持多模型选择
- 实现流式输出

#### 任务清单

| 序号 | 任务                         | 优先级 | 工作量 |
| ---- | ---------------------------- | ------ | ------ |
| P2.1 | 实现 `AliyunBailianProvider` | 必须   | 3h     |
| P2.2 | 实现流式输出支持             | 建议   | 2h     |
| P2.3 | 实现模型切换功能             | 建议   | 1h     |
| P2.4 | 集成到 Provider 工厂         | 必须   | 1h     |
| P2.5 | 编写集成测试                 | 建议   | 2h     |

#### 交付物

- [ ] `src/lib/summary/providers/aliyun-bailian.provider.ts`
- [ ] Provider 工厂更新
- [ ] 集成测试

#### 验收标准

- 阿里百炼云 Provider 可正常生成摘要
- 支持 qwen-turbo/plus/max 模型切换
- DeepSeek 不可用时自动 fallback 到阿里百炼云

---

### P3: EventBus + JobQueue 接入 (0.5 天)

#### 目标

- 接入现有 EventBus 系统
- 接入 JobQueue 异步处理
- 实现事件驱动解耦

#### 任务清单

| 序号 | 任务                         | 优先级 | 工作量 |
| ---- | ---------------------------- | ------ | ------ |
| P3.1 | 在 SummaryService 中发布事件 | 必须   | 1h     |
| P3.2 | 实现 JobQueue 入队逻辑       | 必须   | 2h     |
| P3.3 | 更新 Cron 任务处理摘要 Job   | 建议   | 1h     |
| P3.4 | 验证事件级联流程             | 必须   | 1h     |

#### 交付物

- [ ] SummaryService 事件发布实现
- [ ] 摘要 Job 类型定义和处理
- [ ] 事件级联测试

#### 验收标准

- 摘要完成后自动触发 `summary:completed` 事件
- SystemCoordinator 正确级联到分类
- 异步任务可通过 JobQueue 处理

---

### P4: 配置中心扩展 (0.5 天)

#### 目标

- 扩展 ConfigCenter 支持摘要配置
- 实现热更新配置
- 添加 Provider 健康监控

#### 任务清单

| 序号 | 任务                         | 优先级 | 工作量 |
| ---- | ---------------------------- | ------ | ------ |
| P4.1 | 扩展 ConfigCenter 摘要配置   | 必须   | 2h     |
| P4.2 | 实现 Provider 健康检查定时器 | 建议   | 1h     |
| P4.3 | 添加配置变更日志             | 建议   | 1h     |

#### 交付物

- [ ] ConfigCenter 摘要配置扩展
- [ ] 健康检查定时任务
- [ ] 配置变更追踪

#### 验收标准

- 配置可通过数据库热更新
- Provider 健康状态可监控
- 配置变更有日志记录

---

### P5: 质量追踪系统 (2 天)

#### 目标

- 实现质量日志表和仓库
- 实现自动质量评分
- 支持用户反馈

#### 任务清单

| 序号 | 任务                           | 优先级 | 工作量 |
| ---- | ------------------------------ | ------ | ------ |
| P5.1 | 创建 `summary_quality_logs` 表 | 必须   | 1h     |
| P5.2 | 实现 `QualityLogRepository`    | 必须   | 2h     |
| P5.3 | 实现 `QualityTrackerService`   | 必须   | 3h     |
| P5.4 | 实现自动质量评分算法           | 建议   | 3h     |
| P5.5 | 添加用户反馈 API               | 建议   | 2h     |
| P5.6 | 添加质量统计 Dashboard 数据    | 建议   | 2h     |

#### 交付物

- [ ] 数据库迁移文件
- [ ] `src/lib/summary/repositories/quality-log.repository.ts`
- [ ] `src/lib/summary/services/quality-tracker.service.ts`
- [ ] 用户反馈 API

#### 验收标准

- 每次摘要生成都有质量日志
- 可查看 Provider 使用统计
- 用户可提交反馈评分

---

## 8. 风险与缓解

### 8.1 风险矩阵

| 风险                | 可能性 | 影响 | 缓解措施                   |
| ------------------- | ------ | ---- | -------------------------- |
| API Key 泄露        | 低     | 高   | 环境变量管理，隐藏敏感信息 |
| Provider 全部不可用 | 低     | 高   | 多 Provider 冗余，本地缓存 |
| 迁移过程中服务中断  | 中     | 中   | 渐进式迁移，特性开关       |
| 新旧实现输出不一致  | 中     | 低   | 对比测试，兼容性验证       |
| 阿里百炼云 API 限流 | 中     | 中   | 请求队列，限流保护         |

### 8.2 监控指标

```typescript
// 建议监控的关键指标
const METRICS = {
  // 可用性
  "summary.availability": "摘要服务可用率",
  "provider.health.deepseek": "DeepSeek 健康状态",
  "provider.health.aliyun": "阿里百炼云健康状态",

  // 性能
  "summary.latency.p50": "摘要生成延迟 P50",
  "summary.latency.p99": "摘要生成延迟 P99",

  // 质量
  "summary.quality.auto_score": "自动质量评分",
  "summary.quality.user_rating": "用户评分",

  // 成本
  "summary.cost.daily": "每日成本",
  "summary.tokens.total": "总 Token 消耗",

  // 错误
  "summary.error.rate": "错误率",
  "summary.fallback.rate": "Fallback 触发率",
};
```

---

## 附录

### A. 环境变量配置

```bash
# AI 摘要服务配置

# DeepSeek (主力 Provider)
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxx

# 阿里百炼云 (Fallback Provider)
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxx

# 摘要服务配置
USE_NEW_SUMMARY_SERVICE=true          # 启用新服务
AI_SUMMARY_JSON_OUTPUT=true           # V2 JSON 输出
SUMMARY_ENABLE_FALLBACK=true          # 启用 Fallback
SUMMARY_TRACK_QUALITY=true            # 启用质量追踪

# Provider 配置
SUMMARY_DEFAULT_PROVIDER=deepseek     # 默认 Provider
SUMMARY_FALLBACK_PROVIDER=aliyun-bailian  # Fallback Provider
```

### B. 相关文档

- [通义千问 API 文档](https://help.aliyun.com/zh/model-studio/use-qwen-by-calling-api)
- [OpenAI 兼容接口](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)
- [DeepSeek API 文档](https://platform.deepseek.com/docs)

### C. 变更记录

| 日期       | 版本 | 变更内容               |
| ---------- | ---- | ---------------------- |
| 2025-12-12 | 2.0  | 初始版本，完整实施方案 |

---

**文档结束**
