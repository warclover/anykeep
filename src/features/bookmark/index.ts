/**
 * Bookmark Feature Module
 *
 * Phase 5: 模块解耦
 * 书签功能模块统一入口
 *
 * 模块边界契约：
 * - 公共组件通过 components 导出
 * - 公共 Hooks 通过 hooks 导出
 * - 公共类型通过 types 导出
 * - 公共常量通过 constants 导出
 *
 * 使用示例：
 * ```typescript
 * import { BookmarkCard, useBookmarkActions } from "@/features/bookmark";
 * ```
 */

// ============================================================================
// Components - 公共组件
// ============================================================================

// 核心展示组件
export { BookmarkCard } from "@/components/bookmark/bookmark-card";
export { FlipBookmarkCard } from "@/components/bookmark/bookmark-card-flip";
export { BookmarkListItem } from "@/components/bookmark/bookmark-list-item";
export { TrashBookmarkCard } from "@/components/bookmark/trash-bookmark-card";
export { BookmarkDetailClient } from "@/components/bookmark/bookmark-detail-client";

// 虚拟滚动列表
export { VirtualBookmarkList } from "@/components/bookmark/virtual-bookmark-list";
export { BrowserBookmarkVirtualList } from "@/components/bookmark/browser-bookmark-virtual-list";

// 空状态组件
export { EmptyState } from "@/components/bookmark/empty-state";
export { BrowserBookmarkEmptyState } from "@/components/bookmark/browser-bookmark-empty-state";

// 对话框组件
export { CreateBookmarkDialog } from "@/components/bookmark/create-bookmark-dialog";
export { CreateBookmarkDrawer } from "@/components/bookmark/create-bookmark-drawer";
export { EditBookmarkDialog } from "@/components/bookmark/edit-bookmark-dialog";
export { BatchMoveDialog } from "@/components/bookmark/batch-move-dialog";
export { BatchImportDialog } from "@/components/bookmark/batch-import-dialog";
export { MoveToFolderDialog } from "@/components/bookmark/move-to-folder-dialog";
export { AddCustomUsageTagDialog } from "@/components/bookmark/add-custom-usage-tag-dialog";

// 标签和评分组件
export { UsageTagSelector } from "@/components/bookmark/usage-tag-selector";
export { UsageTagInlineEditor } from "@/components/bookmark/usage-tag-inline-editor";
export { UsageTagButton } from "@/components/bookmark/usage-tag-button";
export { BookmarkRating } from "@/components/bookmark/bookmark-rating";
export { BookmarkRatingDisplay } from "@/components/bookmark/bookmark-rating-display";

// 内容类型徽章
export { ContentTypeBadge } from "@/components/bookmark/content-type-badge";
export { SourceBadge } from "@/components/bookmark/source-badge";

// 摘要和推荐
export { SummaryRenderer } from "@/components/bookmark/summary-renderer";
export { RelatedBookmarksV2 } from "@/components/bookmark/related-bookmarks-v2";

// 分类和反馈
export { ReclassifyBanner } from "@/components/bookmark/reclassify-banner";
export { FolderRecommendationToast } from "@/components/bookmark/folder-recommendation-toast";
export {
  showLearningFeedback,
  showSimpleLearningFeedback,
  useLearningFeedback,
  type LearningFeedbackOptions,
} from "@/components/bookmark/learning-feedback-toast";

// Vision 分析
export { VisionInsights } from "@/components/bookmark/vision-insights";

// ============================================================================
// Hooks - 公共 Hooks
// ============================================================================

export { useBookmarkActions } from "@/hooks/domain/bookmark/use-bookmark-actions";
export { useReclassify } from "@/hooks/domain/bookmark/use-reclassify";
export { useAutoSnapshot } from "@/hooks/domain/bookmark/use-auto-snapshot";
export { useAutoSnapshotSettings } from "@/hooks/domain/bookmark/use-auto-snapshot-settings";
export { useVisionAnalysis } from "@/hooks/domain/ai/use-vision-analysis";

// ============================================================================
// Types - 公共类型
// ============================================================================

export type { Bookmark, Platform } from "@/types/supabase";
export type { ContentType } from "@/lib/classification/content-type-detector";

// ============================================================================
// Constants - 公共常量
// ============================================================================

export {
  PLATFORM_CONFIGS,
  ALL_PLATFORMS,
  CONTENT_PLATFORMS,
  BROWSER_PLATFORMS,
} from "@/lib/constants/platforms";
