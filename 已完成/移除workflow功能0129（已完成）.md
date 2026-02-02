# 移除 Workflow 功能方案 (2025-01-29)

## 0. Workflow 现状与工作原理分析
在执行移除前，必须理解 Workflow 当前在架构中的深层绑定关系，以避免“拆除承重墙”。

### 核心角色
Workflow 目前是项目中的 **“自动化编排层” (Orchestration Layer)**，它位于 AI Skills 之上，负责将原子的 Skill 组合成复杂的长时运行任务（如“每周自动整理”、“深度主题学习”）。

### 工作原理 (耦合点)
1.  **最高优先级路由 (Gate -1)**：
    *   在 `src/lib/ai-skills/router/intent-router.ts` 中，Workflow 拥有比普通对话更高的优先级。
    *   **机制**：所有用户输入首先通过 `WorkflowIntentMatcher` 检查。如果匹配（例如用户说“帮我建立复习计划”），请求会被直接劫持，不会进入常规的大模型对话流程。
2.  **执行引擎侵入**:
    *   在 `src/lib/ai-skills/engine/unified-engine.ts` 中，硬编码了 `Workflow Mode` 的检测逻辑。
    *   一旦检测到是工作流任务，它会调用 `WorkflowModeExecutor`，而不是普通的 `SkillExecutor`。
3.  **事件驱动机制**:
    *   **Event Bus**: `src/lib/workflow/triggers/event-emitter.ts` 充当系统的神经中枢。
    *   **业务耦合**: 书签创建 (`/api/bookmarks`) 目前可能正在通过 `emit('bookmark.created')` 广播事件。Workflow 监听此事件来触发“自动分类”或“自动摘要”。如果删除 Workflow 但不清理发送端，会导致业务代码抛出异常。
4.  **状态持久化**:
    *   Workflow 将执行状态、步骤结果存储在 Supabase 数据库中，允许任务跨越多次请求（如 Cron 定时触发的每日任务）。

---

## 1. 目标
**目标**：彻底移除过度设计的 Workflow 编排引擎，回归 KISS 原则 (Keep It Simple, Stupid)，同时确保核心的“后台自动分类”功能通过更轻量的方式（直接调用或简单队列）实现。

## 2. 执行方案 (已修正)

### 第零阶段：代码解耦 (Decoupling Phase) - **关键**
**目的**：在物理删除文件前，先切断所有“硬连接”，确保核心业务和 AI 引擎在无 Workflow 状态下能编译通过。

1.  **AI 路由解耦**:
    *   文件：`src/lib/ai-skills/router/intent-router.ts`
    *   操作：注释或删除 `Gate -1: Workflow Automation` 代码块。
    *   文件：`src/lib/ai-skills/engine/unified-engine.ts`
    *   操作：移除 `Workflow Mode Detection` (约 280-297 行) 及其对 `getWorkflowModeExecutor` 的引用。
2.  **业务逻辑切断**:
    *   文件：`src/app/api/bookmarks/route.ts`
    *   操作：检查并移除 `workflowOrchestrator.dispatch(...)` 或 `eventEmitter.emit(...)`。
    *   **替代方案**：直接插入 `ClassificationService.classify(...)` 代码，确保分类功能不中断。
3.  **定时任务清理**:
    *   文件：`src/app/api/internal/cron/workflow-scheduled-triggers/route.ts`
    *   操作：标记为待删除或清空内容，防止 Vercel 继续调用产生错误日志。

### 第一阶段：工具迁移与物理移除 (Migration & Deletion)
1.  **工具抢救 (Optional)**:
    *   检查 `src/lib/workflow/utils/`。如果有通用的 `distributed-lock.ts` (分布式锁) 或 `object-utils.ts`，将其移动到 `src/lib/utils/` 以备后用。
2.  **物理删除**:
    *   执行 `rm -rf src/lib/workflow`
    *   执行 `rm -rf src/app/api/workflow`
    *   执行 `rm src/lib/ai-agent/tools/workflow-*.ts`

### 第二阶段：清理引用与配置 (Cleanup)
1.  **Feature Flags**:
    *   文件：`src/lib/ai-agent/config/feature-flag-registry.ts`
    *   操作：移除所有 `workflow` 相关模块定义和 Flag 开关。
2.  **UI 入口**:
    *   文件：`src/components/layout/app-sidebar.tsx` & `mobile-menu.tsx`
    *   操作：移除 "自动化/Workflow" 导航菜单。
3.  **Metrics**:
    *   文件：`src/lib/ai-agent/metrics/simple-metrics.ts`
    *   操作：移除工作流相关的统计指标代码。

### 第三阶段：文档与数据库收尾
1.  **文档更新**:
    *   `CLAUDE.md`: 移除模块索引和架构图中的 Workflow 节点。
2.  **数据库迁移 (可选)**:
    *   创建新的 Supabase Migration 文件，Drop 掉 `workflows`, `workflow_executions`, `workflow_steps` 等不再使用的表（建议观察一周后再执行）。

## 3. 风险控制
*   **编译检查**：每完成一个解耦步骤，运行 `npm run type-check` 确保没有悬空的类型引用。
*   **功能验证**：
    *   AI 对话功能：确保普通问答和 Skill 调用（如搜索）正常。
    *   收藏功能：添加新书签，确认“自动分类”依然生效（日志中应看到 ClassificationService 启动）。
