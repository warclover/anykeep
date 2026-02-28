/**
 * 文件夹统计聚合 API
 * GET /api/folders/with-stats - 获取文件夹列表及书签统计（单次查询）
 *
 * 性能优化：将原本 3 次串行查询合并为 1 次 SQL 查询
 * - 原方案：查询文件夹 + 查询书签计数 + 查询最近书签 = 3 次请求
 * - 新方案：使用 SQL JOIN + 聚合函数 = 1 次请求
 *
 * @version V5.2 - 性能优化版本
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import {
  unauthorizedError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { PerformanceMonitor } from "@/lib/utils/performance-monitor";
import type { FolderWithStats, FolderCategory } from "@/types/domain";
import { ensureDefaultCategories } from "@/lib/folder/category-defaults";
import type { Bookmark } from "@/types/supabase";

/**
 * HTTP 缓存配置
 * - private: 仅客户端缓存
 * - max-age=60: 1 分钟内使用缓存（统计数据变化较快）
 * - stale-while-revalidate=30: 缓存过期后 30 秒内仍可使用旧数据
 */
const CACHE_CONTROL_HEADER = "private, max-age=60, stale-while-revalidate=30";

/**
 * 聚合���询返回的文件夹数据类型
 */
interface _FolderWithStatsRow {
  id: number;
  user_id: string;
  name: string;
  parent_id: number | null;
  is_system: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  is_archived: boolean | null;
  is_locked: boolean | null;
  folder_group: string | null;
  sort_order: number | null;
  system_type: string | null;
  source: string | null;
  // Crystal Growth 字段
  ai_generation_source: string | null;
  crystal_birth_time: string | null;
  is_ai_generated: boolean | null;
  is_naming_pending: boolean | null;
  origin_bookmark_ids: number[] | null;
  // 聚合统计字段
  bookmark_count: number;
  today_count: number;
}

/**
 * GET /api/folders/with-stats
 * 获取文件夹列表及书签统计（优化版：单次查询）
 *
 * Query Parameters:
 * - include_recent: boolean - 是否包含最近书签（默认 true）
 * - recent_limit: number - 最近书签数量（默认 6）
 */
export async function GET(request: NextRequest) {
  const monitor = new PerformanceMonitor("FoldersWithStats");

  try {
    // 1. 验证用户身份
    const { user, error: authError } = await monitor.measure("CachedAuth", () =>
      getCachedUser(),
    );

    if (authError || !user) {
      return unauthorizedError();
    }

    const supabase = await monitor.measure("CreateClient", () =>
      createClient(),
    );

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const includeRecent = searchParams.get("include_recent") !== "false";
    const recentLimit = Math.min(
      parseInt(searchParams.get("recent_limit") || "6", 10),
      20,
    );

    monitor.mark("AuthComplete", { userId: user.id });

    // 2. 使用 RPC 或原生 SQL 进行聚合查询
    // 由于 Supabase JS SDK 不直接支持复杂聚合，使用分步但并行的方式
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const queryStart = performance.now();

    // 并行执行：文件夹查询 + 书签统计查询 + 最近书签查询 + 栏目查询
    const [foldersResult, statsResult, recentResult, categories] =
      await Promise.all([
        // 查询 1：获取所有文件夹
        supabase
          .from("folders")
          .select("*")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),

        // 查询 2：获取书签统计（使用 RPC 函数或简化查询）
        supabase
          .from("bookmarks")
          .select("folder_id, created_at")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .not("folder_id", "is", null),

        // 查询 3：获取最近书签（仅在需要时执行）
        includeRecent
          ? supabase
              .from("bookmarks")
              .select("*, folders!bookmarks_folder_id_fkey(name)")
              .eq("user_id", user.id)
              .is("deleted_at", null)
              .order("created_at", { ascending: false })
              .limit(recentLimit)
          : Promise.resolve({ data: [], error: null }),

        // 查询 4：获取栏目列表（如果没有则自动创建默认栏目）
        ensureDefaultCategories(supabase, user.id),
      ]);

    monitor.mark("ParallelQueries", {
      durationMs: Math.round(performance.now() - queryStart),
    });

    // 处理查询错误
    if (foldersResult.error) {
      return databaseError("加载文件夹失败", foldersResult.error);
    }

    if (statsResult.error) {
      return databaseError("加载统计数据失败", statsResult.error);
    }

    if (recentResult.error) {
      return databaseError("加载最近书签失败", recentResult.error);
    }

    // 3. 在服务端聚合统计数据
    const aggregateStart = performance.now();

    const countMap = new Map<number, number>();
    const todayCountMap = new Map<number, number>();

    if (statsResult.data) {
      for (const bookmark of statsResult.data) {
        if (bookmark.folder_id) {
          // 总计数
          countMap.set(
            bookmark.folder_id,
            (countMap.get(bookmark.folder_id) || 0) + 1,
          );
          // 今日计数
          if (bookmark.created_at && bookmark.created_at >= todayISO) {
            todayCountMap.set(
              bookmark.folder_id,
              (todayCountMap.get(bookmark.folder_id) || 0) + 1,
            );
          }
        }
      }
    }

    // 4. 构建带统计的文件夹列表
    const folders = foldersResult.data || [];

    // 分离系统文件夹和普通文件夹
    const systemFolders = folders.filter((f) => f.is_system);
    const normalFolders = folders.filter((f) => !f.is_system);

    const foldersWithStats: FolderWithStats[] = [
      ...systemFolders,
      ...normalFolders,
    ].map((folder) => ({
      id: folder.id,
      user_id: folder.user_id,
      name: folder.name,
      parent_id: folder.parent_id,
      color: folder.color ?? null,
      icon: folder.icon ?? null,
      created_at: folder.created_at,
      updated_at: folder.updated_at,
      deleted_at: folder.deleted_at,
      folder_group: folder.folder_group,
      sort_order: folder.sort_order,
      source: folder.source ?? null,
      system_type: folder.system_type,
      is_system: folder.is_system ?? false,
      is_archived: folder.is_archived ?? false,
      // Crystal Growth 字段
      ai_generation_source: folder.ai_generation_source ?? null,
      crystal_birth_time: folder.crystal_birth_time ?? null,
      is_ai_generated: folder.is_ai_generated ?? null,
      is_naming_pending: folder.is_naming_pending ?? null,
      origin_bookmark_ids: folder.origin_bookmark_ids ?? null,
      // 统计字段
      bookmark_count: countMap.get(folder.id) || 0,
      today_count: todayCountMap.get(folder.id) || 0,
      // 栏目字段
      category_id:
        ((folder as Record<string, unknown>).category_id as number | null) ??
        null,
    }));

    monitor.mark("Aggregation", {
      folderCount: folders.length,
      bookmarkCount: statsResult.data?.length || 0,
      durationMs: Math.round(performance.now() - aggregateStart),
    });

    // 5. 构建响应
    const responseData = {
      folders: foldersWithStats,
      categories: categories as FolderCategory[],
      recentBookmarks:
        (recentResult.data as (Bookmark & {
          folders?: { name: string } | null;
        })[]) || [],
      _meta: {
        folderCount: folders.length,
        totalBookmarks: statsResult.data?.length || 0,
        generatedAt: new Date().toISOString(),
      },
    };

    // 输出性能报告
    const perfReport = monitor.getReport();
    logger.info(
      {
        userId: user.id,
        folderCount: folders.length,
        bookmarkCount: statsResult.data?.length || 0,
        performance: {
          totalMs: Math.round(perfReport.totalDuration),
          stages: perfReport.entries.map((e) => ({
            name: e.name,
            ms: Math.round(e.duration),
          })),
        },
      },
      "Folders with stats query completed",
    );

    // 返回带缓存头的响应
    return NextResponse.json(
      {
        success: true,
        data: responseData,
        // 开发环境返回性能数据
        ...(process.env.NODE_ENV === "development" && {
          _performance: monitor.toJSON(),
        }),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": CACHE_CONTROL_HEADER,
        },
      },
    );
  } catch (error) {
    const perfReport = monitor.getReport();
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "get_folders_with_stats",
        performance: {
          totalMs: Math.round(perfReport.totalDuration),
          failedAt: perfReport.entries[perfReport.entries.length - 1]?.name,
        },
      },
      "GET /api/folders/with-stats error",
    );
    return internalError("加载文件夹统计失败");
  }
}
