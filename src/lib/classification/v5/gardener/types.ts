/**
 * 智能分类 v5.0 - Gardener 类型定义
 */

import type { FolderId } from "@/lib/shared/types";

/**
 * 阈值配置
 */
export interface ThresholdConfig {
  /** T0 置信度阈值 */
  t0ConfidenceThreshold: number;
  /** 向量冲突阈值 */
  vectorConflictThreshold: number;
  /** 最小阈值（不能低于此值） */
  minThreshold: number;
  /** 最大阈值（不能高于此值） */
  maxThreshold: number;
}

/**
 * 阈值调整建议
 */
export interface ThresholdAdjustment {
  /** 当前阈值 */
  currentThreshold: number;
  /** 建议阈值 */
  suggestedThreshold: number;
  /** 调整原因 */
  reason: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 支持数据 */
  supportingData: {
    /** 总分类次数 */
    totalClassifications: number;
    /** 平均准确率 */
    averageAccuracy: number;
    /** T1 纠正率 */
    t1CorrectionRate: number;
    /** 用户纠正率 */
    userCorrectionRate: number;
  };
}

/**
 * 文件夹健康状态
 */
export type FolderHealthStatus = "healthy" | "warning" | "critical";

/**
 * 文件夹问题类型
 */
export type FolderIssueType =
  | "over_dispersed" // 过度分散
  | "over_concentrated" // 过度集中
  | "synonym_detected" // 检测到同义词
  | "naming_inconsistent" // 命名不一致
  | "low_usage" // 使用率低
  | "duplicate_content"; // 内容重复

/**
 * 文件夹问题
 */
export interface FolderIssue {
  /** 问题类型 */
  type: FolderIssueType;
  /** 严重程度 (0-1) */
  severity: number;
  /** 问题描述 */
  description: string;
  /** 建议操作 */
  suggestedAction: string;
  /** 相关文件夹 ID */
  relatedFolderIds?: FolderId[];
}

/**
 * 文件夹建议
 */
export interface FolderSuggestion {
  /** 文件夹 ID */
  folderId: FolderId;
  /** 文件夹名称 */
  folderName: string;
  /** 健康状态 */
  healthStatus: FolderHealthStatus;
  /** 问题列表 */
  issues: FolderIssue[];
  /** 优先级 (0-1, 越高越紧急) */
  priority: number;
}

/**
 * 同义词组
 */
export interface SynonymGroup {
  /** 主文件夹 ID */
  primaryFolderId: FolderId;
  /** 主文件夹名称 */
  primaryFolderName: string;
  /** 同义文件夹列表 */
  synonyms: Array<{
    folderId: FolderId;
    folderName: string;
    similarity: number;
  }>;
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
  folderId: FolderId;
  /** 当前名称 */
  currentName: string;
  /** 建议名称 */
  suggestedName: string;
  /** 建议原因 */
  reason: string;
  /** 置信度 (0-1) */
  confidence: number;
}

/**
 * Gardener 配置
 */
export interface GardenerConfig {
  /** 阈值配置 */
  thresholds: ThresholdConfig;
  /** 同义词相似度阈值 */
  synonymSimilarityThreshold: number;
  /** 过度分散阈值（文件夹数量 / 书签数量） */
  overDispersedThreshold: number;
  /** 过度集中阈值（单个文件夹书签数量 / 总书签数量） */
  overConcentratedThreshold: number;
  /** 低使用率阈值（天数） */
  lowUsageDays: number;
}

/**
 * Gardener 错误
 */
export class GardenerError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GardenerError";
  }
}
