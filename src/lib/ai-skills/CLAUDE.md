[根目录](../../../CLAUDE.md) > [src](../../) > [lib](../) > **ai-skills**

# AI Skills 编排系统

## 模块职责

`src/lib/ai-skills` 是 "Orchestration Mode" 的核心，负责处理需要多步骤、状态保持和复杂推理的任务。它基于 `BaseSkill` 抽象，管理技能的生命周期。

## 架构组件

- **UnifiedEngine** (`engine/unified-engine.ts`): 统一入口，负责接收请求并分发。
- **IntentRouter** (`router/`): 意图分析与路由，决定走 Atomic, Orchestration 还是 Workflow 模式。
- **OrchestrationEngine** (`engine/orchestration-engine.ts`): 技能执行引擎，流式返回进度。
- **Skills Implementation** (`skills/`): 具体技能实现
  - `batch-organize`: 批量整理
  - `insight-report`: 洞察报告
  - `knowledge-review`: 知识回顾
  - ... (共 30+ Skills)
- **Output Formatters** (`output/formatters/`): 统一输出格式（Markdown, JSON 等）。

## 关键流程

1. **Intent Analysis**: `router/intent-analyzer.ts` 分析用户意图复杂度。
2. **Mode Selection**: 选择执行模式。
3. **Execution**: 加载对应 Skill，按步骤 (`step`) 执行。
4. **Progress Reporting**: `orchestration/progress-reporter.ts` 通过 SSE 推送进度。

## 开发新 Skill

1. 继承 `BaseSkill`。
2. 定义 Schema (`zod`)。
3. 实现 `execute` 方法，分解为多个 `step`。
4. 在 `register.ts` 中注册。

## 变更记录

- **2026-01-08**: 新增 6 个 Skills (Inbox Triage, etc.)
- **2025-12-24**: 完成统一智能架构
