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
import { withAuthMiddleware } from "@/lib/api/middleware";
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
  type BookmarkEmbeddingType = {
    id: number;
    embedding: unknown;
    status: string;
  };
  const { data, error } = (await supabase
    .from("bookmarks")
    .select("id, embedding, status", { count: "exact" })
    .eq("user_id", userId)
    .is("deleted_at", null)) as unknown as {
    data: BookmarkEmbeddingType[] | null;
    error: { message: string } | null;
  };

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
  type FolderWithProfileType = {
    id: number;
    name: string;
    folder_profiles: { name_embedding: unknown } | null;
  };
  const { data, error } = (await supabase
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
    .is("deleted_at", null)) as unknown as {
    data: FolderWithProfileType[] | null;
    error: { message: string } | null;
  };

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
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  type StuckBookmarkType = {
    id: number;
    title: string | null;
    created_at: string;
  };
  const { data, error, count } = (await supabase
    .from("bookmarks")
    .select("id, title, created_at", { count: "exact" })
    .eq("user_id", userId)
    .eq("status", "PROCESSING")
    .lt("created_at", oneHourAgo)
    .is("deleted_at", null)
    .limit(10)) as unknown as {
    data: StuckBookmarkType[] | null;
    error: { message: string } | null;
    count: number | null;
  };

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
  try {
    type OrphanedBookmarkType = {
      id: number;
      title: string | null;
      folder_id: number | null;
      folders: { id: number } | null;
    };
    const { data: orphanedBookmarks, error } = (await supabase
      .from("bookmarks")
      .select(
        `
        id,
        title,
        folder_id,
        folders!bookmarks_folder_id_fkey (id)
      `,
      )
      .eq("user_id", userId)
      .not("folder_id", "is", null)
      .is("deleted_at", null)
      .limit(100)) as unknown as {
      data: OrphanedBookmarkType[] | null;
      error: { message: string } | null;
    };

    if (error) {
      return {
        name: "orphaned_data",
        status: "warning",
        message: `检查跳过: ${error.message}`,
      };
    }

    const orphaned =
      orphanedBookmarks?.filter(
        (b) => b.folder_id !== null && b.folders === null,
      ) || [];
    const orphanedCount = orphaned.length;

    return {
      name: "orphaned_data",
      status: orphanedCount > 0 ? "warning" : "healthy",
      message:
        orphanedCount > 0
          ? `${orphanedCount} 条书签引用了不存在的文件夹`
          : "没有孤立数据",
      details: {
        orphanedCount,
        samples: orphaned
          .slice(0, 5)
          .map((b) => ({ id: b.id, folderId: b.folder_id })),
      },
    };
  } catch {
    return {
      name: "orphaned_data",
      status: "healthy",
      message: "跳过检查 (查询失败)",
    };
  }
}

// ============================================================================
// API Handler
// ============================================================================

export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const startTime = Date.now();
  const supabase = await createClient();

  // 并行执行所有检查
  const checks = await Promise.all([
    checkEmbeddingCoverage(supabase, userId),
    checkFolderProfiles(supabase, userId),
    checkStuckProcessing(supabase, userId),
    checkOrphanedData(supabase, userId),
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
      userId,
      status: overallStatus,
      durationMs,
      checkResults: checks.map((c) => ({ name: c.name, status: c.status })),
    },
    "Data consistency health check completed",
  );

  return NextResponse.json(response);
});
