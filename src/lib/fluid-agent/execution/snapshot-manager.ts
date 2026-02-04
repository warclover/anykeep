import { createClient } from "@/lib/supabase/client";
import type { SnapshotEntity, RollbackResult, EntityType } from "../types";
import type { Json } from "@/types/supabase.generated";
import { logger } from "@/lib/logger";

class SnapshotManager {
  private readonly EXPIRY_HOURS = 24;

  /**
   * 创建操作快照
   * 适配 operation_snapshots 表结构：action, before_state, after_state, bookmark_ids, folder_ids
   */
  async createSnapshot(
    operationId: string,
    entities: SnapshotEntity[],
  ): Promise<void> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.EXPIRY_HOURS);

    // 按实体类型分组
    const bookmarkIds = entities
      .filter((e) => e.type === "bookmark")
      .map((e) => e.id);
    const folderIds = entities
      .filter((e) => e.type === "folder")
      .map((e) => e.id);

    // 合并所有实体的 before_state
    const beforeState: Record<string, unknown> = {};
    entities.forEach((entity) => {
      beforeState[`${entity.type}_${entity.id}`] = entity.data;
    });

    const snapshot = {
      id: operationId,
      user_id: user.id,
      action: "batch_operation",
      before_state: beforeState as Json,
      after_state: {} as Json,
      bookmark_ids: bookmarkIds.length > 0 ? bookmarkIds : null,
      folder_ids: folderIds.length > 0 ? folderIds : null,
      expires_at: expiresAt.toISOString(),
    };

    const { error } = await supabase
      .from("operation_snapshots")
      .insert(snapshot);

    if (error) {
      throw new Error(`Failed to create snapshot: ${error.message}`);
    }
  }

  /**
   * 执行回滚（覆盖式恢复）
   */
  async rollback(operationId: string): Promise<RollbackResult> {
    const supabase = createClient();

    try {
      // 1. 获取快照
      const { data: snapshot, error: fetchError } = await supabase
        .from("operation_snapshots")
        .select("*")
        .eq("id", operationId)
        .single();

      if (fetchError || !snapshot) {
        return {
          success: false,
          restoredCount: 0,
          error: "No snapshot found",
        };
      }

      // 2. 从 before_state 恢复实体
      let restoredCount = 0;
      const beforeState = snapshot.before_state as Record<string, unknown>;

      for (const [key, data] of Object.entries(beforeState)) {
        const [entityType] = key.split("_");
        const tableName = this.getTableName(entityType as EntityType);

        if (tableName && data && typeof data === "object") {
          // 使用类型断言处理动态表名
          const { error: upsertError } = await supabase
            .from(tableName as "bookmarks" | "folders" | "tags")
            .upsert(data as never);

          if (!upsertError) {
            restoredCount++;
          }
        }
      }

      // 3. 标记快照为已撤销
      await supabase
        .from("operation_snapshots")
        .update({ is_undone: true, undone_at: new Date().toISOString() })
        .eq("id", operationId);

      return { success: true, restoredCount };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error({ error }, "[SnapshotManager] Rollback failed:");
      return { success: false, restoredCount: 0, error: message };
    }
  }

  /**
   * 检查操作是否可回滚
   */
  async canRollback(operationId: string): Promise<boolean> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("operation_snapshots")
      .select("id, is_undone, expires_at")
      .eq("id", operationId)
      .single();

    if (error || !data) return false;

    // 未撤销且未过期
    const notUndone = !data.is_undone;
    const notExpired = data.expires_at
      ? new Date(data.expires_at) > new Date()
      : true;

    return notUndone && notExpired;
  }

  /**
   * 手动清理过期快照
   */
  async cleanup(): Promise<number> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("operation_snapshots")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (error) {
      logger.error({ error }, "[SnapshotManager] Cleanup failed:");
      return 0;
    }

    return data?.length || 0;
  }

  private getTableName(entityType: EntityType): string | null {
    const mapping: Record<EntityType, string> = {
      bookmark: "bookmarks",
      folder: "folders",
      tag: "tags",
    };
    return mapping[entityType] || null;
  }
}

export const snapshotManager = new SnapshotManager();
