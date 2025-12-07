/**
 * Interest Profile Service V2
 * Manages user interest profiles with progressive learning
 *
 * Core design principles:
 * 1. Zero barrier - Works even if user fills nothing
 * 2. Progressive - Gets more accurate with usage
 * 3. Multi-source - Manual/Imported/Learned complement each other
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  UserInterestProfile,
  InterestProfileInput,
  InterestKeyword,
  InterestSources,
  UserStage,
  BookmarkAnalysisResult,
} from "../types";
import { logger } from "@/lib/logger";

/**
 * Service for managing user interest profiles V2
 */
export class InterestProfileService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get or create user's interest profile
   * Ensures every user has a profile record
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
   * Get user's interest profile (returns null if not found)
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
   * Initialize profile with optional manual description
   * Called during registration or onboarding
   */
  async initializeProfile(
    userId: string,
    input: InterestProfileInput,
  ): Promise<UserInterestProfile> {
    try {
      const sources: InterestSources = {};
      let interests: InterestKeyword[] = [];

      // Parse manual description if provided
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
   * Analyze imported bookmarks and update profile
   * Triggered after browser bookmark import
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
   * Learn from user's bookmark organization behavior
   * Called periodically or after significant user actions
   */
  async learnFromBehavior(userId: string): Promise<{
    success: boolean;
    learnedKeywords: number;
    message: string;
  }> {
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
   * Update user's manual description
   */
  async updateManualDescription(
    userId: string,
    description: string,
  ): Promise<UserInterestProfile> {
    try {
      // Get current profile
      const profile = await this.getOrCreateProfile(userId);

      // Parse new description
      const parsed = this.parseManualDescription(description);

      // Update sources and interests
      const newSources: InterestSources = {
        ...profile.sources,
        manual: {
          rawText: description,
          parsedAt: new Date(),
        },
      };

      // Merge manual interests with existing (give priority to manual)
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
   * Update user's stage based on current data
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
   * Get profile statistics
   */
  async getProfileStats(userId: string): Promise<{
    stage: UserStage;
    confidence: number;
    interestCount: number;
    hasManual: boolean;
    hasImported: boolean;
    hasLearned: boolean;
    importedBookmarkCount: number;
    learnedBookmarkCount: number;
  }> {
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
   * Get top interests (for classification hint)
   */
  async getTopInterests(
    userId: string,
    limit: number = 10,
  ): Promise<InterestKeyword[]> {
    const profile = await this.getProfile(userId);

    if (!profile) {
      return [];
    }

    // Already sorted by weight in DB
    return profile.interests.slice(0, limit);
  }

  // ========== Private Helper Methods ==========

  /**
   * Parse manual description to extract keywords
   * Simple implementation - can be enhanced with NLP later
   */
  private parseManualDescription(description: string): {
    keywords: InterestKeyword[];
  } {
    // Split by common delimiters
    const parts = description
      .split(/[,，、;；\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 20);

    // Create keywords with decreasing weights
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
   * Suggest folders based on extracted keywords
   */
  private suggestFoldersFromKeywords(
    keywords: Array<{ keyword: string; count: number; weight: number }>,
  ): string[] {
    // Take top keywords as folder suggestions
    return keywords
      .slice(0, 5)
      .map((k) => k.keyword)
      .filter((k) => k.length >= 2 && k.length <= 20);
  }

  /**
   * Map database row to UserInterestProfile
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
