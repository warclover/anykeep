/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Trust Mode Repository
 * V4.2 托管模式数据访问层
 *
 * @description 提供托管模式相关的数据库操作
 * - 读取/更新用户托管模式
 * - 记录模式切换历史
 * - 统计信息更新
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TrustMode,
  TrustModeConfig,
  UserTrustModeRecord,
  ModeChangeRecord,
} from "@/types/trust-mode";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 数据库返回的原始数据
 */
interface UserTrustModeRow {
  id: number;
  user_id: string;
  trust_mode: TrustMode;
  overrides: Partial<TrustModeConfig>;
  mode_history: ModeChangeRecord[];
  auto_decisions_count: number;
  user_corrections_count: number;
  pending_confirmations_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * 创建托管模式输入
 */
export interface CreateTrustModeInput {
  userId: string;
  trustMode?: TrustMode;
  overrides?: Partial<TrustModeConfig>;
}

/**
 * 更新托管模式输入
 */
export interface UpdateTrustModeInput {
  userId: string;
  trustMode?: TrustMode;
  overrides?: Partial<TrustModeConfig>;
  reason?: string;
}

/**
 * 增量统计输入
 */
export interface IncrementStatsInput {
  userId: string;
  autoDecisions?: number;
  userCorrections?: number;
  pendingConfirmations?: number;
}

// ============================================================================
// Repository 实现
// ============================================================================

/**
 * 托管模式 Repository
 */
export class TrustModeRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 获取用户托管模式
   */
  async findByUserId(userId: string): Promise<UserTrustModeRecord | null> {
    const { data: data, error } = await this.supabase
      .from("user_trust_mode")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // 记录不存在
      }
      throw new Error(`Failed to fetch trust mode: ${error.message}`);
    }

    return this.mapToRecord(data as UserTrustModeRow);
  }

  /**
   * 创建用户托管模式记录
   */
  async create(input: CreateTrustModeInput): Promise<UserTrustModeRecord> {
    const { userId, trustMode = "full_auto", overrides = {} } = input;

    const initialHistory: ModeChangeRecord[] = [
      {
        from: "full_auto", // 初始状态
        to: trustMode,
        timestamp: new Date().toISOString(),
        reason: "Initial setup",
      },
    ];

    const { data: data, error } = await this.supabase
      .from("user_trust_mode")
      .insert({
        user_id: userId,
        trust_mode: trustMode,
        overrides,
        mode_history: initialHistory,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create trust mode: ${error.message}`);
    }

    return this.mapToRecord(data as UserTrustModeRow);
  }

  /**
   * 更新用户托管模式
   */
  async update(input: UpdateTrustModeInput): Promise<UserTrustModeRecord> {
    const { userId, trustMode, overrides, reason } = input;

    // 使用 RPC 函数更新（处理历史记录）
    if (trustMode) {
      const { data: data, error } = await this.supabase.rpc(
        "update_user_trust_mode",
        {
          p_user_id: userId,
          p_trust_mode: trustMode,
          p_reason: reason || null,
        },
      );

      if (error) {
        throw new Error(`Failed to update trust mode: ${error.message}`);
      }

      // 如果有 overrides，单独更新
      if (overrides) {
        await this.updateOverrides(userId, overrides);
      }

      // 重新获取完整记录
      const record = await this.findByUserId(userId);
      if (!record) {
        throw new Error("Trust mode record not found after update");
      }
      return record;
    }

    // 只更新 overrides
    if (overrides) {
      return this.updateOverrides(userId, overrides);
    }

    throw new Error("No update fields provided");
  }

  /**
   * 更新覆盖配置
   */
  async updateOverrides(
    userId: string,
    overrides: Partial<TrustModeConfig>,
  ): Promise<UserTrustModeRecord> {
    // 先获取当前记录
    const current = await this.findByUserId(userId);
    if (!current) {
      // 如果不存在，创建新记录
      return this.create({ userId, overrides });
    }

    // 合并 overrides
    const mergedOverrides = {
      ...current.overrides,
      ...overrides,
    };

    const { data: data, error } = await this.supabase
      .from("user_trust_mode")
      .update({
        overrides: mergedOverrides,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update overrides: ${error.message}`);
    }

    return this.mapToRecord(data as UserTrustModeRow);
  }

  /**
   * 获取或创建用户托管模式
   */
  async getOrCreate(userId: string): Promise<UserTrustModeRecord> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      return existing;
    }
    return this.create({ userId });
  }

  /**
   * 增量更新统计信息
   */
  async incrementStats(input: IncrementStatsInput): Promise<void> {
    const {
      userId,
      autoDecisions = 0,
      userCorrections = 0,
      pendingConfirmations = 0,
    } = input;

    // 确保记录存在
    await this.getOrCreate(userId);

    const { error } = await this.supabase.rpc("increment_trust_mode_stats", {
      p_user_id: userId,
      p_auto_decisions: autoDecisions,
      p_user_corrections: userCorrections,
      p_pending_confirmations: pendingConfirmations,
    });

    // 如果 RPC 不存在，使用直接更新
    if (error && error.code === "42883") {
      // function does not exist
      await this.incrementStatsDirect(input);
      return;
    }

    if (error) {
      throw new Error(`Failed to increment stats: ${error.message}`);
    }
  }

  /**
   * 直接增量更新统计（备用方法）
   */
  private async incrementStatsDirect(
    input: IncrementStatsInput,
  ): Promise<void> {
    const {
      userId,
      autoDecisions = 0,
      userCorrections = 0,
      pendingConfirmations = 0,
    } = input;

    const current = await this.findByUserId(userId);
    if (!current) {
      return;
    }

    const { error } = await this.supabase
      .from("user_trust_mode")
      .update({
        auto_decisions_count: current.auto_decisions_count + autoDecisions,
        user_corrections_count:
          current.user_corrections_count + userCorrections,
        pending_confirmations_count:
          current.pending_confirmations_count + pendingConfirmations,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to increment stats directly: ${error.message}`);
    }
  }

  /**
   * 重置待确认计数
   */
  async resetPendingCount(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from("user_trust_mode")
      .update({
        pending_confirmations_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to reset pending count: ${error.message}`);
    }
  }

  /**
   * 获取模式切换历史
   */
  async getModeHistory(userId: string): Promise<ModeChangeRecord[]> {
    const record = await this.findByUserId(userId);
    return record?.mode_history || [];
  }

  /**
   * 删除用户托管模式记录
   */
  async delete(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from("user_trust_mode")
      .delete()
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to delete trust mode: ${error.message}`);
    }
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 映射数据库行到记录类型
   */
  private mapToRecord(row: UserTrustModeRow): UserTrustModeRecord {
    return {
      id: row.id,
      user_id: row.user_id,
      trust_mode: row.trust_mode,
      overrides: row.overrides || {},
      mode_history: row.mode_history || [],
      auto_decisions_count: row.auto_decisions_count,
      user_corrections_count: row.user_corrections_count,
      pending_confirmations_count: row.pending_confirmations_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
