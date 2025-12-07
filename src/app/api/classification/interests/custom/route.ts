/**
 * 自定义兴趣管理 API
 * POST /api/classification/interests/custom - 添加自定义兴趣
 * PATCH /api/classification/interests/custom - 更新自定义兴趣
 * DELETE /api/classification/interests/custom - 删除自定义兴趣
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  ClassificationContainer,
  CUSTOM_INTEREST_LIMITS,
} from "@/lib/classification";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

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
  id: z.string().uuid(),
});

/**
 * POST /api/classification/interests/custom
 * 添加自定义兴趣
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
    const validation = addCustomInterestSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    // 3. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase);
    const interestService = container.getInterestService();

    // 4. 添加自定义兴趣
    const interest = await interestService.addCustomInterest(
      user.id,
      validation.data,
    );

    logger.info(
      {
        userId: user.id,
        interestId: interest.id,
        name: interest.name,
      },
      "Custom interest added",
    );

    // 5. 返回创建的兴趣
    return successResponse(interest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // 检查是否是限制错误
    if (message.includes("Maximum")) {
      return badRequestError(message);
    }

    logger.error(
      {
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/classification/interests/custom error",
    );
    return internalError("添加自定义兴趣失败");
  }
}

/**
 * PATCH /api/classification/interests/custom
 * 更新自定义兴趣
 */
export async function PATCH(request: NextRequest) {
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
    const validation = updateCustomInterestSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { id, ...updates } = validation.data;

    // 3. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase);
    const interestService = container.getInterestService();

    // 4. 更新自定义兴趣
    const interest = await interestService.updateCustomInterest(id, updates);

    logger.info(
      {
        userId: user.id,
        interestId: id,
      },
      "Custom interest updated",
    );

    // 5. 返回更新后的兴趣
    return successResponse(interest);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "PATCH /api/classification/interests/custom error",
    );
    return internalError("更新自定义兴趣失败");
  }
}

/**
 * DELETE /api/classification/interests/custom
 * 删除自定义兴趣
 */
export async function DELETE(request: NextRequest) {
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
    const validation = deleteCustomInterestSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { id } = validation.data;

    // 3. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase);
    const interestService = container.getInterestService();

    // 4. 删除自定义兴趣
    await interestService.deleteCustomInterest(id);

    logger.info(
      {
        userId: user.id,
        interestId: id,
      },
      "Custom interest deleted",
    );

    // 5. 返回成功
    return successResponse({ success: true });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "DELETE /api/classification/interests/custom error",
    );
    return internalError("删除自定义兴趣失败");
  }
}
