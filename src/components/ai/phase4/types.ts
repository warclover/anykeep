/**
 * Phase 4: 交互升级 - 类型定义
 *
 * 包含所有 Phase 4 组件的类型定义
 * 支持 stub 组件和完整组件的兼容
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

// =============================================================================
// 工具选择器类型
// =============================================================================

/**
 * 工具类型（完整版 - 用于 ExplicitToolRouter）
 */
export type ToolType =
  | "auto"
  | "search"
  | "stats"
  | "organize"
  | "tag"
  | "dedupe"
  | "summarize"
  | "extract"
  | "review"
  | "export"
  | "create"; // 兼容 stub 组件

/**
 * 工具分类
 */
export type ToolCategory = "query" | "manage" | "create" | "export";

/**
 * 工具定义（用于 stub ToolSelector）
 */
export interface ToolDefinition {
  id: ToolType;
  name: string;
  icon: string;
  description: string;
  shortcut?: string;
}

/**
 * 工具选项（完整版）
 */
export interface ToolOption {
  id: ToolType;
  name: string;
  description: string;
  icon: string;
  shortcut?: string;
  category: ToolCategory;
  disabled?: boolean;
}

/**
 * 工具选择器 Props（完整版）
 */
export interface ToolSelectorProps {
  selectedTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  disabled?: boolean;
  className?: string;
}

// =============================================================================
// 快速操作类型
// =============================================================================

/**
 * 消息操作类型
 */
export type MessageActionType =
  | "copy"
  | "regenerate"
  | "save"
  | "export"
  | "like"
  | "dislike";

/**
 * 消息操作定义
 */
export interface MessageAction {
  type: MessageActionType;
  label: string;
  icon: string;
  disabled?: boolean;
}

/**
 * 反馈原因
 */
export type FeedbackReason =
  // UI 使用的值 (quick-actions.tsx)
  | "wrong_intent"
  | "inaccurate_result"
  | "bad_format"
  | "incomplete"
  | "other"
  // API 使用的值 (feedback/route.ts)
  | "inaccurate"
  | "irrelevant"
  | "slow"
  | "confusing";

/**
 * 反馈原因选项
 */
export interface FeedbackReasonOption {
  id: FeedbackReason;
  label: string;
}

/**
 * 反馈详情
 */
export interface FeedbackDetails {
  reasons: FeedbackReason[];
  comment?: string;
}

/**
 * 消息操作栏 Props
 */
export interface MessageActionsBarProps {
  messageId: string;
  content: string;
  onRegenerate?: () => void;
  onSave?: (noteId: string) => void;
  onExport?: () => void;
  onFeedback?: (type: "like" | "dislike", details?: FeedbackDetails) => void;
  feedbackGiven?: "like" | "dislike" | null;
  isLoading?: boolean;
  className?: string;
}

// =============================================================================
// 执行确认类型
// =============================================================================

/**
 * 风险等级
 */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/**
 * 整理操作类型
 */
export type OrganizeActionType =
  | "move"
  | "tag"
  | "untag"
  | "merge"
  | "archive"
  | "delete";

/**
 * 整理操作定义
 */
export interface OrganizeAction {
  type: OrganizeActionType;
  targets: number[];
  params: {
    folderName?: string;
    folderId?: number;
    tags?: string[];
    permanent?: boolean;
  };
}

/**
 * 操作风险评估
 */
export interface ActionRisk {
  level: RiskLevel;
  message: string;
  requiresConfirmation: boolean;
  requiresInput?: string;
}

/**
 * 操作摘要
 */
export interface ActionSummary {
  type: OrganizeActionType;
  count: number;
  target: string;
  description: string;
}

/**
 * 执行确认 Props
 */
export interface ActionConfirmationProps {
  title: string;
  actions: OrganizeAction[];
  onConfirm: () => void;
  onAdjust?: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
  className?: string;
}

// =============================================================================
// 上下文面板类型
// =============================================================================

/**
 * 上下文项类型（兼容版本）
 */
export type ContextItemType =
  | "bookmark"
  | "folder"
  | "tag"
  | "selection"
  | "conversation"
  | "search_results"
  | "previous_output";

/**
 * 上下文项（简化版 - stub 组件用）
 */
export interface ContextItem {
  id: string;
  type: ContextItemType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 上下文面板状态
 */
export interface ContextPanelState {
  isExpanded: boolean;
  items: ContextItem[];
  selectedItemId?: string;
}

/**
 * 书签上下文数据
 */
export interface BookmarkContextData {
  type: "bookmark";
  id: number;
  title: string;
  url?: string;
  summary?: string;
  platform?: string;
  createdAt?: Date;
}

/**
 * 文件夹上下文数据
 */
export interface FolderContextData {
  type: "folder";
  id: number;
  name: string;
  bookmarkCount: number;
}

/**
 * 标签上下文数据
 */
export interface TagContextData {
  type: "tag";
  name: string;
  bookmarkCount?: number;
}

/**
 * 搜索结果上下文数据
 */
export interface SearchResultsContextData {
  type: "search_results";
  query: string;
  results: BookmarkContextData[];
}

/**
 * 前次输出上下文数据
 */
export interface PreviousOutputContextData {
  type: "previous_output";
  messageId: string;
  preview: string;
  content: string;
}

/**
 * 上下文项数据联合类型
 */
export type ContextItemData =
  | BookmarkContextData
  | FolderContextData
  | TagContextData
  | SearchResultsContextData
  | PreviousOutputContextData;

// =============================================================================
// API 请求/响应类型
// =============================================================================

/**
 * 显式工具请求（用于 API）
 */
export interface UnifiedRequestWithExplicitTool {
  message: string;
  conversationId?: string;
  explicitTool?: {
    toolId: string;
    skipIntentClassification: boolean;
  };
  contextReferences?: {
    bookmarkIds?: number[];
    folderIds?: number[];
    tagNames?: string[];
    previousOutputId?: string;
  };
}

/**
 * 反馈请求
 */
export interface FeedbackRequest {
  messageId: string;
  conversationId: string;
  type: "positive" | "negative";
  negativeReason?: FeedbackReason;
  comment?: string;
  context?: {
    originalMessage?: string;
    classifiedIntent?: string;
    toolUsed?: string;
    executionMode?: string;
    skillId?: string;
  };
}

/**
 * 撤销请求
 */
export interface UndoRequest {
  snapshotId: string;
}

/**
 * 撤销响应
 */
export interface UndoResponse {
  success: boolean;
  restoredCount?: number;
  error?: string;
}

/**
 * 保存笔记请求
 */
export interface SaveNoteRequest {
  content: string;
  title?: string;
  sourceType:
    | "ai_summary"
    | "ai_extraction"
    | "ai_review"
    | "ai_report"
    | "ai_response";
  relatedBookmarkIds?: number[];
  sourceConversationId?: string;
  sourceMessageId?: string;
  sourceSkillId?: string;
  tags?: string[];
}

/**
 * 保存笔记响应
 */
export interface SaveNoteResponse {
  id: string;
  title: string;
  createdAt: string;
}

/**
 * 可撤销操作记录
 */
export interface UndoableOperation {
  snapshotId: string;
  operationType: string;
  description: string;
  createdAt: Date;
  expiresAt: Date;
  affectedCount: number;
}
