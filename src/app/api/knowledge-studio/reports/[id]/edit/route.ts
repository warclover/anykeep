/**
 * Knowledge Studio - Chat-to-Edit API
 * @route POST /api/knowledge-studio/reports/[id]/edit
 * @description SSE 流式聊天编辑
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { chatEditEngine, quotaManager } from "@/lib/knowledge-studio";
import type { EditMode, StreamChunk, ToneType } from "@/lib/knowledge-studio";

const logger = createLogger("api:knowledge-studio:reports:[id]:edit");

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * 编辑请求 Schema
 */
const EditRequestSchema = z.object({
  paragraphIndex: z.number().min(0, "段落索引必须非负"),
  instruction: z.string().min(1, "编辑指令不能为空"),
  mode: z
    .enum(["rewrite", "expand", "simplify", "tone", "custom"])
    .default("rewrite"),
  targetTone: z.string().optional(),
  conversationHistory: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        timestamp: z.string(),
      }),
    )
    .default([]),
});

/**
 * POST /api/knowledge-studio/reports/[id]/edit
 * SSE 流式聊天编辑
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  const { id: reportId } = await context.params;

  logger.info({ requestId, reportId }, "Edit request received");

  try {
    // 1. 认证检查
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

    // 2. Pro 功能检查（Chat-to-Edit 为 Pro 功能）
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", user.id)
      .single();

    const isPro =
      profile?.membership_type === "PRO" || profile?.membership_type === "pro";

    if (!isPro) {
      return new Response(
        JSON.stringify({
          error: {
            code: "PRO_REQUIRED",
            message: "聊天式编辑为 Pro 功能，请升级会员",
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    // 3. 解析请求体
    const body = await request.json();
    const parseResult = EditRequestSchema.safeParse(body);

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
      paragraphIndex,
      instruction,
      mode,
      targetTone,
      conversationHistory,
    } = parseResult.data;

    // 4. 获取报告内容
    const { data: report, error: reportError } = await (
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("synthesis_reports") as any
    )
      .select("id, content, blueprint_type")
      .eq("id", reportId)
      .eq("user_id", user.id)
      .single();

    if (reportError || !report) {
      return new Response(
        JSON.stringify({ error: { code: "NOT_FOUND", message: "报告不存在" } }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // 5. 解析段落
    const paragraphs = report.content
      .split("\n\n")
      .filter((p: string) => p.trim());
    if (paragraphIndex >= paragraphs.length) {
      return new Response(
        JSON.stringify({
          error: { code: "INVALID_PARAGRAPH", message: "段落索引超出范围" },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 6. 创建 SSE 响应流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (chunk: StreamChunk) => {
          const data = JSON.stringify(chunk);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        try {
          // 6.1 配额检查和扣除
          const quotaResult = await quotaManager.executeWithQuota(
            user.id,
            "chat_edit",
            async () => {
              // 6.2 构建编辑上下文
              const editContext = chatEditEngine.buildContext(
                paragraphs,
                paragraphIndex,
                conversationHistory.map((turn) => ({
                  ...turn,
                  timestamp: new Date(turn.timestamp),
                })),
              );

              // 填充报告上下文
              editContext.reportContext.blueprintType = report.blueprint_type;

              // 发送开始事件
              sendEvent({
                type: "progress",
                data: {
                  stage: "parsing",
                  stageProgress: 0,
                  totalProgress: 0,
                },
                timestamp: new Date().toISOString(),
                requestId,
              });

              // 6.3 执行编辑
              const result = await chatEditEngine.edit({
                reportId,
                paragraphIndex,
                intent: {
                  mode: mode as EditMode,
                  instruction,
                  targetTone: targetTone as ToneType | undefined,
                },
                context: editContext,
              });

              return result;
            },
          );

          if (quotaResult.success && quotaResult.data) {
            const editResult = quotaResult.data;

            if (editResult.success && editResult.newContent) {
              // 发送编辑结果
              sendEvent({
                type: "text",
                data: {
                  newContent: editResult.newContent,
                  diff: editResult.diff,
                },
                timestamp: new Date().toISOString(),
                requestId,
              });

              // 发送完成事件
              sendEvent({
                type: "done",
                data: {
                  success: true,
                  paragraphIndex,
                  newContent: editResult.newContent,
                },
                timestamp: new Date().toISOString(),
                requestId,
              });
            } else {
              sendEvent({
                type: "error",
                data: {
                  error: {
                    code: editResult.error?.code || "EDIT_FAILED",
                    message: editResult.error?.message || "编辑失败",
                    recoverable: editResult.error?.recoverable ?? true,
                  },
                },
                timestamp: new Date().toISOString(),
                requestId,
              });
            }
          } else {
            sendEvent({
              type: "error",
              data: {
                error: {
                  code: quotaResult.error?.code || "QUOTA_ERROR",
                  message: quotaResult.error?.message || "配额不足",
                  recoverable: quotaResult.error?.recoverable ?? false,
                },
              },
              timestamp: new Date().toISOString(),
              requestId,
            });
          }
        } catch (error) {
          logger.error(
            {
              requestId,
              reportId,
              error: error instanceof Error ? error.message : String(error),
            },
            "Edit stream error",
          );

          sendEvent({
            type: "error",
            data: {
              error: {
                code: "STREAM_ERROR",
                message: "编辑过程中发生错误",
                recoverable: true,
              },
            },
            timestamp: new Date().toISOString(),
            requestId,
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    logger.error(
      {
        requestId,
        reportId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Edit request failed",
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
