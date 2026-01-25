/**
 * 智能分类 v5.0 - Gardener 类型定义
 *
 * 为 v5 组件提供统一的类型定义
 * @version 5.0.1
 * @since 2026-01-25
 */

/**
 * 阈值调整支持数据
 */
export interface ThresholdSupportingData {
  totalClassifications: number;
  averageAccuracy: number;
  t1CorrectionRate: number;
  userCorrectionRate: number;
}

/**
 * 阈值调整建议
 */
export interface ThresholdAdjustment {
  /** 当前阈值 */
  current: number;
  /** @deprecated 使用 current */
  currentThreshold: number;
  /** 建议阈值 */
  suggested: number;
  /** @deprecated 使用 suggested */
  suggestedThreshold: number;
  /** 调整原因 */
  reason: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 影响评估 */
  impact: {
    accuracy_change: number;
    coverage_change: number;
  };
  /** 支持数据 */
  supportingData: ThresholdSupportingData;
}

/**
 * 文件夹健康问题
 */
export interface FolderHealthIssue {
  description: string;
  suggestedAction: string;
}

/**
 * 文件夹建议
 */
export interface FolderSuggestion {
  id: string;
  type: "merge" | "split" | "rename" | "archive";
  /** 源文件夹 ID */
  source_folder_id: number;
  /** @deprecated 使用 source_folder_id */
  folderId: number;
  /** 源文件夹名称 */
  source_folder_name: string;
  /** @deprecated 使用 source_folder_name */
  folderName: string;
  target_folder_id?: number;
  target_folder_name?: string;
  suggested_name?: string;
  reason: string;
  confidence: number;
  affected_bookmarks: number;
  /** 健康状态 */
  healthStatus: "healthy" | "warning" | "critical";
  /** 问题列表 */
  issues: FolderHealthIssue[];
}

/**
 * 同义词项
 */
export interface SynonymItem {
  folderId: number;
  folderName: string;
  similarity: number;
}

/**
 * 同义词组
 */
export interface SynonymGroup {
  id: string;
  /** 主要术语 */
  primary_term: string;
  /** @deprecated 使用 primary_term 对应的文件夹名 */
  primaryFolderName: string;
  /** 同义词列表 - 支持字符串数组或对象数组 */
  synonyms: (string | SynonymItem)[];
  folder_id: number;
  folder_name: string;
  frequency: number;
  /** 置信度 (0-1) */
  confidence: number;
  /** ���议操作 */
  suggestedAction: "merge" | "rename" | "keep_separate";
}

/**
 * 命名建议
 */
export interface NamingSuggestion {
  folder_id: number;
  /** @deprecated 使用 folder_id */
  folderId: number;
  current_name: string;
  /** @deprecated 使用 current_name */
  currentName: string;
  suggested_name: string;
  /** @deprecated 使用 suggested_name */
  suggestedName: string;
  reason: string;
  confidence: number;
}

/**
 * Gardener 报告
 */
export interface GardenerReport {
  id: string;
  user_id: string;
  threshold_adjustment: ThresholdAdjustment | null;
  folder_suggestions: FolderSuggestion[];
  synonym_groups: SynonymGroup[];
  naming_suggestions: NamingSuggestion[];
  generated_at: string;
  expires_at: string;
}
