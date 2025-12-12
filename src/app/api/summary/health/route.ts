/**
 * Summary Health API
 *
 * GET /api/summary/health - 获取摘要服务健康状态
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
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
export async function GET() {
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

    // 2. 检查服务是否启用
    const isEnabled = isNewSummaryServiceEnabled();

    if (!isEnabled) {
      return successResponse({
        status: "disabled",
        message: "新摘要服务未启用",
        providers: [],
      });
    }

    // 3. 获取 Provider 健康状态
    const summaryService = getSummaryService();
    const providersHealth = await summaryService.getProvidersHealth();

    // 4. 获取服务配置
    const configService = getSummaryConfigService();
    const config = configService.getConfig();
    const configSummary = configService.getConfigSummary();

    // 5. 构建健康状态响应
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
        userId: user.id,
        overallStatus,
        healthyProviders: healthyProviders.length,
        totalProviders: providers.length,
      },
      "Summary health check completed",
    );

    // 6. 返回结果
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
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/summary/health error",
    );
    return internalError("获取健康状态失败");
  }
}
