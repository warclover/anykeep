/**
 * 分类建议管理 API
 * GET /api/reclassify/suggestions - 获取待处理建议
 * POST /api/reclassify/suggestions - 批量处理建议（接受/拒绝）
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { SuggestionStatus } from "@/types/supabase";

// 有效的状态值
const VALID_STATUSES: SuggestionStatus[] = [
  "pending",
  "accepted",
  "rejected",
  "expired",
];

// 处理建议的请求体验证
const processSuggestionsSchema = z.object({
  action: z.enum(["accept", "reject", "accept_all", "reject_all"]),
  suggestionIds: z.array(z.number().int().positive()).optional(),
});

/**
 * GET /api/reclassify/suggestions
 * 获取用户的待处理分类建议
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 获取分页参数
    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get("status") || "pending";
    const status = VALID_STATUSES.includes(statusParam as SuggestionStatus)
      ? (statusParam as SuggestionStatus)
      : "pending";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // 3. 查询建议
    const {
      data: suggestions,
      error: queryError,
      count,
    } = await supabase
      .from("classification_suggestions")
      .select(
        `
        id,
        bookmark_id,
        suggested_folder_id,
        suggested_folder_name,
        suggest_new_folder,
        confidence,
        reason,
        status,
        batch_id,
        created_at,
        bookmarks:bookmark_id (
          id,
          title,
          url,
          cover_url,
          platform,
          ai_summary,
          ai_tags
        )
      `,
        { count: "exact" },
      )
      .eq("user_id", user.id)
      .eq("status", status)
      .order("confidence", { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryError) {
      logger.error(
        { error: queryError.message },
        "Failed to fetch suggestions",
      );
      return internalError("获取分类建议失败");
    }

    // 4. 获取统计信息
    const { data: stats } = await supabase
      .from("classification_suggestions")
      .select("status")
      .eq("user_id", user.id);

    const statusCounts = {
      pending: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
    };

    stats?.forEach((s) => {
      if (s.status && s.status in statusCounts) {
        statusCounts[s.status as keyof typeof statusCounts]++;
      }
    });

    return successResponse({
      suggestions: suggestions || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
      stats: statusCounts,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/reclassify/suggestions error",
    );
    return internalError("获取分类建议失败");
  }
}

/**
 * POST /api/reclassify/suggestions
 * 批量处理分类建议
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析请求体
    const body = await request.json();
    const validation = processSuggestionsSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { action, suggestionIds } = validation.data;

    // 3. 处理批量操作
    let processedCount = 0;

    switch (action) {
      case "accept": {
        if (!suggestionIds || suggestionIds.length === 0) {
          return badRequestError("请指定要接受的建议ID");
        }

        const { data: count } = await supabase.rpc(
          "accept_classification_suggestions",
          {
            p_user_id: user.id,
            p_suggestion_ids: suggestionIds,
          },
        );
        processedCount = count ?? 0;
        break;
      }

      case "reject": {
        if (!suggestionIds || suggestionIds.length === 0) {
          return badRequestError("请指定要拒绝的建议ID");
        }

        const { data: count } = await supabase.rpc(
          "reject_classification_suggestions",
          {
            p_user_id: user.id,
            p_suggestion_ids: suggestionIds,
          },
        );
        processedCount = count ?? 0;
        break;
      }

      case "accept_all": {
        // 获取所有待处理建议
        const { data: pending } = await supabase
          .from("classification_suggestions")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "pending");

        if (pending && pending.length > 0) {
          const ids = pending.map((s) => s.id);
          const { data: count } = await supabase.rpc(
            "accept_classification_suggestions",
            {
              p_user_id: user.id,
              p_suggestion_ids: ids,
            },
          );
          processedCount = count ?? 0;
        }
        break;
      }

      case "reject_all": {
        // 获取所有待处理建议
        const { data: pending } = await supabase
          .from("classification_suggestions")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "pending");

        if (pending && pending.length > 0) {
          const ids = pending.map((s) => s.id);
          const { data: count } = await supabase.rpc(
            "reject_classification_suggestions",
            {
              p_user_id: user.id,
              p_suggestion_ids: ids,
            },
          );
          processedCount = count ?? 0;
        }
        break;
      }
    }

    logger.info(
      {
        userId: user.id,
        action,
        processedCount,
        requestedIds: suggestionIds,
      },
      "Classification suggestions processed",
    );

    return successResponse({
      action,
      processedCount,
      message: action.includes("accept")
        ? `已接受 ${processedCount} 条分类建议`
        : `已拒绝 ${processedCount} 条分类建议`,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/reclassify/suggestions error",
    );
    return internalError("处理分类建议失败");
  }
}
