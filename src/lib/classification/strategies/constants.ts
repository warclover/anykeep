/**
 * 兼容性重导出 - strategies/constants
 *
 * 统一导出 core 和 classic 模块需要的所有常量
 */

// Core constants (v5.0+)
export * from "../core/constants";

// Classic matcher constants (兼容旧模块)
export {
  CLASSIFICATION_WEIGHTS,
  CLASSIFICATION_THRESHOLDS,
  AI_SERVICE_CONFIG,
} from "../constants/limits";
