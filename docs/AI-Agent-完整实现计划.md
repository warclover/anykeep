# AnyKeep AI Agent 完整实现计划

> 版本：1.0.0
> 日期：2025-12-22
> 状态：待审核

---

## 一、战略定位

### 1.1 核心理念

> **AnyKeep 要做的不是「AI 功能」，而是「AI 助手」**

| 维度     | AI 功能（竞品）     | AI 助手（AnyKeep）  |
| -------- | ------------------- | ------------------- |
| 交互模式 | 功能菜单 → 点击执行 | 自然对话 → 理解执行 |
| 决策主体 | 用户决定做什么      | AI 理解用户想要什么 |
| 能力边界 | 固定功能列表        | 动态组合能力        |
| 用户感受 | 工具                | 伙伴                |

### 1.2 差异化优势

AnyKeep Agent 的独特价值：

1. **多平台统一理解**：微信、B站、小红书内容在一个 Agent 中处理
2. **真正的工具调用**：不是 LLM 套壳，是能执行操作的 Agent
3. **渐进式智能**：从简单到复杂，逐步解锁能力
4. **中文优化**：针对中文内容和中文交互深度优化

---

## 二、技术架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AnyKeep AI Agent 架构                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      Frontend (Next.js)                      │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐               │   │
│  │  │ ChatPanel │  │ AgentUI   │  │ ResultView│               │   │
│  │  │ 对话界面   │  │ 执行状态   │  │ 结果展示   │               │   │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘               │   │
│  └────────┼──────────────┼──────────────┼──────────────────────┘   │
│           │              │              │                           │
│           ▼              ▼              ▼                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    API Layer (Next.js API Routes)            │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │ POST /api/agent/chat                                   │  │   │
│  │  │ - 接收用户消息                                          │  │   │
│  │  │ - 调用 Agent 引擎                                       │  │   │
│  │  │ - 流式返回结果                                          │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Agent Engine (核心)                       │   │
│  │                                                             │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │   │
│  │  │   Router    │───►│   Planner   │───►│  Executor   │    │   │
│  │  │  意图路由    │    │  任务规划    │    │  工具执行    │    │   │
│  │  └─────────────┘    └─────────────┘    └──────┬──────┘    │   │
│  │         │                                      │           │   │
│  │         ▼                                      ▼           │   │
│  │  ┌─────────────┐                      ┌─────────────┐     │   │
│  │  │   Memory    │                      │   Tools     │     │   │
│  │  │  记忆系统    │                      │  工具集合    │     │   │
│  │  └─────────────┘                      └─────────────┘     │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      Tool Layer (工具层)                     │   │
│  │                                                             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │   │
│  │  │ Search   │ │ Summary  │ │ Stats    │ │ Organize │      │   │
│  │  │ 语义搜索  │ │ 智能摘要  │ │ 数据统计  │ │ 整理分类  │      │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │   │
│  │       │            │            │            │             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │   │
│  │  │ QA       │ │ Learn    │ │ Export   │ │ Batch    │      │   │
│  │  │ 知识问答  │ │ 学习辅助  │ │ 内容导出  │ │ 批量处理  │      │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Data Layer (数据层)                       │   │
│  │                                                             │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │                 Supabase (PostgreSQL)                 │  │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐             │  │   │
│  │  │  │bookmarks │ │ folders  │ │ ai_memory│             │  │   │
│  │  │  │ +向量索引 │ │          │ │ 对话记忆  │             │  │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘             │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心模块说明

#### Agent Engine（核心引擎）

```
src/lib/ai/
├── agent/
│   ├── index.ts              # Agent 主入口
│   ├── router.ts             # 意图路由器
│   ├── planner.ts            # 任务规划器
│   ├── executor.ts           # 工具执行器
│   └── memory.ts             # 记忆管理器
├── tools/
│   ├── index.ts              # 工具注册表
│   ├── search.tool.ts        # 语义搜索工具
│   ├── summary.tool.ts       # 智能摘要工具
│   ├── stats.tool.ts         # 数据统计工具
│   ├── organize.tool.ts      # 整理分类工具
│   ├── qa.tool.ts            # 知识问答工具
│   └── batch.tool.ts         # 批量处理工具
├── prompts/
│   ├── system.ts             # 系统提示词
│   ├── router.ts             # 路由提示词
│   └── tools/                # 各工具提示词
├── types/
│   └── index.ts              # 类型定义
└── config.ts                 # 配置文件
```

#### Tool 接口定义

```typescript
// src/lib/ai/types/index.ts

/**
 * 工具定义接口
 */
export interface AgentTool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (params: unknown, context: ToolContext) => Promise<ToolResult>;
}

/**
 * 工具执行上下文
 */
export interface ToolContext {
  userId: string;
  conversationId: string;
  previousResults?: ToolResult[];
  memory?: ConversationMemory;
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    toolName: string;
    executionTime: number;
    tokensUsed?: number;
  };
}

/**
 * Agent 响应
 */
export interface AgentResponse {
  message: string; // AI 回复文本
  toolCalls?: ToolCall[]; // 调用的工具
  citations?: Citation[]; // 引用来源
  suggestions?: string[]; // 后续建议
  metadata?: ResponseMetadata;
}
```

---

## 三、分阶段实现计划

### 3.1 Phase 1：基础 Agent（4周）

**目标**：实现可用的单工具 Agent，替代现有 AI 助手

#### 3.1.1 功能范围

| 功能     | 描述                            | 优先级 |
| -------- | ------------------------------- | ------ |
| 意图识别 | 识别用户是要搜索/摘要/问答/统计 | P0     |
| 语义搜索 | 自然语言搜索收藏内容            | P0     |
| 单篇摘要 | 为单篇内容生成摘要              | P0     |
| 简单问答 | 基于单篇内容回答问题            | P0     |
| 流式响应 | 打字机效果输出                  | P0     |

#### 3.1.2 技术实现

**Step 1: 搭建 Agent 框架**

```typescript
// src/lib/ai/agent/index.ts
import { generateText, streamText, tool } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { z } from "zod";

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export class KnowledgeAgent {
  private tools: Map<string, AgentTool>;
  private model = deepseek("deepseek-chat");

  constructor() {
    this.tools = new Map();
    this.registerDefaultTools();
  }

  /**
   * 处理用户消息
   */
  async chat(message: string, context: AgentContext): Promise<AgentResponse> {
    const result = await generateText({
      model: this.model,
      system: this.getSystemPrompt(context),
      messages: context.history,
      tools: this.getToolDefinitions(),
      maxSteps: 5,
    });

    return this.formatResponse(result);
  }

  /**
   * 流式处理用户消息
   */
  async *streamChat(message: string, context: AgentContext) {
    const result = await streamText({
      model: this.model,
      system: this.getSystemPrompt(context),
      messages: [...context.history, { role: "user", content: message }],
      tools: this.getToolDefinitions(),
      maxSteps: 5,
    });

    for await (const chunk of result.textStream) {
      yield chunk;
    }
  }

  private registerDefaultTools() {
    this.tools.set("search", searchTool);
    this.tools.set("summary", summaryTool);
    this.tools.set("stats", statsTool);
  }

  private getToolDefinitions() {
    const definitions: Record<string, any> = {};
    for (const [name, tool] of this.tools) {
      definitions[name] = {
        description: tool.description,
        parameters: tool.parameters,
        execute: tool.execute,
      };
    }
    return definitions;
  }
}
```

**Step 2: 实现核心工具**

```typescript
// src/lib/ai/tools/search.tool.ts
import { tool } from "ai";
import { z } from "zod";
import { bookmarkRepository } from "@/lib/repositories/bookmark.repository";

export const searchTool = tool({
  description: "搜索用户的收藏内容，支持自然语言查询",
  parameters: z.object({
    query: z.string().describe("搜索关键词或自然语言描述"),
    platform: z
      .enum(["WECHAT", "BILIBILI", "XIAOHONGSHU", "BROWSER", "ALL"])
      .optional()
      .describe("限定平台，不指定则搜索全部"),
    limit: z.number().min(1).max(20).default(5).describe("返回结果数量"),
  }),
  execute: async ({ query, platform, limit }, { userId }) => {
    // 1. 生成查询向量
    const embedding = await generateEmbedding(query);

    // 2. 执行向量搜索
    const results = await searchByEmbedding({
      userId,
      embedding,
      platform: platform === "ALL" ? undefined : platform,
      limit,
    });

    // 3. 格式化结果
    return {
      success: true,
      data: {
        bookmarks: results.map((r) => ({
          id: r.id,
          title: r.title,
          summary: r.ai_summary || r.content?.slice(0, 200),
          platform: r.platform,
          url: r.url,
          similarity: r.similarity,
        })),
        total: results.length,
      },
    };
  },
});
```

```typescript
// src/lib/ai/tools/summary.tool.ts
import { tool } from "ai";
import { z } from "zod";
import { generateText } from "ai";

export const summaryTool = tool({
  description: "为指定的收藏内容生成智能摘要",
  parameters: z.object({
    bookmarkId: z.number().describe("书签ID"),
    style: z
      .enum(["brief", "detailed", "bullet"])
      .default("brief")
      .describe("摘要风格：简洁/详细/要点"),
  }),
  execute: async ({ bookmarkId, style }, { userId }) => {
    // 1. 获取书签内容
    const bookmark = await bookmarkRepository.get(bookmarkId);

    if (!bookmark || bookmark.user_id !== userId) {
      return { success: false, error: "内容不存在或无权限" };
    }

    // 2. 生成摘要
    const prompt = getSummaryPrompt(bookmark.content, style);
    const result = await generateText({
      model: deepseek("deepseek-chat"),
      prompt,
    });

    // 3. 保存摘要到数据库
    await bookmarkRepository.update(bookmarkId, {
      ai_summary: result.text,
    });

    return {
      success: true,
      data: {
        summary: result.text,
        style,
        bookmarkId,
      },
    };
  },
});
```

**Step 3: API 路由**

```typescript
// src/app/api/agent/chat/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KnowledgeAgent } from "@/lib/ai/agent";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { message, conversationId, history } = await req.json();

  const agent = new KnowledgeAgent();

  // 流式响应
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of agent.streamChat(message, {
          userId: user.id,
          conversationId,
          history,
        })) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`),
          );
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "处理失败" })}\n\n`),
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
}
```

#### 3.1.3 数据库迁移

```sql
-- 20250101000001_add_ai_agent_tables.sql

-- AI 对话记录表
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI 消息记录表
CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  citations JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id);

-- RLS
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations"
  ON ai_conversations FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage messages in own conversations"
  ON ai_messages FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM ai_conversations WHERE user_id = auth.uid()
    )
  );
```

#### 3.1.4 交付物

- [ ] Agent 核心框架（router, executor）
- [ ] 3 个基础工具（search, summary, stats）
- [ ] 流式 API 接口
- [ ] 对话 UI 组件
- [ ] 数据库迁移脚本
- [ ] 单元测试覆盖

---

### 3.2 Phase 2：多工具 Agent（4周）

**目标**：支持多工具组合调用，实现更复杂的任务

#### 3.2.1 功能范围

| 功能       | 描述                   | 优先级 |
| ---------- | ---------------------- | ------ |
| 多工具组合 | 一个请求可调用多个工具 | P0     |
| 跨文档问答 | 基于多篇内容回答问题   | P0     |
| 自动标签   | AI 生成标签建议        | P1     |
| 智能分类   | 自动推荐文件夹         | P1     |
| 对话记忆   | 支持多轮对话上下文     | P1     |

#### 3.2.2 新增工具

```typescript
// src/lib/ai/tools/qa.tool.ts
export const qaTool = tool({
  description: "基于用户收藏的多篇内容回答问题",
  parameters: z.object({
    question: z.string().describe("用户问题"),
    bookmarkIds: z.array(z.number()).optional().describe("指定参考的书签ID"),
    topK: z.number().default(5).describe("检索相关内容数量"),
  }),
  execute: async ({ question, bookmarkIds, topK }, context) => {
    // 1. 检索相关内容
    const relevantDocs = bookmarkIds
      ? await getBookmarksByIds(bookmarkIds)
      : await searchRelevantDocs(question, context.userId, topK);

    // 2. 构建上下文
    const docContext = formatDocsAsContext(relevantDocs);

    // 3. 生成回答
    const answer = await generateAnswer(question, docContext);

    return {
      success: true,
      data: {
        answer: answer.text,
        citations: relevantDocs.map((d) => ({
          id: d.id,
          title: d.title,
          url: d.url,
        })),
      },
    };
  },
});
```

```typescript
// src/lib/ai/tools/organize.tool.ts
export const organizeTool = tool({
  description: "为书签生成标签建议或推荐文件夹",
  parameters: z.object({
    bookmarkId: z.number().describe("书签ID"),
    action: z.enum(["suggest_tags", "suggest_folder"]).describe("操作类型"),
  }),
  execute: async ({ bookmarkId, action }, context) => {
    const bookmark = await bookmarkRepository.get(bookmarkId);

    if (action === "suggest_tags") {
      // 基于内容和现有标签体系生成建议
      const existingTags = await getExistingTags(context.userId);
      const suggestedTags = await generateTagSuggestions(
        bookmark,
        existingTags,
      );
      return { success: true, data: { tags: suggestedTags } };
    }

    if (action === "suggest_folder") {
      // 基于内容和现有文件夹结构推荐
      const folders = await getFolders(context.userId);
      const suggestedFolder = await suggestFolder(bookmark, folders);
      return { success: true, data: { folder: suggestedFolder } };
    }
  },
});
```

#### 3.2.3 记忆系统

```typescript
// src/lib/ai/agent/memory.ts
export class ConversationMemory {
  private messages: Message[] = [];
  private maxTokens = 4000;

  /**
   * 添加消息
   */
  add(message: Message) {
    this.messages.push(message);
    this.trim();
  }

  /**
   * 获取上下文
   */
  getContext(): Message[] {
    return this.messages;
  }

  /**
   * 裁剪超出 token 限制的历史
   */
  private trim() {
    let totalTokens = 0;
    const trimmed: Message[] = [];

    // 从后往前保留，直到达到 token 限制
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msgTokens = estimateTokens(this.messages[i].content);
      if (totalTokens + msgTokens > this.maxTokens) break;
      totalTokens += msgTokens;
      trimmed.unshift(this.messages[i]);
    }

    this.messages = trimmed;
  }

  /**
   * 持久化到数据库
   */
  async save(conversationId: string) {
    await saveMessages(conversationId, this.messages);
  }

  /**
   * 从数据库加载
   */
  static async load(conversationId: string): Promise<ConversationMemory> {
    const memory = new ConversationMemory();
    memory.messages = await loadMessages(conversationId);
    return memory;
  }
}
```

#### 3.2.4 交付物

- [ ] 多工具编排逻辑
- [ ] 跨文档问答工具
- [ ] 智能整理工具
- [ ] 对话记忆系统
- [ ] 对话历史 UI
- [ ] 性能优化（并行工具调用）

---

### 3.3 Phase 3：批量处理 Agent（4周）

**目标**：支持批量操作，解决收藏积压问题

#### 3.3.1 功能范围

| 功能     | 描述             | 优先级 |
| -------- | ---------------- | ------ |
| 批量摘要 | 一键生成多篇摘要 | P0     |
| 批量标签 | 批量生成标签建议 | P0     |
| 批量分类 | 批量推荐文件夹   | P1     |
| 进度跟踪 | 实时显示处理进度 | P0     |
| 任务队列 | 后台异步处理     | P0     |

#### 3.3.2 队列系统

```typescript
// src/lib/ai/batch/queue.ts
import { createClient } from "@supabase/supabase-js";

export class BatchQueue {
  /**
   * 创建批量任务
   */
  async createBatch(params: {
    userId: string;
    type: "summary" | "tags" | "classify";
    bookmarkIds: number[];
  }): Promise<string> {
    const batchId = generateId();

    // 创建批量任务记录
    await supabase.from("ai_batch_tasks").insert({
      id: batchId,
      user_id: params.userId,
      type: params.type,
      total: params.bookmarkIds.length,
      processed: 0,
      status: "pending",
    });

    // 创建子任务
    const subTasks = params.bookmarkIds.map((id, index) => ({
      batch_id: batchId,
      bookmark_id: id,
      order: index,
      status: "pending",
    }));

    await supabase.from("ai_batch_subtasks").insert(subTasks);

    // 触发处理
    await this.triggerProcessing(batchId);

    return batchId;
  }

  /**
   * 触发 Edge Function 处理
   */
  private async triggerProcessing(batchId: string) {
    await supabase.functions.invoke("process-batch", {
      body: { batchId },
    });
  }

  /**
   * 获取批量任务状态
   */
  async getStatus(batchId: string): Promise<BatchStatus> {
    const { data } = await supabase
      .from("ai_batch_tasks")
      .select("*")
      .eq("id", batchId)
      .single();

    return data;
  }
}
```

#### 3.3.3 Edge Function 处理器

```typescript
// supabase/functions/process-batch/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  const { batchId } = await req.json();

  // 获取待处理子任务
  const { data: tasks } = await supabase
    .from("ai_batch_subtasks")
    .select("*")
    .eq("batch_id", batchId)
    .eq("status", "pending")
    .order("order")
    .limit(10); // 每次处理 10 个

  for (const task of tasks) {
    try {
      // 处理单个任务
      await processTask(task);

      // 更新状态
      await supabase
        .from("ai_batch_subtasks")
        .update({ status: "completed" })
        .eq("id", task.id);

      // 更新批量进度
      await supabase.rpc("increment_batch_progress", { batch_id: batchId });
    } catch (error) {
      await supabase
        .from("ai_batch_subtasks")
        .update({ status: "failed", error: error.message })
        .eq("id", task.id);
    }
  }

  // 检查是否全部完成
  const { count } = await supabase
    .from("ai_batch_subtasks")
    .select("*", { count: "exact" })
    .eq("batch_id", batchId)
    .eq("status", "pending");

  if (count === 0) {
    await supabase
      .from("ai_batch_tasks")
      .update({ status: "completed" })
      .eq("id", batchId);
  } else {
    // 继续处理剩余任务
    await supabase.functions.invoke("process-batch", {
      body: { batchId },
    });
  }

  return new Response(JSON.stringify({ success: true }));
});
```

#### 3.3.4 交付物

- [ ] 批量任务队列系统
- [ ] Edge Function 处理器
- [ ] 批量摘要工具
- [ ] 批量标签工具
- [ ] 进度跟踪 UI
- [ ] 错误处理和重试机制

---

### 3.4 Phase 4：学习伙伴 Agent（4周）

**目标**：实现学习辅助功能，形成差异化壁垒

#### 3.4.1 功能范围

| 功能     | 描述                 | 优先级 |
| -------- | -------------------- | ------ |
| 知识关联 | 发现内容之间的关联   | P0     |
| 学习计划 | 基于收藏生成学习路径 | P1     |
| 复习提醒 | 间隔重复提醒         | P1     |
| 知识图谱 | 可视化知识结构       | P2     |
| 笔记生成 | 自动生成学习笔记     | P2     |

#### 3.4.2 知识关联工具

```typescript
// src/lib/ai/tools/learn.tool.ts
export const learnTool = tool({
  description: "学习辅助功能：发现关联、生成计划、创建笔记",
  parameters: z.object({
    action: z.enum([
      "find_connections", // 发现知识关联
      "create_study_plan", // 生成学习计划
      "generate_notes", // 生成学习笔记
      "schedule_review", // 安排复习
    ]),
    bookmarkIds: z.array(z.number()).optional(),
    topic: z.string().optional(),
  }),
  execute: async ({ action, bookmarkIds, topic }, context) => {
    switch (action) {
      case "find_connections":
        return await findKnowledgeConnections(bookmarkIds, context.userId);

      case "create_study_plan":
        return await createStudyPlan(topic, context.userId);

      case "generate_notes":
        return await generateStudyNotes(bookmarkIds, context.userId);

      case "schedule_review":
        return await scheduleReview(bookmarkIds, context.userId);
    }
  },
});

async function findKnowledgeConnections(bookmarkIds: number[], userId: string) {
  // 1. 获取书签内容
  const bookmarks = await getBookmarksByIds(bookmarkIds);

  // 2. 提取关键概念
  const concepts = await extractConcepts(bookmarks);

  // 3. 在全库中搜索相关内容
  const connections: Connection[] = [];
  for (const concept of concepts) {
    const related = await searchByEmbedding({
      query: concept,
      userId,
      exclude: bookmarkIds,
      limit: 3,
    });

    connections.push({
      concept,
      relatedBookmarks: related,
    });
  }

  return { success: true, data: { connections } };
}

async function createStudyPlan(topic: string, userId: string) {
  // 1. 搜索该主题的所有收藏
  const bookmarks = await searchByEmbedding({
    query: topic,
    userId,
    limit: 20,
  });

  // 2. 分析难度和依赖关系
  const analysis = await analyzeContent(bookmarks);

  // 3. 生成学习路径
  const plan = await generateLearningPath(analysis);

  return {
    success: true,
    data: {
      topic,
      totalItems: bookmarks.length,
      estimatedTime: plan.estimatedTime,
      phases: plan.phases,
    },
  };
}
```

#### 3.4.3 数据库扩展

```sql
-- 20250201000001_add_learning_tables.sql

-- 知识关联表
CREATE TABLE ai_knowledge_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_bookmark_id INT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  target_bookmark_id INT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  connection_type TEXT NOT NULL, -- 'same_topic', 'builds_on', 'contradicts', etc.
  strength FLOAT NOT NULL DEFAULT 0.5, -- 0-1
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 学习计划表
CREATE TABLE ai_study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  plan JSONB NOT NULL, -- 学习路径数据
  status TEXT NOT NULL DEFAULT 'active',
  progress INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 复习记录表
CREATE TABLE ai_review_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id INT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  next_review_at TIMESTAMPTZ NOT NULL,
  review_count INT NOT NULL DEFAULT 0,
  ease_factor FLOAT NOT NULL DEFAULT 2.5, -- SM-2 算法参数
  interval_days INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 3.4.4 交付物

- [ ] 知识关联发现算法
- [ ] 学习计划生成器
- [ ] 复习调度系统（SM-2 算法）
- [ ] 知识图谱可视化
- [ ] 学习进度追踪 UI
- [ ] 每日复习提醒

---

## 四、风险管理

### 4.1 技术风险

| 风险           | 概率 | 影响 | 缓解措施                     |
| -------------- | ---- | ---- | ---------------------------- |
| LLM 调用延迟高 | 中   | 高   | 流式响应、缓存、降级策略     |
| 工具调用失败   | 中   | 中   | 重试机制、错误恢复、优雅降级 |
| 成本超支       | 中   | 高   | Token 限制、缓存、低成本模型 |
| 向量搜索不准确 | 低   | 中   | 优化 embedding、混合搜索     |

### 4.2 降级策略

```typescript
// src/lib/ai/fallback.ts
export class FallbackHandler {
  /**
   * Agent 降级到简单 RAG
   */
  async fallbackToRAG(query: string, context: AgentContext) {
    // 1. 直接语义搜索
    const results = await searchByEmbedding({
      query,
      userId: context.userId,
      limit: 5,
    });

    // 2. 简单 LLM 调用
    const answer = await generateText({
      model: deepseek("deepseek-chat"),
      prompt: `基于以下内容回答问题：\n\n${formatDocs(results)}\n\n问题：${query}`,
    });

    return {
      message: answer.text,
      fallback: true,
      reason: "Agent 不可用，使用简单问答",
    };
  }

  /**
   * AI 降级到关键词搜索
   */
  async fallbackToKeywordSearch(query: string, userId: string) {
    const results = await bookmarkRepository.search({
      keyword: query,
      userId,
      limit: 10,
    });

    return {
      message: `找到 ${results.length} 条相关内容`,
      results,
      fallback: true,
      reason: "AI 服务不可用",
    };
  }
}
```

### 4.3 成本控制

| 策略       | 说明                     | 节省比例 |
| ---------- | ------------------------ | -------- |
| 意图缓存   | 相同问题类型复用路由结果 | ~20%     |
| 结果缓存   | 相同查询复用搜索结果     | ~30%     |
| 模型分层   | 简单任务用小模型         | ~40%     |
| Token 限制 | 限制上下文长度           | ~25%     |
| 批量优化   | 批量任务合并 API 调用    | ~50%     |

---

## 五、里程碑与时间线

```
2025 Q1
├── Week 1-4: Phase 1 基础 Agent
│   ├── W1: 框架搭建、意图路由
│   ├── W2: 搜索工具、摘要工具
│   ├── W3: 流式响应、对话 UI
│   └── W4: 测试、优化、发布
│
├── Week 5-8: Phase 2 多工具 Agent
│   ├── W5: 多工具编排逻辑
│   ├── W6: 问答工具、整理工具
│   ├── W7: 对话记忆系统
│   └── W8: 测试、优化、发布

2025 Q2
├── Week 9-12: Phase 3 批量处理
│   ├── W9: 任务队列系统
│   ├── W10: Edge Function 处理器
│   ├── W11: 批量 UI、进度跟踪
│   └── W12: 测试、优化、发布
│
├── Week 13-16: Phase 4 学习伙伴
│   ├── W13: 知识关联发现
│   ├── W14: 学习计划生成
│   ├── W15: 复习系统
│   └── W16: 测试、优化、发布
```

---

## 六、成功指标

### 6.1 技术指标

| 指标         | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
| ------------ | ------- | ------- | ------- | ------- |
| 响应时间 P95 | <3s     | <4s     | <5s     | <5s     |
| 工具成功率   | >95%    | >93%    | >90%    | >90%    |
| 用户满意度   | >70%    | >75%    | >80%    | >85%    |

### 6.2 业务指标

| 指标          | 目标                         |
| ------------- | ---------------------------- |
| AI 功能使用率 | 日活用户 30%+ 使用 AI        |
| 任务完成率    | 用户请求 80%+ 被正确理解执行 |
| 留存提升      | 使用 AI 用户 7 日留存 +15%   |

---

## 七、技术选型总结

| 组件       | 选型                    | 原因                                  |
| ---------- | ----------------------- | ------------------------------------- |
| Agent 框架 | Vercel AI SDK           | Next.js 原生集成，Tool Calling 支持好 |
| LLM        | DeepSeek                | 成本低、中文优秀、API 兼容            |
| 向量数据库 | pgvector (Supabase)     | 已有基础设施，无需额外运维            |
| 任务队列   | Supabase Edge Functions | 无需额外服务，与数据库同一套          |
| 前端状态   | SWR + React Context     | 已有模式，低学习成本                  |

---

## 八、下一步行动

### 立即行动（本周）

1. **技术验证**：搭建最小 Agent 原型，验证 Vercel AI SDK 工具调用
2. **数据库迁移**：创建 ai_conversations、ai_messages 表
3. **API 设计**：确定 `/api/agent/chat` 接口规范

### 短期行动（2周内）

1. **完成 Phase 1 框架**：Agent 核心、3 个基础工具
2. **替换现有 AI 助手**：新 Agent 上线，旧代码下线
3. **收集用户反馈**：了解实际使用情况

---

_文档版本: 1.0.0_
_更新日期: 2025-12-22_
_状态: 待审核_
