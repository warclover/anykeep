/**
 * V4.0 用户场景检测服务
 *
 * 核心概念：根据用户数据量和反馈行为自动识别使用场景
 *
 * 场景定义：
 * - cold_start: 新用户/低数据量（书签 < 50, 文件夹 < 5）
 *   - 权重侧重通用分类和向量匹配
 *   - AI 介入频率较高
 *
 * - learning: 学习期用户（书签 50-200, 有反馈记录）
 *   - 权重开始侧重历史行为
 *   - 反馈驱动的权重调整
 *
 * - mature: 成熟用户（书签 > 200, 反馈采纳率 > 90%）
 *   - 权重侧重历史行为和指纹匹配
 *   - 减少 AI 调用
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 用户场景类型
 */
export type UserScenario = "cold_start" | "learning" | "mature";

/**
 * 场景检测结果
 */
export interface ScenarioDetectionResult {
  /** 当前场景 */
  scenario: UserScenario;

  /** 用户统计数据 */
  stats: UserStats;

  /** 场景判断理由 */
  reason: string;

  /** 检测时间 */
  detectedAt: Date;

  /** 置信度 (0-100) - 场景判断的确定性 */
  confidence: number;
}

/**
 * 用户统计数据
 */
export interface UserStats {
  /** 书签数量 */
  bookmarkCount: number;

  /** 文件夹数量 */
  folderCount: number;

  /** 反馈记录数 */
  feedbackCount: number;

  /** 反馈采纳率 (0-100) */
  feedbackAcceptanceRate: number;

  /** 账户创建天数 */
  accountAgeDays: number;

  /** 最近 30 天新增书签数 */
  recentBookmarkCount: number;

  /** 有画像的文件夹数 */
  foldersWithProfile: number;
}

/**
 * 场景阈值配置
 */
export interface ScenarioThresholds {
  /** cold_start 书签数上限 */
  coldStartBookmarkMax: number;

  /** cold_start 文件夹数上限 */
  coldStartFolderMax: number;

  /** learning 书签数上限 (超过则为 mature) */
  learningBookmarkMax: number;

  /** mature 需要的最低反馈采纳率 */
  matureAcceptanceRateMin: number;

  /** 最小反馈数量（用于计算采纳率） */
  minFeedbackForRateCalculation: number;
}

const DEFAULT_THRESHOLDS: ScenarioThresholds = {
  coldStartBookmarkMax: 50,
  coldStartFolderMax: 5,
  learningBookmarkMax: 200,
  matureAcceptanceRateMin: 90,
  minFeedbackForRateCalculation: 10,
};

/**
 * 服务配置
 */
export interface UserScenarioDetectorConfig {
  /** 场景阈值 */
  thresholds: ScenarioThresholds;

  /** 缓存时间（毫秒） */
  cacheTimeMs: number;
}

const DEFAULT_CONFIG: UserScenarioDetectorConfig = {
  thresholds: DEFAULT_THRESHOLDS,
  cacheTimeMs: 5 * 60 * 1000, // 5 分钟
};

// ============================================================================
// 缓存
// ============================================================================

interface CacheEntry {
  result: ScenarioDetectionResult;
  cachedAt: number;
}

const scenarioCache = new Map<string, CacheEntry>();

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 用户场景检测服务
 */
export class UserScenarioDetectorService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: SupabaseClient<any>;
  private config: UserScenarioDetectorConfig;

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<UserScenarioDetectorConfig>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.supabase = supabase as SupabaseClient<any>;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      thresholds: {
        ...DEFAULT_THRESHOLDS,
        ...config?.thresholds,
      },
    };
  }

  /**
   * 检测用户场景
   */
  async detectScenario(userId: string): Promise<ScenarioDetectionResult> {
    // 检查缓存
    const cached = scenarioCache.get(userId);
    if (cached && Date.now() - cached.cachedAt < this.config.cacheTimeMs) {
      return cached.result;
    }

    try {
      // 获取用户统计数据
      const stats = await this.getUserStats(userId);

      // 判断场景
      const result = this.determineScenario(stats);

      // 缓存结果
      this.cacheResult(userId, result);

      logger.info(
        {
          userId,
          scenario: result.scenario,
          stats,
          confidence: result.confidence,
        },
        "User scenario detected",
      );

      return result;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to detect user scenario",
      );

      // 出错时返回 cold_start 作为安全默认值
      return {
        scenario: "cold_start",
        stats: {
          bookmarkCount: 0,
          folderCount: 0,
          feedbackCount: 0,
          feedbackAcceptanceRate: 0,
          accountAgeDays: 0,
          recentBookmarkCount: 0,
          foldersWithProfile: 0,
        },
        reason: "检测失败，使用默认场景",
        detectedAt: new Date(),
        confidence: 0,
      };
    }
  }

  /**
   * 获取用户统计数据
   */
  private async getUserStats(userId: string): Promise<UserStats> {
    // 并行查询多个统计数据
    const [
      bookmarkCountResult,
      folderCountResult,
      feedbackResult,
      profileResult,
      recentBookmarksResult,
    ] = await Promise.all([
      // 书签数量
      this.supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null),

      // 文件夹数量
      this.supabase
        .from("folders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null),

      // 反馈记录（包含 user_action）
      this.supabase
        .from("classification_decisions")
        .select("user_action")
        .eq("user_id", userId)
        .not("user_action", "is", null)
        .limit(500),

      // 有画像的文件夹数
      this.supabase
        .from("folder_profiles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),

      // 最近 30 天新增书签数
      this.supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null)
        .gte(
          "created_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        ),
    ]);

    // 计算反馈采纳率
    const feedbackData = feedbackResult.data || [];
    const feedbackCount = feedbackData.length;
    const acceptedCount = feedbackData.filter(
      (f) => f.user_action === "accepted",
    ).length;
    const feedbackAcceptanceRate =
      feedbackCount >= this.config.thresholds.minFeedbackForRateCalculation
        ? Math.round((acceptedCount / feedbackCount) * 100)
        : 0;

    // 获取用户注册时间（从 profiles 表）
    const { data: profile } = await this.supabase
      .from("profiles")
      .select("created_at")
      .eq("id", userId)
      .single();

    const accountAgeDays = profile?.created_at
      ? Math.floor(
          (Date.now() - new Date(profile.created_at).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    return {
      bookmarkCount: bookmarkCountResult.count || 0,
      folderCount: folderCountResult.count || 0,
      feedbackCount,
      feedbackAcceptanceRate,
      accountAgeDays,
      recentBookmarkCount: recentBookmarksResult.count || 0,
      foldersWithProfile: profileResult.count || 0,
    };
  }

  /**
   * 判断用户场景
   */
  private determineScenario(stats: UserStats): ScenarioDetectionResult {
    const { thresholds } = this.config;

    // 场景 1: cold_start
    // 书签 < 50 且 文件夹 < 5
    if (
      stats.bookmarkCount < thresholds.coldStartBookmarkMax &&
      stats.folderCount < thresholds.coldStartFolderMax
    ) {
      return {
        scenario: "cold_start",
        stats,
        reason: `新用户：书签数 ${stats.bookmarkCount} < ${thresholds.coldStartBookmarkMax}，文件夹数 ${stats.folderCount} < ${thresholds.coldStartFolderMax}`,
        detectedAt: new Date(),
        confidence: this.calculateConfidence(stats, "cold_start"),
      };
    }

    // 场景 2: mature
    // 书签 > 200 且 反馈采纳率 > 90%
    if (
      stats.bookmarkCount > thresholds.learningBookmarkMax &&
      stats.feedbackAcceptanceRate >= thresholds.matureAcceptanceRateMin
    ) {
      return {
        scenario: "mature",
        stats,
        reason: `成熟用户：书签数 ${stats.bookmarkCount} > ${thresholds.learningBookmarkMax}，采纳率 ${stats.feedbackAcceptanceRate}% >= ${thresholds.matureAcceptanceRateMin}%`,
        detectedAt: new Date(),
        confidence: this.calculateConfidence(stats, "mature"),
      };
    }

    // 场景 3: learning (默认)
    // 书签 50-200 或 数据量大但采纳率不够高
    return {
      scenario: "learning",
      stats,
      reason: this.getLearningReason(stats, thresholds),
      detectedAt: new Date(),
      confidence: this.calculateConfidence(stats, "learning"),
    };
  }

  /**
   * 生成 learning 场景的判断理由
   */
  private getLearningReason(
    stats: UserStats,
    thresholds: ScenarioThresholds,
  ): string {
    const reasons: string[] = [];

    if (stats.bookmarkCount >= thresholds.coldStartBookmarkMax) {
      reasons.push(
        `书签数 ${stats.bookmarkCount} >= ${thresholds.coldStartBookmarkMax}`,
      );
    }

    if (stats.folderCount >= thresholds.coldStartFolderMax) {
      reasons.push(
        `文件夹数 ${stats.folderCount} >= ${thresholds.coldStartFolderMax}`,
      );
    }

    if (stats.feedbackCount > 0) {
      reasons.push(`有 ${stats.feedbackCount} 条反馈记录`);
    }

    if (
      stats.bookmarkCount > thresholds.learningBookmarkMax &&
      stats.feedbackAcceptanceRate < thresholds.matureAcceptanceRateMin
    ) {
      reasons.push(
        `采纳率 ${stats.feedbackAcceptanceRate}% < ${thresholds.matureAcceptanceRateMin}%（未达 mature）`,
      );
    }

    return `学习期用户：${reasons.join("，")}`;
  }

  /**
   * 计算场景判断置信度
   */
  private calculateConfidence(
    stats: UserStats,
    scenario: UserScenario,
  ): number {
    const { thresholds } = this.config;

    switch (scenario) {
      case "cold_start": {
        // 越接近阈值下限，置信度越高
        const bookmarkRatio =
          1 - stats.bookmarkCount / thresholds.coldStartBookmarkMax;
        const folderRatio =
          1 - stats.folderCount / thresholds.coldStartFolderMax;
        return Math.round(((bookmarkRatio + folderRatio) / 2) * 100);
      }

      case "mature": {
        // 书签数和采纳率越高，置信度越高
        const bookmarkScore = Math.min(
          1,
          stats.bookmarkCount / (thresholds.learningBookmarkMax * 2),
        );
        const acceptanceScore = stats.feedbackAcceptanceRate / 100;
        return Math.round(((bookmarkScore + acceptanceScore) / 2) * 100);
      }

      case "learning": {
        // 中间状态，基于数据量计算
        const dataScore =
          (stats.bookmarkCount + stats.folderCount * 10) /
          (thresholds.learningBookmarkMax + thresholds.coldStartFolderMax * 10);
        return Math.round(Math.min(0.8, dataScore) * 100);
      }
    }
  }

  /**
   * 缓存结果
   */
  private cacheResult(userId: string, result: ScenarioDetectionResult): void {
    scenarioCache.set(userId, {
      result,
      cachedAt: Date.now(),
    });
  }

  /**
   * 清除用户缓存
   */
  static clearCache(userId: string): void {
    scenarioCache.delete(userId);
  }

  /**
   * 清除所有缓存
   */
  static clearAllCache(): void {
    scenarioCache.clear();
  }

  /**
   * 获取场景的中文描述
   */
  static getScenarioLabel(scenario: UserScenario): string {
    const labels: Record<UserScenario, string> = {
      cold_start: "新手期",
      learning: "学习期",
      mature: "成熟期",
    };
    return labels[scenario];
  }

  /**
   * 获取场景的详细描述
   */
  static getScenarioDescription(scenario: UserScenario): string {
    const descriptions: Record<UserScenario, string> = {
      cold_start:
        "数据较少，系统侧重通用分类匹配，AI 介入较多以快速学习您的偏好",
      learning: "有一定数据积累，系统开始学习您的分类习惯，准确率逐步提升",
      mature: "数据丰富，系统已充分学习您的偏好，分类准确率最高，AI 调用最少",
    };
    return descriptions[scenario];
  }
}

/**
 * 工厂函数
 */
export function createUserScenarioDetectorService(
  supabase: SupabaseClient<Database>,
  config?: Partial<UserScenarioDetectorConfig>,
): UserScenarioDetectorService {
  return new UserScenarioDetectorService(supabase, config);
}
