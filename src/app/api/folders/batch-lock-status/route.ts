/**
 * V4.2.1: Batch Folder Lock Status API
 * POST /api/folders/batch-lock-status - 批量获取文件夹 AI 锁定状态
 *
 * 优化场景：收藏夹页面需要查询多个文件夹的锁状态
 * 原来：8 个文件夹 = 8 次请求，每次 2-7s
 * 现在：1 次批量请求，<3s
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { PerformanceMonitor } from "@/lib/utils/performance-monitor";

/**
 * 请求参数 Schema
 */
const batchLockStatusSchema = z.object({
  folderIds: z
    .array(z.number().int().positive())
    .min(1, "至少需要一个文件夹 ID")
    .max(50, "最多支持 50 个文件夹"),
});

/**
 * 单个文件夹的锁状态
 */
interface FolderLockStatus {
  folderId: number;
  isLocked: boolean;
  isAiRenamable: boolean;
}

/**
 * POST /api/folders/batch-lock-status
 * 批量获取多个文件夹的 AI 锁定状态
 *
 * @example
 * ```
 * POST /api/folders/batch-lock-status
 * { "folderIds": [2, 14, 16, 17, 18, 20, 21, 22] }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "2": { "isLocked": false, "isAiRenamable": true },
 *     "14": { "isLocked": true, "isAiRenamable": false },
 *     ...
 *   }
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  const monitor = new PerformanceMonitor("BatchLockStatus");

  try {
    // 1. 验证用户身份
    const supabase = await monitor.measure("Auth", () => createClient());
    const {
      data: { user },
      error: authError,
    } = await monitor.measure("GetUser", () => supabase.auth.getUser());

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "未授权访问" },
        { status: 401 },
      );
    }

    monitor.mark("AuthComplete", { userId: user.id });

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = batchLockStatusSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message || "参数错误",
        },
        { status: 400 },
      );
    }

    const { folderIds } = validation.data;
    monitor.mark("ParamsParsed", { folderCount: folderIds.length });

    // 3. 批量查询 folder_profiles 表
    const queryStart = performance.now();
    const { data: profiles, error: queryError } = await supabase
      .from("folder_profiles")
      .select("folder_id, is_system_locked, is_ai_renamable")
      .eq("user_id", user.id)
      .in("folder_id", folderIds);

    monitor.mark("DatabaseQuery", {
      durationMs: Math.round(performance.now() - queryStart),
      resultCount: profiles?.length || 0,
    });

    if (queryError) {
      logger.error(
        { error: queryError.message },
        "Failed to batch query folder lock status",
      );
      return NextResponse.json(
        { success: false, error: "查询失败" },
        { status: 500 },
      );
    }

    // 4. 构建结果映射
    // 对于没有 profile 记录的文件夹，返回默认值（未锁定）
    const profileMap = new Map<
      number,
      { is_system_locked: boolean; is_ai_renamable: boolean }
    >();

    if (profiles) {
      for (const profile of profiles) {
        profileMap.set(profile.folder_id, {
          is_system_locked: profile.is_system_locked ?? false,
          is_ai_renamable: profile.is_ai_renamable ?? true,
        });
      }
    }

    // 5. 为所有请求的文件夹生成状态
    const result: Record<string, Omit<FolderLockStatus, "folderId">> = {};

    for (const folderId of folderIds) {
      const profile = profileMap.get(folderId);
      result[folderId.toString()] = {
        isLocked: profile?.is_system_locked || false,
        isAiRenamable: profile?.is_ai_renamable ?? true,
      };
    }

    // 输出性能报告
    const perfReport = monitor.getReport();
    logger.info(
      {
        userId: user.id,
        requestedCount: folderIds.length,
        foundCount: profiles?.length || 0,
        performance: {
          totalMs: Math.round(perfReport.totalDuration),
          stages: perfReport.entries.map((e) => ({
            name: e.name,
            ms: Math.round(e.duration),
          })),
        },
      },
      "Batch lock status query completed",
    );

    return NextResponse.json({
      success: true,
      data: result,
      // 开发环境返回性能数据
      ...(process.env.NODE_ENV === "development" && {
        _performance: monitor.toJSON(),
      }),
    });
  } catch (error) {
    const perfReport = monitor.getReport();
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        performance: {
          totalMs: Math.round(perfReport.totalDuration),
          failedAt: perfReport.entries[perfReport.entries.length - 1]?.name,
        },
      },
      "POST /api/folders/batch-lock-status error",
    );
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 },
    );
  }
}
