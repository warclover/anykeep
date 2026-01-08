/**
 * 工作流系统模块导出
 *
 * Phase 1: 核心引擎 MVP
 *
 * @version 1.0.0
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
} from "./builtin";
