/**
 * 工作流触发器模块导出
 *
 * NOTE: Workflow system migrated to workflow-lite
 * Only TriggerScheduler is retained for scheduled tasks
 *
 * @version 2.1.0
 * @since 2026-01-08
 * @updated 2026-01-29 - Removed distributed lock (replaced with status-based atomic updates)
 */

// 类型导出
export * from "./types";

// 定时触发
export { TriggerScheduler, getTriggerScheduler } from "./trigger-scheduler";

// NOTE: Distributed lock removed - replaced with status-based atomic updates (YAGNI)
// NOTE: Event-based triggers removed - migrated to workflow-lite
