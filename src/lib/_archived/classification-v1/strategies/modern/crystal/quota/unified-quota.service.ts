/**
 * V5.5 统一配额服务
 *
 * 合并现有 daily_limit 和新的三层弹性配额制：
 * - Layer 1: 系统硬上限 (Hard Cap)
 * - Layer 2: 动态软上限 (Soft Cap)
 * - Layer 3: 健康度门控 (Health Gate)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type {
  UnifiedQuotaResult,
  QuotaStatsRaw,
  AIFolderSettings,
} from "./types";
import { QUOTA_CONFIG } from "./types";

export class UnifiedQuotaService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 统一配额检查入口
   * 合并现有 daily_limit 和新的三层配额
   */
  async checkQuota(userId: string): Promise<UnifiedQuotaResult> {
    const startTime = performance.now();

    try {
      // 并行获取所有配额相关数据
      const [quotaStats, settings] = await Promise.all([
        this.getQuotaStats(userId),
        this.getAIFolderSettings(userId),
      ]);

      const dailyLimit =
        settings?.daily_create_limit ?? QUOTA_CONFIG.DEFAULT_DAILY_LIMIT;
      const dynamicCap = this.calculateDynamicCap(
        quotaStats.total_bookmark_count,
      );

      // 三重检查
      const dailyAllowed = quotaStats.today_created_count < dailyLimit;
      const totalAllowed = quotaStats.ai_folder_count < dynamicCap;
      const healthAllowed =
        quotaStats.empty_folder_count <= QUOTA_CONFIG.EMPTY_FOLDER_THRESHOLD;

      const result: UnifiedQuotaResult = {
        allowed: dailyAllowed && totalAllowed && healthAllowed,

        daily: {
          used: quotaStats.today_created_count,
          limit: dailyLimit,
          remaining: Math.max(0, dailyLimit - quotaStats.today_created_count),
        },

        total: {
          aiCreated: quotaStats.ai_folder_count,
          limit: dynamicCap,
          remaining: Math.max(0, dynamicCap - quotaStats.ai_folder_count),
        },

        health: {
          passed: healthAllowed,
          emptyFolders: quotaStats.empty_folder_count,
          reason: healthAllowed
            ? undefined
            : `存在 ${quotaStats.empty_folder_count} 个空文件夹，建议整理后再创建新文件夹`,
        },
      };

      logger.debug(
        {
          userId,
          quotaStats,
          result,
          latencyMs: performance.now() - startTime,
        },
        "V5.5: Quota check completed",
      );

      return result;
    } catch (error) {
      logger.error({ userId, error }, "V5.5: Quota check failed");

      // 发生错误时返回保守结果（允许创建，避免阻塞用户）
      return {
        allowed: true,
        daily: {
          used: 0,
          limit: QUOTA_CONFIG.DEFAULT_DAILY_LIMIT,
          remaining: QUOTA_CONFIG.DEFAULT_DAILY_LIMIT,
        },
        total: {
          aiCreated: 0,
          limit: QUOTA_CONFIG.AI_HARD_CAP,
          remaining: QUOTA_CONFIG.AI_HARD_CAP,
        },
        health: { passed: true, emptyFolders: 0 },
      };
    }
  }

  /**
   * 计算动态软上限
   * 公式: min(书签数 × 15%, 硬上限)
   */
  calculateDynamicCap(bookmarkCount: number): number {
    const calculated = Math.ceil(bookmarkCount * QUOTA_CONFIG.SOFT_CAP_RATIO);
    return Math.max(
      QUOTA_CONFIG.SOFT_CAP_MIN,
      Math.min(calculated, QUOTA_CONFIG.AI_HARD_CAP),
    );
  }

  /**
   * 获取配额统计数据
   */
  private async getQuotaStats(userId: string): Promise<QuotaStatsRaw> {
    const { data, error } = await this.supabase.rpc("get_unified_quota_stats", {
      p_user_id: userId,
    });

    if (error) {
      logger.error({ userId, error }, "V5.5: Failed to get quota stats");
      throw error;
    }

    // RPC 返回单行结果
    const stats = Array.isArray(data) ? data[0] : data;

    return {
      ai_folder_count: stats?.ai_folder_count ?? 0,
      total_folder_count: stats?.total_folder_count ?? 0,
      empty_folder_count: stats?.empty_folder_count ?? 0,
      total_bookmark_count: stats?.total_bookmark_count ?? 0,
      today_created_count: stats?.today_created_count ?? 0,
    };
  }

  /**
   * 获取用户 AI 文件夹设置
   */
  private async getAIFolderSettings(
    userId: string,
  ): Promise<AIFolderSettings | null> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return null;
    }

    // 从 settings JSONB 中提取 AI 文件夹相关配置
    const settings = data.settings as Record<string, unknown> | null;
    return {
      autonomy_level: (settings?.autonomy_level as 1 | 2 | 3) ?? 1,
      daily_create_limit:
        (settings?.ai_folder_daily_limit as number) ??
        QUOTA_CONFIG.DEFAULT_DAILY_LIMIT,
    };
  }

  /**
   * 检查是否允许静默创建（基于 autonomy_level）
   */
  async canSilentCreate(userId: string): Promise<boolean> {
    const settings = await this.getAIFolderSettings(userId);
    // 仅 autonomy_level = 1 时允许静默创建
    return settings?.autonomy_level === 1;
  }

  /**
   * 获取配额使用百分比（用于 UI 展示）
   */
  async getQuotaUsagePercent(userId: string): Promise<number> {
    const quota = await this.checkQuota(userId);
    if (quota.total.limit === 0) return 0;
    return Math.round((quota.total.aiCreated / quota.total.limit) * 100);
  }
}
