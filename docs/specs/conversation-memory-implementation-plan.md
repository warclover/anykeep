# AI 对话记忆系统实施计划

**版本**: v1.0.0
**日期**: 2026-01-13
**状态**: 待审核
**预计工时**: 5-7 人天

---

## 一、背景与目标

### 1.1 问题陈述

当前 AI 助手存在以下记忆能力缺陷：

| 问题             | 影响                          | 严重程度      |
| ---------------- | ----------------------------- | ------------- |
| 页面刷新丢失对话 | 用户需重复解释上下文          | ⭐⭐⭐⭐⭐ P0 |
| 无法查看历史对话 | 无法回顾之前的交互            | ⭐⭐⭐⭐ P1   |
| 跨会话无记忆     | AI 无法记住用户偏好和历史操作 | ⭐⭐⭐ P2     |

### 1.2 目标

构建**三层对话记忆系统**，实现：

1. **P0**: 当前会话持久化 - 页面刷新不丢失对话
2. **P1**: 历史会话管理 - 支持查看/切换/恢复历史对话
3. **P2**: 跨会话记忆 - AI 记住用户偏好和重要事件

### 1.3 设计原则

- ✅ **渐进增强**: 从最小改动开始，逐步完善
- ✅ **向后兼容**: 不影响现有功能
- ✅ **Feature Flag**: 每个阶段可独立开关
- ✅ **性能优先**: localStorage 作为热层，数据库作为冷层

---

## 二、技术方案

### 2.1 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                     对话记忆系统架构                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      前端 (React)                            │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐     │   │
│  │  │ useAIChat   │  │ useConversation │ │ ConversationList │   │   │
│  │  │ (消息管理)   │  │ History (新增) │  │  (历史列表UI)    │     │   │
│  │  └──────┬──────┘  └───────┬───────┘  └────────┬────────┘     │   │
│  │         │                 │                   │              │   │
│  │         ▼                 ▼                   │              │   │
│  │  ┌─────────────────────────────────────────┐ │              │   │
│  │  │           localStorage                   │ │              │   │
│  │  │  • current_session (当前会话)            │ │              │   │
│  │  │  • session_list (会话列表缓存)           │ │              │   │
│  │  └─────────────────────────────────────────┘ │              │   │
│  └──────────────────────────────────────────────┼──────────────┘   │
│                                                 │                   │
│  ┌──────────────────────────────────────────────┼──────────────┐   │
│  │                      API 层                   │              │   │
│  │  ┌──────────────────┐  ┌─────────────────────▼────────┐     │   │
│  │  │ /api/agent/      │  │ /api/conversations           │     │   │
│  │  │ unified          │  │  GET  / - 会话列表           │     │   │
│  │  │ (现有)           │  │  GET  /:id - 会话详情        │     │   │
│  │  └────────┬─────────┘  │  POST / - 创建会话           │     │   │
│  │           │            │  DELETE /:id - 删除会话      │     │   │
│  │           │            └──────────────────────────────┘     │   │
│  └───────────┼──────────────────────────────────────────────────┘   │
│              │                                                      │
│  ┌───────────▼──────────────────────────────────────────────────┐   │
│  │                      数据层 (Supabase)                        │   │
│  │  ┌─────────────────────┐  ┌────────────────────────────┐     │   │
│  │  │  ai_session_memory  │  │ ai_conversation_summaries  │     │   │
│  │  │  (会话完整数据)      │  │ (会话摘要 - 已存在)         │     │   │
│  │  │  ⚠️ 需启用          │  └────────────────────────────┘     │   │
│  │  └─────────────────────┘                                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据模型

#### 2.2.1 localStorage 结构

```typescript
// 当前会话 (P0)
interface LocalStorageCurrentSession {
  conversationId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// 会话列表缓存 (P1)
interface LocalStorageSessionList {
  sessions: ConversationListItem[];
  lastSyncAt: string;
}

// 存储 Key
const STORAGE_KEYS = {
  CURRENT_SESSION: "anykeep_ai_current_session",
  SESSION_LIST: "anykeep_ai_session_list",
} as const;
```

#### 2.2.2 数据库表 (已存在，需启用)

```sql
-- ai_session_memory 表 (已存在)
-- 位置: supabase/migrations/20251227*
CREATE TABLE ai_session_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  conversation_id TEXT NOT NULL,
  state JSONB NOT NULL,           -- 完整会话状态
  message_count INTEGER DEFAULT 0,
  last_intent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),

  UNIQUE(user_id, conversation_id)
);

-- 已有 RLS 策略
-- 已有自动过期清理触发器
```

---

## 三、阶段实施计划

### Phase 0: 当前会话持久化 (P0)

**目标**: 页面刷新不丢失当前对话
**工时**: 0.5-1 天
**风险等级**: 低

#### 3.1 任务清单

| 序号 | 任务                          | 文件                                       | 工时 |
| ---- | ----------------------------- | ------------------------------------------ | ---- |
| P0-1 | 创建 localStorage 工具函数    | `src/lib/storage/conversation-storage.ts`  | 1h   |
| P0-2 | 修改 useAIChat 添加持久化逻辑 | `src/hooks/domain/ai/use-ai-chat.ts`       | 2h   |
| P0-3 | 添加会话恢复逻辑              | 同上                                       | 1h   |
| P0-4 | 添加 Feature Flag             | `src/lib/ai-agent/config/feature-flags.ts` | 0.5h |
| P0-5 | 单元测试                      | `__tests__/`                               | 1h   |

#### 3.2 详细实现

**P0-1: localStorage 工具函数**

```typescript
// src/lib/storage/conversation-storage.ts

import type { ChatMessage } from "@/hooks/domain/ai/use-ai-chat";

const STORAGE_KEY = "anykeep_ai_current_session";
const MAX_MESSAGES = 50;
const SESSION_EXPIRE_MS = 24 * 60 * 60 * 1000; // 24小时

interface StoredSession {
  conversationId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export const conversationStorage = {
  /**
   * 保存当前会话
   */
  save(conversationId: string, messages: ChatMessage[]): void {
    if (typeof window === "undefined") return;

    const session: StoredSession = {
      conversationId,
      messages: messages.slice(-MAX_MESSAGES), // 只保留最近50条
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      // localStorage 满了，清理旧数据
      console.warn("[ConversationStorage] Storage full, clearing old data");
      localStorage.removeItem(STORAGE_KEY);
    }
  },

  /**
   * 恢复会话
   */
  restore(): StoredSession | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const session: StoredSession = JSON.parse(stored);

      // 检查是否过期
      const updatedAt = new Date(session.updatedAt).getTime();
      if (Date.now() - updatedAt > SESSION_EXPIRE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return session;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  },

  /**
   * 清除会话
   */
  clear(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  },

  /**
   * 更新会话ID (新建会话时)
   */
  updateConversationId(newId: string): void {
    const session = this.restore();
    if (session) {
      session.conversationId = newId;
      session.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  },
};
```

**P0-2: 修改 useAIChat**

```typescript
// src/hooks/domain/ai/use-ai-chat.ts
// 在文件头部添加导入
import { conversationStorage } from "@/lib/storage/conversation-storage";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";

// 修改 useState 初始化
const [messages, setMessages] = useState<ChatMessage[]>(() => {
  // Feature Flag 控制
  if (!FeatureFlags.ENABLE_CONVERSATION_PERSISTENCE) {
    return [];
  }

  // 从 localStorage 恢复
  const restored = conversationStorage.restore();
  if (restored) {
    console.log("[useAIChat] Restored session:", restored.conversationId);
    return restored.messages;
  }
  return [];
});

// 添加 useEffect 监听消息变化并持久化
useEffect(() => {
  if (!FeatureFlags.ENABLE_CONVERSATION_PERSISTENCE) return;
  if (messages.length === 0) return;

  // 防抖保存
  const timer = setTimeout(() => {
    conversationStorage.save(conversationId, messages);
  }, 500);

  return () => clearTimeout(timer);
}, [messages, conversationId]);
```

**P0-4: Feature Flag**

```typescript
// src/lib/ai-agent/config/feature-flags.ts
// 添加新的 Flag

get ENABLE_CONVERSATION_PERSISTENCE(): boolean {
  return process.env.ENABLE_CONVERSATION_PERSISTENCE !== "false";
}
```

```typescript
// src/lib/ai-agent/config/feature-flag-registry.ts
// 在注册表中添加

{
  name: "ENABLE_CONVERSATION_PERSISTENCE",
  description: "启用对话持久化（localStorage）",
  defaultValue: true,
  module: "memory",
  phase: "stable",
  integrationPoints: [
    {
      file: "src/hooks/domain/ai/use-ai-chat.ts",
      location: "useState initialization",
      type: "execute",
    },
    {
      file: "src/lib/storage/conversation-storage.ts",
      location: "save/restore functions",
      type: "execute",
    },
  ],
}
```

#### 3.3 验收标准

- [ ] 发送消息后刷新页面，对话内容保留
- [ ] 超过50条消息时，只保留最近50条
- [ ] 24小时未活动后，会话自动清除
- [ ] 关闭 Feature Flag 后，恢复原有行为
- [ ] localStorage 存储异常时有降级处理

---

### Phase 1: 历史会话管理 (P1)

**目标**: 支持查看/切换/恢复历史对话
**工时**: 2-3 天
**风险等级**: 中
**依赖**: P0 完成

#### 3.4 任务清单

| 序号 | 任务                             | 文件                                              | 工时 |
| ---- | -------------------------------- | ------------------------------------------------- | ---- |
| P1-1 | 启用 ai_session_memory 持久化    | `src/lib/ai-agent/core/agent-memory.ts`           | 1h   |
| P1-2 | 创建会话列表 API                 | `src/app/api/conversations/route.ts`              | 2h   |
| P1-3 | 创建会话详情 API                 | `src/app/api/conversations/[id]/route.ts`         | 1h   |
| P1-4 | 创建 useConversationHistory Hook | `src/hooks/domain/ai/use-conversation-history.ts` | 2h   |
| P1-5 | 创建会话列表组件                 | `src/components/ai/conversation-list.tsx`         | 3h   |
| P1-6 | 集成到 AI 助手界面               | `src/components/ai/ai-chat-panel.tsx`             | 2h   |
| P1-7 | 添加"新建对话"功能               | 同上                                              | 1h   |
| P1-8 | 单元测试 + 集成测试              | `__tests__/`                                      | 2h   |

#### 3.5 详细实现

**P1-1: 启用数据库持久化**

```typescript
// src/lib/ai-agent/core/agent-memory.ts
// 修改默认配置

const DEFAULT_CONFIG: AgentMemoryConfig = {
  maxMessages: 50,
  maxTokensEstimate: 8000,
  enablePersistence: true, // 改为 true
  persistenceDebounceMs: 1000,
};
```

**P1-2: 会话列表 API**

```typescript
// src/app/api/conversations/route.ts

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10");
  const offset = parseInt(searchParams.get("offset") || "0");

  const { data, error } = await supabase
    .from("ai_session_memory")
    .select(
      `
      conversation_id,
      state,
      message_count,
      last_intent,
      created_at,
      updated_at
    `,
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 转换为前端友好格式
  const conversations = data.map((row) => ({
    id: row.conversation_id,
    title: extractTitle(row.state),
    lastMessage: extractLastMessage(row.state),
    messageCount: row.message_count,
    lastIntent: row.last_intent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json({ conversations });
}

// 从第一条用户消息提取标题
function extractTitle(state: any): string {
  const messages = state?.messages || [];
  const firstUserMsg = messages.find((m: any) => m.role === "user");
  if (firstUserMsg) {
    return (
      firstUserMsg.content.slice(0, 30) +
      (firstUserMsg.content.length > 30 ? "..." : "")
    );
  }
  return "新对话";
}

// 提取最后一条消息预览
function extractLastMessage(state: any): string {
  const messages = state?.messages || [];
  const lastMsg = messages[messages.length - 1];
  if (lastMsg) {
    return (
      lastMsg.content.slice(0, 50) + (lastMsg.content.length > 50 ? "..." : "")
    );
  }
  return "";
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const { error } = await supabase.from("ai_session_memory").insert({
    user_id: user.id,
    conversation_id: conversationId,
    state: { messages: [] },
    message_count: 0,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversationId });
}
```

**P1-5: 会话列表组件**

```typescript
// src/components/ai/conversation-list.tsx

"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ConversationItem {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  updatedAt: string;
}

interface ConversationListProps {
  conversations: ConversationItem[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

export function ConversationList({
  conversations,
  currentId,
  onSelect,
  onNew,
  onDelete,
  isLoading,
}: ConversationListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 新建对话按钮 */}
      <div className="p-3 border-b">
        <Button
          onClick={onNew}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          新建对话
        </Button>
      </div>

      {/* 对话列表 */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              加载中...
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              暂无历史对话
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "group flex items-start gap-2 p-2 rounded-md cursor-pointer",
                  "hover:bg-accent transition-colors",
                  currentId === conv.id && "bg-accent"
                )}
              >
                <MessageSquare className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {conv.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {conv.lastMessage}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(conv.updatedAt), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={(e) => handleDelete(e, conv.id)}
                  disabled={deletingId === conv.id}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
```

#### 3.6 UI 集成方案

```
┌─────────────────────────────────────────────────────────────────┐
│  AI 助手                                              [≡] [×]   │
├────────────────┬────────────────────────────────────────────────┤
│                │                                                │
│  [+ 新建对话]   │                                                │
│  ────────────  │                                                │
│  💬 帮我整理... │         [当前对话内容区域]                      │
│     2分钟前    │                                                │
│  ────────────  │                                                │
│  💬 搜索关于... │                                                │
│     昨天       │                                                │
│  ────────────  │                                                │
│  💬 生成本周... │                                                │
│     3天前      │                                                │
│                │                                                │
│  [历史列表]     │         [输入框]                               │
│  200px 宽      │                                                │
└────────────────┴────────────────────────────────────────────────┘
```

#### 3.7 验收标准

- [ ] 可以查看最近 10 个历史对话
- [ ] 点击历史对话可切换并恢复完整消息
- [ ] 新建对话清空当前消息
- [ ] 删除对话从列表中移除
- [ ] 列表按更新时间倒序排列
- [ ] 移动端适配（抽屉式展开）

---

### Phase 2: 跨会话记忆 (P2)

**目标**: AI 记住用户偏好和重要事件
**工时**: 2-3 天
**风险等级**: 中
**依赖**: P1 完成

#### 3.8 任务清单

| 序号 | 任务                       | 文件                                          | 工时 |
| ---- | -------------------------- | --------------------------------------------- | ---- |
| P2-1 | 实现会话结束摘要生成       | `src/lib/ai-memory/session-summarizer.ts`     | 3h   |
| P2-2 | 新会话时注入历史摘要       | `src/lib/ai-agent/context/prompt-injector.ts` | 2h   |
| P2-3 | 实现待办事项追踪           | `src/lib/ai-memory/pending-tasks.ts`          | 2h   |
| P2-4 | 添加"AI记住了什么"查看功能 | `src/components/ai/ai-memory-viewer.tsx`      | 2h   |
| P2-5 | 单元测试                   | `__tests__/`                                  | 2h   |

#### 3.9 详细实现

**P2-1: 会话摘要生成**

```typescript
// src/lib/ai-memory/session-summarizer.ts

import { generateObject } from "ai";
import { z } from "zod";
import { getModelClient } from "@/lib/ai-agent/config/model-config";
import type { ChatMessage } from "@/hooks/domain/ai/use-ai-chat";

const SummarySchema = z.object({
  summary: z.string().describe("会话摘要，50-100字"),
  key_intents: z.array(z.string()).describe("用户主要意图"),
  key_actions: z.array(z.string()).describe("执行的主要操作"),
  user_feedback: z.enum(["positive", "neutral", "negative"]).optional(),
  pending_tasks: z.array(z.string()).describe("用户提到但未完成的事项"),
  learned_preferences: z
    .record(z.string())
    .optional()
    .describe("学到的用户偏好"),
});

export type SessionSummary = z.infer<typeof SummarySchema>;

export async function generateSessionSummary(
  messages: ChatMessage[],
): Promise<SessionSummary | null> {
  if (messages.length < 2) return null;

  const conversationText = messages
    .map((m) => `${m.role === "user" ? "用户" : "AI"}: ${m.content}`)
    .join("\n");

  try {
    const { object } = await generateObject({
      model: getModelClient("fast"),
      schema: SummarySchema,
      prompt: `
分析以下对话，生成结构化摘要：

${conversationText}

要求：
1. 摘要简洁，突出用户目标和结果
2. 提取用户明确提到但未完成的事项到 pending_tasks
3. 如果发现用户偏好（如喜欢某种分类方式），记录到 learned_preferences
`,
    });

    return object;
  } catch (error) {
    console.error("[SessionSummarizer] Failed to generate summary:", error);
    return null;
  }
}
```

**P2-2: 历史摘要注入**

```typescript
// src/lib/ai-agent/context/prompt-injector.ts
// 在 buildSystemPrompt 中添加

async function injectHistorySummary(userId: string): Promise<string> {
  if (!FeatureFlags.ENABLE_CROSS_SESSION_MEMORY) {
    return "";
  }

  const supabase = createServerClient();

  // 获取最近 3 次会话摘要
  const { data: summaries } = await supabase
    .from("ai_conversation_summaries")
    .select("summary, pending_intents, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (!summaries || summaries.length === 0) {
    return "";
  }

  const historySection = summaries
    .map((s, i) => {
      const daysAgo = Math.floor(
        (Date.now() - new Date(s.created_at).getTime()) / (24 * 60 * 60 * 1000),
      );
      const timeLabel =
        daysAgo === 0 ? "今天" : daysAgo === 1 ? "昨天" : `${daysAgo}天前`;
      return `[${timeLabel}] ${s.summary}`;
    })
    .join("\n");

  // 提取待办
  const pendingTasks = summaries
    .flatMap((s) => s.pending_intents || [])
    .filter(Boolean);

  let result = `\n【近期对话摘要】\n${historySection}`;

  if (pendingTasks.length > 0) {
    result += `\n\n【用户待办提醒】\n${pendingTasks.map((t) => `- ${t}`).join("\n")}`;
  }

  return result;
}
```

#### 3.10 验收标准

- [ ] 会话结束时自动生成摘要
- [ ] 新会话时 AI 能引用近期对话内容
- [ ] 用户待办事项能跨会话提醒
- [ ] 可以查看 AI 记住的内容
- [ ] 用户可以删除特定记忆

---

## 四、数据库变更

### 4.1 需要启用的现有表

| 表名                        | 当前状态       | 变更     |
| --------------------------- | -------------- | -------- |
| `ai_session_memory`         | 已存在，未启用 | 启用写入 |
| `ai_conversation_summaries` | 已存在         | 无变更   |

### 4.2 新增迁移 (可选优化)

```sql
-- 20260113000001_add_conversation_title.sql
-- 可选：为会话添加独立标题字段，避免每次从 state 中提取

ALTER TABLE ai_session_memory
ADD COLUMN IF NOT EXISTS title TEXT;

-- 添加标题提取触发器
CREATE OR REPLACE FUNCTION extract_conversation_title()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.state IS NOT NULL AND NEW.title IS NULL THEN
    NEW.title := COALESCE(
      (NEW.state->'messages'->0->>'content')::TEXT,
      '新对话'
    );
    NEW.title := LEFT(NEW.title, 50);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_extract_title
BEFORE INSERT OR UPDATE ON ai_session_memory
FOR EACH ROW
EXECUTE FUNCTION extract_conversation_title();
```

---

## 五、测试计划

### 5.1 单元测试

| 测试文件                          | 覆盖内容                              |
| --------------------------------- | ------------------------------------- |
| `conversation-storage.test.ts`    | localStorage 读写、过期清理、异常处理 |
| `use-ai-chat.persistence.test.ts` | 消息持久化、恢复逻辑                  |
| `session-summarizer.test.ts`      | 摘要生成、Schema 验证                 |

### 5.2 集成测试

| 测试场景            | 预期结果           |
| ------------------- | ------------------ |
| 发送消息 → 刷新页面 | 消息保留           |
| 切换历史对话        | 加载对应消息       |
| 新建对话            | 清空消息，创建新ID |
| 删除对话            | 从列表移除         |
| 会话结束 → 新会话   | AI 能引用历史      |

### 5.3 E2E 测试

```typescript
// src/__tests__/e2e/conversation-memory.e2e.test.ts

describe("对话记忆系统 E2E", () => {
  it("页面刷新保留对话", async () => {
    // 1. 发送消息
    // 2. 刷新页面
    // 3. 验证消息存在
  });

  it("历史对话切换", async () => {
    // 1. 创建多个对话
    // 2. 切换到历史对话
    // 3. 验证消息正确加载
  });
});
```

---

## 六、风险评估

| 风险                | 可能性 | 影响 | 缓解措施                   |
| ------------------- | ------ | ---- | -------------------------- |
| localStorage 存储满 | 中     | 低   | 捕获异常，自动清理         |
| 数据库查询性能      | 低     | 中   | 添加索引，限制返回数量     |
| LLM 摘要生成失败    | 中     | 低   | 降级为简单截取             |
| 会话数据一致性      | 中     | 中   | localStorage + DB 双写校验 |

---

## 七、回滚方案

### 7.1 Feature Flags 快速回滚

```bash
# .env.local
ENABLE_CONVERSATION_PERSISTENCE=false  # 禁用 P0
ENABLE_CONVERSATION_HISTORY=false      # 禁用 P1
ENABLE_CROSS_SESSION_MEMORY=false      # 禁用 P2
```

### 7.2 数据清理

```sql
-- 如需回滚，清理测试数据
DELETE FROM ai_session_memory WHERE created_at > '2026-01-13';
```

---

## 八、工时汇总

| 阶段                   | 预计工时   | 优先级     | 依赖 |
| ---------------------- | ---------- | ---------- | ---- |
| **P0: 当前会话持久化** | 0.5-1 天   | ⭐⭐⭐⭐⭐ | 无   |
| **P1: 历史会话管理**   | 2-3 天     | ⭐⭐⭐⭐   | P0   |
| **P2: 跨会话记忆**     | 2-3 天     | ⭐⭐⭐     | P1   |
| **总计**               | **5-7 天** | -          | -    |

---

## 九、里程碑

| 里程碑 | 交付物                      | 目标日期 |
| ------ | --------------------------- | -------- |
| M1     | P0 完成，页面刷新不丢失对话 | +1 天    |
| M2     | P1 完成，历史对话列表可用   | +4 天    |
| M3     | P2 完成，跨会话记忆上线     | +7 天    |

---

## 十、审核清单

请审核以下内容：

- [ ] 技术方案是否合理
- [ ] 工时估算是否准确
- [ ] 优先级排序是否正确
- [ ] 是否有遗漏的功能点
- [ ] UI 设计是否符合预期
- [ ] 是否需要调整实施顺序

---

**文档状态**: ✅ 已实现
**代码审查报告**: `docs/reports/conversation-memory-code-review-20260113.md`
**完成日期**: 2026-01-13
