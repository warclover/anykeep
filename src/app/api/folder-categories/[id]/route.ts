/**
 * 单个栏目管理 API 路由
 * PATCH /api/folder-categories/[id] - 更新栏目
 * DELETE /api/folder-categories/[id] - 删除栏目
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import { updateCategorySchema } from "@/lib/validation";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  badRequestError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * PATCH /api/folder-categories/[id]
 * 更新栏目信息
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idStr } = await params;
    const categoryId = parseInt(idStr, 10);
    if (isNaN(categoryId)) {
      return badRequestError("Invalid category ID");
    }

    const { user, error: authError } = await getCachedUser();
    if (authError || !user) {
      return unauthorizedError();
    }

    const supabase = await createClient();

    const body = await request.json();
    const validation = updateCategorySchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (validation.data.name !== undefined) {
      updateData.name = validation.data.name;
    }
    if (validation.data.icon !== undefined) {
      updateData.icon = validation.data.icon;
    }
    if (validation.data.color !== undefined) {
      updateData.color = validation.data.color;
    }
    if (validation.data.sort_order !== undefined) {
      updateData.sort_order = validation.data.sort_order;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: category, error: updateError } = await (supabase as any)
      .from("folder_categories")
      .update(updateData)
      .eq("id", categoryId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      return databaseError("更新栏目失败", updateError);
    }

    if (!category) {
      return badRequestError("栏目不存在");
    }

    return successResponse(category);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        operation: "update_folder_category",
      },
      "PATCH /api/folder-categories/[id] error",
    );
    return internalError("更新栏目失败");
  }
}

/**
 * DELETE /api/folder-categories/[id]
 * 删除栏目（栏目下的文件夹会变为未分类）
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idStr } = await params;
    const categoryId = parseInt(idStr, 10);
    if (isNaN(categoryId)) {
      return badRequestError("Invalid category ID");
    }

    const { user, error: authError } = await getCachedUser();
    if (authError || !user) {
      return unauthorizedError();
    }

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    await sb
      .from("folders")
      .update({ category_id: null, updated_at: new Date().toISOString() })
      .eq("category_id", categoryId)
      .eq("user_id", user.id);

    const { error: deleteError } = await sb
      .from("folder_categories")
      .delete()
      .eq("id", categoryId)
      .eq("user_id", user.id);

    if (deleteError) {
      return databaseError("删除栏目失败", deleteError);
    }

    return successResponse({ success: true, message: "栏目已删除" });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        operation: "delete_folder_category",
      },
      "DELETE /api/folder-categories/[id] error",
    );
    return internalError("删除栏目失败");
  }
}
