/**
 * 健康检查 API 路由
 * GET /api/health - 返回应用健康状态
 *
 * 用途：
 * - 容器/K8s 就绪探针
 * - 负载均衡器健康检查
 * - 监控系统可用性检测
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: {
      status: "up" | "down";
      latency?: number;
    };
  };
}

// 应用启动时间
const startTime = Date.now();

/**
 * GET /api/health
 * 返回应用健康状态
 */
export async function GET(): Promise<NextResponse<HealthStatus>> {
  const timestamp = new Date().toISOString();
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  // 检查数据库连接
  let dbStatus: "up" | "down" = "down";
  let dbLatency: number | undefined;

  try {
    const dbStart = Date.now();
    const supabase = await createClient();

    // 简单查询测试数据库连接
    const { error } = await supabase
      .from("profiles")
      .select("id")
      .limit(1)
      .maybeSingle();

    dbLatency = Date.now() - dbStart;
    dbStatus = error ? "down" : "up";
  } catch {
    dbStatus = "down";
  }

  // 综合健康状态判断
  const overallStatus: HealthStatus["status"] =
    dbStatus === "up" ? "healthy" : "unhealthy";

  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp,
    version: process.env.npm_package_version || "0.1.0",
    uptime,
    checks: {
      database: {
        status: dbStatus,
        ...(dbLatency !== undefined && { latency: dbLatency }),
      },
    },
  };

  // 健康时返回 200，不健康时返回 503
  const statusCode = overallStatus === "healthy" ? 200 : 503;

  return NextResponse.json(healthStatus, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
