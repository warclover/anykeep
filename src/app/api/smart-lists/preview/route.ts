/**
 * 智能列表预览 API 路由
 * POST /api/smart-lists/preview - 预览筛选结果数量
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { previewSmartListSchema } from "@/lib/validation/smart-list";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { SmartListFilters } from "@/types/smart-list";

/**
 * 根据筛选条件构建 Supabase 查询
 */
function buildFilterQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: SmartListFilters,
  userId: string,
) {
  // 基础条件
  query = query
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("is_in_trash", false);

  // 平台筛选
  if (filters.platform) {
    if (filters.platform === "browser") {
      query = query.in("platform", [
        "BROWSER_CHROME",
        "BROWSER_EDGE",
        "BROWSER_FIREFOX",
        "BROWSER_SAFARI",
      ]);
    } else if (Array.isArray(filters.platform)) {
      query = query.in("platform", filters.platform);
    } else {
      query = query.eq("platform", filters.platform);
    }
  }

  // 排除平台
  if (filters.excludePlatforms && filters.excludePlatforms.length > 0) {
    query = query.not(
      "platform",
      "in",
      `(${filters.excludePlatforms.map((p) => `"${p}"`).join(",")})`,
    );
  }

  // 文件夹筛选
  if (filters.folderId !== undefined) {
    if (filters.folderId === "uncategorized") {
      query = query.is("folder_id", null);
    } else {
      query = query.eq("folder_id", filters.folderId);
    }
  }

  // 用途标签筛选
  if (filters.usageTags && filters.usageTags.length > 0) {
    query = query.overlaps("user_tags", filters.usageTags);
  }

  // AI 标签筛选
  if (filters.aiTags && filters.aiTags.length > 0) {
    query = query.overlaps("ai_tags", filters.aiTags);
  }

  // 时间范围筛选
  if (filters.dateRange) {
    if (
      filters.dateRange.type === "relative" &&
      filters.dateRange.value &&
      filters.dateRange.unit
    ) {
      const now = new Date();
      const from = new Date(now);
      const { value, unit } = filters.dateRange;

      switch (unit) {
        case "day":
          from.setDate(from.getDate() - value);
          break;
        case "week":
          from.setDate(from.getDate() - value * 7);
          break;
        case "month":
          from.setMonth(from.getMonth() - value);
          break;
        case "year":
          from.setFullYear(from.getFullYear() - value);
          break;
      }

      query = query.gte("created_at", from.toISOString());
    } else if (filters.dateRange.type === "absolute") {
      if (filters.dateRange.from) {
        query = query.gte("created_at", filters.dateRange.from);
      }
      if (filters.dateRange.to) {
        query = query.lte("created_at", filters.dateRange.to);
      }
    }
  }

  // 阅读状态
  if (filters.isRead !== undefined) {
    query = query.eq("is_read", filters.isRead);
  }

  // 星标状态
  if (filters.isStarred !== undefined) {
    query = query.eq("is_starred", filters.isStarred);
  }

  // 有效性状态
  if (filters.isInvalid !== undefined) {
    query = query.eq("is_invalid", filters.isInvalid);
  }

  // 高价值（rating = 5）
  if (filters.isHighValue === true) {
    query = query.eq("rating", 5);
  }

  // 评级范围
  if (filters.rating) {
    if (filters.rating.min !== undefined) {
      query = query.gte("rating", filters.rating.min);
    }
    if (filters.rating.max !== undefined) {
      query = query.lte("rating", filters.rating.max);
    }
  }

  // 关键词搜索
  if (filters.keyword) {
    query = query.or(
      `title.ilike.%${filters.keyword}%,description.ilike.%${filters.keyword}%`,
    );
  }

  // 来源名称
  if (filters.sourceName) {
    query = query.ilike("source_name", `%${filters.sourceName}%`);
  }

  return query;
}

/**
 * POST /api/smart-lists/preview
 * 预览筛选条件匹配的书签数量
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

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = previewSmartListSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { filters } = validation.data;

    // 3. 构建计数查询
    let query = supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true });

    query = buildFilterQuery(query, filters, user.id);

    // 4. 执行查询
    const { count, error: queryError } = await query;

    if (queryError) {
      logger.error(
        {
          error: queryError,
          userId: user.id,
          filters,
          operation: "preview_smart_list",
        },
        "Failed to preview smart list",
      );
      return databaseError("预览失败", queryError);
    }

    return successResponse({
      count: count ?? 0,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "preview_smart_list",
      },
      "POST /api/smart-lists/preview error",
    );
    return internalError("预览失败");
  }
}
