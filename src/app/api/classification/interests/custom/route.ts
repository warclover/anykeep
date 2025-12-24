/**
 * @deprecated Use /api/classification/interests instead
 *
 * This endpoint is deprecated but kept for backward compatibility.
 * - POST: Use POST /api/classification/interests with { customInterest: { name, icon, ... } }
 * - PATCH: Use PATCH /api/classification/interests with { id, ...updates }
 * - DELETE: Use DELETE /api/classification/interests with { customInterestId }
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
 * @deprecated Use POST /api/classification/interests with { customInterest: { ... } }
 */
export async function POST(request: NextRequest) {
  // Log deprecation warning
  logger.warn(
    { endpoint: "/api/classification/interests/custom", method: "POST" },
    "Deprecated endpoint called. Use POST /api/classification/interests with { customInterest: { ... } }",
  );

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
    const validation = addCustomInterestSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const container = ClassificationContainer.initialize(supabase);
    const interestService = container.getInterestService();

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
      "Custom interest added (via deprecated endpoint)",
    );

    return successResponse(interest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

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
 * @deprecated Use PATCH /api/classification/interests with { id, ...updates }
 */
export async function PATCH(request: NextRequest) {
  // Log deprecation warning
  logger.warn(
    { endpoint: "/api/classification/interests/custom", method: "PATCH" },
    "Deprecated endpoint called. Use PATCH /api/classification/interests",
  );

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
      "Custom interest updated (via deprecated endpoint)",
    );

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
 * @deprecated Use DELETE /api/classification/interests with { customInterestId }
 */
export async function DELETE(request: NextRequest) {
  // Log deprecation warning
  logger.warn(
    { endpoint: "/api/classification/interests/custom", method: "DELETE" },
    "Deprecated endpoint called. Use DELETE /api/classification/interests",
  );

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

    const { id } = validation.data;

    const container = ClassificationContainer.initialize(supabase);
    const interestService = container.getInterestService();

    await interestService.deleteCustomInterest(id);

    logger.info(
      {
        userId: user.id,
        interestId: id,
      },
      "Custom interest deleted (via deprecated endpoint)",
    );

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
