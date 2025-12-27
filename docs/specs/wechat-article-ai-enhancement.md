# 微信文章 AI 增强实施方案

> 版本: 2.0.0 (规范修正版)
> 日期: 2025-12-27
> 状态: 待审核

---

## 一、方案概述

### 1.1 目标

将微信文章功能增强为 AI 可调用的 Tools 和 Skills，实现：

1. **Tool: `import_wechat_article`** - 通过链接导入微信文章
2. **Tool: `list_wechat_articles`** - 列出微信文章（按公众号分组）
3. **Skill: `WechatDigestSkill`** - 微信阅读摘要（按公众号/话题生成）

### 1.2 规范一致性声明

本方案已根据现有 Tools/Skills 开发规范进行修正：

| 规范要求                      | 修正内容                                   |
| ----------------------------- | ------------------------------------------ |
| Tool 使用函数式导出           | ✅ 改用 `Tool<TParams, TResult>` 对象      |
| Tool 分类使用标准枚举         | ✅ 使用 `action` / `query`                 |
| Tool 命名使用下划线           | ✅ `import_wechat_article`                 |
| 参数 Schema 包含 reasoning    | ✅ 已添加                                  |
| Skill 继承 OrchestrationSkill | ✅ 已确认                                  |
| Skill 实现 parseInput()       | ✅ 已添加                                  |
| Skill 使用 executeStream()    | ✅ 已改造                                  |
| 使用标准流式输出方法          | ✅ emitText/reportProgress/emitDeliverable |
| 前端无需新组件                | ✅ 使用统一 API                            |

### 1.3 现有能力基础

| 现有能力               | 位置                                               | 说明                               |
| ---------------------- | -------------------------------------------------- | ---------------------------------- |
| `WechatArticleService` | `src/lib/wechat-article/wechat-article.service.ts` | 完整的抓取、处理、存储服务         |
| 内容处理器             | `src/lib/wechat-article/processors/`               | HTML清理、图片持久化、Markdown转换 |
| API 端点               | `src/app/api/wechat-article/`                      | 创建、获取、重新抓取、导出         |
| 数据模型               | `bookmark_snapshots` 表                            | 存储微信文章完整内容               |
| 平台标识               | `platform = 'WECHAT_OFFICIAL_ACCOUNT'`             | 区分微信文章                       |

### 1.4 用户场景

| 场景     | 用户表达                                            | 预期行为         |
| -------- | --------------------------------------------------- | ---------------- |
| 导入文章 | "帮我保存这篇微信文章 https://mp.weixin.qq.com/..." | 自动抓取并保存   |
| 查看列表 | "我收藏了哪些微信公众号的文章？"                    | 按公众号分组显示 |
| 生成摘要 | "帮我总结一下最近收藏的 XX 公众号文章"              | 生成摘要报告     |
| 主题摘要 | "总结一下我关于 AI 的微信收藏"                      | 按主题筛选并摘要 |

---

## 二、Tool: `import_wechat_article`

### 2.1 功能定义

| 属性         | 值                       |
| ------------ | ------------------------ |
| **名称**     | `import_wechat_article`  |
| **分类**     | `action` (操作类工具)    |
| **风险等级** | 低 (仅创建，不修改/删除) |
| **确认需求** | 无需确认                 |
| **预估时间** | 5000ms                   |

### 2.2 输入参数 (Zod Schema)

```typescript
import { z } from "zod";

const importWechatArticleParamsSchema = z.object({
  /** AI 选择此工具的理由 (规范要求) */
  reasoning: z.string().optional().describe("AI 选择此工具的理由"),

  /** 微信文章链接 (必需) */
  url: z.string().url("请提供有效的 URL"),

  /** 指定文件夹 ID (可选，默认收件箱) */
  folderId: z.string().uuid().optional(),

  /** 自定义标签 (可选) */
  tags: z.array(z.string()).max(10).optional(),

  /** 样式保留级别 (可选，默认 full-snapshot) */
  styleLevel: z
    .enum(["text-only", "full-snapshot"])
    .optional()
    .default("full-snapshot"),

  /** 是否立即抓取完整内容 (可选，默认 true) */
  crawlImmediately: z.boolean().optional().default(true),
});

type ImportWechatArticleParams = z.infer<
  typeof importWechatArticleParamsSchema
>;
```

### 2.3 输出结构

```typescript
interface ImportWechatArticleResult {
  /** 创建的书签 */
  bookmark?: {
    id: number;
    title: string;
    url: string;
    platform: "WECHAT_OFFICIAL_ACCOUNT";
    createdAt: string;
  };

  /** 快照信息 */
  snapshot?: {
    id: number;
    status: "pending" | "completed" | "failed";
    wordCount?: number;
    imagesCount?: number;
    imagesSuccess?: number;
  };

  /** 公众号信息 (如果能解析) */
  account?: {
    name: string;
    id?: string;
  };

  /** 是否已存在 */
  isExisting?: boolean;

  /** 人类可读的结果消息 */
  message: string;
}
```

### 2.4 实现方案 (符合规范)

#### 文件位置

```
src/lib/ai-agent/tools/action/
└── import-wechat-article.tool.ts
```

#### 核心实现 (函数式导出)

```typescript
// src/lib/ai-agent/tools/action/import-wechat-article.tool.ts

import { z } from "zod";
import { Tool, ToolDefinition, ToolResult, ToolContext } from "../types";
import { isWechatArticleUrl } from "@/lib/wechat-article";
import { createServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";

// ============================================
// 1. 参数 Schema 定义
// ============================================

const paramsSchema = z.object({
  reasoning: z.string().optional().describe("AI 选择此工具的理由"),
  url: z.string().url("请提供有效的 URL"),
  folderId: z.string().uuid().optional(),
  tags: z.array(z.string()).max(10).optional(),
  styleLevel: z
    .enum(["text-only", "full-snapshot"])
    .optional()
    .default("full-snapshot"),
  crawlImmediately: z.boolean().optional().default(true),
});

type Params = z.infer<typeof paramsSchema>;

// ============================================
// 2. 结果类型定义
// ============================================

interface Result {
  bookmark?: {
    id: number;
    title: string;
    url: string;
    platform: "WECHAT_OFFICIAL_ACCOUNT";
    createdAt: string;
  };
  snapshot?: {
    id: number;
    status: "pending" | "completed" | "failed";
    wordCount?: number;
    imagesCount?: number;
    imagesSuccess?: number;
  };
  account?: { name: string; id?: string };
  isExisting?: boolean;
  message: string;
}

// ============================================
// 3. Tool 定义
// ============================================

const definition: ToolDefinition<Params> = {
  name: "import_wechat_article",
  description: `导入微信公众号文章。通过链接保存文章，自动抓取完整内容、图片。

使用场景：
- 用户提供微信文章链接想要保存
- 用户说"帮我收藏这篇文章"并附带 mp.weixin.qq.com 链接
- 用户说"保存这个微信链接"

URL 格式示例：
- https://mp.weixin.qq.com/s/xxxxx
- https://mp.weixin.qq.com/s?__biz=xxx&mid=xxx

注意：仅支持微信公众号文章，其他平台请使用 create_bookmark`,

  parameters: paramsSchema,
  category: "action",
  requiresConfirmation: false,
  estimatedDurationMs: 5000,
};

// ============================================
// 4. 执行函数
// ============================================

async function execute(
  params: Params,
  context: ToolContext,
): Promise<ToolResult<Result>> {
  const startTime = Date.now();
  const { url, folderId, tags, styleLevel, crawlImmediately, reasoning } =
    params;

  // 记录 reasoning (规范要求)
  if (reasoning) {
    logger.debug(
      { reasoning, tool: "import_wechat_article" },
      "Tool reasoning",
    );
  }

  // 1. 验证是否为微信文章链接
  if (!isWechatArticleUrl(url)) {
    return {
      success: false,
      error: {
        code: "NOT_WECHAT_URL",
        message:
          "该链接不是微信公众号文章，请使用 create_bookmark 工具保存其他平台内容",
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  // 2. 解析公众号信息
  const accountInfo = parseAccountInfo(url);

  const supabase = await createServerClient();

  // 3. 检查是否已存在
  const { data: existing } = await supabase
    .from("bookmarks")
    .select("id, title")
    .eq("user_id", context.userId)
    .eq("url", url)
    .single();

  if (existing) {
    return {
      success: true,
      data: {
        bookmark: {
          id: existing.id,
          title: existing.title,
          url,
          platform: "WECHAT_OFFICIAL_ACCOUNT",
          createdAt: "",
        },
        isExisting: true,
        message: `该文章已存在：「${existing.title}」`,
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        affectedCount: 0,
      },
    };
  }

  // 4. 创建书签
  const { data: bookmark, error: bookmarkError } = await supabase
    .from("bookmarks")
    .insert({
      user_id: context.userId,
      url,
      title: "微信文章 (获取中...)",
      platform: "WECHAT_OFFICIAL_ACCOUNT",
      folder_id: folderId || null,
      tags: tags || [],
    })
    .select()
    .single();

  if (bookmarkError) {
    return {
      success: false,
      error: {
        code: "CREATE_FAILED",
        message: `创建书签失败: ${bookmarkError.message}`,
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  // 5. 创建快照并抓取
  try {
    const createResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/wechat-article/create`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarkId: bookmark.id }),
      },
    );

    const createResult = await createResponse.json();

    if (!createResult.success) {
      return {
        success: false,
        data: {
          bookmark: {
            id: bookmark.id,
            title: bookmark.title,
            url,
            platform: "WECHAT_OFFICIAL_ACCOUNT",
            createdAt: bookmark.created_at,
          },
          message: `书签已创建，但快照失败: ${createResult.message}`,
        },
        error: {
          code: createResult.code || "SNAPSHOT_FAILED",
          message: createResult.message || "创建快照失败",
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          affectedCount: 1,
        },
      };
    }

    const snapshotId = createResult.data.snapshotId;
    let snapshotResult: Result["snapshot"] = {
      id: snapshotId,
      status: "pending",
    };

    // 6. 立即抓取完整内容 (如果启用)
    if (crawlImmediately) {
      const crawlResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/wechat-article/${snapshotId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ styleLevel }),
        },
      );

      const crawlResult = await crawlResponse.json();

      if (crawlResult.success) {
        snapshotResult = {
          id: snapshotId,
          status: "completed",
          wordCount: crawlResult.data.wordCount,
          imagesCount: crawlResult.data.imagesCount,
          imagesSuccess: crawlResult.data.imagesSuccess,
        };
      }
    }

    // 7. 获取更新后的书签标题
    const { data: updatedBookmark } = await supabase
      .from("bookmarks")
      .select("title")
      .eq("id", bookmark.id)
      .single();

    const finalTitle = updatedBookmark?.title || bookmark.title;

    return {
      success: true,
      data: {
        bookmark: {
          id: bookmark.id,
          title: finalTitle,
          url,
          platform: "WECHAT_OFFICIAL_ACCOUNT",
          createdAt: bookmark.created_at,
        },
        snapshot: snapshotResult,
        account: accountInfo,
        message: formatSuccessMessage(finalTitle, snapshotResult, accountInfo),
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        affectedCount: 1,
      },
    };
  } catch (error) {
    logger.error(
      { error, bookmarkId: bookmark.id },
      "WeChat article crawl failed",
    );

    return {
      success: false,
      data: {
        bookmark: {
          id: bookmark.id,
          title: bookmark.title,
          url,
          platform: "WECHAT_OFFICIAL_ACCOUNT",
          createdAt: bookmark.created_at,
        },
        message: "书签已创建，但内容抓取失败",
      },
      error: {
        code: "CRAWL_ERROR",
        message: error instanceof Error ? error.message : "抓取内容时发生错误",
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        affectedCount: 1,
      },
    };
  }
}

// ============================================
// 5. 辅助函数
// ============================================

function parseAccountInfo(
  url: string,
): { name: string; id?: string } | undefined {
  try {
    const urlObj = new URL(url);
    const biz = urlObj.searchParams.get("__biz");

    if (biz) {
      return { name: "未知公众号", id: biz };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function formatSuccessMessage(
  title: string | undefined,
  snapshot: Result["snapshot"],
  account?: { name: string },
): string {
  const parts = [`已保存文章「${title || "微信文章"}」`];

  if (snapshot?.status === "completed") {
    if (snapshot.wordCount) {
      parts.push(`${snapshot.wordCount} 字`);
    }
    if (snapshot.imagesCount) {
      parts.push(`${snapshot.imagesCount} 张图片`);
    }
  }

  if (account?.name && account.name !== "未知公众号") {
    parts.push(`来自「${account.name}」`);
  }

  return parts.join("，");
}

// ============================================
// 6. 导出 Tool 对象 (规范格式)
// ============================================

export const importWechatArticleTool: Tool<Params, Result> = {
  definition,
  execute,
};
```

### 2.5 注册到工具系统

```typescript
// src/lib/ai-agent/tools/action/index.ts

import { importWechatArticleTool } from "./import-wechat-article.tool";

export const actionTools = [
  // ... 现有 action 工具
  importWechatArticleTool,
];

export { importWechatArticleTool };
```

```typescript
// src/lib/ai-agent/tools/index.ts

import { actionTools } from "./action";

export function registerDefaultTools(): void {
  // ... 现有注册
  toolRegistry.registerAll(actionTools);
}
```

---

## 三、Tool: `list_wechat_articles`

### 3.1 功能定义

| 属性         | 值                     |
| ------------ | ---------------------- |
| **名称**     | `list_wechat_articles` |
| **分类**     | `query` (查询类工具)   |
| **风险等级** | 无风险 (只读)          |
| **确认需求** | 无需确认               |
| **预估时间** | 1000ms                 |

### 3.2 输入参数 (Zod Schema)

```typescript
const listWechatArticlesParamsSchema = z.object({
  /** AI 选择此工具的理由 (规范要求) */
  reasoning: z.string().optional().describe("AI 选择此工具的理由"),

  /** 按公众号名称筛选 (可选，模糊匹配) */
  accountName: z.string().optional(),

  /** 按公众号 ID 筛选 (可选，精确匹配) */
  accountId: z.string().optional(),

  /** 时间范围 (可选) */
  dateRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),

  /** 是否分组 (默认 true) */
  groupByAccount: z.boolean().optional().default(true),

  /** 返回数量限制 (默认 50) */
  limit: z.number().int().min(1).max(200).optional().default(50),

  /** 排序方式 (默认 newest) */
  orderBy: z.enum(["newest", "oldest"]).optional().default("newest"),

  /** 仅统计模式 (只返回统计数据) */
  statsOnly: z.boolean().optional().default(false),
});
```

### 3.3 实现方案 (符合规范)

#### 文件位置

```
src/lib/ai-agent/tools/query/
└── list-wechat-articles.tool.ts
```

#### 核心实现 (函数式导出)

```typescript
// src/lib/ai-agent/tools/query/list-wechat-articles.tool.ts

import { z } from "zod";
import { Tool, ToolDefinition, ToolResult, ToolContext } from "../types";
import { createServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";

// ============================================
// 1. 参数 Schema 定义
// ============================================

const paramsSchema = z.object({
  reasoning: z.string().optional().describe("AI 选择此工具的理由"),
  accountName: z.string().optional(),
  accountId: z.string().optional(),
  dateRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
  groupByAccount: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(200).optional().default(50),
  orderBy: z.enum(["newest", "oldest"]).optional().default("newest"),
  statsOnly: z.boolean().optional().default(false),
});

type Params = z.infer<typeof paramsSchema>;

// ============================================
// 2. 结果类型定义
// ============================================

interface ArticleSummary {
  bookmarkId: number;
  snapshotId?: number;
  title: string;
  url: string;
  wordCount?: number;
  createdAt: string;
  hasFullContent: boolean;
  excerpt?: string;
  tags: string[];
}

interface AccountGroup {
  accountName: string;
  accountId?: string;
  articleCount: number;
  articles: ArticleSummary[];
}

interface Result {
  stats: {
    totalArticles: number;
    totalAccounts: number;
    totalWordCount: number;
    dateRange: { earliest: string; latest: string };
  };
  groups?: AccountGroup[];
  articles?: ArticleSummary[];
  message: string;
}

// ============================================
// 3. Tool 定义
// ============================================

const definition: ToolDefinition<Params> = {
  name: "list_wechat_articles",
  description: `列出用户收藏的微信公众号文章，支持按公众号分组、时间筛选、统计分析。

使用场景：
- 用户问 "我收藏了哪些微信文章"
- 用户问 "我关注了哪些公众号"
- 用户问 "最近收藏了多少微信文章"
- 用户问 "XX 公众号的文章有哪些"

返回信息：
- 按公众号分组的文章列表
- 统计信息（总数、字数、时间范围）
- 每篇文章的标题、字数、标签`,

  parameters: paramsSchema,
  category: "query",
  requiresConfirmation: false,
  estimatedDurationMs: 1000,
};

// ============================================
// 4. 执行函数
// ============================================

async function execute(
  params: Params,
  context: ToolContext,
): Promise<ToolResult<Result>> {
  const startTime = Date.now();
  const {
    accountName,
    accountId,
    dateRange,
    groupByAccount,
    limit,
    orderBy,
    statsOnly,
    reasoning,
  } = params;

  if (reasoning) {
    logger.debug({ reasoning, tool: "list_wechat_articles" }, "Tool reasoning");
  }

  const supabase = await createServerClient();

  // 1. 构建查询
  let query = supabase
    .from("bookmarks")
    .select(
      `
      id,
      title,
      url,
      tags,
      created_at,
      bookmark_snapshots (
        id,
        readable_text_content,
        readable_word_count,
        readable_excerpt,
        readable_byline,
        images_status
      )
    `,
    )
    .eq("user_id", context.userId)
    .eq("platform", "WECHAT_OFFICIAL_ACCOUNT")
    .is("deleted_at", null);

  // 2. 应用时间筛选
  if (dateRange?.start) {
    query = query.gte("created_at", dateRange.start);
  }
  if (dateRange?.end) {
    query = query.lte("created_at", dateRange.end);
  }

  // 3. 应用排序
  query = query.order("created_at", { ascending: orderBy === "oldest" });

  // 4. 应用限制
  query = query.limit(limit);

  const { data: bookmarks, error } = await query;

  if (error) {
    return {
      success: false,
      error: { code: "QUERY_FAILED", message: error.message },
      metadata: { executionTimeMs: Date.now() - startTime },
    };
  }

  // 5. 解析公众号信息
  const articlesWithAccount = (bookmarks || []).map((bookmark) => {
    const snapshot = bookmark.bookmark_snapshots?.[0];
    const accountInfo = extractAccountInfo(
      bookmark.url,
      snapshot?.readable_byline,
    );

    return {
      bookmarkId: bookmark.id,
      snapshotId: snapshot?.id,
      title: bookmark.title,
      url: bookmark.url,
      wordCount: snapshot?.readable_word_count,
      createdAt: bookmark.created_at,
      hasFullContent: !!snapshot?.readable_text_content,
      excerpt: snapshot?.readable_excerpt?.substring(0, 100),
      tags: bookmark.tags || [],
      accountName: accountInfo.name,
      accountId: accountInfo.id,
    };
  });

  // 6. 应用公众号筛选
  let filteredArticles = articlesWithAccount;
  if (accountName) {
    filteredArticles = filteredArticles.filter((a) =>
      a.accountName.toLowerCase().includes(accountName.toLowerCase()),
    );
  }
  if (accountId) {
    filteredArticles = filteredArticles.filter(
      (a) => a.accountId === accountId,
    );
  }

  // 7. 计算统计信息
  const stats = {
    totalArticles: filteredArticles.length,
    totalAccounts: new Set(filteredArticles.map((a) => a.accountName)).size,
    totalWordCount: filteredArticles.reduce(
      (sum, a) => sum + (a.wordCount || 0),
      0,
    ),
    dateRange: {
      earliest:
        filteredArticles.length > 0
          ? filteredArticles[filteredArticles.length - 1].createdAt
          : "",
      latest: filteredArticles.length > 0 ? filteredArticles[0].createdAt : "",
    },
  };

  // 8. 构建结果
  if (statsOnly) {
    return {
      success: true,
      data: {
        stats,
        message: formatStatsMessage(stats),
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        affectedCount: stats.totalArticles,
      },
    };
  }

  if (groupByAccount) {
    const groups = groupArticlesByAccount(filteredArticles);
    return {
      success: true,
      data: {
        stats,
        groups,
        message: formatGroupsMessage(groups, stats),
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        affectedCount: stats.totalArticles,
      },
    };
  }

  // 移除内部字段
  const articles = filteredArticles.map(
    ({ accountName: _, accountId: __, ...rest }) => rest,
  );

  return {
    success: true,
    data: {
      stats,
      articles,
      message: formatListMessage(filteredArticles, stats),
    },
    metadata: {
      executionTimeMs: Date.now() - startTime,
      affectedCount: stats.totalArticles,
    },
  };
}

// ============================================
// 5. 辅助函数
// ============================================

function extractAccountInfo(
  url: string,
  byline?: string | null,
): { name: string; id?: string } {
  try {
    const urlObj = new URL(url);
    const biz = urlObj.searchParams.get("__biz");
    let name = "未知公众号";

    if (byline) {
      name = byline.trim();
    }

    return { name, id: biz || undefined };
  } catch {
    return { name: "未知公众号" };
  }
}

function groupArticlesByAccount(
  articles: Array<{ accountName: string; accountId?: string } & ArticleSummary>,
): AccountGroup[] {
  const groupMap = new Map<string, AccountGroup>();

  for (const article of articles) {
    const key = article.accountName;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        accountName: article.accountName,
        accountId: article.accountId,
        articleCount: 0,
        articles: [],
      });
    }

    const group = groupMap.get(key)!;
    const { accountName: _, accountId: __, ...rest } = article;
    group.articles.push(rest);
    group.articleCount = group.articles.length;
  }

  return Array.from(groupMap.values()).sort(
    (a, b) => b.articleCount - a.articleCount,
  );
}

function formatStatsMessage(stats: Result["stats"]): string {
  return `您共收藏了 ${stats.totalArticles} 篇微信文章，来自 ${stats.totalAccounts} 个公众号，总计约 ${Math.round(stats.totalWordCount / 1000)}k 字`;
}

function formatGroupsMessage(
  groups: AccountGroup[],
  stats: Result["stats"],
): string {
  const topAccounts = groups
    .slice(0, 3)
    .map((g) => `「${g.accountName}」(${g.articleCount}篇)`)
    .join("、");
  return `共 ${stats.totalArticles} 篇微信文章，主要来自 ${topAccounts}`;
}

function formatListMessage(
  articles: Array<{ title: string }>,
  stats: Result["stats"],
): string {
  if (articles.length === 0) {
    return "暂无收藏的微信文章";
  }
  const titles = articles
    .slice(0, 3)
    .map((a) => `「${a.title}」`)
    .join("、");
  return `找到 ${stats.totalArticles} 篇微信文章，包括 ${titles}${articles.length > 3 ? " 等" : ""}`;
}

// ============================================
// 6. 导出 Tool 对象 (规范格式)
// ============================================

export const listWechatArticlesTool: Tool<Params, Result> = {
  definition,
  execute,
};
```

### 3.4 注册到工具系统

```typescript
// src/lib/ai-agent/tools/query/index.ts

import { listWechatArticlesTool } from "./list-wechat-articles.tool";

export const queryTools = [
  // ... 现有 query 工具
  listWechatArticlesTool,
];

export { listWechatArticlesTool };
```

---

## 四、Skill: `WechatDigestSkill`

### 4.1 功能定义

| 属性           | 值                              |
| -------------- | ------------------------------- |
| **名称**       | `WechatDigestSkill`             |
| **ID**         | `wechat_digest`                 |
| **类型**       | 编排 Skill (OrchestrationSkill) |
| **分类**       | `understanding`                 |
| **步骤数**     | 5 步                            |
| **交付物类型** | `report`                        |
| **输出格式**   | `markdown`, `json`              |

### 4.2 Skill 元数据 (符合 OrchestrationSkillMetadata 规范)

```typescript
const metadata: OrchestrationSkillMetadata = {
  id: "wechat_digest",
  name: "微信阅读摘要",
  description: "分析微信公众号收藏，按公众号或话题生成摘要报告",
  category: "understanding",
  version: "1.0.0",
  author: "AnyKeep",
  capabilities: ["wechat", "digest", "report", "summary"],

  // 编排特有字段
  deliverableTypes: ["report"],
  outputFormats: ["markdown", "json"],
  steps: [
    { id: "analyze", name: "分析收藏集合", weight: 15 },
    { id: "extract", name: "提取主题标签", weight: 20 },
    { id: "group", name: "分组整理内容", weight: 15 },
    { id: "summarize", name: "生成各组摘要", weight: 35 },
    { id: "compile", name: "编译摘要报告", weight: 15 },
  ],

  requiresConfirmation: false,
  estimatedDurationMs: 30000,
  maxExecutionTimeMs: 120000,
};
```

### 4.3 输入/输出 Schema

```typescript
// 输入 Schema
const inputSchema = z.object({
  groupBy: z.enum(["account", "topic", "date"]).default("account"),
  dateRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
  filter: z
    .object({
      accountName: z.string().optional(),
      tags: z.array(z.string()).optional(),
      keyword: z.string().optional(),
    })
    .optional(),
  depth: z.enum(["brief", "standard", "detailed"]).default("standard"),
  maxArticles: z.number().int().min(1).max(100).default(50),
});

type WechatDigestInput = z.infer<typeof inputSchema>;

// 输出 Schema
const outputSchema = z.object({
  report: z.string(),
  data: z.object({
    overview: z.object({
      totalArticles: z.number(),
      totalAccounts: z.number(),
      totalWordCount: z.number(),
      dateRange: z.object({ start: z.string(), end: z.string() }),
      topTopics: z.array(z.string()),
    }),
    groups: z.array(
      z.object({
        name: z.string(),
        articleCount: z.number(),
        wordCount: z.number(),
        summary: z.string(),
        keyPoints: z.array(z.string()),
        articles: z.array(
          z.object({
            title: z.string(),
            url: z.string(),
            excerpt: z.string(),
          }),
        ),
      }),
    ),
    insights: z.object({
      readingTrends: z.string(),
      topRecommendations: z.array(z.string()),
      suggestions: z.array(z.string()),
    }),
  }),
});

type WechatDigestOutput = z.infer<typeof outputSchema>;
```

### 4.4 实现方案 (符合规范)

#### 文件结构

```
src/lib/ai-skills/skills/wechat-digest/
├── index.ts                          # 导出
├── wechat-digest.skill.ts            # Skill 主类
├── wechat-digest.types.ts            # 类型定义
├── steps/
│   ├── analyze-collection.step.ts    # 步骤1: 分析收藏
│   ├── extract-topics.step.ts        # 步骤2: 提取主题
│   ├── group-content.step.ts         # 步骤3: 分组内容
│   ├── generate-summaries.step.ts    # 步骤4: 生成摘要
│   └── compile-report.step.ts        # 步骤5: 编译报告
└── __tests__/
    └── wechat-digest.skill.test.ts   # 测试
```

#### Skill 主类实现 (符合规范)

```typescript
// src/lib/ai-skills/skills/wechat-digest/wechat-digest.skill.ts

import { z } from "zod";
import {
  OrchestrationSkill,
  OrchestrationSkillMetadata,
  OrchestrationContext,
  OrchestrationStreamChunk,
} from "../../orchestration/orchestration-skill";
import { SkillContext, SkillOutput } from "../../core/types";
import {
  WechatDigestInput,
  WechatDigestOutput,
  WechatDigestContext,
  inputSchema,
  outputSchema,
} from "./wechat-digest.types";

// 步骤导入
import { analyzeCollectionStep } from "./steps/analyze-collection.step";
import { extractTopicsStep } from "./steps/extract-topics.step";
import { groupContentStep } from "./steps/group-content.step";
import { generateSummariesStep } from "./steps/generate-summaries.step";
import { compileReportStep } from "./steps/compile-report.step";

export class WechatDigestSkill extends OrchestrationSkill<
  WechatDigestInput,
  WechatDigestOutput
> {
  // ============================================
  // 1. 元数据定义 (规范格式)
  // ============================================

  readonly metadata: OrchestrationSkillMetadata = {
    id: "wechat_digest",
    name: "微信阅读摘要",
    description: "分析微信公众号收藏，按公众号或话题生成摘要报告",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["wechat", "digest", "report", "summary"],
    deliverableTypes: ["report"],
    outputFormats: ["markdown", "json"],
    steps: [
      { id: "analyze", name: "分析收藏集合", weight: 15 },
      { id: "extract", name: "提取主题标签", weight: 20 },
      { id: "group", name: "分组整理内容", weight: 15 },
      { id: "summarize", name: "生成各组摘要", weight: 35 },
      { id: "compile", name: "编译摘要报告", weight: 15 },
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 30000,
    maxExecutionTimeMs: 120000,
  };

  readonly inputSchema = inputSchema;
  readonly outputSchema = outputSchema;

  // ============================================
  // 2. parseInput - 解析自然语言输入 (规范要求)
  // ============================================

  async parseInput(
    message: string,
    context: OrchestrationContext,
  ): Promise<WechatDigestInput> {
    // 解析分组方式
    let groupBy: "account" | "topic" | "date" = "account";
    if (/按(话题|主题|标签)/.test(message)) {
      groupBy = "topic";
    } else if (/按(日期|时间|天)/.test(message)) {
      groupBy = "date";
    }

    // 解析时间范围
    let dateRange: { start?: string; end?: string } | undefined;
    const weekMatch = message.match(/最近(\d+)?周/);
    const monthMatch = message.match(/最近(\d+)?个?月/);
    const dayMatch = message.match(/最近(\d+)?天/);

    if (weekMatch) {
      const weeks = parseInt(weekMatch[1] || "1", 10);
      const start = new Date();
      start.setDate(start.getDate() - weeks * 7);
      dateRange = { start: start.toISOString() };
    } else if (monthMatch) {
      const months = parseInt(monthMatch[1] || "1", 10);
      const start = new Date();
      start.setMonth(start.getMonth() - months);
      dateRange = { start: start.toISOString() };
    } else if (dayMatch) {
      const days = parseInt(dayMatch[1] || "7", 10);
      const start = new Date();
      start.setDate(start.getDate() - days);
      dateRange = { start: start.toISOString() };
    }

    // 解析公众号筛选
    let filter: WechatDigestInput["filter"];
    const accountMatch = message.match(/「(.+?)」|"(.+?)"|【(.+?)】/);
    if (accountMatch) {
      filter = {
        accountName: accountMatch[1] || accountMatch[2] || accountMatch[3],
      };
    }

    // 解析摘要深度
    let depth: "brief" | "standard" | "detailed" = "standard";
    if (/简单|简要|快速/.test(message)) {
      depth = "brief";
    } else if (/详细|深入|完整/.test(message)) {
      depth = "detailed";
    }

    return {
      groupBy,
      dateRange,
      filter,
      depth,
      maxArticles: 50,
    };
  }

  // ============================================
  // 3. executeStream - 流式执行 (规范要求)
  // ============================================

  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const input = context.parsedInput as WechatDigestInput;

    // 初始化 Skill 上下文
    const skillContext: WechatDigestContext = {
      input,
      userId: context.userId,
      articles: [],
      topics: [],
      groups: [],
      summaries: [],
    };

    // ========== 步骤 1: 分析收藏集合 ==========
    yield* this.emitText("📚 正在分析您的微信收藏...\n");
    yield* this.reportProgress("analyze", 0, "获取文章列表");

    context.cancellationToken?.throwIfCancelled();

    const collectionResult = await analyzeCollectionStep(skillContext, context);
    skillContext.articles = collectionResult.articles;
    skillContext.stats = collectionResult.stats;

    yield* this.reportProgress(
      "analyze",
      100,
      `找到 ${skillContext.stats.totalArticles} 篇文章`,
    );
    yield* this.emitText(
      `\n✅ 共找到 ${skillContext.stats.totalArticles} 篇微信文章，来自 ${skillContext.stats.totalAccounts} 个公众号\n`,
    );

    if (skillContext.articles.length === 0) {
      yield* this.emitText(
        "\n⚠️ 未找到符合条件的微信文章，请调整筛选条件后重试。",
      );
      yield* this.emitDone(false, "未找到微信文章");
      return;
    }

    // ========== 步骤 2: 提取主题 ==========
    yield* this.reportProgress("extract", 0, "分析文章主题");
    context.cancellationToken?.throwIfCancelled();

    const topicsResult = await extractTopicsStep(skillContext, context);
    skillContext.topics = topicsResult.topics;

    yield* this.reportProgress(
      "extract",
      100,
      `提取了 ${skillContext.topics.length} 个主题`,
    );
    yield* this.emitText(
      `\n🏷️ 主要话题: ${skillContext.topics.slice(0, 5).join("、")}\n`,
    );

    // ========== 步骤 3: 分组内容 ==========
    yield* this.reportProgress("group", 0, "按条件分组");
    context.cancellationToken?.throwIfCancelled();

    const groupsResult = await groupContentStep(skillContext, input.groupBy);
    skillContext.groups = groupsResult.groups;

    yield* this.reportProgress(
      "group",
      100,
      `分为 ${skillContext.groups.length} 组`,
    );

    // ========== 步骤 4: 生成摘要 ==========
    yield* this.emitText("\n📝 正在生成各组摘要...\n");
    yield* this.reportProgress("summarize", 0, "调用 AI 生成摘要");

    const summariesResult = await generateSummariesStep(
      skillContext,
      context,
      input.depth || "standard",
      async (progress) => {
        // 流式进度更新
        yield *
          this.reportProgress("summarize", progress, `处理中 ${progress}%`);
      },
      context.cancellationToken,
    );
    skillContext.summaries = summariesResult.summaries;
    skillContext.insights = summariesResult.insights;

    yield* this.reportProgress("summarize", 100, "摘要生成完成");

    // ========== 步骤 5: 编译报告 ==========
    yield* this.reportProgress("compile", 0, "编译最终报告");
    context.cancellationToken?.throwIfCancelled();

    const report = await compileReportStep(skillContext, input);

    yield* this.reportProgress("compile", 100, "报告编译完成");

    // ========== 输出交付物 ==========
    const deliverable = this.createDeliverable(
      "report",
      "微信阅读摘要报告",
      report.markdown,
      "markdown",
      {
        downloadable: true,
        fileName: `wechat-digest-${new Date().toISOString().split("T")[0]}.md`,
      },
    );

    yield* this.emitDeliverable(deliverable);

    // ========== 输出建议 ==========
    if (skillContext.insights?.suggestions) {
      yield* this.emitSuggestions(
        skillContext.insights.suggestions.map((s) => ({
          text: s,
          action: "info",
        })),
      );
    }

    yield* this.emitDone(true, "微信阅读摘要报告已生成");
  }

  // ============================================
  // 4. executeInternal - 非流式执行 (兼容原子模式)
  // ============================================

  protected async executeInternal(
    input: WechatDigestInput,
    context: SkillContext,
  ): Promise<WechatDigestOutput> {
    // 构建编排上下文
    const orchestrationContext: OrchestrationContext = {
      ...context,
      parsedInput: input,
      cancellationToken: undefined,
    };

    // 收集流式输出
    let report = "";
    const data: WechatDigestOutput["data"] = {
      overview: {
        totalArticles: 0,
        totalAccounts: 0,
        totalWordCount: 0,
        dateRange: { start: "", end: "" },
        topTopics: [],
      },
      groups: [],
      insights: {
        readingTrends: "",
        topRecommendations: [],
        suggestions: [],
      },
    };

    for await (const chunk of this.executeStream(orchestrationContext)) {
      if (chunk.type === "deliverable" && chunk.data.content) {
        report = chunk.data.content as string;
      }
    }

    return { report, data };
  }
}

// 导出单例
export const wechatDigestSkill = new WechatDigestSkill();
```

### 4.5 注册 Skill

```typescript
// src/lib/ai-skills/skills/index.ts

import { wechatDigestSkill } from "./wechat-digest";

export const orchestrationSkills = [
  // ... 现有 Skills
  wechatDigestSkill,
];

// 注册到 SkillRegistry
skillRegistry.register(wechatDigestSkill);
```

---

## 五、前端集成

### 5.1 无需新增前端组件

经验证，现有前端架构已完全支持新 Tools 和 Skills：

| 现有能力     | 说明                                    |
| ------------ | --------------------------------------- |
| 统一 API     | `/api/agent/unified` 已支持所有类型     |
| SSE 流式处理 | 前端已有通用处理逻辑                    |
| 进度展示     | `type: "progress"` 已有展示组件         |
| 交付物展示   | `type: "deliverable"` 已有下载/预览组件 |
| 文本渲染     | `type: "text"` 已有 Markdown 渲染       |

### 5.2 用户交互流程

```
用户输入: "帮我总结最近的微信收藏"
        ↓
[/api/agent/unified] - POST
        ↓
[意图分类] → wechat_digest Skill
        ↓
[编排模式] → WechatDigestSkill.executeStream()
        ↓
SSE 流式响应:
  - type: "text" → "📚 正在分析您的微信收藏..."
  - type: "progress" → { step: "analyze", percent: 50 }
  - type: "progress" → { step: "summarize", percent: 80 }
  - type: "deliverable" → { content: "# 微信阅读摘要报告...", format: "markdown" }
  - type: "done" → { success: true }
        ↓
前端展示: Markdown 报告 + 下载按钮
```

---

## 六、意图路由配置

### 6.1 意图模式

```typescript
// src/lib/ai-skills/config/intent-patterns.ts

export const wechatIntentPatterns = {
  // Tool: import_wechat_article
  import_wechat_article: [
    /保存.*微信/i,
    /收藏.*公众号/i,
    /导入.*mp\.weixin/i,
    /保存.*mp\.weixin/i,
  ],

  // Tool: list_wechat_articles
  list_wechat_articles: [
    /微信.*文章.*列表/i,
    /公众号.*收藏/i,
    /哪些.*微信/i,
    /关注.*公众号/i,
    /微信.*统计/i,
  ],

  // Skill: wechat_digest
  wechat_digest: [
    /总结.*微信/i,
    /微信.*摘要/i,
    /公众号.*总结/i,
    /概括.*微信/i,
    /微信.*报告/i,
  ],
};
```

---

## 七、文件变更清单

### 7.1 新增文件

```
src/lib/ai-agent/tools/action/
└── import-wechat-article.tool.ts     # Tool 实现

src/lib/ai-agent/tools/query/
└── list-wechat-articles.tool.ts      # Tool 实现

src/lib/ai-skills/skills/wechat-digest/
├── index.ts                          # 导出
├── wechat-digest.skill.ts            # Skill 主类
├── wechat-digest.types.ts            # 类型定义
├── steps/
│   ├── analyze-collection.step.ts
│   ├── extract-topics.step.ts
│   ├── group-content.step.ts
│   ├── generate-summaries.step.ts
│   └── compile-report.step.ts
└── __tests__/
    └── wechat-digest.skill.test.ts
```

### 7.2 修改文件

```
src/lib/ai-agent/tools/action/index.ts         # 添加 Tool 导出
src/lib/ai-agent/tools/query/index.ts          # 添加 Tool 导出
src/lib/ai-agent/tools/index.ts                # 注册新 Tools
src/lib/ai-skills/skills/index.ts              # 注册新 Skill
src/lib/ai-skills/config/intent-patterns.ts   # 添加意图模式
```

---

## 八、实施计划

| 阶段    | 内容                          | 预估时间 |
| ------- | ----------------------------- | -------- |
| Phase 1 | Tool: `import_wechat_article` | 2-3 小时 |
| Phase 2 | Tool: `list_wechat_articles`  | 2-3 小时 |
| Phase 3 | Skill: `WechatDigestSkill`    | 4-6 小时 |
| Phase 4 | 测试与验收                    | 2-3 小时 |

---

## 九、验收标准

### 9.1 功能验收

| 功能                    | 验收标准                                       |
| ----------------------- | ---------------------------------------------- |
| `import_wechat_article` | 能通过链接成功导入微信文章，自动抓取内容和图片 |
| `list_wechat_articles`  | 能按公众号分组显示文章，支持时间筛选           |
| `WechatDigestSkill`     | 能生成包含摘要、要点、洞察的 Markdown 报告     |

### 9.2 质量验收

- [ ] TypeScript 类型检查通过
- [ ] 单元测试覆盖率 > 80%
- [ ] ESLint 无错误
- [ ] 生产构建成功

### 9.3 用户体验验收

| 场景 | 用户输入                                  | 预期响应                              |
| ---- | ----------------------------------------- | ------------------------------------- |
| 导入 | "保存这篇 https://mp.weixin.qq.com/s/xxx" | "已保存文章「标题」，2500字，8张图片" |
| 列表 | "我收藏了哪些微信文章"                    | 按公众号分组显示列表                  |
| 摘要 | "帮我总结最近的微信收藏"                  | 流式显示进度 + Markdown 报告          |

---

## 十、规范对照检查表

| 检查项                                                 | 状态 |
| ------------------------------------------------------ | ---- |
| Tool 使用 `Tool<TParams, TResult>` 对象导出            | ✅   |
| Tool 使用下划线命名 (`import_wechat_article`)          | ✅   |
| Tool 分类使用标准枚举 (`action` / `query`)             | ✅   |
| Tool 参数包含 `reasoning` 字段                         | ✅   |
| Tool 返回包含 `metadata.executionTimeMs`               | ✅   |
| Tool 注册到对应 `index.ts`                             | ✅   |
| Skill 继承 `OrchestrationSkill`                        | ✅   |
| Skill 使用 `OrchestrationSkillMetadata`                | ✅   |
| Skill 实现 `parseInput()` 方法                         | ✅   |
| Skill 实现 `executeStream()` 方法                      | ✅   |
| Skill 使用 `emitText()` / `reportProgress()`           | ✅   |
| Skill 使用 `createDeliverable()` / `emitDeliverable()` | ✅   |
| Skill 实现 `executeInternal()` 兼容原子模式            | ✅   |
| 前端无需新增组件                                       | ✅   |

---

_文档更新完成 - 版本 2.0.0 - 等待审核_
