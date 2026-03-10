/**
 * Prometheus Metrics Endpoint
 * GET /api/metrics
 *
 * @description 暴露 Prometheus 格式的应用指标
 * @security 仅在特定条件下允许访问（生产环境需要密钥）
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generatePrometheusMetrics } from "@/lib/metrics/prometheus-exporter";
import { logger } from "@/lib/logger";

/**
 * 验证请求权限
 *
 * 安全策略：
 * - 开发环境：允许所有访问
 * - 生产环境：仅允许 Bearer Token 认证（METRICS_SECRET）
 *   不使用 IP 白名单，因为 X-Forwarded-For 可被客户端伪造
 */
function isAuthorized(request: NextRequest): boolean {
  // 开发环境允许访问
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // 生产环境必须配置 METRICS_SECRET
  const metricsSecret = process.env.METRICS_SECRET;
  if (!metricsSecret) {
    logger.error("[Metrics] METRICS_SECRET not configured, rejecting request");
    return false; // fail-safe：未配置密钥时拒绝所有请求
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${metricsSecret}`;
}

export async function GET(request: NextRequest) {
  // 权限检查
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const metrics = generatePrometheusMetrics();

    return new NextResponse(metrics, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    logger.error({ error }, "[Metrics] Failed to generate metrics");
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// 不缓存此路由
export const dynamic = "force-dynamic";
