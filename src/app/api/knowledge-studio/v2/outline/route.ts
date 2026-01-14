/**
 * Knowledge Studio v2 - Outline Preview API
 * @route POST /api/knowledge-studio/v2/outline
 * @description SSE stream for outline preview generation
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { createSSESender } from "@/lib/utils/sse-helper";
import { z } from "zod";
import { getBlueprintRegistry } from "@/lib/knowledge-studio/blueprint/blueprint-registry";
import type {
  BlueprintTier,
  BriefingContext,
  MaterialInput,
  BlueprintOutline,
} from "@/lib/knowledge-studio/blueprint/types";
import type { Database } from "@/types/supabase";
import {
  MAX_MATERIALS_ALLOWED,
  SSE_CHUNK_DELAY_MS,
} from "@/lib/knowledge-studio/v2/constants";

const logger = createLogger("api:knowledge-studio:v2:outline");

/**
 * Request schema
 */
const OutlineRequestSchema = z.object({
  blueprintId: z.string().min(1, "Blueprint ID is required"),
  materials: z
    .array(
      z.object({
        bookmarkId: z.string(),
        title: z.string(),
        content: z.string(),
        url: z.string(),
        platform: z.string().optional(),
      }),
    )
    .min(1, "至少需要一个素材")
    .max(MAX_MATERIALS_ALLOWED, `最多支持 ${MAX_MATERIALS_ALLOWED} 个素材`),
  briefingContext: z
    .object({
      answers: z.record(
        z.string(),
        z.union([z.string(), z.array(z.string()), z.number()]),
      ),
      answeredAt: z.string().transform((s) => new Date(s)),
    })
    .optional(),
  targetLength: z.enum(["short", "medium", "long"]).default("medium"),
});

/**
 * SSE chunk types
 */
interface OutlineSSEChunk {
  type: "progress" | "outline" | "error" | "done";
  data: {
    step?: string;
    percent?: number;
    outline?: unknown;
    message?: string;
    error?: {
      code: string;
      message: string;
    };
  };
  timestamp: string;
  requestId: string;
}

/**
 * POST /api/knowledge-studio/v2/outline
 * SSE stream for outline preview generation
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  logger.info({ requestId }, "Outline preview request received");

  try {
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

    // 2. Parse request body
    const body = await request.json();
    const parseResult = OutlineRequestSchema.safeParse(body);

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

    const { blueprintId, materials, briefingContext, targetLength } =
      parseResult.data;

    // 3. Get blueprint from registry
    const registry = getBlueprintRegistry();
    const blueprint = registry.getById(blueprintId);

    if (!blueprint) {
      return new Response(
        JSON.stringify({
          error: {
            code: "BLUEPRINT_NOT_FOUND",
            message: `蓝图 "${blueprintId}" 不存在`,
          },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // 4. Check access permission
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", user.id)
      .single<Database["public"]["Tables"]["profiles"]["Row"]>();

    const membershipType = profile?.membership_type?.toLowerCase() || "free";
    const userTier: BlueprintTier =
      membershipType === "enterprise"
        ? "enterprise"
        : membershipType === "pro"
          ? "pro"
          : "free";

    if (!registry.canAccess(blueprintId, userTier)) {
      const accessInfo = registry.getAccessInfo(blueprintId, userTier);
      return new Response(
        JSON.stringify({
          error: {
            code: "ACCESS_DENIED",
            message: accessInfo?.upgradeMessage || "您没有权限使用此蓝图",
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    // 5. Create SSE response stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = createSSESender<OutlineSSEChunk>(controller, encoder);

        // Heartbeat to prevent connection timeout
        let heartbeatPercent = 40;
        const heartbeatInterval = setInterval(() => {
          heartbeatPercent = Math.min(heartbeatPercent + 5, 85);
          sendEvent({
            type: "progress",
            data: {
              step: "generating",
              percent: heartbeatPercent,
              message: "AI 正在思考中...",
            },
            timestamp: new Date().toISOString(),
            requestId,
          });
        }, 3000); // Send heartbeat every 3 seconds

        try {
          // Send initial progress
          sendEvent({
            type: "progress",
            data: {
              step: "analyzing",
              percent: 10,
              message: "正在分析素材...",
            },
            timestamp: new Date().toISOString(),
            requestId,
          });

          // Prepare input for blueprint
          const input = {
            materials: materials as MaterialInput[],
            briefingContext: briefingContext as BriefingContext | undefined,
            targetLength,
            requestMetadata: {
              requestId,
              userId: user.id,
            },
          };

          // Create execution context with proper type for generateOutline
          const context = {
            requestId,
            userId: user.id,
            stage: "outline" as const,
            params: input,
            outline: undefined as BlueprintOutline | undefined,
            intermediateContent: undefined as string | undefined,
          };

          // Generate outline using blueprint's method
          sendEvent({
            type: "progress",
            data: {
              step: "generating",
              percent: 40,
              message: "正在生成大纲...",
            },
            timestamp: new Date().toISOString(),
            requestId,
          });

          // Use the blueprint's generateOutline method
          const outlineGenerator = blueprint.generateOutline(context, input);
          let outline = null;
          let generatorResult: IteratorResult<unknown, unknown>;

          // Iterate through the generator, collecting progress chunks
          do {
            generatorResult = await outlineGenerator.next();
            if (!generatorResult.done && generatorResult.value) {
              const chunk = generatorResult.value as {
                type: string;
                data: { percent?: number; message?: string };
              };
              if (chunk.type === "progress") {
                sendEvent({
                  type: "progress",
                  data: {
                    step: "generating",
                    percent: 40 + (chunk.data.percent || 0) * 0.5,
                    message: chunk.data.message || "正在生成大纲...",
                  },
                  timestamp: new Date().toISOString(),
                  requestId,
                });
                // Backpressure control: add small delay between chunks
                await new Promise((resolve) =>
                  setTimeout(resolve, SSE_CHUNK_DELAY_MS),
                );
              }
            }
          } while (!generatorResult.done);

          // Get the final outline from the generator's return value
          outline = generatorResult.value;

          logger.info(
            {
              requestId,
              hasOutline: !!outline,
              outlineType: typeof outline,
              outlineKeys: outline ? Object.keys(outline) : [],
            },
            "Generator completed, checking outline",
          );

          if (!outline) {
            // If outline not in context, try to get return value
            // This is a simplified flow - in production, we'd properly handle the generator return
            sendEvent({
              type: "error",
              data: {
                error: {
                  code: "OUTLINE_GENERATION_FAILED",
                  message: "大纲生成失败",
                },
              },
              timestamp: new Date().toISOString(),
              requestId,
            });
            controller.close();
            return;
          }

          // Send outline result
          sendEvent({
            type: "outline",
            data: { outline },
            timestamp: new Date().toISOString(),
            requestId,
          });

          // Send done event
          sendEvent({
            type: "done",
            data: { message: "大纲生成完成" },
            timestamp: new Date().toISOString(),
            requestId,
          });

          logger.info(
            { requestId, blueprintId },
            "Outline generated successfully",
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          logger.error(
            {
              requestId,
              error: errorMessage,
              errorName: error instanceof Error ? error.name : "Unknown",
              stack: error instanceof Error ? error.stack : undefined,
            },
            "Outline generation stream error",
          );

          // 检测是否为超时错误
          const isTimeout =
            errorMessage.includes("超时") ||
            errorMessage.includes("timeout") ||
            errorMessage.includes("aborted");

          // DEBUG: 确认错误事件正在发送
          logger.info(
            {
              requestId,
              isTimeout,
              errorCode: isTimeout ? "TIMEOUT_ERROR" : "STREAM_ERROR",
              willSendMessage: errorMessage || "大纲生成过程中发生错误",
            },
            "[SSE DEBUG] Sending error event to client",
          );

          try {
            sendEvent({
              type: "error",
              data: {
                error: {
                  code: isTimeout ? "TIMEOUT_ERROR" : "STREAM_ERROR",
                  message: errorMessage || "大纲生成过程中发生错误",
                },
              },
              timestamp: new Date().toISOString(),
              requestId,
            });
            logger.info(
              { requestId },
              "[SSE DEBUG] Error event sent successfully",
            );
          } catch (sendError) {
            logger.error(
              {
                requestId,
                sendError:
                  sendError instanceof Error
                    ? sendError.message
                    : String(sendError),
              },
              "[SSE DEBUG] Failed to send error event!",
            );
          }
        } finally {
          clearInterval(heartbeatInterval);
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
        error: error instanceof Error ? error.message : String(error),
      },
      "Outline preview request failed",
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
