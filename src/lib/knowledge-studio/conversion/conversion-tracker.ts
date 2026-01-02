/**
 * Knowledge Studio - 转化追踪服务
 * @module knowledge-studio/conversion
 * @description P4 实现 - 用户试用期转化追踪
 * @version 1.0.0
 * @since 2026-01-02
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  IConversionTracker,
  UserTrialState,
  ConversionEvent,
  ConversionStage,
  UpgradePromptConfig,
  UpgradePromptType,
  TrialConfig,
} from "./types";
import { DEFAULT_TRIAL_CONFIG } from "./types";

// ============================================================================
// 数据库行类型
// ============================================================================

interface TrialStateRow {
  id: string;
  user_id: string;
  status: "active" | "expired" | "converted" | "cancelled";
  started_at: string;
  expires_at: string;
  generations_used: number;
  features_experienced: string[];
  conversion_stage: ConversionStage;
  last_active_at: string;
  converted_at: string | null;
  metadata: Record<string, unknown>;
}

interface UpgradePromptRow {
  id: string;
  user_id: string;
  prompt_type: UpgradePromptType;
  trigger_type: string;
  shown_at: string;
  cooldown_until: string | null;
  response: string | null;
}

// ============================================================================
// 类型转换工具
// ============================================================================

function rowToTrialState(row: TrialStateRow): UserTrialState {
  return {
    userId: row.user_id,
    status: row.status,
    startedAt: new Date(row.started_at),
    expiresAt: new Date(row.expires_at),
    generationsUsed: row.generations_used,
    featuresExperienced: row.features_experienced ?? [],
    conversionStage: row.conversion_stage,
    lastActiveAt: new Date(row.last_active_at),
    metadata: row.metadata,
  };
}

// ============================================================================
// 升级提示配置
// ============================================================================

const UPGRADE_PROMPTS: Record<string, UpgradePromptConfig> = {
  trial_ending_3days: {
    type: "banner",
    trigger: "trial_ending",
    title: "试用期即将结束",
    description: "您的 7 天免费试用还剩 3 天，立即升级享受完整功能",
    primaryCta: "立即升级",
    secondaryCta: "稍后再说",
    dismissible: true,
    cooldownHours: 24,
    priority: 60,
  },
  trial_ending_1day: {
    type: "modal",
    trigger: "trial_ending",
    title: "试用期明天到期",
    description: "升级 Pro 会员，解锁无限报告生成、AI 对话编辑等高级功能",
    primaryCta: "升级 Pro",
    secondaryCta: "查看功能对比",
    dismissible: true,
    cooldownHours: 12,
    priority: 80,
  },
  trial_expired: {
    type: "modal",
    trigger: "trial_expired",
    title: "试用期已结束",
    description: "感谢您的体验！现在升级可享 20% 首月优惠",
    primaryCta: "立即升级享优惠",
    secondaryCta: "继续使用免费版",
    dismissible: false,
    cooldownHours: 0,
    priority: 100,
  },
  quota_exhausted: {
    type: "modal",
    trigger: "quota_exhausted",
    title: "本月配额已用完",
    description: "升级 Pro 会员，享受无限制的报告生成服务",
    primaryCta: "升级 Pro",
    secondaryCta: "下月再说",
    dismissible: true,
    cooldownHours: 4,
    priority: 90,
  },
  feature_locked: {
    type: "tooltip",
    trigger: "feature_locked",
    title: "Pro 专属功能",
    description: "此功能仅限 Pro 会员使用，升级后即可解锁",
    primaryCta: "解锁功能",
    dismissible: true,
    cooldownHours: 2,
    priority: 50,
  },
};

// ============================================================================
// 转化追踪服务实现
// ============================================================================

/**
 * 转化追踪服务
 *
 * @example
 * ```typescript
 * const tracker = new ConversionTracker();
 *
 * // 开始试用
 * const trialState = await tracker.startTrial(userId);
 *
 * // 记录转化事件
 * await tracker.trackEvent({
 *   userId,
 *   trigger: "feature_locked",
 *   timestamp: new Date(),
 *   context: { featureId: "chat_to_edit" },
 * });
 *
 * // 检查是否显示升级提示
 * const prompt = await tracker.shouldShowUpgradePrompt(userId);
 * if (prompt) {
 *   // 显示升级提示
 * }
 * ```
 */
export class ConversionTracker implements IConversionTracker {
  private config: TrialConfig;

  constructor(config: TrialConfig = DEFAULT_TRIAL_CONFIG) {
    this.config = config;
  }

  /**
   * 获取用户试用状态
   */
  async getTrialState(userId: string): Promise<UserTrialState | null> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("ks_user_trial_states")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116" || error.code === "42P01") {
        return null; // 未找到或表不存在
      }
      logger.error({ error: error.message }, "Failed to get trial state");
      return null;
    }

    return rowToTrialState(data as TrialStateRow);
  }

  /**
   * 开始试用
   */
  async startTrial(userId: string): Promise<UserTrialState> {
    const supabase = await createClient();

    // 调用 RPC 函数 (表/RPC 尚未在生成的类型中)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("start_user_trial", {
      p_user_id: userId,
      p_duration_days: this.config.durationDays,
    });

    if (error) {
      logger.error({ error: error.message }, "Failed to start trial");

      // 如果 RPC 不存在，返回模拟状态
      if (error.code === "42883") {
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + this.config.durationDays);

        return {
          userId,
          status: "active",
          startedAt: now,
          expiresAt,
          generationsUsed: 0,
          featuresExperienced: [],
          conversionStage: "awareness",
          lastActiveAt: now,
        };
      }

      throw new Error(`开始试用失败: ${error.message}`);
    }

    logger.info(
      { userId, durationDays: this.config.durationDays },
      "Trial started",
    );

    // 解析 RPC 返回的 JSONB
    const result = data as {
      userId: string;
      status: string;
      startedAt: string;
      expiresAt: string;
      generationsUsed?: number;
      featuresExperienced?: string[];
      conversionStage: string;
      lastActiveAt: string;
    };

    return {
      userId: result.userId,
      status: result.status as UserTrialState["status"],
      startedAt: new Date(result.startedAt),
      expiresAt: new Date(result.expiresAt),
      generationsUsed: result.generationsUsed || 0,
      featuresExperienced: result.featuresExperienced || [],
      conversionStage: result.conversionStage as ConversionStage,
      lastActiveAt: new Date(result.lastActiveAt),
    };
  }

  /**
   * 记录转化事件
   */
  async trackEvent(event: Omit<ConversionEvent, "id">): Promise<void> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("ks_conversion_events")
      .insert({
        user_id: event.userId,
        trigger_type: event.trigger,
        source_page: event.context.sourcePage,
        feature_id: event.context.featureId,
        remaining_days: event.context.remainingDays,
        remaining_quota: event.context.remainingQuota,
        user_response: event.userResponse,
        responded_at: event.userResponse ? new Date().toISOString() : null,
      });

    if (error) {
      // 表不存在时仅记录日志
      if (error.code === "42P01") {
        logger.warn({ event }, "Conversion events table not found, skipping");
        return;
      }
      logger.error(
        { error: error.message },
        "Failed to track conversion event",
      );
      return;
    }

    logger.info(
      { userId: event.userId, trigger: event.trigger },
      "Conversion event tracked",
    );
  }

  /**
   * 更新转化阶段
   */
  async updateStage(userId: string, stage: ConversionStage): Promise<void> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("ks_user_trial_states")
      .update({
        conversion_stage: stage,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      if (error.code === "42P01") {
        logger.warn(
          { userId, stage },
          "Trial states table not found, skipping",
        );
        return;
      }
      logger.error(
        { error: error.message },
        "Failed to update conversion stage",
      );
      return;
    }

    logger.info({ userId, stage }, "Conversion stage updated");
  }

  /**
   * 检查是否应显示升级提示
   */
  async shouldShowUpgradePrompt(
    userId: string,
  ): Promise<UpgradePromptConfig | null> {
    const supabase = await createClient();

    // 获取试用状态
    const trialState = await this.getTrialState(userId);
    if (!trialState) {
      return null;
    }

    // 计算剩余天数
    const now = new Date();
    const remainingDays = Math.ceil(
      (trialState.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    // 确定提示类型
    let promptKey: string | null = null;

    if (trialState.status === "expired") {
      promptKey = "trial_expired";
    } else if (remainingDays <= 1) {
      promptKey = "trial_ending_1day";
    } else if (remainingDays <= 3) {
      promptKey = "trial_ending_3days";
    }

    if (!promptKey) {
      return null;
    }

    const promptConfig = UPGRADE_PROMPTS[promptKey];
    if (!promptConfig) {
      return null;
    }

    // 检查冷却时间
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentPrompts } = await (supabase as any)
      .from("ks_upgrade_prompts")
      .select("*")
      .eq("user_id", userId)
      .eq("prompt_type", promptConfig.type)
      .order("shown_at", { ascending: false })
      .limit(1);

    if (recentPrompts && recentPrompts.length > 0) {
      const lastPrompt = recentPrompts[0] as UpgradePromptRow;
      if (
        lastPrompt.cooldown_until &&
        new Date(lastPrompt.cooldown_until) > now
      ) {
        return null; // 仍在冷却期
      }
    }

    // 记录提示显示
    const cooldownUntil = new Date();
    cooldownUntil.setHours(
      cooldownUntil.getHours() + promptConfig.cooldownHours,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("ks_upgrade_prompts").insert({
      user_id: userId,
      prompt_type: promptConfig.type,
      trigger_type: promptConfig.trigger,
      shown_at: now.toISOString(),
      cooldown_until: cooldownUntil.toISOString(),
    });

    return promptConfig;
  }

  /**
   * 记录提示响应
   */
  async recordPromptResponse(
    userId: string,
    promptType: UpgradePromptType,
    response: ConversionEvent["userResponse"],
  ): Promise<void> {
    const supabase = await createClient();

    // 更新最近的提示记录
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("ks_upgrade_prompts")
      .update({
        response,
        responded_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("prompt_type", promptType)
      .is("response", null)
      .order("shown_at", { ascending: false })
      .limit(1);

    if (error) {
      if (error.code === "42P01") {
        logger.warn(
          { userId, promptType, response },
          "Upgrade prompts table not found",
        );
        return;
      }
      logger.error(
        { error: error.message },
        "Failed to record prompt response",
      );
      return;
    }

    // 如果用户点击了升级，记录转化事件
    if (response === "clicked" || response === "converted") {
      await this.trackEvent({
        userId,
        trigger: "manual_upgrade",
        timestamp: new Date(),
        context: {},
        userResponse: response,
      });
    }

    logger.info({ userId, promptType, response }, "Prompt response recorded");
  }

  /**
   * 更新最后活跃时间
   */
  async updateLastActive(userId: string): Promise<void> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("ks_user_trial_states")
      .update({
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }

  /**
   * 记录功能体验
   */
  async recordFeatureExperience(
    userId: string,
    featureId: string,
  ): Promise<void> {
    const supabase = await createClient();

    // 获取当前状态
    const trialState = await this.getTrialState(userId);
    if (!trialState) return;

    // 检查是否已体验
    if (trialState.featuresExperienced.includes(featureId)) return;

    // 更新体验列表
    const newFeatures = [...trialState.featuresExperienced, featureId];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("ks_user_trial_states")
      .update({
        features_experienced: newFeatures,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    // 如果首次使用功能，更新阶段为 activation
    if (trialState.conversionStage === "awareness") {
      await this.updateStage(userId, "activation");
    }

    logger.info({ userId, featureId }, "Feature experience recorded");
  }

  /**
   * 增加生成次数
   */
  async incrementGenerations(userId: string): Promise<void> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("increment", {
      table_name: "ks_user_trial_states",
      row_id: userId,
      column_name: "generations_used",
    });

    if (error) {
      // 如果 RPC 不存在，使用直接更新
      if (error.code === "42883") {
        const trialState = await this.getTrialState(userId);
        if (trialState) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("ks_user_trial_states")
            .update({
              generations_used: trialState.generationsUsed + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        }
        return;
      }
      logger.error({ error: error.message }, "Failed to increment generations");
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建转化追踪器实例
 */
export function createConversionTracker(
  config?: Partial<TrialConfig>,
): IConversionTracker {
  const mergedConfig: TrialConfig = {
    ...DEFAULT_TRIAL_CONFIG,
    ...config,
  };
  return new ConversionTracker(mergedConfig);
}

// 保留旧名称以兼容
export { ConversionTracker as ConversionTrackerStub };

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 计算试用剩余天数
 */
export function calculateRemainingDays(expiresAt: Date): number {
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * 判断试用是否即将过期
 */
export function isTrialExpiring(
  expiresAt: Date,
  thresholdDays: number = 3,
): boolean {
  return calculateRemainingDays(expiresAt) <= thresholdDays;
}

/**
 * 判断试用是否已过期
 */
export function isTrialExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * 获取下一个提醒时间点
 */
export function getNextReminderDay(
  remainingDays: number,
  reminderDays: number[] = DEFAULT_TRIAL_CONFIG.reminderDays,
): number | null {
  const sorted = [...reminderDays].sort((a, b) => b - a);
  for (const day of sorted) {
    if (remainingDays > day) {
      return day;
    }
  }
  return null;
}
