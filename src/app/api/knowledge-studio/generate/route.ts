/**
 * Knowledge Studio - 生成 API
 * @route POST /api/knowledge-studio/generate
 * @description SSE 流式生成合成报告
 */

import type { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { createSSESender } from "@/lib/utils/sse-helper";
import { blueprintEngine, quotaManager } from "@/lib/knowledge-studio";
import type {
  BlueprintType,
  StreamChunk,
  ToneType,
} from "@/lib/knowledge-studio";
import type { Database } from "@/types/supabase";

const logger = createLogger("api:knowledge-studio:generate");

/**
 * 请求体 Schema
 */
const GenerateRequestSchema = z.object({
  blueprintType: z.enum([
    "debater",
    "blogger",
    "thread",
    "tutorial",
    "feynman",
  ]),
  bookmarkIds: z.array(z.string()).min(1, "至少选择一个书签"),
  title: z.string().optional(),
  customPrompt: z.string().optional(),
  targetLength: z.enum(["short", "medium", "long"]).default("medium"),
  tone: z.string().optional(),
});

/**
 * Pro 功能蓝图类型
 */
const PRO_BLUEPRINT_TYPES: BlueprintType[] = [
  "blogger",
  "thread",
  "tutorial",
  "feynman",
];

/**
 * POST /api/knowledge-studio/generate
 * SSE 流式生成合成报告
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const requestId = crypto.randomUUID();
  const supabase = await createClient();

  logger.info({ requestId }, "Generate request received");

  // 1. 解析请求体
  const body = await request.json();
  const parseResult = GenerateRequestSchema.safeParse(body);

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
    blueprintType,
    bookmarkIds,
    title,
    customPrompt,
    targetLength,
    tone,
  } = parseResult.data;

  // 2. Pro 功能检查
  if (PRO_BLUEPRINT_TYPES.includes(blueprintType)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", userId)
      .single<Database["public"]["Tables"]["profiles"]["Row"]>();

    const isPro =
      profile?.membership_type === "PRO" || profile?.membership_type === "pro";

    if (!isPro) {
      return new Response(
        JSON.stringify({
          error: {
            code: "PRO_REQUIRED",
            message: `${blueprintType} 模板为 Pro 功能，请升级会员`,
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ) as unknown as NextResponse;
    }
  }

  // 3. 获取书签数据
  const numericIds = bookmarkIds
    .map((id) => parseInt(id, 10))
    .filter((id) => !isNaN(id));
  const { data: bookmarks, error: bookmarkError } = await supabase
    .from("bookmarks")
    .select("id, title, url, ai_summary, platform")
    .eq("user_id", userId)
    .in("id", numericIds)
    .returns<
      Pick<
        Database["public"]["Tables"]["bookmarks"]["Row"],
        "id" | "title" | "url" | "ai_summary" | "platform"
      >[]
    >();

  if (bookmarkError || !bookmarks?.length) {
    return new Response(
      JSON.stringify({
        error: {
          code: "INVALID_BOOKMARKS",
          message: "未找到有效的书签",
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    ) as unknown as NextResponse;
  }

  // 4. 创建 SSE 响应流
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = createSSESender<StreamChunk>(controller, encoder);

      try {
        // 4.1 配额检查和扣除
        let savedReportId: string | undefined;

        const quotaResult = await quotaManager.executeWithQuota(
          userId,
          "blueprint_generation",
          async () => {
            // 4.2 准备素材
            const materials = bookmarks.map((b) => ({
              bookmarkId: String(b.id),
              title: b.title ?? "",
              url: b.url ?? "",
              content: b.ai_summary || "",
              platform: b.platform || undefined,
            }));

            // 4.3 执行生成
            const result = await blueprintEngine.generate(
              {
                requestId,
                userId,
                config: {
                  type: blueprintType,
                  targetLength,
                  tone: tone as ToneType | undefined,
                },
                materials,
                customPrompt,
              },
              (chunk) => sendEvent(chunk), // 进度回调
            );

            return result;
          },
          {
            onSuccess: async (result, _reqId) => {
              // 4.4 生成成功后保存报告
              if (result.success && result.content) {
                logger.info(
                  { requestId, hasContent: !!result.content },
                  "Saving report to database",
                );

                // 类型安全的插入操作
                type SynthesisReportInsert =
                  Database["public"]["Tables"]["synthesis_reports"]["Insert"];
                type SynthesisReportRow =
                  Database["public"]["Tables"]["synthesis_reports"]["Row"];

                const insertData: SynthesisReportInsert = {
                  user_id: userId,
                  source_type: "selection",
                  blueprint_type: blueprintType,
                  title: title || `${blueprintType} 报告`,
                  content: result.content,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  citations: (result.citations || []) as any,
                  generation_metadata: {
                    model: result.metadata?.model,
                    tokens_used: result.metadata?.tokens?.total,
                    duration_ms: result.metadata?.durationMs,
                    source_bookmark_ids: bookmarkIds,
                    blueprint_prompt_version: "1.0",
                  },
                };

                const { data: report, error: insertError } = await supabase
                  .from("synthesis_reports")
                  .insert(insertData)
                  .select("id")
                  .single<Pick<SynthesisReportRow, "id">>();

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
              logger.warn(
                { requestId, success: result.success },
                "Report generation not successful, skipping save",
              );
              return undefined;
            },
          },
        );

        if (quotaResult.success && quotaResult.data) {
          logger.info({ requestId, savedReportId }, "Sending done event");
          sendEvent({
            type: "done",
            data: {
              reportId: savedReportId,
              content: quotaResult.data.content,
              citations: quotaResult.data.citations,
            },
            timestamp: new Date().toISOString(),
            requestId,
          });

          if (!savedReportId) {
            logger.warn(
              { requestId },
              "Done event sent but reportId is missing",
            );
          }
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
  }) as unknown as NextResponse;
});
