/**
 * Routing 模块入口
 *
 * 模式选择和复杂度评估相关功能
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

// 模式选择器
export {
  ModeSelector,
  createModeSelector,
  type ModeSelectorConfig,
} from "./mode-selector";

// 复杂度评估器
export {
  ComplexityEvaluator,
  createComplexityEvaluator,
  type ComplexityEvaluatorConfig,
  COMPLEXITY_THRESHOLDS,
  DATA_SCALE_THRESHOLDS,
  FACTOR_WEIGHTS,
  FACTOR_VALUES,
} from "./complexity-evaluator";

// 类型导出
export * from "./types";
