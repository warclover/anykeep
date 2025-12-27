/**
 * GetTrustMode Tool - 获取当前信任模式
 *
 * 轻量级工具，快速获取用户当前的 AI 信任模式及核心行为配置。
 * 适合 AI Agent 快速判断当前托管级别以调整交互策略。
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { withReasoning, extractReasoning } from "../types";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";
import { logger } from "@/lib/logger";
import type { GetTrustModeResult } from "./types";
import { TRUST_MODE_DISPLAY } from "./types";

// ============================================
// 参数 Schema
// ============================================

const baseParamsSchema = z.object({
  includeStats: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否包含使用统计信息（纠正率、待确认数等）"),
});

const paramsSchema = withReasoning(baseParamsSchema);

// 使用 z.input 获取输入类型（可选字段保持可选）
type GetTrustModeParams = z.input<typeof paramsSchema>;

// ============================================
// Tool 实现
// ============================================

export const getTrustModeTool: Tool<GetTrustModeParams, GetTrustModeResult> = {
  definition: {
    name: "get_trust_mode",
    description: `获取用户当前的 AI 信任模式。

返回信息：
- mode: 当前模式 (full_auto/semi_auto/manual)
- label: 模式中文名称
- behavior: 核心行为配置（autoClassify、requiresConfirmation、lowConfidenceAction）
- stats: 使用统计（可选，需设置 includeStats=true）

可用模式：
- full_auto（完全托管）：AI 全权处理所有分类
- semi_auto（半托管）：高置信度自动处理，低置信度需确认
- manual（不托管）：仅整理到待整理，不自动分类

使用场景：
- AI 需要了解当前托管级别以调整交互策略
- 用户询问 "我的信任模式是什么"、"当前是什么模式"
- 判断是否需要确认某个操作
- 快速检查托管状态`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 50,
  },

  async execute(
    params: GetTrustModeParams,
    context,
  ): Promise<ToolResult<GetTrustModeResult>> {
    const startTime = performance.now();
    const reasoning = extractReasoning(params);

    try {
      // 获取用户有效配置
      const effectiveConfig = await trustModeService.getEffectiveConfig(
        context.userId,
      );

      const { mode, config, stats } = effectiveConfig;
      const displayInfo = TRUST_MODE_DISPLAY[mode];

      // 构造行为摘要
      const behavior = {
        autoClassify: config.classification.autoClassify,
        requiresConfirmation: config.classification.requireConfirmation,
        lowConfidenceAction: config.classification.lowConfidenceAction,
        confirmationThreshold: config.classification.confirmationThreshold,
      };

      // 构造结果
      const result: GetTrustModeResult = {
        mode,
        label: displayInfo.label,
        description: displayInfo.description,
        behavior,
        message: `当前使用「${displayInfo.label}」模式`,
      };

      // 可选：包含统计信息
      if (params.includeStats === true) {
        result.stats = {
          autoDecisions: stats.autoDecisions,
          userCorrections: stats.userCorrections,
          correctionRate: stats.correctionRate,
          pendingConfirmations: stats.pendingConfirmations,
        };
      }

      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.info(
        {
          toolName: "get_trust_mode",
          userId: context.userId,
          mode,
          includeStats: params.includeStats ?? false,
          executionTimeMs,
          reasoning,
        },
        "get_trust_mode: Success",
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
          toolName: "get_trust_mode",
          userId: context.userId,
          error: errorMessage,
          executionTimeMs,
        },
        "get_trust_mode: Failed",
      );

      return {
        success: false,
        error: `获取信任模式失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs,
        },
      };
    }
  },
};
