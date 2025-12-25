/**
 * 快照持久化仓库
 *
 * @module classification/operation-log/persistence/snapshot-repository
 * @version 1.0.0
 * @since 2025-12-25
 */

import { logger } from "@/lib/logger";
import type {
  OperationSnapshot,
  OperationSnapshotInsert,
  OperationSnapshotAction,
  Json,
} from "@/lib/classification/types";
import type { OperationDetail } from "@/types/supabase";
import type {
  SupabaseClientType,
  OperationHistoryOptions,
  SnapshotRow,
} from "../types";

// ============================================
// 快照创建
// ============================================

/**
 * 创建操作快照
 */
export async function createSnapshot(
  supabase: SupabaseClientType,
  userId: string,
  action: OperationSnapshotAction,
  beforeState: Json,
  afterState: Json,
  options: {
    folderId?: number;
    folderIds?: number[];
    bookmarkIds?: number[];
    reason?: string;
  } = {},
): Promise<OperationSnapshot> {
  const snapshotData: OperationSnapshotInsert = {
    user_id: userId,
    action,
    before_state: beforeState,
    after_state: afterState,
    folder_id: options.folderId ?? null,
    folder_ids: options.folderIds ?? null,
    bookmark_ids: options.bookmarkIds ?? null,
    reason: options.reason ?? null,
  };

  const { data, error } = await supabase
    .from("operation_snapshots")
    .insert(snapshotData)
    .select()
    .single();

  if (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "[SnapshotRepository] Failed to create snapshot",
    );
    throw new Error(`创建操作快照失败: ${error.message}`);
  }

  return data as OperationSnapshot;
}

// ============================================
// 快照查询
// ============================================

/**
 * 获取用户的操作历史
 */
export async function getOperationHistory(
  supabase: SupabaseClientType,
  userId: string,
  options: OperationHistoryOptions = {},
): Promise<OperationDetail[]> {
  const {
    limit = 50,
    includeUndone = false,
    includeExpired = false,
    actionFilter,
  } = options;

  let query = supabase
    .from("operation_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!includeUndone) {
    query = query.eq("is_undone", false);
  }

  if (!includeExpired) {
    query = query.gt("expires_at", new Date().toISOString());
  }

  if (actionFilter && actionFilter.length > 0) {
    query = query.in("action", actionFilter);
  }

  const { data, error } = await query;

  if (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "[SnapshotRepository] Failed to get history",
    );
    throw new Error(`获取操作历史失败: ${error.message}`);
  }

  const typedData = (data || []) as unknown as SnapshotRow[];

  return typedData.map((snapshot: SnapshotRow) => ({
    id: String(snapshot.id),
    action: snapshot.action as OperationSnapshotAction,
    folder_id: snapshot.folder_id,
    folder_ids: snapshot.folder_ids,
    bookmark_ids: snapshot.bookmark_ids,
    before_state: snapshot.before_state as Json,
    after_state: snapshot.after_state as Json,
    reason: snapshot.reason,
    created_at: snapshot.created_at,
    expires_at: snapshot.expires_at,
    is_undone: snapshot.is_undone,
    undone_at: snapshot.undone_at,
    can_undo: !snapshot.is_undone && new Date(snapshot.expires_at) > new Date(),
  }));
}

/**
 * 获取单个操作快照详情
 */
export async function getSnapshotById(
  supabase: SupabaseClientType,
  userId: string,
  snapshotId: string,
): Promise<OperationSnapshot | null> {
  const { data, error } = await supabase
    .from("operation_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "[SnapshotRepository] Failed to get snapshot",
    );
    throw new Error(`获取操作快照失败: ${error.message}`);
  }

  return data as unknown as OperationSnapshot;
}

// ============================================
// 快照统计和清理
// ============================================

/**
 * 获取可撤销操作数量
 */
export async function getUndoableCount(
  supabase: SupabaseClientType,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("operation_snapshots")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_undone", false)
    .gt("expires_at", new Date().toISOString());

  if (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "[SnapshotRepository] Failed to get undoable count",
    );
    return 0;
  }

  return count ?? 0;
}

/**
 * 清理过期的操作记录
 */
export async function cleanupExpiredSnapshots(
  supabase: SupabaseClientType,
): Promise<number> {
  const { data, error } = await supabase
    .from("operation_snapshots")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "[SnapshotRepository] Failed to cleanup",
    );
    return 0;
  }

  return data?.length ?? 0;
}

/**
 * 标记快照为已撤销
 */
export async function markSnapshotAsUndone(
  supabase: SupabaseClientType,
  snapshotId: string,
): Promise<void> {
  await supabase
    .from("operation_snapshots")
    .update({
      is_undone: true,
      undone_at: new Date().toISOString(),
    })
    .eq("id", snapshotId);
}
