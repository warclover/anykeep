/**
 * AI 组件模块导出
 *
 * @version 2.1.0
 * @since 2025-12-22
 * @updated 2025-12-24 - 添加统一输出协议相关组件
 * @updated 2025-12-26 - 添加整理组件（批量整理前端集成）
 */

// 类型
export * from "./types";

// 核心组件
export { AIMessage } from "./ai-message";
export { AIInput } from "./ai-input";
export { AIPanelContent } from "./ai-panel-content";
export { AIAssistantPanel } from "./ai-assistant-panel";
export { AIAssistantPanelEmbedded } from "./ai-assistant-panel-embedded";
export {
  AIAssistantButton,
  FloatingAIAssistantButton,
} from "./ai-assistant-button";
export {
  AIActionFeedback,
  AIActionFeedbackInline,
  type AIActionFeedbackProps,
  type AIActionFeedbackInlineProps,
  type ActionRiskLevel,
} from "./ai-action-feedback";
export {
  ActionConfirmDialog,
  ActionConfirmInline,
  type ActionConfirmDialogProps,
  type ActionConfirmInlineProps,
} from "./action-confirm-dialog";
export { AIBookmarkChat, type AIBookmarkChatProps } from "./ai-bookmark-chat";

// 统一输出协议组件
export {
  AIProgressIndicator,
  AIProgressIndicatorInline,
  AIStepsList,
} from "./ai-progress-indicator";
export { AIDeliverableCard } from "./ai-deliverable-card";
export {
  AISuggestionsPanel,
  AISuggestionsInline,
  AIQuickSuggestions,
} from "./ai-suggestions-panel";
export {
  MemoryIndicator,
  MemoryIndicatorExpanded,
  MemoryToast,
  type MemoryIndicatorProps,
  type MemoryToastProps,
} from "./memory-indicator";

// 整理组件（批量整理前端集成）
export {
  OrganizePlanPreview,
  type OrganizePlanPreviewProps,
} from "./organize-plan-preview";
export {
  OrganizeProgress,
  OrganizeProgressInline,
  type OrganizeProgressProps,
} from "./organize-progress";
export {
  OrganizeResult,
  type OrganizeResultProps,
  type UndoState,
} from "./organize-result";

// 书签详情页组件
export { AISmartSummary, type AISmartSummaryProps } from "./ai-smart-summary";
export {
  AIRelatedContent,
  type AIRelatedContentProps,
} from "./ai-related-content";
export { AIQuickActions, type AIQuickActionsProps } from "./ai-quick-actions";
export {
  AIBookmarkAssistant,
  type AIBookmarkAssistantProps,
} from "./ai-bookmark-assistant";

// 搜索页组件
export {
  SemanticSearchToggle,
  SearchModeToggleGroup,
  InlineSearchModeToggle,
  type SemanticSearchToggleProps,
  type SearchMode,
} from "./semantic-search-toggle";
export {
  AISearchSuggestions,
  type AISearchSuggestionsProps,
} from "./ai-search-suggestions";
export {
  AISearchEnhanced,
  AISearchExplanation,
  type AISearchEnhancedProps,
} from "./ai-search-enhanced";

// 搜索结果组件（增强搜索体验）
export {
  SearchResultCard,
  type SearchResultCardProps,
} from "./search-result-card";
export {
  QueryFeedback,
  SearchSuggestions,
  type QueryFeedbackProps,
  type SearchSuggestionsProps,
} from "./query-feedback";
export {
  SearchResultsList,
  SearchResultsSummary,
  type SearchResultsListProps,
} from "./search-results-list";

// 交付物展示组件
export { CleanupPreview } from "./deliverables/cleanup-preview";
export { DigestView } from "./deliverables/digest-view";
export {
  MindmapViewer,
  convertDigestToMindmap,
  type MindmapNode,
} from "./deliverables/mindmap-viewer";

// 命令提示组件
export { AICommandHints, type AICommandHintsProps } from "./ai-command-hints";
