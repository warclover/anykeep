/**
 * 慢思考服务
 *
 * 提供 AI Agent 深度推理能力
 *
 * @module ai-agent/slow-thinking
 * @version 1.0.0
 * @since 2025-12-30
 * @description Phase 2 - 慢思考层核心服务
 */

import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { logger } from "@/lib/logger";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import {
  MODEL_TIER_CONFIG,
  type ModelTierId,
} from "@/lib/ai-providers/model-tier-config";
import type {
  SlowThinkingConfig,
  InternalMonologue,
  SlowThinkingRouteResult,
  SlowThinkingDynamicContext,
  ISlowThinkingService,
} from "./types";
import {
  DEFAULT_SLOW_THINKING_CONFIG,
  LOG_MODULE,
  ERROR_MESSAGES,
} from "./types";
import { buildThinkingPrompt } from "./prompt-builder";
import {
  parseMonologue,
  validateMonologue,
  createDefaultMonologue,
} from "./output-parser";

// =============================================================================
// 服务类
// =============================================================================

/**
 * 慢思考服务
 *
 * 在执行任务前进行深度推理，分析用户真实意图，
 * 并建议最佳执行策略。
 */
export class SlowThinkingService implements ISlowThinkingService {
  public readonly config: SlowThinkingConfig;

  constructor(config: Partial<SlowThinkingConfig> = {}) {
    this.config = { ...DEFAULT_SLOW_THINKING_CONFIG, ...config };
  }

  // ===========================================================================
  // 公开方法
  // ===========================================================================

  /**
   * 生成内心独白
   *
   * @param userMessage - 用户消息
   * @param routeResult - 路由结果
   * @param context - 动态上下文
   * @returns 内心独白或 null（不需要慢思考时）
   */
  async generateMonologue(
    userMessage: string,
    routeResult: SlowThinkingRouteResult,
    context: SlowThinkingDynamicContext,
  ): Promise<InternalMonologue | null> {
    // 检查功能开关
    if (!FeatureFlags.ENABLE_SLOW_THINKING) {
      return null;
    }

    // 检查是否需要慢思考
    if (!this.shouldThink(routeResult)) {
      logger.debug(
        {
          module: LOG_MODULE,
          intentType: routeResult.intent.type,
          complexity: routeResult.complexity.score,
        },
        "Slow thinking not required",
      );
      return null;
    }

    const startTime = Date.now();

    try {
      // 构建 Prompt
      const prompt = buildThinkingPrompt(userMessage, routeResult, context);

      // 获取模型
      const model = this.getModelByTier(this.config.modelTier);

      // 调用 LLM
      const result = await Promise.race([
        generateText({
          model,
          prompt,
          maxOutputTokens: 1000,
          temperature: 0.7,
        }),
        this.createTimeoutPromise<never>(this.config.maxThinkingTime),
      ]);

      // 解析输出
      const monologue = parseMonologue(result.text, userMessage);
      monologue.thinkingDurationMs = Date.now() - startTime;

      // 验证结果
      if (!validateMonologue(monologue)) {
        logger.warn(
          { module: LOG_MODULE, userMessage: userMessage.slice(0, 50) },
          "Invalid monologue, using default",
        );
        const defaultMonologue = createDefaultMonologue(userMessage);
        defaultMonologue.thinkingDurationMs = Date.now() - startTime;
        return defaultMonologue;
      }

      logger.info(
        {
          module: LOG_MODULE,
          userMessage: userMessage.slice(0, 50),
          duration: monologue.thinkingDurationMs,
          suggestRouteChange: monologue.suggestRouteChange,
          confidence: monologue.confidence,
        },
        "Slow thinking completed",
      );

      return monologue;
    } catch (error) {
      // 检查是否为超时错误
      if (error instanceof Error && error.message === ERROR_MESSAGES.TIMEOUT) {
        logger.warn(
          {
            module: LOG_MODULE,
            userMessage: userMessage.slice(0, 50),
            maxTime: this.config.maxThinkingTime,
          },
          ERROR_MESSAGES.TIMEOUT,
        );
      } else {
        logger.error(
          { module: LOG_MODULE, error },
          ERROR_MESSAGES.THINKING_FAILED,
        );
      }

      // 返回默认内心独白
      const defaultMonologue = createDefaultMonologue(userMessage);
      defaultMonologue.thinkingDurationMs = Date.now() - startTime;
      return defaultMonologue;
    }
  }

  /**
   * 判断是否需要慢思考
   *
   * @param routeResult - 路由结果
   * @returns 是否需要
   */
  shouldThink(routeResult: SlowThinkingRouteResult): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // 特定意图类型总是触发
    if (this.config.alwaysThinkIntents.includes(routeResult.intent.type)) {
      return true;
    }

    // 复杂度超过阈值才触发
    if (routeResult.complexity.score < this.config.complexityThreshold) {
      return false;
    }

    // 非简单任务触发
    return routeResult.complexity.level !== "simple";
  }

  /**
   * 判断是否应该向用户展示思考过程
   *
   * @returns 是否展示
   */
  shouldShowToUser(): boolean {
    return this.config.showToUser && FeatureFlags.ENABLE_SLOW_THINKING_VISIBLE;
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 创建超时 Promise
   *
   * @param ms - 超时毫秒数
   * @returns 超时后 reject 的 Promise
   */
  private createTimeoutPromise<T>(ms: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(ERROR_MESSAGES.TIMEOUT));
      }, ms);
    });
  }

  /**
   * 根据模型层级获取模型实例
   *
   * @param tier - 模型层级
   * @returns AI SDK 模型实例
   */
  private getModelByTier(tier: ModelTierId) {
    const config = MODEL_TIER_CONFIG[tier];
    // 目前所有层级都使用 DeepSeek
    return deepseek(config.provider.model);
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 创建慢思考服务实例
 *
 * @param config - 可选配置
 * @returns 服务实例
 */
export function createSlowThinkingService(
  config?: Partial<SlowThinkingConfig>,
): SlowThinkingService {
  return new SlowThinkingService(config);
}
