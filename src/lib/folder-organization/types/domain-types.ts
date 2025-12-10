/**
 * Folder Organization Module - Domain Types
 * 文件夹自组织模块领域类型定义
 *
 * @version 4.2
 */

// ============================================================================
// 文件夹画像类型
// ============================================================================

/**
 * 文件夹画像数据
 */
export interface FolderProfile {
  id: number;
  userId: string;
  folderId: number;
  folderName: string;

  /** 书签数量 */
  bookmarkCount: number;

  /** 高频标签 */
  topTags: string[];

  /** 画像向量 */
  profileEmbedding: number[] | null;

  /** 样本标题 */
  sampleTitles: string[];

  /** 内部相似度 (0-1)，低于 0.5 考虑分拆 */
  internalSimilarity: number | null;

  /** 热度分数 */
  heatScore: number;

  /** 最后活跃时间 */
  lastBookmarkAt: string | null;

  /** 计算来源 */
  source: "full" | "incremental" | "manual";

  /** 计算时间 */
  computedAt: string;
  updatedAt: string;
}

/**
 * 文件夹画像更新请求
 */
export interface FolderProfileUpdate {
  bookmarkCount?: number;
  topTags?: string[];
  profileEmbedding?: number[];
  sampleTitles?: string[];
  internalSimilarity?: number;
  heatScore?: number;
  lastBookmarkAt?: string;
}

// ============================================================================
// 操作快照类型
// ============================================================================

/**
 * 操作类型
 */
export type OperationType = "create" | "split" | "merge" | "rename" | "move";

/**
 * 操作快照
 */
export interface OperationSnapshot {
  id: number;
  userId: string;
  action: OperationType;

  /** 操作前状态 */
  beforeState: Record<string, unknown>;

  /** 操作后状态 */
  afterState: Record<string, unknown>;

  /** 是否已撤销 */
  isUndone: boolean;

  /** 撤销时间 */
  undoneAt: string | null;

  /** 创建时间 */
  createdAt: string;
}

// ============================================================================
// 演进建议类型
// ============================================================================

/**
 * 建议类型
 */
export type SuggestionType =
  | "create"
  | "split"
  | "merge"
  | "rename"
  | "cleanup";

/**
 * 建议优先级
 */
export type SuggestionPriority = "high" | "medium" | "low";

/**
 * 演进建议
 */
export interface EvolutionSuggestion {
  type: SuggestionType;
  description: string;
  targetFolders: Array<{ id: number; name: string }>;
  priority: SuggestionPriority;

  /** 建议理由 */
  reason?: string;

  /** 置信度 (0-100) */
  confidence?: number;
}

/**
 * 创建文件夹建议
 */
export interface FolderCreateSuggestion {
  suggestedName: string;
  bookmarkIds: number[];
  reason: string;
  confidence: number;
  topTags: string[];
}

/**
 * 分拆建议
 */
export interface FolderSplitSuggestion {
  sourceFolderId: number;
  sourceFolderName: string;
  suggestedClusters: Array<{
    name: string;
    bookmarkIds: number[];
    topTags: string[];
  }>;
  reason: string;
  internalSimilarity: number;
}

/**
 * 合并建议
 */
export interface FolderMergeSuggestion {
  folderIds: number[];
  folderNames: string[];
  suggestedName: string;
  reason: string;
  similarity: number;
}

/**
 * 重命名建议
 */
export interface FolderRenameSuggestion {
  folderId: number;
  currentName: string;
  suggestedName: string;
  reason: string;
  confidence: number;
}

// ============================================================================
// 模块配置类型
// ============================================================================

/**
 * 自组织模块配置
 */
export interface FolderOrganizationConfig {
  /** 是否启用 */
  enabled: boolean;

  /** 自动化级别: 0=禁用, 1=仅建议, 2=半自动, 3=全自动 */
  autonomyLevel: 0 | 1 | 2 | 3;

  /** 分拆阈值：内部相似度低于此值触发分拆建议 */
  splitThreshold: number;

  /** 合并阈值：文件夹间相似度高于此值触发合并建议 */
  mergeThreshold: number;

  /** 清理阈值：书签数量低于此值触发清理建议 */
  cleanupThreshold: number;

  /** 是否启用热度追踪 */
  enableHeatTracking: boolean;

  /** 是否启用自动重命名 */
  enableAutoRename: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_FOLDER_ORG_CONFIG: FolderOrganizationConfig = {
  enabled: true,
  autonomyLevel: 1,
  splitThreshold: 0.5,
  mergeThreshold: 0.85,
  cleanupThreshold: 2,
  enableHeatTracking: true,
  enableAutoRename: false,
};

// ============================================================================
// 模块状态类型
// ============================================================================

/**
 * 模块状态
 */
export interface FolderOrganizationStatus {
  initialized: boolean;
  eventHandlerActive: boolean;
  heatTrackerActive: boolean;
  lastEventTime: string | null;
  pendingSuggestions: number;
}
