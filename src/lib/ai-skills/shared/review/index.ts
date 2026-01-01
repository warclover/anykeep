/**
 * Brain-Sync 共享模块导出
 *
 * @module shared/review
 * @version 2.0.0
 * @updated 2026-01-01 - 添加 v2 生成器导出
 */

// 类型导出
export * from "./types";

// 算法和工具
export { SM2Algorithm } from "./sm2-algorithm";
export {
  // v1 兼容
  generateFlashcards,
  validateFlashcardQuality,
  filterValidFlashcards,
  // v2 新增
  generateFlashcardsV2,
  validateFlashcardQualityV2,
} from "./flashcard-generator";
export {
  REVIEW_TRIGGER_TAGS,
  hasReviewTriggerTag,
  extractTriggerTags,
  hasNewTriggerTag,
  hasRemovedAllTriggerTags,
} from "./review-trigger-tags";
export {
  calculatePriority,
  sortByPriority,
  filterHighPriority,
  getDueToday,
  getOverdue,
  selectWeeklyReviewItems,
  calculateQueueStats,
} from "./priority-calculator";
