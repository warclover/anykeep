/**
 * SSE 实时进度推送端点
 *
 * GET /api/workflow/sse?ids=id1,id2
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkflowOrchestrator } from "@/lib/workflow/orchestrator";

export const runtime = "edge"; // Edge Runtime 支持 SSE

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const executionIdsParam = searchParams.get("ids");

  if (!executionIdsParam) {
    return new Response("No execution IDs provided", { status: 400 });
  }

  // 复制一份可变数组
  const executionIds = executionIdsParam.split(",").filter(Boolean);

  if (executionIds.length === 0) {
    return new Response("No valid execution IDs provided", { status: 400 });
  }

  const encoder = new TextEncoder();
  const orchestrator = getWorkflowOrchestrator();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // 定期检查执行状态并推送
      const checkInterval = setInterval(async () => {
        try {
          const idsToRemove: string[] = [];

          for (const executionId of executionIds) {
            const execution = await orchestrator.getExecution(executionId);

            if (execution && execution.userId === user.id) {
              sendEvent({
                type: "progress",
                executionId,
                execution,
              });

              // 终态时标记移除
              if (
                ["completed", "failed", "cancelled"].includes(execution.status)
              ) {
                idsToRemove.push(executionId);
              }
            }
          }

          // 移除已完成的 ID
          for (const id of idsToRemove) {
            const index = executionIds.indexOf(id);
            if (index > -1) executionIds.splice(index, 1);
          }

          // 所有执行完成时关闭连接
          if (executionIds.length === 0) {
            sendEvent({ type: "done" });
            clearInterval(checkInterval);
            controller.close();
          }
        } catch (error) {
          sendEvent({
            type: "error",
            message:
              error instanceof Error ? error.message : "Failed to fetch status",
          });
        }
      }, 500); // 服务端 500ms 检查间隔

      // 客户端断开连接时清理
      request.signal.addEventListener("abort", () => {
        clearInterval(checkInterval);
        controller.close();
      });

      // 发送初始连接成功事件
      sendEvent({ type: "connected", ids: executionIds });
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
