/**
 * Pending Confirmation Repository
 * V4.2 待确认消息数据访问层
 *
 * @description 管理 pending_confirmations 表的数据操作
 * - CRUD 操作
 * - 查询过滤
 * - 批量操作
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { BaseSupabaseService } from "@/lib/classification/services/base-supabase.service";
import type {
  ConfirmationType,
  ConfirmationStatus,
  Suggestion,
  UserChoice,
  PendingConfirmationRecord,
  CreatePendingConfirmationInput,
} from "@/types/confirmation";
import { DEFAULT_EXPIRATION_DAYS } from "@/types/confirmation";

// ============================================================================
// 常量
// ============================================================================

const PENDING_CONFIRMATIONS_TABLE = "pending_confirmations" as const;

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 数据库行类型
 */
interface ConfirmationRow {
  id: number;
  user_id: string;
  confirmation_type: ConfirmationType;
  bookmark_id: number | null;
  folder_id: number | null;
  suggestion: Suggestion;
  status: ConfirmationStatus;
  user_choice: UserChoice | null;
  expires_at: string;
  created_at: string;
  resolved_at: string | null;
}

/**
 * 查询过滤条件
 */
export interface ConfirmationQueryFilters {
  status?: ConfirmationStatus | ConfirmationStatus[];
  type?: ConfirmationType | ConfirmationType[];
  bookmarkId?: number;
  folderId?: number;
  expiredOnly?: boolean;
  pendingOnly?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Repository 实现
// ============================================================================

/**
 * 待确认消息仓库
 */
export class ConfirmationRepository extends BaseSupabaseService {
  // ============================================================================
  // 创建操作
  // ============================================================================

  /**
   * 创建待确认记录
   */
  async create(
    input: CreatePendingConfirmationInput,
  ): Promise<PendingConfirmationRecord> {
    const supabase = await this.getSupabase();

    const expirationDays = input.expiresInDays ?? DEFAULT_EXPIRATION_DAYS;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .insert({
        user_id: input.userId,
        confirmation_type: input.confirmationType,
        bookmark_id: input.bookmarkId || null,
        folder_id: input.folderId || null,
        suggestion: input.suggestion,
        status: "pending",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create confirmation: ${error.message}`);
    }

    return this.mapToRecord(data);
  }

  /**
   * 批量创建待确认记录
   */
  async createMany(
    inputs: CreatePendingConfirmationInput[],
  ): Promise<PendingConfirmationRecord[]> {
    if (inputs.length === 0) return [];

    const supabase = await this.getSupabase();

    const rows = inputs.map((input) => {
      const expirationDays = input.expiresInDays ?? DEFAULT_EXPIRATION_DAYS;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      return {
        user_id: input.userId,
        confirmation_type: input.confirmationType,
        bookmark_id: input.bookmarkId || null,
        folder_id: input.folderId || null,
        suggestion: input.suggestion,
        status: "pending" as const,
        expires_at: expiresAt.toISOString(),
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .insert(rows)
      .select();

    if (error) {
      throw new Error(`Failed to create confirmations: ${error.message}`);
    }

    return (data || []).map((row: ConfirmationRow) => this.mapToRecord(row));
  }

  // ============================================================================
  // 查询操作
  // ============================================================================

  /**
   * 根据 ID 查找
   */
  async findById(id: number): Promise<PendingConfirmationRecord | null> {
    const supabase = await this.getSupabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to find confirmation: ${error.message}`);
    }

    return this.mapToRecord(data);
  }

  /**
   * 查找用户的待确认记录
   */
  async findByUser(
    userId: string,
    filters?: ConfirmationQueryFilters,
  ): Promise<PendingConfirmationRecord[]> {
    const supabase = await this.getSupabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .select("*")
      .eq("user_id", userId);

    // 应用过滤条件
    if (filters) {
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in("status", filters.status);
        } else {
          query = query.eq("status", filters.status);
        }
      }

      if (filters.type) {
        if (Array.isArray(filters.type)) {
          query = query.in("confirmation_type", filters.type);
        } else {
          query = query.eq("confirmation_type", filters.type);
        }
      }

      if (filters.bookmarkId) {
        query = query.eq("bookmark_id", filters.bookmarkId);
      }

      if (filters.folderId) {
        query = query.eq("folder_id", filters.folderId);
      }

      if (filters.expiredOnly) {
        query = query.lt("expires_at", new Date().toISOString());
      }

      if (filters.pendingOnly) {
        query = query.eq("status", "pending");
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(
          filters.offset,
          filters.offset + (filters.limit || 50) - 1,
        );
      }
    }

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to query confirmations: ${error.message}`);
    }

    return (data || []).map((row: ConfirmationRow) => this.mapToRecord(row));
  }

  /**
   * 根据书签 ID 查找待确认记录
   */
  async findByBookmarkId(
    userId: string,
    bookmarkId: number,
  ): Promise<PendingConfirmationRecord | null> {
    const records = await this.findByUser(userId, {
      bookmarkId,
      pendingOnly: true,
      limit: 1,
    });
    return records[0] || null;
  }

  /**
   * 获取待确认数量
   */
  async countPending(userId: string): Promise<number> {
    const supabase = await this.getSupabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");

    if (error) {
      throw new Error(`Failed to count pending: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * 获取已过期的记录
   */
  async findExpired(limit: number = 100): Promise<PendingConfirmationRecord[]> {
    const supabase = await this.getSupabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .select("*")
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString())
      .limit(limit);

    if (error) {
      throw new Error(`Failed to find expired: ${error.message}`);
    }

    return (data || []).map((row: ConfirmationRow) => this.mapToRecord(row));
  }

  // ============================================================================
  // 更新操作
  // ============================================================================

  /**
   * 更新状态
   */
  async updateStatus(
    id: number,
    status: ConfirmationStatus,
    userChoice?: UserChoice,
  ): Promise<PendingConfirmationRecord> {
    const supabase = await this.getSupabase();

    const updateData: Record<string, unknown> = {
      status,
    };

    if (userChoice) {
      updateData.user_choice = userChoice;
    }

    if (status !== "pending") {
      updateData.resolved_at = new Date().toISOString();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update confirmation: ${error.message}`);
    }

    return this.mapToRecord(data);
  }

  /**
   * 批量更新状态（用于过期处理）
   */
  async batchUpdateStatus(
    ids: number[],
    status: ConfirmationStatus,
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const supabase = await this.getSupabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .update({
        status,
        resolved_at: new Date().toISOString(),
      })
      .in("id", ids);

    if (error) {
      throw new Error(`Failed to batch update: ${error.message}`);
    }

    return count || 0;
  }

  // ============================================================================
  // 删除操作
  // ============================================================================

  /**
   * 删除记录
   */
  async delete(id: number): Promise<void> {
    const supabase = await this.getSupabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete confirmation: ${error.message}`);
    }
  }

  /**
   * 删除用户的所有待确认记录
   */
  async deleteAllByUser(userId: string): Promise<number> {
    const supabase = await this.getSupabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .delete()
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to delete user confirmations: ${error.message}`);
    }

    return count || 0;
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 映射数据库行到业务对象
   */
  private mapToRecord(row: ConfirmationRow): PendingConfirmationRecord {
    return {
      id: row.id,
      user_id: row.user_id,
      confirmation_type: row.confirmation_type,
      bookmark_id: row.bookmark_id,
      folder_id: row.folder_id,
      suggestion: row.suggestion,
      status: row.status,
      user_choice: row.user_choice,
      expires_at: row.expires_at,
      created_at: row.created_at,
      resolved_at: row.resolved_at,
    };
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const confirmationRepository = new ConfirmationRepository();
