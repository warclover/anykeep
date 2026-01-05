/**
 * TTS API 路由
 *
 * POST /api/tts - 语音合成
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { getTTSService, TTSError, TTS_ERROR_CODES } from "@/lib/tts";
import type { TTSAPIResponse, TTSContentType, TTSVoiceGender } from "@/lib/tts";
import {
  parseStructuredSummary,
  getDisplaySummary,
} from "@/lib/summary/summary.types";

// ============================================
// 常量
// ============================================

const MODULE_NAME = "TTS-API";

// ============================================
// 请求验证 Schema
// ============================================

const TTSRequestSchema = z.object({
  bookmarkId: z.number().int().positive("bookmarkId 必须是正整数"),
  contentType: z
    .enum(["tldr", "summary", "keypoints", "all"])
    .default("summary"),
  speed: z.number().min(0.5).max(2.0).optional(),
  voiceGender: z.enum(["male", "female"]).optional(),
  voice: z.string().optional(),
});

// ============================================
// 辅助函数
// ============================================

/**
 * 准备朗读文本
 *
 * 根据 contentType 从书签数据中提取对应内容
 */
function prepareText(
  bookmark: {
    title: string;
    ai_summary: string | null;
  },
  contentType: TTSContentType,
): string {
  const parts: string[] = [];

  // 解析结构化摘要（如果 ai_summary 是 JSON 格式）
  const structured = bookmark.ai_summary
    ? parseStructuredSummary(bookmark.ai_summary)
    : null;

  // 获取显示摘要文本（处理 JSON 和纯文本两种情况）
  const displaySummary = bookmark.ai_summary
    ? getDisplaySummary(bookmark.ai_summary)
    : "";

  switch (contentType) {
    case "tldr":
      // 优先使用 TLDR，否则使用摘要的前 100 字
      if (structured?.tldr) {
        parts.push(structured.tldr);
      } else if (displaySummary) {
        parts.push(displaySummary.slice(0, 100));
      }
      break;

    case "summary":
      // 完整摘要
      if (displaySummary) {
        parts.push(displaySummary);
      }
      break;

    case "keypoints":
      // 关键要点，逐条朗读
      if (structured?.key_points && structured.key_points.length > 0) {
        structured.key_points.forEach((point, index) => {
          parts.push(`第${index + 1}点：${point}`);
        });
      } else if (displaySummary) {
        // 降级到摘要
        parts.push(displaySummary);
      }
      break;

    case "all":
      // 全部内容
      // 1. 标题
      parts.push(`标题：${bookmark.title}`);

      // 2. TLDR（如有）
      if (structured?.tldr) {
        parts.push(`一句话总结：${structured.tldr}`);
      }

      // 3. 完整摘要
      if (displaySummary) {
        parts.push(`摘要：${displaySummary}`);
      }

      // 4. 关键要点（如有）
      if (structured?.key_points && structured.key_points.length > 0) {
        parts.push("关键要点：");
        structured.key_points.forEach((point, index) => {
          parts.push(`第${index + 1}点：${point}`);
        });
      }
      break;
  }

  // 合并并添加适当的停顿
  return parts.join("。\n");
}

/**
 * ArrayBuffer 转 Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ============================================
// API 处理函数
// ============================================

/**
 * POST /api/tts
 *
 * 语音合成 API
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TTS_ERROR_CODES.UNAUTHORIZED,
            message: "请先登录",
          },
        },
        { status: 401 },
      );
    }

    // 2. 解析和验证请求体
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "请求体格式错误",
          },
        },
        { status: 400 },
      );
    }

    const parseResult = TTSRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parseResult.error.issues[0]?.message || "请求参数无效",
            details: parseResult.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const { bookmarkId, contentType, speed, voiceGender, voice } =
      parseResult.data;

    logger.info(
      {
        module: MODULE_NAME,
        userId: user.id,
        bookmarkId,
        contentType,
        speed,
        voiceGender,
      },
      "TTS request received",
    );

    // 3. 获取书签数据（验证所有权）
    // 类型断言: 手动维护类型文件时需要此断言
    type BookmarkTTSRow = {
      id: number;
      title: string;
      ai_summary: string | null;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookmark, error: bookmarkError } = (await (
      supabase.from("bookmarks") as any
    )
      .select("id, title, ai_summary")
      .eq("id", bookmarkId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single()) as {
      data: BookmarkTTSRow | null;
      error: { message: string } | null;
    };

    if (bookmarkError || !bookmark) {
      logger.warn(
        {
          module: MODULE_NAME,
          userId: user.id,
          bookmarkId,
          error: bookmarkError?.message,
        },
        "Bookmark not found or access denied",
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TTS_ERROR_CODES.BOOKMARK_NOT_FOUND,
            message: "书签不存在或无权访问",
          },
        },
        { status: 404 },
      );
    }

    // 4. 检查是否有摘要内容
    if (!bookmark.ai_summary) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TTS_ERROR_CODES.NO_SUMMARY,
            message: "该书签暂无 AI 摘要，请先生成摘要",
          },
        },
        { status: 400 },
      );
    }

    // 5. 准备朗读文本
    const text = prepareText(bookmark, contentType);

    // 调试日志
    logger.info(
      {
        module: MODULE_NAME,
        bookmarkId,
        contentType,
        textLength: text?.length || 0,
        hasStructured: !!parseStructuredSummary(bookmark.ai_summary || ""),
        aiSummaryPreview: bookmark.ai_summary?.slice(0, 100),
      },
      "Prepared TTS text",
    );

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TTS_ERROR_CODES.TEXT_EMPTY,
            message: "无可朗读的内容",
          },
        },
        { status: 400 },
      );
    }

    // 6. 获取 TTS 服务
    const ttsService = getTTSService();

    // 检查服务可用性
    const serviceStatus = ttsService.isAvailable();
    if (!serviceStatus.available) {
      logger.error(
        {
          module: MODULE_NAME,
          reason: serviceStatus.reason,
        },
        "TTS service unavailable",
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TTS_ERROR_CODES.API_KEY_MISSING,
            message: "TTS 服务暂不可用",
          },
        },
        { status: 503 },
      );
    }

    // 7. 确定语音
    let selectedVoice = voice;
    if (!selectedVoice && voiceGender) {
      selectedVoice = ttsService.getDefaultVoice(voiceGender as TTSVoiceGender);
    }

    // 8. 调用 TTS 服务
    const ttsResult = await ttsService.synthesize(text, {
      voice: selectedVoice,
      speed,
    });

    // 9. 转换为 Base64
    const audioBase64 = arrayBufferToBase64(ttsResult.audio);

    const latencyMs = Date.now() - startTime;

    logger.info(
      {
        module: MODULE_NAME,
        userId: user.id,
        bookmarkId,
        contentType,
        charCount: ttsResult.charCount,
        durationSec: ttsResult.durationSec,
        latencyMs,
        requestId: ttsResult.requestId,
      },
      "TTS synthesis completed",
    );

    // 10. 返回结果
    const response: TTSAPIResponse = {
      audioBase64,
      format: ttsResult.format,
      durationSec: ttsResult.durationSec,
      charCount: ttsResult.charCount,
      bookmarkTitle: bookmark.title,
      contentType,
      requestId: ttsResult.requestId,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    // 处理 TTS 错误
    if (error instanceof TTSError) {
      logger.warn(
        {
          module: MODULE_NAME,
          code: error.code,
          message: error.message,
          latencyMs,
        },
        "TTS error",
      );

      const statusMap: Record<string, number> = {
        [TTS_ERROR_CODES.API_KEY_MISSING]: 503,
        [TTS_ERROR_CODES.TEXT_EMPTY]: 400,
        [TTS_ERROR_CODES.TEXT_TOO_LONG]: 400,
        [TTS_ERROR_CODES.NETWORK_ERROR]: 502,
      };

      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: statusMap[error.code] || 500 },
      );
    }

    // 未知错误
    logger.error(
      {
        module: MODULE_NAME,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        latencyMs,
      },
      "TTS unexpected error",
    );

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "语音合成服务异常，请稍后重试",
        },
      },
      { status: 500 },
    );
  }
}

/**
 * OPTIONS /api/tts
 *
 * CORS 预检请求
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
