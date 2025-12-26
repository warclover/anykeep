/**
 * AI 偏好服务
 *
 * 管理用户 AI 偏好的持久化
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  AIPreferences,
  PreferencesUpdateRequest,
  ExplicitPreferences,
  ResponseStylePreference,
} from "./types";
import { DEFAULT_AI_PREFERENCES } from "./types";

// =============================================================================
// 常量
// =============================================================================

/** 偏好缓存 TTL（毫秒） */
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** 偏好缓存 */
const preferencesCache = new Map<
  string,
  { data: AIPreferences; expiry: number }
>();

// =============================================================================
// 偏好服务类
// =============================================================================

/**
 * AI 偏好服务
 *
 * 提供偏好的读取、更新和缓存管理
 */
export class PreferencesService {
  /**
   * 获取用户的 AI 偏好
   *
   * @param userId - 用户 ID
   * @param skipCache - 是否跳过缓存
   * @returns AI 偏好
   */
  async getPreferences(
    userId: string,
    skipCache = false,
  ): Promise<AIPreferences> {
    // 检查缓存
    if (!skipCache) {
      const cached = preferencesCache.get(userId);
      if (cached && cached.expiry > Date.now()) {
        return cached.data;
      }
    }

    try {
      const supabase = await createClient();

      // 使用 select("*") 并通过类型断言处理尚未迁移的字段
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        logger.warn(
          { userId, error: error.message },
          "PreferencesService: Failed to load preferences",
        );
        return DEFAULT_AI_PREFERENCES;
      }

      // 合并默认值（处理字段缺失）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const preferences = this.mergeWithDefaults((data as any)?.ai_preferences);

      // 更新缓存
      preferencesCache.set(userId, {
        data: preferences,
        expiry: Date.now() + CACHE_TTL,
      });

      return preferences;
    } catch (error) {
      logger.error(
        { userId, error },
        "PreferencesService: Exception loading preferences",
      );
      return DEFAULT_AI_PREFERENCES;
    }
  }

  /**
   * 更新用户的 AI 偏好
   *
   * @param userId - 用户 ID
   * @param updates - 更新内容
   * @returns 更新后的偏好
   */
  async updatePreferences(
    userId: string,
    updates: PreferencesUpdateRequest,
  ): Promise<AIPreferences> {
    try {
      const supabase = await createClient();

      // 获取当前偏好
      const current = await this.getPreferences(userId, true);

      // 合并更新
      const updated: AIPreferences = {
        ...current,
        responseStyle: updates.responseStyle ?? current.responseStyle,
        explicit: {
          ...current.explicit,
          ...updates.explicit,
        },
      };

      // 保存到数据库（使用类型断言处理尚未迁移的字段）
      const { error } = await supabase
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ ai_preferences: updated } as any)
        .eq("id", userId);

      if (error) {
        logger.error(
          { userId, error: error.message },
          "PreferencesService: Failed to update preferences",
        );
        throw new Error(`Failed to update preferences: ${error.message}`);
      }

      // 清除缓存
      this.invalidateCache(userId);

      logger.info(
        { userId, updates },
        "PreferencesService: Preferences updated",
      );

      return updated;
    } catch (error) {
      logger.error(
        { userId, error },
        "PreferencesService: Exception updating preferences",
      );
      throw error;
    }
  }

  /**
   * 更新响应风格
   */
  async updateResponseStyle(
    userId: string,
    style: ResponseStylePreference,
  ): Promise<void> {
    await this.updatePreferences(userId, { responseStyle: style });
  }

  /**
   * 更新显式设置
   */
  async updateExplicitSettings(
    userId: string,
    settings: Partial<ExplicitPreferences>,
  ): Promise<void> {
    await this.updatePreferences(userId, { explicit: settings });
  }

  /**
   * 启用/禁用成本节省模式
   */
  async setCostSavingMode(userId: string, enabled: boolean): Promise<void> {
    await this.updateExplicitSettings(userId, { costSavingMode: enabled });
  }

  /**
   * 启用/禁用确认跳过
   */
  async setSkipConfirmation(userId: string, skip: boolean): Promise<void> {
    await this.updateExplicitSettings(userId, { skipConfirmation: skip });
  }

  /**
   * 获取响应风格
   */
  async getResponseStyle(userId: string): Promise<ResponseStylePreference> {
    const prefs = await this.getPreferences(userId);
    return prefs.responseStyle;
  }

  /**
   * 检查是否启用成本节省模式
   */
  async isCostSavingMode(userId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);
    return prefs.explicit.costSavingMode ?? false;
  }

  /**
   * 获取默认列表数量
   */
  async getDefaultLimit(userId: string): Promise<number> {
    const prefs = await this.getPreferences(userId);
    return prefs.explicit.defaultLimit ?? 10;
  }

  /**
   * 清除用户偏好缓存
   */
  invalidateCache(userId: string): void {
    preferencesCache.delete(userId);
  }

  /**
   * 清除所有偏好缓存
   */
  clearAllCache(): void {
    preferencesCache.clear();
  }

  /**
   * 合并默认值
   */
  private mergeWithDefaults(raw: unknown): AIPreferences {
    if (!raw || typeof raw !== "object") {
      return DEFAULT_AI_PREFERENCES;
    }

    const data = raw as Partial<AIPreferences>;

    return {
      responseStyle: data.responseStyle ?? DEFAULT_AI_PREFERENCES.responseStyle,
      learned: {
        ...DEFAULT_AI_PREFERENCES.learned,
        ...(data.learned ?? {}),
      },
      explicit: {
        ...DEFAULT_AI_PREFERENCES.explicit,
        ...(data.explicit ?? {}),
      },
      version: data.version ?? DEFAULT_AI_PREFERENCES.version,
    };
  }
}

// =============================================================================
// 单例导出
// =============================================================================

/**
 * 全局偏好服务实例
 */
export const preferencesService = new PreferencesService();

/**
 * 便捷函数：获取偏好
 */
export async function getAIPreferences(userId: string): Promise<AIPreferences> {
  return preferencesService.getPreferences(userId);
}

/**
 * 便捷函数：更新偏好
 */
export async function updateAIPreferences(
  userId: string,
  updates: PreferencesUpdateRequest,
): Promise<AIPreferences> {
  return preferencesService.updatePreferences(userId, updates);
}
