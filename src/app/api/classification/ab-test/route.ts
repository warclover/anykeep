/**
 * Embedding A/B Test API
 * GET /api/classification/ab-test - 获取 A/B 测试摘要
 * GET /api/classification/ab-test?comparison=true - 获取模型对比报告
 *
 * @version 1.0.0
 * @since 2025-12-09
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embeddingABTestService } from "@/lib/classification/services/server";
import {
  getEmbeddingConfig,
  getEmbeddingConfigInfo,
} from "@/lib/classification/config/embedding-config";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * GET /api/classification/ab-test
 * 获取 A/B 测试数据
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const isComparison = searchParams.get("comparison") === "true";
    const days = parseInt(searchParams.get("days") || "7", 10);
    const operationType = searchParams.get("operation") as
      | "classification"
      | "search"
      | "similarity"
      | null;

    // 3. 获取当前配置信息
    const configInfo = getEmbeddingConfigInfo();
    const config = getEmbeddingConfig();

    // 4. 根据请求类型返回不同数据
    if (isComparison) {
      // 获取模型对比报告
      const controlModel = config.activeModel;
      const treatmentModel = config.abTestNewModel;

      const report = await embeddingABTestService.getComparisonReport(
        controlModel,
        treatmentModel,
        operationType || "classification",
        days,
      );

      if (!report) {
        return successResponse({
          config: configInfo,
          comparison: null,
          message: "暂无足够数据生成对比报告",
        });
      }

      logger.info(
        {
          userId: user.id,
          controlModel,
          treatmentModel,
          days,
          recommendation: report.comparison.recommendation,
        },
        "A/B test comparison report generated",
      );

      return successResponse({
        config: configInfo,
        comparison: report,
      });
    } else {
      // 获取 A/B 测试摘要
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const summaries = await embeddingABTestService.getSummary({
        operationType: operationType || undefined,
        startDate,
      });

      // 按模型分组统计
      const byModel: Record<
        string,
        {
          totalCount: number;
          avgExecutionTimeMs: number;
          feedbackCount: number;
          acceptanceRate: number | null;
        }
      > = {};

      summaries.forEach((s) => {
        if (!byModel[s.modelId]) {
          byModel[s.modelId] = {
            totalCount: 0,
            avgExecutionTimeMs: 0,
            feedbackCount: 0,
            acceptanceRate: null,
          };
        }
        const model = byModel[s.modelId];
        const prevTotal = model.totalCount;
        model.totalCount += s.totalCount;
        model.avgExecutionTimeMs =
          (model.avgExecutionTimeMs * prevTotal +
            s.avgExecutionTimeMs * s.totalCount) /
          model.totalCount;
        model.feedbackCount += s.feedbackCount;
      });

      // 计算总体接受率
      Object.keys(byModel).forEach((modelId) => {
        const feedbackData = summaries
          .filter((s) => s.modelId === modelId && s.acceptanceRate !== null)
          .reduce(
            (acc, s) => {
              acc.total += s.feedbackCount;
              acc.accepted += (s.acceptanceRate || 0) * s.feedbackCount;
              return acc;
            },
            { total: 0, accepted: 0 },
          );

        if (feedbackData.total > 0) {
          byModel[modelId].acceptanceRate =
            feedbackData.accepted / feedbackData.total;
        }
      });

      return successResponse({
        config: configInfo,
        summary: {
          period: `${days} days`,
          startDate: startDate.toISOString(),
          byModel,
          dailyData: summaries,
        },
      });
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/classification/ab-test error",
    );
    return internalError("获取 A/B 测试数据失败");
  }
}
