/**
 * Classification Result Type Mapper
 * 统一 classification_result JSON 字段的类型适配
 *
 * 解决问题：
 * - 数据库存储使用 snake_case (folder_id, folder_name)
 * - 业务逻辑使用 camelCase (folderId, folderName)
 * - 历史数据可能使用任意一种格式
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import type { ClassificationResultData } from "@/types/supabase";

/**
 * 规范化的分类结果（业务层使用 camelCase）
 */
export interface NormalizedClassificationResult {
  folderId: number | null;
  folderName: string | null;
  confidence: number;
  reason: string | null;
  tier?: number;
  action?: string;
  matcherScores?: Record<string, number>;
  aiCalled?: boolean;
  timestamp?: string;
  suggestionId?: number;
}

/**
 * 数据库存储格式（snake_case）
 */
export interface DatabaseClassificationResult {
  folder_id: number | null;
  folder_name: string | null;
  confidence: number;
  reason: string | null;
  tier?: number;
  action?: string;
  matcher_scores?: Record<string, number>;
  ai_called?: boolean;
  timestamp?: string;
  suggestion_id?: number;
}

/**
 * 从数据库 JSON 转换为业务层格式
 *
 * 支持两种输入格式：
 * - snake_case (folder_id, folder_name)
 * - camelCase (folderId, folderName)
 *
 * @param raw - 数据库中的 JSON 数据
 * @returns 规范化的业务层对象
 */
export function normalizeClassificationResult(
  raw: ClassificationResultData | unknown,
): NormalizedClassificationResult {
  if (!raw || typeof raw !== "object") {
    return {
      folderId: null,
      folderName: null,
      confidence: 0,
      reason: null,
    };
  }

  const obj = raw as Record<string, unknown>;

  return {
    // 优先使用 camelCase，降级到 snake_case
    folderId: (obj.folderId ?? obj.folder_id ?? null) as number | null,
    folderName: (obj.folderName ?? obj.folder_name ?? null) as string | null,
    confidence: (obj.confidence ?? 0) as number,
    reason: (obj.reason ?? null) as string | null,
    tier: obj.tier as number | undefined,
    action: obj.action as string | undefined,
    matcherScores: (obj.matcherScores ?? obj.matcher_scores) as
      | Record<string, number>
      | undefined,
    aiCalled: (obj.aiCalled ?? obj.ai_called) as boolean | undefined,
    timestamp: obj.timestamp as string | undefined,
    suggestionId: (obj.suggestionId ?? obj.suggestion_id) as number | undefined,
  };
}

/**
 * 从业务层格式转换为数据库存储格式
 *
 * 统一输出 camelCase（与现有代码兼容）
 * 但保留 snake_case 字段以支持旧版查询
 *
 * @param result - 业务层的分类结果
 * @returns 数据库存储格式
 */
export function toStorageFormat(
  result: NormalizedClassificationResult,
): ClassificationResultData {
  return {
    // camelCase (主要格式)
    folderId: result.folderId,
    folderName: result.folderName,
    confidence: result.confidence,
    reason: result.reason ?? undefined, // 转换 null 为 undefined
    tier: result.tier,
    action: result.action,
    // 保留 snake_case 以兼容旧查询
    folder_id: result.folderId,
    folder_name: result.folderName,
    matcher_scores: result.matcherScores,
    ai_called: result.aiCalled,
    timestamp: result.timestamp ?? new Date().toISOString(),
  };
}

/**
 * 类型守卫：检查对象是否为有效的分类结果
 */
export function isValidClassificationResult(
  obj: unknown,
): obj is ClassificationResultData {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const data = obj as Record<string, unknown>;

  // 至少需要 confidence 字段
  if (typeof data.confidence !== "number") {
    return false;
  }

  // folderId 或 folder_id 应该是 number 或 null
  const folderId = data.folderId ?? data.folder_id;
  if (folderId !== null && typeof folderId !== "number") {
    return false;
  }

  return true;
}

/**
 * 安全地从书签记录中提取分类结果
 *
 * @param bookmark - 书签记录（可能包含 classification_result JSON 字段）
 * @returns 规范化的分类结果，如果无效则返回 null
 */
export function extractClassificationResult(
  bookmark: { classification_result?: unknown } | null | undefined,
): NormalizedClassificationResult | null {
  if (!bookmark?.classification_result) {
    return null;
  }

  if (!isValidClassificationResult(bookmark.classification_result)) {
    return null;
  }

  return normalizeClassificationResult(bookmark.classification_result);
}
