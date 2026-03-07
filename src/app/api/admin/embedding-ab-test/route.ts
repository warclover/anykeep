/**
 * Embedding A/B Test API
 * GET /api/admin/embedding-ab-test - 获取 A/B 测试结果和对比报告
 *
 * @admin 仅管理员可访问
 */

export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import {
  successResponse,
  badRequestError,
  forbiddenError,
} from "@/lib/utils/api-response";
import { embeddingABTestService } from "@/lib/classification/services/embedding-ab-test.service";
import {
  getEmbeddingConfig,
  getEmbeddingConfigInfo,
  type EmbeddingModelId,
} from "@/lib/classification/config/embedding-config";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { isAdminUser } from "@/lib/auth/admin-check";

/**
 * GET /api/admin/embedding-ab-test
 *
 * Query params:
 * - action: 'summary' | 'comparison' | 'config'
 * - operationType: 'classification' | 'search' | 'similarity' (for summary)
 * - days: number (for comparison, default 7)
 * - controlModel: EmbeddingModelId (for comparison)
 * - treatmentModel: EmbeddingModelId (for comparison)
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { user }) => {
    // 管理员权限检查
    if (!user?.email) {
      return forbiddenError("需要管理员权限");
    }
    if (!isAdminUser(user.email)) {
      return forbiddenError("需要管理员权限");
    }

    // 2. 解析请求参数
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "config";

    // 3. 根据 action 执行不同操作
    switch (action) {
      case "config": {
        // 返回当前配置信息
        const config = getEmbeddingConfig();
        const configInfo = getEmbeddingConfigInfo();

        return successResponse({
          config: {
            activeModel: config.activeModel,
            abTestEnabled: config.abTestEnabled,
            abTestNewModelPercentage: config.abTestNewModelPercentage,
            abTestNewModel: config.abTestNewModel,
            apiTimeout: config.apiTimeout,
          },
          modelInfo: configInfo,
        });
      }

      case "summary": {
        // 获取 A/B 测试摘要
        const operationType = searchParams.get("operationType") as
          | "classification"
          | "search"
          | "similarity"
          | undefined;

        const daysParam = searchParams.get("days");
        const days = daysParam ? parseInt(daysParam, 10) : 7;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const summaries = await embeddingABTestService.getSummary({
          operationType,
          startDate,
        });

        return successResponse({
          summaries,
          period: {
            startDate: startDate.toISOString(),
            endDate: new Date().toISOString(),
            days,
          },
        });
      }

      case "comparison": {
        // 获取对比报告
        const controlModel = searchParams.get(
          "controlModel",
        ) as EmbeddingModelId | null;
        const treatmentModel = searchParams.get(
          "treatmentModel",
        ) as EmbeddingModelId | null;

        if (!controlModel || !treatmentModel) {
          return badRequestError(
            "对比报告需要 controlModel 和 treatmentModel 参数",
          );
        }

        const daysParam = searchParams.get("days");
        const days = daysParam ? parseInt(daysParam, 10) : 7;

        const operationType = (searchParams.get("operationType") ||
          "classification") as "classification" | "search" | "similarity";

        const report = await embeddingABTestService.getComparisonReport(
          controlModel,
          treatmentModel,
          operationType,
          days,
        );

        if (!report) {
          return successResponse({
            report: null,
            message: "暂无足够数据生成对比报告",
          });
        }

        return successResponse({ report });
      }

      default:
        return badRequestError(
          "无效的 action 参数，支持: config, summary, comparison",
        );
    }
  },
);
