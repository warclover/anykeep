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
 */
function isAuthorized(request: NextRequest): boolean {
  // 开发环境允许访问
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // 生产环境需要 Bearer Token 或内部访问
  const authHeader = request.headers.get("authorization");
  const metricsSecret = process.env.METRICS_SECRET;

  // 如果设置了 METRICS_SECRET，则需要验证
  if (metricsSecret) {
    if (authHeader === `Bearer ${metricsSecret}`) {
      return true;
    }
  }

  // 允许来自 localhost 或内部网络的请求
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || realIp || "";

  // 允许本地访问
  if (
    clientIp === "127.0.0.1" ||
    clientIp === "::1" ||
    clientIp.startsWith("10.") ||
    clientIp.startsWith("172.") ||
    clientIp.startsWith("192.168.")
  ) {
    return true;
  }

  // 如果没有设置 METRICS_SECRET 且不是内部访问，拒绝
  return !metricsSecret;
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
