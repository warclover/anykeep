/**
 * 用户兴趣管理 API
 * GET /api/classification/interests - 获取用户兴趣配置
 * POST /api/classification/interests - 设置预设兴趣
 * PUT /api/classification/interests - 创建初始文件夹
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  ClassificationContainer,
  PRESET_INTEREST_DOMAINS,
  type PresetInterestId,
} from "@/lib/classification";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
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
 * GET /api/classification/interests
 * 获取用户兴趣配置
 */
export async function GET() {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase);
    const interestService = container.getInterestService();

    // 3. 获取用户兴趣配置
    const config = await interestService.getUserInterests(user.id);

    // 4. 获取所有预设兴趣领域（用于 UI 展示）
    const allPresetDomains = Object.fromEntries(
      Object.entries(PRESET_INTEREST_DOMAINS).map(([id, domain]) => [
        id,
        { name: domain.name, icon: domain.icon, category: domain.category },
      ]),
    );

    // 5. 返回配置
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
 * 设置预设兴趣
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
      return unauthorizedError("请先登录");
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = setInterestsSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { presetInterests, createFolders } = validation.data;

    // 3. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase);
    const interestService = container.getInterestService();

    // 4. 设置预设兴趣（如果有选择的话）
    if (presetInterests.length > 0) {
      await interestService.setPresetInterests(
        user.id,
        presetInterests as PresetInterestId[],
      );
    }

    // 5. 创建初始文件夹并标记引导完成
    let createdFolders: string[] = [];
    if (createFolders && presetInterests.length > 0) {
      createdFolders = await interestService.createInitialFolders(user.id);
    } else {
      // 即使跳过也标记引导完成，避免重复提醒
      const { data: profile } = await supabase
        .from("profiles")
        .select("settings")
        .eq("id", user.id)
        .single();

      const currentSettings =
        (profile?.settings as Record<string, unknown>) || {};
      await supabase
        .from("profiles")
        .update({
          settings: {
            ...currentSettings,
            onboarding_completed_at: new Date().toISOString(),
          },
        })
        .eq("id", user.id);
    }

    logger.info(
      {
        userId: user.id,
        presetInterests,
        createFolders,
        createdFolderCount: createdFolders.length,
      },
      "Onboarding completed",
    );

    // 6. 返回成功
    return successResponse({
      success: true,
      createdFolders,
    });
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
 * PUT /api/classification/interests
 * 根据已选兴趣创建初始文件夹
 */
export async function PUT() {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase);
    const interestService = container.getInterestService();

    // 3. 创建初始文件夹
    const createdFolders = await interestService.createInitialFolders(user.id);

    logger.info(
      {
        userId: user.id,
        folderCount: createdFolders.length,
        folders: createdFolders,
      },
      "Initial folders created",
    );

    // 4. 返回创建的文件夹列表
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
