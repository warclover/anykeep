/**
 * Phase 4: AI 交互 UI 升级 - 类型定义
 * @version 1.0.0
 * @description 工具选择器、快速操作、执行确认、上下文面板的类型定义
 */

import type { LucideIcon } from "lucide-react";

// =============================================================================
// 工具选择器 (ToolPicker) 类型
// =============================================================================

/**
 * 工具类型枚举
 */
export type ToolType =
  | "auto" // 自动判断（默认）
  | "search" // 搜索
  | "organize" // 整理
  | "summarize" // 总结
  | "export" // 导出
  | "extract" // 知识萃取
  | "review" // 知识回顾
  | "stats" // 数据统计
  | "tag" // 批量标签
  | "dedupe"; // 去重清理

/**
 * 工具选项配置
 */
export interface ToolOption {
  type: ToolType;
  label: string;
  icon: LucideIcon;
  description: string;
  category: ToolCategory;
  shortcut?: string;
  isDisabled?: boolean;
  disabledReason?: string;
}

/**
 * 工具分类
 */
export type ToolCategory = "auto" | "search" | "manage" | "create" | "export";

/**
 * 工具选择器 Props
 */
export interface ToolSelectorProps {
  value: ToolType;
  onChange: (tool: ToolType) => void;
  disabled?: boolean;
  className?: string;
}

// =============================================================================
// 快速操作栏 (QuickActions) 类型
// =============================================================================

/**
 * 消息操作类型
 */
export type MessageActionType =
  | "copy" // 复制内容
  | "regenerate" // 重新生成
  | "save" // 保存到笔记
  | "export" // 导出
  | "like" // 有帮助
  | "dislike"; // 无帮助

/**
 * 消息操作配置
 */
export interface MessageAction {
  type: MessageActionType;
  label: string;
  icon: LucideIcon;
  variant?: "default" | "ghost" | "destructive";
  requiresConfirm?: boolean;
}

/**
 * 快速操作栏 Props
 */
export interface MessageActionsBarProps {
  messageId: string;
  content: string;
  onRegenerate: () => void;
  onSave: (noteId: string) => void;
  onExport: () => void;
  onFeedback: (type: "like" | "dislike", details?: FeedbackDetails) => void;
  feedbackGiven?: "like" | "dislike" | null;
  isLoading?: boolean;
}

/**
 * 反馈详情
 */
export interface FeedbackDetails {
  reasons: FeedbackReason[];
  comment?: string;
}

/**
 * 反馈原因
 */
export type FeedbackReason =
  | "wrong_intent" // 理解错了意图
  | "inaccurate_result" // 结果不准确
  | "bad_format" // 格式不好
  | "incomplete" // 回答不完整
  | "other"; // 其他

/**
 * 反馈原因配置
 */
export interface FeedbackReasonOption {
  id: FeedbackReason;
  label: string;
}

// =============================================================================
// 执行确认组件 (ActionConfirmation) 类型
// =============================================================================

/**
 * 风险等级
 */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/**
 * 操作类型
 */
export type OrganizeActionType =
  | "move" // 移动
  | "tag" // 添加标签
  | "untag" // 移除标签
  | "merge" // 合并
  | "archive" // 归档
  | "delete"; // 删除

/**
 * 整理操作
 */
export interface OrganizeAction {
  type: OrganizeActionType;
  targets: string[]; // 受影响的书签 ID
  params: {
    targetFolderId?: string;
    folderName?: string;
    tags?: string[];
    permanent?: boolean;
  };
}

/**
 * 操作风险评估结果
 */
export interface ActionRisk {
  level: RiskLevel;
  message: string;
  requiresConfirmation: boolean;
  requiresInput?: string; // 需要输入的确认词
}

/**
 * 执行确认组件 Props
 */
export interface ActionConfirmationProps {
  title: string;
  actions: OrganizeAction[];
  onConfirm: () => void;
  onAdjust: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
}

/**
 * 操作摘要
 */
export interface ActionSummary {
  type: OrganizeActionType;
  count: number;
  target?: string;
  description: string;
}

// =============================================================================
// 上下文面板 (ContextPanel) 类型
// =============================================================================

/**
 * 上下文项类型
 */
export type ContextItemType =
  | "bookmark" // 书签
  | "folder" // 文件夹
  | "tag" // 标签
  | "search_results" // 搜索结果
  | "previous_output"; // 上一轮输出

/**
 * 上下文项
 */
export interface ContextItem {
  id: string;
  type: ContextItemType;
  data: ContextItemData;
  addedAt: Date;
  addedBy: "user" | "ai";
}

/**
 * 上下文项数据（联合类型）
 */
export type ContextItemData =
  | BookmarkContextData
  | FolderContextData
  | TagContextData
  | SearchResultsContextData
  | PreviousOutputContextData;

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
 * 上一轮输出上下文数据
 */
export interface PreviousOutputContextData {
  type: "previous_output";
  messageId: string;
  preview: string;
  content: string;
}

/**
 * 上下文面板 Props
 */
export interface ContextPanelProps {
  items: ContextItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onAddMore: () => void;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

/**
 * 上下文面板状态
 */
export interface ContextPanelState {
  items: ContextItem[];
  expanded: boolean;
}

// =============================================================================
// API 请求/响应类型
// =============================================================================

/**
 * 扩展的统一请求（支持显式工具）
 */
export interface UnifiedRequestWithExplicitTool {
  message: string;
  userId: string;
  conversationId?: string;

  /** 显式工具选择 */
  explicitTool?: {
    toolId: ToolType;
    skipIntentClassification: boolean;
  };

  /** 上下文引用 */
  contextReferences?: {
    bookmarkIds?: number[];
    folderIds?: number[];
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
  context: {
    originalMessage: string;
    classifiedIntent: string;
    toolUsed: string;
    executionMode?: "atomic" | "orchestration";
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
  restored: number;
  message: string;
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
 * 可撤销操作
 */
export interface UndoableOperation {
  id: string;
  operationType: string;
  bookmarkCount: number;
  summary: string;
  createdAt: string;
  expiresAt: string;
  timeRemaining: string;
}
