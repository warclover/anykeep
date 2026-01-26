/**
 * SnapshotManager 服务
 *
 * 为整理操作提供快照管理和撤销支持
 *
 * 职责：
 * - 创建操作快照（用于撤销）
 * - 执行撤销操作
 * - 管理快照生命周期
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Database, Json } from "@/types/supabase";
import type {
  OrganizeSnapshot,
  CreateSnapshotInput,
  UpdateSnapshotInput,
  UndoResult,
  OrganizeSnapshotAction,
  OrganizeOperationSnapshot,
  BookmarkStateSnapshot,
  SnapshotManagerConfig,
} from "./types";
import { DEFAULT_SNAPSHOT_CONFIG } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================
// 类型辅助
// ============================================

// 数据库行类型（匹配 operation_snapshots 表）
interface SnapshotRow {
  id: string;
  user_id: string;
  action: string;
  before_state: Json;
  after_state: Json | null;
  bookmark_ids: number[] | null;
  folder_id: number | null;
  folder_ids: number[] | null;
  reason: string | null;
  created_at: string | null;
  expires_at: string | null;
  is_undone: boolean | null;
  undone_at: string | null;
}

// 使用标准 Database 类型
type TypedSupabaseClient = SupabaseClient<Database>;

// ============================================
// SnapshotManager 类
// ============================================

/**
 * 快照管理器
 *
 * 使用示例：
 * ```typescript
 * const manager = new SnapshotManager();
 *
 * // 创建快照
 * const snapshot = await manager.createSnapshot({
 *   userId: 'user-123',
 *   action: 'batch_categorize',
 *   beforeState: { action: 'batch_categorize', beforeStates: [...], afterStates: [], createdFolders: [] },
 *   bookmarkIds: [1, 2, 3],
 *   reason: '智能分类：将 3 个书签移动到推荐文件夹',
 * });
 *
 * // 执行撤销
 * const result = await manager.undoSnapshot(snapshot.id, 'user-123');
 * ```
 */
export class SnapshotManager {
  private config: SnapshotManagerConfig;
  private supabase: TypedSupabaseClient | null = null;

  constructor(config: Partial<SnapshotManagerConfig> = {}) {
    this.config = { ...DEFAULT_SNAPSHOT_CONFIG, ...config };
  }

  /**
   * 获取 Supabase 客户端（延迟初始化）
   */
  private async getSupabase(): Promise<TypedSupabaseClient> {
    if (!this.supabase) {
      const client = await createServerSupabaseClient();
      this.supabase = client as TypedSupabaseClient;
    }
    return this.supabase;
  }

  // ==========================================
  // 快照创建
  // ==========================================

  /**
   * 创建操作快照
   *
   * @param input - 快照创建参数
   * @returns 创建的快照记录
   */
  async createSnapshot(input: CreateSnapshotInput): Promise<OrganizeSnapshot> {
    const supabase = await this.getSupabase();

    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() +
        (input.expiresInDays ?? this.config.defaultExpirationDays),
    );

    const snapshotData = {
      user_id: input.userId,
      action: input.action,
      before_state: input.beforeState as unknown as Json,
      after_state: null,
      bookmark_ids: input.bookmarkIds,
      folder_id: null,
      folder_ids: null,
      reason: input.reason ?? null,
      expires_at: expiresAt.toISOString(),
    };

    const { data, error } = await supabase
      .from("operation_snapshots")
      .insert(snapshotData)
      .select()
      .single();

    if (error) {
      logger.error(
        { error: error.message, action: input.action },
        "[SnapshotManager] Failed to create snapshot",
      );
      throw new Error(`创建操作快照失败: ${error.message}`);
    }

    const row = data as SnapshotRow;
    logger.info(
      {
        snapshotId: row.id,
        action: input.action,
        bookmarkCount: input.bookmarkIds.length,
      },
      "[SnapshotManager] Snapshot created",
    );

    return this.mapRowToSnapshot(row);
  }

  /**
   * 更新快照（添加操作后状态）
   *
   * @param snapshotId - 快照 ID
   * @param input - 更新参数
   */
  async updateSnapshot(
    snapshotId: string,
    input: UpdateSnapshotInput,
  ): Promise<void> {
    const supabase = await this.getSupabase();

    const updateData: Partial<SnapshotRow> = {};

    if (input.afterState !== undefined) {
      // Cast to Json for Supabase compatibility
      updateData.after_state = input.afterState as unknown as Json;
    }

    if (input.isUndone !== undefined) {
      updateData.is_undone = input.isUndone;
      if (input.isUndone) {
        updateData.undone_at = new Date().toISOString();
      }
    }

    const { error } = await supabase
      .from("operation_snapshots")
      .update(updateData)
      .eq("id", snapshotId);

    if (error) {
      logger.error(
        { error: error.message, snapshotId },
        "[SnapshotManager] Failed to update snapshot",
      );
      throw new Error(`更新操作快照失败: ${error.message}`);
    }

    logger.debug(
      { snapshotId, fields: Object.keys(updateData) },
      "[SnapshotManager] Snapshot updated",
    );
  }

  // ==========================================
  // 快照查询
  // ==========================================

  /**
   * 获取快照详情
   *
   * @param snapshotId - 快照 ID
   * @param userId - 用户 ID（用于权限验证）
   * @returns 快照记录，不存在时返回 null
   */
  async getSnapshot(
    snapshotId: string,
    userId: string,
  ): Promise<OrganizeSnapshot | null> {
    const supabase = await this.getSupabase();

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
        { error: error.message, snapshotId },
        "[SnapshotManager] Failed to get snapshot",
      );
      throw new Error(`获取操作快照失败: ${error.message}`);
    }

    return this.mapRowToSnapshot(data);
  }

  /**
   * 获取用户的可撤销操作列表
   *
   * @param userId - 用户 ID
   * @param limit - 返回数量限制
   * @returns 可撤销的快照列表
   */
  async getUndoableSnapshots(
    userId: string,
    limit: number = 20,
  ): Promise<OrganizeSnapshot[]> {
    const supabase = await this.getSupabase();

    const { data, error } = await supabase
      .from("operation_snapshots")
      .select("*")
      .eq("user_id", userId)
      .eq("is_undone", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(
        { error: error.message, userId },
        "[SnapshotManager] Failed to get undoable snapshots",
      );
      throw new Error(`获取可撤销操作失败: ${error.message}`);
    }

    return (data || []).map((row) => this.mapRowToSnapshot(row));
  }

  /**
   * 获取最近的操作快照
   *
   * @param userId - 用户 ID
   * @param action - 可选的操作类型筛选
   * @returns 最近的快照，不存在时返回 null
   */
  async getLatestSnapshot(
    userId: string,
    action?: OrganizeSnapshotAction,
  ): Promise<OrganizeSnapshot | null> {
    const supabase = await this.getSupabase();

    let query = supabase
      .from("operation_snapshots")
      .select("*")
      .eq("user_id", userId)
      .eq("is_undone", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (action) {
      query = query.eq("action", action);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error(
        { error: error.message, userId },
        "[SnapshotManager] Failed to get latest snapshot",
      );
      return null;
    }

    return this.mapRowToSnapshot(data);
  }

  // ==========================================
  // 撤销操作
  // ==========================================

  /**
   * 撤销操作
   *
   * 根据快照类型执行相应的撤销逻辑：
   * - batch_categorize: 恢复书签的原始文件夹，删除新创建的文件夹
   * - batch_tag: 恢复书签的原始标签
   * - batch_dedupe: 恢复被删除的书签
   * - batch_archive: 取消归档
   * - batch_delete: 恢复被删除的书签
   *
   * @param snapshotId - 快照 ID
   * @param userId - 用户 ID
   * @returns 撤销结果
   */
  async undoSnapshot(snapshotId: string, userId: string): Promise<UndoResult> {
    const snapshot = await this.getSnapshot(snapshotId, userId);

    if (!snapshot) {
      return {
        success: false,
        restoredCount: 0,
        error: "快照不存在或已过期",
      };
    }

    if (snapshot.isUndone) {
      return {
        success: false,
        restoredCount: 0,
        error: "该操作已被撤销",
      };
    }

    if (!snapshot.canUndo) {
      return {
        success: false,
        restoredCount: 0,
        error: "该操作已超过撤销时限",
      };
    }

    try {
      const result = await this.executeUndo(snapshot);

      // 标记快照为已撤销
      await this.updateSnapshot(snapshotId, { isUndone: true });

      logger.info(
        {
          snapshotId,
          action: snapshot.action,
          restoredCount: result.restoredCount,
        },
        "[SnapshotManager] Undo completed",
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        { error: errorMessage, snapshotId },
        "[SnapshotManager] Undo failed",
      );

      return {
        success: false,
        restoredCount: 0,
        error: `撤销失败: ${errorMessage}`,
      };
    }
  }

  /**
   * 执行具体的撤销逻辑
   */
  private async executeUndo(snapshot: OrganizeSnapshot): Promise<UndoResult> {
    const supabase = await this.getSupabase();
    const beforeState = snapshot.beforeState;

    switch (snapshot.action) {
      case "batch_categorize":
        return this.undoCategorize(supabase, beforeState);

      case "batch_tag":
        return this.undoTag(supabase, beforeState);

      case "batch_dedupe":
        return this.undoDedupe(supabase, beforeState);

      case "batch_archive":
        return this.undoArchive(supabase, beforeState);

      case "batch_delete":
        return this.undoDelete(supabase, beforeState);

      default:
        return {
          success: false,
          restoredCount: 0,
          error: `不支持的操作类型: ${snapshot.action}`,
        };
    }
  }

  /**
   * 撤销分类操作
   */
  private async undoCategorize(
    supabase: TypedSupabaseClient,
    state: OrganizeOperationSnapshot,
  ): Promise<UndoResult> {
    if (state.action !== "batch_categorize") {
      return { success: false, restoredCount: 0, error: "状态类型不匹配" };
    }

    const { beforeStates, createdFolders } = state;
    const restoredBookmarkIds: number[] = [];

    // 恢复书签的原始文件夹
    for (const bookmark of beforeStates) {
      const { error } = await supabase
        .from("bookmarks")
        .update({ folder_id: bookmark.folderId })
        .eq("id", bookmark.id);

      if (!error) {
        restoredBookmarkIds.push(bookmark.id);
      }
    }

    // 删除新创建的空文件夹
    const deletedFolderIds: number[] = [];
    for (const folder of createdFolders) {
      // 检查文件夹是否为空
      const { count } = await supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("folder_id", folder.id);

      if (count === 0) {
        const { error } = await supabase
          .from("folders")
          .delete()
          .eq("id", folder.id);

        if (!error) {
          deletedFolderIds.push(folder.id);
        }
      }
    }

    return {
      success: true,
      restoredCount: restoredBookmarkIds.length,
      details: {
        restoredBookmarkIds,
        deletedFolderIds,
      },
    };
  }

  /**
   * 撤销打标签操作
   */
  private async undoTag(
    supabase: TypedSupabaseClient,
    state: OrganizeOperationSnapshot,
  ): Promise<UndoResult> {
    if (state.action !== "batch_tag") {
      return { success: false, restoredCount: 0, error: "状态类型不匹配" };
    }

    const { beforeStates } = state;
    const restoredBookmarkIds: number[] = [];

    // 恢复书签的原始 AI 标签
    for (const bookmark of beforeStates) {
      const { error } = await supabase
        .from("bookmarks")
        .update({ ai_tags: bookmark.aiTags })
        .eq("id", bookmark.id);

      if (!error) {
        restoredBookmarkIds.push(bookmark.id);
      }
    }

    return {
      success: true,
      restoredCount: restoredBookmarkIds.length,
      details: {
        restoredBookmarkIds,
      },
    };
  }

  /**
   * 撤销去重操作（恢复被删除的书签）
   */
  private async undoDedupe(
    supabase: TypedSupabaseClient,
    state: OrganizeOperationSnapshot,
  ): Promise<UndoResult> {
    if (state.action !== "batch_dedupe") {
      return { success: false, restoredCount: 0, error: "状态类型不匹配" };
    }

    const { deletedBookmarks } = state;
    const restoredBookmarkIds: number[] = [];

    // 恢复被删除的书签（从回收站恢复）
    for (const bookmark of deletedBookmarks) {
      const { error } = await supabase
        .from("bookmarks")
        .update({ is_in_trash: false })
        .eq("id", bookmark.id);

      if (!error) {
        restoredBookmarkIds.push(bookmark.id);
      }
    }

    return {
      success: true,
      restoredCount: restoredBookmarkIds.length,
      details: {
        restoredBookmarkIds,
      },
    };
  }

  /**
   * 撤销归档操作
   */
  private async undoArchive(
    supabase: TypedSupabaseClient,
    state: OrganizeOperationSnapshot,
  ): Promise<UndoResult> {
    if (state.action !== "batch_archive") {
      return { success: false, restoredCount: 0, error: "状态类型不匹配" };
    }

    const { archivedBookmarks } = state;
    const restoredBookmarkIds: number[] = [];

    // 从回收站恢复
    for (const bookmark of archivedBookmarks) {
      const { error } = await supabase
        .from("bookmarks")
        .update({ is_in_trash: false })
        .eq("id", bookmark.id);

      if (!error) {
        restoredBookmarkIds.push(bookmark.id);
      }
    }

    return {
      success: true,
      restoredCount: restoredBookmarkIds.length,
      details: {
        restoredBookmarkIds,
      },
    };
  }

  /**
   * 撤销删除操作（恢复被删除的书签）
   */
  private async undoDelete(
    supabase: TypedSupabaseClient,
    state: OrganizeOperationSnapshot,
  ): Promise<UndoResult> {
    if (state.action !== "batch_delete") {
      return { success: false, restoredCount: 0, error: "状态类型不匹配" };
    }

    const { deletedBookmarks } = state;
    const restoredBookmarkIds: number[] = [];

    // 恢复被删除的书签（从回收站恢复）
    for (const bookmark of deletedBookmarks) {
      const { error } = await supabase
        .from("bookmarks")
        .update({ is_in_trash: false })
        .eq("id", bookmark.id);

      if (!error) {
        restoredBookmarkIds.push(bookmark.id);
      }
    }

    return {
      success: true,
      restoredCount: restoredBookmarkIds.length,
      details: {
        restoredBookmarkIds,
      },
    };
  }

  // ==========================================
  // 清理
  // ==========================================

  /**
   * 清理过期的快照
   *
   * @returns 清理的快照数量
   */
  async cleanupExpiredSnapshots(): Promise<number> {
    const supabase = await this.getSupabase();

    const { data, error } = await supabase
      .from("operation_snapshots")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (error) {
      logger.error(
        { error: error.message },
        "[SnapshotManager] Failed to cleanup expired snapshots",
      );
      return 0;
    }

    const count = data?.length ?? 0;
    if (count > 0) {
      logger.info({ count }, "[SnapshotManager] Expired snapshots cleaned up");
    }

    return count;
  }

  // ==========================================
  // 辅助方法
  // ==========================================

  /**
   * 将数据库行映射为快照对象
   */
  private mapRowToSnapshot(row: SnapshotRow): OrganizeSnapshot {
    const expiresAt = row.expires_at
      ? new Date(row.expires_at)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    if (!isValidSnapshotState(row.before_state)) {
      logger.warn(
        { snapshotId: row.id, state: row.before_state },
        "[SnapshotManager] Invalid before_state in snapshot",
      );
      // Fallback or throw? Throwing ensures data integrity.
      throw new Error(`Invalid before_state in snapshot ${row.id}`);
    }

    let afterState: OrganizeOperationSnapshot | null = null;
    if (row.after_state) {
      if (isValidSnapshotState(row.after_state)) {
        afterState = row.after_state;
      } else {
        logger.warn(
          { snapshotId: row.id, state: row.after_state },
          "[SnapshotManager] Invalid after_state in snapshot",
        );
        // Treat invalid after_state as null? Or throw?
        // Let's treat as null to allow viewing the snapshot even if after_state is corrupted,
        // but canUndo might be affected.
        afterState = null;
      }
    }

    return {
      id: row.id,
      userId: row.user_id,
      action: row.action as OrganizeSnapshotAction,
      beforeState: row.before_state,
      afterState: afterState,
      bookmarkIds: row.bookmark_ids ?? [],
      reason: row.reason,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      expiresAt,
      isUndone: row.is_undone || false,
      undoneAt: row.undone_at ? new Date(row.undone_at) : null,
      canUndo: !(row.is_undone || false) && expiresAt > now,
    };
  }

  /**
   * 获取书签的当前状态快照
   *
   * @param bookmarkIds - 书签 ID 列表
   * @param userId - 用户 ID
   * @returns 书签状态快照列表
   */
  async captureBookmarkStates(
    bookmarkIds: number[],
    userId: string,
  ): Promise<BookmarkStateSnapshot[]> {
    if (bookmarkIds.length === 0) {
      return [];
    }

    const supabase = await this.getSupabase();

    const { data, error } = await supabase
      .from("bookmarks")
      .select("id, title, url, folder_id, ai_tags, is_in_trash, is_starred")
      .eq("user_id", userId)
      .in("id", bookmarkIds);

    if (error) {
      logger.error(
        { error: error.message },
        "[SnapshotManager] Failed to capture bookmark states",
      );
      throw new Error(`获取书签状态失败: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      folderId: row.folder_id,
      aiTags: row.ai_tags || [],
      isInTrash: row.is_in_trash || false,
      isStarred: row.is_starred || false,
    }));
  }
}

// 导出单例
export const snapshotManager = new SnapshotManager();

/**
 * Type guard for OrganizeOperationSnapshot
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isValidSnapshotState(json: any): json is OrganizeOperationSnapshot {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return false;
  }
  const state = json as Record<string, unknown>;
  return (
    typeof state.action === "string" &&
    (state.beforeStates !== undefined ||
      state.deletedBookmarks !== undefined ||
      state.archivedBookmarks !== undefined)
  );
}
