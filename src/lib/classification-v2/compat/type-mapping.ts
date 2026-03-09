/**
 * 新旧类型双向转换
 *
 * 将 classification-v2 的类型映射到旧 classification 系统的类型，
 * 确保 40+ 个 API 路由、5 个 Skills、5 个 Hooks 零修改。
 *
 * 旧系统核心类型来源：src/lib/classification/core/types.ts
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import type {
  ClassifyRequest,
  ClassifyResult,
  ClassifyAction,
  ScorerDetail,
} from "../types";

// ============================================================================
// 旧系统类型定义（在此重新声明，避免 import 旧模块产生耦合）
// ============================================================================

/**
 * 旧系统分类动作
 *
 * 比新系统多两个值：suggest_new、auto_create
 */
export type LegacyClassificationAction =
  | "classify"
  | "suggest"
  | "suggest_new"
  | "suggest_create"
  | "auto_create"
  | "inbox";

/**
 * 旧系统分类得分
 */
export interface LegacyClassificationScores {
  vectorScore: number;
  historyScore: number;
  aiScore: number;
}

/**
 * 旧系统分类请求
 */
export interface LegacyClassificationRequest {
  userId: string;
  bookmarkId: string;
  title: string;
  url?: string;
  summary?: string;
  description?: string;
  tags?: string[];
}

/**
 * 旧系统分类结果（ClassificationResult in core/types.ts）
 */
export interface LegacyClassificationResult {
  folderId: number | null;
  folderName: string | null;
  confidence: number;
  action: LegacyClassificationAction;
  reason?: string;
  scores?: LegacyClassificationScores;
  suggestionId?: number;
  usedT1?: boolean;
  totalLatencyMs?: number;
  t0LatencyMs?: number;
  t1LatencyMs?: number;
}

/**
 * 旧系统 classifyBookmarkV2 返回类型
 */
export interface LegacyIntegrationResult {
  classified: boolean;
  folderId: number | null;
  folderName: string | null;
  confidence: number;
  action: LegacyClassificationAction;
  suggestionId?: number;
}

// ============================================================================
// 旧请求 → 新请求
// ============================================================================

/**
 * 将旧系统 ClassificationRequest 转换为新系统 ClassifyRequest
 *
 * 差异：
 * - 旧系统多一个 description 字段，新系统不需要
 * - 其余字段一一对应
 */
export function mapLegacyRequest(
  legacy: LegacyClassificationRequest,
): ClassifyRequest {
  return {
    bookmarkId: legacy.bookmarkId,
    title: legacy.title,
    url: legacy.url,
    summary: legacy.summary ?? legacy.description,
    tags: legacy.tags,
    userId: legacy.userId,
  };
}

// ============================================================================
// 新结果 → 旧结果
// ============================================================================

/**
 * 将新系统 ClassifyResult 转换为旧系统 ClassificationResult
 *
 * 映射规则：
 * - action: 新系统仅有 4 种，旧系统 suggest_new/auto_create 不会出现
 * - scores: 从 scorerDetails 提取 vector/history/llm 分数
 * - usedT1: 未提前终止 = 执行了 slow tier
 * - t0LatencyMs: instant + fast tier 耗时
 * - t1LatencyMs: slow tier 耗时
 */
export function mapToLegacyResult(
  result: ClassifyResult,
): LegacyClassificationResult {
  return {
    folderId: result.folderId,
    folderName: result.folderName,
    confidence: result.confidence,
    action: result.action as LegacyClassificationAction,
    reason: result.reason,
    scores: extractLegacyScores(result.scorerDetails),
    usedT1: result.timing.earlyExitTier === undefined,
    totalLatencyMs: result.timing.totalMs,
    t0LatencyMs:
      (result.timing.tierMs.instant ?? 0) + (result.timing.tierMs.fast ?? 0),
    t1LatencyMs: result.timing.tierMs.slow ?? 0,
  };
}

/**
 * 将新系统 ClassifyResult 转换为旧系统 classifyBookmarkV2 返回格式
 */
export function mapToIntegrationResult(
  result: ClassifyResult,
): LegacyIntegrationResult {
  return {
    classified: result.action === "classify",
    folderId: result.folderId,
    folderName: result.folderName,
    confidence: result.confidence,
    action: result.action as LegacyClassificationAction,
  };
}

/**
 * 从 ScorerDetail[] 提取旧系统的三维分数
 */
function extractLegacyScores(
  details: ScorerDetail[],
): LegacyClassificationScores {
  const findScore = (name: string): number =>
    details.find((d) => d.scorer === name)?.topScore ?? 0;

  return {
    vectorScore: findScore("vector"),
    historyScore: findScore("history"),
    aiScore: findScore("llm"),
  };
}

// ============================================================================
// 旧系统类型别名导出（兼容 import）
// ============================================================================

/**
 * 导出旧系统类型别名，使 `import type { ClassificationResult } from '...'` 继续工作
 */
export type {
  LegacyClassificationResult as ClassificationResult,
  LegacyClassificationRequest as ClassificationRequest,
  LegacyClassificationAction as ClassificationAction,
  LegacyClassificationScores as ClassificationScores,
  LegacyIntegrationResult as LegacyClassificationIntegrationResult,
};

/**
 * 新系统 ClassifyAction → 旧系统 ClassificationAction 的安全映射
 *
 * 新系统的 4 种 action 都是旧系统 action 的子集，
 * 因此直接类型断言即可。
 */
export function mapActionToLegacy(
  action: ClassifyAction,
): LegacyClassificationAction {
  return action as LegacyClassificationAction;
}
