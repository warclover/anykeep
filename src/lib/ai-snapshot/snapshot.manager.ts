/**
 * SnapshotManager - AI 操作快照管理器
 *
 * 职责：
 * - 创建 AI 操作前的快照
 * - 支持 24 小时内撤销操作
 * - 管理快照生命周期
 *
 * @module ai-snapshot
 * @version 1.0.0
 * @since 2025-12-26
 */

import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/supabase";
import type {
  Snapshot,
  CreateSnapshotParams,
  BookmarkState,
  OperationRecord,
  UndoableOperation,
  UndoResult,
  SnapshotServiceResult,
  OperationType,
} from "./types";

/**
 * AI 操作快照管理器
 *
 * 注意：快照 TTL 由数据库 expires_at 列控制（默认 24 小时），
 * 详见 ai_operation_snapshots 表定义
 */
export class SnapshotManager {
  /**
   * 创建快照（执行操作前调用）
   */
  async createSnapshot(
    params: CreateSnapshotParams,
  ): Promise<SnapshotServiceResult<{ id: string }>> {
    try {
      const supabase = createClient();

      logger.info(
        {
          userId: params.userId,
          operationType: params.operationType,
          bookmarkCount: params.bookmarkIds.length,
        },
        "SnapshotManager: Creating snapshot",
      );

      // 获取受影响书签的当前状态
      const { data: bookmarks, error: fetchError } = await supabase
        .from("bookmarks")
        .select("id, folder_id, ai_tags")
        .in("id", params.bookmarkIds)
        .eq("user_id", params.userId);

      if (fetchError) {
        logger.error(
          { error: fetchError },
          "SnapshotManager: Failed to fetch bookmark states",
        );
        return { success: false, error: fetchError.message };
      }

      const beforeState: BookmarkState[] = (bookmarks || []).map((b) => ({
        id: b.id,
        folderId: b.folder_id,
        tags: b.ai_tags || [],
      }));

      // 创建快照
      const { data, error } = await supabase
        .from("ai_operation_snapshots")
        .insert({
          user_id: params.userId,
          operation_type: params.operationType,
          conversation_id: params.conversationId,
          skill_id: params.skillId,
          bookmark_ids: params.bookmarkIds,
          before_state: beforeState as unknown as Json,
          after_state: [] as Json,
          operations: [] as Json,
          summary: params.summary,
        })
        .select("id")
        .single();

      if (error) {
        logger.error({ error }, "SnapshotManager: Failed to create snapshot");
        return { success: false, error: error.message };
      }

      logger.info(
        { snapshotId: data?.id },
        "SnapshotManager: Snapshot created successfully",
      );

      return { success: true, data: { id: data?.id || "" } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "SnapshotManager: Exception creating snapshot",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 更新快照（操作完成后调用）
   */
  async updateSnapshot(
    snapshotId: string,
    userId: string,
    afterState: BookmarkState[],
    operations: OperationRecord[],
  ): Promise<SnapshotServiceResult> {
    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("ai_operation_snapshots")
        .update({
          after_state: afterState as unknown as Json,
          operations: operations as unknown as Json,
        })
        .eq("id", snapshotId)
        .eq("user_id", userId);

      if (error) {
        logger.error({ error }, "SnapshotManager: Failed to update snapshot");
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "SnapshotManager: Exception updating snapshot",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 获取可撤销操作列表
   */
  async getUndoableOperations(
    userId: string,
    limit: number = 10,
  ): Promise<SnapshotServiceResult<UndoableOperation[]>> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase.rpc("get_undoable_ai_operations", {
        p_user_id: userId,
        p_limit: limit,
      });

      if (error) {
        logger.error(
          { error },
          "SnapshotManager: Failed to get undoable operations",
        );
        return { success: false, error: error.message };
      }

      const operations: UndoableOperation[] = (data || []).map(
        (row: Record<string, unknown>) => ({
          id: row.id as string,
          operationType:
            row.operation_type as UndoableOperation["operationType"],
          bookmarkCount: row.bookmark_count as number,
          summary: row.summary as string | undefined,
          createdAt: new Date(row.created_at as string),
          expiresAt: new Date(row.expires_at as string),
          timeRemaining: row.time_remaining as string,
        }),
      );

      return { success: true, data: operations };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "SnapshotManager: Exception getting undoable operations",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 撤销操作
   */
  async undo(
    snapshotId: string,
    userId: string,
  ): Promise<SnapshotServiceResult<UndoResult>> {
    try {
      const supabase = createClient();

      logger.info({ snapshotId, userId }, "SnapshotManager: Undoing operation");

      const { data, error } = await supabase.rpc("undo_ai_operation", {
        p_snapshot_id: snapshotId,
        p_user_id: userId,
      });

      if (error) {
        logger.error({ error }, "SnapshotManager: Failed to undo operation");
        return { success: false, error: error.message };
      }

      const row = Array.isArray(data) ? data[0] : data;

      if (!row?.success) {
        return {
          success: false,
          error: row?.message || "撤销失败",
        };
      }

      logger.info(
        { snapshotId, restoredCount: row.restored_count },
        "SnapshotManager: Operation undone successfully",
      );

      return {
        success: true,
        data: {
          success: true,
          restoredCount: row.restored_count,
          message: row.message,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "SnapshotManager: Exception undoing operation",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 获取快照详情
   */
  async getSnapshot(
    snapshotId: string,
    userId: string,
  ): Promise<SnapshotServiceResult<Snapshot>> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("ai_operation_snapshots")
        .select("*")
        .eq("id", snapshotId)
        .eq("user_id", userId)
        .single();

      if (error) {
        logger.error({ error }, "SnapshotManager: Failed to get snapshot");
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: "快照不存在" };
      }

      const snapshot: Snapshot = {
        id: data.id,
        userId: data.user_id,
        operationType: data.operation_type as OperationType,
        conversationId: data.conversation_id ?? undefined,
        skillId: data.skill_id ?? undefined,
        bookmarkIds: data.bookmark_ids,
        beforeState: (data.before_state || []) as unknown as BookmarkState[],
        afterState: (data.after_state || []) as unknown as BookmarkState[],
        operations: (data.operations || []) as unknown as OperationRecord[],
        summary: data.summary ?? undefined,
        isReverted: data.is_reverted,
        revertedAt: data.reverted_at ? new Date(data.reverted_at) : undefined,
        createdAt: new Date(data.created_at),
        expiresAt: new Date(data.expires_at),
      };

      return { success: true, data: snapshot };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "SnapshotManager: Exception getting snapshot",
      );
      return { success: false, error: message };
    }
  }
}

// =============================================================================
// 工厂函数和默认实例
// =============================================================================

/**
 * 创建快照管理器实例
 */
export function createSnapshotManager(): SnapshotManager {
  return new SnapshotManager();
}

/**
 * 默认快照管理器实例
 */
export const snapshotManager = createSnapshotManager();
