/**
 * Brain-Sync 组件模块导出
 *
 * @module components/brain-sync
 * @version 2.0.0
 * @since 2025-12-29
 * @updated 2026-01-01 - 添加 v2 组件导出
 */

// 页面组件
export { BrainSyncPageClient } from "./brain-sync-page-client";

// 设置组件
export { BrainSyncSettingsCard } from "./brain-sync-settings-card";

// 复习组件 (v1)
export {
  FlashcardReviewCard,
  type FlashcardData,
} from "./flashcard-review-card";
export { ReviewSession } from "./review-session";

// 复习组件 (v2)
export {
  FlashcardReviewCardV2,
  type FlashcardDataV2,
} from "./flashcard-review-card-v2";
export { RelatedBookmarks } from "./related-bookmarks";

// 侧边栏提醒
export { SidebarReminder } from "./sidebar-reminder";
