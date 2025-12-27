/**
 * Trust Mode Tools 导出
 *
 * 信任模式相关的 AI Tools，用于获取和推荐信任模式设置。
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

export { getTrustModeTool } from "./get-trust-mode.tool";
export { recommendTrustModeTool } from "./recommend-trust-mode.tool";

// 导出类型
export type {
  GetTrustModeResult,
  RecommendTrustModeResult,
  TrustModeBehavior,
  TrustModeStats,
  RecommendationFactor,
  RecommendationResult,
  RecommendationMetrics,
  RecommendationReasoning,
} from "./types";

export { TRUST_MODE_DISPLAY, RECOMMENDATION_THRESHOLDS } from "./types";

// 导出 Tools 数组
import { getTrustModeTool } from "./get-trust-mode.tool";
import { recommendTrustModeTool } from "./recommend-trust-mode.tool";

export const trustModeTools = [getTrustModeTool, recommendTrustModeTool];
