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
  badRequestError,
  databaseError,
} from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { CUSTOM_TAG_COLOR_LIST } from "@/types/supabase";
import type { CustomUsageTag, CustomTagColor } from "@/types/supabase";
import { CUSTOM_USAGE_TAG_LIMIT } from "@/types/supabase";
import {
  validateCustomTagValue,
  createCustomUsageTag,
} from "@/lib/constants/usage-tags";
import {
  getUserSettings,
  updateUserCustomTags,
} from "@/lib/utils/usage-tags-api-helpers";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:settings:usage-tags");

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

/** P1: 用途标签 GET 短期缓存（标签变更频率低） */
const USAGE_TAGS_CACHE = "private, max-age=60, stale-while-revalidate=120";

/**
 * GET /api/settings/usage-tags
 * 获取用户的自定义用途标签
 */
export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const handlerStart = performance.now();

    const supabase = await createClient();

    // 获取设置
    const settingsResult = await getUserSettings(supabase, userId);
    if (!settingsResult.success) {
      return databaseError(MESSAGES.LOAD_ERROR, settingsResult.error);
    }
    const { customUsageTags } = settingsResult;

    const handlerMs = Math.round(performance.now() - handlerStart);
    if (handlerMs > 1000) {
      logger.warn(
        { route: "GET /api/settings/usage-tags", handlerMs },
        "Slow usage-tags handler",
      );
    }
    const res = successResponse({
      customUsageTags,
      limit: CUSTOM_USAGE_TAG_LIMIT,
      remaining: CUSTOM_USAGE_TAG_LIMIT - customUsageTags.length,
    });
    res.headers.set("Cache-Control", USAGE_TAGS_CACHE);
    return res;
  },
);

/**
 * POST /api/settings/usage-tags
 * 创建新的自定义用途标签
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 解析请求体
    const body = await request.json();
    const { value, color = "blue" } = body as {
      value: string;
      color?: CustomTagColor;
    };

    // 验证颜色
    if (!CUSTOM_TAG_COLOR_LIST.includes(color as CustomTagColor)) {
      return badRequestError(MESSAGES.INVALID_COLOR);
    }

    // 获取设置
    const settingsResult = await getUserSettings(supabase, userId);
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
      userId,
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
  },
);

/**
 * PUT /api/settings/usage-tags
 * 更新自定义用途标签
 */
export const PUT = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

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
    const settingsResult = await getUserSettings(supabase, userId);
    if (!settingsResult.success) {
      return databaseError(MESSAGES.UPDATE_ERROR, settingsResult.error);
    }
    const { settings, customUsageTags: existingTags } = settingsResult;

    // 查找要更新的标签
    // 类型断言: CustomUsageTag 运行时包含 id 属性
    const tagIndex = existingTags.findIndex(
      (tag) => (tag as CustomUsageTag & { id: string }).id === id,
    );
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
    if (color !== undefined && !CUSTOM_TAG_COLOR_LIST.includes(color)) {
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
      userId,
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
  },
);

/**
 * DELETE /api/settings/usage-tags
 * 删除自定义用途标签
 */
export const DELETE = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 从 URL 参数获取标签 ID
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return badRequestError(MESSAGES.MISSING_TAG_ID);
    }

    // 获取设置
    const settingsResult = await getUserSettings(supabase, userId);
    if (!settingsResult.success) {
      return databaseError(MESSAGES.DELETE_ERROR, settingsResult.error);
    }
    const { settings, customUsageTags: existingTags } = settingsResult;

    // 查找要删除的标签
    // 类型断言: CustomUsageTag 运行时包含 id 属性
    const tagIndex = existingTags.findIndex(
      (tag) => (tag as CustomUsageTag & { id: string }).id === id,
    );
    if (tagIndex === -1) {
      return badRequestError(MESSAGES.TAG_NOT_FOUND);
    }

    // 删除标签
    const updatedTags = existingTags.filter(
      (tag) => (tag as CustomUsageTag & { id: string }).id !== id,
    );

    // 更新设置
    const updateResult = await updateUserCustomTags(
      supabase,
      userId,
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
  },
);
