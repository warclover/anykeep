/**
 * Calibration Module
 * V4.2 置信度校准模块入口
 *
 * @description 提供分类置信度校准功能
 * - 置信度校准服务
 * - 匹配器一致性评估
 * - 历史准确率跟踪
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

// ============================================================================
// 核心服务
// ============================================================================

export {
  ConfidenceCalibrationService,
  getConfidenceCalibrationService,
  createConfidenceCalibrationService,
  type CalibrationResult,
  type CalibrationBucket,
  type FolderCalibrationData,
  type CalibrationConfig,
} from "./confidence-calibration.service";

// ============================================================================
// 匹配器一致性
// ============================================================================

export {
  MatcherAgreementEvaluator,
  createMatcherAgreementEvaluator,
  assessMatcherAgreement,
  checkMatcherConflict,
  getConsensusResult,
  type MatcherResult,
  type AgreementAssessment,
  type AgreementConfig,
  type MatcherAnalysis,
} from "./matcher-agreement";

// ============================================================================
// 准确率跟踪
// ============================================================================

export {
  AccuracyTrackerService,
  getAccuracyTracker,
  createAccuracyTracker,
  type AccuracyRecord,
  type FolderAccuracy,
  type ConfidenceBucket,
  type ClassificationOutcome,
  type AccuracyTrackerConfig,
  type UserAccuracySummary,
} from "./accuracy-tracker.service";
