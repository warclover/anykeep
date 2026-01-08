/**
 * 工作流触发器模块导出
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

// 类型导出
export * from "./types";

// 定时触发
export { TriggerScheduler, getTriggerScheduler } from "./trigger-scheduler";

// 事件触发
export {
  EventTriggerManager,
  getEventTriggerManager,
} from "./event-trigger-manager";

// 事件发射
export {
  emitWorkflowEvent,
  emitBrowserBookmarkImportCompleted,
  emitBookmarkCreated,
  emitFolderCreated,
  emitTagAdded,
} from "./event-emitter";

// 分布式锁
export {
  DistributedLockManager,
  getDistributedLockManager,
  type DistributedLockConfig,
} from "./distributed-lock";
