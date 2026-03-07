/**
 * AI Provider 状态 API
 *
 * 提供 AI Provider 健康状态和电路断路器信息
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { NextResponse } from "next/server";
import { aiProviderRouter } from "@/lib/ai-providers/provider-router";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * GET /api/ai/providers
 *
 * 获取所有 AI Provider 的健康状态
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  // 获取 Provider 健康状态
  const healthStatus = aiProviderRouter.getHealthStatus();

  // 获取电路断路器报告
  const circuitBreakerReport = aiProviderRouter.getCircuitBreakerReport();

  // 获取电路断路器配置
  const circuitBreakerConfig = aiProviderRouter.getCircuitBreakerConfig();

  // 获取可用 Provider 列表
  const availableProviders = aiProviderRouter.getAvailableProviders();

  void userId; // used for auth only

  return NextResponse.json({
    success: true,
    data: {
      providers: healthStatus.map((health) => {
        const circuitInfo = circuitBreakerReport.find(
          (r) => r.provider === health.name,
        );
        const isAvailable = availableProviders.some(
          (p) => p.name === health.name,
        );

        return {
          name: health.name,
          status: health.status,
          isAvailable,
          latencyMs: health.latencyMs,
          lastCheckedAt: health.lastCheckedAt?.toISOString(),
          errorMessage: health.errorMessage,
          consecutiveFailures: health.consecutiveFailures,
          circuitState: circuitInfo?.circuitState ?? "unknown",
          cooldownRemainingMs: circuitInfo?.cooldownRemainingMs,
          halfOpenProgress: circuitInfo?.halfOpenProgress,
        };
      }),
      circuitBreakerConfig: {
        failureThreshold: circuitBreakerConfig.failureThreshold,
        cooldownMs: circuitBreakerConfig.cooldownMs,
        halfOpenRequests: circuitBreakerConfig.halfOpenRequests,
        recoveryThreshold: circuitBreakerConfig.recoveryThreshold,
      },
      summary: {
        totalProviders: healthStatus.length,
        healthyCount: healthStatus.filter((h) => h.status === "healthy").length,
        degradedCount: healthStatus.filter((h) => h.status === "degraded")
          .length,
        unhealthyCount: healthStatus.filter((h) => h.status === "unhealthy")
          .length,
      },
    },
  });
});

/**
 * POST /api/ai/providers
 *
 * 重置指定 Provider 的电路断路器
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const body = await request.json();
  const { action, providerName } = body;

  if (action === "reset" && providerName) {
    const success = aiProviderRouter.resetCircuitBreaker(providerName);

    if (success) {
      logger.info(
        { provider: providerName, userId },
        `Circuit breaker reset for ${providerName} by user`,
      );

      return NextResponse.json({
        success: true,
        message: `Circuit breaker for ${providerName} has been reset`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: `Provider ${providerName} not found` },
        { status: 404 },
      );
    }
  }

  return NextResponse.json(
    { success: false, error: "Invalid action" },
    { status: 400 },
  );
});
