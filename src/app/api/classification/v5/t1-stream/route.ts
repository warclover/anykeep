/**
 * 智能分类 v5.0 - T1 纠正实时推送 API (SSE)
 *
 * GET /api/classification/v5/t1-stream?bookmarkId=xxx
 *
 * 功能：通过 Server-Sent Events (SSE) 实时推送 T1 纠正结果
 *
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { createClient } from "@/lib/supabase/server";
import { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * SSE 事件类型
 */
type SSEEvent = {
  type: "status" | "progress" | "completed" | "failed" | "error";
  data: {
    status?: string;
    progress?: number;
    folderId?: string;
    confidence?: number;
    reasoning?: string;
    error?: string;
  };
};

/**
 * GET /api/classification/v5/t1-stream
 * 订阅 T1 纠正队列的实时更新
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const logger = new LoggerService({}, { module: "T1StreamAPI" });

  // 1. 获取查询参数
  const bookmarkIdStr = request.nextUrl.searchParams.get("bookmarkId");
  if (!bookmarkIdStr) {
    return new Response("Missing bookmarkId parameter", { status: 400 });
  }
  const bookmarkId = parseInt(bookmarkIdStr, 10);
  if (isNaN(bookmarkId) || bookmarkId <= 0) {
    return new Response("Invalid bookmarkId parameter", { status: 400 });
  }

  const supabase = await createClient();

  logger.info("T1 Stream started", {
    bookmarkId: bookmarkId.toString(),
    userId,
  });

  // 2. 创建 SSE 流
  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      // 发送初始连接消息
      const initEvent: SSEEvent = {
        type: "status",
        data: { status: "connected" },
      };
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(initEvent)}\n\n`),
      );

      // 轮询 T1 队列状态（每 2 秒检查一次）
      intervalId = setInterval(async () => {
        try {
          // 查询 T1 队列记录
          const { data: t1Record, error } = await supabase
            .from("classification_t1_queue_v5")
            .select("*")
            .eq("bookmark_id", bookmarkId)
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (error) {
            logger.error("Failed to query T1 queue", error, {
              bookmarkId: bookmarkId.toString(),
            });
            return;
          }

          if (!t1Record) {
            // 没有找到 T1 记录，可能还未创建
            return;
          }

          // 根据状态发送不同的事件
          if (t1Record.status === "processing") {
            const progressEvent: SSEEvent = {
              type: "progress",
              data: {
                status: "processing",
                progress: 50,
              },
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(progressEvent)}\n\n`),
            );
          } else if (t1Record.status === "completed") {
            const completedEvent: SSEEvent = {
              type: "completed",
              data: {
                status: "completed",
                folderId: t1Record.t1_folder_id?.toString(),
                confidence: t1Record.t1_confidence ?? undefined,
                reasoning: t1Record.t1_reasoning ?? undefined,
              },
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(completedEvent)}\n\n`),
            );

            logger.info("T1 correction completed", {
              bookmarkId: bookmarkId.toString(),
              folderId: t1Record.t1_folder_id?.toString() ?? undefined,
            });

            // 完成后关闭连接
            if (intervalId) clearInterval(intervalId);
            controller.close();
          } else if (t1Record.status === "failed") {
            const failedEvent: SSEEvent = {
              type: "failed",
              data: {
                status: "failed",
                error: t1Record.error_message || "Unknown error",
              },
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(failedEvent)}\n\n`),
            );

            logger.error("T1 correction failed", undefined, {
              bookmarkId: bookmarkId.toString(),
              errorMessage: t1Record.error_message,
            });

            // 失败后关闭连接
            if (intervalId) clearInterval(intervalId);
            controller.close();
          }
        } catch (err) {
          logger.error(
            "Error in T1 stream polling",
            err instanceof Error ? err : undefined,
            { bookmarkId: bookmarkId.toString() },
          );
          const errorEvent: SSEEvent = {
            type: "error",
            data: {
              error: err instanceof Error ? err.message : "Unknown error",
            },
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`),
          );
        }
      }, 2000); // 每 2 秒轮询一次

      // 30 秒超时保护
      setTimeout(() => {
        if (intervalId) clearInterval(intervalId);
        controller.close();
        logger.info("T1 Stream timeout", {
          bookmarkId: bookmarkId.toString(),
        });
      }, 30000);
    },

    cancel() {
      // 客户端断开连接时清理
      if (intervalId) clearInterval(intervalId);
      logger.info("T1 Stream cancelled", {
        bookmarkId: bookmarkId.toString(),
      });
    },
  });

  // 3. 返回 SSE 响应
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // 禁用 Nginx 缓冲
    },
  });
});
