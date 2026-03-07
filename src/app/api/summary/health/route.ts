/**
 * Summary Health API
 *
 * GET /api/summary/health - 获取摘要服务健康状态
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import type { NextRequest } from "next/server";
import { successResponse } from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";
import {
  getSummaryService,
  getSummaryConfigService,
  isNewSummaryServiceEnabled,
} from "@/lib/summary";

/**
 * GET /api/summary/health
 * 获取摘要服务健康状态
 */
export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    // 检查服务是否启用
    const isEnabled = isNewSummaryServiceEnabled();

    if (!isEnabled) {
      return successResponse({
        status: "disabled",
        message: "新摘要服务未启用",
        providers: [],
      });
    }

    // 获取 Provider 健康状态
    const summaryService = getSummaryService();
    const providersHealth = await summaryService.getProvidersHealth();

    // 获取服务配置
    const configService = getSummaryConfigService();
    const config = configService.getConfig();
    const configSummary = configService.getConfigSummary();

    // 构建健康状态响应
    const providers = Array.from(providersHealth.entries()).map(
      ([name, health]) => ({
        name,
        status: health.available ? "healthy" : "unhealthy",
        latencyMs: health.latencyMs,
        error: health.error,
        checkedAt: health.checkedAt,
      }),
    );

    // 计算整体状态
    const healthyProviders = providers.filter((p) => p.status === "healthy");
    const overallStatus =
      healthyProviders.length > 0
        ? healthyProviders.length === providers.length
          ? "healthy"
          : "degraded"
        : "unhealthy";

    logger.debug(
      {
        userId,
        overallStatus,
        healthyProviders: healthyProviders.length,
        totalProviders: providers.length,
      },
      "Summary health check completed",
    );

    // 返回结果
    return successResponse({
      status: overallStatus,
      enabled: true,
      providers,
      config: {
        defaultProvider: config.defaultProvider,
        fallbackProvider: config.fallbackProvider,
        enableFallback: config.enableFallback,
        outputVersion: config.outputVersion,
      },
      summary: configSummary,
    });
  },
);
