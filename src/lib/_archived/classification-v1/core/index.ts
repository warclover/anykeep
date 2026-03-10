/**
 * Classification Core Module
 * 核心抽象层导出
 *
 * @version 1.0.0
 * @since 2026-01-24 Phase 2
 */

// Types
export type {
  ClassificationRequest,
  ClassificationResult,
  ClassificationAction,
  ClassificationScores,
  BookmarkInput,
  StrategyType,
  ClassificationVersion,
  ClassificationFacadeConfig,
  ClassificationFeatureFlags,
  LegacyClassificationResult,
} from "./types";

// Interfaces
export type {
  IClassificationStrategy,
  IStrategyResolver,
  IClassificationFacade,
  IFeatureFlagService,
} from "./interfaces";

// Constants
export {
  CONFIDENCE_THRESHOLDS,
  CLASSIFICATION_STATUS,
  ROLLOUT_STAGE,
  FOLDER_LIMITS,
  CACHE_CONFIG,
  DEFAULT_FEATURE_FLAGS,
} from "./constants";

// Errors
export {
  ClassificationError,
  ValidationError,
  StrategyNotFoundError,
  FolderNotFoundError,
  QuotaExceededError,
  DeprecatedError,
  PipelineError,
} from "./errors";
