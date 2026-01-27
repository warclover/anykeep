/**
 * Classification Integration Module
 * 分类集成层模块导出
 *
 * @version 1.0.0
 * @since 2026-01-27
 */

// 分类处理函数（从 integration.ts 拆分）
export {
  handleHighConfidenceClassification,
  handleMediumConfidenceClassification,
  handleLowConfidenceClassification,
  type ClassificationHandlerResult,
} from "./classification-handlers";
