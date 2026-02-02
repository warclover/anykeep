import { createClient } from '@/lib/supabase/client';
import type { SnapshotEntity, RollbackResult, EntityType } from '../types';

class SnapshotManager {
  private readonly EXPIRY_HOURS = 24;

  /**
   * 创建操作快照
   */
  async createSnapshot(
    operationId: string,
    entities: SnapshotEntity[]
  ): Promise<void> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.EXPIRY_HOURS);

    const snapshots = entities.map(entity => ({
      operation_id: operationId,
      user_id: user.id,
      entity_type: entity.type,
      entity_id: entity.id,
      before_state: entity.data,
      expires_at: expiresAt.toISOString(),
    }));

    const { error } = await supabase
      .from('operation_snapshots')
      .insert(snapshots);

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
      const { data: snapshots, error: fetchError } = await supabase
        .from('operation_snapshots')
        .select('*')
        .eq('operation_id', operationId);

      if (fetchError) {
        throw fetchError;
      }

      if (!snapshots || snapshots.length === 0) {
        return { success: false, restoredCount: 0, error: 'No snapshots found' };
      }

      // 2. 按实体类型分组恢复
      let restoredCount = 0;

      for (const snapshot of snapshots) {
        const tableName = this.getTableName(snapshot.entity_type);

        if (tableName) {
          const { error: upsertError } = await supabase
            .from(tableName)
            .upsert(snapshot.before_state);

          if (!upsertError) {
            restoredCount++;
          }
        }
      }

      // 3. 恢复软删除的实体
      await supabase
        .from('bookmarks')
        .update({ deleted_at: null })
        .match({ operation_id: operationId })
        .not('deleted_at', 'is', null);

      // 4. 标记快照为已使用（或删除）
      await supabase
        .from('operation_snapshots')
        .delete()
        .eq('operation_id', operationId);

      return { success: true, restoredCount };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SnapshotManager] Rollback failed:', error);
      return { success: false, restoredCount: 0, error: message };
    }
  }

  /**
   * 检查操作是否可回滚
   */
  async canRollback(operationId: string): Promise<boolean> {
    const supabase = createClient();

    const { count, error } = await supabase
      .from('operation_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('operation_id', operationId)
      .gt('expires_at', new Date().toISOString());

    return !error && (count ?? 0) > 0;
  }

  /**
   * 手动清理过期快照
   */
  async cleanup(): Promise<number> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('operation_snapshots')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      console.error('[SnapshotManager] Cleanup failed:', error);
      return 0;
    }

    return data?.length || 0;
  }

  private getTableName(entityType: EntityType): string | null {
    const mapping: Record<EntityType, string> = {
      bookmark: 'bookmarks',
      folder: 'folders',
      tag: 'tags',
    };
    return mapping[entityType] || null;
  }
}

export const snapshotManager = new SnapshotManager();
