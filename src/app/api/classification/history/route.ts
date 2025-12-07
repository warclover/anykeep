/**
 * 分类建议历史 API
 * GET /api/classification/history - 获取分类建议历史记录
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

interface SuggestionHistoryItem {
  id: number;
  bookmarkId: number;
  bookmarkTitle: string;
  suggestedFolderName: string;
  confidence: number;
  status: "pending" | "accepted" | "rejected" | "expired";
  reason: string | null;
  suggestNewFolder: boolean;
  createdAt: string;
  processedAt: string | null;
}

interface HistoryStats {
  total: number;
  accepted: number;
  rejected: number;
  pending: number;
  acceptanceRate: number;
}

/**
 * GET /api/classification/history
 * 获取分类建议历史记录
 */
export async function GET(request: Request) {
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

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status"); // 'pending', 'accepted', 'rejected', 'expired', or null for all

    // 3. 获取分类建议历史（包含书签信息）
    let query = supabase
      .from("classification_suggestions")
      .select(
        `
        id,
        bookmark_id,
        suggested_folder_name,
        suggest_new_folder,
        confidence,
        status,
        reason,
        created_at,
        processed_at,
        bookmarks!inner(title)
      `,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (
      status &&
      ["pending", "accepted", "rejected", "expired"].includes(status)
    ) {
      query = query.eq(
        "status",
        status as "pending" | "accepted" | "rejected" | "expired",
      );
    }

    const { data: suggestions, error: suggestionsError } = await query;

    if (suggestionsError) {
      logger.error(
        { error: suggestionsError },
        "Failed to fetch classification history",
      );
      return internalError("获取分类历史失败");
    }

    // 4. 获取统计数据
    const { data: stats, error: statsError } = await supabase
      .from("classification_suggestions")
      .select("status")
      .eq("user_id", user.id);

    if (statsError) {
      logger.error({ error: statsError }, "Failed to fetch history stats");
    }

    // 计算统计
    const historyStats: HistoryStats = {
      total: stats?.length || 0,
      accepted: stats?.filter((s) => s.status === "accepted").length || 0,
      rejected: stats?.filter((s) => s.status === "rejected").length || 0,
      pending: stats?.filter((s) => s.status === "pending").length || 0,
      acceptanceRate: 0,
    };

    const processed = historyStats.accepted + historyStats.rejected;
    if (processed > 0) {
      historyStats.acceptanceRate = Math.round(
        (historyStats.accepted / processed) * 100,
      );
    }

    // 5. 转换数据格式
    const historyItems: SuggestionHistoryItem[] = (suggestions || []).map(
      (item: Record<string, unknown>) => ({
        id: item.id as number,
        bookmarkId: item.bookmark_id as number,
        bookmarkTitle:
          ((item.bookmarks as Record<string, unknown>)?.title as string) ||
          "未知标题",
        suggestedFolderName: item.suggested_folder_name as string,
        confidence: item.confidence as number,
        status: item.status as SuggestionHistoryItem["status"],
        reason: item.reason as string | null,
        suggestNewFolder: item.suggest_new_folder as boolean,
        createdAt: item.created_at as string,
        processedAt: item.processed_at as string | null,
      }),
    );

    // 6. 返回结果
    return successResponse({
      items: historyItems,
      stats: historyStats,
      pagination: {
        limit,
        offset,
        hasMore: historyItems.length === limit,
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/classification/history error",
    );
    return internalError("获取分类历史失败");
  }
}
