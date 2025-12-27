/**
 * 链接健康检测 API - 触发检测
 *
 * POST /api/link-health/check
 *
 * 功能：
 * - 触发链接健康检测任务
 * - 支持 SSE 流式响应（实时进度）
 * - 支持全量/文件夹/选中范围
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CheckRequestSchema } from "@/lib/ai-skills/skills/link-health-check/schema";
import { linkHealthCheckSkill } from "@/lib/ai-skills/skills/link-health-check";
import { LINK_HEALTH_CONFIG } from "@/lib/ai-skills/skills/link-health-check/types";
import {
  successResponse,
  badRequestError,
  unauthorizedError,
  databaseError,
} from "@/lib/utils/api-response";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { logger } from "@/lib/logger";
import type { OrchestrationStreamChunk } from "@/lib/ai-skills/output/types";
import type { OrchestrationContext } from "@/lib/ai-skills/orchestration/types";

/**
 * POST /api/link-health/check
 * 触发链接健康检测
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. 身份验证
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 速率限制检查（使用 AI 类别的限制）
    const rateLimitResult = checkRateLimit(user.id, "/api/link-health");
    if (!rateLimitResult.allowed) {
      logger.warn(
        {
          userId: user.id.slice(0, 8) + "...",
          remaining: rateLimitResult.remaining,
          resetMs: rateLimitResult.resetMs,
        },
        "Link Health Check API: Rate limit exceeded",
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "请求过于频繁，请稍后再试",
            retryAfter: Math.ceil(rateLimitResult.resetMs / 1000),
          },
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "Retry-After": Math.ceil(rateLimitResult.resetMs / 1000).toString(),
          },
        },
      );
    }

    // 3. 解析请求体
    const body = await request.json();
    const parseResult = CheckRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return badRequestError(parseResult.error.issues[0].message);
    }

    const { scope, folderId, bookmarkIds, includeWayback } = parseResult.data;

    // 4. 确定检测范围
    const finalScope = scope || "all";

    // 5. 验证范围参数
    if (finalScope === "folder" && !folderId) {
      return badRequestError("检测文件夹时必须提供 folderId");
    }

    if (
      finalScope === "selected" &&
      (!bookmarkIds || bookmarkIds.length === 0)
    ) {
      return badRequestError("检测选中书签时必须提供 bookmarkIds");
    }

    // 6. 检查书签所有权（如果是 selected 范围）
    if (finalScope === "selected" && bookmarkIds) {
      const { count, error } = await supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .in("id", bookmarkIds)
        .eq("user_id", user.id)
        .is("deleted_at", null);

      if (error) {
        logger.error(
          {
            userId: user.id.slice(0, 8) + "...",
            error: error.message,
          },
          "Link Health Check API: Ownership check failed",
        );
        return databaseError("验证书签所有权失败");
      }

      if (count !== bookmarkIds.length) {
        return badRequestError("部分书签不存在或无权操作");
      }
    }

    // 7. 检查文件夹所有权（如果是 folder 范围）
    if (finalScope === "folder" && folderId) {
      const { count, error } = await supabase
        .from("folders")
        .select("id", { count: "exact", head: true })
        .eq("id", folderId)
        .eq("user_id", user.id);

      if (error) {
        logger.error(
          {
            userId: user.id.slice(0, 8) + "...",
            error: error.message,
          },
          "Link Health Check API: Folder ownership check failed",
        );
        return databaseError("验证文件夹所有权失败");
      }

      if (count === 0) {
        return badRequestError("文件夹不存在或无权操作");
      }
    }

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        scope: finalScope,
        folderId,
        bookmarkCount: bookmarkIds?.length,
        includeWayback,
      },
      "Link Health Check API: Starting check",
    );

    // 8. 构建执行输入
    const input = {
      scope: finalScope,
      folderId,
      bookmarkIds,
      includeWayback: includeWayback ?? true,
      timeout: LINK_HEALTH_CONFIG.DEFAULT_TIMEOUT_MS,
      concurrency: LINK_HEALTH_CONFIG.DEFAULT_CONCURRENCY,
    };

    // 9. 检查是否请求 SSE 流式响应
    const acceptHeader = request.headers.get("accept") || "";
    const isStream = acceptHeader.includes("text/event-stream");

    if (isStream) {
      // SSE 流式响应
      return handleStreamingCheck(user.id, input);
    } else {
      // 同步响应（返回检测 ID，客户端轮询状态）
      return handleSyncCheck(user.id, input);
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
      },
      "Link Health Check API: Request failed",
    );

    return databaseError("链接检测请求失败，请稍后重试");
  }
}

/**
 * 处理 SSE 流式检测
 */
async function handleStreamingCheck(
  userId: string,
  input: {
    scope: "all" | "folder" | "selected";
    folderId?: number;
    bookmarkIds?: number[];
    includeWayback: boolean;
    timeout: number;
    concurrency: number;
  },
): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 构建编排上下文
        const context: OrchestrationContext = {
          userId,
          params: input,
        };

        // 使用 executeStream 方法
        for await (const chunk of linkHealthCheckSkill.executeStream(context)) {
          const data = JSON.stringify(chunk);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // 如果是完成或错误，关闭流
          if (chunk.type === "done" || chunk.type === "error") {
            break;
          }
        }

        controller.close();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "检测执行失败";

        logger.error(
          {
            userId: userId.slice(0, 8) + "...",
            error: errorMessage,
          },
          "Link Health Check API: Stream error",
        );

        const errorChunk: OrchestrationStreamChunk = {
          type: "error",
          data: {
            message: errorMessage,
            retryable: true,
          },
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`),
        );
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
}

/**
 * 处理同步检测（启动任务并返回 ID）
 */
async function handleSyncCheck(
  userId: string,
  input: {
    scope: "all" | "folder" | "selected";
    folderId?: number;
    bookmarkIds?: number[];
    includeWayback: boolean;
    timeout: number;
    concurrency: number;
  },
): Promise<Response> {
  // 构建编排上下文
  const context: OrchestrationContext = {
    userId,
    params: input,
  };

  // 执行检测并收集结果
  let result: { checkId?: string; stats?: unknown; problems?: unknown[] } = {};

  try {
    for await (const chunk of linkHealthCheckSkill.executeStream(context)) {
      if (chunk.type === "deliverable" && chunk.data.format === "markdown") {
        // 从交付物获取结果
        result = chunk.data.content as typeof result;
      }

      if (chunk.type === "done") {
        break;
      }

      if (chunk.type === "error") {
        throw new Error(chunk.data.message);
      }
    }

    return successResponse({
      checkId: result.checkId,
      stats: result.stats,
      problemCount: result.problems?.length || 0,
      message: "检测完成",
    });
  } catch (error) {
    logger.error(
      {
        userId: userId.slice(0, 8) + "...",
        error: error instanceof Error ? error.message : String(error),
      },
      "Link Health Check API: Sync check failed",
    );

    return databaseError("链接检测失败");
  }
}
