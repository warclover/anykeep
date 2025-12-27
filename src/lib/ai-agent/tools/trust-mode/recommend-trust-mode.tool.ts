/**
 * RecommendTrustMode Tool - 智能推荐信任模式
 *
 * 基于用户使用习惯智能推荐最适合的信任等级。
 * 分析纠正率、待确认积压、决策样本等指标给出推荐。
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { withReasoning, extractReasoning } from "../types";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";
import { logger } from "@/lib/logger";
import type { TrustMode } from "@/types/trust-mode";
import type {
  RecommendTrustModeResult,
  RecommendationFactor,
  RecommendationResult,
  RecommendationMetrics,
} from "./types";
import { TRUST_MODE_DISPLAY, RECOMMENDATION_THRESHOLDS } from "./types";

// ============================================
// 参数 Schema
// ============================================

const baseParamsSchema = z.object({
  considerHistory: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否考虑模式切换历史（避免频繁推荐切换）"),
});

const paramsSchema = withReasoning(baseParamsSchema);

// 使用 z.input 获取输入类型（可选字段保持可选）
type RecommendTrustModeParams = z.input<typeof paramsSchema>;

// ============================================
// 推荐算法
// ============================================

interface RecommendationContext {
  currentMode: TrustMode;
  correctionRate: number;
  autoDecisions: number;
  userCorrections: number;
  pendingConfirmations: number;
  daysSinceLastChange?: number;
  hasSufficientData: boolean;
}

/**
 * 计算推荐结果
 */
function calculateRecommendation(ctx: RecommendationContext): {
  recommendation: RecommendationResult;
  factors: RecommendationFactor[];
  primaryReason: string;
} {
  const factors: RecommendationFactor[] = [];
  let recommendedMode: TrustMode = ctx.currentMode;
  let confidence = 50; // 基础置信度
  let primaryReason = "当前模式运行良好，无需调整";

  // Factor 1: 纠正率分析
  const correctionRatePercent = Math.round(ctx.correctionRate * 100);
  if (correctionRatePercent >= RECOMMENDATION_THRESHOLDS.HIGH_CORRECTION_RATE) {
    factors.push({
      name: "纠正率",
      value: `${correctionRatePercent}%`,
      impact: "negative",
      weight: 0.4,
      description: `您纠正了 ${correctionRatePercent}% 的 AI 决策，高于 ${RECOMMENDATION_THRESHOLDS.HIGH_CORRECTION_RATE}% 阈值`,
    });

    // 建议降低自动化
    if (ctx.currentMode === "full_auto") {
      recommendedMode = "semi_auto";
      confidence = 75;
      primaryReason = "纠正率较高，建议切换到半托管模式以获得更多控制";
    } else if (ctx.currentMode === "semi_auto") {
      recommendedMode = "manual";
      confidence = 65;
      primaryReason = "纠正率仍然较高，可以考虑切换到不托管模式";
    }
  } else if (
    correctionRatePercent < RECOMMENDATION_THRESHOLDS.LOW_CORRECTION_RATE &&
    ctx.hasSufficientData
  ) {
    factors.push({
      name: "纠正率",
      value: `${correctionRatePercent}%`,
      impact: "positive",
      weight: 0.4,
      description: `AI 分类准确率很高，仅 ${correctionRatePercent}% 的决策需要纠正`,
    });

    // 建议提升自动化
    if (ctx.currentMode === "manual") {
      recommendedMode = "semi_auto";
      confidence = 70;
      primaryReason = "AI 表现良好，可以考虑启用半托管模式提升效率";
    } else if (ctx.currentMode === "semi_auto") {
      recommendedMode = "full_auto";
      confidence = 75;
      primaryReason = "AI 分类准确率很高，可以信任完全托管模式";
    }
  } else {
    factors.push({
      name: "纠正率",
      value: `${correctionRatePercent}%`,
      impact: "neutral",
      weight: 0.3,
      description: "纠正率处于正常范围",
    });
  }

  // Factor 2: 待确认积压分析
  if (
    ctx.pendingConfirmations >
    RECOMMENDATION_THRESHOLDS.PENDING_CONFIRMATION_THRESHOLD
  ) {
    factors.push({
      name: "待确认积压",
      value: ctx.pendingConfirmations,
      impact: "negative",
      weight: 0.3,
      description: `有 ${ctx.pendingConfirmations} 条待确认消息积压，超过 ${RECOMMENDATION_THRESHOLDS.PENDING_CONFIRMATION_THRESHOLD} 条阈值`,
    });

    // 如果积压严重，建议调整
    if (ctx.currentMode === "semi_auto") {
      // 半托管模式积压严重，可能用户不喜欢确认
      if (confidence < 70) {
        recommendedMode = "full_auto";
        confidence = 70;
        primaryReason =
          "待确认消息积压较多，建议切换到完全托管模式减少干扰，或切换到不托管模式手动管理";
      }
    }
  } else if (
    ctx.pendingConfirmations === 0 &&
    ctx.currentMode === "semi_auto"
  ) {
    factors.push({
      name: "待确认积压",
      value: 0,
      impact: "positive",
      weight: 0.2,
      description: "待确认队列清空，响应及时",
    });
  }

  // Factor 3: 数据样本量
  if (!ctx.hasSufficientData) {
    factors.push({
      name: "数据样本",
      value: ctx.autoDecisions,
      impact: "neutral",
      weight: 0.2,
      description: `仅有 ${ctx.autoDecisions} 次自动决策，需要更多数据才能准确评估`,
    });

    // 数据不足时降低推荐置信度
    confidence = Math.min(confidence, 50);
    if (recommendedMode !== ctx.currentMode) {
      primaryReason = "数据样本不足，建议继续观察当前模式效果";
      recommendedMode = ctx.currentMode;
    }
  } else {
    factors.push({
      name: "数据样本",
      value: ctx.autoDecisions,
      impact: "positive",
      weight: 0.1,
      description: `已有 ${ctx.autoDecisions} 次自动决策，数据样本充足`,
    });
  }

  // Factor 4: 模式稳定期
  if (
    ctx.daysSinceLastChange !== undefined &&
    ctx.daysSinceLastChange < RECOMMENDATION_THRESHOLDS.MODE_STABILITY_DAYS
  ) {
    factors.push({
      name: "模式稳定期",
      value: `${ctx.daysSinceLastChange}天`,
      impact: "neutral",
      weight: 0.15,
      description: `距离上次切换仅 ${ctx.daysSinceLastChange} 天，建议观察至少 ${RECOMMENDATION_THRESHOLDS.MODE_STABILITY_DAYS} 天`,
    });

    // 刚切换不久，降低推荐切换的置信度
    if (recommendedMode !== ctx.currentMode) {
      confidence = Math.max(confidence - 20, 40);
      if (
        confidence < RECOMMENDATION_THRESHOLDS.RECOMMEND_CONFIDENCE_THRESHOLD
      ) {
        primaryReason = `刚切换模式不久（${ctx.daysSinceLastChange}天），建议继续观察效果`;
        recommendedMode = ctx.currentMode;
      }
    }
  }

  const isChange = recommendedMode !== ctx.currentMode;

  return {
    recommendation: {
      mode: recommendedMode,
      label: TRUST_MODE_DISPLAY[recommendedMode].label,
      confidence,
      isChange,
    },
    factors,
    primaryReason,
  };
}

// ============================================
// Tool 实现
// ============================================

export const recommendTrustModeTool: Tool<
  RecommendTrustModeParams,
  RecommendTrustModeResult
> = {
  definition: {
    name: "recommend_trust_mode",
    description: `基于用户使用习惯智能推荐最适合的信任模式。

分析指标：
- 纠正率：用户纠正 AI 决策的频率
- 待确认积压：未处理的确认消息数量
- 决策样本：累计自动决策次数
- 模式稳定性：最近一次切换距今时间

推荐逻辑：
- 纠正率 > 30%: 建议降低自动化程度
- 纠正率 < 5% 且样本充足: 建议提升自动化程度
- 待确认积压 > 20: 建议调整以减少干扰
- 刚切换不久 (<7天): 建议保持观察

使用场景：
- 用户询问 "我该用哪个模式"、"推荐一个适合我的模式"
- 用户要求 "帮我优化 AI 设置"
- 新用户引导
- 定期健康检查`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 200,
  },

  async execute(
    params: RecommendTrustModeParams,
    context,
  ): Promise<ToolResult<RecommendTrustModeResult>> {
    const startTime = performance.now();
    const reasoning = extractReasoning(params);

    try {
      // 1. 获取当前配置和统计
      const effectiveConfig = await trustModeService.getEffectiveConfig(
        context.userId,
      );
      const { mode: currentMode, stats } = effectiveConfig;

      // 2. 获取模式切换历史（如果需要）
      let daysSinceLastChange: number | undefined;
      // 默认 considerHistory 为 true
      if (params.considerHistory !== false) {
        const history = await trustModeService.getModeHistory(context.userId);
        if (history && history.length > 0) {
          const lastChange = new Date(history[0].timestamp);
          const now = new Date();
          daysSinceLastChange = Math.floor(
            (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24),
          );
        }
      }

      // 3. 构建推荐上下文
      const totalDecisions = stats.autoDecisions + stats.userCorrections;
      const hasSufficientData =
        totalDecisions >= RECOMMENDATION_THRESHOLDS.MIN_DECISION_SAMPLES;

      const recommendationContext: RecommendationContext = {
        currentMode,
        correctionRate: stats.correctionRate,
        autoDecisions: stats.autoDecisions,
        userCorrections: stats.userCorrections,
        pendingConfirmations: stats.pendingConfirmations,
        daysSinceLastChange,
        hasSufficientData,
      };

      // 4. 计算推荐
      const { recommendation, factors, primaryReason } =
        calculateRecommendation(recommendationContext);

      // 5. 构建指标
      const metrics: RecommendationMetrics = {
        correctionRate: Math.round(stats.correctionRate * 100),
        autoDecisions: stats.autoDecisions,
        userCorrections: stats.userCorrections,
        pendingConfirmations: stats.pendingConfirmations,
        daysSinceLastChange,
        hasSufficientData,
      };

      // 6. 构建响应消息
      let message: string;
      if (recommendation.isChange) {
        message = `建议从「${TRUST_MODE_DISPLAY[currentMode].label}」切换到「${recommendation.label}」（置信度 ${recommendation.confidence}%）。${primaryReason}`;
      } else {
        message = `建议保持当前「${TRUST_MODE_DISPLAY[currentMode].label}」模式。${primaryReason}`;
      }

      const result: RecommendTrustModeResult = {
        current: {
          mode: currentMode,
          label: TRUST_MODE_DISPLAY[currentMode].label,
        },
        recommendation,
        reasoning: {
          primary: primaryReason,
          factors,
        },
        metrics,
        message,
      };

      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.info(
        {
          toolName: "recommend_trust_mode",
          userId: context.userId,
          currentMode,
          recommendedMode: recommendation.mode,
          isChange: recommendation.isChange,
          confidence: recommendation.confidence,
          correctionRate: metrics.correctionRate,
          executionTimeMs,
          reasoning,
        },
        "recommend_trust_mode: Success",
      );

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.error(
        {
          toolName: "recommend_trust_mode",
          userId: context.userId,
          error: errorMessage,
          executionTimeMs,
        },
        "recommend_trust_mode: Failed",
      );

      return {
        success: false,
        error: `获取推荐失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs,
        },
      };
    }
  },
};
