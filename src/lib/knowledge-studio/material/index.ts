/**
 * Material Scorer Module - 素材评分模块
 * @module knowledge-studio/material
 */

export { MaterialScorer, materialScorer } from "./material-scorer";
export {
  QUALITY_THRESHOLDS,
  DIMENSION_WEIGHTS,
  QUALITY_DISPLAY,
  getQualityLevel,
} from "./types";
export type {
  ScoreDimensions,
  MaterialScoreResult,
  MaterialAnalysisRequest,
  MaterialAnalysisResponse,
  MaterialQuality,
} from "./types";
