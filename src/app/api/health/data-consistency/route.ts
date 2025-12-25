/**
 * 数据健康检查 API
 * GET /api/health/data-consistency
 *
 * @description
 * 检查数据一致性，包括：
 * - 书签 embedding 覆盖率
 * - 文件夹 name_embedding 完整性
 * - 卡住的处理任务
 * - 孤立数据检测
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

interface HealthCheck {
  name: string;
  status: "healthy" | "warning" | "critical";
  message: string;
  details?: Record<string, unknown>;
}

interface HealthCheckResponse {
  status: "healthy" | "degraded" | "critical";
  checks: HealthCheck[];
  timestamp: string;
  durationMs: number;
}

// ============================================================================
// Health Check Functions
// ============================================================================

/**
 * 检查书签 embedding 覆盖率
 */
async function checkEmbeddingCoverage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<HealthCheck> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("id, embedding, status", { count: "exact" })
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (error) {
    return {
      name: "embedding_coverage",
      status: "critical",
      message: `查询失败: ${error.message}`,
    };
  }

  const total = data?.length || 0;
  const withEmbedding = data?.filter((b) => b.embedding !== null).length || 0;
  const completed = data?.filter((b) => b.status === "COMPLETED").length || 0;
  const completedWithoutEmbedding =
    data?.filter((b) => b.status === "COMPLETED" && b.embedding === null)
      .length || 0;

  const coveragePercent = total > 0 ? (withEmbedding / total) * 100 : 100;

  let status: HealthCheck["status"] = "healthy";
  let message = `覆盖率 ${coveragePercent.toFixed(1)}%`;

  if (completedWithoutEmbedding > 0) {
    status = "warning";
    message = `${completedWithoutEmbedding} 条已完成书签缺少 embedding`;
  }

  if (coveragePercent < 50 && total > 10) {
    status = "critical";
    message = `覆盖率过低 (${coveragePercent.toFixed(1)}%)`;
  }

  return {
    name: "embedding_coverage",
    status,
    message,
    details: {
      total,
      withEmbedding,
      completed,
      completedWithoutEmbedding,
      coveragePercent: coveragePercent.toFixed(2),
    },
  };
}

/**
 * 检查文件夹 name_embedding 完整性
 */
async function checkFolderProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<HealthCheck> {
  const { data, error } = await supabase
    .from("folders")
    .select(
      `
      id,
      name,
      folder_profiles!left (
        name_embedding
      )
    `,
    )
    .eq("user_id", userId)
    .eq("is_system", false)
    .is("deleted_at", null);

  if (error) {
    return {
      name: "folder_profiles",
      status: "critical",
      message: `查询失败: ${error.message}`,
    };
  }

  const total = data?.length || 0;
  const withEmbedding =
    data?.filter((f) => {
      const profile = f.folder_profiles as
        | { name_embedding: unknown }
        | null
        | undefined;
      return profile && profile.name_embedding !== null;
    }).length || 0;

  const missing = total - withEmbedding;

  let status: HealthCheck["status"] = "healthy";
  let message = `所有 ${total} 个文件夹都有 name_embedding`;

  if (missing > 0) {
    status = missing > 5 ? "warning" : "healthy";
    message = `${missing}/${total} 个文件夹缺少 name_embedding`;
  }

  return {
    name: "folder_profiles",
    status,
    message,
    details: {
      total,
      withEmbedding,
      missing,
      fixUrl: "/api/folders/fix-embeddings",
    },
  };
}

/**
 * 检查卡住的处理任务
 */
async function checkStuckProcessing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<HealthCheck> {
  // 超过 1 小时还在 PROCESSING 状态视为卡住
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data, error, count } = await supabase
    .from("bookmarks")
    .select("id, title, created_at", { count: "exact" })
    .eq("user_id", userId)
    .eq("status", "PROCESSING")
    .lt("created_at", oneHourAgo)
    .is("deleted_at", null)
    .limit(10);

  if (error) {
    return {
      name: "stuck_processing",
      status: "critical",
      message: `查询失败: ${error.message}`,
    };
  }

  const stuckCount = count || 0;

  let status: HealthCheck["status"] = "healthy";
  let message = "没有卡住的处理任务";

  if (stuckCount > 0) {
    status = stuckCount > 10 ? "critical" : "warning";
    message = `${stuckCount} 条书签处理超时 (>1h)`;
  }

  return {
    name: "stuck_processing",
    status,
    message,
    details: {
      stuckCount,
      samples: data?.map((b) => ({ id: b.id, title: b.title?.slice(0, 50) })),
    },
  };
}

/**
 * 检查孤立数据
 */
async function checkOrphanedData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<HealthCheck> {
  // 检查引用了不存在文件夹的书签
  const { data, error } = await supabase.rpc("check_orphaned_bookmarks", {
    p_user_id: userId,
  });

  // 如果 RPC 不存在，跳过检查
  if (error?.code === "42883") {
    return {
      name: "orphaned_data",
      status: "healthy",
      message: "跳过检查 (RPC 未配置)",
    };
  }

  if (error) {
    return {
      name: "orphaned_data",
      status: "warning",
      message: `检查跳过: ${error.message}`,
    };
  }

  const orphanedCount = data?.[0]?.count || 0;

  return {
    name: "orphaned_data",
    status: orphanedCount > 0 ? "warning" : "healthy",
    message:
      orphanedCount > 0
        ? `${orphanedCount} 条书签引用了不存在的文件夹`
        : "没有孤立数据",
    details: { orphanedCount },
  };
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 并行执行所有检查
    const checks = await Promise.all([
      checkEmbeddingCoverage(supabase, user.id),
      checkFolderProfiles(supabase, user.id),
      checkStuckProcessing(supabase, user.id),
      checkOrphanedData(supabase, user.id),
    ]);

    // 计算整体状态
    const hasCritical = checks.some((c) => c.status === "critical");
    const hasWarning = checks.some((c) => c.status === "warning");

    let overallStatus: HealthCheckResponse["status"] = "healthy";
    if (hasCritical) {
      overallStatus = "critical";
    } else if (hasWarning) {
      overallStatus = "degraded";
    }

    const durationMs = Date.now() - startTime;

    const response: HealthCheckResponse = {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
      durationMs,
    };

    logger.info(
      {
        userId: user.id,
        status: overallStatus,
        durationMs,
        checkResults: checks.map((c) => ({ name: c.name, status: c.status })),
      },
      "Data consistency health check completed",
    );

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Data consistency health check failed",
    );

    return NextResponse.json(
      {
        status: "critical",
        checks: [],
        error: "Health check failed",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      },
      { status: 500 },
    );
  }
}
