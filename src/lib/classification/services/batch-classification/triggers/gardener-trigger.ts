/**
 * 批量分类触发器
 *
 * 与 inbox_triage skill 集成，支持从园丁建议触发批量分类
 *
 * @module classification/batch-classification/triggers/gardener-trigger
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// ============================================
// 类型定义
// ============================================

export interface GardenerSuggestion {
  id: string;
  type: "batch_classification" | "folder_cleanup" | "duplicate_merge";
  title: string;
  description: string;
  bookmarkIds: number[];
  confidence: number;
  createdAt: Date;
  expiresAt: Date;
  status: "pending" | "accepted" | "dismissed";
}

export interface GardenerTriggerConfig {
  /** 每日最大推送建议数 */
  dailyMaxSuggestions: number;
  /** 最小置信度阈值 */
  minConfidence: number;
  /** 用户活跃时段 (小时) */
  userActiveHours: [number, number];
  /** 建议有效期 (小时) */
  suggestionTtlHours: number;
}

export const DEFAULT_GARDENER_TRIGGER_CONFIG: GardenerTriggerConfig = {
  dailyMaxSuggestions: 5,
  minConfidence: 0.7,
  userActiveHours: [9, 21],
  suggestionTtlHours: 72,
};

// ============================================
// 园丁触发服务
// ============================================

/**
 * 园丁建议触发服务
 *
 * 功能：
 * 1. 检测待分类书签
 * 2. 生成批量分类建议
 * 3. 分批推送到用户
 */
export class GardenerTriggerService {
  private supabase: SupabaseClient<Database>;
  private config: GardenerTriggerConfig;

  constructor(
    supabase: SupabaseClient<Database>,
    config: GardenerTriggerConfig = DEFAULT_GARDENER_TRIGGER_CONFIG,
  ) {
    this.supabase = supabase;
    this.config = config;
  }

  /**
   * 检查是否应该触发批量分类建议
   */
  async shouldTriggerBatchClassification(userId: string): Promise<{
    shouldTrigger: boolean;
    reason: string;
    bookmarkCount: number;
  }> {
    // 1. 检查今日已推送建议数
    const todaySuggestions = await this.getTodaySuggestionCount(userId);
    if (todaySuggestions >= this.config.dailyMaxSuggestions) {
      return {
        shouldTrigger: false,
        reason: "today_limit_reached",
        bookmarkCount: 0,
      };
    }

    // 2. 检查是否在活跃时段
    const currentHour = new Date().getHours();
    const [startHour, endHour] = this.config.userActiveHours;
    if (currentHour < startHour || currentHour > endHour) {
      return {
        shouldTrigger: false,
        reason: "outside_active_hours",
        bookmarkCount: 0,
      };
    }

    // 3. 检查待分类书签数量
    const pendingCount = await this.getPendingBookmarkCount(userId);
    if (pendingCount < 10) {
      return {
        shouldTrigger: false,
        reason: "insufficient_bookmarks",
        bookmarkCount: pendingCount,
      };
    }

    // 4. 检查是否有未处理的分类建议
    const hasPendingSuggestion =
      await this.hasPendingClassificationSuggestion(userId);
    if (hasPendingSuggestion) {
      return {
        shouldTrigger: false,
        reason: "pending_suggestion_exists",
        bookmarkCount: pendingCount,
      };
    }

    return {
      shouldTrigger: true,
      reason: "ready",
      bookmarkCount: pendingCount,
    };
  }

  /**
   * 创建批量分类建议
   */
  async createBatchClassificationSuggestion(
    userId: string,
    bookmarkIds: number[],
  ): Promise<GardenerSuggestion> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.config.suggestionTtlHours * 60 * 60 * 1000,
    );

    const suggestion: GardenerSuggestion = {
      id: crypto.randomUUID(),
      type: "batch_classification",
      title: "智能整理建议",
      description: `发现 ${bookmarkIds.length} 个未分类收藏，AI 可以帮您快速整理`,
      bookmarkIds,
      confidence: 0.8,
      createdAt: now,
      expiresAt,
      status: "pending",
    };

    // 存储建议（可以存入数据库或缓存）
    await this.storeSuggestion(userId, suggestion);

    return suggestion;
  }

  /**
   * 获取用户的待处理建议
   */
  async getPendingSuggestions(userId: string): Promise<GardenerSuggestion[]> {
    // 从通知系统获取待处理的批量分类建议
    const { data } = await this.supabase
      .from("user_notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("type_code", "batch_classification_suggestion")
      .is("read_at", null)
      .order("created_at", { ascending: false });

    if (!data) return [];

    return data.map((n) => ({
      id: n.id,
      type: "batch_classification" as const,
      title: n.title || "智能整理建议",
      description: n.body || "",
      bookmarkIds:
        (n.metadata as { bookmarkIds?: number[] })?.bookmarkIds || [],
      confidence: 0.8,
      createdAt: new Date(n.created_at!),
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      status: "pending" as const,
    }));
  }

  /**
   * 接受建议并启动批量分类
   */
  async acceptSuggestion(
    userId: string,
    suggestionId: string,
  ): Promise<{ transactionId: string }> {
    // 标记建议为已接受
    await this.supabase
      .from("user_notifications")
      .update({ read_at: new Date().toISOString(), status: "read" })
      .eq("id", suggestionId)
      .eq("user_id", userId);

    // 获取建议详情
    const suggestions = await this.getPendingSuggestions(userId);
    const suggestion = suggestions.find((s) => s.id === suggestionId);

    if (!suggestion) {
      throw new Error("Suggestion not found");
    }

    // 调用批量分类 API
    const response = await fetch("/api/batch-classification/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookmarkIds: suggestion.bookmarkIds,
        structureMode: "auto",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to start batch classification");
    }

    const { transactionId } = await response.json();
    return { transactionId };
  }

  /**
   * 忽略建议
   */
  async dismissSuggestion(userId: string, suggestionId: string): Promise<void> {
    await this.supabase
      .from("user_notifications")
      .update({ read_at: new Date().toISOString(), status: "archived" })
      .eq("id", suggestionId)
      .eq("user_id", userId);
  }

  // ============================================
  // 私有方法
  // ============================================

  private async getTodaySuggestionCount(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await this.supabase
      .from("user_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type_code", "batch_classification_suggestion")
      .gte("created_at", today.toISOString());

    return count || 0;
  }

  private async getPendingBookmarkCount(userId: string): Promise<number> {
    const { count } = await this.supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("folder_id", null)
      .eq("is_in_trash", false);

    return count || 0;
  }

  private async hasPendingClassificationSuggestion(
    userId: string,
  ): Promise<boolean> {
    const { count } = await this.supabase
      .from("user_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type_code", "batch_classification_suggestion")
      .is("read_at", null);

    return (count || 0) > 0;
  }

  private async storeSuggestion(
    userId: string,
    suggestion: GardenerSuggestion,
  ): Promise<void> {
    await this.supabase.from("user_notifications").insert({
      id: suggestion.id,
      user_id: userId,
      type_code: "batch_classification_suggestion",
      title: suggestion.title,
      body: suggestion.description,
      metadata: {
        bookmarkIds: suggestion.bookmarkIds,
        confidence: suggestion.confidence,
        expiresAt: suggestion.expiresAt.toISOString(),
      },
      status: "unread",
      priority: "normal",
      channels: ["in_app"],
    });
  }
}

// ============================================
// 导出单例
// ============================================

export function createGardenerTriggerService(
  supabase: SupabaseClient<Database>,
  config?: GardenerTriggerConfig,
): GardenerTriggerService {
  return new GardenerTriggerService(supabase, config);
}
