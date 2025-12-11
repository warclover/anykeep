/**
 * 待确认消息类型定义
 * V4.2 半托管模式核心功能
 *
 * @description 定义半托管模式下 AI 建议与用户确认的数据结构
 * - 分类确认：低置信度分类需要用户确认
 * - 文件夹操作确认：创建/合并/拆分/重命名建议
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

// ============================================================================
// 核心类型
// ============================================================================

/**
 * 确认类型
 */
export type ConfirmationType =
  | "classification" // 分类确认
  | "folder_create" // 文件夹创建
  | "folder_merge" // 文件夹合并
  | "folder_split" // 文件夹拆分
  | "folder_rename"; // 文件夹重命名

/**
 * 确认状态
 */
export type ConfirmationStatus =
  | "pending" // 待确认
  | "confirmed" // 已确认（接受建议）
  | "rejected" // 已拒绝
  | "modified" // 已修改（用户选择了其他选项）
  | "expired"; // 已过期（超时未处理）

// ============================================================================
// 建议数据结构
// ============================================================================

/**
 * 分类建议
 */
export interface ClassificationSuggestion {
  /** 建议的文件夹 ID */
  folderId: number | null;
  /** 建议的文件夹名称 */
  folderName: string | null;
  /** 置信度 (0-100) */
  confidence: number;
  /** 建议理由 */
  reason: string;
  /** 备选文件夹列表 */
  alternatives: Array<{
    folderId: number;
    folderName: string;
    confidence: number;
  }>;
  /** 匹配来源 */
  matchSource?: "embedding" | "source" | "tag" | "rule";
}

/**
 * 文件夹创建建议
 */
export interface FolderCreateSuggestion {
  /** 建议的文件夹名称 */
  suggestedName: string;
  /** 触发原因 */
  reason: string;
  /** 关联的书签 ID 列表 */
  bookmarkIds: number[];
  /** 预计书签数量 */
  estimatedCount: number;
  /** 推荐标签 */
  suggestedTags?: string[];
}

/**
 * 文件夹合并建议
 */
export interface FolderMergeSuggestion {
  /** 目标文件夹 ID（合并到） */
  targetFolderId: number;
  /** 目标文件夹名称 */
  targetFolderName: string;
  /** 源文件夹 ID 列表（被合并） */
  sourceFolderIds: number[];
  /** 源文件夹名称列表 */
  sourceFolderNames: string[];
  /** 合并理由 */
  reason: string;
  /** 涉及的书签数量 */
  affectedBookmarks: number;
  /** 相似度分数 */
  similarityScore: number;
}

/**
 * 文件夹拆分建议
 */
export interface FolderSplitSuggestion {
  /** 源文件夹 ID */
  sourceFolderId: number;
  /** 源文件夹名称 */
  sourceFolderName: string;
  /** 建议拆分后的子文件夹 */
  suggestedSubFolders: Array<{
    name: string;
    bookmarkIds: number[];
    reason: string;
  }>;
  /** 拆分理由 */
  reason: string;
  /** 涉及的书签数量 */
  affectedBookmarks: number;
}

/**
 * 文件夹重命名建议
 */
export interface FolderRenameSuggestion {
  /** 文件夹 ID */
  folderId: number;
  /** 当前名称 */
  currentName: string;
  /** 建议的新名称 */
  suggestedName: string;
  /** 重命名理由 */
  reason: string;
  /** 备选名称 */
  alternatives?: string[];
}

/**
 * 建议联合类型
 */
export type Suggestion =
  | ClassificationSuggestion
  | FolderCreateSuggestion
  | FolderMergeSuggestion
  | FolderSplitSuggestion
  | FolderRenameSuggestion;

// ============================================================================
// 用户响应
// ============================================================================

/**
 * 用户对分类的选择
 */
export interface ClassificationChoice {
  /** 用户选择的文件夹 ID（null 表示保持待整理） */
  selectedFolderId: number | null;
  /** 如果用户选择新建文件夹 */
  newFolderName?: string;
  /** 用户反馈 */
  feedback?: "correct" | "partially_correct" | "incorrect";
  /** 反馈备注 */
  comment?: string;
}

/**
 * 用户对文件夹操作的选择
 */
export interface FolderOperationChoice {
  /** 是否接受建议 */
  accepted: boolean;
  /** 如果用户修改了建议 */
  modifications?: Record<string, unknown>;
  /** 反馈备注 */
  comment?: string;
}

/**
 * 用户选择联合类型
 */
export interface UserChoice {
  /** 选择内容（根据确认类型不同而变化） */
  choice: ClassificationChoice | FolderOperationChoice;
  /** 响应时间戳 */
  timestamp: string;
}

// ============================================================================
// 数据库模型
// ============================================================================

/**
 * 待确认记录数据库模型
 */
export interface PendingConfirmationRecord {
  id: number;
  user_id: string;

  /** 确认类型 */
  confirmation_type: ConfirmationType;

  /** 关联的书签 ID（分类确认时使用） */
  bookmark_id: number | null;

  /** 关联的文件夹 ID（文件夹操作时使用） */
  folder_id: number | null;

  /** AI 建议（JSON 格式） */
  suggestion: Suggestion;

  /** 当前状态 */
  status: ConfirmationStatus;

  /** 用户选择（JSON 格式，响应后填充） */
  user_choice: UserChoice | null;

  /** 过期时间（7天后自动处理） */
  expires_at: string;

  /** 创建时间 */
  created_at: string;

  /** 解决时间 */
  resolved_at: string | null;
}

/**
 * 待确认记录创建输入
 */
export interface CreatePendingConfirmationInput {
  userId: string;
  confirmationType: ConfirmationType;
  bookmarkId?: number;
  folderId?: number;
  suggestion: Suggestion;
  expiresInDays?: number; // 默认 7 天
}

/**
 * 待确认记录响应输入
 */
export interface RespondToConfirmationInput {
  confirmationId: number;
  userId: string;
  userChoice: UserChoice;
}

// ============================================================================
// 前端展示类型
// ============================================================================

/**
 * 确认消息展示数据（用于消息列表）
 */
export interface ConfirmationMessageDisplay {
  id: number;
  type: ConfirmationType;
  status: ConfirmationStatus;

  /** 标题 */
  title: string;

  /** 描述 */
  description: string;

  /** 建议内容（类型安全） */
  suggestion: Suggestion;

  /** 关联书签信息（分类确认时） */
  bookmark?: {
    id: number;
    title: string;
    url: string;
  };

  /** 关联文件夹信息（文件夹操作时） */
  folder?: {
    id: number;
    name: string;
  };

  /** 过期剩余时间 */
  expiresIn: string;

  /** 创建时间 */
  createdAt: string;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取确认类型显示信息
 */
export const CONFIRMATION_TYPE_INFO: Record<
  ConfirmationType,
  { label: string; icon: string }
> = {
  classification: {
    label: "分类确认",
    icon: "folder-open",
  },
  folder_create: {
    label: "创建文件夹",
    icon: "folder-plus",
  },
  folder_merge: {
    label: "合并文件夹",
    icon: "git-merge",
  },
  folder_split: {
    label: "拆分文件夹",
    icon: "scissors",
  },
  folder_rename: {
    label: "重命名文件夹",
    icon: "pencil",
  },
};

/**
 * 获取确认状态显示信息
 */
export const CONFIRMATION_STATUS_INFO: Record<
  ConfirmationStatus,
  { label: string; color: string }
> = {
  pending: {
    label: "待确认",
    color: "yellow",
  },
  confirmed: {
    label: "已确认",
    color: "green",
  },
  rejected: {
    label: "已拒绝",
    color: "red",
  },
  modified: {
    label: "已修改",
    color: "blue",
  },
  expired: {
    label: "已过期",
    color: "gray",
  },
};

/**
 * 验证确认类型
 */
export function isValidConfirmationType(
  type: unknown,
): type is ConfirmationType {
  return (
    type === "classification" ||
    type === "folder_create" ||
    type === "folder_merge" ||
    type === "folder_split" ||
    type === "folder_rename"
  );
}

/**
 * 验证确认状态
 */
export function isValidConfirmationStatus(
  status: unknown,
): status is ConfirmationStatus {
  return (
    status === "pending" ||
    status === "confirmed" ||
    status === "rejected" ||
    status === "modified" ||
    status === "expired"
  );
}

/**
 * 默认过期天数
 */
export const DEFAULT_EXPIRATION_DAYS = 7;

/**
 * 计算过期时间
 */
export function calculateExpirationDate(days: number = DEFAULT_EXPIRATION_DAYS): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
