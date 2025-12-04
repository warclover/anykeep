/**
 * 用途标签设置 API 路由
 * GET /api/settings/usage-tags - 获取用户的自定义用途标签
 * POST /api/settings/usage-tags - 创建新的自定义用途标签
 * PUT /api/settings/usage-tags - 更新自定义用途标签
 * DELETE /api/settings/usage-tags - 删除自定义用途标签
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type {
  CustomUsageTag,
  ProfileSettings,
  CustomTagColor,
  Json,
} from "@/types/supabase";
import { CUSTOM_USAGE_TAG_LIMIT, CUSTOM_TAG_COLORS } from "@/types/supabase";
import {
  validateCustomTagValue,
  createCustomUsageTag,
} from "@/lib/constants/usage-tags";

// 错误消息常量
const USAGE_TAG_MESSAGES = {
  LOAD_ERROR: "加载用途标签失败",
  CREATE_ERROR: "创建用途标签失败",
  UPDATE_ERROR: "更新用途标签失败",
  DELETE_ERROR: "删除用途标签失败",
  LIMIT_EXCEEDED: `自定义用途标签数量已达上限（${CUSTOM_USAGE_TAG_LIMIT}个）`,
  TAG_NOT_FOUND: "标签不存在",
  INVALID_COLOR: "无效的颜色值",
};

/**
 * GET /api/settings/usage-tags
 * 获取用户的自定义用途标签
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 获取用户的 settings
    const { data: profile, error: queryError } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single();

    if (queryError) {
      return databaseError(USAGE_TAG_MESSAGES.LOAD_ERROR, queryError);
    }

    const settings = (profile?.settings as ProfileSettings) || {};
    const customUsageTags = settings.customUsageTags || [];

    return successResponse({
      customUsageTags,
      limit: CUSTOM_USAGE_TAG_LIMIT,
      remaining: CUSTOM_USAGE_TAG_LIMIT - customUsageTags.length,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "get_usage_tags",
      },
      "GET /api/settings/usage-tags error",
    );
    return internalError(USAGE_TAG_MESSAGES.LOAD_ERROR);
  }
}

/**
 * POST /api/settings/usage-tags
 * 创建新的自定义用途标签
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 解析请求体
    const body = await request.json();
    const { value, color = "blue" } = body as {
      value: string;
      color?: CustomTagColor;
    };

    // 验证颜色
    if (!CUSTOM_TAG_COLORS.includes(color as CustomTagColor)) {
      return badRequestError(USAGE_TAG_MESSAGES.INVALID_COLOR);
    }

    // 获取现有设置
    const { data: profile, error: queryError } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single();

    if (queryError) {
      return databaseError(USAGE_TAG_MESSAGES.CREATE_ERROR, queryError);
    }

    const settings = (profile?.settings as ProfileSettings) || {};
    const existingTags = settings.customUsageTags || [];

    // 检查数量限制
    if (existingTags.length >= CUSTOM_USAGE_TAG_LIMIT) {
      return badRequestError(USAGE_TAG_MESSAGES.LIMIT_EXCEEDED);
    }

    // 验证标签值
    const validation = validateCustomTagValue(value, existingTags);
    if (!validation.valid) {
      return badRequestError(validation.error || "标签值无效");
    }

    // 创建新标签
    const newTag = createCustomUsageTag(value, color);
    const updatedTags = [...existingTags, newTag];

    // 更新 settings
    const newSettings: ProfileSettings = {
      ...settings,
      customUsageTags: updatedTags,
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        settings: newSettings as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      return databaseError(USAGE_TAG_MESSAGES.CREATE_ERROR, updateError);
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
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "create_usage_tag",
      },
      "POST /api/settings/usage-tags error",
    );
    return internalError(USAGE_TAG_MESSAGES.CREATE_ERROR);
  }
}

/**
 * PUT /api/settings/usage-tags
 * 更新自定义用途标签
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 解析请求体
    const body = await request.json();
    const { id, value, color, lastUsedAt } = body as {
      id: string;
      value?: string;
      color?: CustomTagColor;
      lastUsedAt?: string;
    };

    if (!id) {
      return badRequestError("缺少标签ID");
    }

    // 获取现有设置
    const { data: profile, error: queryError } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single();

    if (queryError) {
      return databaseError(USAGE_TAG_MESSAGES.UPDATE_ERROR, queryError);
    }

    const settings = (profile?.settings as ProfileSettings) || {};
    const existingTags = settings.customUsageTags || [];

    // 查找要更新的标签
    const tagIndex = existingTags.findIndex((tag) => tag.id === id);
    if (tagIndex === -1) {
      return badRequestError(USAGE_TAG_MESSAGES.TAG_NOT_FOUND);
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
      return badRequestError(USAGE_TAG_MESSAGES.INVALID_COLOR);
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

    // 更新 settings
    const newSettings: ProfileSettings = {
      ...settings,
      customUsageTags: updatedTags,
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        settings: newSettings as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      return databaseError(USAGE_TAG_MESSAGES.UPDATE_ERROR, updateError);
    }

    return successResponse({
      tag: updatedTag,
      customUsageTags: updatedTags,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "update_usage_tag",
      },
      "PUT /api/settings/usage-tags error",
    );
    return internalError(USAGE_TAG_MESSAGES.UPDATE_ERROR);
  }
}

/**
 * DELETE /api/settings/usage-tags
 * 删除自定义用途标签
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 从 URL 参数获取标签 ID
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return badRequestError("缺少标签ID");
    }

    // 获取现有设置
    const { data: profile, error: queryError } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single();

    if (queryError) {
      return databaseError(USAGE_TAG_MESSAGES.DELETE_ERROR, queryError);
    }

    const settings = (profile?.settings as ProfileSettings) || {};
    const existingTags = settings.customUsageTags || [];

    // 查找要删除的标签
    const tagIndex = existingTags.findIndex((tag) => tag.id === id);
    if (tagIndex === -1) {
      return badRequestError(USAGE_TAG_MESSAGES.TAG_NOT_FOUND);
    }

    // 删除标签
    const updatedTags = existingTags.filter((tag) => tag.id !== id);

    // 更新 settings
    const newSettings: ProfileSettings = {
      ...settings,
      customUsageTags: updatedTags,
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        settings: newSettings as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      return databaseError(USAGE_TAG_MESSAGES.DELETE_ERROR, updateError);
    }

    return successResponse({
      customUsageTags: updatedTags,
      remaining: CUSTOM_USAGE_TAG_LIMIT - updatedTags.length,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "delete_usage_tag",
      },
      "DELETE /api/settings/usage-tags error",
    );
    return internalError(USAGE_TAG_MESSAGES.DELETE_ERROR);
  }
}
