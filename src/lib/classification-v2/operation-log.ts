/**
 * 分类操作日志 + 撤销能力
 *
 * 记录每次分类操作到 classification_logs 表，
 * 提供撤销功能（恢复到分类前的 folder_id）。
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { ClassifyResult, CandidateFolder } from "./types";

/** 操作日志记录 */
export interface OperationLogEntry {
  userId: string;
  bookmarkId: string;
  /** 分类前的文件夹 ID（用于撤销） */
  previousFolderId: number | null;
  /** 分类结果 */
  result: ClassifyResult;
}

/** 撤销结果 */
export interface UndoResult {
  success: boolean;
  restoredFolderId: number | null;
  error?: string;
}

/**
 * 记录分类操作日志
 */
export async function logOperation(entry: OperationLogEntry): Promise<void> {
  try {
    const supabase = await createClient();

    const topCandidates: Array<{ folderId: number; score: number }> =
      entry.result.candidates.slice(0, 3).map((c: CandidateFolder) => ({
        folderId: c.folderId,
        score: c.mergedScore,
      }));

    // classification_logs 表不在 Supabase 生成类型中，使用 any 绕过
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("classification_logs").insert({
      user_id: entry.userId,
      bookmark_id: entry.bookmarkId,
      suggested_folder_id: entry.result.folderId,
      suggested_confidence: entry.result.confidence,
      classification_source: "v2_cascade",
      top_candidates: topCandidates,
      execution_time_ms: entry.result.timing.totalMs,
      context: {
        traceId: entry.result.traceId,
        action: entry.result.action,
        reason: entry.result.reason,
        earlyExitTier: entry.result.timing.earlyExitTier,
        previousFolderId: entry.previousFolderId,
        scorerDetails: entry.result.scorerDetails,
      },
    });
  } catch (err) {
    // 日志记录失败不应阻塞主流程
    logger.error(
      { err, bookmarkId: entry.bookmarkId },
      "OperationLog: write failed",
    );
  }
}

/**
 * 撤销最近一次分类操作
 *
 * 将书签恢复到分类前的 folder_id。
 */
export async function undoClassification(
  userId: string,
  bookmarkId: string,
): Promise<UndoResult> {
  try {
    const supabase = await createClient();

    // 1. 查找最近的操作日志
    type LogRow = {
      id: string;
      context: { previousFolderId: number | null } | null;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawData, error: fetchError } = await (supabase as any)
      .from("classification_logs")
      .select("id, context")
      .eq("user_id", userId)
      .eq("bookmark_id", bookmarkId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !rawData) {
      return {
        success: false,
        restoredFolderId: null,
        error: "未找到分类记录",
      };
    }

    const log = rawData as unknown as LogRow;
    const previousFolderId = log.context?.previousFolderId ?? null;

    // 2. 恢复 bookmark 的 folder_id
    const { error: updateError } = await supabase
      .from("bookmarks")
      .update({ folder_id: previousFolderId })
      .eq("id", Number(bookmarkId))
      .eq("user_id", userId);

    if (updateError) {
      return {
        success: false,
        restoredFolderId: null,
        error: `恢复失败: ${updateError.message}`,
      };
    }

    logger.info(
      { userId, bookmarkId, restoredFolderId: previousFolderId },
      "OperationLog: undo successful",
    );

    return { success: true, restoredFolderId: previousFolderId };
  } catch (err) {
    logger.error({ err, userId, bookmarkId }, "OperationLog: undo failed");
    return {
      success: false,
      restoredFolderId: null,
      error: err instanceof Error ? err.message : "未知错误",
    };
  }
}
