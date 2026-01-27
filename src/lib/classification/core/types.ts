/**
 * Classification Core Types
 * 统一类型定义
 *
 * @version 1.1.0
 * @since 2026-01-24 Phase 2
 * @updated 2026-01-24 Phase 4.5: 添加容器配置
 */

import type { EnhancedContainer } from "../infrastructure/container";

/**
 * 分类请求
 */
export interface ClassificationRequest {
  userId: string;
  bookmarkId: string;
  title: string;
  url?: string;
  summary?: string;
  description?: string;
  tags?: string[];
}

/**
 * 分类结果
 */
export interface ClassificationResult {
  folderId: string | null;
  folderName: string | null;
  confidence: number;
  action: ClassificationAction;
  reason?: string;
  scores?: ClassificationScores;
  suggestionId?: number;
  usedT1?: boolean;
  totalLatencyMs?: number;
  t0LatencyMs?: number;
  t1LatencyMs?: number;
}

/**
 * 分类动作
 */
export type ClassificationAction =
  | "classify"
  | "suggest"
  | "suggest_new"
  | "suggest_create"
  | "auto_create"
  | "inbox";

/**
 * 分类得分
 */
export interface ClassificationScores {
  vectorScore: number;
  historyScore: number;
  aiScore: number;
}

/**
 * 书签输入（内部使用）
 */
export interface BookmarkInput {
  id?: number;
  title: string;
  url?: string;
  summary?: string;
  tags?: string[];
}

/**
 * 策略类型
 */
export type StrategyType = "classic" | "modern";

/**
 * 分类版本
 */
export type ClassificationVersion = "v4.1" | "v5.0";

/**
 * 门面配置
 */
export interface ClassificationFacadeConfig {
  defaultStrategy?: StrategyType;
  featureFlags?: Partial<ClassificationFeatureFlags>;
  /** 增强容器实例（Phase 4.5） */
  container?: EnhancedContainer;
}

/**
 * Feature Flags 配置
 */
export interface ClassificationFeatureFlags {
  // 策略选择
  defaultStrategy: StrategyType;

  // 灰度发布
  rolloutStage: number;
  rolloutPercentage: number;
  userWhitelist: string[];
  userBlacklist: string[];

  // Modern 策略配置
  enableL0Rules: boolean;
  enableT1Correction: boolean;
  enableCrystalGrowth: boolean;

  // Classic 策略配置
  enableAISelection: boolean;
  enableAICreate: boolean;

  // 置信度阈值
  autoClassifyThreshold: number;
  suggestThreshold: number;
  t1TriggerThreshold: number;

  // 性能
  enablePipelineCache: boolean;
  pipelineCacheTtlMs: number;
}

/**
 * 旧版分类结果（向后兼容）
 */
export interface LegacyClassificationResult {
  classified: boolean;
  folderId: number | null;
  folderName: string | null;
  confidence: number;
  action: ClassificationAction;
  suggestionId?: number;
}
