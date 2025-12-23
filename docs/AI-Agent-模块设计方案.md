# AnyKeep AI Agent 模块设计方案

> **版本**: 1.0.0
> **创建日期**: 2024-12-22
> **状态**: 待审核
> **对标产品**: YouMind AI 助手

---

## 一、设计目标

### 1.1 核心目标

将 AnyKeep AI 助手从 **纯 RAG 模式** 升级为 **Agent + Tools 模式**，实现：

| 能力     | 当前状态    | 目标状态              |
| -------- | ----------- | --------------------- |
| 数据感知 | ❌ 无法统计 | ✅ 可统计、查询、筛选 |
| 内容理解 | ⚠️ 仅片段   | ✅ 可读取完整内容     |
| 操作执行 | ❌ 无       | ✅ 可创建、更新、删除 |
| 快捷指令 | ❌ 无       | ✅ 预设工作流         |

### 1.2 设计原则

| 原则           | 说明                               |
| -------------- | ---------------------------------- |
| **功能解耦**   | Agent 模块独立，不侵入现有业务模块 |
| **渐进式上线** | 分阶段实施，每阶段可独立上线       |
| **复用优先**   | 最大程度复用现有 Repository 和 API |
| **安全第一**   | 所有操作经过权限验证和确认机制     |
| **可扩展性**   | Tools 可独立添加，不影响核心逻辑   |

---

## 二、架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              前端层 (Frontend)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   ChatPanel     │  │  QuickCommands  │  │  AgentStatus    │              │
│  │  (现有+增强)     │  │   (新增组件)     │  │   (新增组件)     │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
│                    ┌───────────▼───────────┐                                │
│                    │     useAgent Hook     │  ← 新增：Agent 状态管理          │
│                    │   (扩展 useChat)       │                                │
│                    └───────────┬───────────┘                                │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
                                 │ HTTP/SSE
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                              API 层 (API Routes)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    POST /api/agent/chat                              │   │
│  │                    (新增 Agent API)                                   │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                          │
│  ┌──────────────────────────────▼──────────────────────────────────────┐   │
│  │                         Agent 服务层                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │                   AgentService (新增)                        │    │   │
│  │  │  - 解析用户意图                                               │    │   │
│  │  │  - 调用 LLM + Tool Calling                                   │    │   │
│  │  │  - 协调 Tools 执行                                           │    │   │
│  │  │  - 流式返回结果                                               │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────────┐
│                              Tools 层 (新增模块)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │  数据查询     │ │  内容阅读     │ │  操作执行     │ │  向量搜索     │       │
│  │  Tools       │ │  Tools       │ │  Tools       │ │  Tool        │       │
│  ├──────────────┤ ├──────────────┤ ├──────────────┤ ├──────────────┤       │
│  │count_bookmarks│ │read_bookmark │ │create_bookmark│ │search_by_    │       │
│  │list_bookmarks│ │read_folder   │ │update_bookmark│ │embedding     │       │
│  │get_stats     │ │              │ │move_bookmarks │ │(现有RAG)     │       │
│  │              │ │              │ │batch_tags    │ │              │       │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘       │
│         │                │                │                │               │
│         └────────────────┼────────────────┼────────────────┘               │
│                          │                │                                 │
│                    ┌─────▼────────────────▼─────┐                           │
│                    │      Tool 执行引擎          │                           │
│                    │   (权限验证 + 执行 + 日志)   │                           │
│                    └─────────────┬──────────────┘                           │
│                                  │                                          │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────────────┐
│                           现有业务层 (复用)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ BookmarkRepo    │  │  FolderRepo     │  │  RAGRetrieval   │              │
│  │ (现有)          │  │  (现有)          │  │  Service (现有)  │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
│                    ┌───────────▼───────────┐                                │
│                    │      Supabase         │                                │
│                    │   (数据库 + RLS)       │                                │
│                    └───────────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块边界

```
src/
├── lib/
│   ├── agent/                    # 🆕 新增：Agent 模块（核心）
│   │   ├── agent.service.ts      # Agent 服务（决策中心）
│   │   ├── tool-executor.ts      # Tool 执行引擎
│   │   ├── tool-registry.ts      # Tool 注册表
│   │   ├── types.ts              # Agent 类型定义
│   │   └── tools/                # 🆕 Tools 子模块
│   │       ├── index.ts          # Tools 统一导出
│   │       ├── query/            # 数据查询 Tools
│   │       │   ├── count-bookmarks.tool.ts
│   │       │   ├── list-bookmarks.tool.ts
│   │       │   └── get-stats.tool.ts
│   │       ├── read/             # 内容阅读 Tools
│   │       │   ├── read-bookmark.tool.ts
│   │       │   └── read-folder.tool.ts
│   │       ├── action/           # 操作执行 Tools
│   │       │   ├── create-bookmark.tool.ts
│   │       │   ├── update-bookmark.tool.ts
│   │       │   ├── move-bookmarks.tool.ts
│   │       │   └── batch-tags.tool.ts
│   │       └── search/           # 搜索 Tools
│   │           └── semantic-search.tool.ts
│   │
│   ├── chat/                     # 现有：保持不变
│   │   ├── chat.service.ts       # (保留，作为降级方案)
│   │   ├── rag-retrieval.service.ts
│   │   └── cost-control.service.ts
│   │
│   └── repositories/             # 现有：被 Tools 复用
│       ├── bookmark.repository.ts
│       └── folder.repository.ts
│
├── app/api/
│   ├── agent/                    # 🆕 新增：Agent API
│   │   └── chat/
│   │       └── route.ts          # POST /api/agent/chat
│   │
│   └── chat/                     # 现有：保持不变（降级方案）
│       └── route.ts
│
├── components/
│   ├── agent/                    # 🆕 新增：Agent UI 组件
│   │   ├── agent-panel.tsx       # Agent 对话面板
│   │   ├── agent-button.tsx      # Agent 入口按钮
│   │   ├── quick-commands.tsx    # 快捷指令面板
│   │   ├── tool-execution.tsx    # Tool 执行状态显示
│   │   └── action-confirm.tsx    # 操作确认对话框
│   │
│   └── chat/                     # 现有：保持不变
│       ├── chat-panel.tsx
│       └── chat-button.tsx
│
└── hooks/
    └── domain/ai/
        ├── use-chat.ts           # 现有：保持不变
        └── use-agent.ts          # 🆕 新增：Agent Hook
```

### 2.3 解耦策略

| 层级         | 解耦方式                       | 说明                         |
| ------------ | ------------------------------ | ---------------------------- |
| **API 层**   | 新增独立路由 `/api/agent/chat` | 不修改现有 `/api/chat`       |
| **服务层**   | 新增 `AgentService`            | 不修改现有 `ChatService`     |
| **Tools 层** | 独立模块 `lib/agent/tools/`    | 通过 Repository 复用数据访问 |
| **UI 层**    | 新增 `components/agent/`       | 可渐进替换现有 Chat 组件     |
| **状态层**   | 新增 `useAgent` Hook           | 扩展而非替换 `useChat`       |

---

## 三、Tools 详细设计

### 3.1 Tool 接口定义

```typescript
// src/lib/agent/types.ts

/**
 * Tool 定义接口
 */
export interface ToolDefinition {
  /** Tool 唯一标识 */
  name: string;
  /** Tool 描述（供 LLM 理解用途） */
  description: string;
  /** 参数 JSON Schema */
  parameters: {
    type: "object";
    properties: Record<string, JSONSchemaProperty>;
    required?: string[];
  };
  /** 是否需要用户确认（危险操作） */
  requiresConfirmation?: boolean;
  /** Tool 分类 */
  category: "query" | "read" | "action" | "search";
}

/**
 * Tool 执行上下文
 */
export interface ToolContext {
  /** 用户 ID */
  userId: string;
  /** Supabase 客户端 */
  supabase: SupabaseClient;
  /** 日志记录器 */
  logger: Logger;
}

/**
 * Tool 执行结果
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  /** 执行元数据 */
  metadata?: {
    executionTimeMs: number;
    affectedCount?: number;
  };
}

/**
 * Tool 实现接口
 */
export interface Tool<TParams = unknown, TResult = unknown> {
  definition: ToolDefinition;
  execute: (
    params: TParams,
    context: ToolContext,
  ) => Promise<ToolResult<TResult>>;
}
```

### 3.2 数据查询 Tools

#### 3.2.1 count_bookmarks

```typescript
// src/lib/agent/tools/query/count-bookmarks.tool.ts

import type { Tool, ToolContext, ToolResult } from "../../types";
import { createClient } from "@/lib/supabase/server";

interface CountBookmarksParams {
  folder_id?: number;
  platform?: string;
  date_from?: string; // ISO 日期
  date_to?: string;
  has_tags?: boolean;
}

interface CountBookmarksResult {
  total: number;
  by_platform?: Record<string, number>;
  by_folder?: Record<string, { id: number; name: string; count: number }>;
}

export const countBookmarksTool: Tool<
  CountBookmarksParams,
  CountBookmarksResult
> = {
  definition: {
    name: "count_bookmarks",
    description:
      '统计用户的书签数量，支持按文件夹、平台、时间范围筛选。用于回答"我有多少收藏"、"最近一周收藏了多少"等问题。',
    parameters: {
      type: "object",
      properties: {
        folder_id: {
          type: "number",
          description: "限定到特定文件夹 ID",
        },
        platform: {
          type: "string",
          description: "限定平台，如 WECHAT、BILIBILI、XIAOHONGSHU、WEB",
        },
        date_from: {
          type: "string",
          description: "起始日期（ISO 格式），如 2024-12-01",
        },
        date_to: {
          type: "string",
          description: "结束日期（ISO 格式），如 2024-12-22",
        },
        has_tags: {
          type: "boolean",
          description: "是否只统计有标签的书签",
        },
      },
      required: [],
    },
    category: "query",
    requiresConfirmation: false,
  },

  async execute(params, context): Promise<ToolResult<CountBookmarksResult>> {
    const startTime = Date.now();

    try {
      const supabase = await createClient();

      // 构建基础查询
      let query = supabase
        .from("bookmarks")
        .select("id, platform, folder_id, folders(id, name)", {
          count: "exact",
        })
        .eq("user_id", context.userId);

      // 应用筛选条件
      if (params.folder_id) {
        query = query.eq("folder_id", params.folder_id);
      }
      if (params.platform) {
        query = query.eq("platform", params.platform);
      }
      if (params.date_from) {
        query = query.gte("created_at", params.date_from);
      }
      if (params.date_to) {
        query = query.lte("created_at", params.date_to);
      }
      if (params.has_tags !== undefined) {
        if (params.has_tags) {
          query = query.not("ai_tags", "is", null);
        } else {
          query = query.is("ai_tags", null);
        }
      }

      const { data, count, error } = await query;

      if (error) throw error;

      // 计算分组统计
      const byPlatform: Record<string, number> = {};
      const byFolder: Record<
        string,
        { id: number; name: string; count: number }
      > = {};

      data?.forEach((item: any) => {
        // 平台统计
        const platform = item.platform || "OTHER";
        byPlatform[platform] = (byPlatform[platform] || 0) + 1;

        // 文件夹统计
        if (item.folders?.name) {
          const folderKey = String(item.folder_id);
          if (!byFolder[folderKey]) {
            byFolder[folderKey] = {
              id: item.folder_id,
              name: item.folders.name,
              count: 0,
            };
          }
          byFolder[folderKey].count++;
        }
      });

      return {
        success: true,
        data: {
          total: count || 0,
          by_platform: byPlatform,
          by_folder: byFolder,
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "统计失败",
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    }
  },
};
```

#### 3.2.2 list_bookmarks

```typescript
// src/lib/agent/tools/query/list-bookmarks.tool.ts

export const listBookmarksTool: Tool<ListBookmarksParams, ListBookmarksResult> =
  {
    definition: {
      name: "list_bookmarks",
      description:
        '列出用户的书签，支持分页、排序和筛选。用于回答"我收藏了哪些XX相关的内容"、"最近收藏的是什么"等问题。',
      parameters: {
        type: "object",
        properties: {
          folder_id: { type: "number", description: "文件夹 ID" },
          platform: { type: "string", description: "平台筛选" },
          limit: {
            type: "number",
            description: "返回数量限制，默认 10，最大 50",
          },
          offset: { type: "number", description: "分页偏移量" },
          order_by: {
            type: "string",
            enum: ["created_at_desc", "created_at_asc", "title_asc"],
            description: "排序方式",
          },
          search_keyword: { type: "string", description: "标题关键词搜索" },
        },
        required: [],
      },
      category: "query",
      requiresConfirmation: false,
    },

    async execute(params, context): Promise<ToolResult<ListBookmarksResult>> {
      // 实现略，复用 bookmarkRepository.getList
    },
  };
```

#### 3.2.3 get_stats

```typescript
// src/lib/agent/tools/query/get-stats.tool.ts

export const getStatsTool: Tool<{}, GetStatsResult> = {
  definition: {
    name: "get_stats",
    description:
      '获取用户书签的综合统计信息，包括总数、各平台分布、标签分布、时间趋势等。用于回答"我的收藏情况如何"、"哪个平台的收藏最多"等问题。',
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    category: "query",
    requiresConfirmation: false,
  },

  async execute(_, context): Promise<ToolResult<GetStatsResult>> {
    const startTime = Date.now();

    try {
      const supabase = await createClient();

      // 并行查询多个统计
      const [
        totalResult,
        platformResult,
        folderResult,
        tagsResult,
        recentResult,
      ] = await Promise.all([
        // 总数
        supabase
          .from("bookmarks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", context.userId),

        // 平台分布
        supabase
          .from("bookmarks")
          .select("platform")
          .eq("user_id", context.userId),

        // 文件夹分布
        supabase
          .from("bookmarks")
          .select("folder_id, folders(name)")
          .eq("user_id", context.userId),

        // 标签统计
        supabase
          .from("bookmarks")
          .select("ai_tags")
          .eq("user_id", context.userId)
          .not("ai_tags", "is", null),

        // 最近 7 天
        supabase
          .from("bookmarks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", context.userId)
          .gte(
            "created_at",
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          ),
      ]);

      // 处理平台分布
      const platformCounts: Record<string, number> = {};
      platformResult.data?.forEach((item: any) => {
        const p = item.platform || "OTHER";
        platformCounts[p] = (platformCounts[p] || 0) + 1;
      });

      // 处理标签统计
      const tagCounts: Record<string, number> = {};
      tagsResult.data?.forEach((item: any) => {
        item.ai_tags?.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });
      const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));

      return {
        success: true,
        data: {
          total_bookmarks: totalResult.count || 0,
          total_folders: new Set(
            folderResult.data?.map((f: any) => f.folder_id).filter(Boolean),
          ).size,
          platforms: platformCounts,
          recent_7_days: recentResult.count || 0,
          top_tags: topTags,
        },
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取统计失败",
      };
    }
  },
};
```

### 3.3 内容阅读 Tools

#### 3.3.1 read_bookmark

```typescript
// src/lib/agent/tools/read/read-bookmark.tool.ts

export const readBookmarkTool: Tool<ReadBookmarkParams, ReadBookmarkResult> = {
  definition: {
    name: "read_bookmark",
    description:
      "读取书签的完整内容，包括标题、摘要、正文、标签等。用于深度理解和总结某个收藏的内容。",
    parameters: {
      type: "object",
      properties: {
        bookmark_id: {
          type: "number",
          description: "书签 ID",
        },
        include_full_content: {
          type: "boolean",
          description: "是否包含完整正文内容（可能很长）",
        },
      },
      required: ["bookmark_id"],
    },
    category: "read",
    requiresConfirmation: false,
  },

  async execute(params, context): Promise<ToolResult<ReadBookmarkResult>> {
    const startTime = Date.now();

    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("bookmarks")
        .select(
          `
          id,
          title,
          url,
          description,
          ai_summary,
          ai_tags,
          platform,
          created_at,
          folders(name),
          wechat_articles(content, author, publish_time)
        `,
        )
        .eq("id", params.bookmark_id)
        .eq("user_id", context.userId)
        .single();

      if (error) throw error;
      if (!data) throw new Error("书签不存在或无权访问");

      const result: ReadBookmarkResult = {
        id: data.id,
        title: data.title,
        url: data.url,
        description: data.description,
        ai_summary: data.ai_summary,
        ai_tags: data.ai_tags,
        platform: data.platform,
        folder_name: data.folders?.name,
        created_at: data.created_at,
      };

      // 如果请求完整内容且有微信文章内容
      if (params.include_full_content && data.wechat_articles?.[0]) {
        result.full_content = data.wechat_articles[0].content;
        result.author = data.wechat_articles[0].author;
        result.publish_time = data.wechat_articles[0].publish_time;
      }

      return {
        success: true,
        data: result,
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "读取失败",
      };
    }
  },
};
```

### 3.4 操作执行 Tools

#### 3.4.1 create_bookmark

```typescript
// src/lib/agent/tools/action/create-bookmark.tool.ts

export const createBookmarkTool: Tool<
  CreateBookmarkParams,
  CreateBookmarkResult
> = {
  definition: {
    name: "create_bookmark",
    description:
      "创建新的书签/笔记。用于保存 AI 生成的内容或用户想要记录的信息。",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "标题" },
        content: { type: "string", description: "内容（Markdown 格式）" },
        folder_id: { type: "number", description: "目标文件夹 ID" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "标签列表",
        },
      },
      required: ["title", "content"],
    },
    category: "action",
    requiresConfirmation: true, // ⚠️ 需要用户确认
  },

  async execute(params, context): Promise<ToolResult<CreateBookmarkResult>> {
    // 实现：调用 bookmarkRepository.create
    // 生成内部 URL，标记为 AI 生成
  },
};
```

#### 3.4.2 batch_tags

```typescript
// src/lib/agent/tools/action/batch-tags.tool.ts

export const batchTagsTool: Tool<BatchTagsParams, BatchTagsResult> = {
  definition: {
    name: "batch_tags",
    description: "批量添加或移除书签标签。用于批量整理收藏的标签。",
    parameters: {
      type: "object",
      properties: {
        bookmark_ids: {
          type: "array",
          items: { type: "number" },
          description: "书签 ID 列表",
        },
        action: {
          type: "string",
          enum: ["add", "remove"],
          description: "操作类型",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "要添加或移除的标签",
        },
      },
      required: ["bookmark_ids", "action", "tags"],
    },
    category: "action",
    requiresConfirmation: true, // ⚠️ 需要用户确认
  },

  async execute(params, context): Promise<ToolResult<BatchTagsResult>> {
    // 实现：调用现有的 batch_add_tags / batch_remove_tags RPC
  },
};
```

### 3.5 搜索 Tools

#### 3.5.1 semantic_search

```typescript
// src/lib/agent/tools/search/semantic-search.tool.ts

export const semanticSearchTool: Tool<
  SemanticSearchParams,
  SemanticSearchResult
> = {
  definition: {
    name: "semantic_search",
    description: "基于语义相似度搜索书签。用于找到与某个主题相关的收藏内容。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词或描述" },
        limit: { type: "number", description: "返回数量限制，默认 5" },
        min_similarity: {
          type: "number",
          description: "最小相似度阈值，默认 0.5",
        },
        folder_id: { type: "number", description: "限定文件夹" },
      },
      required: ["query"],
    },
    category: "search",
    requiresConfirmation: false,
  },

  async execute(params, context): Promise<ToolResult<SemanticSearchResult>> {
    // 实现：复用现有的 ragRetrievalService.retrieve
  },
};
```

---

## 四、Agent 服务设计

### 4.1 AgentService 核心逻辑

```typescript
// src/lib/agent/agent.service.ts

import { logger } from "@/lib/logger";
import { toolRegistry } from "./tool-registry";
import { toolExecutor } from "./tool-executor";
import type { Tool, ToolContext, ToolResult } from "./types";

/**
 * Agent 请求
 */
export interface AgentRequest {
  userId: string;
  query: string;
  conversationHistory?: ChatMessage[];
  options?: {
    maxIterations?: number; // 最大 Tool 调用次数
    temperature?: number;
    stream?: boolean;
  };
}

/**
 * Agent 事件（流式响应）
 */
export type AgentEvent =
  | { type: "thinking"; data: { thought: string } }
  | { type: "tool_call"; data: { tool: string; params: unknown } }
  | { type: "tool_result"; data: { tool: string; result: ToolResult } }
  | { type: "content"; data: { delta: string } }
  | {
      type: "action_confirm";
      data: { tool: string; params: unknown; description: string };
    }
  | { type: "done"; data: { totalTime: number } }
  | { type: "error"; data: { message: string } };

/**
 * Agent 服务
 */
export class AgentService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    // 使用支持 Tool Calling 的模型
    this.apiKey =
      process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || "";
    this.baseUrl = process.env.OPENAI_API_KEY
      ? "https://api.openai.com/v1/chat/completions"
      : "https://api.deepseek.com/v1/chat/completions";
    this.model = process.env.OPENAI_API_KEY
      ? "gpt-4-turbo-preview"
      : "deepseek-chat";
  }

  /**
   * Agent 对话（流式）
   */
  async *chat(request: AgentRequest): AsyncGenerator<AgentEvent> {
    const startTime = Date.now();
    const maxIterations = request.options?.maxIterations ?? 5;
    let iteration = 0;

    const context: ToolContext = {
      userId: request.userId,
      supabase: await createClient(),
      logger,
    };

    // 构建系统提示词
    const systemPrompt = this.buildSystemPrompt();

    // 构建消息历史
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...(request.conversationHistory || []),
      { role: "user", content: request.query },
    ];

    // 获取所有可用的 Tools
    const tools = toolRegistry.getAllTools();
    const toolsForLLM = tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.definition.name,
        description: t.definition.description,
        parameters: t.definition.parameters,
      },
    }));

    try {
      while (iteration < maxIterations) {
        iteration++;

        // 调用 LLM
        const response = await this.callLLM(messages, toolsForLLM, {
          temperature: request.options?.temperature ?? 0.7,
          stream: false, // Tool Calling 不支持流式
        });

        const assistantMessage = response.choices[0].message;

        // 检查是否有 Tool 调用
        if (
          assistantMessage.tool_calls &&
          assistantMessage.tool_calls.length > 0
        ) {
          messages.push(assistantMessage);

          for (const toolCall of assistantMessage.tool_calls) {
            const toolName = toolCall.function.name;
            const toolParams = JSON.parse(toolCall.function.arguments);

            yield {
              type: "tool_call",
              data: { tool: toolName, params: toolParams },
            };

            // 检查是否需要确认
            const tool = toolRegistry.getTool(toolName);
            if (tool?.definition.requiresConfirmation) {
              yield {
                type: "action_confirm",
                data: {
                  tool: toolName,
                  params: toolParams,
                  description: this.describeAction(toolName, toolParams),
                },
              };
              // 这里需要等待用户确认，实际实现中需要状态机
              // 简化版：直接执行
            }

            // 执行 Tool
            const result = await toolExecutor.execute(
              toolName,
              toolParams,
              context,
            );

            yield { type: "tool_result", data: { tool: toolName, result } };

            // 将结果加入消息历史
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          }
        } else {
          // 没有 Tool 调用，直接输出内容
          const content = assistantMessage.content || "";

          // 流式输出内容
          for (const char of content) {
            yield { type: "content", data: { delta: char } };
            await new Promise((r) => setTimeout(r, 10)); // 模拟流式
          }

          yield { type: "done", data: { totalTime: Date.now() - startTime } };
          return;
        }
      }

      // 达到最大迭代次数
      yield { type: "error", data: { message: "处理轮次超限，请简化问题" } };
    } catch (error) {
      yield {
        type: "error",
        data: { message: error instanceof Error ? error.message : "处理失败" },
      };
    }
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(): string {
    return `你是 AnyKeep 的智能助手，帮助用户管理和理解他们的收藏内容。

你可以使用以下工具来帮助用户：
- count_bookmarks: 统计书签数量
- list_bookmarks: 列出书签
- get_stats: 获取统计信息
- read_bookmark: 读取书签详细内容
- semantic_search: 语义搜索相关内容
- create_bookmark: 创建新笔记（需要用户确认）
- batch_tags: 批量管理标签（需要用户确认）

工作原则：
1. 优先使用工具获取准确信息，而不是猜测
2. 对于统计类问题，使用 count_bookmarks 或 get_stats
3. 对于内容理解问题，先用 semantic_search 找到相关内容，再用 read_bookmark 深入阅读
4. 执行操作前，清楚描述将要执行的操作，等待用户确认
5. 回答简洁、准确、有帮助
6. 使用中文回答`;
  }

  /**
   * 描述操作（用于确认提示）
   */
  private describeAction(toolName: string, params: unknown): string {
    switch (toolName) {
      case "create_bookmark":
        return `创建新笔记「${(params as any).title}」`;
      case "batch_tags":
        const p = params as any;
        return `为 ${p.bookmark_ids.length} 个书签${p.action === "add" ? "添加" : "移除"}标签 [${p.tags.join(", ")}]`;
      default:
        return `执行 ${toolName}`;
    }
  }

  /**
   * 调用 LLM API
   */
  private async callLLM(
    messages: ChatMessage[],
    tools: any[],
    options: { temperature: number; stream: boolean },
  ) {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        tools,
        tool_choice: "auto",
        temperature: options.temperature,
        stream: options.stream,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    return response.json();
  }
}

export const agentService = new AgentService();
```

### 4.2 Tool 注册表

```typescript
// src/lib/agent/tool-registry.ts

import type { Tool } from "./types";
import { countBookmarksTool } from "./tools/query/count-bookmarks.tool";
import { listBookmarksTool } from "./tools/query/list-bookmarks.tool";
import { getStatsTool } from "./tools/query/get-stats.tool";
import { readBookmarkTool } from "./tools/read/read-bookmark.tool";
import { semanticSearchTool } from "./tools/search/semantic-search.tool";
import { createBookmarkTool } from "./tools/action/create-bookmark.tool";
import { batchTagsTool } from "./tools/action/batch-tags.tool";

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    // 注册所有 Tools
    this.register(countBookmarksTool);
    this.register(listBookmarksTool);
    this.register(getStatsTool);
    this.register(readBookmarkTool);
    this.register(semanticSearchTool);
    this.register(createBookmarkTool);
    this.register(batchTagsTool);
  }

  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolsByCategory(category: string): Tool[] {
    return this.getAllTools().filter((t) => t.definition.category === category);
  }
}

export const toolRegistry = new ToolRegistry();
```

### 4.3 Tool 执行引擎

```typescript
// src/lib/agent/tool-executor.ts

import type { Tool, ToolContext, ToolResult } from "./types";
import { toolRegistry } from "./tool-registry";
import { logger } from "@/lib/logger";

class ToolExecutor {
  /**
   * 执行 Tool
   */
  async execute(
    toolName: string,
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const tool = toolRegistry.getTool(toolName);

    if (!tool) {
      return {
        success: false,
        error: `未知的工具: ${toolName}`,
      };
    }

    const startTime = Date.now();

    try {
      logger.info({ tool: toolName, params }, "Tool execution started");

      const result = await tool.execute(params, context);

      logger.info(
        {
          tool: toolName,
          success: result.success,
          timeMs: Date.now() - startTime,
        },
        "Tool execution completed",
      );

      return result;
    } catch (error) {
      logger.error(
        {
          tool: toolName,
          error: error instanceof Error ? error.message : String(error),
        },
        "Tool execution failed",
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : "执行失败",
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    }
  }
}

export const toolExecutor = new ToolExecutor();
```

---

## 五、API 设计

### 5.1 Agent API 路由

```typescript
// src/app/api/agent/chat/route.ts

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { agentService } from "@/lib/agent/agent.service";
import { costControlService } from "@/lib/chat/cost-control.service";
import { logger } from "@/lib/logger";

const requestSchema = z.object({
  query: z.string().min(1).max(2000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system", "tool"]),
        content: z.string(),
      }),
    )
    .optional(),
  options: z
    .object({
      maxIterations: z.number().min(1).max(10).optional(),
      temperature: z.number().min(0).max(1).optional(),
    })
    .optional(),
  // 操作确认响应
  confirmAction: z
    .object({
      tool: z.string(),
      confirmed: z.boolean(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "请先登录" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. 检查配额
    const quotaCheck = await costControlService.canChat(user.id);
    if (!quotaCheck.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: quotaCheck.reason,
          quotaExceeded: true,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }

    // 3. 解析请求
    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ success: false, error: "请求参数无效" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { query, conversationHistory, options } = validation.data;

    // 4. 流式响应
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of agentService.chat({
            userId: user.id,
            query,
            conversationHistory,
            options: {
              ...options,
              stream: true,
            },
          })) {
            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          controller.close();
        } catch (error) {
          const errorEvent = {
            type: "error",
            data: {
              message: error instanceof Error ? error.message : "处理失败",
            },
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`),
          );
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
  } catch (error) {
    logger.error({ error }, "POST /api/agent/chat error");
    return new Response(JSON.stringify({ success: false, error: "处理失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

---

## 六、前端设计

### 6.1 useAgent Hook

```typescript
// src/hooks/domain/ai/use-agent.ts

"use client";

import { useState, useCallback, useRef } from "react";

export interface ToolExecution {
  id: string;
  tool: string;
  params: unknown;
  status: "pending" | "executing" | "completed" | "failed";
  result?: ToolResult;
}

export interface ActionConfirm {
  tool: string;
  params: unknown;
  description: string;
}

export interface UseAgentReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  toolExecutions: ToolExecution[];
  pendingAction: ActionConfirm | null;
  sendMessage: (query: string) => Promise<void>;
  confirmAction: (confirmed: boolean) => Promise<void>;
  clearMessages: () => void;
  stopGeneration: () => void;
}

export function useAgent(): UseAgentReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [pendingAction, setPendingAction] = useState<ActionConfirm | null>(
    null,
  );

  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim() || isLoading) return;

      setIsLoading(true);
      setError(null);
      setToolExecutions([]);

      // 添加用户消息
      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: query,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // 创建助手消息占位
      const assistantId = generateId();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          isStreaming: true,
        },
      ]);

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            conversationHistory: messages.slice(-20).map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error("请求失败");
        }

        // 处理流式响应
        const reader = response.body?.getReader();
        if (!reader) throw new Error("无法读取响应");

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const event = JSON.parse(line.slice(6));

              switch (event.type) {
                case "thinking":
                  // 显示思考过程（可选）
                  break;

                case "tool_call":
                  setToolExecutions((prev) => [
                    ...prev,
                    {
                      id: generateId(),
                      tool: event.data.tool,
                      params: event.data.params,
                      status: "executing",
                    },
                  ]);
                  break;

                case "tool_result":
                  setToolExecutions((prev) =>
                    prev.map((t) =>
                      t.tool === event.data.tool && t.status === "executing"
                        ? {
                            ...t,
                            status: "completed",
                            result: event.data.result,
                          }
                        : t,
                    ),
                  );
                  break;

                case "action_confirm":
                  setPendingAction(event.data);
                  break;

                case "content":
                  fullContent += event.data.delta;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: fullContent } : m,
                    ),
                  );
                  break;

                case "done":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, isStreaming: false } : m,
                    ),
                  );
                  break;

                case "error":
                  throw new Error(event.data.message);
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        }
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading],
  );

  const confirmAction = useCallback(
    async (confirmed: boolean) => {
      if (!pendingAction) return;

      // TODO: 发送确认结果到后端
      setPendingAction(null);
    },
    [pendingAction],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setToolExecutions([]);
    setError(null);
  }, []);

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    messages,
    isLoading,
    error,
    toolExecutions,
    pendingAction,
    sendMessage,
    confirmAction,
    clearMessages,
    stopGeneration,
  };
}
```

### 6.2 AgentPanel 组件

```tsx
// src/components/agent/agent-panel.tsx

"use client";

import { useState } from "react";
import { Send, Sparkles, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useAgent } from "@/hooks/domain/ai/use-agent";
import { ActionConfirmDialog } from "./action-confirm";
import { ToolExecutionList } from "./tool-execution";

export function AgentPanel() {
  const {
    messages,
    isLoading,
    error,
    toolExecutions,
    pendingAction,
    sendMessage,
    confirmAction,
    clearMessages,
  } = useAgent();

  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Sparkles className="size-5 text-purple-500" />
        <span className="font-medium">AI 智能助手</span>
        <span className="text-xs text-muted-foreground">(Agent 模式)</span>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Tool 执行状态 */}
        {toolExecutions.length > 0 && (
          <ToolExecutionList executions={toolExecutions} />
        )}

        {/* 错误提示 */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入问题...（支持统计、搜索、操作）"
            className="min-h-[44px] max-h-[120px] resize-none"
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* 操作确认对话框 */}
      {pendingAction && (
        <ActionConfirmDialog
          action={pendingAction}
          onConfirm={() => confirmAction(true)}
          onCancel={() => confirmAction(false)}
        />
      )}
    </div>
  );
}
```

### 6.3 快捷指令组件

```tsx
// src/components/agent/quick-commands.tsx

"use client";

import { BarChart3, FileText, Tags, FolderTree, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickCommand {
  id: string;
  icon: React.ReactNode;
  label: string;
  prompt: string;
}

const QUICK_COMMANDS: QuickCommand[] = [
  {
    id: "stats",
    icon: <BarChart3 className="size-4" />,
    label: "收藏统计",
    prompt: "帮我统计一下我的收藏情况，包括总数、各平台分布、最近活跃度",
  },
  {
    id: "recent",
    icon: <FileText className="size-4" />,
    label: "最近收藏",
    prompt: "列出我最近一周收藏的内容",
  },
  {
    id: "tags",
    icon: <Tags className="size-4" />,
    label: "标签分析",
    prompt: "分析我的收藏标签分布，哪些标签最常用",
  },
  {
    id: "organize",
    icon: <FolderTree className="size-4" />,
    label: "整理建议",
    prompt: "根据我的收藏内容，给我一些整理和分类的建议",
  },
  {
    id: "search",
    icon: <Search className="size-4" />,
    label: "智能搜索",
    prompt: "", // 需要用户输入
  },
];

interface QuickCommandsProps {
  onSelect: (prompt: string) => void;
}

export function QuickCommands({ onSelect }: QuickCommandsProps) {
  return (
    <div className="flex flex-wrap gap-2 p-4 border-b">
      {QUICK_COMMANDS.filter((c) => c.prompt).map((command) => (
        <Button
          key={command.id}
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onSelect(command.prompt)}
        >
          {command.icon}
          {command.label}
        </Button>
      ))}
    </div>
  );
}
```

---

## 七、数据库设计

### 7.1 新增表（可选）

```sql
-- Agent 对话历史（用于上下文记忆）
CREATE TABLE IF NOT EXISTS agent_conversations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT,  -- 对话标题（自动生成）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent 对话消息
CREATE TABLE IF NOT EXISTS agent_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT REFERENCES agent_conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tool_name TEXT,  -- 如果是 tool 消息
  tool_params JSONB,
  tool_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 策略
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations"
  ON agent_conversations FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own messages"
  ON agent_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM agent_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );
```

---

## 八、实施计划

### 8.1 阶段划分

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Phase 1: 数据查询能力 (Week 1-2)                                           │
│  ├── count_bookmarks Tool                                                   │
│  ├── list_bookmarks Tool                                                    │
│  ├── get_stats Tool                                                         │
│  ├── AgentService 基础实现                                                   │
│  └── /api/agent/chat 路由                                                   │
│                                                                             │
│  目标：能回答 "我有多少收藏"、"最近收藏了什么" 等问题                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Phase 2: 内容理解能力 (Week 3-4)                                           │
│  ├── read_bookmark Tool                                                     │
│  ├── semantic_search Tool (复用现有 RAG)                                     │
│  ├── AgentPanel UI 组件                                                     │
│  └── useAgent Hook                                                          │
│                                                                             │
│  目标：能回答 "帮我总结这篇文章"、"找一下关于XX的收藏" 等问题                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Phase 3: 操作执行能力 (Week 5-6)                                           │
│  ├── create_bookmark Tool                                                   │
│  ├── batch_tags Tool                                                        │
│  ├── move_bookmarks Tool                                                    │
│  ├── ActionConfirmDialog 组件                                               │
│  └── 操作确认流程                                                            │
│                                                                             │
│  目标：能执行 "保存为笔记"、"批量打标签"、"移动到XX文件夹" 等操作               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Phase 4: 体验优化 (Week 7-8)                                               │
│  ├── QuickCommands 快捷指令                                                 │
│  ├── 对话历史持久化                                                          │
│  ├── 性能优化（缓存、并发）                                                   │
│  └── 全面测试和文档                                                          │
│                                                                             │
│  目标：达到 YouMind 同等体验水平                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 具体任务清单

#### Phase 1: 数据查询能力

| 任务                           | 类型 | 预估工时 | 优先级 |
| ------------------------------ | ---- | -------- | ------ |
| 创建 `src/lib/agent/` 模块结构 | 后端 | 2h       | P0     |
| 实现 `types.ts` 类型定义       | 后端 | 2h       | P0     |
| 实现 `count_bookmarks` Tool    | 后端 | 4h       | P0     |
| 实现 `list_bookmarks` Tool     | 后端 | 4h       | P0     |
| 实现 `get_stats` Tool          | 后端 | 4h       | P0     |
| 实现 `tool-registry.ts`        | 后端 | 2h       | P0     |
| 实现 `tool-executor.ts`        | 后端 | 3h       | P0     |
| 实现 `agent.service.ts` 基础版 | 后端 | 8h       | P0     |
| 实现 `/api/agent/chat` 路由    | 后端 | 4h       | P0     |
| 基础测试和调试                 | 测试 | 4h       | P0     |

#### Phase 2: 内容理解能力

| 任务                          | 类型 | 预估工时 | 优先级 |
| ----------------------------- | ---- | -------- | ------ |
| 实现 `read_bookmark` Tool     | 后端 | 4h       | P0     |
| 实现 `semantic_search` Tool   | 后端 | 4h       | P0     |
| 实现 `useAgent` Hook          | 前端 | 6h       | P0     |
| 实现 `AgentPanel` 组件        | 前端 | 6h       | P0     |
| 实现 `ToolExecutionList` 组件 | 前端 | 3h       | P1     |
| 集成测试                      | 测试 | 4h       | P0     |

#### Phase 3: 操作执行能力

| 任务                        | 类型 | 预估工时 | 优先级 |
| --------------------------- | ---- | -------- | ------ |
| 实现 `create_bookmark` Tool | 后端 | 4h       | P0     |
| 实现 `batch_tags` Tool      | 后端 | 4h       | P0     |
| 实现 `move_bookmarks` Tool  | 后端 | 3h       | P1     |
| 实现操作确认流程（状态机）  | 后端 | 6h       | P0     |
| 实现 `ActionConfirmDialog`  | 前端 | 4h       | P0     |
| 安全测试（权限验证）        | 测试 | 4h       | P0     |

#### Phase 4: 体验优化

| 任务                                 | 类型 | 预估工时 | 优先级 |
| ------------------------------------ | ---- | -------- | ------ |
| 实现 `QuickCommands` 组件            | 前端 | 3h       | P1     |
| 对话历史数据库设计                   | 后端 | 4h       | P2     |
| 对话历史 CRUD                        | 后端 | 6h       | P2     |
| 性能优化（缓存、并发）               | 后端 | 4h       | P1     |
| 替换入口（ChatButton → AgentButton） | 前端 | 2h       | P1     |
| 文档编写                             | 文档 | 4h       | P1     |

### 8.3 风险与缓解

| 风险                        | 影响 | 缓解措施                                 |
| --------------------------- | ---- | ---------------------------------------- |
| LLM Tool Calling 能力不稳定 | 高   | 使用 GPT-4 或 Claude，准备降级方案       |
| 操作执行安全风险            | 高   | 严格的确认机制 + RLS 策略                |
| 成本超预期                  | 中   | 复用现有成本控制服务，设置 Tool 调用限制 |
| 响应延迟                    | 中   | 流式响应 + 并行 Tool 执行                |

---

## 九、验收标准

### 9.1 功能验收

| 场景                       | 预期结果              | 验收状态 |
| -------------------------- | --------------------- | -------- |
| "我有多少收藏？"           | 返回准确的总数和分布  | 待验收   |
| "最近一周收藏了什么？"     | 列出最近 7 天的收藏   | 待验收   |
| "帮我总结这篇文章"         | 读取内容并生成摘要    | 待验收   |
| "找一下关于 AI 的收藏"     | 语义搜索相关内容      | 待验收   |
| "把这个待办清单保存为笔记" | 弹出确认 → 创建笔记   | 待验收   |
| "给这些收藏打上XX标签"     | 弹出确认 → 批量打标签 | 待验收   |

### 9.2 非功能验收

| 指标          | 目标 | 验收状态 |
| ------------- | ---- | -------- |
| 首次响应延迟  | < 2s | 待验收   |
| Tool 执行延迟 | < 1s | 待验收   |
| 错误率        | < 5% | 待验收   |
| 安全测试通过  | 100% | 待验收   |

---

## 十、总结

本设计方案实现了 AnyKeep AI 助手从「纯 RAG 模式」到「Agent + Tools 模式」的架构升级：

1. **解耦设计**：新增 `lib/agent/` 模块，不修改现有业务代码
2. **渐进式实施**：分 4 个阶段，每阶段可独立上线
3. **复用优先**：Tools 通过现有 Repository 访问数据
4. **安全保障**：危险操作需用户确认 + RLS 策略
5. **可扩展性**：新增 Tool 只需注册到 Registry

**预期收益**：

- 用户可以通过自然语言查询收藏数据
- 用户可以让 AI 执行批量操作
- 对标 YouMind 的 AI 助手能力

---

**文档状态**: 待审核
**下一步**: 用户审核后，开始 Phase 1 实施
