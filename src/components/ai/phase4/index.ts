/**
 * Phase 4: AI 交互 UI 升级 - 组件导出
 * @version 1.0.0
 */

// =============================================================================
// 类型导出
// =============================================================================

export type {
  // 工具选择器类型
  ToolType,
  ToolOption,
  ToolCategory,
  ToolSelectorProps,

  // 快速操作类型
  MessageActionType,
  MessageAction,
  MessageActionsBarProps,
  FeedbackDetails,
  FeedbackReason,
  FeedbackReasonOption,

  // 执行确认类型
  RiskLevel,
  OrganizeActionType,
  OrganizeAction,
  ActionRisk,
  ActionConfirmationProps,
  ActionSummary,

  // 上下文面板类型
  ContextItemType,
  ContextItem,
  ContextItemData,
  BookmarkContextData,
  FolderContextData,
  TagContextData,
  SearchResultsContextData,
  PreviousOutputContextData,
  ContextPanelProps,
  ContextPanelState,

  // API 请求/响应类型
  UnifiedRequestWithExplicitTool,
  FeedbackRequest,
  UndoRequest,
  UndoResponse,
  SaveNoteRequest,
  SaveNoteResponse,
  UndoableOperation,
} from "./types";

// =============================================================================
// 工具选择器组件
// =============================================================================

export {
  ToolSelector,
  ToolSelectorWithShortcuts,
  ToolHint,
  useToolShortcuts,
  TOOL_OPTIONS,
} from "./tool-selector";

// =============================================================================
// 快速操作栏组件
// =============================================================================

export { MessageActionsBar, InlineActions } from "./quick-actions";

// =============================================================================
// 执行确认组件
// =============================================================================

export {
  ActionConfirmation,
  ExecutionProgress,
  UndoToast,
  evaluateRisk,
  generateSummaries,
} from "./action-confirmation";

// =============================================================================
// 上下文面板组件
// =============================================================================

export {
  ContextPanel,
  ContextIndicator,
  ContextSelector,
  useContextItems,
} from "./context-panel";
