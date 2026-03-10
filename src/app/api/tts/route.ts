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
import { withAuthMiddleware } from "@/lib/api/middleware";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { logger } from "@/lib/logger";
import { getTTSService, getTTSCacheService, TTS_ERROR_CODES } from "@/lib/tts";
import type {
  TTSAPIResponse,
  TTSContentType,
  TTSVoiceGender,
  TTSCacheKey,
  TTSCacheMetadata,
} from "@/lib/tts";
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
 * ArrayBuffer 转 Base64（优化版）
 *
 * 使用 Buffer.toString 替代字符串拼接，性能提升约 10x
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

// ============================================
// API 处理函数
// ============================================

/**
 * POST /api/tts
 *
 * 语音合成 API（带缓存优化）
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const startTime = Date.now();
    const timings: Record<string, number> = {};

    // 1. 速率限制（TTS 调用产生第三方 API 费用，需要限制频率）
    const rateLimitResult = checkRateLimit(userId, "/api/tts");
    if (!rateLimitResult.allowed) {
      logger.warn(
        { userId, resetMs: rateLimitResult.resetMs },
        "TTS rate limited",
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "语音合成请求过于频繁，请稍后再试",
          },
          retryAfter: Math.ceil(rateLimitResult.resetMs / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(rateLimitResult.resetMs / 1000).toString(),
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }

    // 2. 解析和验证请求体
    const parseStart = Date.now();
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
    timings.parse = Date.now() - parseStart;

    // 3. 获取 TTS 服务并确定语音
    const ttsService = getTTSService();
    let selectedVoice = voice;
    if (!selectedVoice && voiceGender) {
      selectedVoice = ttsService.getDefaultVoice(voiceGender as TTSVoiceGender);
    }
    if (!selectedVoice) {
      selectedVoice = ttsService.getDefaultVoice("female");
    }
    const finalSpeed = speed ?? 1.0;

    // 4. 检查缓存
    const cacheStart = Date.now();
    const cacheService = getTTSCacheService();
    const cacheKey: TTSCacheKey = {
      userId,
      bookmarkId,
      contentType,
      voice: selectedVoice,
      speed: finalSpeed,
    };

    const cacheResult = await cacheService.get(cacheKey);
    timings.cacheCheck = Date.now() - cacheStart;

    if (cacheResult.hit) {
      // 缓存命中，直接返回
      const totalLatency = Date.now() - startTime;
      logger.info(
        {
          module: MODULE_NAME,
          userId,
          bookmarkId,
          contentType,
          cacheHit: true,
          timings,
          totalLatencyMs: totalLatency,
        },
        "TTS cache hit - returning cached audio",
      );

      const response: TTSAPIResponse = {
        audioBase64: cacheResult.audioBase64,
        format: cacheResult.metadata.format,
        durationSec: cacheResult.metadata.durationSec,
        charCount: cacheResult.metadata.charCount,
        bookmarkTitle: cacheResult.metadata.bookmarkTitle,
        contentType,
        requestId: `cache-${cacheResult.metadata.originalRequestId}`,
      };

      return NextResponse.json({
        success: true,
        data: response,
        cached: true,
      });
    }

    logger.info(
      {
        module: MODULE_NAME,
        userId,
        bookmarkId,
        contentType,
        speed: finalSpeed,
        voiceGender,
      },
      "TTS request received - cache miss",
    );

    // 5. 获取书签数据（验证所有权）
    const supabase = await createClient();
    const dbStart = Date.now();
    const bookmarkResult = await supabase
      .from("bookmarks")
      .select("id, title, ai_summary")
      .eq("id", bookmarkId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    const bookmark = bookmarkResult.data as {
      id: number;
      title: string;
      ai_summary: string | null;
    } | null;
    const bookmarkError = bookmarkResult.error as { message: string } | null;
    timings.dbQuery = Date.now() - dbStart;

    if (bookmarkError || !bookmark) {
      logger.warn(
        {
          module: MODULE_NAME,
          userId,
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

    // 6. 检查是否有摘要内容
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

    // 7. 准备朗读文本
    const textStart = Date.now();
    const text = prepareText(bookmark, contentType);
    timings.textPrep = Date.now() - textStart;

    logger.info(
      {
        module: MODULE_NAME,
        bookmarkId,
        contentType,
        textLength: text?.length || 0,
        hasStructured: !!parseStructuredSummary(bookmark.ai_summary || ""),
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

    // 8. 检查服务可用性
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

    // 9. 调用 TTS 服务
    const ttsStart = Date.now();
    const ttsResult = await ttsService.synthesize(text, {
      voice: selectedVoice,
      speed: finalSpeed,
    });
    timings.ttsSynthesize = Date.now() - ttsStart;

    // 10. 转换为 Base64
    const base64Start = Date.now();
    const audioBase64 = arrayBufferToBase64(ttsResult.audio);
    timings.base64Convert = Date.now() - base64Start;

    const totalLatency = Date.now() - startTime;

    // 11. 异步保存缓存（不阻塞响应）
    const cacheMetadata: TTSCacheMetadata = {
      format: ttsResult.format,
      durationSec: ttsResult.durationSec,
      charCount: ttsResult.charCount,
      bookmarkTitle: bookmark.title,
      createdAt: new Date().toISOString(),
      originalRequestId: ttsResult.requestId,
    };

    // 使用 Promise 异步保存，不等待结果
    cacheService.set(cacheKey, ttsResult.audio, cacheMetadata).catch((err) => {
      logger.warn(
        {
          module: MODULE_NAME,
          bookmarkId,
          error: err instanceof Error ? err.message : String(err),
        },
        "Failed to cache TTS audio",
      );
    });

    logger.info(
      {
        module: MODULE_NAME,
        userId,
        bookmarkId,
        contentType,
        charCount: ttsResult.charCount,
        durationSec: ttsResult.durationSec,
        timings,
        totalLatencyMs: totalLatency,
        requestId: ttsResult.requestId,
      },
      "TTS synthesis completed",
    );

    // 12. 返回结果
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
      cached: false,
    });
  },
);

/**
 * OPTIONS /api/tts
 *
 * CORS 预检请求
 */
export async function OPTIONS(request: NextRequest) {
  // 与 image-proxy 保持一致的 CORS Origin 白名单校验
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set([
    "http://localhost:3000",
    "http://localhost:3001",
  ]);
  // 添加生产环境 URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && appUrl !== "http://localhost:3000") {
    allowedOrigins.add(appUrl);
  }

  if (!origin || !allowedOrigins.has(origin)) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      Vary: "Origin",
    },
  });
}
