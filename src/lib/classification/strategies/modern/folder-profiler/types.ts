/**
 * 智能分类 v5.0 - FolderProfiler 类型定义
 */

import type { FolderId } from "@/lib/shared/types";

/**
 * 文件夹画像
 */
export interface FolderProfile {
  /** 画像 ID */
  id: number;
  /** 用户 ID */
  userId: string;
  /** 文件夹 ID */
  folderId: number;
  /** 内容向量 (1024 维) */
  contentEmbedding: number[];
  /** 行为向量 (1024 维) */
  behaviorEmbedding: number[];
  /** 动态 α 系数 (0.2-0.8) */
  alphaCoefficient: number;
  /** 最后更新时间 */
  lastUpdatedAt: Date;
  /** 书签数量 */
  bookmarkCount: number;
  /** 是否需要更新 */
  needsUpdate: boolean;
  /** 平均分类分数 */
  avgClassificationScore?: number | null;
  /** 总分类次数 */
  totalClassifications: number;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 文件夹统计信息（用于计算 α 系数）
 */
export interface FolderStats {
  /** 文件夹 ID */
  folderId: FolderId;
  /** 最后使用时间 */
  lastUsed: Date;
  /** 行为数据数量 */
  behaviorCount: number;
  /** 内容数据数量 */
  contentCount: number;
  /** 内容多样性分数 (0-1) */
  contentDiversity: number;
  /** 最近活跃度 (0-1) */
  recentActivity: number;
}

/**
 * 双源向量构建结果
 */
export interface DualSourceVectors {
  /** 内容向量 */
  contentEmbedding: number[];
  /** 行为向量 */
  behaviorEmbedding: number[];
  /** 内容数据来源数量 */
  contentSourceCount: number;
  /** 行为数据来源数量 */
  behaviorSourceCount: number;
}

/**
 * 懒更新触发条件
 */
export interface LazyUpdateTrigger {
  /** 是否需要更新 */
  shouldUpdate: boolean;
  /** 触发原因 */
  reason:
    | "time_threshold"
    | "bookmark_threshold"
    | "accuracy_drop"
    | "manual_trigger"
    | "none";
  /** 详细信息 */
  details?: {
    daysSinceUpdate?: number;
    newBookmarksCount?: number;
    currentAccuracy?: number;
  };
}

/**
 * FolderProfiler 配置
 */
export interface FolderProfilerConfig {
  /** 时间阈值（天） */
  timeThresholdDays: number;
  /** 新增书签阈值 */
  newBookmarksThreshold: number;
  /** 准确率阈值 */
  accuracyThreshold: number;
  /** α 系数范围 */
  alphaRange: {
    min: number;
    max: number;
  };
}

/**
 * FolderProfiler 错误
 */
export class FolderProfilerError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "FolderProfilerError";
  }
}
