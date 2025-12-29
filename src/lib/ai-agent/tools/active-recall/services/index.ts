/**
 * Active Recall Services 模块导出
 *
 * @module tools/active-recall/services
 * @version 1.0.0
 * @since 2025-12-29
 */

export {
  // 常量
  REVIEW_TRIGGER_TAGS,

  // 类型
  type TagChangeEvent,

  // 标签匹配函数
  isTriggerTag,
  hasTriggerTag,
  getTriggerTags,

  // 核心监听器
  onBookmarkTagsChanged,

  // 队列管理
  addToFlashcardGenerationQueue,
  pauseFlashcardReviews,
  resumeFlashcardReviews,

  // 集成辅助
  createTagChangeMiddleware,
} from "./tag-change-listener";
