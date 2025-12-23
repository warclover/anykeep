# AI Skills Phase 2 实施计划

> **版本**: 1.1.0
> **创建日期**: 2025-12-23
> **状态**: Stage 4 已完成
> **基于**: V4.3.0 (AI Skills 基础架构已完成)

---

## 一、当前状态分析

### 1.1 已完成 (V4.3.0)

| 模块               | 状态 | 说明                                       |
| ------------------ | ---- | ------------------------------------------ |
| AI Skills 框架     | ✅   | BaseSkill, SkillRegistry, getSkillsAsTools |
| 3 个 Skills        | ✅   | ClassifySkill, SearchSkill, SummarySkill   |
| KnowledgeAgent     | ✅   | 支持流式/非流式响应，集成 Skills           |
| AI Provider Router | ✅   | 多模型路由，成功率追踪                     |
| `/api/agent/chat`  | ✅   | SSE 流式响应 API                           |
| AI Components      | ✅   | 13 个 UI 组件（AIQuickActions 等）         |

### 1.2 差距分析

| 缺失能力          | 设计方案要求                                | 当前状态                 |
| ----------------- | ------------------------------------------- | ------------------------ |
| **数据查询**      | count_bookmarks, list_bookmarks, get_stats  | ✅ 已实现 (Stage 2)      |
| **内容阅读**      | read_bookmark, semantic_search              | ✅ 已实现 (Stage 3)      |
| **操作执行**      | create_bookmark, batch_tags, move_bookmarks | ✅ 已实现 (Stage 4)      |
| **操作确认**      | ActionConfirmDialog, 确认流程               | ✅ 已实现 (Stage 4)      |
| **Tool 执行引擎** | tool-executor.ts                            | ✅ 已实现 (ToolRegistry) |
| **快捷操作后端**  | AIQuickActions 连接真实后端                 | ✅ 已实现 (Stage 1)      |

### 1.3 架构对比

```
设计方案架构:                    当前实现架构 (Stage 4 完成):
┌─────────────────┐              ┌─────────────────┐
│   AgentService  │              │ KnowledgeAgent  │
│  (Tool Calling) │              │  (Skills+Tools)  │
└────────┬────────┘              └────────┬────────┘
         │                                │
┌────────▼────────┐              ┌────────▼────────┐
│  Tool Registry  │              │  SkillRegistry  │
│  (7+ Tools)     │              │  + ToolRegistry │
└────────┬────────┘              └────────┬────────┘
         │                                │
┌────────▼────────┐              ┌────────▼────────┐
│  Tool Executor  │              │  3 Skills +     │
│  (权限+日志)     │              │  7 Tools (完整) │
└─────────────────┘              └─────────────────┘
```

**Stage 4 成果**: 已实现 **batch_tags** 和 **move_bookmarks** Tools，带用户确认机制

---

## 二、实施策略 (A+C 组合)

### 2.1 策略说明

**选项 A**: 实现 Tool Calling + 数据查询 Tools
**选项 C**: 将现有 AIQuickActions 连接到真实后端

**组合策略**: 先完成快捷操作的后端连接（用户可见价值），再扩展 Tool Calling 能力

### 2.2 阶段划分

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 1: 快捷操作后端连接 (2-3 天)                                          │
│  ├── 创建专用 API: /api/ai/quick-actions/:action                            │
│  ├── 实现 auto-tag 后端逻辑 (调用 ClassifySkill)                             │
│  ├── 实现 auto-classify 后端逻辑                                             │
│  ├── 实现 extract-key 后端逻辑 (调用 SummarySkill)                           │
│  └── 实现 rate-quality 后端逻辑                                              │
│                                                                             │
│  目标：AIQuickActions 按钮点击后执行真实操作并更新 UI                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 2: 数据查询 Tools (3-4 天)                                           │
│  ├── 创建 src/lib/ai-agent/tools/ 目录结构                                   │
│  ├── 实现 Tool 基础类型定义                                                   │
│  ├── 实现 count_bookmarks Tool                                              │
│  ├── 实现 list_bookmarks Tool                                               │
│  ├── 实现 get_stats Tool                                                    │
│  ├── 创建 ToolRegistry (与现有 SkillRegistry 并存)                           │
│  └── 集成到 KnowledgeAgent                                                  │
│                                                                             │
│  目标：能回答 "我有多少收藏"、"最近收藏了什么"、"统计情况" 等问题               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 3: 内容阅读 Tools (2-3 天)                                           │
│  ├── 实现 read_bookmark Tool                                                │
│  ├── 实现 semantic_search Tool (复用现有 SearchSkill)                        │
│  └── 测试完整对话流程                                                        │
│                                                                             │
│  目标：能回答 "帮我总结这篇文章"、"找一下关于XX的收藏" 等问题                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 4: 操作确认机制 (2-3 天)                                              │
│  ├── 设计确认流程状态机                                                       │
│  ├── 实现 ActionConfirmDialog 组件                                           │
│  ├── 实现 batch_tags Tool (带确认)                                           │
│  └── 实现 move_bookmarks Tool (带确认)                                       │
│                                                                             │
│  目标：危险操作需要用户确认后才执行                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 三、Stage 1: 快捷操作后端连接

### 3.1 目标

将 `AIQuickActions` 组件从「自然语言提示」改为「直接调用后端 Skills」

### 3.2 当前问题

```typescript
// 当前实现 (ai-quick-actions.tsx:143-159)
const prompts: Record<string, string> = {
  "auto-tag": "请为这篇内容推荐 3-5 个合适的标签，以逗号分隔",
  // ... 依赖自然语言提示
};

const res = await fetch("/api/agent/chat", {
  method: "POST",
  body: JSON.stringify({
    message: prompts[actionId], // 不够精确
    bookmarkIds: [bookmarkId],
  }),
});
```

### 3.3 改进方案

**新增 API**: `POST /api/ai/quick-actions`

```typescript
// 请求体
{
  action: "auto-tag" | "auto-classify" | "extract-key" | "rate-quality",
  bookmarkId: number,
  options?: {
    applyDirectly?: boolean,  // 是否直接应用结果
    maxTags?: number,
  }
}

// 响应体
{
  success: true,
  data: {
    action: "auto-tag",
    result: ["AI", "技术", "学习"],  // 推荐的标签
    applied: false,  // 是否已应用
    confidence: 0.85,
  }
}
```

### 3.4 文件清单

| 文件                                          | 操作 | 说明         |
| --------------------------------------------- | ---- | ------------ |
| `src/app/api/ai/quick-actions/route.ts`       | 新增 | 快捷操作 API |
| `src/lib/ai-actions/quick-actions.service.ts` | 新增 | 快捷操作服务 |
| `src/lib/ai-actions/types.ts`                 | 新增 | 类型定义     |
| `src/lib/ai-actions/index.ts`                 | 新增 | 导出         |
| `src/components/ai/ai-quick-actions.tsx`      | 修改 | 调用新 API   |

### 3.5 详细任务

| 任务                                 | 预估工时 | 状态        |
| ------------------------------------ | -------- | ----------- |
| 创建 `src/lib/ai-actions/` 模块      | 1h       | ✅ Complete |
| 实现 `QuickActionsService`           | 3h       | ✅ Complete |
| 创建 `/api/ai/quick-actions` 路由    | 2h       | ✅ Complete |
| 修改 `AIQuickActions` 组件调用新 API | 2h       | ✅ Complete |
| 添加结果应用逻辑（更新书签标签等）   | 2h       | ✅ Complete |
| 测试                                 | 1h       | ✅ Complete |

### 3.6 成功标准

- [x] 点击「智能标签」按钮，调用 ClassifySkill，返回推荐标签
- [x] 点击「智能分类」按钮，推荐合适的文件夹
- [x] 点击「提取要点」按钮，调用 SummarySkill，返回关键要点
- [x] 点击「质量评估」按钮，返回评分和理由
- [ ] 所有操作响应时间 < 5s (需实际测试验证)

---

## 四、Stage 2: 数据查询 Tools

### 4.1 目标

实现 3 个数据查询 Tools，让 Agent 能够准确回答统计类问题

### 4.2 目录结构

```
src/lib/ai-agent/
├── core/                      # 已存在
│   ├── knowledge-agent.ts
│   ├── agent-memory.ts
│   └── types.ts
├── tools/                     # 新增
│   ├── index.ts               # 统一导出
│   ├── types.ts               # Tool 类型定义
│   ├── tool-registry.ts       # Tool 注册表
│   ├── tool-executor.ts       # Tool 执行引擎
│   └── query/                 # 数据查询 Tools
│       ├── index.ts
│       ├── count-bookmarks.tool.ts
│       ├── list-bookmarks.tool.ts
│       └── get-stats.tool.ts
└── index.ts                   # 更新导出
```

### 4.3 Tool 类型定义

```typescript
// src/lib/ai-agent/tools/types.ts

import type { z } from "zod";

/**
 * Tool 定义
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  category: "query" | "read" | "action" | "search";
  requiresConfirmation?: boolean;
}

/**
 * Tool 执行上下文
 */
export interface ToolContext {
  userId: string;
  conversationId?: string;
}

/**
 * Tool 执行结果
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    executionTimeMs: number;
    affectedCount?: number;
  };
}

/**
 * Tool 接口
 */
export interface Tool<TParams = unknown, TResult = unknown> {
  definition: ToolDefinition;
  execute: (
    params: TParams,
    context: ToolContext,
  ) => Promise<ToolResult<TResult>>;
}
```

### 4.4 count_bookmarks Tool

```typescript
// src/lib/ai-agent/tools/query/count-bookmarks.tool.ts

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  folder_id: z.number().optional(),
  platform: z.string().optional(),
  date_from: z.string().optional(), // ISO 日期
  date_to: z.string().optional(),
  has_tags: z.boolean().optional(),
});

type CountParams = z.infer<typeof paramsSchema>;

interface CountResult {
  total: number;
  by_platform?: Record<string, number>;
  by_folder?: { id: number; name: string; count: number }[];
}

export const countBookmarksTool: Tool<CountParams, CountResult> = {
  definition: {
    name: "count_bookmarks",
    description:
      "统计用户的书签数量，支持按文件夹、平台、时间范围筛选。用于回答'我有多少收藏'、'最近一周收藏了多少'等问题。",
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
  },

  async execute(params, context): Promise<ToolResult<CountResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      let query = supabase
        .from("bookmarks")
        .select("id, platform, folder_id, folders(id, name)", {
          count: "exact",
        })
        .eq("user_id", context.userId);

      // 应用筛选条件
      if (params.folder_id) query = query.eq("folder_id", params.folder_id);
      if (params.platform) query = query.eq("platform", params.platform);
      if (params.date_from) query = query.gte("created_at", params.date_from);
      if (params.date_to) query = query.lte("created_at", params.date_to);
      if (params.has_tags === true) query = query.not("ai_tags", "is", null);
      if (params.has_tags === false) query = query.is("ai_tags", null);

      const { data, count, error } = await query;

      if (error) throw error;

      // 计算分组统计
      const byPlatform: Record<string, number> = {};
      const folderMap = new Map<
        number,
        { id: number; name: string; count: number }
      >();

      data?.forEach((item) => {
        const platform = item.platform || "OTHER";
        byPlatform[platform] = (byPlatform[platform] || 0) + 1;

        if (item.folder_id && item.folders?.name) {
          const existing = folderMap.get(item.folder_id);
          if (existing) {
            existing.count++;
          } else {
            folderMap.set(item.folder_id, {
              id: item.folder_id,
              name: item.folders.name,
              count: 1,
            });
          }
        }
      });

      return {
        success: true,
        data: {
          total: count || 0,
          by_platform: byPlatform,
          by_folder: Array.from(folderMap.values()),
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "统计失败",
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    }
  },
};
```

### 4.5 详细任务

| 任务                                    | 预估工时 | 状态        |
| --------------------------------------- | -------- | ----------- |
| 创建 `src/lib/ai-agent/tools/` 目录结构 | 0.5h     | Not Started |
| 实现 `tools/types.ts`                   | 1h       | Not Started |
| 实现 `count_bookmarks` Tool             | 2h       | Not Started |
| 实现 `list_bookmarks` Tool              | 2h       | Not Started |
| 实现 `get_stats` Tool                   | 2h       | Not Started |
| 实现 `tool-registry.ts`                 | 1h       | Not Started |
| 实现 `tool-executor.ts`                 | 1.5h     | Not Started |
| 集成到 KnowledgeAgent                   | 2h       | Not Started |
| 单元测试                                | 2h       | Not Started |
| 集成测试                                | 1h       | Not Started |

### 4.6 成功标准

- [ ] "我有多少收藏？" → 返回准确总数和平台分布
- [ ] "最近一周收藏了多少？" → 返回近 7 天数量
- [ ] "微信公众号收藏有多少？" → 返回 WECHAT 平台数量
- [ ] "哪个文件夹收藏最多？" → 返回文件夹排名
- [ ] 所有 Tool 执行时间 < 500ms

---

## 五、Stage 3: 内容阅读 Tools

### 5.1 目标

实现内容阅读和语义搜索 Tools

### 5.2 文件清单

| 文件                                                    | 操作 | 说明         |
| ------------------------------------------------------- | ---- | ------------ |
| `src/lib/ai-agent/tools/read/index.ts`                  | 新增 | 导出         |
| `src/lib/ai-agent/tools/read/read-bookmark.tool.ts`     | 新增 | 读取书签详情 |
| `src/lib/ai-agent/tools/search/index.ts`                | 新增 | 导出         |
| `src/lib/ai-agent/tools/search/semantic-search.tool.ts` | 新增 | 语义搜索     |

### 5.3 详细任务

| 任务                        | 预估工时 | 状态        |
| --------------------------- | -------- | ----------- |
| 实现 `read_bookmark` Tool   | 2h       | Not Started |
| 实现 `semantic_search` Tool | 2h       | Not Started |
| 更新 ToolRegistry 注册      | 0.5h     | Not Started |
| 测试完整对话流程            | 2h       | Not Started |

### 5.4 成功标准

- [ ] "帮我总结 ID 为 123 的书签" → 读取并返回内容
- [ ] "找一下关于 React 的收藏" → 语义搜索返回相关结果
- [ ] 搜索结果包含相似度分数

---

## 六、Stage 4: 操作确认机制

### 6.1 目标

为危险操作（删除、批量修改）添加用户确认流程

### 6.2 确认流程

```
用户输入 "给这 5 个书签打上 AI 标签"
          │
          ▼
┌─────────────────────────┐
│  Agent 解析意图          │
│  调用 batch_tags Tool   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  检测到危险操作          │
│  requiresConfirmation   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  返回 action_confirm    │
│  事件到前端             │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  ActionConfirmDialog    │
│  显示操作详情            │
│  [确认] [取消]          │
└────────────┬────────────┘
             │
      ┌──────┴──────┐
      ▼             ▼
   [确认]        [取消]
      │             │
      ▼             ▼
   执行操作      返回取消
```

### 6.3 详细任务

| 任务                                | 预估工时 | 状态        |
| ----------------------------------- | -------- | ----------- |
| 设计确认流程状态管理                | 2h       | Not Started |
| 实现 `ActionConfirmDialog` 组件     | 2h       | Not Started |
| 实现 `batch_tags` Tool (带确认)     | 2h       | Not Started |
| 实现 `move_bookmarks` Tool (带确认) | 2h       | Not Started |
| 前后端确认流程集成                  | 2h       | Not Started |
| 安全测试                            | 1h       | Not Started |

### 6.4 成功标准

- [ ] 执行批量操作前弹出确认对话框
- [ ] 确认对话框清晰显示操作影响范围
- [ ] 用户取消后操作不执行
- [ ] 用户确认后操作成功执行

---

## 七、技术决策

### 7.1 Tools vs Skills

| 维度     | Skills (现有)               | Tools (新增)                   |
| -------- | --------------------------- | ------------------------------ |
| 用途     | LLM 能力增强                | 数据库操作                     |
| 示例     | ClassifySkill, SummarySkill | count_bookmarks, read_bookmark |
| 复杂度   | 高（涉及 AI 推理）          | 低（直接数据库查询）           |
| 执行时间 | 长（LLM 调用）              | 短（< 500ms）                  |

**决策**: Skills 和 Tools 并存，Skills 专注 AI 能力，Tools 专注数据操作

### 7.2 Vercel AI SDK Tool 集成

```typescript
// 现有 getSkillsAsTools 函数转换 Skills 为 tools
// 新增 getDataToolsAsVercelTools 函数转换 Tools 为 tools

import { tool } from "ai";
import { toolRegistry } from "./tools/tool-registry";

export function getDataToolsAsVercelTools(contextFn: () => ToolContext) {
  const tools: Record<string, ReturnType<typeof tool>> = {};

  for (const t of toolRegistry.getAllTools()) {
    tools[t.definition.name] = tool({
      description: t.definition.description,
      parameters: t.definition.parameters,
      execute: async (params) => {
        const context = contextFn();
        return t.execute(params, context);
      },
    });
  }

  return tools;
}
```

### 7.3 与现有 KnowledgeAgent 集成

```typescript
// knowledge-agent.ts 修改

// 获取 Skills 作为 Tools
const skillTools = getSkillsAsTools(() => ({
  userId: context.userId,
  conversationId: context.conversationId,
}));

// 获取 Data Tools
const dataTools = getDataToolsAsVercelTools(() => ({
  userId: context.userId,
  conversationId: context.conversationId,
}));

// 合并所有 tools
const tools = { ...skillTools, ...dataTools };
```

---

## 八、风险与缓解

| 风险                | 影响 | 缓解措施                         |
| ------------------- | ---- | -------------------------------- |
| Tool 执行超时       | 中   | 设置 10s 超时，异步返回部分结果  |
| 数据查询性能        | 中   | 添加索引，限制返回数量（max 50） |
| LLM 不正确调用 Tool | 中   | 完善 Tool description，添加示例  |
| 操作确认流程中断    | 低   | 前端状态持久化，支持恢复         |

---

## 九、验收清单

### Stage 1 验收

- [ ] `POST /api/ai/quick-actions` API 可用
- [ ] AIQuickActions 四个按钮均能正常执行
- [ ] 结果能正确显示在 UI 上
- [ ] 响应时间 < 5s

### Stage 2 验收

- [ ] "我有多少收藏？" → 准确返回总数
- [ ] "按平台统计" → 返回各平台数量
- [ ] "最近一周" → 返回时间范围内数量
- [ ] Tool 执行时间 < 500ms

### Stage 3 验收

- [ ] "读取书签详情" → 返回完整信息
- [ ] "搜索关于XX" → 语义搜索有效
- [ ] 搜索结果包含相似度

### Stage 4 验收

- [ ] 危险操作触发确认对话框
- [ ] 确认后操作成功
- [ ] 取消后操作不执行

---

## 十、时间线

| 阶段    | 预估工时 | 开始日期   | 完成日期   | 状态        |
| ------- | -------- | ---------- | ---------- | ----------- |
| Stage 1 | 11h      | 2025-12-23 | 2025-12-25 | Not Started |
| Stage 2 | 15h      | 2025-12-26 | 2025-12-29 | Not Started |
| Stage 3 | 6.5h     | 2025-12-30 | 2025-12-31 | Not Started |
| Stage 4 | 11h      | 2026-01-01 | 2026-01-03 | Not Started |

**总计**: ~43.5 小时，约 10-12 个工作日

---

**文档状态**: 待审核
**下一步**: 用户审核后，开始 Stage 1 实施
