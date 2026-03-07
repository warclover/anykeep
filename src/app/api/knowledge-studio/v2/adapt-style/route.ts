/**
 * Knowledge Studio v2 - Adapt Style API (P1-1)
 * @route POST /api/knowledge-studio/v2/adapt-style
 * @description 一稿多发：将内容适配到不同平台风格
 */

import type { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { quotaManager } from "@/lib/knowledge-studio";
import {
  adaptStyleStream,
  countWords,
} from "@/lib/knowledge-studio/refinement/adapt-style-service";
import { PLATFORM_STYLE_CONFIG } from "@/lib/knowledge-studio/v2/constants";

// 风格适配的配额成本
const ADAPT_STYLE_QUOTA_COST = 1;

const logger = createLogger("api:knowledge-studio:v2:adapt-style");

/**
 * Request schema
 */
const AdaptStyleRequestSchema = z.object({
  /** 原始内容 */
  content: z.string().min(1, "内容不能为空"),
  /** 原始风格 */
  sourceStyle: z.enum(["wechat", "xiaohongshu", "general"]),
  /** 目标风格 */
  targetStyle: z.enum(["wechat", "xiaohongshu", "general"]),
  /** 是否保留结构 */
  preserveStructure: z.boolean().optional().default(true),
});

/**
 * POST /api/knowledge-studio/v2/adapt-style
 *
 * 使用 SSE 流式返回适配后的内容
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const requestId = crypto.randomUUID();
  logger.info({ requestId }, "Adapt style request received");

  // 1. Parse request body
  const body = await request.json();
  const parseResult = AdaptStyleRequestSchema.safeParse(body);

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

  const { content, sourceStyle, targetStyle, preserveStructure } =
    parseResult.data;

  // 2. Check if styles are the same
  if (sourceStyle === targetStyle) {
    return new Response(
      JSON.stringify({
        adaptedContent: content,
        originalWords: countWords(content),
        finalWords: countWords(content),
        targetStyle,
        message: "源风格与目标风格相同，无需转换",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ) as unknown as NextResponse;
  }

  // 3. Check quota before adaptation
  const quotaCheck = await quotaManager.checkQuota(
    userId,
    ADAPT_STYLE_QUOTA_COST,
  );
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

  const originalWords = countWords(content);

  logger.info(
    {
      requestId,
      userId,
      sourceStyle,
      targetStyle,
      originalWords,
    },
    "Starting style adaptation",
  );

  // 4. Create SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await adaptStyleStream(
          {
            content,
            sourceStyle,
            targetStyle,
            preserveStructure,
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
            onComplete: async (result) => {
              // 消耗配额
              await quotaManager.deduct({
                userId,
                operationType: "chat_edit",
                cost: ADAPT_STYLE_QUOTA_COST,
                metadata: { targetStyle: result.targetStyle },
              });

              const event = `data: ${JSON.stringify({
                type: "done",
                originalWords: result.originalWords,
                finalWords: result.finalWords,
                targetStyle: result.targetStyle,
              })}\n\n`;
              controller.enqueue(encoder.encode(event));

              logger.info(
                {
                  requestId,
                  originalWords: result.originalWords,
                  finalWords: result.finalWords,
                  targetStyle: result.targetStyle,
                },
                "Style adaptation completed",
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
                "Style adaptation failed",
              );
            },
          },
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "风格适配失败";
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
 * GET /api/knowledge-studio/v2/adapt-style
 *
 * 获取可用的平台风格列表
 *
 * @security 无需认证 - 风格列表是公开静态数据
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      styles: Object.entries(PLATFORM_STYLE_CONFIG).map(([_key, value]) => {
        return value;
      }),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
