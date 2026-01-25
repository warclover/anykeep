[根目录](../../../CLAUDE.md) > [src](../../) > [lib](../) > **workflow**

# Workflow 自动化系统

## 模块职责

`src/lib/workflow` 处理长时运行、异步、事件触发或定时触发的自动化任务。它是 "Workflow Mode" 的实现层。

## 核心组件

- **Orchestrator** (`orchestrator/`): 工作流编排器，管理流程状态。
- **Triggers** (`triggers/`): 触发机制
  - `trigger-scheduler.ts`: 定时任务调度
  - `event-trigger-manager.ts`: 事件监听触发
  - `distributed-lock.ts`: 分布式锁，防止重复执行
- **State Manager** (`state/`): 持久化工作流状态到数据库。
- **Built-in Workflows** (`builtin/`): 预置工作流
  - `daily-digest`: 每日摘要
  - `folder-cleanup`: 文件夹清理
  - `bookmark-health`: 链接健康检查

## 集成方式

通过 `UnifiedEngine` 的 `WorkflowIntentMatcher` 识别特定意图（如 "每天帮我整理..."）并转交此模块处理。

## 数据持久化

状态存储于 Supabase 数据库，支持断点恢复和历史查询。

## 变更记录

- **2026-01-12**: 文档更新与架构图补充
