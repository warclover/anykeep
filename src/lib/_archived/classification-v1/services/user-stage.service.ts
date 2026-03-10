/**
 * User Stage Service
 * Manages user classification lifecycle stages
 *
 * V2 Enhancement: Integrates with Interest Profile for smarter stage detection
 * - Considers imported bookmark count for faster cold start exit
 * - Uses interest profile confidence for stage determination
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassificationStage, UserStage } from "../types";
import type { IUserStageService } from "./interfaces";
import { USER_LIFECYCLE_THRESHOLDS } from "../constants";
import { logger } from "@/lib/logger";

/** Threshold for imported bookmarks to accelerate cold start exit */
const IMPORT_ACCELERATE_THRESHOLD = 50;

/** V4.2.5: 冷启动缓存 TTL (毫秒) - 用户状态在短期内不会变化 */
const COLD_START_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

/** V4.2.5: 冷启动缓存条目 */
interface ColdStartCacheEntry {
  value: boolean;
  expiry: number;
}

/**
 * Service for determining and managing user classification stages
 */
export class UserStageService implements IUserStageService {
  /** V4.2.5: 冷启动状态缓存，减少重复数据库查询 */
  private coldStartCache: Map<string, ColdStartCacheEntry> = new Map();

  constructor(private supabase: SupabaseClient) {}

  /**
   * Get user's classification stage
   * V2: Uses updated database function that considers imported bookmarks
   */
  async getStage(userId: string): Promise<ClassificationStage> {
    try {
      const { data, error } = await this.supabase.rpc(
        "get_user_classification_stage",
        {
          p_user_id: userId,
        },
      );

      if (error) {
        logger.error(
          { userId, error: error.message, action: "get_stage_error" },
          "UserStage: Failed to get stage from DB, using fallback",
        );
        // Fallback to manual calculation
        return await this.calculateStageFallback(userId);
      }

      return (data as ClassificationStage) || "onboarding";
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
          action: "get_stage_exception",
        },
        "UserStage: Exception in getStage",
      );
      return "cold_start"; // Safe default
    }
  }

  /**
   * Check if user is in cold start phase
   * V2: Also considers interest profile data
   * V4.2.5: 添加短期缓存，减少重复数据库查询
   */
  async isInColdStart(userId: string): Promise<boolean> {
    // V4.2.5: 检查缓存
    const cached = this.coldStartCache.get(userId);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    const stage = await this.getStage(userId);

    // Basic check
    if (stage !== "onboarding" && stage !== "cold_start") {
      this.setColdStartCache(userId, false);
      return false;
    }

    // V2: Check if user has imported bookmarks that can accelerate cold start exit
    try {
      const { data: profile } = await this.supabase
        .from("user_interest_profiles")
        .select("sources, confidence")
        .eq("user_id", userId)
        .single();

      if (profile) {
        const importedCount =
          (profile.sources as { imported?: { bookmarkCount: number } })
            ?.imported?.bookmarkCount || 0;

        // If user has enough imported bookmarks with decent confidence, skip cold start
        if (
          importedCount >= IMPORT_ACCELERATE_THRESHOLD &&
          profile.confidence >= 30
        ) {
          logger.info(
            {
              userId,
              importedCount,
              confidence: profile.confidence,
              action: "cold_start_accelerated",
            },
            "UserStage: Cold start accelerated due to imported bookmarks",
          );
          this.setColdStartCache(userId, false);
          return false;
        }
      }
    } catch (error) {
      // Ignore errors - just use basic check
      logger.debug(
        { userId, error: error instanceof Error ? error.message : "Unknown" },
        "UserStage: Could not check interest profile for cold start",
      );
    }

    this.setColdStartCache(userId, true);
    return true;
  }

  /**
   * V4.2.5: 设置冷启动缓存
   */
  private setColdStartCache(userId: string, value: boolean): void {
    this.coldStartCache.set(userId, {
      value,
      expiry: Date.now() + COLD_START_CACHE_TTL,
    });

    // 清理过期缓存（简单策略：缓存超过 100 条时清理）
    if (this.coldStartCache.size > 100) {
      const now = Date.now();
      for (const [key, entry] of this.coldStartCache.entries()) {
        if (entry.expiry <= now) {
          this.coldStartCache.delete(key);
        }
      }
    }
  }

  /**
   * V4.2.5: 清除用户的冷启动缓存（当用户状态变化时调用）
   */
  invalidateColdStartCache(userId: string): void {
    this.coldStartCache.delete(userId);
  }

  /**
   * Get stage from bookmark count (client-side calculation)
   * V2: Added optional importedCount for acceleration
   */
  getStageFromCount(
    bookmarkCount: number,
    onboardingCompleted: boolean,
    importedCount?: number,
  ): ClassificationStage {
    if (!onboardingCompleted && bookmarkCount === 0) {
      return "onboarding";
    }

    // V2: Imported bookmarks can accelerate cold start exit
    if (bookmarkCount <= USER_LIFECYCLE_THRESHOLDS.COLD_START_MAX) {
      if (importedCount && importedCount >= IMPORT_ACCELERATE_THRESHOLD) {
        return "growing"; // Skip cold start due to imported data
      }
      return "cold_start";
    }

    if (bookmarkCount <= USER_LIFECYCLE_THRESHOLDS.GROWING_MAX) {
      return "growing";
    }

    return "mature";
  }

  /**
   * Get interest profile stage (V2)
   */
  async getInterestProfileStage(userId: string): Promise<UserStage | null> {
    try {
      const { data } = await this.supabase
        .from("user_interest_profiles")
        .select("stage")
        .eq("user_id", userId)
        .single();

      return data?.stage as UserStage | null;
    } catch {
      return null;
    }
  }

  /**
   * Fallback stage calculation when DB function fails
   */
  private async calculateStageFallback(
    userId: string,
  ): Promise<ClassificationStage> {
    try {
      // Get bookmark count
      const { count: bookmarkCount } = await this.supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null)
        .not("platform", "in", "(chrome,edge,firefox,safari,browser)");

      // Get profile settings
      const { data: profile } = await this.supabase
        .from("profiles")
        .select("settings")
        .eq("id", userId)
        .single();

      const onboardingCompleted = !!(
        profile?.settings as { onboarding_completed_at?: string }
      )?.onboarding_completed_at;

      return this.getStageFromCount(bookmarkCount || 0, onboardingCompleted);
    } catch {
      return "cold_start"; // Safe default
    }
  }

  /**
   * Get stage description for UI
   */
  getStageDescription(stage: ClassificationStage): {
    title: string;
    description: string;
    tip: string;
  } {
    switch (stage) {
      case "onboarding":
        return {
          title: "新手入门",
          description:
            "欢迎使用 AnyKeep！选择你的兴趣领域，让我们帮你创建初始文件夹。",
          tip: "选择 2-5 个兴趣领域可以获得最佳体验",
        };
      case "cold_start":
        return {
          title: "冷启动期",
          description:
            "继续收藏内容，系统正在学习你的偏好。目前书签将放入「待整理」文件夹。",
          tip: "收藏超过 20 条后，系统将开始智能分类",
        };
      case "growing":
        return {
          title: "成长期",
          description: "系统已开始学习你的分类偏好，高置信度的书签将自动分类。",
          tip: "定期整理「待整理」文件夹可以帮助系统更好地学习",
        };
      case "mature":
        return {
          title: "成熟期",
          description: "系统已充分了解你的偏好，大部分书签将自动准确分类。",
          tip: "你可以手动调整分类来进一步优化推荐",
        };
    }
  }
}
