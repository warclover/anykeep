/**
 * 智能分类调试工具 - API 处理函数
 *
 * 处理 /api/dev/classification-compare 请求
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompareRequest } from "../types";
import { compareClassification } from "../services";
import { logger } from "@/lib/logger";

/**
 * 验证请求参数
 */
function validateRequest(
  body: unknown,
): { valid: true; data: CompareRequest } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "请求体无效" };
  }

  const request = body as Record<string, unknown>;

  // 验证 bookmark
  if (!request.bookmark || typeof request.bookmark !== "object") {
    return { valid: false, error: "缺少 bookmark 参数" };
  }

  const bookmark = request.bookmark as Record<string, unknown>;

  if (!bookmark.url || typeof bookmark.url !== "string") {
    return { valid: false, error: "缺少 bookmark.url" };
  }

  if (!bookmark.title || typeof bookmark.title !== "string") {
    return { valid: false, error: "缺少 bookmark.title" };
  }

  // 验证 scenario
  const validScenarios = ["cold-start", "learning", "mature", "real-readonly"];
  if (
    !request.scenario ||
    typeof request.scenario !== "string" ||
    !validScenarios.includes(request.scenario)
  ) {
    return {
      valid: false,
      error: `scenario 必须是以下之一: ${validScenarios.join(", ")}`,
    };
  }

  // 验证 preset（可选）
  const validPresets = [
    "default",
    "high-precision",
    "fast-mode",
    "cold-start-optimized",
  ];
  if (
    request.preset &&
    (typeof request.preset !== "string" ||
      !validPresets.includes(request.preset))
  ) {
    return {
      valid: false,
      error: `preset 必须是以下之一: ${validPresets.join(", ")}`,
    };
  }

  return {
    valid: true,
    data: {
      bookmark: {
        url: bookmark.url as string,
        title: bookmark.title as string,
        description: bookmark.description as string | undefined,
        tags: bookmark.tags as string[] | undefined,
      },
      scenario: request.scenario as CompareRequest["scenario"],
      preset: request.preset as CompareRequest["preset"],
      customV4Config:
        request.customV4Config as CompareRequest["customV4Config"],
    },
  };
}

/**
 * 处理对比请求
 *
 * @param request - HTTP 请求
 * @param supabase - Supabase 客户端
 * @param userId - 当前用户 ID
 * @returns HTTP 响应
 */
export async function handleCompare(
  request: Request,
  supabase: SupabaseClient,
  userId: string,
): Promise<Response> {
  try {
    // 解析请求体
    const body = await request.json();

    // 验证请求
    const validation = validateRequest(body);
    if (!validation.valid) {
      return Response.json(
        { success: false, error: validation.error },
        { status: 400 },
      );
    }

    logger.info(
      {
        userId,
        scenario: validation.data.scenario,
        preset: validation.data.preset,
        bookmarkTitle: validation.data.bookmark.title,
      },
      "[ClassificationDebugger] API request received",
    );

    // 执行对比
    const result = await compareClassification(
      supabase,
      validation.data,
      userId,
    );

    return Response.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      { error: errorMessage, userId },
      "[ClassificationDebugger] API error",
    );

    return Response.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
