/**
 * Pending Confirmations Types
 * 待确认分类建议 - 类型定义
 *
 * @version 2.0.0
 * @since 2025-12-14
 */

// ============================================================================
// 展示模式
// ============================================================================

/**
 * 展示模式类型
 * - inline: 内联紧凑条模式（默认）
 * - drawer: 浮动按钮 + 侧边抽屉模式
 */
export type DisplayMode = "inline" | "drawer";

/**
 * 展示模式配置
 */
export interface DisplayModeConfig {
  mode: DisplayMode;
  autoConfirmThreshold?: number; // 自动确认的置信度阈值，如 90
}

// ============================================================================
// 确认消息
// ============================================================================

/**
 * 确认消息状态
 */
export type ConfirmationStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "modified"
  | "expired";

/**
 * 待确认消息
 */
export interface ConfirmationMessage {
  id: number;
  bookmarkId: number;
  bookmarkTitle: string;
  bookmarkUrl: string;
  suggestedFolderId: number;
  suggestedFolderName: string;
  confidence: number;
  reason: string;
  status: ConfirmationStatus;
  createdAt: string;
  expiresAt: string;
}

/**
 * 文件夹选项
 */
export interface FolderOption {
  id: number;
  name: string;
}

// ============================================================================
// API 响应
// ============================================================================

/**
 * API 返回的确认消息格式
 */
export interface ApiConfirmation {
  id: number;
  bookmarkId: number | null;
  type: string;
  status: string;
  suggestion: {
    folderId: number | null;
    folderName: string | null;
    confidence: number;
    reason: string | null;
  };
  metadata: Record<string, unknown> | null;
  expiresAt: string | null;
  createdAt: string;
  bookmark?: {
    title: string;
    url: string;
  };
}

// ============================================================================
// 操作回调
// ============================================================================

/**
 * 确认操作回调
 */
export interface ConfirmationActions {
  onConfirm: (messageId: number) => Promise<void>;
  onReject: (messageId: number) => Promise<void>;
  onModify: (messageId: number, newFolderId: number) => Promise<void>;
}

/**
 * 批量操作回调
 */
export interface BatchActions {
  onConfirmAll: () => Promise<void>;
  onRejectAll: () => Promise<void>;
  onClearSelection: () => void;
}

// ============================================================================
// Hook 返回类型
// ============================================================================

/**
 * useConfirmations hook 返回类型
 */
export interface UseConfirmationsReturn {
  // 状态
  messages: ConfirmationMessage[];
  folders: FolderOption[];
  isLoading: boolean;
  error: string | null;

  // 统计
  count: number;
  averageConfidence: number;

  // 操作
  confirm: (messageId: number) => Promise<void>;
  reject: (messageId: number) => Promise<void>;
  modify: (messageId: number, newFolderId: number) => Promise<void>;
  confirmAll: (ids?: number[]) => Promise<void>;
  rejectAll: (ids?: number[]) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * useDisplayMode hook 返回类型
 */
export interface UseDisplayModeReturn {
  mode: DisplayMode;
  setMode: (mode: DisplayMode) => void;
  toggleMode: () => void;
  config: DisplayModeConfig;
  updateConfig: (config: Partial<DisplayModeConfig>) => void;
}

// ============================================================================
// 组件 Props
// ============================================================================

/**
 * 主组件 Props
 */
export interface PendingConfirmationsProps {
  className?: string;
}

/**
 * 内联通知条 Props
 */
export interface InlineNotificationBarProps {
  messages: ConfirmationMessage[];
  averageConfidence: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onConfirmAll: () => Promise<void>;
  onModeChange: () => void;
  isLoading?: boolean;
}

/**
 * 内联展开列表 Props
 */
export interface InlineExpandedListProps {
  messages: ConfirmationMessage[];
  folders: FolderOption[];
  onConfirm: (messageId: number) => Promise<void>;
  onReject: (messageId: number) => Promise<void>;
  onModify: (messageId: number, newFolderId: number) => Promise<void>;
  onConfirmAll: () => Promise<void>;
  onRejectAll: () => Promise<void>;
}

/**
 * 内联列表项 Props
 */
export interface InlineListItemProps {
  message: ConfirmationMessage;
  folders: FolderOption[];
  onConfirm: () => Promise<void>;
  onReject: () => Promise<void>;
  onModify: (newFolderId: number) => Promise<void>;
}

/**
 * 浮动按钮 Props
 */
export interface FloatingButtonProps {
  count: number;
  onClick: () => void;
  isNew?: boolean;
}

/**
 * 确认抽屉 Props
 */
export interface ConfirmationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ConfirmationMessage[];
  folders: FolderOption[];
  onConfirm: (messageId: number) => Promise<void>;
  onReject: (messageId: number) => Promise<void>;
  onModify: (messageId: number, newFolderId: number) => Promise<void>;
  onConfirmAll: () => Promise<void>;
  onRejectAll: () => Promise<void>;
  onModeChange: () => void;
}

/**
 * 操作按钮组 Props
 */
export interface ConfirmationActionsProps {
  onConfirm: () => Promise<void>;
  onEdit: () => void;
  onReject: () => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  size?: "sm" | "default";
}

/**
 * 置信度徽章 Props
 */
export interface ConfidenceBadgeProps {
  confidence: number;
  showLabel?: boolean;
  size?: "sm" | "default";
}
