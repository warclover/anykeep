/**
 * V4.0 深度分类 API (SSE)
 * POST /api/classification/classify-deep
 *
 * 乐观 UI 第二阶段：运行 Tier 2 (AI 确认) + Tier 3 (自动创建)
 * 使用 Server-Sent Events 实时推送进度和结果
 *
 * SSE 事件类型：
 * - progress: 进度更新 { stage: string, message: string }
 * - result: 最终结果 { changed: boolean, result: ClassificationResult, ... }
 * - error: 错误 { message: string }
 * - done: 完成标记
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ClassificationContainer } from "@/lib/classification";
import {
  TieredClassificationService,
  type QuickClassificationResult,
} from "@/lib/classification/v3/services/tiered-classification.service";
import { WeightedScoreAggregator } from "@/lib/classification/strategies";
import { logger } from "@/lib/logger";
import {
  generateEmbedding,
  buildEmbeddingText,
} from "@/lib/utils/embedding-generator";

/**
 * 请求体验证 Schema
 */
const classifyDeepSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(500),
  summary: z.string().max(1000).optional().default(""),
  tags: z.array(z.string()).max(20).optional().default([]),
  url: z.string().url().optional(),
  embedding: z.array(z.number()).optional(),
  bookmarkId: z.number().optional(),

  // 快速分类结果（来自 classify-quick）
  quickResult: z.object({
    result: z.object({
      folderId: z.number().nullable(),
      folderName: z.string(),
      confidence: z.number(),
      action: z.string(),
      reason: z.string().optional(),
      scores: z
        .object({
          vectorScore: z.number().optional(),
          historyScore: z.number().optional(),
          aiScore: z.number().optional(),
        })
        .optional(),
    }),
    tier: z.number(),
    needsDeepValidation: z.boolean(),
    traceId: z.string(),
    timings: z
      .object({
        tier0Ms: z.number().optional(),
        tier1Ms: z.number().optional(),
      })
      .optional(),
    // V4.0 决策理由
    decisionReason: z
      .object({
        primary: z.string(),
        secondary: z.string().optional(),
        confidenceExplanation: z.string(),
      })
      .optional(),
  }),
});

/**
 * SSE 事件发送器
 */
function createSSEWriter(controller: ReadableStreamDefaultController) {
  const encoder = new TextEncoder();

  return {
    sendProgress(stage: string, message: string) {
      const data = JSON.stringify({ stage, message });
      controller.enqueue(encoder.encode(`event: progress\ndata: ${data}\n\n`));
    },

    sendResult(result: Record<string, unknown>) {
      const data = JSON.stringify(result);
      controller.enqueue(encoder.encode(`event: result\ndata: ${data}\n\n`));
    },

    sendError(message: string) {
      const data = JSON.stringify({ message });
      controller.enqueue(encoder.encode(`event: error\ndata: ${data}\n\n`));
    },

    sendDone() {
      controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      controller.close();
    },
  };
}

/**
 * POST /api/classification/classify-deep
 * 深度分类（SSE 流式响应）
 */
export async function POST(request: NextRequest) {
  const startTime = performance.now();

  // 创建 SSE 响应流
  const stream = new ReadableStream({
    async start(controller) {
      const sse = createSSEWriter(controller);

      try {
        // 1. 验证用户身份
        const supabase = await createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          sse.sendError("请先登录");
          sse.sendDone();
          return;
        }

        // 2. 解析并验证请求体
        const body = await request.json();
        const validation = classifyDeepSchema.safeParse(body);

        if (!validation.success) {
          sse.sendError(`请求参数错误: ${validation.error.message}`);
          sse.sendDone();
          return;
        }

        const { title, summary, tags, url, embedding, bookmarkId, quickResult } =
          validation.data;

        sse.sendProgress("init", "开始深度验证...");

        // 3. 生成 embedding（如果未提供）
        let finalEmbedding = embedding;
        if (!finalEmbedding || finalEmbedding.length === 0) {
          sse.sendProgress("embedding", "生成语义向量...");
          try {
            const text = buildEmbeddingText(title, summary, tags);
            finalEmbedding = await generateEmbedding(text);
          } catch (error) {
            logger.warn(
              {
                error: error instanceof Error ? error.message : String(error),
              },
              "Deep classification: Embedding generation failed",
            );
            finalEmbedding = [];
          }
        }

        // 4. 初始化分层分类服务
        sse.sendProgress("init", "初始化分类服务...");

        const container = ClassificationContainer.initialize(supabase);
        const matchers = container.getV3Matchers();
        const aggregator = new WeightedScoreAggregator();

        const tieredService = new TieredClassificationService(
          supabase,
          matchers,
          aggregator,
          {
            tracingEnabled: true,
            correctionCacheEnabled: true,
          },
        );

        // 5. 准备上下文
        const context = {
          userId: user.id,
          bookmarkId: bookmarkId ?? -1,
          title,
          summary: summary || "",
          tags: tags || [],
          embedding: finalEmbedding || [],
          url,
        };

        // 6. 转换 quickResult 为正确的类型
        const typedQuickResult: QuickClassificationResult = {
          result: {
            folderId: quickResult.result.folderId,
            folderName: quickResult.result.folderName,
            confidence: quickResult.result.confidence,
            action: quickResult.result.action as
              | "classify"
              | "inbox"
              | "suggest_create",
            reason: quickResult.result.reason ?? "",
            scores: {
              vectorScore: quickResult.result.scores?.vectorScore ?? 0,
              historyScore: quickResult.result.scores?.historyScore ?? 0,
              aiScore: quickResult.result.scores?.aiScore ?? 0,
            },
          },
          tier: quickResult.tier as 0 | 1,
          needsDeepValidation: quickResult.needsDeepValidation,
          traceId: quickResult.traceId,
          timings: quickResult.timings || {},
          decisionReason: quickResult.decisionReason ?? {
            primary: `归入「${quickResult.result.folderName}」`,
            confidenceExplanation: `置信度 ${quickResult.result.confidence}%`,
          },
        };

        // 7. 执行深度分类
        sse.sendProgress("deep", "执行深度验证 (Tier 2/3)...");

        const deepResult = await tieredService.classifyDeep(
          user.id,
          {
            id: bookmarkId ?? -1,
            title,
            summary,
            tags,
            url,
            embedding: finalEmbedding,
          },
          context,
          typedQuickResult,
        );

        const totalMs = Math.round(performance.now() - startTime);

        // 8. 记录日志
        logger.info(
          {
            userId: user.id,
            title: title.substring(0, 50),
            traceId: deepResult.traceId,
            tier: deepResult.tier,
            changed: deepResult.changed,
            aiCalled: deepResult.aiCalled,
            totalMs,
          },
          `Deep classification completed in ${totalMs}ms`,
        );

        // 9. 发送最终结果
        sse.sendResult({
          // 分类结果
          folderId: deepResult.result.folderId,
          folderName: deepResult.result.folderName,
          confidence: deepResult.result.confidence,
          action: deepResult.result.action,
          reason: deepResult.result.reason,
          scores: deepResult.result.scores,

          // 深度验证元数据
          changed: deepResult.changed,
          tier: deepResult.tier,
          aiCalled: deepResult.aiCalled,
          traceId: deepResult.traceId,

          // V4.0 决策理由透传
          decisionReason: deepResult.decisionReason,

          // 原始快速结果（用于 UI 对比）
          originalResult: {
            folderId: typedQuickResult.result.folderId,
            folderName: typedQuickResult.result.folderName,
            confidence: typedQuickResult.result.confidence,
          },

          // 性能指标
          timings: {
            ...deepResult.timings,
            totalMs,
          },

          // 错误信息（如果有）
          error: deepResult.error,
        });

        sse.sendDone();
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          "POST /api/classification/classify-deep error",
        );

        sse.sendError(
          error instanceof Error ? error.message : "深度分类失败",
        );
        sse.sendDone();
      }
    },
  });

  // 返回 SSE 响应
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // 禁用 nginx 缓冲
    },
  });
}
