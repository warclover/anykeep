/**
 * 智能列表 API 路由
 * GET /api/smart-lists - 获取智能列表（含书签数量）
 * POST /api/smart-lists - 创建智能列表
 */

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import {
  createSmartListSchema,
  getSmartListsQuerySchema,
} from "@/lib/validation/smart-list";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { SmartList, SmartListFilters } from "@/types/smart-list";
import { toSmartListClient } from "@/types/smart-list";

/**
 * 根据筛选条件构建书签计数查询
 */
function buildFilterQuery(
  supabase: SupabaseClient,
  filters: SmartListFilters,
  userId: string,
) {
  let query = supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
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
 * 计算单个智能列表的书签数量
 */
async function getBookmarkCount(
  supabase: SupabaseClient,
  filters: SmartListFilters,
  userId: string,
): Promise<number> {
  try {
    const query = buildFilterQuery(supabase, filters, userId);
    const { count } = await query;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * GET /api/smart-lists
 * 获取用户的智能列表（含预设）
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份（使用缓存认证，性能优化）
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 创建 Supabase 客户端用于数据库操作
    const supabase = await createClient();

    // 2. 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      includePresets: searchParams.get("includePresets"),
      sortBy: searchParams.get("sortBy"),
    };

    const validation = getSmartListsQuerySchema.safeParse(queryParams);
    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { includePresets, sortBy } = validation.data;

    // 3. 构建查询（明确指定字段，避免 select * 拉取未来可能新增的大字段）
    let query = supabase
      .from("smart_lists")
      .select(
        "id, user_id, name, description, icon, color, filters, sort_by, view_mode, sort_order, is_pinned, is_preset, last_accessed_at, created_at, updated_at, deleted_at",
      )
      .eq("user_id", user.id)
      .is("deleted_at", null);

    // 如果不包含预设，只查询自定义列表
    if (!includePresets) {
      query = query.eq("is_preset", false);
    }

    // 排序
    switch (sortBy) {
      case "name":
        query = query.order("name", { ascending: true });
        break;
      case "created_at":
        query = query.order("created_at", { ascending: false });
        break;
      case "last_accessed_at":
        query = query.order("last_accessed_at", {
          ascending: false,
          nullsFirst: false,
        });
        break;
      case "sort_order":
      default:
        // 置顶优先，然后按排序顺序
        query = query
          .order("is_pinned", { ascending: false })
          .order("sort_order", { ascending: true });
        break;
    }

    // 4. 执行查询
    const { data: smartLists, error: queryError } = await query;

    if (queryError) {
      return databaseError("获取智能列表失败", queryError);
    }

    // 5. 并行计算每个智能列表的书签数量
    const smartListsWithCounts = await Promise.all(
      (smartLists as SmartList[]).map(async (smartList) => {
        const bookmarkCount = await getBookmarkCount(
          supabase,
          smartList.filters as SmartListFilters,
          user.id,
        );
        return { ...smartList, bookmark_count: bookmarkCount };
      }),
    );

    // 6. 转换为前端格式
    const clientSmartLists = smartListsWithCounts.map(toSmartListClient);

    return successResponse({
      smartLists: clientSmartLists,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "get_smart_lists",
      },
      "GET /api/smart-lists error",
    );
    return internalError("获取智能列表失败");
  }
}

/**
 * POST /api/smart-lists
 * 创建新智能列表
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份（使用缓存认证，避免重复验证）
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 创建 Supabase 客户端用于数据库操作
    const supabase = await createClient();

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = createSmartListSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { name, description, icon, color, filters, sortBy, viewMode } =
      validation.data;

    // 3. 检查名称是否已存在
    // 类型断言: 手动维护类型文件时需要此断言
    type SmartListExistingRow = { id: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = (await (supabase.from("smart_lists") as any)
      .select("id")
      .eq("user_id", user.id)
      .eq("name", name)
      .is("deleted_at", null)
      .single()) as { data: SmartListExistingRow | null };

    if (existing) {
      return successResponse({ error: "智能列表名称已存在" }, 400);
    }

    // 4. 获取当前最大排序顺序
    // 类型断言: 手动维护类型文件时需要此断言
    type SortOrderRow = { sort_order: number };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: maxOrder } = (await (supabase.from("smart_lists") as any)
      .select("sort_order")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single()) as { data: SortOrderRow | null };

    const newSortOrder = (maxOrder?.sort_order ?? -1) + 1;

    // 5. 插入新智能列表
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: smartList, error: insertError } = (await (
      supabase.from("smart_lists") as any
    )
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        icon,
        color,
        filters,
        sort_by: sortBy,
        view_mode: viewMode,
        sort_order: newSortOrder,
        is_preset: false,
      })
      .select()
      .single()) as {
      data: SmartList | null;
      error: { message: string } | null;
    };

    if (insertError || !smartList) {
      logger.error(
        {
          error: insertError,
          userId: user.id,
          name,
          operation: "create_smart_list",
        },
        "Failed to create smart list",
      );
      return databaseError("创建智能列表失败", insertError);
    }

    logger.info(
      {
        userId: user.id,
        smartListId: smartList.id,
        name,
        action: "smart_list_created",
      },
      "Smart list created",
    );

    return successResponse(toSmartListClient(smartList as SmartList), 201);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "create_smart_list",
      },
      "POST /api/smart-lists error",
    );
    return internalError("创建智能列表失败");
  }
}
