# AnyKeep AI Skills Phase 3 - 下一阶段实施规划

> **版本**: 1.0.0
> **创建日期**: 2025-12-23
> **状态**: 待审核
> **基于**: V4.3.0 (Phase 2 Stage 1-4 已完成)

---

## 一、当前状态总结

### 1.1 已完成功能清单 (Phase 2)

| 模块           | 已实现内容                                           | 文件数 |
| -------------- | ---------------------------------------------------- | ------ |
| **AI Skills**  | SearchSkill, ClassifySkill, SummarySkill             | 18     |
| **AI Agent**   | KnowledgeAgent + 12 Tools (query/read/search/action) | 23     |
| **AI Actions** | 26 种操作类型 (read 13 + write 13)                   | 4      |
| **UI 组件**    | 21 个组件 (助手面板、确认对话框、快速操作等)         | 21     |
| **API 路由**   | /agent/chat, /agent/confirm, /ai/quick-actions       | 6      |

### 1.2 能力矩阵对照

```
                    YouMind         AnyKeep当前        目标(L3)
数据感知            ████████░░       ████████░░        ██████████    ✅ 已追平
内容理解            ████████░░       ████████░░        ██████████    ✅ 已追平
格式转化            ████████░░       ██████░░░░        ██████████    ⚠️ 差2级
操作执行            ████████░░       ████████░░        ██████████    ✅ 已追平
上下文记忆          ████████░░       ██████░░░░        ██████████    ⚠️ 差2级
主动感知            ░░░░░░░░░░       ░░░░░░░░░░        ██████████    🔴 差10级
持续学习            ░░░░░░░░░░       ░░░░░░░░░░        ██████████    🔴 差10级
```

**当前智能等级评估**: **L2** (部分自动化，已追平 YouMind)

### 1.3 四大规划文档核心要求对比

| 文档                   | 核心要求    | 当前完成度  |
| ---------------------- | ----------- | ----------- |
| L3智能升级方案         | 6大关键能力 | 2/6 (33%)   |
| AI-Knowledge-Assistant | 3大能力模块 | 2/3 (67%)   |
| AI-Agent完整计划       | 4个Phase    | 2.5/4 (63%) |
| AI-Skills详细计划      | 4个Stage    | 4/4 (100%)  |

---

## 二、下一阶段目标定位

### 2.1 核心目标

> **Phase 3 目标: 从 L2 → L2.5，聚焦"学习伙伴"能力建设**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Phase 3 核心价值主张                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   "让 AnyKeep 从内容管理工具，进化为知识学习伙伴"                    │
│                                                                     │
│   关键能力:                                                         │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│   │ 知识关联     │  │ 学习计划     │  │ 主动感知     │                │
│   │ 发现内容     │  │ 规划路径     │  │ 自动处理     │                │
│   │ 之间联系     │  │ 跟踪进度     │  │ 新增收藏     │                │
│   └─────────────┘  └─────────────┘  └─────────────┘                │
│         ↓                ↓                ↓                        │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │              差异化竞争优势 (超越 YouMind)                    │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 智能等级提升路径

| 阶段                 | 时间 | 目标等级 | 核心能力                    |
| -------------------- | ---- | -------- | --------------------------- |
| **Phase 2** (已完成) | -    | L2       | 基础 Agent + Tools + Skills |
| **Phase 3** (本阶段) | 6周  | L2.5     | 学习能力 + 主动感知         |
| Phase 4 (下阶段)     | 6周  | L3       | 自主决策 + 持续学习         |

---

## 三、Phase 3 能力模块设计

### 3.1 模块总览

```
Phase 3 新增能力模块:
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Module 1: 学习能力 (Learn)                                         │
│  ├── LearnSkill - 学习辅助 Skill                                    │
│  ├── ConnectionFinderTool - 知识关联发现                            │
│  ├── LearningPlanTool - 学习计划生成                                │
│  └── UI: 学习面板、关联图谱、进度追踪                                │
│                                                                     │
│  Module 2: 主动感知 (Proactive)                                     │
│  ├── AutoProcessSkill - 新收藏自动处理                              │
│  ├── EventTriggerSystem - 事件触发机制                              │
│  ├── BackgroundTaskQueue - 后台任务队列                             │
│  └── UI: 智能推荐卡片、处理通知                                     │
│                                                                     │
│  Module 3: 工作流编排 (Workflow)                                    │
│  ├── WorkflowEngine - 多 Skill 编排执行                             │
│  ├── SkillChainDefinition - Skill 链定义                            │
│  └── UI: 工作流面板、执行进度                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 优先级排序

| 优先级 | 模块                  | 理由                       |
| ------ | --------------------- | -------------------------- |
| **P0** | 学习能力 (Learn)      | 差异化竞争点，用户核心价值 |
| **P1** | 主动感知 (Proactive)  | L3 核心特征，提升智能感知  |
| **P2** | 工作流编排 (Workflow) | 增强能力组合，复杂任务支持 |

---

## 四、Module 1: 学习能力 (Learn)

### 4.1 功能范围

| 功能         | 描述                                     | 优先级 |
| ------------ | ---------------------------------------- | ------ |
| 知识关联发现 | 分析内容间的概念关联、主题关联、引用关联 | P0     |
| 学习计划生成 | 基于收藏主题生成结构化学习路径           | P0     |
| 学习进度追踪 | 追踪已读/未读/掌握状态                   | P1     |
| 关联内容推荐 | 阅读时推荐相关收藏                       | P1     |
| 知识问答增强 | 跨文档综合问答                           | P2     |

### 4.2 技术设计

#### 4.2.1 LearnSkill

```typescript
// src/lib/ai-skills/skills/learn/learn.skill.ts

import { BaseSkill } from "../../core/base-skill";
import { z } from "zod";

const learnInputSchema = z.object({
  action: z.enum([
    "find_connections", // 发现知识关联
    "create_study_plan", // 生成学习计划
    "get_related_content", // 获取相关内容
    "answer_question", // 跨文档问答
  ]),
  bookmarkIds: z.array(z.number()).optional(),
  topic: z.string().optional(),
  question: z.string().optional(),
});

const learnOutputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("find_connections"),
    connections: z.array(
      z.object({
        sourceId: z.number(),
        targetId: z.number(),
        connectionType: z.enum([
          "same_topic",
          "builds_on",
          "contradicts",
          "related",
        ]),
        strength: z.number().min(0).max(1),
        explanation: z.string(),
      }),
    ),
  }),
  z.object({
    action: z.literal("create_study_plan"),
    plan: z.object({
      topic: z.string(),
      totalItems: z.number(),
      estimatedHours: z.number(),
      phases: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          bookmarkIds: z.array(z.number()),
          order: z.number(),
        }),
      ),
    }),
  }),
  // ... 其他 action 类型
]);

export class LearnSkill extends BaseSkill<
  z.infer<typeof learnInputSchema>,
  z.infer<typeof learnOutputSchema>
> {
  readonly metadata = {
    id: "learn",
    name: "学习辅助",
    description: "发现知识关联、生成学习计划、推荐相关内容",
    version: "1.0.0",
    category: "learning" as const,
    estimatedDuration: 5000,
    maxDuration: 30000,
  };

  readonly inputSchema = learnInputSchema;
  readonly outputSchema = learnOutputSchema;

  protected async executeInternal(input, context) {
    switch (input.action) {
      case "find_connections":
        return this.findConnections(input.bookmarkIds!, context);
      case "create_study_plan":
        return this.createStudyPlan(input.topic!, context);
      // ...
    }
  }

  private async findConnections(bookmarkIds: number[], context) {
    // 1. 获取书签内容和 embedding
    const bookmarks = await this.loadBookmarks(bookmarkIds, context.userId);

    // 2. 提取关键概念
    const concepts = await this.extractConcepts(bookmarks);

    // 3. 计算两两相似度
    const connections = await this.calculateConnections(bookmarks, concepts);

    // 4. 使用 LLM 生成关联解释
    const enrichedConnections = await this.enrichWithExplanations(connections);

    return {
      action: "find_connections" as const,
      connections: enrichedConnections,
    };
  }

  private async createStudyPlan(topic: string, context) {
    // 1. 搜索该主题的所有收藏
    const bookmarks = await this.searchByTopic(topic, context.userId);

    // 2. 分析内容难度和依赖关系
    const analysis = await this.analyzeContentGraph(bookmarks);

    // 3. 生成学习路径 (拓扑排序)
    const phases = this.buildLearningPath(analysis);

    return {
      action: "create_study_plan" as const,
      plan: {
        topic,
        totalItems: bookmarks.length,
        estimatedHours: this.estimateTime(bookmarks),
        phases,
      },
    };
  }
}
```

#### 4.2.2 数据库扩展

```sql
-- 20251223000001_add_learning_tables.sql

-- 知识关联表
CREATE TABLE ai_knowledge_connections (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  target_bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('same_topic', 'builds_on', 'contradicts', 'related')),
  strength FLOAT NOT NULL DEFAULT 0.5 CHECK (strength BETWEEN 0 AND 1),
  explanation TEXT,
  ai_generated BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_bookmark_id, target_bookmark_id)
);

-- 学习计划表
CREATE TABLE ai_study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  description TEXT,
  plan_data JSONB NOT NULL,  -- 存储完整计划结构
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'archived')),
  progress_percent INT DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  total_items INT NOT NULL DEFAULT 0,
  completed_items INT NOT NULL DEFAULT 0,
  estimated_hours FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 学习进度表 (追踪每个书签的学习状态)
CREATE TABLE ai_learning_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  study_plan_id UUID REFERENCES ai_study_plans(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'reading', 'completed', 'mastered')),
  mastery_level INT DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
  time_spent_minutes INT DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, bookmark_id)
);

-- 索引
CREATE INDEX idx_connections_user ON ai_knowledge_connections(user_id);
CREATE INDEX idx_connections_source ON ai_knowledge_connections(source_bookmark_id);
CREATE INDEX idx_connections_target ON ai_knowledge_connections(target_bookmark_id);
CREATE INDEX idx_study_plans_user ON ai_study_plans(user_id);
CREATE INDEX idx_study_plans_status ON ai_study_plans(status);
CREATE INDEX idx_learning_progress_user ON ai_learning_progress(user_id);
CREATE INDEX idx_learning_progress_bookmark ON ai_learning_progress(bookmark_id);

-- RLS 策略
ALTER TABLE ai_knowledge_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own connections" ON ai_knowledge_connections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own study_plans" ON ai_study_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own learning_progress" ON ai_learning_progress FOR ALL USING (auth.uid() = user_id);
```

#### 4.2.3 UI 组件

```
src/components/ai/learn/
├── index.ts
├── knowledge-graph.tsx           # 知识关联图谱可视化
├── study-plan-card.tsx           # 学习计划卡片
├── study-plan-detail.tsx         # 学习计划详情
├── learning-progress-tracker.tsx # 学习进度追踪
├── related-content-sidebar.tsx   # 相关内容侧边栏
└── study-plan-creator-dialog.tsx # 创建学习计划对话框
```

### 4.3 详细任务分解

| 任务                     | 预估工时 | 优先级 | 依赖              |
| ------------------------ | -------- | ------ | ----------------- |
| 数据库迁移脚本           | 2h       | P0     | -                 |
| LearnSkill 骨架代码      | 2h       | P0     | 迁移              |
| find_connections 实现    | 6h       | P0     | Skill骨架         |
| create_study_plan 实现   | 6h       | P0     | Skill骨架         |
| ConnectionFinderTool     | 3h       | P0     | find_connections  |
| LearningPlanTool         | 3h       | P0     | create_study_plan |
| 知识图谱组件             | 8h       | P1     | Tools             |
| 学习计划卡片组件         | 4h       | P1     | Tools             |
| 学习进度追踪组件         | 4h       | P1     | 迁移              |
| 相关内容侧边栏           | 4h       | P1     | find_connections  |
| API 路由 (/api/ai/learn) | 3h       | P0     | Tools             |
| 集成测试                 | 4h       | P0     | 所有              |
| **小计**                 | **49h**  |        |                   |

### 4.4 成功标准

- [ ] "找一下和这篇文章相关的收藏" → 返回关联内容及关系说明
- [ ] "帮我制定一个 React 学习计划" → 基于收藏生成分阶段学习路径
- [ ] 知识图谱能可视化展示内容关联
- [ ] 学习进度能准确追踪和更新
- [ ] 关联发现准确率 > 80%

---

## 五、Module 2: 主动感知 (Proactive)

### 5.1 功能范围

| 功能           | 描述                                 | 优先级 |
| -------------- | ------------------------------------ | ------ |
| 新收藏自动处理 | 保存后自动生成摘要、推荐标签和文件夹 | P0     |
| 智能推荐卡片   | 首页展示 AI 推荐 (未读、相似、复习)  | P1     |
| 后台任务队列   | 异步处理批量 AI 任务                 | P1     |
| 定时任务       | 定期扫描发现重复、失效链接           | P2     |

### 5.2 技术设计

#### 5.2.1 事件触发系统

```typescript
// src/lib/ai-proactive/event-system.ts

import { createClient } from "@/lib/supabase/server";

/**
 * AI 事件类型
 */
export type AIEventType =
  | "bookmark:created"
  | "bookmark:updated"
  | "folder:created"
  | "user:login"
  | "schedule:daily";

/**
 * AI 事件处理器
 */
export interface AIEventHandler {
  eventType: AIEventType;
  handler: (payload: AIEventPayload) => Promise<void>;
  enabled: boolean;
  conditions?: (payload: AIEventPayload) => boolean;
}

/**
 * AI 事件系统
 */
export class AIEventSystem {
  private handlers: Map<AIEventType, AIEventHandler[]> = new Map();

  /**
   * 注册事件处理器
   */
  register(handler: AIEventHandler) {
    const existing = this.handlers.get(handler.eventType) || [];
    existing.push(handler);
    this.handlers.set(handler.eventType, existing);
  }

  /**
   * 触发事件
   */
  async emit(event: AIEventType, payload: AIEventPayload) {
    const handlers = this.handlers.get(event) || [];

    for (const handler of handlers) {
      if (!handler.enabled) continue;
      if (handler.conditions && !handler.conditions(payload)) continue;

      // 异步执行，不阻塞主流程
      this.executeAsync(handler, payload);
    }
  }

  private async executeAsync(handler: AIEventHandler, payload: AIEventPayload) {
    try {
      await handler.handler(payload);
    } catch (error) {
      console.error(`AI Event handler error [${handler.eventType}]:`, error);
      // 记录到错误日志
    }
  }
}

// 全局单例
export const aiEventSystem = new AIEventSystem();
```

#### 5.2.2 AutoProcessSkill

```typescript
// src/lib/ai-skills/skills/auto-process/auto-process.skill.ts

import { BaseSkill } from "../../core/base-skill";
import { skillRegistry } from "../../core/skill-registry";

/**
 * 新收藏自动处理 Skill
 *
 * 触发条件: bookmark:created 事件
 * 执行流程:
 * 1. 调用 SummarySkill 生成摘要
 * 2. 调用 ClassifySkill 推荐文件夹
 * 3. 高置信度 (>0.9) 自动应用，低置信度创建待确认任务
 */
export class AutoProcessSkill extends BaseSkill<
  AutoProcessInput,
  AutoProcessOutput
> {
  readonly metadata = {
    id: "auto-process",
    name: "新收藏自动处理",
    description: "自动为新收藏生成摘要、推荐标签和分类",
    version: "1.0.0",
    category: "utility" as const,
    estimatedDuration: 10000,
    maxDuration: 60000,
    // 事件触发配置
    trigger: {
      event: "bookmark:created",
      conditions: ["platform !== 'BROWSER'"], // 排除浏览器书签
    },
  };

  protected async executeInternal(
    input: AutoProcessInput,
    context: SkillContext,
  ) {
    const results: AutoProcessOutput = {
      bookmarkId: input.bookmarkId,
      actions: [],
    };

    // 1. 生成摘要
    const summarySkill = skillRegistry.get("summary");
    if (summarySkill) {
      const summaryResult = await summarySkill.execute(
        {
          title: input.title,
          url: input.url,
          content: input.content,
          mode: "standard",
        },
        context,
      );

      if (summaryResult.success) {
        results.actions.push({
          type: "summary_generated",
          applied: true,
          data: summaryResult.data,
        });
      }
    }

    // 2. 推荐分类
    const classifySkill = skillRegistry.get("classify");
    if (classifySkill) {
      const classifyResult = await classifySkill.execute(
        {
          title: input.title,
          summary: results.actions[0]?.data?.summary,
          tags: input.existingTags,
          url: input.url,
          enableAI: true,
        },
        context,
      );

      if (classifyResult.success) {
        const confidence =
          classifyResult.data?.suggestedFolder?.confidence || 0;
        const shouldAutoApply = confidence > 0.9;

        results.actions.push({
          type: "folder_suggested",
          applied: shouldAutoApply,
          confidence,
          data: classifyResult.data,
          requiresConfirmation: !shouldAutoApply,
        });

        // 高置信度自动应用
        if (shouldAutoApply && classifyResult.data?.suggestedFolder?.id) {
          await this.applyFolderSuggestion(
            input.bookmarkId,
            classifyResult.data.suggestedFolder.id,
            context.userId,
          );
        } else {
          // 低置信度创建待确认任务
          await this.createPendingTask(
            input.bookmarkId,
            classifyResult.data,
            context.userId,
          );
        }
      }
    }

    return results;
  }
}
```

#### 5.2.3 后台任务队列

```typescript
// src/lib/ai-proactive/task-queue.ts

import { createClient } from "@/lib/supabase/server";

/**
 * AI 后台任务
 */
export interface AITask {
  id: string;
  type: "auto_process" | "batch_summary" | "batch_classify" | "find_duplicates";
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "failed";
  priority: number; // 0-10, 越高越优先
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * AI 任务队列
 */
export class AITaskQueue {
  /**
   * 添加任务到队列
   */
  async enqueue(
    task: Omit<AITask, "id" | "status" | "attempts">,
  ): Promise<string> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ai_task_queue")
      .insert({
        ...task,
        status: "pending",
        attempts: 0,
      })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * 处理队列中的下一个任务
   */
  async processNext(): Promise<AITask | null> {
    const supabase = await createClient();

    // 获取下一个待处理任务（优先级+时间排序）
    const { data: task, error } = await supabase
      .from("ai_task_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("priority", { ascending: false })
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .single();

    if (!task) return null;

    // 标记为处理中
    await supabase
      .from("ai_task_queue")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        attempts: task.attempts + 1,
      })
      .eq("id", task.id);

    return task as AITask;
  }

  /**
   * 标记任务完成
   */
  async complete(taskId: string, result?: unknown): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from("ai_task_queue")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        result,
      })
      .eq("id", taskId);
  }

  /**
   * 标记任务失败
   */
  async fail(taskId: string, error: string): Promise<void> {
    const supabase = await createClient();

    const { data: task } = await supabase
      .from("ai_task_queue")
      .select("attempts, max_attempts")
      .eq("id", taskId)
      .single();

    const shouldRetry = task && task.attempts < task.max_attempts;

    await supabase
      .from("ai_task_queue")
      .update({
        status: shouldRetry ? "pending" : "failed",
        error,
        scheduled_at: shouldRetry
          ? new Date(
              Date.now() + this.getBackoffDelay(task.attempts),
            ).toISOString()
          : undefined,
      })
      .eq("id", taskId);
  }

  private getBackoffDelay(attempts: number): number {
    // 指数退避: 1min, 2min, 4min, 8min...
    return Math.min(60000 * Math.pow(2, attempts), 3600000);
  }
}

export const aiTaskQueue = new AITaskQueue();
```

### 5.3 详细任务分解

| 任务                            | 预估工时 | 优先级 | 依赖        |
| ------------------------------- | -------- | ------ | ----------- |
| 任务队列数据库表                | 2h       | P0     | -           |
| AIEventSystem 实现              | 4h       | P0     | -           |
| AITaskQueue 实现                | 4h       | P0     | 数据库表    |
| AutoProcessSkill 实现           | 6h       | P0     | EventSystem |
| 事件触发集成 (bookmark:created) | 3h       | P0     | AutoProcess |
| 智能推荐卡片组件                | 6h       | P1     | -           |
| 首页推荐集成                    | 4h       | P1     | 推荐卡片    |
| 任务队列 Worker (Edge Function) | 6h       | P1     | TaskQueue   |
| 待确认任务 UI                   | 4h       | P1     | AutoProcess |
| 测试和调试                      | 4h       | P0     | 所有        |
| **小计**                        | **43h**  |        |             |

### 5.4 成功标准

- [ ] 新收藏后 5 秒内自动开始处理
- [ ] 高置信度分类自动应用（>90%）
- [ ] 低置信度分类创建待确认任务
- [ ] 首页显示智能推荐卡片
- [ ] 后台任务队列正常运行

---

## 六、Module 3: 工作流编排 (Workflow)

### 6.1 功能范围

| 功能           | 描述                             | 优先级 |
| -------------- | -------------------------------- | ------ |
| Skill 链式执行 | 多个 Skill 串行/并行执行         | P0     |
| 预定义工作流   | "整理本周收藏"、"生成学习报告"等 | P1     |
| 工作流执行面板 | 展示执行步骤和进度               | P1     |
| 自定义工作流   | 用户自定义 Skill 组合            | P2     |

### 6.2 技术设计

#### 6.2.1 WorkflowEngine

```typescript
// src/lib/ai-workflow/workflow-engine.ts

import { skillRegistry } from "@/lib/ai-skills";

/**
 * 工作流步骤
 */
export interface WorkflowStep {
  id: string;
  skillId: string;
  input:
    | Record<string, unknown>
    | ((prevOutputs: Map<string, unknown>) => Record<string, unknown>);
  dependsOn?: string[]; // 依赖的前置步骤 ID
  optional?: boolean; // 失败是否继续
}

/**
 * 工作流定义
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  parallel?: boolean; // 是否并行执行（无依赖的步骤）
}

/**
 * 工作流执行结果
 */
export interface WorkflowResult {
  workflowId: string;
  status: "completed" | "partial" | "failed";
  stepResults: Map<string, StepResult>;
  totalDuration: number;
}

/**
 * 工作流引擎
 */
export class WorkflowEngine {
  /**
   * 执行工作流（生成器，支持流式进度）
   */
  async *execute(
    workflow: WorkflowDefinition,
    context: SkillContext,
  ): AsyncGenerator<WorkflowEvent> {
    const startTime = performance.now();
    const stepResults = new Map<string, StepResult>();
    const prevOutputs = new Map<string, unknown>();

    yield { type: "workflow_start", workflow };

    // 构建执行计划（拓扑排序）
    const executionOrder = this.topologicalSort(workflow.steps);

    for (const stepId of executionOrder) {
      const step = workflow.steps.find((s) => s.id === stepId)!;

      yield { type: "step_start", step };

      try {
        // 解析输入（可能依赖前置步骤输出）
        const input =
          typeof step.input === "function"
            ? step.input(prevOutputs)
            : step.input;

        // 执行 Skill
        const skill = skillRegistry.get(step.skillId);
        if (!skill) throw new Error(`Skill not found: ${step.skillId}`);

        const result = await skill.execute(input, context);

        stepResults.set(stepId, { success: true, result });
        prevOutputs.set(stepId, result.data);

        yield { type: "step_complete", step, result };
      } catch (error) {
        stepResults.set(stepId, {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        yield { type: "step_error", step, error };

        if (!step.optional) {
          yield {
            type: "workflow_end",
            result: {
              workflowId: workflow.id,
              status: "failed",
              stepResults,
              totalDuration: performance.now() - startTime,
            },
          };
          return;
        }
      }
    }

    const hasErrors = Array.from(stepResults.values()).some((r) => !r.success);

    yield {
      type: "workflow_end",
      result: {
        workflowId: workflow.id,
        status: hasErrors ? "partial" : "completed",
        stepResults,
        totalDuration: performance.now() - startTime,
      },
    };
  }

  private topologicalSort(steps: WorkflowStep[]): string[] {
    // 拓扑排序实现...
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (stepId: string) => {
      if (visited.has(stepId)) return;
      visited.add(stepId);

      const step = steps.find((s) => s.id === stepId);
      if (step?.dependsOn) {
        for (const dep of step.dependsOn) {
          visit(dep);
        }
      }
      result.push(stepId);
    };

    for (const step of steps) {
      visit(step.id);
    }

    return result;
  }
}
```

#### 6.2.2 预定义工作流

```typescript
// src/lib/ai-workflow/presets/organize-weekly.ts

import { WorkflowDefinition } from "../workflow-engine";

/**
 * 整理本周收藏工作流
 */
export const organizeWeeklyWorkflow: WorkflowDefinition = {
  id: "organize-weekly",
  name: "整理本周收藏",
  description: "统计本周收藏，批量生成摘要和分类建议",
  steps: [
    {
      id: "count",
      skillId: "count_bookmarks", // 使用 Tool
      input: {
        date_from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
    {
      id: "list",
      skillId: "list_bookmarks",
      input: (prev) => ({
        date_from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        limit: 50,
        has_summary: false, // 只获取未生成摘要的
      }),
      dependsOn: ["count"],
    },
    {
      id: "summarize",
      skillId: "summary",
      input: (prev) => {
        const bookmarks = prev.get("list") as { bookmarks: Bookmark[] };
        return {
          bookmarkIds: bookmarks.bookmarks.slice(0, 10).map((b) => b.id),
          mode: "standard",
        };
      },
      dependsOn: ["list"],
      optional: true,
    },
    {
      id: "classify",
      skillId: "classify",
      input: (prev) => {
        const bookmarks = prev.get("list") as { bookmarks: Bookmark[] };
        return {
          bookmarkIds: bookmarks.bookmarks
            .filter((b) => !b.folder_id)
            .map((b) => b.id),
        };
      },
      dependsOn: ["list"],
      optional: true,
    },
    {
      id: "report",
      skillId: "generate_report", // 新增的报告生成 Skill
      input: (prev) => ({
        countResult: prev.get("count"),
        summarizeResult: prev.get("summarize"),
        classifyResult: prev.get("classify"),
      }),
      dependsOn: ["count", "summarize", "classify"],
    },
  ],
};
```

### 6.3 详细任务分解

| 任务                          | 预估工时 | 优先级 | 依赖   |
| ----------------------------- | -------- | ------ | ------ |
| WorkflowEngine 核心实现       | 6h       | P0     | -      |
| 拓扑排序和依赖管理            | 2h       | P0     | Engine |
| 预定义工作流: organize-weekly | 3h       | P1     | Engine |
| 预定义工作流: learning-report | 3h       | P1     | Engine |
| 工作流执行面板组件            | 6h       | P1     | Engine |
| API 路由 (/api/ai/workflow)   | 3h       | P0     | Engine |
| 工作流选择器组件              | 4h       | P1     | -      |
| 测试                          | 3h       | P0     | 所有   |
| **小计**                      | **30h**  |        |        |

### 6.4 成功标准

- [ ] "帮我整理本周收藏" → 执行完整工作流并展示进度
- [ ] 工作流中间步骤失败不影响可选步骤
- [ ] 执行面板实时显示每步进度
- [ ] 支持至少 3 个预定义工作流

---

## 七、实施路线图

### 7.1 时间线总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Phase 3 实施路线图 (6周)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Week 1-2: Module 1 学习能力                                        │
│  ├── W1: 数据库迁移 + LearnSkill 骨架 + find_connections            │
│  └── W2: create_study_plan + Tools + 基础 UI                        │
│                                                                     │
│  Week 3-4: Module 2 主动感知                                        │
│  ├── W3: EventSystem + TaskQueue + AutoProcessSkill                 │
│  └── W4: 事件集成 + 推荐卡片 + 首页集成                              │
│                                                                     │
│  Week 5-6: Module 3 工作流编排 + 集成测试                            │
│  ├── W5: WorkflowEngine + 预定义工作流                               │
│  └── W6: UI 组件 + 集成测试 + 文档                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 里程碑

| 里程碑               | 时间   | 验收标准                       |
| -------------------- | ------ | ------------------------------ |
| **M1: 学习能力上线** | Week 2 | 知识关联发现、学习计划生成可用 |
| **M2: 主动感知上线** | Week 4 | 新收藏自动处理、智能推荐可用   |
| **M3: Phase 3 完成** | Week 6 | 工作流编排可用、全部测试通过   |

### 7.3 工作量汇总

| 模块                 | 工时     | 占比 |
| -------------------- | -------- | ---- |
| Module 1: 学习能力   | 49h      | 40%  |
| Module 2: 主动感知   | 43h      | 35%  |
| Module 3: 工作流编排 | 30h      | 25%  |
| **总计**             | **122h** | 100% |

**预估周期**: 6 周（按每周 20h 有效工作时间）

---

## 八、风险与缓解

| 风险               | 影响 | 概率 | 缓解措施                         |
| ------------------ | ---- | ---- | -------------------------------- |
| LLM 关联分析不准确 | 高   | 中   | 结合向量相似度+规则引擎+用户反馈 |
| 自动处理误操作     | 高   | 低   | 高置信度阈值(>90%)+待确认机制    |
| 后台任务积压       | 中   | 中   | 任务优先级+限流+降级策略         |
| 知识图谱性能       | 中   | 低   | 限制显示节点数+懒加载+缓存       |
| 工作流超时         | 中   | 中   | 单步超时+总超时+部分结果返回     |

---

## 九、成功指标

### 9.1 技术指标

| 指标               | 目标  |
| ------------------ | ----- |
| 知识关联准确率     | > 80% |
| 学习计划生成成功率 | > 95% |
| 自动处理延迟 (P95) | < 10s |
| 工作流完成率       | > 90% |

### 9.2 用户指标

| 指标           | 目标          |
| -------------- | ------------- |
| 学习计划使用率 | 日活用户 10%+ |
| 自动处理满意度 | 4.0/5.0+      |
| 工作流使用率   | 日活用户 5%+  |

---

## 十、与长期规划对接

### 10.1 Phase 3 → Phase 4 衔接

Phase 3 完成后，为 Phase 4 (L3 级) 打下基础：

| Phase 3 能力 | Phase 4 扩展           |
| ------------ | ---------------------- |
| 学习能力     | + 复习系统 (SM-2 算法) |
| 主动感知     | + 持续学习 (纠错反馈)  |
| 工作流编排   | + 自定义工作流         |

### 10.2 智能等级提升

```
Phase 2 (已完成): L2 (部分自动化)
      ↓
Phase 3 (本阶段): L2.5 (学习+感知)
      ↓
Phase 4 (下阶段): L3 (有条件自动化)
```

---

## 十一、审核确认项

请审核以下关键决策：

### 11.1 模块优先级

- [ ] **确认**: P0 学习能力 → P1 主动感知 → P2 工作流编排

### 11.2 技术选型

- [ ] **确认**: 使用 Supabase Realtime 实现事件触发
- [ ] **确认**: 后台任务队列使用数据库轮询（vs Edge Functions）
- [ ] **确认**: 知识图谱使用 React Flow 可视化

### 11.3 范围边界

- [ ] **确认**: Phase 3 不包含复习系统（推迟到 Phase 4）
- [ ] **确认**: Phase 3 不包含自定义工作流（推迟到 Phase 4）
- [ ] **确认**: Phase 3 不包含持续学习（推迟到 Phase 4）

### 11.4 资源投入

- [ ] **确认**: 预估 122h 工作量，6 周周期

---

**文档状态**: 待审核
**下一步**: 用户审核后，创建具体的 Task 列表开始实施
