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
 * @version 2.1.0 - Merged /custom endpoint
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createInterestService } from "@/lib/interests";
import {
  PRESET_INTEREST_DOMAINS,
  CUSTOM_INTEREST_LIMITS,
  type PresetInterestId,
} from "@/lib/classification";
import {
  successResponse,
  handleValidationError,
  badRequestError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

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
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const supabase = await createClient();
  const interestService = createInterestService(supabase);

  const config = await interestService.getUserInterests(userId);

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
});

/**
 * POST /api/classification/interests
 * 设置预设兴趣 或 添加自定义兴趣
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();
  const body = await request.json();

  // Check if this is a custom interest request
  if (body.customInterest) {
    return handleAddCustomInterest(supabase, userId, body.customInterest);
  }

  // Default: set preset interests
  return handleSetPresetInterests(supabase, userId, body);
});

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

  const interestService = createInterestService(supabase);

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
    const { data: profile } = (await supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single()) as unknown as {
      data: ProfileSettingsType | null;
      error: unknown;
    };

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

  const interestService = createInterestService(supabase);

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
export const PUT = withAuthMiddleware(async (_request, { userId }) => {
  const supabase = await createClient();
  const interestService = createInterestService(supabase);

  const createdFolders = await interestService.createInitialFolders(userId);

  logger.info(
    {
      userId,
      folderCount: createdFolders.length,
      folders: createdFolders,
    },
    "Initial folders created",
  );

  return successResponse({
    createdFolders,
    count: createdFolders.length,
  });
});

/**
 * PATCH /api/classification/interests
 * 更新自定义兴趣 (V2.0.0 - merged from /custom)
 */
export const PATCH = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  const body = await request.json();
  const validation = updateCustomInterestSchema.safeParse(body);

  if (!validation.success) {
    return handleValidationError(validation.error);
  }

  const { id, ...updates } = validation.data;

  const interestService = createInterestService(supabase);

  const interest = await interestService.updateCustomInterest(id, updates);

  logger.info(
    {
      userId,
      interestId: id,
    },
    "Custom interest updated",
  );

  return successResponse(interest);
});

/**
 * DELETE /api/classification/interests
 * 删除自定义兴趣 (V2.0.0 - merged from /custom)
 */
export const DELETE = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  const body = await request.json();
  const validation = deleteCustomInterestSchema.safeParse(body);

  if (!validation.success) {
    return handleValidationError(validation.error);
  }

  const { customInterestId } = validation.data;

  const interestService = createInterestService(supabase);

  await interestService.deleteCustomInterest(customInterestId);

  logger.info(
    {
      userId,
      interestId: customInterestId,
    },
    "Custom interest deleted",
  );

  return successResponse({ success: true });
});
