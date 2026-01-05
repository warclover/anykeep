/**
 * Knowledge Studio v2 - Generate API
 * @route POST /api/knowledge-studio/v2/generate
 * @description SSE stream for content generation with outline-first mode support
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { getBlueprintRegistry } from "@/lib/knowledge-studio/blueprint/blueprint-registry";
import { quotaManager } from "@/lib/knowledge-studio";
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

const logger = createLogger("api:knowledge-studio:v2:generate");

/**
 * Request schema
 */
const GenerateV2RequestSchema = z.object({
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
      answeredAt: z.string(),
    })
    .optional()
    .transform((ctx) =>
      ctx
        ? {
            answers: ctx.answers,
            answeredAt: new Date(ctx.answeredAt),
          }
        : undefined,
    ),
  outline: z
    .object({
      title: z.string(),
      summary: z.string(),
      nodes: z.array(z.any()),
      totalEstimatedWords: z.number(),
      generatedBy: z.string(),
    })
    .optional(),
  targetLength: z.enum(["short", "medium", "long"]).default("medium"),
  customPrompt: z.string().optional(),
});

/**
 * SSE chunk types for v2 generate
 */
interface GenerateV2SSEChunk {
  type: "progress" | "content" | "structured_output" | "done" | "error";
  data: {
    step?: string;
    percent?: number;
    text?: string;
    structuredOutput?: unknown;
    reportId?: string;
    message?: string;
    error?: {
      code: string;
      message: string;
      recoverable?: boolean;
    };
  };
  timestamp: string;
  requestId: string;
}

/**
 * POST /api/knowledge-studio/v2/generate
 * SSE stream for content generation with outline-first mode
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  logger.info({ requestId }, "Generate v2 request received");

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
    const parseResult = GenerateV2RequestSchema.safeParse(body);

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
      blueprintId,
      materials,
      briefingContext,
      outline,
      targetLength,
      customPrompt,
    } = parseResult.data;

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

    // 5. Check quota
    const metadata = blueprint.getBlueprintMetadata();
    const quotaCheck = await quotaManager.checkQuota(
      user.id,
      metadata.creditsCost,
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

    // 6. Create SSE response stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (chunk: GenerateV2SSEChunk) => {
          const data = JSON.stringify(chunk);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        try {
          let savedReportId: string | undefined;

          // Execute with quota management
          const quotaResult = await quotaManager.executeWithQuota(
            user.id,
            "blueprint_generation",
            async () => {
              // Prepare context with input in params
              const executionContext = {
                requestId,
                userId: user.id,
                stage: "outline" as const,
                params: {
                  materials: materials as MaterialInput[],
                  briefingContext: briefingContext as
                    | BriefingContext
                    | undefined,
                  targetLength,
                  customPrompt,
                  requestMetadata: {
                    requestId,
                    userId: user.id,
                  },
                },
                // If outline is provided, inject it into context
                outline: outline as BlueprintOutline | undefined,
              };

              // Send initial progress
              sendEvent({
                type: "progress",
                data: {
                  step: "preparing",
                  percent: 5,
                  message: "正在准备生成...",
                },
                timestamp: new Date().toISOString(),
                requestId,
              });

              // Execute blueprint stream (takes only context, input is in context.params)
              const resultStream = blueprint.executeStream(executionContext);
              let finalOutput = null;
              let contentBuffer = "";

              for await (const chunk of resultStream) {
                switch (chunk.type) {
                  case "progress":
                    sendEvent({
                      type: "progress",
                      data: {
                        step: chunk.data.step || "generating",
                        percent: chunk.data.percent || 0,
                        message: chunk.data.message,
                      },
                      timestamp: new Date().toISOString(),
                      requestId,
                    });
                    break;

                  case "text":
                    contentBuffer += chunk.data.text || "";
                    sendEvent({
                      type: "content",
                      data: { text: chunk.data.text },
                      timestamp: new Date().toISOString(),
                      requestId,
                    });
                    break;

                  case "deliverable":
                    finalOutput = chunk.data.content;
                    sendEvent({
                      type: "structured_output",
                      data: { structuredOutput: chunk.data.content },
                      timestamp: new Date().toISOString(),
                      requestId,
                    });
                    break;
                }
                // Backpressure control: add small delay between chunks
                await new Promise((resolve) =>
                  setTimeout(resolve, SSE_CHUNK_DELAY_MS),
                );
              }

              return {
                success: true,
                content: contentBuffer || JSON.stringify(finalOutput),
                structuredOutput: finalOutput,
              };
            },
            {
              onSuccess: async (result, _reqId) => {
                if (result.success && result.content) {
                  // Save report to database
                  type SynthesisReportInsert =
                    Database["public"]["Tables"]["synthesis_reports"]["Insert"];

                  const insertData: SynthesisReportInsert = {
                    user_id: user.id,
                    blueprint_type: blueprintId,
                    title: `${metadata.displayName} 报告`,
                    content: result.content,
                    generation_metadata: {
                      blueprint_version: "v2",
                      blueprint_id: blueprintId,
                      source_bookmark_ids: materials.map((m) => m.bookmarkId),
                      has_briefing: !!briefingContext,
                      has_outline: !!outline,
                      target_length: targetLength,
                    },
                  };

                  const { data: report, error: insertError } = await supabase
                    .from("synthesis_reports")
                    .insert(insertData)
                    .select("id")
                    .single();

                  if (insertError) {
                    logger.error(
                      { requestId, error: insertError },
                      "Failed to save report",
                    );
                    throw insertError;
                  }

                  savedReportId = report?.id;
                  logger.info(
                    { requestId, reportId: savedReportId },
                    "Report saved successfully",
                  );
                  return report?.id;
                }
                return undefined;
              },
              cost: metadata.creditsCost,
            },
          );

          if (quotaResult.success) {
            // Send done event
            sendEvent({
              type: "done",
              data: {
                reportId: savedReportId,
                message: "生成完成",
              },
              timestamp: new Date().toISOString(),
              requestId,
            });

            logger.info(
              { requestId, blueprintId, reportId: savedReportId },
              "Generation completed",
            );
          } else {
            sendEvent({
              type: "error",
              data: {
                error: {
                  code: quotaResult.error?.code || "GENERATION_FAILED",
                  message: quotaResult.error?.message || "生成失败",
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
              error: error instanceof Error ? error.message : String(error),
            },
            "Generation stream error",
          );

          sendEvent({
            type: "error",
            data: {
              error: {
                code: "STREAM_ERROR",
                message: "生成过程中发生错误",
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
        error: error instanceof Error ? error.message : String(error),
      },
      "Generate v2 request failed",
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
