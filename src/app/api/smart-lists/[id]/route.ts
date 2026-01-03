/**
 * 智能列表详情 API 路由
 * GET /api/smart-lists/:id - 获取智能列表详情
 * PATCH /api/smart-lists/:id - 更新智能列表
 * DELETE /api/smart-lists/:id - 删除智能列表
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  updateSmartListSchema,
  smartListIdParamSchema,
} from "@/lib/validation/smart-list";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  notFoundError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { SmartList } from "@/types/smart-list";
import { toSmartListClient } from "@/types/smart-list";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/smart-lists/:id
 * 获取智能列表详情
 */
export async function GET(request: NextRequest, context: RouteContext) {
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

    // 2. 验证 ID 参数
    const params = await context.params;
    const paramValidation = smartListIdParamSchema.safeParse({ id: params.id });
    if (!paramValidation.success) {
      return handleValidationError(paramValidation.error);
    }

    const { id } = paramValidation.data;

    // 3. 查询智能列表
    const { data: smartList, error: queryError } = await supabase
      .from("smart_lists")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (queryError || !smartList) {
      return notFoundError("智能列表不存在");
    }

    // 4. 更新最后访问时间
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("smart_lists") as any)
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    return successResponse(toSmartListClient(smartList as SmartList));
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "get_smart_list",
      },
      "GET /api/smart-lists/:id error",
    );
    return internalError("获取智能列表失败");
  }
}

/**
 * PATCH /api/smart-lists/:id
 * 更新智能列表
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
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

    // 2. 验证 ID 参数
    const params = await context.params;
    const paramValidation = smartListIdParamSchema.safeParse({ id: params.id });
    if (!paramValidation.success) {
      return handleValidationError(paramValidation.error);
    }

    const { id } = paramValidation.data;

    // 3. 验证请求体
    const body = await request.json();
    const validation = updateSmartListSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const updates = validation.data;

    // 4. 检查智能列表是否存在
    // 类型断言: 手动维护类型文件时需要此断言
    type ExistingSmartListRow = { id: string; is_preset: boolean };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: checkError } = await (supabase.from("smart_lists") as any)
      .select("id, is_preset")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single() as { data: ExistingSmartListRow | null; error: { message: string } | null };

    if (checkError || !existing) {
      return notFoundError("智能列表不存在");
    }

    // 5. 预设列表只允许修改 isPinned
    if (existing.is_preset) {
      const allowedUpdates: Record<string, unknown> = {};
      if (updates.isPinned !== undefined) {
        allowedUpdates.is_pinned = updates.isPinned;
      }

      if (Object.keys(allowedUpdates).length === 0) {
        return successResponse({ error: "预设智能列表只能修改置顶状态" }, 400);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updatedPreset, error: updateError } = await (supabase.from("smart_lists") as any)
        .update(allowedUpdates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single() as { data: SmartList | null; error: { message: string } | null };

      if (updateError) {
        return databaseError("更新智能列表失败", updateError);
      }

      return successResponse(toSmartListClient(updatedPreset as SmartList));
    }

    // 6. 如果修改名称，检查是否重名
    if (updates.name) {
      const { data: nameExists } = await supabase
        .from("smart_lists")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", updates.name)
        .neq("id", id)
        .is("deleted_at", null)
        .single();

      if (nameExists) {
        return successResponse({ error: "智能列表名称已存在" }, 400);
      }
    }

    // 7. 构建更新数据
    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.icon !== undefined) updateData.icon = updates.icon;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.filters !== undefined) updateData.filters = updates.filters;
    if (updates.sortBy !== undefined) updateData.sort_by = updates.sortBy;
    if (updates.viewMode !== undefined) updateData.view_mode = updates.viewMode;
    if (updates.isPinned !== undefined) updateData.is_pinned = updates.isPinned;

    // 8. 执行更新
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: smartList, error: updateError } = await (supabase.from("smart_lists") as any)
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single() as { data: SmartList | null; error: { message: string } | null };

    if (updateError) {
      return databaseError("更新智能列表失败", updateError);
    }

    logger.info(
      {
        userId: user.id,
        smartListId: id,
        updates: Object.keys(updateData),
        action: "smart_list_updated",
      },
      "Smart list updated",
    );

    return successResponse(toSmartListClient(smartList as SmartList));
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "update_smart_list",
      },
      "PATCH /api/smart-lists/:id error",
    );
    return internalError("更新智能列表失败");
  }
}

/**
 * DELETE /api/smart-lists/:id
 * 删除智能列表（软删除）
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
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

    // 2. 验证 ID 参数
    const params = await context.params;
    const paramValidation = smartListIdParamSchema.safeParse({ id: params.id });
    if (!paramValidation.success) {
      return handleValidationError(paramValidation.error);
    }

    const { id } = paramValidation.data;

    // 3. 检查智能列表是否存在
    // 类型断言: 手动维护类型文件时需要此断言
    type ExistingSmartListDeleteRow = { id: string; is_preset: boolean; name: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: checkError } = await (supabase.from("smart_lists") as any)
      .select("id, is_preset, name")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single() as { data: ExistingSmartListDeleteRow | null; error: { message: string } | null };

    if (checkError || !existing) {
      return notFoundError("智能列表不存在");
    }

    // 4. 预设列表不允许删除
    if (existing.is_preset) {
      return successResponse({ error: "预设智能列表不能删除" }, 400);
    }

    // 5. 软删除
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase.from("smart_lists") as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id) as { error: { message: string } | null };

    if (deleteError) {
      return databaseError("删除智能列表失败", deleteError);
    }

    logger.info(
      {
        userId: user.id,
        smartListId: id,
        name: existing.name,
        action: "smart_list_deleted",
      },
      "Smart list deleted",
    );

    return successResponse({ success: true });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "delete_smart_list",
      },
      "DELETE /api/smart-lists/:id error",
    );
    return internalError("删除智能列表失败");
  }
}
