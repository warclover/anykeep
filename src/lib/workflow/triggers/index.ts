/**
 * 工作流触发器模块导出
 *
 * NOTE: Workflow system migrated to workflow-lite
 * Only TriggerScheduler and DistributedLock are retained for scheduled tasks
 *
 * @version 2.0.0
 * @since 2026-01-08
 * @updated 2026-01-29 - Removed event-based triggers (migrated to workflow-lite)
 */

// 类型导出
export * from "./types";

// 定时触发
export { TriggerScheduler, getTriggerScheduler } from "./trigger-scheduler";

// 分布式锁
export {
  DistributedLockManager,
  getDistributedLockManager,
  type DistributedLockConfig,
} from "./distributed-lock";

// NOTE: Event-based triggers removed - migrated to workflow-lite
// export { EventTriggerManager, getEventTriggerManager } from "./event-trigger-manager";
// export { emitWorkflowEvent, ... } from "./event-emitter";
