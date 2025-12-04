/**
 * 用途标签设置 API 路由
 * GET /api/settings/usage-tags - 获取用户的自定义用途标签
 * POST /api/settings/usage-tags - 创建新的自定义用途标签
 * PUT /api/settings/usage-tags - 更新自定义用途标签
 * DELETE /api/settings/usage-tags - 删除自定义用途标签
 */

import type { NextRequest } from "next/server";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import type { CustomUsageTag, CustomTagColor } from "@/types/supabase";
import { CUSTOM_USAGE_TAG_LIMIT, CUSTOM_TAG_COLORS } from "@/types/supabase";
import {
  validateCustomTagValue,
  createCustomUsageTag,
} from "@/lib/constants/usage-tags";
import {
  getAuthenticatedUser,
  getUserSettings,
  updateUserCustomTags,
  logApiError,
} from "@/lib/utils/usage-tags-api-helpers";

// 错误消息常量
const MESSAGES = {
  LOAD_ERROR: "加载用途标签失败",
  CREATE_ERROR: "创建用途标签失败",
  UPDATE_ERROR: "更新用途标签失败",
  DELETE_ERROR: "删除用途标签失败",
  LIMIT_EXCEEDED: `自定义用途标签数量已达上限（${CUSTOM_USAGE_TAG_LIMIT}个）`,
  TAG_NOT_FOUND: "标签不存在",
  INVALID_COLOR: "无效的颜色值",
  MISSING_TAG_ID: "缺少标签ID",
} as const;

/**
 * GET /api/settings/usage-tags
 * 获取用户的自定义用途标签
 */
export async function GET() {
  try {
    // 认证
    const authResult = await getAuthenticatedUser();
    if (!authResult.success) {
      return unauthorizedError();
    }
    const { supabase, user } = authResult;

    // 获取设置
    const settingsResult = await getUserSettings(supabase, user.id);
    if (!settingsResult.success) {
      return databaseError(MESSAGES.LOAD_ERROR, settingsResult.error);
    }
    const { customUsageTags } = settingsResult;

    return successResponse({
      customUsageTags,
      limit: CUSTOM_USAGE_TAG_LIMIT,
      remaining: CUSTOM_USAGE_TAG_LIMIT - customUsageTags.length,
    });
  } catch (error) {
    logApiError(error, "get_usage_tags", "GET /api/settings/usage-tags");
    return internalError(MESSAGES.LOAD_ERROR);
  }
}

/**
 * POST /api/settings/usage-tags
 * 创建新的自定义用途标签
 */
export async function POST(request: NextRequest) {
  try {
    // 认证
    const authResult = await getAuthenticatedUser();
    if (!authResult.success) {
      return unauthorizedError();
    }
    const { supabase, user } = authResult;

    // 解析请求体
    const body = await request.json();
    const { value, color = "blue" } = body as {
      value: string;
      color?: CustomTagColor;
    };

    // 验证颜色
    if (!CUSTOM_TAG_COLORS.includes(color as CustomTagColor)) {
      return badRequestError(MESSAGES.INVALID_COLOR);
    }

    // 获取设置
    const settingsResult = await getUserSettings(supabase, user.id);
    if (!settingsResult.success) {
      return databaseError(MESSAGES.CREATE_ERROR, settingsResult.error);
    }
    const { settings, customUsageTags: existingTags } = settingsResult;

    // 检查数量限制
    if (existingTags.length >= CUSTOM_USAGE_TAG_LIMIT) {
      return badRequestError(MESSAGES.LIMIT_EXCEEDED);
    }

    // 验证标签值
    const validation = validateCustomTagValue(value, existingTags);
    if (!validation.valid) {
      return badRequestError(validation.error || "标签值无效");
    }

    // 创建新标签
    const newTag = createCustomUsageTag(value, color);
    const updatedTags = [...existingTags, newTag];

    // 更新设置
    const updateResult = await updateUserCustomTags(
      supabase,
      user.id,
      settings,
      updatedTags,
    );
    if (!updateResult.success) {
      return databaseError(MESSAGES.CREATE_ERROR, updateResult.error);
    }

    return successResponse(
      {
        tag: newTag,
        customUsageTags: updatedTags,
        remaining: CUSTOM_USAGE_TAG_LIMIT - updatedTags.length,
      },
      201,
    );
  } catch (error) {
    logApiError(error, "create_usage_tag", "POST /api/settings/usage-tags");
    return internalError(MESSAGES.CREATE_ERROR);
  }
}

/**
 * PUT /api/settings/usage-tags
 * 更新自定义用途标签
 */
export async function PUT(request: NextRequest) {
  try {
    // 认证
    const authResult = await getAuthenticatedUser();
    if (!authResult.success) {
      return unauthorizedError();
    }
    const { supabase, user } = authResult;

    // 解析请求体
    const body = await request.json();
    const { id, value, color, lastUsedAt } = body as {
      id: string;
      value?: string;
      color?: CustomTagColor;
      lastUsedAt?: string;
    };

    if (!id) {
      return badRequestError(MESSAGES.MISSING_TAG_ID);
    }

    // 获取设置
    const settingsResult = await getUserSettings(supabase, user.id);
    if (!settingsResult.success) {
      return databaseError(MESSAGES.UPDATE_ERROR, settingsResult.error);
    }
    const { settings, customUsageTags: existingTags } = settingsResult;

    // 查找要更新的标签
    const tagIndex = existingTags.findIndex((tag) => tag.id === id);
    if (tagIndex === -1) {
      return badRequestError(MESSAGES.TAG_NOT_FOUND);
    }

    const existingTag = existingTags[tagIndex];

    // 如果更新 value，验证唯一性
    if (value !== undefined && value !== existingTag.value) {
      const validation = validateCustomTagValue(value, existingTags, id);
      if (!validation.valid) {
        return badRequestError(validation.error || "标签值无效");
      }
    }

    // 如果更新 color，验证颜色值
    if (color !== undefined && !CUSTOM_TAG_COLORS.includes(color)) {
      return badRequestError(MESSAGES.INVALID_COLOR);
    }

    // 更新标签
    const updatedTag: CustomUsageTag = {
      ...existingTag,
      ...(value !== undefined && { value: value.trim(), label: value.trim() }),
      ...(color !== undefined && { color }),
      ...(lastUsedAt !== undefined && { lastUsedAt }),
    };

    const updatedTags = [...existingTags];
    updatedTags[tagIndex] = updatedTag;

    // 更新设置
    const updateResult = await updateUserCustomTags(
      supabase,
      user.id,
      settings,
      updatedTags,
    );
    if (!updateResult.success) {
      return databaseError(MESSAGES.UPDATE_ERROR, updateResult.error);
    }

    return successResponse({
      tag: updatedTag,
      customUsageTags: updatedTags,
    });
  } catch (error) {
    logApiError(error, "update_usage_tag", "PUT /api/settings/usage-tags");
    return internalError(MESSAGES.UPDATE_ERROR);
  }
}

/**
 * DELETE /api/settings/usage-tags
 * 删除自定义用途标签
 */
export async function DELETE(request: NextRequest) {
  try {
    // 认证
    const authResult = await getAuthenticatedUser();
    if (!authResult.success) {
      return unauthorizedError();
    }
    const { supabase, user } = authResult;

    // 从 URL 参数获取标签 ID
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return badRequestError(MESSAGES.MISSING_TAG_ID);
    }

    // 获取设置
    const settingsResult = await getUserSettings(supabase, user.id);
    if (!settingsResult.success) {
      return databaseError(MESSAGES.DELETE_ERROR, settingsResult.error);
    }
    const { settings, customUsageTags: existingTags } = settingsResult;

    // 查找要删除的标签
    const tagIndex = existingTags.findIndex((tag) => tag.id === id);
    if (tagIndex === -1) {
      return badRequestError(MESSAGES.TAG_NOT_FOUND);
    }

    // 删除标签
    const updatedTags = existingTags.filter((tag) => tag.id !== id);

    // 更新设置
    const updateResult = await updateUserCustomTags(
      supabase,
      user.id,
      settings,
      updatedTags,
    );
    if (!updateResult.success) {
      return databaseError(MESSAGES.DELETE_ERROR, updateResult.error);
    }

    return successResponse({
      customUsageTags: updatedTags,
      remaining: CUSTOM_USAGE_TAG_LIMIT - updatedTags.length,
    });
  } catch (error) {
    logApiError(error, "delete_usage_tag", "DELETE /api/settings/usage-tags");
    return internalError(MESSAGES.DELETE_ERROR);
  }
}
