/**
 * Phase 3 个性化学习 - UnifiedEngine 集成模块
 *
 * 职责：
 * - 在路由前检查快捷指令匹配
 * - 在执行后收集隐式反馈
 * - 管理个性化学习生命周期
 *
 * @version 1.0.1
 * @since 2026-01-10
 */

import { logger } from "@/lib/logger";
import {
  type FeedbackCollector,
  createFeedbackCollector,
} from "./feedback-collector";
import {
  type PersonalizedShortcutLearner,
  createShortcutLearner,
} from "./shortcut-learner";
import {
  type IntentPatternDiscoverer,
  createPatternDiscoverer,
} from "./pattern-discoverer";
import type {
  UserShortcut,
  SuggestedPattern,
  UserAction,
  IntentMatchForFeedback,
} from "./types";
import type { IntentType } from "../router/types";

// ============================================
// 配置类型
// ============================================

export interface PersonalizedLearningConfig {
  /** 是否启用快捷指令匹配 */
  enableShortcutMatching?: boolean;
  /** 是否启用反馈收集 */
  enableFeedbackCollection?: boolean;
  /** 是否启用模式发现 */
  enablePatternDiscovery?: boolean;
  /** 快捷指令匹配置信度阈值 */
  shortcutMatchThreshold?: number;
  /** 调试模式 */
  debug?: boolean;
}

// ============================================
// 结果类型
// ============================================

/**
 * 快捷指令匹配结果
 */
export interface ShortcutMatchResult {
  /** 是否匹配成功 */
  matched: boolean;
  /** 匹配的快捷指令 */
  shortcut?: UserShortcut;
  /** 相似度 */
  similarity: number;
  /** 推荐的意图类型 */
  intentType?: IntentType;
  /** 推荐的意图子类型 */
  intentSubType?: string;
  /** 默认槽位值 */
  defaultSlots?: Record<string, unknown>;
}

/**
 * 反馈收集上下文
 */
export interface FeedbackContext {
  userId: string;
  sessionId: string;
  turnId: string;
  originalInput: string;
  predictedIntent: IntentMatchForFeedback;
  executionStartTime: number;
}

// ============================================
// PersonalizedLearningIntegration 类
// ============================================

/**
 * 个性化学习集成服务
 *
 * 封装 Phase 3 学习模块，提供与 UnifiedEngine 的集成接口
 */
export class PersonalizedLearningIntegration {
  private feedbackCollector: FeedbackCollector;
  private shortcutLearner: PersonalizedShortcutLearner;
  private patternDiscoverer: IntentPatternDiscoverer;
  private config: Required<PersonalizedLearningConfig>;

  // 活跃的反馈上下文（用于跟踪执行结果）
  private activeFeedbackContexts: Map<string, FeedbackContext> = new Map();

  constructor(config: PersonalizedLearningConfig = {}) {
    this.config = {
      enableShortcutMatching: config.enableShortcutMatching ?? true,
      enableFeedbackCollection: config.enableFeedbackCollection ?? true,
      enablePatternDiscovery: config.enablePatternDiscovery ?? true,
      shortcutMatchThreshold: config.shortcutMatchThreshold ?? 0.8,
      debug: config.debug ?? false,
    };

    // 初始化各个学习模块
    this.feedbackCollector = createFeedbackCollector({
      debug: this.config.debug,
    });

    this.shortcutLearner = createShortcutLearner({
      debug: this.config.debug,
      confidenceThreshold: this.config.shortcutMatchThreshold,
    });

    this.patternDiscoverer = createPatternDiscoverer({
      debug: this.config.debug,
    });
  }

  // ============================================
  // 快捷指令匹配（路由前）
  // ============================================

  /**
   * 检查用户输入是否匹配已保存的快捷指令
   *
   * @param userId - 用户 ID
   * @param input - 用户输入
   * @returns 匹配结果
   */
  async matchShortcut(
    userId: string,
    input: string,
  ): Promise<ShortcutMatchResult> {
    if (!this.config.enableShortcutMatching) {
      return { matched: false, similarity: 0 };
    }

    try {
      const result = await this.shortcutLearner.matchShortcut(userId, input);

      if (result.matched && result.shortcut) {
        if (this.config.debug) {
          logger.debug(
            {
              userId,
              input,
              matchedShortcut: result.shortcut.shortcutPhrase,
              similarity: result.similarity,
            },
            "PersonalizedLearning: Shortcut matched",
          );
        }

        return {
          matched: true,
          shortcut: result.shortcut,
          similarity: result.similarity,
          intentType: result.shortcut.intentType,
          intentSubType: result.shortcut.intentSubType,
          defaultSlots: result.shortcut.defaultSlots,
        };
      }

      return { matched: false, similarity: result.similarity };
    } catch (error) {
      logger.error(
        { error, userId },
        "PersonalizedLearning: Error matching shortcut",
      );
      return { matched: false, similarity: 0 };
    }
  }

  // ============================================
  // 反馈收集（执行后）
  // ============================================

  /**
   * 开始跟踪执行（在执行前调用）
   *
   * @param context - 反馈上下文
   */
  startTracking(context: FeedbackContext): void {
    if (!this.config.enableFeedbackCollection) {
      return;
    }

    const key = `${context.userId}:${context.sessionId}:${context.turnId}`;
    this.activeFeedbackContexts.set(key, context);

    if (this.config.debug) {
      logger.debug(
        { userId: context.userId, turnId: context.turnId },
        "PersonalizedLearning: Started tracking execution",
      );
    }
  }

  /**
   * 记录执行完成（隐式反馈）
   *
   * @param userId - 用户 ID
   * @param sessionId - 会话 ID
   * @param turnId - 轮次 ID
   * @param success - 执行是否成功
   */
  async recordExecutionComplete(
    userId: string,
    sessionId: string,
    turnId: string,
    success: boolean,
  ): Promise<void> {
    if (!this.config.enableFeedbackCollection) {
      return;
    }

    const key = `${userId}:${sessionId}:${turnId}`;
    const context = this.activeFeedbackContexts.get(key);

    if (!context) {
      return;
    }

    try {
      // 构建用户动作
      const action: UserAction = {
        sessionId: context.sessionId,
        turnId: context.turnId,
        originalInput: context.originalInput,
        type: success ? "execute_success" : "cancel",
        timestamp: new Date(),
      };

      // 收集隐式反馈
      this.feedbackCollector.collectImplicitFeedback(
        context.userId,
        context.predictedIntent,
        action,
      );

      // 清理已处理的上下文
      this.activeFeedbackContexts.delete(key);

      if (this.config.debug) {
        logger.debug(
          { userId, turnId, success },
          "PersonalizedLearning: Recorded execution feedback",
        );
      }
    } catch (error) {
      logger.error(
        { error, userId, turnId },
        "PersonalizedLearning: Error recording execution feedback",
      );
    }
  }

  /**
   * 记录用户纠正（隐式反馈 - 纠正类型）
   *
   * @param userId - 用户 ID
   * @param sessionId - 会话 ID
   * @param turnId - 轮次 ID
   * @param correctedType - 纠正后的意图类型
   * @param correctedSubType - 纠正后的意图子类型
   */
  async recordUserCorrection(
    userId: string,
    sessionId: string,
    turnId: string,
    correctedType: IntentType,
    correctedSubType?: string,
  ): Promise<void> {
    if (!this.config.enableFeedbackCollection) {
      return;
    }

    const key = `${userId}:${sessionId}:${turnId}`;
    const context = this.activeFeedbackContexts.get(key);

    if (!context) {
      return;
    }

    try {
      // 构建纠正动作
      const correctedIntent = correctedSubType
        ? `${correctedType}:${correctedSubType}`
        : correctedType;

      const action: UserAction = {
        sessionId: context.sessionId,
        turnId: context.turnId,
        originalInput: context.originalInput,
        type: "manual_correction",
        correctedIntent,
        timestamp: new Date(),
      };

      // 收集隐式反馈（纠正类型）
      this.feedbackCollector.collectImplicitFeedback(
        context.userId,
        context.predictedIntent,
        action,
      );

      // 清理已处理的上下文
      this.activeFeedbackContexts.delete(key);

      logger.info(
        {
          userId,
          turnId,
          originalType: context.predictedIntent.type,
          correctedType,
        },
        "PersonalizedLearning: Recorded user correction",
      );
    } catch (error) {
      logger.error(
        { error, userId, turnId },
        "PersonalizedLearning: Error recording user correction",
      );
    }
  }

  // ============================================
  // 模式发现（后台处理）
  // ============================================

  /**
   * 运行模式发现任务
   *
   * @param userId - 用户 ID（可选，如果不提供则处理所有用户）
   * @returns 发现的新模式
   */
  async runPatternDiscovery(userId?: string): Promise<SuggestedPattern[]> {
    if (!this.config.enablePatternDiscovery) {
      return [];
    }

    try {
      // 获取失败案例用于模式发现
      const feedbacks = await this.feedbackCollector.getFailedCases({
        limit: 500,
      });

      // 如果指定了 userId，过滤只属于该用户的反馈
      const filteredFeedbacks = userId
        ? feedbacks.filter((f) => f.userId === userId)
        : feedbacks;

      if (filteredFeedbacks.length < 10) {
        if (this.config.debug) {
          logger.debug(
            { feedbackCount: filteredFeedbacks.length },
            "PersonalizedLearning: Insufficient feedback for pattern discovery",
          );
        }
        return [];
      }

      // 发现新模式
      const patterns =
        await this.patternDiscoverer.discoverNewPatterns(filteredFeedbacks);

      // 保存发现的模式
      for (const pattern of patterns) {
        await this.patternDiscoverer.savePatternSuggestion(pattern);
      }

      if (patterns.length > 0) {
        logger.info(
          { patternCount: patterns.length, userId },
          "PersonalizedLearning: Discovered and saved new patterns",
        );
      }

      return patterns;
    } catch (error) {
      logger.error(
        { error, userId },
        "PersonalizedLearning: Error running pattern discovery",
      );
      return [];
    }
  }

  // ============================================
  // 快捷指令管理
  // ============================================

  /**
   * 从用户反馈学习新的快捷指令候选
   *
   * @param userId - 用户 ID
   * @returns 建议的快捷指令候选
   */
  async learnShortcutCandidates(userId: string) {
    try {
      // 获取用户最近的已接受反馈
      const feedbacks = await this.feedbackCollector.getRecentFeedback(
        userId,
        100,
      );
      return this.shortcutLearner.learnFromFeedback(userId, feedbacks);
    } catch (error) {
      logger.error(
        { error, userId },
        "PersonalizedLearning: Error learning shortcut candidates",
      );
      return [];
    }
  }

  // ============================================
  // 统计与诊断
  // ============================================

  /**
   * 获取用户学习统计
   */
  async getUserLearningStats(userId: string) {
    const [feedbackStats, shortcuts] = await Promise.all([
      this.feedbackCollector.getUserFeedbackStats(userId),
      this.shortcutLearner.getUserShortcuts(userId),
    ]);

    return {
      feedback: feedbackStats,
      shortcutCount: shortcuts.length,
      activeShortcuts: shortcuts.filter((s) => s.isActive).length,
    };
  }

  /**
   * 清除用户缓存
   */
  clearUserCache(userId: string): void {
    this.shortcutLearner.clearCache(userId);
  }

  /**
   * 刷新待写入的反馈数据
   */
  async flush(): Promise<void> {
    await this.feedbackCollector.flushBuffer();
  }
}

// ============================================
// 工厂函数
// ============================================

let sharedInstance: PersonalizedLearningIntegration | null = null;

/**
 * 创建 PersonalizedLearningIntegration 实例
 */
export function createPersonalizedLearningIntegration(
  config?: PersonalizedLearningConfig,
): PersonalizedLearningIntegration {
  return new PersonalizedLearningIntegration(config);
}

/**
 * 获取共享的 PersonalizedLearningIntegration 实例
 */
export function getPersonalizedLearningIntegration(): PersonalizedLearningIntegration {
  if (!sharedInstance) {
    sharedInstance = createPersonalizedLearningIntegration();
  }
  return sharedInstance;
}

/**
 * 重置共享实例（用于测试）
 */
export function resetPersonalizedLearningIntegration(): void {
  sharedInstance = null;
}
