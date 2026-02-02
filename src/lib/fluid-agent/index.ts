// src/lib/fluid-agent/index.ts

// 类型导出
export * from "./types";

// 规则引擎
export { ruleRegistry } from "./prediction/rule-registry";
export { predictionEngine } from "./prediction/prediction-engine";
export { languageDetector } from "./prediction/language-detector";

// 执行引擎
export { operationExecutor } from "./execution/operation-executor";
export { snapshotManager } from "./execution/snapshot-manager";

// 遥测
export { telemetryManager } from "./telemetry/telemetry-manager";

// 规则集
export {
  allRules,
  registerAllRules,
  languageRules,
  contentRules,
  quantityRules,
  timeRules,
  sourceRules,
  organizationRules,
} from "./prediction/rules";

// Hooks
export { usePrediction } from "./ui/hooks/use-prediction";
export {
  useAgentHighlight,
  useHighlightStore,
} from "./ui/hooks/use-agent-highlight";
export { useBattery } from "./ui/hooks/use-battery";
export {
  useReduceMotion,
  setReduceMotionPreference,
  clearReduceMotionPreference,
} from "./ui/hooks/use-reduce-motion";

// Components
export { PredictionButton } from "./ui/components/prediction-button";
export { PredictionSheet } from "./ui/components/prediction-sheet";
export { ExecutionStatus } from "./ui/components/execution-status";
export { showUndoToast, UndoToastProvider } from "./ui/components/undo-toast";
export { BatteryIndicator } from "./ui/components/battery-indicator";
export { QuotaExhaustedDialog } from "./ui/components/quota-exhausted-dialog";
export { DeleteConfirmDialog } from "./ui/components/delete-confirm-dialog";

// Commands
export { commandMatcher } from "./commands/command-matcher";
export {
  presetCommands,
  getCommandById,
  getSelectionRequiredCommands,
  getGlobalCommands,
} from "./commands/preset-commands";
