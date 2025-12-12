# 智能分类建议 AI 集成 - 详细设计文档

**版本**: 1.0
**日期**: 2025-12-05
**状态**: 待审核

---

## 一、现状分析

### 1.1 系统架构完成度

经过深入代码审查，**智能分类建议系统的核心架构已经 100% 完成**：

| 模块        | 完成度  | 关键文件                                                                                                                         |
| ----------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 数据库表    | ✅ 100% | [20251125000003_add_classification_suggestions.sql](../supabase/migrations/20251125000003_add_classification_suggestions.sql)    |
| RLS 策略    | ✅ 100% | 同上                                                                                                                             |
| 数据库函数  | ✅ 100% | `accept_classification_suggestions`, `reject_classification_suggestions`, `expire_old_suggestions`                               |
| AI 推荐逻辑 | ✅ 100% | [ai-generator.ts](../src/lib/utils/ai-generator.ts):498-957                                                                      |
| API 路由    | ✅ 100% | [/api/reclassify/](../src/app/api/reclassify/route.ts), [/api/ai/recommend-folder/](../src/app/api/ai/recommend-folder/route.ts) |
| 前端组件    | ✅ 100% | [reclassify-banner.tsx](../src/components/bookmark/reclassify-banner.tsx)                                                        |
| React Hook  | ✅ 100% | [use-reclassify.ts](../src/hooks/use-reclassify.ts)                                                                              |

### 1.2 当前调用链

```
用户点击"立即整理"
       ↓
POST /api/reclassify
       ↓
获取待整理文件夹中的书签 (最多 50 条)
       ↓
【循环】对每个书签:
   ↓
   getAIRecommendation() → HTTP 调用 /api/ai/recommend-folder
       ↓
       recommendFolder() → DeepSeek API 调用
       ↓
       返回推荐结果
   ↓
【循环结束】
       ↓
批量插入 classification_suggestions 表
       ↓
返回结果给前端
```

### 1.3 发现的问题

虽然系统功能完整，但存在以下**性能和架构问题**：

| 问题               | 严重程度 | 影响                                                               |
| ------------------ | -------- | ------------------------------------------------------------------ |
| **内部 HTTP 调用** | 中       | `getAIRecommendation()` 通过 HTTP 调用同一服务的 API，增加网络开销 |
| **串行处理**       | 高       | 对每个书签逐个调用 AI API，50 条书签需要 50 次 API 调用            |
| **无并发控制**     | 中       | 没有限制并发数，可能触发 DeepSeek API 速率限制                     |
| **无批量 AI 调用** | 高       | 每个书签单独调用 DeepSeek，消耗大、延迟高                          |
| **超时风险**       | 高       | 50 条书签 × 10 秒/条 = 500 秒，远超 API 超时限制                   |

### 1.4 关键代码位置

| 功能           | 文件                                                | 行号    | 说明                                     |
| -------------- | --------------------------------------------------- | ------- | ---------------------------------------- |
| 主执行逻辑     | [route.ts](../src/app/api/reclassify/route.ts)      | 134-174 | 循环处理每个书签                         |
| 内部 HTTP 调用 | [route.ts](../src/app/api/reclassify/route.ts)      | 242-278 | `getAIRecommendation()`                  |
| AI 推荐函数    | [ai-generator.ts](../src/lib/utils/ai-generator.ts) | 498-570 | `recommendFolder()`                      |
| 推荐提示词     | [ai-generator.ts](../src/lib/utils/ai-generator.ts) | 575-609 | `buildFolderRecommendationPrompt()`      |
| 智能回退       | [ai-generator.ts](../src/lib/utils/ai-generator.ts) | 672-772 | `generateFallbackFolderRecommendation()` |

---

## 二、优化设计方案

### 2.1 方案概述

采用**渐进式优化**策略，分三个阶段实施：

```
Phase 1: 架构优化 (1-2 天)
    ├── 移除内部 HTTP 调用
    └── 直接调用 recommendFolder() 函数

Phase 2: 性能优化 (2-3 天)
    ├── 实现并发控制
    ├── 批量 AI 调用
    └── 超时处理

Phase 3: 用户体验优化 (1-2 天)
    ├── 实时进度反馈
    ├── 后台任务队列
    └── 增量处理
```

---

## 三、Phase 1: 架构优化

### 3.1 移除内部 HTTP 调用

**目标**: 直接调用 `recommendFolder()` 函数，消除不必要的网络开销

**修改文件**: [src/app/api/reclassify/route.ts](../src/app/api/reclassify/route.ts)

**当前代码** (第 242-278 行):

```typescript
async function getAIRecommendation(
  title: string,
  summary: string,
  tags: string[],
  existingFolders: Array<{ id: number; name: string; is_system: boolean }>
): Promise<FolderRecommendation | null> {
  try {
    // ❌ 问题: 内部 HTTP 调用
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/ai/recommend-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, summary, tags, existingFolders: ... }),
    })
    // ...
  }
}
```

**优化后代码**:

```typescript
import {
  recommendFolder,
  type FolderRecommendation,
} from "@/lib/utils/ai-generator";

async function getAIRecommendation(
  title: string,
  summary: string,
  tags: string[],
  existingFolders: Array<{ id: number; name: string }>,
): Promise<FolderRecommendation | null> {
  try {
    // ✅ 直接调用函数
    const recommendation = await recommendFolder(
      title,
      summary,
      tags,
      existingFolders,
    );
    return recommendation;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "AI recommendation failed",
    );
    return null;
  }
}
```

**收益**:

- 减少 ~50ms/请求 的网络延迟
- 简化调用链，降低复杂度
- 消除 `NEXT_PUBLIC_APP_URL` 环境变量依赖

---

## 四、Phase 2: 性能优化

### 4.1 实现并发控制

**目标**: 并行处理多个书签，但限制并发数避免 API 速率限制

**新增文件**: `src/lib/utils/concurrency.ts`

```typescript
/**
 * 并发控制工具
 * 限制同时执行的 Promise 数量
 */

export interface ConcurrencyOptions {
  /** 最大并发数 */
  concurrency: number;
  /** 单个任务超时时间 (ms) */
  timeout?: number;
  /** 失败重试次数 */
  retries?: number;
  /** 重试间隔 (ms) */
  retryDelay?: number;
}

export interface TaskResult<T> {
  index: number;
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * 并发执行任务
 * @param tasks - 任务函数数组
 * @param options - 并发控制选项
 * @returns 所有任务的执行结果
 */
export async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  options: ConcurrencyOptions,
): Promise<TaskResult<T>[]> {
  const {
    concurrency,
    timeout = 15000,
    retries = 1,
    retryDelay = 1000,
  } = options;
  const results: TaskResult<T>[] = [];
  let currentIndex = 0;

  async function executeTask(taskIndex: number): Promise<void> {
    const task = tasks[taskIndex];
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Task timeout")), timeout);
        });

        const data = await Promise.race([task(), timeoutPromise]);
        results[taskIndex] = { index: taskIndex, success: true, data };
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    results[taskIndex] = { index: taskIndex, success: false, error: lastError };
  }

  async function worker(): Promise<void> {
    while (currentIndex < tasks.length) {
      const taskIndex = currentIndex++;
      await executeTask(taskIndex);
    }
  }

  // 创建 worker 并行执行
  const workers = Array(Math.min(concurrency, tasks.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}
```

### 4.2 批量 AI 调用优化

**目标**: 将多个书签合并为一次 AI 调用，大幅减少 API 调用次数

**方案**: 设计批量推荐 Prompt，一次处理 5-10 个书签

**新增函数**: `src/lib/utils/ai-generator.ts`

````typescript
/**
 * 批量推荐文件夹
 * 一次 AI 调用处理多个书签
 */
export interface BatchBookmarkInput {
  id: number;
  title: string;
  summary: string;
  tags: string[];
}

export interface BatchFolderRecommendation {
  bookmarkId: number;
  folderId: number | null;
  folderName: string;
  confidence: number;
  reason: string;
  suggestNew: boolean;
}

export async function recommendFoldersBatch(
  bookmarks: BatchBookmarkInput[],
  existingFolders: ExistingFolder[],
): Promise<BatchFolderRecommendation[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  // 没有 API Key 或数据，使用回退方案
  if (!apiKey || bookmarks.length === 0) {
    return bookmarks.map((bookmark) => ({
      bookmarkId: bookmark.id,
      ...generateFallbackFolderRecommendation(
        bookmark.title,
        bookmark.tags,
        existingFolders,
      ),
    }));
  }

  try {
    const prompt = buildBatchFolderRecommendationPrompt(
      bookmarks,
      existingFolders,
    );

    const response = await fetch(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content:
                "你是一个内容分类助手。你的任务是根据内容特征，为多个书签批量推荐最合适的文件夹。请严格按照 JSON 格式返回结果。",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 2000, // 批量处理需要更多 token
        }),
        signal: AbortSignal.timeout(30000), // 30秒超时
      },
    );

    if (!response.ok) {
      throw new Error(`DeepSeek API 错误: ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data.choices[0]?.message?.content;

    if (!aiContent) {
      throw new Error("AI 未返回内容");
    }

    return parseBatchFolderRecommendation(
      aiContent,
      bookmarks,
      existingFolders,
    );
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Batch folder recommendation failed",
    );
    // 回退到单独处理
    return bookmarks.map((bookmark) => ({
      bookmarkId: bookmark.id,
      ...generateFallbackFolderRecommendation(
        bookmark.title,
        bookmark.tags,
        existingFolders,
      ),
    }));
  }
}

/**
 * 构建批量推荐提示词
 */
function buildBatchFolderRecommendationPrompt(
  bookmarks: BatchBookmarkInput[],
  existingFolders: ExistingFolder[],
): string {
  const folderList = existingFolders
    .map((f) => `- ${f.name} (ID: ${f.id})`)
    .join("\n");

  const bookmarkList = bookmarks
    .map(
      (b, i) => `
【书签 ${i + 1}】(ID: ${b.id})
- 标题：${b.title}
- 摘要：${b.summary || "无"}
- 标签：${b.tags.join("、") || "无"}
`,
    )
    .join("\n");

  return `请为以下 ${bookmarks.length} 个书签分别推荐最合适的文件夹。

${bookmarkList}

现有文件夹：
${folderList || "（暂无文件夹）"}

请以 JSON 数组格式返回，每个书签一个推荐结果：
[
  {
    "bookmarkId": 123,
    "recommendedFolderId": 456,
    "folderName": "文件夹名称",
    "confidence": 85,
    "reason": "推荐理由",
    "suggestNew": false
  },
  ...
]

要求：
1. 优先推荐现有文件夹
2. 只有内容主题与现有文件夹都不匹配时，才建议新建
3. 相似主题的书签应推荐到同一文件夹
4. 只返回 JSON 数组，不要额外说明`;
}

/**
 * 解析批量推荐响应
 */
function parseBatchFolderRecommendation(
  content: string,
  bookmarks: BatchBookmarkInput[],
  existingFolders: ExistingFolder[],
): BatchFolderRecommendation[] {
  try {
    const cleaned = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const results = JSON.parse(cleaned);

    if (!Array.isArray(results)) {
      throw new Error("响应格式错误：期望数组");
    }

    return results.map((result, index) => {
      const bookmark =
        bookmarks.find((b) => b.id === result.bookmarkId) || bookmarks[index];
      const suggestNew = result.suggestNew === true;

      let folderId: number | null = null;
      let folderName = result.folderName || "未分类";

      if (!suggestNew && result.recommendedFolderId) {
        const folder = existingFolders.find(
          (f) => f.id === result.recommendedFolderId,
        );
        if (folder) {
          folderId = folder.id;
          folderName = folder.name;
        }
      }

      return {
        bookmarkId: bookmark?.id || result.bookmarkId,
        folderId,
        folderName,
        confidence: Math.min(100, Math.max(0, result.confidence || 50)),
        reason: result.reason || "基于内容主题分析",
        suggestNew,
      };
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        rawContent: content,
      },
      "Parse batch folder recommendation error",
    );
    // 回退处理
    return bookmarks.map((bookmark) => ({
      bookmarkId: bookmark.id,
      ...generateFallbackFolderRecommendation(
        bookmark.title,
        bookmark.tags,
        existingFolders,
      ),
    }));
  }
}
````

### 4.3 重构主执行逻辑

**修改文件**: [src/app/api/reclassify/route.ts](../src/app/api/reclassify/route.ts)

```typescript
import {
  recommendFoldersBatch,
  type BatchBookmarkInput,
} from "@/lib/utils/ai-generator";
import { runConcurrent } from "@/lib/utils/concurrency";

// 配置
const BATCH_SIZE = 5; // 每批处理 5 个书签
const MAX_CONCURRENCY = 3; // 最多 3 个并发批次
const CONFIDENCE_THRESHOLD = 40; // 置信度阈值

export async function POST(request: NextRequest) {
  // ... 前置验证代码不变 ...

  // 8. 批量处理书签
  const batches: BatchBookmarkInput[][] = [];
  for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
    batches.push(
      bookmarks.slice(i, i + BATCH_SIZE).map((b) => ({
        id: b.id,
        title: b.title,
        summary: b.ai_summary || "",
        tags: b.ai_tags || [],
      })),
    );
  }

  // 9. 并发执行批量推荐
  const batchTasks = batches.map(
    (batch) => () => recommendFoldersBatch(batch, folders || []),
  );

  const batchResults = await runConcurrent(batchTasks, {
    concurrency: MAX_CONCURRENCY,
    timeout: 30000,
    retries: 1,
  });

  // 10. 处理结果并生成建议
  const suggestions: ClassificationSuggestionInsert[] = [];

  for (const result of batchResults) {
    if (!result.success || !result.data) continue;

    for (const recommendation of result.data) {
      if (recommendation.confidence >= CONFIDENCE_THRESHOLD) {
        suggestions.push({
          user_id: user.id,
          bookmark_id: recommendation.bookmarkId,
          suggested_folder_id: recommendation.folderId,
          suggested_folder_name: recommendation.folderName,
          suggest_new_folder: recommendation.suggestNew,
          confidence: recommendation.confidence,
          reason: recommendation.reason,
          status: "pending",
          batch_id: batchId,
        });
      }
    }
  }

  // ... 后续插入和返回代码不变 ...
}
```

### 4.4 性能对比

| 指标                   | 优化前           | 优化后          | 提升       |
| ---------------------- | ---------------- | --------------- | ---------- |
| 50 条书签 API 调用次数 | 50 次            | 10 次 (5 条/批) | **80% ↓**  |
| 总处理时间             | ~500 秒          | ~60 秒          | **88% ↓**  |
| 网络延迟               | 50 × 50ms = 2.5s | 0 (直接调用)    | **100% ↓** |
| 超时风险               | 高               | 低              | 显著降低   |

---

## 五、Phase 3: 用户体验优化

### 5.1 实时进度反馈

**方案**: 使用 Server-Sent Events (SSE) 实时推送处理进度

**新增 API**: `/api/reclassify/stream`

```typescript
// src/app/api/reclassify/stream/route.ts

import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        // ... 处理逻辑 ...

        // 发送进度事件
        sendEvent("progress", {
          current: 1,
          total: 10,
          message: "正在分析第 1 批...",
        });

        // ... 批量处理 ...

        sendEvent("complete", { suggestionsCreated: 15 });
      } catch (error) {
        sendEvent("error", { message: "处理失败" });
      } finally {
        controller.close();
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
}
```

**前端集成**:

```typescript
// 在 useReclassify hook 中添加

const runReclassifyWithProgress = useCallback(async () => {
  setIsRunning(true);
  setProgress({ current: 0, total: 0, message: "准备中..." });

  const eventSource = new EventSource("/api/reclassify/stream", {
    // POST 需要使用 fetch + ReadableStream
  });

  // 使用 fetch 替代 EventSource（POST 请求）
  const response = await fetch("/api/reclassify/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ forceRun: true }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const text = decoder.decode(value);
    // 解析 SSE 事件并更新状态
    // ...
  }

  setIsRunning(false);
}, []);
```

### 5.2 后台任务队列 (可选)

对于大量书签（>100），建议使用后台任务队列：

**技术选型**: Supabase Edge Functions + pg_cron

```sql
-- 添加任务队列表
CREATE TABLE IF NOT EXISTS public.reclassify_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  total_bookmarks INT DEFAULT 0,
  processed_bookmarks INT DEFAULT 0,
  suggestions_created INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 定时检查待处理任务
SELECT cron.schedule(
  'process-reclassify-jobs',
  '*/5 * * * *', -- 每 5 分钟检查
  $$
    SELECT net.http_post(
      'https://your-project.supabase.co/functions/v1/process-reclassify',
      '{}',
      '{"Authorization": "Bearer your-service-key"}'
    )
  $$
);
```

---

## 六、实施计划

### 6.1 详细任务分解

```
Phase 1: 架构优化 (1-2 天)
├── Task 1.1: 移除内部 HTTP 调用
│   ├── 修改 getAIRecommendation() 函数
│   ├── 直接导入 recommendFolder()
│   └── 更新类型定义
│
├── Task 1.2: 清理冗余代码
│   ├── 评估 /api/ai/recommend-folder 是否保留
│   └── 更新 API 文档
│
└── Task 1.3: 单元测试
    ├── 测试直接调用是否正常
    └── 测试回退逻辑

Phase 2: 性能优化 (2-3 天)
├── Task 2.1: 实现并发控制工具
│   ├── 创建 concurrency.ts
│   ├── 编写单元测试
│   └── 处理边界情况
│
├── Task 2.2: 实现批量 AI 调用
│   ├── 添加 recommendFoldersBatch()
│   ├── 设计批量 Prompt
│   ├── 实现响应解析
│   └── 添加回退逻辑
│
├── Task 2.3: 重构主执行逻辑
│   ├── 拆分书签为批次
│   ├── 集成并发控制
│   └── 处理部分失败
│
└── Task 2.4: 性能测试
    ├── 测试 50 条书签场景
    ├── 测试 API 速率限制
    └── 测试超时处理

Phase 3: 用户体验优化 (1-2 天)
├── Task 3.1: 实时进度反馈
│   ├── 创建 SSE 端点
│   ├── 前端进度显示
│   └── 错误状态处理
│
└── Task 3.2: 文档更新
    ├── 更新 API 文档
    └── 更新 CLAUDE.md
```

### 6.2 风险评估

| 风险                        | 可能性 | 影响 | 缓解措施                |
| --------------------------- | ------ | ---- | ----------------------- |
| DeepSeek API 速率限制       | 中     | 高   | 并发控制 + 指数退避     |
| 批量 Prompt 超过 token 限制 | 低     | 中   | 限制每批 5 条，动态调整 |
| 批量响应解析失败            | 中     | 中   | 回退到单独处理          |
| SSE 连接断开                | 低     | 低   | 前端自动重连 + 状态恢复 |

### 6.3 测试策略

```typescript
// 测试用例示例

describe("recommendFoldersBatch", () => {
  it("should handle batch of 5 bookmarks", async () => {
    const bookmarks = generateMockBookmarks(5);
    const folders = generateMockFolders(10);

    const results = await recommendFoldersBatch(bookmarks, folders);

    expect(results).toHaveLength(5);
    results.forEach((r) => {
      expect(r.bookmarkId).toBeDefined();
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(100);
    });
  });

  it("should fallback when API fails", async () => {
    // Mock API 失败
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("API Error"));

    const results = await recommendFoldersBatch(bookmarks, folders);

    // 应返回回退结果
    expect(results).toHaveLength(5);
  });
});

describe("runConcurrent", () => {
  it("should respect concurrency limit", async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const tasks = Array(10)
      .fill(null)
      .map(() => async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await delay(100);
        currentConcurrent--;
        return "done";
      });

    await runConcurrent(tasks, { concurrency: 3 });

    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });
});
```

---

## 七、API 变更

### 7.1 无破坏性变更

本次优化**不改变**任何外部 API 接口，仅优化内部实现：

| API                                | 变更         | 兼容性      |
| ---------------------------------- | ------------ | ----------- |
| `POST /api/reclassify`             | 内部实现优化 | ✅ 完全兼容 |
| `GET /api/reclassify/check`        | 无变更       | ✅ 完全兼容 |
| `GET /api/reclassify/suggestions`  | 无变更       | ✅ 完全兼容 |
| `POST /api/reclassify/suggestions` | 无变更       | ✅ 完全兼容 |

### 7.2 新增 API (可选)

| API                      | 方法 | 用途             |
| ------------------------ | ---- | ---------------- |
| `/api/reclassify/stream` | POST | SSE 实时进度推送 |

---

## 八、验收标准

### 8.1 功能验收

- [ ] 直接调用 `recommendFolder()` 正常工作
- [ ] 批量处理 50 条书签成功完成
- [ ] 置信度过滤正常 (≥40%)
- [ ] 建议表数据正确插入
- [ ] 前端显示分类建议正常

### 8.2 性能验收

- [ ] 50 条书签处理时间 < 90 秒
- [ ] API 调用次数 ≤ 10 次
- [ ] 无 API 速率限制错误
- [ ] 无超时错误

### 8.3 稳定性验收

- [ ] 部分失败时整体流程不中断
- [ ] 回退逻辑正常工作
- [ ] 错误日志记录完整

---

## 九、附录

### A. 相关文档

- [智能分类系统分析报告](./intelligent-classification-analysis.md)
- [CLAUDE.md 项目文档](../CLAUDE.md)

### B. 参考资料

- [DeepSeek API 文档](https://platform.deepseek.com/docs)
- [Next.js Streaming](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)

---

**文档状态**: 待审核
**下一步**: 请审核以上设计方案，确认后开始实施
