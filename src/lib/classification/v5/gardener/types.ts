/**
 * 智能分类 v5.0 - Gardener 类型定义
 *
 * Gardener 是文件夹健康度分析和优化建议引擎
 *
 * @version 1.0.0
 * @since 2026-01-26
 */

/**
 * 文件夹健康状态
 */
export type HealthStatus = "healthy" | "warning" | "critical";

/**
 * 文件夹问题
 */
export interface FolderIssue {
  /** 问题类型 */
  type:
    | "too_many_items"
    | "too_few_items"
    | "low_coherence"
    | "naming_issue"
    | "duplicate_content";
  /** 问题描述 */
  description: string;
  /** 建议操作 */
  suggestedAction: string;
  /** 严重程度 */
  severity: "low" | "medium" | "high";
}

/**
 * 文件夹建议
 */
export interface FolderSuggestion {
  /** 文件夹 ID */
  folderId: number;
  /** 文件夹名称 */
  folderName: string;
  /** 健康状态 */
  healthStatus: HealthStatus;
  /** 问题列表 */
  issues: FolderIssue[];
  /** 书签数量 */
  bookmarkCount: number;
  /** 内聚度分数 (0-1) */
  coherenceScore: number;
}

/**
 * 同义词项
 */
export interface SynonymItem {
  /** ��件夹 ID */
  folderId: number;
  /** 文件夹名称 */
  folderName: string;
  /** 相似度 (0-1) */
  similarity: number;
}

/**
 * 同义词组
 */
export interface SynonymGroup {
  /** 主文件夹 ID */
  primaryFolderId: number;
  /** 主文件夹名称 */
  primaryFolderName: string;
  /** 同义词列表 */
  synonyms: (string | SynonymItem)[];
  /** 置信度 (0-1) */
  confidence: number;
  /** 建议操作 */
  suggestedAction: "merge" | "rename" | "keep_separate";
}

/**
 * 命名建议
 */
export interface NamingSuggestion {
  /** 文件夹 ID */
  folderId: number;
  /** 当前名称 */
  currentName: string;
  /** 建议名称 */
  suggestedName: string;
  /** 原因 */
  reason: string;
  /** 置信度 (0-1) */
  confidence: number;
}

/**
 * 阈值调整支持数据
 */
export interface ThresholdSupportingData {
  /** 总分类次数 */
  totalClassifications: number;
  /** 平均准确率 (0-1) */
  averageAccuracy: number;
  /** T1 纠正率 (0-1) */
  t1CorrectionRate: number;
  /** 用户纠正率 (0-1) */
  userCorrectionRate: number;
}

/**
 * 阈值调整建议
 */
export interface ThresholdAdjustment {
  /** 当前阈�� */
  currentThreshold: number;
  /** 建议阈值 */
  suggestedThreshold: number;
  /** 调整原因 */
  reason: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 支持数据 */
  supportingData: ThresholdSupportingData;
  /** 影响预估 */
  estimatedImpact?: {
    /** 预计增加的自动分类数 */
    additionalAutoClassified: number;
    /** 预计准确率变化 */
    accuracyChange: number;
  };
}

/**
 * Gardener 分析报告
 */
export interface GardenerReport {
  /** 报告 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 阈值调整建议 */
  thresholdAdjustment: ThresholdAdjustment | null;
  /** 文件夹建议列表 */
  folderSuggestions: FolderSuggestion[];
  /** 同义词组列表 */
  synonymGroups: SynonymGroup[];
  /** 命名建议列表 */
  namingSuggestions: NamingSuggestion[];
  /** 生成时间 */
  generatedAt: Date;
  /** 分析耗时 (ms) */
  analysisTimeMs: number;
}

/**
 * Gardener 配置
 */
export interface GardenerConfig {
  /** 最小书签数阈值 */
  minBookmarkCount: number;
  /** 最大书签数阈值 */
  maxBookmarkCount: number;
  /** 内聚度警告阈值 */
  coherenceWarningThreshold: number;
  /** 同义词相似度阈值 */
  synonymSimilarityThreshold: number;
}
