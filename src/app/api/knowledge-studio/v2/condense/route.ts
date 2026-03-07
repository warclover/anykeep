/**
 * Knowledge Studio v2 - Condense API
 * @route POST /api/knowledge-studio/v2/condense
 * @description 一键精简内容，将长文本压缩到目标字数
 */

import type { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { quotaManager } from "@/lib/knowledge-studio";
import {
  condenseContentStream,
  countWords,
  CONDENSE_PRESETS,
  type CondensePreset,
} from "@/lib/knowledge-studio/refinement/condense-service";

// 精简操作的配额成本
const CONDENSE_QUOTA_COST = 1;

const logger = createLogger("api:knowledge-studio:v2:condense");

/**
 * Request schema
 */
const CondenseRequestSchema = z.object({
  /** 要精简的内容 */
  content: z.string().min(1, "内容不能为空"),
  /** 目标字数 */
  targetWords: z.number().min(100).max(10000).optional(),
  /** 预设模式 */
  preset: z
    .enum(["xiaohongshu", "wechat_short", "wechat_standard", "summary"])
    .optional(),
  /** 内容类型 */
  contentType: z.enum(["article", "notes", "report"]).optional(),
  /** 必须保留的要点 */
  preserveKeyPoints: z.array(z.string()).optional(),
});

/**
 * POST /api/knowledge-studio/v2/condense
 *
 * 使用 SSE 流式返回精简后的内容
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const requestId = crypto.randomUUID();
  logger.info({ requestId }, "Condense request received");

  // 1. Parse request body
  const body = await request.json();
  const parseResult = CondenseRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return new Response(
      JSON.stringify({
        error: {
          code: "INVALID_REQUEST",
          message: "请求参数无效",
          details: parseResult.error.flatten(),
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    ) as unknown as NextResponse;
  }

  const { content, targetWords, preset, contentType, preserveKeyPoints } =
    parseResult.data;

  // 2. Check quota before condensation
  const quotaCheck = await quotaManager.checkQuota(userId, CONDENSE_QUOTA_COST);
  if (!quotaCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: {
          code: "QUOTA_EXCEEDED",
          message: quotaCheck.reason || "配额不足，请升级会员或等待配额重置",
        },
      }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    ) as unknown as NextResponse;
  }

  // 3. Determine target word count
  let finalTargetWords = targetWords;
  if (!finalTargetWords && preset) {
    finalTargetWords = CONDENSE_PRESETS[preset as CondensePreset].targetWords;
  }
  if (!finalTargetWords) {
    // Default: 压缩到原文的 50%
    const originalWords = countWords(content);
    finalTargetWords = Math.max(500, Math.floor(originalWords * 0.5));
  }

  const originalWords = countWords(content);

  logger.info(
    {
      requestId,
      userId,
      originalWords,
      targetWords: finalTargetWords,
      preset,
    },
    "Starting content condensation",
  );

  // 4. Check if condensation is needed
  if (originalWords <= finalTargetWords * 1.1) {
    return new Response(
      JSON.stringify({
        condensedContent: content,
        originalWords,
        finalWords: originalWords,
        compressionRatio: 1,
        message: "内容已在目标字数范围内，无需精简",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ) as unknown as NextResponse;
  }

  // 5. Create SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await condenseContentStream(
          {
            content,
            targetWords: finalTargetWords ?? 500,
            contentType,
            preserveKeyPoints,
          },
          {
            onContent: (chunk) => {
              const event = `data: ${JSON.stringify({ type: "content", text: chunk })}\n\n`;
              controller.enqueue(encoder.encode(event));
            },
            onProgress: (percent) => {
              const event = `data: ${JSON.stringify({ type: "progress", percent })}\n\n`;
              controller.enqueue(encoder.encode(event));
            },
            onComplete: (result) => {
              const event = `data: ${JSON.stringify({
                type: "done",
                originalWords: result.originalWords,
                finalWords: result.finalWords,
                compressionRatio: result.compressionRatio,
              })}\n\n`;
              controller.enqueue(encoder.encode(event));

              logger.info(
                {
                  requestId,
                  originalWords: result.originalWords,
                  finalWords: result.finalWords,
                  compressionRatio: Math.round(result.compressionRatio * 100),
                },
                "Condensation completed",
              );

              controller.close();
            },
            onError: (error) => {
              const event = `data: ${JSON.stringify({
                type: "error",
                message: error.message,
              })}\n\n`;
              controller.enqueue(encoder.encode(event));
              controller.close();

              logger.error(
                { requestId, error: error.message },
                "Condensation failed",
              );
            },
          },
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "精简失败";
        const event = `data: ${JSON.stringify({
          type: "error",
          message: errorMessage,
        })}\n\n`;
        controller.enqueue(encoder.encode(event));
        controller.close();

        logger.error({ requestId, error: errorMessage }, "Stream error");
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  }) as unknown as NextResponse;
});

/**
 * GET /api/knowledge-studio/v2/condense
 *
 * 获取精简预设列表
 *
 * @security 无需认证 - 预设列表是公开静态数据
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      presets: Object.entries(CONDENSE_PRESETS).map(([key, value]) => ({
        id: key,
        ...value,
      })),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
