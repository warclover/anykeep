/**
 * Classification-related type definitions
 */

// ============================================================================
// V4.0 全链路追踪类型
// ============================================================================

/**
 * TraceID 生成器 - 用于唯一标识每次分类请求
 */
export function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `clf_${timestamp}_${random}`;
}

/**
 * 匹配器得分详情
 */
export interface MatcherScoreDetail {
  /** 匹配器名称 */
  matcherName: string;
  /** 是否可用 */
  available: boolean;
  /** 执行耗时 (ms) */
  durationMs: number;
  /** 最高分候选 */
  topCandidate: {
    folderId: number | null;
    folderName: string;
    score: number;
  } | null;
  /** 所有候选项 (Top 5) */
  candidates: Array<{
    folderId: number;
    folderName: string;
    score: number;
    reason?: string;
  }>;
  /** 错误信息 (如果失败) */
  error?: string;
}

/**
 * 决策路径 - 记录完整的分类决策过程
 */
export interface DecisionPath {
  /** 唯一追踪 ID */
  traceId: string;
  /** 时间戳 */
  timestamp: string;
  /** 用户 ID */
  userId: string;
  /** 书签信息 */
  bookmark: {
    id?: number;
    title: string;
    url?: string;
    tags: string[];
  };
  /** 最终决策层级 */
  finalTier: 0 | 1 | 2 | 3;
  /** 是否调用了 AI */
  aiCalled: boolean;
  /** 各层匹配器得分详情 */
  matcherScores: MatcherScoreDetail[];
  /** 各层耗时 */
  tierTimings: {
    tier1Ms?: number;
    tier2Ms?: number;
    tier3Ms?: number;
    totalMs: number;
  };
  /** 最终结果 */
  finalResult: {
    folderId: number | null;
    folderName: string;
    confidence: number;
    action: ClassificationAction;
    reason: string;
  };
  /** 决策理由 (用户可读) */
  decisionReason: DecisionReason;
}

/**
 * 决策理由 - 用户可读的分类解释
 */
export interface DecisionReason {
  /** 主要原因 */
  primary: string;
  /** 次要原因 (可选) */
  secondary?: string;
  /** 置信度说明 */
  confidenceExplanation: string;
}

// ============================================================================
// 原有类型定义
// ============================================================================

/**
 * User classification stage
 */
export type ClassificationStage =
  | "onboarding"
  | "cold_start"
  | "growing"
  | "mature";

/**
 * Classification action
 */
export type ClassificationAction =
  | "classify"
  | "inbox"
  | "suggest"
  | "suggest_new"
  | "suggest_create"
  | "auto_create";

/**
 * Match result from a single matcher
 */
export interface MatchResult {
  folderId: number;
  folderName: string;
  score: number; // 0-100 score
  confidence: number; // confidence level
  reason: string; // match reason
  metadata?: Record<string, unknown>; // extra metadata
}

/**
 * Matcher context - input for matchers
 */
export interface MatcherContext {
  userId: string;
  /** 当前书签 ID，用于排除自匹配 */
  bookmarkId?: number;
  title: string;
  summary: string;
  tags: string[];
  embedding: number[];
}

/**
 * Classification result
 */
export interface ClassificationResult {
  folderId: number | null;
  folderName: string;
  confidence: number;
  reason: string;
  action: ClassificationAction;
  scores: {
    vectorScore: number;
    historyScore: number;
    aiScore: number;
  };
  matchDetails?: MatchResult[]; // detailed match info (for debugging)

  // V4.0 全链路追踪字段
  /** 追踪 ID (V4.0) */
  traceId?: string;
  /** 决策路径 (V4.0, 仅在 debug 模式下返回) */
  decisionPath?: DecisionPath;
  /** 用户可读的决策理由 (V4.0) */
  decisionReason?: DecisionReason;
}

/**
 * Bookmark input for classification
 */
export interface BookmarkInput {
  /** 书签 ID（可选，用于排除自匹配） */
  id?: number;
  title: string;
  summary?: string;
  tags?: string[];
  embedding?: number[];
  url?: string;
}

/**
 * Folder profile from database
 */
export interface FolderProfile {
  id: number;
  userId: string;
  folderId: number;
  folderName?: string;
  profileEmbedding: number[] | null;
  bookmarkCount: number;
  lastBookmarkAt: Date | null;
  topTags: string[];
  sampleTitles: string[];
  internalSimilarity: number | null;
  source: string | null;
  computedAt: Date;
  updatedAt: Date;
}

/**
 * Similar folder search result
 */
export interface SimilarFolder {
  folderId: number;
  folderName: string;
  bookmarkCount: number;
  topTags: string[];
  sampleTitles: string[];
  similarity: number;
}

/**
 * Similar bookmark with folder info
 */
export interface SimilarBookmarkWithFolder {
  bookmarkId: number;
  bookmarkTitle: string;
  folderId: number | null;
  folderName: string | null;
  similarity: number;
}

/**
 * Folder statistics
 */
export interface FolderStats {
  totalFolders: number;
  foldersToday: number;
  canCreateMore: boolean;
  dailyRemaining: number;
}

/**
 * Vector match detail
 */
export interface VectorMatchDetail extends MatchResult {
  topTags: string[];
  sampleTitles: string[];
  bookmarkCount: number;
}

/**
 * History match detail
 */
export interface HistoryMatchDetail extends MatchResult {
  similarBookmarkCount: number;
  similarTitles: string[];
}

/**
 * AI recommendation context
 */
export interface AIRecommendationContext {
  title: string;
  summary: string;
  tags: string[];
  vectorMatches: VectorMatchDetail[];
  historyMatches: HistoryMatchDetail[];
  allFolders: Array<{ id: number; name: string }>;
}

/**
 * AI recommendation result
 */
export interface AIRecommendation {
  folderId: number | null;
  folderName: string;
  confidence: number;
  reason: string;
  suggestNew?: boolean;
}
