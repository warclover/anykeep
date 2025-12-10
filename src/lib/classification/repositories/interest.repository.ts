/**
 * Interest Repository
 * Data access layer for user interests
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CustomInterest,
  CustomInterestInput,
  UserInterestConfig,
  UserProfileSettings,
  PresetInterestId,
} from "../types";
import { CUSTOM_INTEREST_LIMITS } from "../constants";
import {
  CustomInterestRowSchema,
  parseRows,
  parseRow,
} from "./validation-schemas";

/**
 * Repository for interest-related operations
 */
export class InterestRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get user's custom interests
   */
  async getCustomInterests(userId: string): Promise<CustomInterest[]> {
    const { data, error } = await this.supabase
      .from("user_custom_interests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch custom interests: ${error.message}`);
    }

    // 运行时验证数据库返回结果
    const validatedRows = parseRows(
      CustomInterestRowSchema,
      data || [],
      "getCustomInterests",
    );

    return validatedRows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      icon: row.icon,
      keywords: row.keywords ?? [],
      suggestedFolders: row.suggested_folders ?? [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * Add a custom interest (atomic operation with limit check)
   * 使用 RPC 函数实现原子操作，解决 N+1 查询和竞态条件问题
   */
  async addCustomInterest(
    userId: string,
    input: CustomInterestInput,
  ): Promise<CustomInterest> {
    // 前端验证（快速失败，减少数据库压力）
    if (input.name.length > CUSTOM_INTEREST_LIMITS.MAX_NAME_LENGTH) {
      throw new Error(
        `Name must be at most ${CUSTOM_INTEREST_LIMITS.MAX_NAME_LENGTH} characters`,
      );
    }
    if (input.keywords.length > CUSTOM_INTEREST_LIMITS.MAX_KEYWORDS) {
      throw new Error(
        `Maximum ${CUSTOM_INTEREST_LIMITS.MAX_KEYWORDS} keywords allowed`,
      );
    }
    if (
      input.suggestedFolders.length >
      CUSTOM_INTEREST_LIMITS.MAX_SUGGESTED_FOLDERS
    ) {
      throw new Error(
        `Maximum ${CUSTOM_INTEREST_LIMITS.MAX_SUGGESTED_FOLDERS} suggested folders allowed`,
      );
    }

    // 使用原子操作 RPC 函数（单次数据库往返，解决 N+1 和竞态条件）
    const { data, error } = await this.supabase.rpc(
      "add_custom_interest_atomic",
      {
        p_user_id: userId,
        p_name: input.name,
        p_icon: input.icon,
        p_keywords: input.keywords,
        p_suggested_folders: input.suggestedFolders,
        p_max_count: CUSTOM_INTEREST_LIMITS.MAX_CUSTOM_INTERESTS,
      },
    );

    if (error) {
      throw new Error(`Failed to create custom interest: ${error.message}`);
    }

    // RPC 返回数组，取第一条记录
    const row = Array.isArray(data) ? data[0] : data;

    // 检查是否超限
    if (row?.error_code === "MAX_LIMIT_EXCEEDED") {
      throw new Error(
        `Maximum ${CUSTOM_INTEREST_LIMITS.MAX_CUSTOM_INTERESTS} custom interests allowed`,
      );
    }

    // 验证返回数据
    if (!row?.id) {
      throw new Error("Failed to create custom interest: no data returned");
    }

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      icon: row.icon,
      keywords: row.keywords || [],
      suggestedFolders: row.suggested_folders || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Update a custom interest
   */
  async updateCustomInterest(
    interestId: string,
    input: Partial<CustomInterestInput>,
  ): Promise<CustomInterest> {
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) {
      if (input.name.length > CUSTOM_INTEREST_LIMITS.MAX_NAME_LENGTH) {
        throw new Error(
          `Name must be at most ${CUSTOM_INTEREST_LIMITS.MAX_NAME_LENGTH} characters`,
        );
      }
      updateData.name = input.name;
    }
    if (input.icon !== undefined) {
      updateData.icon = input.icon;
    }
    if (input.keywords !== undefined) {
      if (input.keywords.length > CUSTOM_INTEREST_LIMITS.MAX_KEYWORDS) {
        throw new Error(
          `Maximum ${CUSTOM_INTEREST_LIMITS.MAX_KEYWORDS} keywords allowed`,
        );
      }
      updateData.keywords = input.keywords;
    }
    if (input.suggestedFolders !== undefined) {
      if (
        input.suggestedFolders.length >
        CUSTOM_INTEREST_LIMITS.MAX_SUGGESTED_FOLDERS
      ) {
        throw new Error(
          `Maximum ${CUSTOM_INTEREST_LIMITS.MAX_SUGGESTED_FOLDERS} suggested folders allowed`,
        );
      }
      updateData.suggested_folders = input.suggestedFolders;
    }

    const { data, error } = await this.supabase
      .from("user_custom_interests")
      .update(updateData)
      .eq("id", interestId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update custom interest: ${error.message}`);
    }

    // 运行时验证返回结果
    const validated = parseRow(
      CustomInterestRowSchema,
      data,
      "updateCustomInterest",
    );

    return {
      id: validated.id,
      userId: validated.user_id,
      name: validated.name,
      icon: validated.icon,
      keywords: validated.keywords ?? [],
      suggestedFolders: validated.suggested_folders ?? [],
      createdAt: new Date(validated.created_at),
      updatedAt: new Date(validated.updated_at),
    };
  }

  /**
   * Delete a custom interest
   */
  async deleteCustomInterest(interestId: string): Promise<void> {
    const { error } = await this.supabase
      .from("user_custom_interests")
      .delete()
      .eq("id", interestId);

    if (error) {
      throw new Error(`Failed to delete custom interest: ${error.message}`);
    }
  }

  /**
   * Get user's interest configuration from profile settings
   */
  async getUserInterestConfig(
    userId: string,
  ): Promise<UserInterestConfig | null> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    const settings = data?.settings as UserProfileSettings | null;
    return settings?.interest_config || null;
  }

  /**
   * Save user's preset interest selection
   */
  async setPresetInterests(
    userId: string,
    presetInterests: PresetInterestId[],
  ): Promise<void> {
    // Get current settings
    const { data: profile, error: fetchError } = await this.supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch profile: ${fetchError.message}`);
    }

    const currentSettings = (profile?.settings as UserProfileSettings) || {};
    const newSettings: UserProfileSettings = {
      ...currentSettings,
      interest_config: {
        presetInterests,
        customInterestIds:
          currentSettings.interest_config?.customInterestIds || [],
      },
    };

    const { error: updateError } = await this.supabase
      .from("profiles")
      .update({ settings: newSettings })
      .eq("id", userId);

    if (updateError) {
      throw new Error(
        `Failed to update preset interests: ${updateError.message}`,
      );
    }
  }

  /**
   * Mark onboarding as completed
   */
  async markOnboardingCompleted(userId: string): Promise<void> {
    const { data: profile, error: fetchError } = await this.supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch profile: ${fetchError.message}`);
    }

    const currentSettings = (profile?.settings as UserProfileSettings) || {};
    const newSettings: UserProfileSettings = {
      ...currentSettings,
      onboarding_completed_at: new Date().toISOString(),
    };

    const { error: updateError } = await this.supabase
      .from("profiles")
      .update({ settings: newSettings })
      .eq("id", userId);

    if (updateError) {
      throw new Error(
        `Failed to mark onboarding completed: ${updateError.message}`,
      );
    }
  }

  /**
   * Update last inbox organize timestamp
   */
  async updateLastInboxOrganizeAt(userId: string): Promise<void> {
    const { data: profile, error: fetchError } = await this.supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch profile: ${fetchError.message}`);
    }

    const currentSettings = (profile?.settings as UserProfileSettings) || {};
    const newSettings: UserProfileSettings = {
      ...currentSettings,
      last_inbox_organize_at: new Date().toISOString(),
    };

    const { error: updateError } = await this.supabase
      .from("profiles")
      .update({ settings: newSettings })
      .eq("id", userId);

    if (updateError) {
      throw new Error(
        `Failed to update last inbox organize: ${updateError.message}`,
      );
    }
  }
}
