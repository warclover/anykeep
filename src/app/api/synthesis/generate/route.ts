/**
 * 综述生成 API (SSE 流式响应)
 *
 * POST /api/synthesis/generate - 启动综述生成（流式返回进度和内容）
 *
 * @version 1.1.0
 * @since 2025-12-29
 * @updated 2025-12-29 - 集成 ThematicSynthesisSkill 真实生成
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  type SynthesisSSEEvent,
  type ConsensusPoint,
  type DivergencePoint,
  type BlindSpot,
  SynthesisErrorCode,
} from "@/lib/synthesis";
import { thematicSynthesisSkill } from "@/lib/ai-skills/skills/thematic-synthesis";
import type { OrchestrationContext } from "@/lib/ai-skills/orchestration/types";
import type { OrchestrationStreamChunk } from "@/lib/ai-skills/output/types";
import type { ThematicSynthesisOutput } from "@/lib/ai-skills/skills/thematic-synthesis/types";

interface GenerateRequest {
  reportId: string;
}

/**
 * 发送 SSE 事件
 */
function sendSSEEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  event: SynthesisSSEEvent,
): void {
  const data = JSON.stringify(event);
  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
}

/**
 * 处理流式输出块，转换为 SynthesisSSEEvent
 *
 * OrchestrationStreamChunk 类型映射：
 * - progress → progress 事件
 * - text → 累积到概述（不单独发送）
 * - deliverable → 从内容中提取四维数据并发送
 * - error → error 事件
 * - done → 由调用方处理 complete 事件
 */
async function handleStreamChunk(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  chunk: OrchestrationStreamChunk,
  _reportId: string,
  onOutput: (output: ThematicSynthesisOutput) => void,
): Promise<void> {
  switch (chunk.type) {
    case "progress":
      // 进度事件直接转发
      sendSSEEvent(controller, encoder, {
        type: "progress",
        data: {
          step: chunk.data.step,
          percent: chunk.data.percent,
          message: chunk.data.message || chunk.data.step,
        },
      });
      break;

    case "deliverable":
      // deliverable 包含完整的 ThematicSynthesisOutput
      if (chunk.data.metadata?.skillId === "thematic_synthesis") {
        const output = chunk.data.content as ThematicSynthesisOutput;
        onOutput(output);

        // 发送概述事件
        if (output.overview) {
          sendSSEEvent(controller, encoder, {
            type: "overview",
            data: {
              content: output.overview,
              isComplete: true,
            },
          });
        }

        // 发送共识事件
        if (output.consensus && output.consensus.length > 0) {
          sendSSEEvent(controller, encoder, {
            type: "consensus",
            data: {
              items: output.consensus as ConsensusPoint[],
              isComplete: true,
            },
          });
        }

        // 发送分歧事件
        if (output.divergence && output.divergence.length > 0) {
          sendSSEEvent(controller, encoder, {
            type: "divergence",
            data: {
              items: output.divergence as DivergencePoint[],
              isComplete: true,
            },
          });
        }

        // 发送盲区事件
        if (output.blindSpots && output.blindSpots.length > 0) {
          sendSSEEvent(controller, encoder, {
            type: "blindspot",
            data: {
              items: output.blindSpots as BlindSpot[],
              isComplete: true,
            },
          });
        }
      }
      break;

    case "error":
      sendSSEEvent(controller, encoder, {
        type: "error",
        data: {
          code: chunk.data.code || SynthesisErrorCode.GENERATION_FAILED,
          message: chunk.data.message,
        },
      });
      break;

    case "text":
      // 文本块用于流式预览（暂不单独发送，由 deliverable 统一处理）
      break;

    case "done":
      // done 事件由调用方处理 complete 事件
      break;

    default:
      // 其他类型暂不处理（confirmation, suggestions 等）
      break;
  }
}

/**
 * POST /api/synthesis/generate - 启动综述生成（SSE 流式响应）
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // 创建 SSE 流
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const supabase = await createClient();

        // 验证用户
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          sendSSEEvent(controller, encoder, {
            type: "error",
            data: {
              code: SynthesisErrorCode.UNAUTHORIZED,
              message: "Unauthorized",
            },
          });
          controller.close();
          return;
        }

        // 解析请求体
        const body: GenerateRequest = await request.json();
        const { reportId } = body;

        if (!reportId) {
          sendSSEEvent(controller, encoder, {
            type: "error",
            data: {
              code: SynthesisErrorCode.INVALID_PARAMS,
              message: "reportId is required",
            },
          });
          controller.close();
          return;
        }

        // 获取报告信息
        // 类型断言: 手动维护类型文件时需要此断言
        type SynthesisReportGenerateRow = {
          status: string;
          depth_mode: string;
          source_type: string;
          source_id: string | null;
          source_bookmark_ids: string[] | null;
          title: string;
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: report, error: fetchError } = await (supabase.from("synthesis_reports") as any)
          .select("*")
          .eq("id", reportId)
          .eq("user_id", user.id)
          .single() as { data: SynthesisReportGenerateRow | null; error: { message: string } | null };

        if (fetchError || !report) {
          sendSSEEvent(controller, encoder, {
            type: "error",
            data: {
              code: SynthesisErrorCode.NOT_FOUND,
              message: "Report not found",
            },
          });
          controller.close();
          return;
        }

        // 检查状态
        if (report.status === "completed") {
          sendSSEEvent(controller, encoder, {
            type: "error",
            data: {
              code: "ALREADY_COMPLETED",
              message: "Report already completed",
            },
          });
          controller.close();
          return;
        }

        if (report.status === "generating") {
          sendSSEEvent(controller, encoder, {
            type: "error",
            data: {
              code: "ALREADY_GENERATING",
              message: "Report is already being generated",
            },
          });
          controller.close();
          return;
        }

        // 使用乐观锁更新状态：只有 pending 状态才能开始生成
        // 这样可以避免 TOCTOU 竞态条件
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: updated } = await (supabase.from("synthesis_reports") as any)
          .update({ status: "generating" })
          .eq("id", reportId)
          .eq("status", "pending") // 乐观锁：只更新 pending 状态的记录
          .select("id")
          .maybeSingle() as { data: { id: string } | null };

        // 如果没有更新任何记录，说明状态已变更（可能被另一个请求抢占）
        if (!updated) {
          sendSSEEvent(controller, encoder, {
            type: "error",
            data: {
              code: "ALREADY_GENERATING",
              message: "Report generation was started by another request",
            },
          });
          controller.close();
          return;
        }

        logger.info(
          { reportId, userId: user.id, depthMode: report.depth_mode },
          "Starting synthesis generation",
        );

        // 发送初始进度
        sendSSEEvent(controller, encoder, {
          type: "progress",
          data: {
            step: "prepare",
            percent: 0,
            message: "正在准备数据...",
          },
        });

        // 构建 OrchestrationContext
        const orchestrationContext: OrchestrationContext = {
          userId: user.id,
          traceId: `synthesis-${reportId}-${Date.now()}`,
          params: {
            sourceType: report.source_type,
            sourceId: report.source_id,
            bookmarkIds: report.source_bookmark_ids,
            depthMode: report.depth_mode,
            reportId: reportId,
            title: report.title,
          },
          onProgress: (step, percent, message) => {
            sendSSEEvent(controller, encoder, {
              type: "progress",
              data: { step, percent, message: message || step },
            });
          },
        };

        // 执行 ThematicSynthesisSkill 并处理流式输出
        let wordCount = 0;

        for await (const chunk of thematicSynthesisSkill.executeStream(
          orchestrationContext,
        )) {
          // 根据 chunk 类型转换为 SynthesisSSEEvent
          await handleStreamChunk(
            controller,
            encoder,
            chunk,
            reportId,
            (output) => {
              wordCount = output.wordCount || 0;
            },
          );
        }

        // 发送完成事件
        sendSSEEvent(controller, encoder, {
          type: "complete",
          data: {
            reportId,
            wordCount,
          },
        });

        logger.info({ reportId, wordCount }, "Synthesis generation completed");

        controller.close();
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "Synthesis generate API error",
        );

        sendSSEEvent(controller, encoder, {
          type: "error",
          data: {
            code: SynthesisErrorCode.GENERATION_FAILED,
            message:
              error instanceof Error ? error.message : "Generation failed",
          },
        });

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
