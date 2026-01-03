/**
 * 用户兴趣管理 API (V2.0.0 - Consolidated)
 *
 * GET /api/classification/interests - 获取用户兴趣配置
 * POST /api/classification/interests - 设置预设兴趣 或 添加自定义兴趣
 *   - { presetInterests } - 设置预设兴趣
 *   - { customInterest: { name, icon, ... } } - 添加自定义兴趣
 * PUT /api/classification/interests - 创建初始文件夹
 * PATCH /api/classification/interests - 更新自定义兴趣 (merged from /custom)
 * DELETE /api/classification/interests - 删除自定义兴趣 (merged from /custom)
 *
 * @version 2.0.0 - Merged /custom endpoint
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import {
  ClassificationContainer,
  PRESET_INTEREST_DOMAINS,
  CUSTOM_INTEREST_LIMITS,
  type PresetInterestId,
} from "@/lib/classification";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

// 预设兴趣 ID 列表
const presetInterestIds = Object.keys(
  PRESET_INTEREST_DOMAINS,
) as PresetInterestId[];

/**
 * 设置预设兴趣 Schema
 */
const setInterestsSchema = z.object({
  presetInterests: z
    .array(z.enum(presetInterestIds as [string, ...string[]]))
    .max(12),
  createFolders: z.boolean().optional().default(false),
});

/**
 * 添加自定义兴趣 Schema
 */
const addCustomInterestSchema = z.object({
  name: z.string().min(1).max(CUSTOM_INTEREST_LIMITS.MAX_NAME_LENGTH),
  icon: z.string().min(1).max(10),
  keywords: z
    .array(z.string())
    .max(CUSTOM_INTEREST_LIMITS.MAX_KEYWORDS)
    .default([]),
  suggestedFolders: z
    .array(z.string())
    .max(CUSTOM_INTEREST_LIMITS.MAX_SUGGESTED_FOLDERS)
    .default([]),
});

/**
 * 更新自定义兴趣 Schema
 */
const updateCustomInterestSchema = z.object({
  id: z.string().uuid(),
  name: z
    .string()
    .min(1)
    .max(CUSTOM_INTEREST_LIMITS.MAX_NAME_LENGTH)
    .optional(),
  icon: z.string().min(1).max(10).optional(),
  keywords: z
    .array(z.string())
    .max(CUSTOM_INTEREST_LIMITS.MAX_KEYWORDS)
    .optional(),
  suggestedFolders: z
    .array(z.string())
    .max(CUSTOM_INTEREST_LIMITS.MAX_SUGGESTED_FOLDERS)
    .optional(),
});

/**
 * 删除自定义兴趣 Schema
 */
const deleteCustomInterestSchema = z.object({
  customInterestId: z.string().uuid(),
});

/**
 * GET /api/classification/interests
 * 获取用户兴趣配置
 */
export async function GET() {
  try {
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    const supabase = await createClient();
    const container = ClassificationContainer.initialize(supabase);
    const interestService = container.getInterestService();

    const config = await interestService.getUserInterests(user.id);

    const allPresetDomains = Object.fromEntries(
      Object.entries(PRESET_INTEREST_DOMAINS).map(([id, domain]) => [
        id,
        { name: domain.name, icon: domain.icon, category: domain.category },
      ]),
    );

    return successResponse({
      userConfig: config,
      presetDomains: allPresetDomains,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/classification/interests error",
    );
    return internalError("获取兴趣配置失败");
  }
}

/**
 * POST /api/classification/interests
 * 设置预设兴趣 或 添加自定义兴趣
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    const supabase = await createClient();
    const body = await request.json();

    // Check if this is a custom interest request
    if (body.customInterest) {
      return handleAddCustomInterest(supabase, user.id, body.customInterest);
    }

    // Default: set preset interests
    return handleSetPresetInterests(supabase, user.id, body);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/classification/interests error",
    );
    return internalError("设置兴趣失败");
  }
}

/**
 * Handle setting preset interests
 */
async function handleSetPresetInterests(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  body: unknown,
) {
  const validation = setInterestsSchema.safeParse(body);

  if (!validation.success) {
    return handleValidationError(validation.error);
  }

  const { presetInterests, createFolders } = validation.data;

  const container = ClassificationContainer.initialize(supabase);
  const interestService = container.getInterestService();

  if (presetInterests.length > 0) {
    await interestService.setPresetInterests(
      userId,
      presetInterests as PresetInterestId[],
    );
  }

  let createdFolders: string[] = [];
  if (createFolders && presetInterests.length > 0) {
    createdFolders = await interestService.createInitialFolders(userId);
  } else {
    // 类型断言: 手动维护类型文件时需要此断言
    type ProfileSettingsType = { settings: Record<string, unknown> | null };
    const { data: profile } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single() as unknown as { data: ProfileSettingsType | null; error: unknown };

    const currentSettings =
      (profile?.settings as Record<string, unknown>) || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("profiles") as any)
      .update({
        settings: {
          ...currentSettings,
          onboarding_completed_at: new Date().toISOString(),
        },
      })
      .eq("id", userId);
  }

  logger.info(
    {
      userId,
      presetInterests,
      createFolders,
      createdFolderCount: createdFolders.length,
    },
    "Onboarding completed",
  );

  return successResponse({
    success: true,
    createdFolders,
  });
}

/**
 * Handle adding custom interest
 */
async function handleAddCustomInterest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  customInterest: unknown,
) {
  const validation = addCustomInterestSchema.safeParse(customInterest);

  if (!validation.success) {
    return handleValidationError(validation.error);
  }

  const container = ClassificationContainer.initialize(supabase);
  const interestService = container.getInterestService();

  try {
    const interest = await interestService.addCustomInterest(
      userId,
      validation.data,
    );

    logger.info(
      {
        userId,
        interestId: interest.id,
        name: interest.name,
      },
      "Custom interest added",
    );

    return successResponse(interest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Maximum")) {
      return badRequestError(message);
    }
    throw error;
  }
}

/**
 * PUT /api/classification/interests
 * 根据已选兴趣创建初始文件夹
 */
export async function PUT() {
  try {
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    const supabase = await createClient();
    const container = ClassificationContainer.initialize(supabase);
    const interestService = container.getInterestService();

    const createdFolders = await interestService.createInitialFolders(user.id);

    logger.info(
      {
        userId: user.id,
        folderCount: createdFolders.length,
        folders: createdFolders,
      },
      "Initial folders created",
    );

    return successResponse({
      createdFolders,
      count: createdFolders.length,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "PUT /api/classification/interests error",
    );
    return internalError("创建初始文件夹失败");
  }
}

/**
 * PATCH /api/classification/interests
 * 更新自定义兴趣 (V2.0.0 - merged from /custom)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    const body = await request.json();
    const validation = updateCustomInterestSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { id, ...updates } = validation.data;

    const container = ClassificationContainer.initialize(supabase);
    const interestService = container.getInterestService();

    const interest = await interestService.updateCustomInterest(id, updates);

    logger.info(
      {
        userId: user.id,
        interestId: id,
      },
      "Custom interest updated",
    );

    return successResponse(interest);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "PATCH /api/classification/interests error",
    );
    return internalError("更新自定义兴趣失败");
  }
}

/**
 * DELETE /api/classification/interests
 * 删除自定义兴趣 (V2.0.0 - merged from /custom)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    const body = await request.json();
    const validation = deleteCustomInterestSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { customInterestId } = validation.data;

    const container = ClassificationContainer.initialize(supabase);
    const interestService = container.getInterestService();

    await interestService.deleteCustomInterest(customInterestId);

    logger.info(
      {
        userId: user.id,
        interestId: customInterestId,
      },
      "Custom interest deleted",
    );

    return successResponse({ success: true });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "DELETE /api/classification/interests error",
    );
    return internalError("删除自定义兴趣失败");
  }
}
