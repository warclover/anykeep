/**
 * Saga-enabled 执行步骤
 *
 * 职责：
 * - 包装现有执行函数，添加 Saga Pattern 支持
 * - 提供快照和撤销功能
 * - 支持回滚和补偿
 *
 * @module ai-skills/skills/batch-organize/steps/saga-execute
 * @version 1.0.0
 * @since 2025-12-25
 */

import { logger } from "@/lib/logger";
import {
  createSagaOrchestrator,
  type SagaContext,
  type SagaResult,
  type ProgressCallback,
} from "../../../organize";
import type {
  CategorizeSuggestion,
  TagSuggestion,
  DuplicateGroup,
  ArchiveCandidate,
} from "../types";
import type { ExecutionResult } from "./types";
import {
  executeCategorizeSuggestions,
  executeTagSuggestions,
  executeDuplicateCleanup,
  executeArchive,
} from "./execute.step";

// ============================================
// 类型定义
// ============================================

/**
 * Saga 执行参数
 */
export interface SagaExecutionParams {
  userId: string;
  categorizeSuggestions: CategorizeSuggestion[];
  tagSuggestions: TagSuggestion[];
  duplicateGroups: DuplicateGroup[];
  archiveCandidates: ArchiveCandidate[];
}

/**
 * Saga 执行结果
 */
export interface SagaExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 总成功数 */
  totalSuccess: number;
  /** 总失败数 */
  totalFailed: number;
  /** 快照 ID 列表（用于撤销） */
  snapshotIds: string[];
  /** 各步骤结果 */
  stepResults: {
    categorize?: ExecutionResult;
    tag?: ExecutionResult;
    dedupe?: ExecutionResult;
    archive?: ExecutionResult;
  };
  /** 错误信息 */
  error?: string;
}

// ============================================
// Saga 执行函数
// ============================================

/**
 * 使用 Saga Pattern 执行整理操作
 *
 * 特点：
 * - 每个步骤前创建快照
 * - 失败时自动回滚
 * - 返回快照 ID 列表，支持后续撤销
 *
 * @example
 * ```typescript
 * const result = await executeBatchOrganizeWithSaga({
 *   userId: 'user-123',
 *   categorizeSuggestions: [...],
 *   tagSuggestions: [...],
 *   duplicateGroups: [],
 *   archiveCandidates: [],
 * });
 *
 * // 撤销
 * if (result.snapshotIds.length > 0) {
 *   await undoBatchOrganize(result.snapshotIds, 'user-123');
 * }
 * ```
 */
export async function executeBatchOrganizeWithSaga(
  params: SagaExecutionParams,
  onProgress?: ProgressCallback,
): Promise<SagaExecutionResult> {
  const {
    userId,
    categorizeSuggestions,
    tagSuggestions,
    duplicateGroups,
    archiveCandidates,
  } = params;

  // 收集所有受影响的书签 ID
  const bookmarkIds = collectAffectedBookmarkIds(params);

  if (bookmarkIds.length === 0) {
    return {
      success: true,
      totalSuccess: 0,
      totalFailed: 0,
      snapshotIds: [],
      stepResults: {},
    };
  }

  // 创建 Saga 编排器
  const saga = createSagaOrchestrator();

  if (onProgress) {
    saga.setProgressCallback(onProgress);
  }

  // 添加分类步骤
  if (categorizeSuggestions.length > 0) {
    saga.addStep({
      name: "categorize",
      snapshotAction: "batch_categorize",
      execute: async (ctx: SagaContext) => {
        const result = await executeCategorizeSuggestions(
          ctx.userId,
          categorizeSuggestions,
        );
        return result;
      },
      skippable: true, // 分类失败不阻塞其他操作
    });
  }

  // 添加打标签步骤
  if (tagSuggestions.length > 0) {
    saga.addStep({
      name: "tag",
      snapshotAction: "batch_tag",
      execute: async (ctx: SagaContext) => {
        const result = await executeTagSuggestions(ctx.userId, tagSuggestions);
        return result;
      },
      skippable: true,
    });
  }

  // 添加去重步骤
  if (duplicateGroups.length > 0) {
    saga.addStep({
      name: "dedupe",
      snapshotAction: "batch_dedupe",
      execute: async (ctx: SagaContext) => {
        const result = await executeDuplicateCleanup(
          ctx.userId,
          duplicateGroups,
        );
        return result;
      },
      skippable: true,
    });
  }

  // 添加归档步骤
  if (archiveCandidates.length > 0) {
    saga.addStep({
      name: "archive",
      snapshotAction: "batch_archive",
      execute: async (ctx: SagaContext) => {
        const result = await executeArchive(ctx.userId, archiveCandidates);
        return result;
      },
      skippable: true,
    });
  }

  // 执行 Saga
  const sagaResult = await saga.execute(userId, bookmarkIds);

  // 转换结果
  return convertSagaResult(sagaResult);
}

/**
 * 撤销批量整理操作
 */
export async function undoBatchOrganize(
  snapshotIds: string[],
  userId: string,
): Promise<{ success: boolean; restoredCount: number; errors: string[] }> {
  const saga = createSagaOrchestrator();
  const results = await saga.undoAll(snapshotIds, userId);

  const errors: string[] = [];
  let restoredCount = 0;

  for (const result of results) {
    if (result.success) {
      restoredCount += result.restoredCount;
    } else if (result.error) {
      errors.push(result.error);
    }
  }

  logger.info(
    { restoredCount, errorCount: errors.length },
    "BatchOrganize: Undo completed",
  );

  return {
    success: errors.length === 0,
    restoredCount,
    errors,
  };
}

// ============================================
// 辅助函数
// ============================================

/**
 * 收集所有受影响的书签 ID
 */
function collectAffectedBookmarkIds(params: SagaExecutionParams): number[] {
  const ids = new Set<number>();

  // 分类建议
  for (const s of params.categorizeSuggestions) {
    ids.add(s.bookmarkId);
  }

  // 标签建议
  for (const s of params.tagSuggestions) {
    ids.add(s.bookmarkId);
  }

  // 重复组
  for (const g of params.duplicateGroups) {
    for (const b of g.bookmarks) {
      ids.add(b.id);
    }
  }

  // 归档候选
  for (const c of params.archiveCandidates) {
    ids.add(c.bookmarkId);
  }

  return Array.from(ids);
}

/**
 * 转换 Saga 结果为执行结果
 */
function convertSagaResult(sagaResult: SagaResult): SagaExecutionResult {
  const stepResults: SagaExecutionResult["stepResults"] = {};
  let totalSuccess = 0;
  let totalFailed = 0;

  // 提取各步骤结果
  if (sagaResult.results.categorize) {
    const r = sagaResult.results.categorize as ExecutionResult;
    stepResults.categorize = r;
    totalSuccess += r.success;
    totalFailed += r.failed;
  }

  if (sagaResult.results.tag) {
    const r = sagaResult.results.tag as ExecutionResult;
    stepResults.tag = r;
    totalSuccess += r.success;
    totalFailed += r.failed;
  }

  if (sagaResult.results.dedupe) {
    const r = sagaResult.results.dedupe as ExecutionResult;
    stepResults.dedupe = r;
    totalSuccess += r.success;
    totalFailed += r.failed;
  }

  if (sagaResult.results.archive) {
    const r = sagaResult.results.archive as ExecutionResult;
    stepResults.archive = r;
    totalSuccess += r.success;
    totalFailed += r.failed;
  }

  return {
    success: sagaResult.success,
    totalSuccess,
    totalFailed,
    snapshotIds: sagaResult.snapshotIds,
    stepResults,
    error: sagaResult.error,
  };
}
