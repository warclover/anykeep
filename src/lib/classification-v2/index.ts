/**
 * Classification V2 - 公开 API
 *
 * 整个分类系统的唯一出口。
 * 3 个函数 + 类型导出。
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

// ============================================================================
// 核心 API
// ============================================================================

export { classify } from "./classify";

// Phase 2 将添加：
// export { batchClassify } from './batch/batch-classify';
// export { organizeInbox } from './batch/inbox-organize';

// ============================================================================
// 类型导出
// ============================================================================

export type {
  // 请求/响应
  ClassifyRequest,
  ClassifyResult,
  ClassifyAction,
  ClassifyFeedback,
  // 候选
  CandidateFolder,
  ScorerDetail,
  ClassifyTiming,
  // Scorer
  Scorer,
  Score,
  Signal,
  SignalType,
  ScorerTier,
  // Context
  BookmarkContext,
  FolderContext,
  UserContext,
  UserRule,
  UserStage,
  // Ranker
  MergedScore,
  CascadeConfig,
  // Batch
  BatchClassifyRequest,
  BatchClassifyResult,
} from "./types";

// ============================================================================
// 配置导出（供外部模块读取阈值）
// ============================================================================

export { CLASSIFICATION_CONFIG } from "./config";
export { CLASSIFICATION_STATUS } from "./config";
export type { ClassificationStatus } from "./config";
