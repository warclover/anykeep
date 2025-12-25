/**
 * SnapshotManager - AI 操作快照管理器
 *
 * 职责：
 * - 在 AI 操作前创建书签状态快照
 * - 支持 24 小时内撤销操作
 * - 管理快照生命周期
 *
 * @version 1.0.0
 * @since 2025-12-25
 *
 * 注意：ai_operation_snapshots 表类型尚未生成，使用类型断言绕过检查
 * 运行 `npm run supabase:gen:types` 后可移除类型断言
 */

import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type {
  OrganizeAction,
  UndoableOperation,
  UndoResponse,
} from "@/components/ai/phase4/types";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 操作类型
 */
export type OperationType =
  | "organize"
  | "batch_tag"
  | "dedupe"
  | "move"
  | "archive"
  | "delete";

/**
 * 书签状态快照
 */
export interface BookmarkState {
  id: number;
  folder_id: number | null;
  ai_tags: string[];
}

/**
 * 创建快照请求
 */
export interface CreateSnapshotRequest {
  operationType: OperationType;
  bookmarkIds: number[];
  conversationId?: string;
  skillId?: string;
  operations?: OrganizeAction[];
  summary?: string;
}

/**
 * 快照记录
 */
export interface SnapshotRecord {
  id: string;
  userId: string;
  operationType: OperationType;
  conversationId?: string;
  skillId?: string;
  bookmarkIds: number[];
  beforeState: BookmarkState[];
  afterState: BookmarkState[];
  operations: OrganizeAction[];
  summary?: string;
  isReverted: boolean;
  revertedAt?: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * ai_operation_snapshots 表行类型（待生成后可删除）
 */
interface SnapshotRow {
  id: string;
  user_id: string;
  operation_type: string;
  conversation_id: string | null;
  skill_id: string | null;
  bookmark_ids: number[];
  before_state: BookmarkState[];
  after_state: BookmarkState[];
  operations: OrganizeAction[];
  summary: string | null;
  is_reverted: boolean;
  reverted_at: string | null;
  created_at: string;
  expires_at: string;
}

/**
 * RPC 返回的可撤销操作
 */
interface UndoableOperationRow {
  id: string;
  operation_type: string;
  bookmark_count: number;
  summary: string | null;
  created_at: string;
  expires_at: string;
  time_remaining: string;
}

/**
 * RPC 撤销结果
 */
interface UndoResultRow {
  success: boolean;
  restored_count: number;
  message: string;
}

/**
 * 服务响应
 */
export interface SnapshotServiceResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 获取 ai_operation_snapshots 表查询（绕过类型检查）
 *
 * 注意：运行 `npm run supabase:gen:types` 后可直接使用 supabase.from()
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSnapshotsTable(supabase: ReturnType<typeof createClient>): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from("ai_operation_snapshots");
}

/**
 * 调用 RPC 函数（绕过类型检查）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function callRpc(
  supabase: ReturnType<typeof createClient>,
  fn: string,
  params: Record<string, unknown>,
): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(fn, params);
}

// =============================================================================
// SnapshotManager 类
// =============================================================================

export class SnapshotManager {
  /**
   * 创建操作快照
   *
   * 在执行 AI 操作前调用，保存书签的当前状态
   */
  async createSnapshot(
    request: CreateSnapshotRequest,
  ): Promise<SnapshotServiceResponse<{ snapshotId: string }>> {
    try {
      const supabase = createClient();

      // 获取当前用户
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        logger.warn({ authError }, "SnapshotManager: User not authenticated");
        return { success: false, error: "用户未登录" };
      }

      if (request.bookmarkIds.length === 0) {
        return { success: false, error: "没有需要快照的书签" };
      }

      // 获取书签当前状态（使用 ai_tags 而非 tags）
      const { data: bookmarks, error: fetchError } = await supabase
        .from("bookmarks")
        .select("id, folder_id, ai_tags")
        .eq("user_id", user.id)
        .in("id", request.bookmarkIds);

      if (fetchError) {
        logger.error(
          { fetchError },
          "SnapshotManager: Failed to fetch bookmarks",
        );
        return { success: false, error: "获取书签状态失败" };
      }

      const beforeState: BookmarkState[] = (bookmarks || []).map((b) => ({
        id: b.id,
        folder_id: b.folder_id,
        ai_tags: b.ai_tags || [],
      }));

      // 创建快照记录
      const { data, error } = await getSnapshotsTable(supabase)
        .insert({
          user_id: user.id,
          operation_type: request.operationType,
          conversation_id: request.conversationId || null,
          skill_id: request.skillId || null,
          bookmark_ids: request.bookmarkIds,
          before_state: beforeState,
          after_state: [], // 操作完成后更新
          operations: request.operations || [],
          summary: request.summary || null,
        })
        .select("id")
        .single();

      if (error) {
        logger.error({ error }, "SnapshotManager: Failed to create snapshot");
        return { success: false, error: "创建快照失败" };
      }

      logger.info(
        {
          snapshotId: data?.id,
          operationType: request.operationType,
          bookmarkCount: request.bookmarkIds.length,
        },
        "SnapshotManager: Snapshot created",
      );

      return { success: true, data: { snapshotId: String(data?.id ?? "") } };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "SnapshotManager: Unexpected error",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 更新快照的操作后状态
   *
   * 在 AI 操作完成后调用，保存书签的新状态
   */
  async updateAfterState(snapshotId: string): Promise<SnapshotServiceResponse> {
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      // 获取快照记录
      const { data: snapshot, error: fetchError } = await getSnapshotsTable(
        supabase,
      )
        .select("bookmark_ids")
        .eq("id", snapshotId)
        .eq("user_id", user.id)
        .single();

      if (fetchError || !snapshot) {
        logger.error({ fetchError }, "SnapshotManager: Snapshot not found");
        return { success: false, error: "快照不存在" };
      }

      const bookmarkIds = (snapshot as { bookmark_ids: number[] }).bookmark_ids;

      // 获取书签当前状态（操作后，使用 ai_tags）
      const { data: bookmarks, error: bookmarkError } = await supabase
        .from("bookmarks")
        .select("id, folder_id, ai_tags")
        .eq("user_id", user.id)
        .in("id", bookmarkIds);

      if (bookmarkError) {
        logger.error(
          { bookmarkError },
          "SnapshotManager: Failed to fetch after state",
        );
        return { success: false, error: "获取书签状态失败" };
      }

      const afterState: BookmarkState[] = (bookmarks || []).map((b) => ({
        id: b.id,
        folder_id: b.folder_id,
        ai_tags: b.ai_tags || [],
      }));

      // 更新快照
      const { error: updateError } = await getSnapshotsTable(supabase)
        .update({ after_state: afterState })
        .eq("id", snapshotId)
        .eq("user_id", user.id);

      if (updateError) {
        logger.error(
          { updateError },
          "SnapshotManager: Failed to update after state",
        );
        return { success: false, error: "更新快照失败" };
      }

      logger.info({ snapshotId }, "SnapshotManager: After state updated");

      return { success: true };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "SnapshotManager: Update after state failed",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 获取可撤销的操作列表
   */
  async getUndoableOperations(
    limit = 10,
  ): Promise<SnapshotServiceResponse<UndoableOperation[]>> {
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      const { data, error } = await callRpc(
        supabase,
        "get_undoable_ai_operations",
        {
          p_user_id: user.id,
          p_limit: limit,
        },
      );

      if (error) {
        logger.error(
          { error },
          "SnapshotManager: Failed to get undoable operations",
        );
        return { success: false, error: "获取可撤销操作失败" };
      }

      // 转换为 UndoableOperation 类型（匹配 phase4/types.ts）
      const operations: UndoableOperation[] = (
        (data as UndoableOperationRow[]) || []
      ).map((item) => ({
        snapshotId: item.id,
        operationType: item.operation_type,
        description: item.summary || `${item.operation_type} 操作`,
        createdAt: new Date(item.created_at),
        expiresAt: new Date(item.expires_at),
        affectedCount: item.bookmark_count || 0,
      }));

      return { success: true, data: operations };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "SnapshotManager: Get undoable failed",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 撤销操作
   */
  async undo(
    snapshotId: string,
  ): Promise<SnapshotServiceResponse<UndoResponse>> {
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      const { data, error } = await callRpc(supabase, "undo_ai_operation", {
        p_snapshot_id: snapshotId,
        p_user_id: user.id,
      });

      if (error) {
        logger.error({ error }, "SnapshotManager: Undo failed");
        return { success: false, error: "撤销失败" };
      }

      const results = data as UndoResultRow[] | null;
      const result = results?.[0] || {
        success: false,
        restored_count: 0,
        message: "Unknown error",
      };

      if (!result.success) {
        logger.warn(
          { snapshotId, message: result.message },
          "SnapshotManager: Undo rejected",
        );
        return { success: false, error: result.message };
      }

      logger.info(
        { snapshotId, restoredCount: result.restored_count },
        "SnapshotManager: Undo completed",
      );

      // 返回匹配 phase4/types.ts 的 UndoResponse
      return {
        success: true,
        data: {
          success: true,
          restoredCount: result.restored_count,
        },
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "SnapshotManager: Undo error",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 获取快照详情
   */
  async getSnapshot(
    snapshotId: string,
  ): Promise<SnapshotServiceResponse<SnapshotRecord>> {
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      const { data, error } = await getSnapshotsTable(supabase)
        .select("*")
        .eq("id", snapshotId)
        .eq("user_id", user.id)
        .single();

      if (error) {
        logger.error({ error }, "SnapshotManager: Failed to get snapshot");
        return { success: false, error: "获取快照失败" };
      }

      const row = data as SnapshotRow;
      const record: SnapshotRecord = {
        id: row.id,
        userId: row.user_id,
        operationType: row.operation_type as OperationType,
        conversationId: row.conversation_id ?? undefined,
        skillId: row.skill_id ?? undefined,
        bookmarkIds: row.bookmark_ids,
        beforeState: row.before_state,
        afterState: row.after_state,
        operations: row.operations,
        summary: row.summary ?? undefined,
        isReverted: row.is_reverted,
        revertedAt: row.reverted_at ?? undefined,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      };

      return { success: true, data: record };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "SnapshotManager: Get snapshot failed",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 格式化剩余时间
   */
  private formatTimeRemaining(interval: string): string {
    // PostgreSQL interval 格式: "23:45:30"
    const match = interval.match(/(\d+):(\d+):(\d+)/);
    if (!match) return "已过期";

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    if (hours > 0) {
      return `${hours} 小时 ${minutes} 分钟`;
    }
    if (minutes > 0) {
      return `${minutes} 分钟`;
    }
    return "即将过期";
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
export const snapshotManager = new SnapshotManager();
