# AnyKeep Workflow 系统架构文档

> **版本**: 1.1.0
> **更新日期**: 2026-01-12
> **状态**: 生产就绪 (Feature Flag 控制)

---

## 概述

Workflow 系统是 AnyKeep AI 架构的第三种执行模式，专为**自动化流程**和**定时任务**设计。与原子模式（Atomic）和编排模式（Orchestration）不同，Workflow 支持：

- **异步执行**：不阻塞用户操作
- **状态持久化**：执行状态存储到数据库
- **多种触发方式**：手动、事件、定时、对话
- **跨会话执行**：支持暂停/恢复

---

## 架构图

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           UnifiedEngine                                   │
│                                                                           │
│   ┌───────────────────────────────────────────────────────────────────┐  │
│   │                        IntentRouter                                │  │
│   │                                                                    │  │
│   │   ┌─────────────────────────────────────────────────────────────┐ │  │
│   │   │                    IntentAnalyzer                            │ │  │
│   │   │  (统一意图分析器，合并原 Classifier/Evaluator/Selector)      │ │  │
│   │   │                                                              │ │  │
│   │   │  ① classifyIntent()      - 意图分类 (search/manage/...)     │ │  │
│   │   │  ② extractEntities()     - 实体提取 (时间/数量/主题/平台)   │ │  │
│   │   │  ③ evaluateComplexity()  - 复杂度评估 (5因素加权)           │ │  │
│   │   │  ④ selectMode()          - 模式选择 (atomic/orchestration)  │ │  │
│   │   │  ⑤ inferImplicitIntent() - 隐含意图推理                     │ │  │
│   │   └─────────────────────────────────────────────────────────────┘ │  │
│   │                              │                                     │  │
│   │   ┌──────────────────────────▼──────────────────────────────────┐ │  │
│   │   │              WorkflowIntentMatcher                           │ │  │
│   │   │                                                              │ │  │
│   │   │  matchWorkflow() - 检查对话是否匹配已注册工作流              │ │  │
│   │   │    └─ 匹配且置信度 ≥ 0.7 → mode: "workflow"                 │ │  │
│   │   │    └─ 否则 → 常规 Intent 分类结果                           │ │  │
│   │   └─────────────────────────────────────────────────────────────┘ │  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                                   │                                       │
└───────────────────────────────────┼───────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        WorkflowModeExecutor                               │
│                                                                           │
│   tryExecuteWorkflow(message, context)                                   │
│     └─ 匹配成功 → executeWorkflow()                                      │
│        └─ 调用 WorkflowOrchestrator.startWorkflow()                     │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        WorkflowOrchestrator                               │
│                                                                           │
│   ┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐        │
│   │ StateManager│◄──►│ ExecutionEngine │◄──►│ TriggerScheduler │        │
│   │             │    │                 │    │                  │        │
│   │ - 创建执行  │    │ - 步骤执行      │    │ - 定时调度       │        │
│   │ - 状态更新  │    │ - 错误处理      │    │ - 事件监听       │        │
│   │ - 历史查询  │    │ - 取消支持      │    │ - 分布式锁       │        │
│   └─────────────┘    └─────────────────┘    └──────────────────┘        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 核心组件

### 1. WorkflowOrchestrator

**路径**: `src/lib/workflow/orchestrator/workflow-orchestrator.ts`

统一编排入口，协调执行引擎和状态管理。

```typescript
class WorkflowOrchestrator {
  // 启动工作流
  async startWorkflow(
    workflowId: string,
    userId: string,
    options?: StartWorkflowOptions
  ): Promise<WorkflowExecution>;

  // 获取执行状态
  async getExecution(executionId: string): Promise<WorkflowExecution | null>;

  // 取消工作流
  async cancelWorkflow(executionId: string): Promise<boolean>;

  // 列出执行历史
  async listExecutions(
    userId: string,
    options?: ListExecutionsOptions
  ): Promise<WorkflowExecution[]>;

  // 列出可用工作流
  async listWorkflows(userId: string): Promise<WorkflowDefinition[]>;
}
```

### 2. ExecutionEngine

**路径**: `src/lib/workflow/engine/execution-engine.ts`

执行工作流步骤，支持取消和错误处理。

**步骤类型**:

| 类型 | 说明 | 配置接口 |
|------|------|----------|
| `skill` | 调用 AI Skill | `SkillStepConfig` |
| `tool` | 调用 AI Tool | `ToolStepConfig` |
| `condition` | 条件分支 | `ConditionStepConfig` |
| `parallel` | 并行执行 | `ParallelStepConfig` |
| `aggregate` | 聚合结果 | `AggregateStepConfig` |
| `notification` | 发送通知 | `NotificationStepConfig` |

### 3. StateManager

**路径**: `src/lib/workflow/state/state-manager.ts`

管理执行状态的持久化。

**执行状态**:

```typescript
type ExecutionStatus =
  | "pending"           // 等待执行
  | "running"           // 执行中
  | "completed"         // 已完成
  | "failed"            // 失败
  | "cancelled"         // 已取消
  | "waiting_confirmation"; // 等待确认
```

### 4. TriggerScheduler

**路径**: `src/lib/workflow/triggers/trigger-scheduler.ts`

定时触发调度器，支持 cron 表达式和间隔执行。

### 5. EventTriggerManager

**路径**: `src/lib/workflow/triggers/event-trigger-manager.ts`

事件触发管理器，监听系统事件并触发工作流。

**支持的事件类型**:

| 事件 | 触发场景 |
|------|----------|
| `bookmark_created` | 新建书签 |
| `folder_created` | 新建文件夹 |
| `tag_added` | 添加标签 |
| `browser_bookmark_import_completed` | 浏览器书签导入完成 |

### 6. WorkflowIntentMatcher

**路径**: `src/lib/workflow/integration/workflow-intent-matcher.ts`

对话意图匹配器，支持三种匹配模式：

| 模式 | 说明 | 置信度 |
|------|------|--------|
| `keyword` | 关键词匹配 | 0.9 (精确) / 0.7 (模糊) |
| `regex` | 正则表达式匹配 | 0.85 |
| `semantic` | 语义向量匹配 | 动态 (基于相似度) |

**安全特性**:
- ReDoS 防护：危险正则模式检测
- 长度限制：最大 200 字符
- 执行超时监控

---

## 工作流定义

### 数据结构

```typescript
interface WorkflowDefinition {
  id: string;                    // 工作流 ID
  name: string;                  // 工作流名称
  description: string;           // 描述
  version: string;               // 版本号
  category: "builtin" | "user_defined";  // 类别
  triggers: WorkflowTrigger[];   // 触发器配置
  steps: WorkflowStep[];         // 步骤列表
  config: WorkflowConfig;        // 工作流配置
}

interface WorkflowTrigger {
  type: "manual" | "event" | "schedule" | "conversation";
  eventType?: string;            // 事件类型 (event 触发)
  condition?: string;            // 条件表达式
  schedule?: {                   // 定时配置 (schedule 触发)
    type: "cron" | "interval";
    value: string;
  };
  patterns?: string[];           // 关键词模式 (conversation 触发)
  semanticPatterns?: {           // 语义模式 (conversation 触发)
    referenceTexts: string[];
    threshold?: number;
  };
}

interface WorkflowStep {
  id: string;                    // 步骤 ID
  name: string;                  // 步骤名称
  type: StepType;                // 步骤类型
  config: StepConfig;            // 步骤配置
  condition?: string;            // 条件表达式
  onError?: "stop" | "skip" | "continue";  // 错误处理
  requiresConfirmation?: boolean; // 是否需要确认
  confirmationMessage?: string;  // 确认消息
}
```

---

## 预置工作流

### 1. 书签健康检查 (`bookmark-health`)

**功能**: 检测失效链接、重复书签、整理建议

**步骤**:
1. 扫描所有书签
2. 检测失效链接
3. 检测重复项
4. 生成健康报告

**触发**: 手动 / 对话 ("检查书签健康"、"书签诊断")

### 2. 每日摘要 (`daily-digest`)

**功能**: 生成每日收藏活动摘要

**步骤**:
1. 统计今日新增
2. 分析内容分布
3. 生成摘要报告
4. 发送通知

**触发**: 定时 (每日 20:00)

### 3. 周期备份 (`periodic-backup`)

**功能**: 定时导出书签备份

**步骤**:
1. 查询所有书签
2. 导出为指定格式
3. 保存到存储
4. 清理过期备份

**触发**: 定时 (每周一 03:00)

### 4. 文件夹清理 (`folder-cleanup`)

**功能**: 清理空文件夹、优化结构

**步骤**:
1. 扫描文件夹树
2. 识别空文件夹
3. 生成清理建议
4. 执行清理 (需确认)

**触发**: 对话 ("清理文件夹"、"整理文件夹")

### 5. 新用户引导 (`new-user-onboarding`)

**功能**: 引导新用户完成初始设置

**步骤**:
1. 欢迎介绍
2. 功能演示
3. 推荐设置
4. 首次收藏引导

**触发**: 事件 (`user_first_login`)

### 6. 主题深挖 (`topic-deep-dive`)

**功能**: 对特定主题进行深度分析

**步骤**:
1. 收集相关书签
2. 内容分析
3. 知识图谱构建
4. 生成专题报告

**触发**: 对话 ("深入了解 [主题]"、"分析 [主题]")

---

## Feature Flags

| Flag | 说明 | 默认值 |
|------|------|--------|
| `ENABLE_WORKFLOW_SYSTEM` | 工作流系统总开关 | `true` |
| `ENABLE_WORKFLOW_CONVERSATION_TRIGGER` | 对话触发功能 | `true` |
| `ENABLE_WORKFLOW_RECOMMENDATIONS` | 工作流推荐功能 | `true` |
| `ENABLE_WORKFLOW_NOTIFICATIONS` | 工作流通知功能 | `true` |

**配置示例**:

```bash
# .env.local
ENABLE_WORKFLOW_SYSTEM=true
ENABLE_WORKFLOW_CONVERSATION_TRIGGER=true
ENABLE_WORKFLOW_RECOMMENDATIONS=true
ENABLE_WORKFLOW_NOTIFICATIONS=true
```

---

## 与 AI Agent 的集成

### 执行流程

```
用户消息: "帮我检查一下书签健康状况"
           │
           ▼
┌──────────────────────────────────────┐
│          UnifiedEngine               │
│                                      │
│  1. InputPreprocessor 预处理         │
│                                      │
│  2. IntentRouter.route()             │
│     ├─ WorkflowIntentMatcher.match() │
│     │   └─ 匹配 "bookmark-health"    │
│     │   └─ 置信度: 0.85              │
│     │                                │
│     └─ 返回 RouteResult              │
│        ├─ mode: "workflow"           │
│        └─ workflowId: "bookmark-..."│
│                                      │
│  3. ExecutionCoordinator             │
│     └─ WorkflowModeExecutor.execute()│
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│       WorkflowOrchestrator           │
│                                      │
│  1. 创建执行记录 (StateManager)       │
│     └─ executionId: "exec-xxx"       │
│                                      │
│  2. 异步执行步骤 (ExecutionEngine)    │
│     ├─ Step 1: skill:link_health    │
│     ├─ Step 2: skill:duplicate_scan │
│     ├─ Step 3: aggregate:report     │
│     └─ Step 4: notification:done    │
│                                      │
│  3. 更新状态 → "completed"           │
└──────────────────────────────────────┘
           │
           ▼
   返回执行 ID，用户可查询进度
```

### Workflow vs Orchestration Skill

| 维度 | Orchestration Skill | Workflow |
|------|---------------------|----------|
| **触发方式** | 仅对话触发 | 4种触发方式 |
| **执行模式** | 同步执行，流式返回 | 异步执行，状态轮询 |
| **状态持久化** | 无（内存） | 有（数据库） |
| **用户定义** | 不支持 | 支持（user_defined） |
| **暂停/恢复** | 仅确认请求 | 完整暂停/恢复 |
| **定时执行** | 不支持 | 支持（cron/interval） |
| **跨会话** | 不支持 | 支持 |
| **适用场景** | 即时复杂任务 | 长时间运行任务、定时任务 |

---

## 数据库表

### workflows

存储工作流定义。

```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),  -- NULL 表示内置工作流
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'user_defined',
  definition JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### workflow_executions

存储执行记录。

```sql
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending',
  trigger_type TEXT NOT NULL,
  trigger_context JSONB DEFAULT '{}',
  current_step_index INTEGER DEFAULT 0,
  step_results JSONB DEFAULT '[]',
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

---

## 文件结构

```
src/lib/workflow/
├── index.ts                       # 模块导出
├── types/
│   ├── index.ts
│   ├── workflow.types.ts          # 工作流类型定义
│   └── database.types.ts          # 数据库类型
├── orchestrator/
│   ├── index.ts
│   └── workflow-orchestrator.ts   # 工作流编排器
├── engine/
│   ├── index.ts
│   └── execution-engine.ts        # 执行引擎
├── state/
│   ├── index.ts
│   └── state-manager.ts           # 状态管理
├── triggers/
│   ├── index.ts
│   ├── types.ts
│   ├── trigger-scheduler.ts       # 定时触发
│   ├── event-trigger-manager.ts   # 事件触发
│   ├── event-emitter.ts           # 事件发射
│   └── distributed-lock.ts        # 分布式锁
├── integration/
│   ├── index.ts
│   ├── types.ts
│   ├── workflow-mode-executor.ts  # UnifiedEngine 集成
│   ├── workflow-intent-matcher.ts # 意图匹配
│   ├── semantic-matcher.ts        # 语义匹配
│   ├── workflow-recommender.ts    # 工作流推荐
│   ├── workflow-notifier.ts       # 通知服务
│   ├── workflow-system-reminder.ts # System-Reminder 注入
│   ├── skill-step-executor.ts     # Skill 步骤执行
│   ├── safe-expression-evaluator.ts # 安全表达式求值
│   └── intent-rules-workflow.ts   # 意图规则
├── builtin/
│   ├── index.ts
│   ├── seed-builtin-workflows.ts  # 内置工作流播种
│   ├── bookmark-health.workflow.ts
│   ├── bookmark-health-simple.workflow.ts
│   ├── daily-digest.workflow.ts
│   ├── periodic-backup.workflow.ts
│   ├── folder-cleanup.workflow.ts
│   ├── new-user-onboarding.workflow.ts
│   └── topic-deep-dive.workflow.ts
├── utils/
│   ├── index.ts
│   ├── input-mapper.ts            # 输入映射
│   ├── object-utils.ts            # 对象工具
│   └── stream-result-collector.ts # 流结果收集
└── __tests__/
    └── integration/
        └── workflow-execution.test.ts
```

---

## 测试覆盖

| 模块 | 测试文件 | 用例数 |
|------|----------|--------|
| StateManager | `state-manager.test.ts` | 15 |
| ExecutionEngine | `execution-engine.test.ts` | 20 |
| WorkflowOrchestrator | `workflow-orchestrator.test.ts` | 12 |
| WorkflowIntentMatcher | `workflow-intent-matcher.test.ts` | 18 |
| SemanticMatcher | `semantic-matcher.test.ts` | 10 |
| TriggerScheduler | `trigger-scheduler.test.ts` | 8 |
| EventTriggerManager | `event-trigger-manager.test.ts` | 12 |
| DistributedLock | `distributed-lock.test.ts` | 6 |
| SkillStepExecutor | `skill-step-executor.test.ts` | 10 |
| SafeExpressionEvaluator | `safe-expression-evaluator.test.ts` | 8 |
| **总计** | - | **119** |

---

## 扩展指南

### 添加新的预置工作流

1. 在 `builtin/` 创建工作流定义文件：

```typescript
// builtin/my-workflow.workflow.ts
import type { WorkflowDefinition } from "../types";

export const myWorkflow: WorkflowDefinition = {
  id: "my-workflow",
  name: "我的工作流",
  description: "工作流描述",
  version: "1.0.0",
  category: "builtin",
  triggers: [
    {
      type: "conversation",
      patterns: ["执行我的工作流", "运行我的任务"],
    },
  ],
  steps: [
    {
      id: "step-1",
      name: "第一步",
      type: "skill",
      config: {
        skillId: "some_skill",
        inputMapping: { query: "{{trigger.message}}" },
      },
    },
  ],
  config: {
    timeout: 60000,
    notifyOnComplete: true,
    notifyOnFailure: true,
  },
};
```

2. 在 `builtin/index.ts` 导出：

```typescript
export { myWorkflow } from "./my-workflow.workflow";
```

3. 在 `seed-builtin-workflows.ts` 添加播种逻辑。

### 添加新的触发类型

1. 在 `triggers/types.ts` 添加类型定义
2. 实现触发管理器
3. 在 `triggers/index.ts` 导出
4. 在 `WorkflowOrchestrator` 集成

---

## 相关文档

- [CLAUDE.md](../../CLAUDE.md) - AI 上下文文档
- [AI Skills 架构](../AI统一智能架构设计.md) - Skills 系统设计
- [Feature Flags](../FEATURE_FLAGS.md) - Feature Flag 配置指南
