/**
 * 视觉分析 API
 *
 * POST /api/ai/vision-analyze - 对书签中的图片进行视觉分析
 *
 * 这是一个独立的插件化 API，与现有功能完全解耦
 * - 不修改现有 bookmarks API
 * - 独立的错误处理
 * - 可单独开启/关闭
 *
 * @version 1.0.0
 * @since 2025-12-06
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  analyzeImages,
  extractImageUrls,
  isVisionServiceAvailable,
} from "@/lib/utils/image-analyzer";
import type { VisionAnalyzeResponse, BookmarkVisionData } from "@/types/vision";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  notFoundError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

// ============================================
// 请求验证
// ============================================

const visionAnalyzeSchema = z.object({
  // 书签 ID（必填）
  bookmarkId: z.number().int().positive("书签 ID 必须是正整数"),

  // 要分析的图片 URL 列表（可选，不提供则自动提取）
  imageUrls: z.array(z.string().url()).max(5).optional(),

  // 最大分析图片数（可选，默认 3）
  maxImages: z.number().int().min(1).max(5).optional().default(3),

  // 自定义分析提示词（可选）
  customPrompt: z.string().max(500).optional(),
});

// ============================================
// API 处理器
// ============================================

/**
 * POST /api/ai/vision-analyze
 * 对书签中的图片进行视觉分析
 */
export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now();

  try {
    // 1. 检查服务是否可用
    if (!isVisionServiceAvailable()) {
      logger.warn(
        { action: "vision_service_unavailable" },
        "Vision: Service not configured",
      );
      return Response.json(
        {
          success: false,
          error: "视觉分析服务未配置",
          errorCode: "API_ERROR",
        } satisfies VisionAnalyzeResponse,
        { status: 503 },
      );
    }

    // 2. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 3. 解析并验证请求体
    const body = await request.json();
    const validation = visionAnalyzeSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const {
      bookmarkId,
      imageUrls,
      maxImages,
      customPrompt: _customPrompt,
    } = validation.data;

    // 4. 获取书签信息
    // 类型断言: 手动维护类型文件时需要此断言
    type BookmarkVision = {
      id: number;
      title: string | null;
      url: string;
      cover_url: string | null;
      description: string | null;
      ai_vision_data: unknown;
    };
    const { data: bookmark, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("id, title, url, cover_url, description, ai_vision_data")
      .eq("id", bookmarkId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single() as unknown as { data: BookmarkVision | null; error: unknown };

    if (bookmarkError || !bookmark) {
      return notFoundError("书签不存在或已删除");
    }

    // 5. 确定要分析的图片
    let urlsToAnalyze: string[] = [];

    if (imageUrls && imageUrls.length > 0) {
      // 用户指定的图片
      urlsToAnalyze = imageUrls;
    } else {
      // 自动提取图片
      urlsToAnalyze = extractImageUrls(
        bookmark.cover_url,
        bookmark.description,
      );
    }

    // 限制数量
    urlsToAnalyze = urlsToAnalyze.slice(0, maxImages);

    if (urlsToAnalyze.length === 0) {
      logger.info(
        {
          bookmarkId,
          userId: user.id,
          action: "vision_no_images",
        },
        "Vision: No images to analyze",
      );

      return Response.json(
        {
          success: false,
          error: "没有找到可分析的图片",
          errorCode: "NO_IMAGES",
        } satisfies VisionAnalyzeResponse,
        { status: 400 },
      );
    }

    // 6. 执行视觉分析
    logger.info(
      {
        bookmarkId,
        userId: user.id,
        imageCount: urlsToAnalyze.length,
        action: "vision_start",
      },
      "Vision: Starting analysis",
    );

    const visionData = await analyzeImages(urlsToAnalyze, {
      maxImages,
    });

    // 7. 保存分析结果到数据库
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from("bookmarks") as any)
      .update({
        ai_vision_data: JSON.parse(JSON.stringify(visionData)),
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookmarkId)
      .eq("user_id", user.id) as { error: { message: string } | null };

    if (updateError) {
      logger.error(
        {
          bookmarkId,
          userId: user.id,
          error: updateError.message,
          action: "vision_save_failed",
        },
        "Vision: Failed to save results",
      );

      // 分析成功但保存失败，仍返回结果
      return Response.json(
        {
          success: true,
          data: visionData,
          error: "分析完成但保存失败，请重试",
        } satisfies VisionAnalyzeResponse,
        { status: 200 },
      );
    }

    const durationMs = Date.now() - startTime;

    logger.info(
      {
        bookmarkId,
        userId: user.id,
        imageCount: visionData.images.length,
        status: visionData.status,
        totalTokens: visionData.usage?.totalTokens,
        durationMs,
        action: "vision_complete",
      },
      "Vision: Analysis complete",
    );

    // 8. 返回成功结果
    return Response.json(
      {
        success: true,
        data: visionData,
      } satisfies VisionAnalyzeResponse,
      { status: 200 },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;

    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        durationMs,
        action: "vision_error",
      },
      "POST /api/ai/vision-analyze error",
    );

    return internalError("视觉分析失败，请稍后重试");
  }
}

/**
 * GET /api/ai/vision-analyze
 * 获取书签的视觉分析数据
 */
export async function GET(request: NextRequest): Promise<Response> {
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

    // 2. 获取书签 ID
    const { searchParams } = new URL(request.url);
    const bookmarkIdStr = searchParams.get("bookmarkId");

    if (!bookmarkIdStr) {
      return Response.json(
        { success: false, error: "缺少 bookmarkId 参数" },
        { status: 400 },
      );
    }

    const bookmarkId = parseInt(bookmarkIdStr, 10);
    if (isNaN(bookmarkId) || bookmarkId <= 0) {
      return Response.json(
        { success: false, error: "无效的 bookmarkId" },
        { status: 400 },
      );
    }

    // 3. 获取视觉分析数据
    // 类型断言: 手动维护类型文件时需要此断言
    const { data: bookmark, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("ai_vision_data")
      .eq("id", bookmarkId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single() as unknown as { data: { ai_vision_data: unknown } | null; error: unknown };

    if (bookmarkError || !bookmark) {
      return notFoundError("书签不存在或已删除");
    }

    const visionData = bookmark.ai_vision_data as BookmarkVisionData | null;

    return successResponse({
      hasData: !!visionData,
      data: visionData,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        action: "vision_get_error",
      },
      "GET /api/ai/vision-analyze error",
    );

    return internalError("获取视觉分析数据失败");
  }
}
