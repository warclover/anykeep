/**
 * Knowledge Studio - 生成 API
 * @route POST /api/knowledge-studio/generate
 * @description SSE 流式生成合成报告
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { blueprintEngine, quotaManager } from "@/lib/knowledge-studio";
import type {
  BlueprintType,
  StreamChunk,
  ToneType,
} from "@/lib/knowledge-studio";

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
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  logger.info({ requestId }, "Generate request received");

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

    // 2. 解析请求体
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
      );
    }

    const {
      blueprintType,
      bookmarkIds,
      title,
      customPrompt,
      targetLength,
      tone,
    } = parseResult.data;

    // 3. Pro 功能检查
    if (PRO_BLUEPRINT_TYPES.includes(blueprintType)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("membership_type")
        .eq("id", user.id)
        .single();

      const isPro =
        profile?.membership_type === "PRO" ||
        profile?.membership_type === "pro";

      if (!isPro) {
        return new Response(
          JSON.stringify({
            error: {
              code: "PRO_REQUIRED",
              message: `${blueprintType} 蓝图为 Pro 功能，请升级会员`,
            },
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // 4. 获取书签数据
    const numericIds = bookmarkIds
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));
    const { data: bookmarks, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("id, title, url, ai_summary, platform")
      .eq("user_id", user.id)
      .in("id", numericIds);

    if (bookmarkError || !bookmarks?.length) {
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_BOOKMARKS",
            message: "未找到有效的书签",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 5. 创建 SSE 响应流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (chunk: StreamChunk) => {
          const data = JSON.stringify(chunk);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        try {
          // 5.1 配额检查和扣除
          const quotaResult = await quotaManager.executeWithQuota(
            user.id,
            "blueprint_generation",
            async () => {
              // 5.2 准备素材
              const materials = bookmarks.map((b) => ({
                bookmarkId: String(b.id),
                title: b.title,
                url: b.url,
                content: b.ai_summary || "",
                platform: b.platform || undefined,
              }));

              // 5.3 执行生成
              const result = await blueprintEngine.generate(
                {
                  requestId,
                  userId: user.id,
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
                // 5.4 生成成功后保存报告
                if (result.success && result.content) {
                  const { data: report } = await (
                    supabase
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      .from("synthesis_reports") as any
                  )
                    .insert({
                      user_id: user.id,
                      blueprint_type: blueprintType,
                      title: title || `${blueprintType} 报告`,
                      content: result.content,
                      citations: result.citations || [],
                      generation_metadata: {
                        model: result.metadata?.model,
                        tokens_used: result.metadata?.tokens?.total,
                        duration_ms: result.metadata?.durationMs,
                        source_bookmark_ids: bookmarkIds,
                        blueprint_prompt_version: "1.0",
                      },
                    })
                    .select("id")
                    .single();

                  return report?.id;
                }
                return undefined;
              },
            },
          );

          if (quotaResult.success && quotaResult.data) {
            // 发送完成事件
            sendEvent({
              type: "done",
              data: {
                reportId: quotaResult.data.metadata?.reportId,
                content: quotaResult.data.content,
                citations: quotaResult.data.citations,
              },
              timestamp: new Date().toISOString(),
              requestId,
            });
          } else {
            // 发送错误事件
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
      "Generate request failed",
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
