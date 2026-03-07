/**
 * Knowledge Studio TTS API
 *
 * POST /api/knowledge-studio/v2/tts - 生成内容语音合成
 *
 * @version 1.0.0
 * @since 2026-01-07
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { getTTSService, TTSError, TTS_ERROR_CODES } from "@/lib/tts";

import { withAuthMiddleware } from "@/lib/api/middleware";
// ============================================
// 常量
// ============================================

const MODULE_NAME = "KS-TTS-API";
const MAX_TEXT_LENGTH = 3000; // 最大 3000 字

// ============================================
// 请求验证 Schema
// ============================================

const TTSRequestSchema = z.object({
  text: z
    .string()
    .min(1, "文本不能为空")
    .max(MAX_TEXT_LENGTH, `文本不能超过 ${MAX_TEXT_LENGTH} 字`),
  speed: z.number().min(0.5).max(2.0).optional().default(1.0),
  voiceGender: z.enum(["male", "female"]).optional().default("female"),
});

// ============================================
// 辅助函数
// ============================================

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

/**
 * 预处理文本：移除 Markdown 格式标记
 */
function preprocessText(text: string): string {
  return (
    text
      // 移除标题标记
      .replace(/^#{1,6}\s+/gm, "")
      // 移除粗体
      .replace(/\*\*(.+?)\*\*/g, "$1")
      // 移除斜体
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/_(.+?)_/g, "$1")
      // 移除代码块
      .replace(/```[\s\S]*?```/g, "")
      // 移除行内代码
      .replace(/`(.+?)`/g, "$1")
      // 移除链接，保留文字
      .replace(/\[(.+?)\]\(.+?\)/g, "$1")
      // 移除图片
      .replace(/!\[.*?\]\(.+?\)/g, "")
      // 移除列表标记
      .replace(/^[\s]*[-*+]\s+/gm, "")
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // 移除引用标记
      .replace(/^>\s+/gm, "")
      // 移除水平线
      .replace(/^[-*_]{3,}$/gm, "")
      // 移除多余空行
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// ============================================
// API 处理函数
// ============================================

/**
 * POST /api/knowledge-studio/v2/tts
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const startTime = Date.now();

  try {
    // 1. 解析和验证请求体
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
          },
        },
        { status: 400 },
      );
    }

    const { text, speed, voiceGender } = parseResult.data;

    logger.info(
      {
        module: MODULE_NAME,
        userId: userId,
        textLength: text.length,
        speed,
        voiceGender,
      },
      "KS TTS request received",
    );

    // 3. 预处理文本
    const processedText = preprocessText(text);

    if (!processedText || processedText.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TTS_ERROR_CODES.TEXT_EMPTY,
            message: "内容过短，无法朗读",
          },
        },
        { status: 400 },
      );
    }

    // 4. 获取 TTS 服务
    const ttsService = getTTSService();

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

    // 5. 确定语音
    const selectedVoice = ttsService.getDefaultVoice(voiceGender);

    // 6. 调用 TTS 服务
    const ttsResult = await ttsService.synthesize(processedText, {
      voice: selectedVoice,
      speed,
    });

    // 7. 转换为 Base64
    const audioBase64 = arrayBufferToBase64(ttsResult.audio);

    const latencyMs = Date.now() - startTime;

    logger.info(
      {
        module: MODULE_NAME,
        userId: userId,
        charCount: ttsResult.charCount,
        durationSec: ttsResult.durationSec,
        latencyMs,
        requestId: ttsResult.requestId,
      },
      "KS TTS synthesis completed",
    );

    // 8. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        audioBase64,
        format: ttsResult.format,
        durationSec: ttsResult.durationSec,
        charCount: ttsResult.charCount,
      },
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    if (error instanceof TTSError) {
      logger.warn(
        {
          module: MODULE_NAME,
          code: error.code,
          message: error.message,
          latencyMs,
        },
        "KS TTS error",
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.code === TTS_ERROR_CODES.TEXT_TOO_LONG ? 400 : 500 },
      );
    }

    logger.error(
      {
        module: MODULE_NAME,
        error: error instanceof Error ? error.message : String(error),
        latencyMs,
      },
      "KS TTS unexpected error",
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
});
