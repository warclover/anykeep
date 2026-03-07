/**
 * Knowledge Studio - Chat-to-Edit API
 * @route POST /api/knowledge-studio/reports/[id]/edit
 * @description SSE 流式聊天编辑
 */

import type { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { createSSESender } from "@/lib/utils/sse-helper";
import { z } from "zod";
import { chatEditEngine, quotaManager } from "@/lib/knowledge-studio";
import type { EditMode, StreamChunk, ToneType } from "@/lib/knowledge-studio";
import type { Database } from "@/types/supabase";

const logger = createLogger("api:knowledge-studio:reports:[id]:edit");

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
export const POST = withAuthMiddleware<{ id: string }>(
  async (request, { userId, params }) => {
    const requestId = crypto.randomUUID();
    const { id: reportId } = await params;
    const supabase = await createClient();

    logger.info({ requestId, reportId }, "Edit request received");

    // 1. Pro 功能检查（Chat-to-Edit 为 Pro 功能）
    type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", userId)
      .single<Pick<ProfileRow, "membership_type">>();

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
      ) as unknown as NextResponse;
    }

    // 2. 解析请求体
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
      ) as unknown as NextResponse;
    }

    const {
      paragraphIndex,
      instruction,
      mode,
      targetTone,
      conversationHistory,
    } = parseResult.data;

    // 3. 获取报告内容
    type SynthesisReportRow =
      Database["public"]["Tables"]["synthesis_reports"]["Row"];
    const { data: report, error: reportError } = await supabase
      .from("synthesis_reports")
      .select("id, content, blueprint_type")
      .eq("id", reportId)
      .eq("user_id", userId)
      .single<Pick<SynthesisReportRow, "id" | "content" | "blueprint_type">>();

    if (reportError || !report) {
      return new Response(
        JSON.stringify({
          error: { code: "NOT_FOUND", message: "报告不存在" },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      ) as unknown as NextResponse;
    }

    if (!report.content) {
      return new Response(
        JSON.stringify({
          error: { code: "NO_CONTENT", message: "报告内容为空" },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ) as unknown as NextResponse;
    }

    // 4. 解析段落
    const paragraphs = report.content
      .split("\n\n")
      .filter((p: string) => p.trim());
    if (paragraphIndex >= paragraphs.length) {
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_PARAGRAPH",
            message: "段落索引超出范围",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ) as unknown as NextResponse;
    }

    // 5. 创建 SSE 响应流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = createSSESender<StreamChunk>(controller, encoder);

        try {
          // 5.1 配额检查和扣除
          const quotaResult = await quotaManager.executeWithQuota(
            userId,
            "chat_edit",
            async () => {
              // 5.2 构建编辑上下文
              const editContext = chatEditEngine.buildContext(
                paragraphs,
                paragraphIndex,
                conversationHistory.map((turn) => ({
                  ...turn,
                  timestamp: new Date(turn.timestamp),
                })),
              );

              editContext.reportContext.blueprintType =
                report.blueprint_type ?? "";

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

              // 5.3 执行编辑
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
              sendEvent({
                type: "text",
                data: {
                  newContent: editResult.newContent,
                  diff: editResult.diff,
                },
                timestamp: new Date().toISOString(),
                requestId,
              });

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
    }) as unknown as NextResponse;
  },
);
