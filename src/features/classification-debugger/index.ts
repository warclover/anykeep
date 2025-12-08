/**
 * 智能分类调试工具 - 主入口
 *
 * V3 vs V4 分类对比调试工具
 *
 * 使用方式：
 * ```typescript
 * import { DebuggerPage } from '@/features/classification-debugger';
 * ```
 *
 * 环境变量：
 * - NEXT_PUBLIC_ENABLE_CLASSIFICATION_DEBUGGER: 前端功能开关
 * - ENABLE_CLASSIFICATION_DEBUGGER: 后端 API 开关
 */

// 类型导出
export type {
  DebugBookmarkInput,
  DebugScenario,
  PresetConfigKey,
  CompareRequest,
  CompareResponse,
  VersionResult,
  ComparisonDiff,
  MockScenarioData,
  PresetConfig,
  DebuggerUIState,
} from "./types";

// 常量导出
export {
  V3_SIMULATION_CONFIG,
  PRESET_CONFIGS,
  getPresetConfig,
  getPresetList,
  mergeConfig,
  MOCK_SCENARIOS,
  getScenarioData,
  getScenarioList,
  needsRealData,
} from "./constants";

// 组件导出
export {
  DebuggerPage,
  BookmarkInput,
  ScenarioSelector,
  ConfigPanel,
  ResultsCompare,
} from "./components";

// 服务导出
export {
  compareClassification,
  executeClassification,
  getMockContext,
  loadRealContext,
  isScenarioAvailable,
} from "./services";
export type { ExecutionParams, ExecutionContext } from "./services";

// API 导出
export { handleCompare } from "./api";

// Hooks 导出
export { useClassificationCompare } from "./hooks";

/**
 * 功能开关检查
 */
export function isDebuggerEnabled(): boolean {
  // 客户端环境
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_ENABLE_CLASSIFICATION_DEBUGGER === "true";
  }
  // 服务端环境
  return process.env.ENABLE_CLASSIFICATION_DEBUGGER === "true";
}
