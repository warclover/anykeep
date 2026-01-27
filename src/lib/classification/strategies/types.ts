/**
 * 兼容性重导出 - strategies/types
 *
 * 统一导出 modern 和 classic 模块需要的所有类型
 */

// Modern pipeline types (v5.0+)
export * from "./modern/types";

// Classic matcher types (兼容旧模块)
export type {
  MatchResult,
  MatcherContext,
  ClassificationResult,
  VectorMatchDetail,
  HistoryMatchDetail,
  AIRecommendationContext,
  AIRecommendation,
  ClassificationAction,
} from "../types/classification";
