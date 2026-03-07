/**
 * 栏目管理 API 路由
 * GET /api/folder-categories - 获取栏目列表
 * POST /api/folder-categories - 创建新栏目
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { createCategorySchema } from "@/lib/validation";
import {
  successResponse,
  handleValidationError,
  databaseError,
} from "@/lib/utils/api-response";

/**
 * GET /api/folder-categories
 * 获取当前用户的所有栏目
 */
export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: categories, error: queryError } = await (supabase as any)
      .from("folder_categories")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (queryError) {
      return databaseError("加载栏目失败", queryError);
    }

    return successResponse(categories || []);
  },
);

/**
 * POST /api/folder-categories
 * 创建新栏目
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    const body = await request.json();
    const validation = createCategorySchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { name, icon, color } = validation.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { data: maxOrderRow } = await sb
      .from("folder_categories")
      .select("sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrderRow?.sort_order ?? -1) + 1;

    const { data: category, error: createError } = await sb
      .from("folder_categories")
      .insert({
        user_id: userId,
        name,
        icon: icon || null,
        color: color || null,
        sort_order: nextOrder,
        is_default: false,
      })
      .select()
      .single();

    if (createError) {
      return databaseError("创建栏目失败", createError);
    }

    return successResponse(category);
  },
);
