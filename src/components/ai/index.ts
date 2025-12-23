/**
 * AI 组件模块导出
 *
 * @version 1.4.0
 * @since 2025-12-22
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

// 书签详情页组件
export { AISmartSummary, type AISmartSummaryProps } from "./ai-smart-summary";
export {
  AIRelatedContent,
  type AIRelatedContentProps,
} from "./ai-related-content";
export { AIQuickActions, type AIQuickActionsProps } from "./ai-quick-actions";

// 搜索页组件
export {
  SemanticSearchToggle,
  SearchModeToggleGroup,
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
