/**
 * Knowledge Studio v2 - Iterate API
 * @route POST /api/knowledge-studio/v2/iterate
 * @description 基于用户反馈迭代优化生成内容
 *
 * Phase 4: 草稿迭代与反馈驱动优化
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { streamText } from "ai";
import { AIProviderRouter } from "@/lib/ai-providers/provider-router";
import { quotaManager } from "@/lib/knowledge-studio";
import {
  generateIterationInstruction,
  FEEDBACK_TYPES,
  type DraftFeedback,
} from "@/lib/knowledge-studio/iteration";

// 迭代操作的配额成本（比生成便宜，因为基于已有内容）
const ITERATE_QUOTA_COST = 1;

const logger = createLogger("api:knowledge-studio:v2:iterate");

// ============================================================
// Request Schema
// ============================================================

const IterateRequestSchema = z.object({
  /** 原始内容 */
  originalContent: z.string().min(1, "原始内容不能为空"),
  /** 用户反馈 */
  feedback: z.object({
    rating: z.number().min(1).max(5),
    type: z.enum([
      "too_long",
      "too_short",
      "off_topic",
      "style_issue",
      "other",
    ]),
    comment: z.string().optional(),
    timestamp: z.number(),
  }),
  /** 蓝图 ID */
  blueprintId: z.string().min(1),
  /** 平台风格（可选） */
  platformStyle: z.enum(["wechat", "xiaohongshu", "general"]).optional(),
  /** 大纲 JSON（可选，保持结构一致） */
  outlineJson: z.string().optional(),
  /** 素材摘要（可选） */
  materialsSummary: z.string().optional(),
});

// ============================================================
// SSE Types
// ============================================================

interface IterateSSEChunk {
  type: "content" | "progress" | "done" | "error";
  data: {
    text?: string;
    percent?: number;
    originalWords?: number;
    finalWords?: number;
    iterationType?: string;
    message?: string;
  };
  timestamp: string;
  requestId: string;
}

// ============================================================
// Iteration Prompt Builder
// ============================================================

function buildIterationPrompt(
  originalContent: string,
  feedback: DraftFeedback,
  options: {
    platformStyle?: string;
    outlineJson?: string;
    materialsSummary?: string;
  },
): string {
  const instruction = generateIterationInstruction(feedback);
  const feedbackTypeInfo = FEEDBACK_TYPES[feedback.type];

  let prompt = `# 内容迭代优化任务

## 用户反馈
${instruction}

## 原始内容
${originalContent}

## 优化要求
1. 根据用户反馈类型「${feedbackTypeInfo.label}」进行针对性优化
2. 保持原文的核心观点和结构
3. 输出优化后的完整内容`;

  // 添加平台风格指导
  if (options.platformStyle) {
    const styleGuide = getPlatformStyleGuide(options.platformStyle);
    prompt += `\n\n## 平台风格\n${styleGuide}`;
  }

  // 如果有大纲，要求保持结构
  if (options.outlineJson) {
    prompt += `\n\n## 结构要求\n请保持与原大纲一致的章节结构，只优化内容表达。`;
  }

  prompt += `\n\n请直接输出优化后的完整内容，不要添加任何解释或前言。`;

  return prompt;
}

function getPlatformStyleGuide(style: string): string {
  switch (style) {
    case "wechat":
      return "公众号风格：标题吸睛、分段清晰、适当留白、金句频出";
    case "xiaohongshu":
      return "小红书风格：短段落、emoji点缀、口语化、有互动感";
    case "general":
    default:
      return "通用风格：正式书面语、结构完整、逻辑清晰";
  }
}

function countWords(text: string): number {
  if (!text) return 0;
  const cleaned = text.replace(/\s+/g, " ").trim();
  const chineseChars = (cleaned.match(/[\u4e00-\u9fff]/g) || []).length;
  const withoutChinese = cleaned.replace(/[\u4e00-\u9fff]/g, " ");
  const englishWords = withoutChinese
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  return chineseChars + englishWords;
}

// ============================================================
// POST Handler
// ============================================================

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  logger.info({ requestId }, "Iterate request received");

  // 1. Auth check
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(
      JSON.stringify({
        error: { code: "UNAUTHORIZED", message: "请先登录" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    // 2. Parse request body
    const body = await request.json();
    const parseResult = IterateRequestSchema.safeParse(body);

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
      );
    }

    const {
      originalContent,
      feedback,
      blueprintId,
      platformStyle,
      outlineJson,
      materialsSummary,
    } = parseResult.data;

    // 3. Check quota before iteration
    const quotaCheck = await quotaManager.checkQuota(
      user.id,
      ITERATE_QUOTA_COST,
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
      );
    }

    const originalWords = countWords(originalContent);

    logger.info(
      {
        requestId,
        userId: user.id,
        blueprintId,
        feedbackType: feedback.type,
        feedbackRating: feedback.rating,
        originalWords,
      },
      "Starting content iteration",
    );

    // 3. Build iteration prompt
    const iterationPrompt = buildIterationPrompt(
      originalContent,
      feedback as DraftFeedback,
      { platformStyle, outlineJson, materialsSummary },
    );

    // 4. Get AI model
    const router = AIProviderRouter.getInstance();
    const selection = router.selectProvider({
      taskType: "chat",
      preferredProvider: "deepseek",
    });

    if (!selection?.model) {
      throw new Error("无法获取 AI 模型");
    }

    const model = selection.model;

    // 5. Create SSE stream
    const encoder = new TextEncoder();
    let accumulatedText = "";
    let lastProgressPercent = 0;

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (chunk: IterateSSEChunk) => {
          const data = JSON.stringify(chunk);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        try {
          // Send initial progress
          sendEvent({
            type: "progress",
            data: { percent: 5 },
            timestamp: new Date().toISOString(),
            requestId,
          });

          // Stream the iteration
          const result = streamText({
            model,
            prompt: iterationPrompt,
            maxOutputTokens: 8192,
            temperature: 0.7,
          });

          // Process the stream
          for await (const chunk of (await result).textStream) {
            accumulatedText += chunk;

            // Send content chunk
            sendEvent({
              type: "content",
              data: { text: chunk },
              timestamp: new Date().toISOString(),
              requestId,
            });

            // Update progress based on accumulated length
            const currentWords = countWords(accumulatedText);
            const estimatedProgress = Math.min(
              90,
              Math.floor((currentWords / originalWords) * 80) + 10,
            );

            if (estimatedProgress > lastProgressPercent + 5) {
              lastProgressPercent = estimatedProgress;
              sendEvent({
                type: "progress",
                data: { percent: estimatedProgress },
                timestamp: new Date().toISOString(),
                requestId,
              });
            }
          }

          // Send completion
          const finalWords = countWords(accumulatedText);

          sendEvent({
            type: "done",
            data: {
              originalWords,
              finalWords,
              iterationType: feedback.type,
            },
            timestamp: new Date().toISOString(),
            requestId,
          });

          logger.info(
            {
              requestId,
              originalWords,
              finalWords,
              iterationType: feedback.type,
            },
            "Iteration completed successfully",
          );

          controller.close();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "迭代失败";

          sendEvent({
            type: "error",
            data: { message: errorMessage },
            timestamp: new Date().toISOString(),
            requestId,
          });

          logger.error({ requestId, error: errorMessage }, "Iteration failed");

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    logger.error(
      {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Iterate request failed",
    );

    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_ERROR",
          message: "服务器内部错误",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
