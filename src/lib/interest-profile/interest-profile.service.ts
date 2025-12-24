/**
 * Interest Profile Service
 * 用户兴趣画像服务
 *
 * 核心设计原则：
 * 1. 零障碍 - 用户什么都不填也能工作
 * 2. 渐进式 - 随使用越来越精准
 * 3. 多来源 - 手动/导入/学习三种方式互补
 *
 * @module interest-profile
 * @since 2025-12-24
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  UserInterestProfile,
  InterestProfileInput,
  InterestKeyword,
  InterestSources,
  UserStage,
  BookmarkAnalysisResult,
  ProfileStats,
  LearnBehaviorResult,
} from "./types";
import { logger } from "@/lib/logger";

/**
 * 兴趣画像服务
 */
export class InterestProfileService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 获取或创建用户兴趣画像
   * 确保每个用户都有画像记录
   */
  async getOrCreateProfile(userId: string): Promise<UserInterestProfile> {
    try {
      const { data, error } = await this.supabase.rpc(
        "get_or_create_interest_profile",
        {
          p_user_id: userId,
        },
      );

      if (error) {
        logger.error(
          {
            userId,
            error: error.message,
            action: "get_or_create_profile_error",
          },
          "InterestProfile: Failed to get or create profile",
        );
        throw new Error(
          `Failed to get or create interest profile: ${error.message}`,
        );
      }

      return this.mapDbToProfile(data);
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
          action: "get_or_create_profile_exception",
        },
        "InterestProfile: Exception in getOrCreateProfile",
      );
      throw error;
    }
  }

  /**
   * 获取用户兴趣画像（不存在时返回 null）
   */
  async getProfile(userId: string): Promise<UserInterestProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from("user_interest_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Not found
          return null;
        }
        throw new Error(`Failed to get interest profile: ${error.message}`);
      }

      return this.mapDbToProfile(data);
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
          action: "get_profile_error",
        },
        "InterestProfile: Failed to get profile",
      );
      return null;
    }
  }

  /**
   * 初始化画像（注册/引导时调用）
   */
  async initializeProfile(
    userId: string,
    input: InterestProfileInput,
  ): Promise<UserInterestProfile> {
    try {
      const sources: InterestSources = {};
      let interests: InterestKeyword[] = [];

      // 解析手动描述
      if (input.manualDescription && input.manualDescription.trim()) {
        const parsed = this.parseManualDescription(input.manualDescription);
        sources.manual = {
          rawText: input.manualDescription,
          parsedAt: new Date(),
        };
        interests = parsed.keywords;
      }

      const { data, error } = await this.supabase
        .from("user_interest_profiles")
        .upsert(
          {
            user_id: userId,
            sources: sources,
            interests: interests,
            stage: "cold_start",
            confidence: interests.length > 0 ? 20 : 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        )
        .select()
        .single();

      if (error) {
        throw new Error(
          `Failed to initialize interest profile: ${error.message}`,
        );
      }

      logger.info(
        {
          userId,
          hasManualDescription: !!input.manualDescription,
          interestCount: interests.length,
          action: "profile_initialized",
        },
        "InterestProfile: Profile initialized",
      );

      return this.mapDbToProfile(data);
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
          action: "initialize_profile_error",
        },
        "InterestProfile: Failed to initialize profile",
      );
      throw error;
    }
  }

  /**
   * 分析导入书签并更新画像
   * 浏览器书签导入后触发
   */
  async analyzeImportedBookmarks(
    userId: string,
    importSource: string = "browser",
  ): Promise<BookmarkAnalysisResult> {
    try {
      const { data, error } = await this.supabase.rpc(
        "analyze_imported_bookmarks",
        {
          p_user_id: userId,
          p_import_source: importSource,
        },
      );

      if (error) {
        logger.error(
          {
            userId,
            importSource,
            error: error.message,
            action: "analyze_imported_error",
          },
          "InterestProfile: Failed to analyze imported bookmarks",
        );
        return {
          keywords: [],
          totalBookmarks: 0,
          validBookmarks: 0,
          suggestedFolders: [],
        };
      }

      const result = data as {
        success: boolean;
        bookmarkCount: number;
        keywordsExtracted: number;
        keywords: Array<{ keyword: string; count: number; weight: number }>;
      };

      if (!result.success) {
        logger.info(
          {
            userId,
            importSource,
            message: "No imported bookmarks",
            action: "analyze_imported_skip",
          },
          "InterestProfile: No imported bookmarks to analyze",
        );
        return {
          keywords: [],
          totalBookmarks: 0,
          validBookmarks: 0,
          suggestedFolders: [],
        };
      }

      logger.info(
        {
          userId,
          importSource,
          bookmarkCount: result.bookmarkCount,
          keywordsExtracted: result.keywordsExtracted,
          action: "imported_bookmarks_analyzed",
        },
        "InterestProfile: Imported bookmarks analyzed",
      );

      return {
        keywords: result.keywords || [],
        totalBookmarks: result.bookmarkCount,
        validBookmarks: result.keywordsExtracted,
        suggestedFolders: this.suggestFoldersFromKeywords(
          result.keywords || [],
        ),
      };
    } catch (error) {
      logger.error(
        {
          userId,
          importSource,
          error: error instanceof Error ? error.message : "Unknown error",
          action: "analyze_imported_exception",
        },
        "InterestProfile: Exception in analyzeImportedBookmarks",
      );
      return {
        keywords: [],
        totalBookmarks: 0,
        validBookmarks: 0,
        suggestedFolders: [],
      };
    }
  }

  /**
   * 从用户行为学习
   * 定期或用户操作后调用
   */
  async learnFromBehavior(userId: string): Promise<LearnBehaviorResult> {
    try {
      const { data, error } = await this.supabase.rpc(
        "learn_from_user_behavior",
        {
          p_user_id: userId,
        },
      );

      if (error) {
        logger.error(
          { userId, error: error.message, action: "learn_behavior_error" },
          "InterestProfile: Failed to learn from behavior",
        );
        return { success: false, learnedKeywords: 0, message: error.message };
      }

      const result = data as {
        success: boolean;
        bookmarkCount?: number;
        keywordsLearned?: number;
        message?: string;
      };

      if (!result.success) {
        logger.info(
          { userId, message: result.message, action: "learn_behavior_skip" },
          "InterestProfile: Not enough data for learning",
        );
        return {
          success: false,
          learnedKeywords: 0,
          message: result.message || "Not enough classified bookmarks",
        };
      }

      logger.info(
        {
          userId,
          bookmarkCount: result.bookmarkCount,
          keywordsLearned: result.keywordsLearned,
          action: "behavior_learned",
        },
        "InterestProfile: Learned from user behavior",
      );

      return {
        success: true,
        learnedKeywords: result.keywordsLearned || 0,
        message: "Successfully learned from behavior",
      };
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
          action: "learn_behavior_exception",
        },
        "InterestProfile: Exception in learnFromBehavior",
      );
      return {
        success: false,
        learnedKeywords: 0,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 更新手动描述
   */
  async updateManualDescription(
    userId: string,
    description: string,
  ): Promise<UserInterestProfile> {
    try {
      // 获取当前画像
      const profile = await this.getOrCreateProfile(userId);

      // 解析新描述
      const parsed = this.parseManualDescription(description);

      // 更新来源和兴趣
      const newSources: InterestSources = {
        ...profile.sources,
        manual: {
          rawText: description,
          parsedAt: new Date(),
        },
      };

      // 合并手动兴趣与现有兴趣（手动优先）
      const manualInterests = parsed.keywords;
      const otherInterests = profile.interests.filter(
        (i) => i.source !== "manual",
      );
      const mergedInterests = [...manualInterests, ...otherInterests];

      const { data, error } = await this.supabase
        .from("user_interest_profiles")
        .update({
          sources: newSources,
          interests: mergedInterests,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        throw new Error(
          `Failed to update manual description: ${error.message}`,
        );
      }

      logger.info(
        {
          userId,
          interestCount: manualInterests.length,
          action: "manual_description_updated",
        },
        "InterestProfile: Manual description updated",
      );

      return this.mapDbToProfile(data);
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
          action: "update_manual_error",
        },
        "InterestProfile: Failed to update manual description",
      );
      throw error;
    }
  }

  /**
   * 根据当前数据更新用户阶段
   */
  async updateStage(userId: string): Promise<UserStage> {
    try {
      const { data, error } = await this.supabase.rpc(
        "update_user_interest_stage",
        {
          p_user_id: userId,
        },
      );

      if (error) {
        logger.error(
          { userId, error: error.message, action: "update_stage_error" },
          "InterestProfile: Failed to update stage",
        );
        return "cold_start";
      }

      const newStage = data as UserStage;

      logger.debug(
        { userId, newStage, action: "stage_updated" },
        "InterestProfile: Stage updated",
      );

      return newStage;
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
          action: "update_stage_exception",
        },
        "InterestProfile: Exception in updateStage",
      );
      return "cold_start";
    }
  }

  /**
   * 获取画像统计信息
   */
  async getProfileStats(userId: string): Promise<ProfileStats> {
    const profile = await this.getOrCreateProfile(userId);

    return {
      stage: profile.stage,
      confidence: profile.confidence,
      interestCount: profile.interests.length,
      hasManual: !!profile.sources.manual,
      hasImported: !!profile.sources.imported,
      hasLearned: !!profile.sources.learned,
      importedBookmarkCount: profile.sources.imported?.bookmarkCount || 0,
      learnedBookmarkCount: profile.sources.learned?.bookmarkCount || 0,
    };
  }

  /**
   * 获取顶级兴趣（用于分类提示）
   */
  async getTopInterests(
    userId: string,
    limit: number = 10,
  ): Promise<InterestKeyword[]> {
    const profile = await this.getProfile(userId);

    if (!profile) {
      return [];
    }

    // 已按权重降序排列
    return profile.interests.slice(0, limit);
  }

  // ========== 私有辅助方法 ==========

  /**
   * 解析手动描述提取关键词
   * 简单实现 - 后续可增强 NLP
   */
  private parseManualDescription(description: string): {
    keywords: InterestKeyword[];
  } {
    // 按常见分隔符拆分
    const parts = description
      .split(/[,，、;；\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 20);

    // 创建关键词（权重递减）
    const keywords: InterestKeyword[] = parts
      .slice(0, 10)
      .map((keyword, index) => ({
        keyword,
        weight: Math.max(0.3, 1 - index * 0.1), // 1.0, 0.9, 0.8, ..., 0.3
        source: "manual" as const,
      }));

    return { keywords };
  }

  /**
   * 从关键词建议文件夹
   */
  private suggestFoldersFromKeywords(
    keywords: Array<{ keyword: string; count: number; weight: number }>,
  ): string[] {
    // 取顶级关键词作为文件夹建议
    return keywords
      .slice(0, 5)
      .map((k) => k.keyword)
      .filter((k) => k.length >= 2 && k.length <= 20);
  }

  /**
   * 数据库行映射到业务对象
   */
  private mapDbToProfile(data: {
    user_id: string;
    sources: InterestSources;
    interests: InterestKeyword[];
    stage: string;
    confidence: number;
    created_at: string;
    updated_at: string;
  }): UserInterestProfile {
    return {
      userId: data.user_id,
      sources: data.sources || {},
      interests: data.interests || [],
      stage: (data.stage as UserStage) || "cold_start",
      confidence: data.confidence || 0,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
