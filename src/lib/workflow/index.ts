/**
 * 工作流系统模块导出
 *
 * Phase 1: 核心引擎 MVP
 * Phase 4: 扩展工作流（定时触发、事件触发、预设工作流）
 *
 * @version 1.1.0
 * @since 2026-01-08
 */

// Types
export * from "./types";

// Core modules
export {
  WorkflowOrchestrator,
  getWorkflowOrchestrator,
} from "./orchestrator/workflow-orchestrator";

export { ExecutionEngine, getExecutionEngine } from "./engine/execution-engine";

export { StateManager, getStateManager } from "./state/state-manager";

// Utils
export {
  collectStreamResult,
  extractPrimaryDeliverable,
  isCollectionSuccess,
  type CollectedResult,
  type CollectOptions,
} from "./utils/stream-result-collector";

// Builtin workflows
export {
  bookmarkHealthSimpleWorkflow,
  seedBuiltinWorkflows,
  getBuiltinWorkflows,
  // Phase 4 workflows
  newUserOnboardingWorkflow,
  bookmarkHealthWorkflow,
  topicDeepDiveWorkflow,
  periodicBackupWorkflow,
  dailyDigestWorkflow,
  folderCleanupWorkflow,
  builtinWorkflows,
  getBuiltinWorkflow,
  getAllBuiltinWorkflows,
} from "./builtin";

// Phase 4: Triggers (exclude TriggerType to avoid collision)
export {
  // Types (excluding TriggerType which is already exported from ./types)
  type ScheduleFrequency,
  type ScheduleTriggerConfig,
  type ScheduledExecution,
  type ScheduledExecutionStatus,
  type EventType,
  type EventTriggerConfig,
  type WorkflowEvent,
  type ConversationTriggerConfig,
  type ConversationPattern,
  type TriggerDefinition,
  // Scheduler
  TriggerScheduler,
  getTriggerScheduler,
  // Event Manager
  EventTriggerManager,
  getEventTriggerManager,
  // Event Emitter
  emitWorkflowEvent,
  emitBrowserBookmarkImportCompleted,
  emitBookmarkCreated,
  emitFolderCreated,
  emitTagAdded,
  // Distributed Lock
  DistributedLockManager,
  getDistributedLockManager,
  type DistributedLockConfig,
} from "./triggers";
