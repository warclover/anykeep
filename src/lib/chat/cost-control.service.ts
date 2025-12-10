/**
 * AI 对话成本控制服务
 * Phase 4.4: 用量限制、缓存策略
 *
 * 功能：
 * - 每日对话次数限制
 * - Token 使用量追踪
 * - 响应缓存
 * - 会员等级差异化配额
 *
 * @version 1.0.0
 * @since 2025-12-09
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { v42Table, v42Rpc } from "@/lib/supabase/v42-types";

/**
 * 用量配额配置（按会员类型）
 */
export interface UsageQuota {
  /** 每日对话次数限制 */
  dailyConversations: number;
  /** 每次对话最大 token */
  maxTokensPerChat: number;
  /** 每日最大 token 总量 */
  dailyTokenLimit: number;
  /** 是否启用响应缓存 */
  enableCache: boolean;
}

/**
 * 会员类型配额
 */
const QUOTA_BY_MEMBERSHIP: Record<string, UsageQuota> = {
  free: {
    dailyConversations: 10,
    maxTokensPerChat: 500,
    dailyTokenLimit: 5000,
    enableCache: true,
  },
  basic: {
    dailyConversations: 50,
    maxTokensPerChat: 1000,
    dailyTokenLimit: 30000,
    enableCache: true,
  },
  pro: {
    dailyConversations: 200,
    maxTokensPerChat: 2000,
    dailyTokenLimit: 100000,
    enableCache: false,
  },
  unlimited: {
    dailyConversations: -1, // 无限制
    maxTokensPerChat: 4000,
    dailyTokenLimit: -1,
    enableCache: false,
  },
};

/**
 * 用量统计
 */
export interface UsageStats {
  date: string;
  conversationCount: number;
  tokensUsed: number;
  quota: UsageQuota;
  remaining: {
    conversations: number;
    tokens: number;
  };
  isLimitReached: boolean;
}

/**
 * 成本控制服务
 */
export class CostControlService {
  /**
   * 检查用户是否可以发起对话
   */
  async canChat(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    stats: UsageStats;
  }> {
    const stats = await this.getUsageStats(userId);

    if (stats.isLimitReached) {
      return {
        allowed: false,
        reason: stats.remaining.conversations <= 0
          ? "今日对话次数已用完"
          : "今日 Token 配额已用完",
        stats,
      };
    }

    return { allowed: true, stats };
  }

  /**
   * 获取用户用量统计
   */
  async getUsageStats(userId: string): Promise<UsageStats> {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    // 获取用户会员类型
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", userId)
      .single();

    const membershipType = profile?.membership_type || "free";
    const quota = QUOTA_BY_MEMBERSHIP[membershipType] || QUOTA_BY_MEMBERSHIP.free;

    // 获取今日用量 (V4.2 chat_usage 表)
    const { data: usage } = await v42Table(supabase)
      .from("chat_usage")
      .select("conversation_count, tokens_used")
      .eq("user_id", userId)
      .eq("date", today)
      .single();

    const typedUsage = usage as { conversation_count?: number; tokens_used?: number } | null;
    const conversationCount = typedUsage?.conversation_count || 0;
    const tokensUsed = typedUsage?.tokens_used || 0;

    // 计算剩余配额
    const remainingConversations =
      quota.dailyConversations === -1
        ? -1
        : Math.max(0, quota.dailyConversations - conversationCount);

    const remainingTokens =
      quota.dailyTokenLimit === -1
        ? -1
        : Math.max(0, quota.dailyTokenLimit - tokensUsed);

    // 判断是否达到限制
    const isLimitReached =
      (quota.dailyConversations !== -1 && remainingConversations <= 0) ||
      (quota.dailyTokenLimit !== -1 && remainingTokens <= 0);

    return {
      date: today,
      conversationCount,
      tokensUsed,
      quota,
      remaining: {
        conversations: remainingConversations,
        tokens: remainingTokens,
      },
      isLimitReached,
    };
  }

  /**
   * 记录对话使用
   */
  async recordUsage(
    userId: string,
    tokensUsed: number
  ): Promise<void> {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    // 使用 upsert 更新或创建记录 (V4.2 RPC)
    const { error } = await v42Rpc(supabase).rpc("increment_chat_usage", {
      p_user_id: userId,
      p_date: today,
      p_tokens: tokensUsed,
    });

    if (error) {
      logger.error(
        { error: error.message, userId, tokensUsed },
        "CostControl: Failed to record usage"
      );
      // 不抛出错误，允许继续使用
    }
  }

  /**
   * 获取用户配额
   */
  async getUserQuota(userId: string): Promise<UsageQuota> {
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", userId)
      .single();

    const membershipType = profile?.membership_type || "free";
    return QUOTA_BY_MEMBERSHIP[membershipType] || QUOTA_BY_MEMBERSHIP.free;
  }

  /**
   * 检查是否应该使用缓存
   */
  async shouldUseCache(userId: string): Promise<boolean> {
    const quota = await this.getUserQuota(userId);
    return quota.enableCache;
  }

  /**
   * 获取缓存的响应（简单实现，基于查询哈希）
   */
  async getCachedResponse(
    userId: string,
    queryHash: string
  ): Promise<string | null> {
    const shouldCache = await this.shouldUseCache(userId);
    if (!shouldCache) return null;

    const supabase = await createClient();

    // 查找 24 小时内的缓存 (V4.2 chat_cache 表)
    const { data } = await v42Table(supabase)
      .from("chat_cache")
      .select("response")
      .eq("user_id", userId)
      .eq("query_hash", queryHash)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const typedData = data as { response?: string } | null;
    return typedData?.response || null;
  }

  /**
   * 缓存响应
   */
  async cacheResponse(
    userId: string,
    queryHash: string,
    response: string
  ): Promise<void> {
    const shouldCache = await this.shouldUseCache(userId);
    if (!shouldCache) return;

    const supabase = await createClient();

    // V4.2 chat_cache 表
    await v42Table(supabase).from("chat_cache").upsert(
      {
        user_id: userId,
        query_hash: queryHash,
        response,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,query_hash" }
    );
  }
}

/**
 * 生成查询哈希（用于缓存键）
 */
export function generateQueryHash(query: string, context?: string): string {
  const input = `${query}|${context || ""}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// 导出单例
export const costControlService = new CostControlService();
