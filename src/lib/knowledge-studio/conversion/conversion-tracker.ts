/**
import { logger } from "@/lib/logger";
 * Knowledge Studio - 转化追踪服务
 * @module knowledge-studio/conversion
 * @description Phase 3 存根 - 用户试用期转化追踪
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
 *
 * TODO Phase 3: 完整实现
 * - Supabase 数据持久化
 * - 实时状态同步
 * - 事件队列处理
 * - 冷却时间管理
 */

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
// 存根实现
// ============================================================================

/**
 * 转化追踪服务（Phase 3 存根）
 *
 * @example
 * ```typescript
 * const tracker = new ConversionTrackerStub();
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
export class ConversionTrackerStub implements IConversionTracker {
  private config: TrialConfig;

  constructor(config: TrialConfig = DEFAULT_TRIAL_CONFIG) {
    this.config = config;
  }

  /**
   * 获取用户试用状态
   * @stub 返回 null，Phase 3 实现数据库查询
   */
  async getTrialState(userId: string): Promise<UserTrialState | null> {
    logger.info(
      `[ConversionTracker] getTrialState(${userId}) - Phase 3 存根，返回 null`,
    );
    return null;
  }

  /**
   * 开始试用
   * @stub 返回模拟状态，Phase 3 实现数据库写入
   */
  async startTrial(userId: string): Promise<UserTrialState> {
    logger.info(
      `[ConversionTracker] startTrial(${userId}) - Phase 3 存根，返回模拟状态`,
    );

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

  /**
   * 记录转化事件
   * @stub 仅打印日志，Phase 3 实现事件持久化
   */
  async trackEvent(event: Omit<ConversionEvent, "id">): Promise<void> {
    logger.info(
      `[ConversionTracker] trackEvent - Phase 3 存根`,
      JSON.stringify(event, null, 2),
    );
  }

  /**
   * 更新转化阶段
   * @stub 仅打印日志，Phase 3 实现状态更新
   */
  async updateStage(userId: string, stage: ConversionStage): Promise<void> {
    logger.info(
      `[ConversionTracker] updateStage(${userId}, ${stage}) - Phase 3 存根`,
    );
  }

  /**
   * 检查是否应显示升级提示
   * @stub 返回 null，Phase 3 实现规则引擎
   */
  async shouldShowUpgradePrompt(
    userId: string,
  ): Promise<UpgradePromptConfig | null> {
    logger.info(
      `[ConversionTracker] shouldShowUpgradePrompt(${userId}) - Phase 3 存根，返回 null`,
    );
    return null;
  }

  /**
   * 记录提示响应
   * @stub 仅打印日志，Phase 3 实现响应追踪
   */
  async recordPromptResponse(
    userId: string,
    promptType: UpgradePromptType,
    response: ConversionEvent["userResponse"],
  ): Promise<void> {
    logger.info(
      `[ConversionTracker] recordPromptResponse(${userId}, ${promptType}, ${response}) - Phase 3 存根`,
    );
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建转化追踪器实例
 * @stub Phase 3 实现完整服务
 */
export function createConversionTracker(
  config?: Partial<TrialConfig>,
): IConversionTracker {
  const mergedConfig: TrialConfig = {
    ...DEFAULT_TRIAL_CONFIG,
    ...config,
  };
  return new ConversionTrackerStub(mergedConfig);
}

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
