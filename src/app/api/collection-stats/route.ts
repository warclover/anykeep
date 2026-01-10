/**
 * Collection Stats API
 *
 * GET /api/collection-stats - 获取收藏统计数据用于整理前后对比
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { OrganizeSnapshot } from "@/lib/organize/types";

/**
 * GET /api/collection-stats
 * 获取收藏统计快照
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

    // 2. 获取总数
    const { count: total, error: totalError } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (totalError) {
      logger.error({ error: totalError }, "Failed to count total bookmarks");
      throw totalError;
    }

    // 3. 获取未分类数量（没有 folder_id 的书签）
    const { count: uncategorized, error: uncategorizedError } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .is("folder_id", null);

    if (uncategorizedError) {
      logger.error(
        { error: uncategorizedError },
        "Failed to count uncategorized bookmarks",
      );
      throw uncategorizedError;
    }

    // 4. 获取重复数量（暂时简化处理，后续可添加 RPC 函数）
    // TODO: 实现 count_duplicate_urls RPC 函数用于准确检测重复
    const duplicates = 0;

    // 5. 获取无标签数量（user_tags 和 ai_tags 都为空）
    // 注意：Supabase 的空数组检查使用 {} 语法
    const { count: untagged, error: untaggedError } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .or("user_tags.is.null,user_tags.eq.{}");

    if (untaggedError) {
      logger.error(
        { error: untaggedError },
        "Failed to count untagged bookmarks",
      );
      throw untaggedError;
    }

    // 6. 获取长期未读数量（超过 90 天未访问）
    // 暂时基于创建时间判断，后续可添加访问追踪
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 90);

    const { count: stale, error: staleError } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .lt("created_at", staleDate.toISOString());

    if (staleError) {
      logger.error({ error: staleError }, "Failed to count stale bookmarks");
      throw staleError;
    }

    // 7. 构建快照响应
    const snapshot: OrganizeSnapshot = {
      timestamp: new Date().toISOString(),
      total: total || 0,
      uncategorized: uncategorized || 0,
      duplicates,
      untagged: untagged || 0,
      stale: stale || 0,
    };

    return successResponse(snapshot);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/collection-stats error",
    );
    return internalError("获取统计数据失败");
  }
}
