/**
 * TTSSynthesisSkill - 语音朗读 Skill
 *
 * 功能：
 * - 将书签摘要转换为语音
 * - 支持多种内容类型（TLDR、摘要、要点）
 * - 流式进度反馈
 *
 * 执行流程：
 * 1. 解析用户输入的朗读请求
 * 2. 获取书签摘要数据
 * 3. 准备朗读文本
 * 4. 调用 TTS 服务合成语音
 * 5. 输出音频交付物
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { z } from "zod";
import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { TTSSynthesisInput, TTSSynthesisOutput } from "./types";
import { TTS_STEPS } from "./types";
import type { TTSContentType, TTSVoiceGender } from "@/lib/tts";
import { getTTSService, TTSError } from "@/lib/tts";
import {
  parseStructuredSummary,
  getDisplaySummary,
} from "@/lib/summary/summary.types";

// ============================================
// Schema 定义
// ============================================

const TTSSynthesisInputSchema = z.object({
  bookmarkId: z.number().int().positive().describe("书签ID"),
  contentType: z
    .enum(["tldr", "summary", "keypoints", "all"])
    .default("summary")
    .describe("朗读内容类型"),
  speed: z.number().min(0.5).max(2.0).optional().describe("语速 (0.5-2.0)"),
  voiceGender: z.enum(["male", "female"]).optional().describe("语音性别"),
  voice: z.string().optional().describe("指定语音ID"),
});

const TTSSynthesisOutputSchema = z.object({
  audioBase64: z.string(),
  format: z.string(),
  durationSec: z.number(),
  charCount: z.number(),
  bookmarkTitle: z.string(),
  contentType: z.enum(["tldr", "summary", "keypoints", "all"]),
  requestId: z.string(),
});

// ============================================
// TTSSynthesisSkill 实现
// ============================================

export class TTSSynthesisSkill extends OrchestrationSkill<
  TTSSynthesisInput,
  TTSSynthesisOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "tts_synthesis",
    name: "语音朗读助手",
    description:
      "将书签摘要内容转换为语音朗读，支持一句话总结、完整摘要、关键要点等多种模式。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["tts-synthesis", "content-extraction", "audio-generation"],
    requiresConfirmation: false,
    estimatedDurationMs: 10000,
    maxExecutionTimeMs: 60000,
    deliverableTypes: ["audio"],
    outputFormats: ["audio"],
    steps: TTS_STEPS,
  };

  readonly inputSchema = TTSSynthesisInputSchema;
  readonly outputSchema = TTSSynthesisOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<TTSSynthesisInput> {
    // 解析书签 ID
    let bookmarkId = 0;
    const idMatch = message.match(/(?:书签|收藏)?(?:ID|id)?[：:\s]*(\d+)/);
    if (idMatch) {
      bookmarkId = parseInt(idMatch[1], 10);
    }

    // 解析内容类型
    let contentType: TTSContentType = "summary";
    if (/完整|全部|详细|所有/.test(message)) {
      contentType = "all";
    } else if (/要点|关键|重点/.test(message)) {
      contentType = "keypoints";
    } else if (/一句话|简短|简要|tldr|tl;?dr/i.test(message)) {
      contentType = "tldr";
    }

    // 解析语速
    let speed: number | undefined;
    if (/快一点|快点|加速|快速/.test(message)) {
      speed = 1.3;
    } else if (/慢一点|慢点|减速|慢速/.test(message)) {
      speed = 0.8;
    }
    const speedMatch = message.match(/(\d+(?:\.\d+)?)\s*倍速?/);
    if (speedMatch) {
      speed = Math.max(0.5, Math.min(2.0, parseFloat(speedMatch[1])));
    }

    // 解析语音性别
    let voiceGender: TTSVoiceGender | undefined;
    if (/女声|女生|女性/.test(message)) {
      voiceGender = "female";
    } else if (/男声|男生|男性/.test(message)) {
      voiceGender = "male";
    }

    return {
      bookmarkId,
      contentType,
      speed,
      voiceGender,
    };
  }

  /**
   * 流式执行语音合成
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as TTSSynthesisInput;

    // 初始化进度
    this.initProgress(TTS_STEPS);

    try {
      // Step 1: 解析请求
      yield* this.reportProgress("解析请求", 5, "正在解析朗读请求...");
      yield* this.emitText("🎧 正在准备语音朗读...\n\n");

      if (!input.bookmarkId) {
        yield* this.emitText("❌ 请指定要朗读的书签 ID。\n");
        yield* this.emitDone(false, "缺少书签 ID");
        return;
      }

      yield* this.reportProgress("解析请求", 10, "请求解析完成");

      // Step 2: 获取书签数据
      yield* this.reportProgress("获取摘要", 15, "正在获取书签摘要...");

      const supabase = await createClient();
      const { data: bookmark, error: bookmarkError } = await supabase
        .from("bookmarks")
        .select("id, title, ai_summary")
        .eq("id", input.bookmarkId)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (bookmarkError || !bookmark) {
        logger.warn(
          {
            skillId: this.metadata.id,
            userId: context.userId,
            bookmarkId: input.bookmarkId,
            error: bookmarkError?.message,
          },
          "TTSSynthesisSkill: Bookmark not found",
        );
        yield* this.emitText("❌ 书签不存在或无权访问。\n");
        yield* this.emitDone(false, "书签不存在");
        return;
      }

      if (!bookmark.ai_summary) {
        yield* this.emitText("❌ 该书签暂无 AI 摘要，请先生成摘要。\n");
        yield* this.emitDone(false, "无摘要内容");
        return;
      }

      yield* this.reportProgress(
        "获取摘要",
        30,
        `获取到摘要：${bookmark.title}`,
      );
      yield* this.emitText(`📖 正在朗读: **${bookmark.title}**\n\n`);

      // Step 3: 准备文本
      yield* this.reportProgress("准备文本", 35, "正在准备朗读文本...");

      const text = this.prepareText(bookmark, input.contentType || "summary");

      if (!text || text.trim().length === 0) {
        yield* this.emitText("❌ 无可朗读的内容。\n");
        yield* this.emitDone(false, "内容为空");
        return;
      }

      yield* this.reportProgress("准备文本", 45, `文本长度: ${text.length} 字`);

      // Step 4: 合成语音
      yield* this.reportProgress("合成语音", 50, "正在合成语音，请稍候...");
      yield* this.emitText("🔊 正在合成语音...\n\n");

      const ttsService = getTTSService();

      // 检查服务可用性
      const serviceStatus = ttsService.isAvailable();
      if (!serviceStatus.available) {
        yield* this.emitText("❌ TTS 服务暂不可用。\n");
        yield* this.emitDone(false, "TTS 服务不可用");
        return;
      }

      // 确定语音
      let selectedVoice = input.voice;
      if (!selectedVoice && input.voiceGender) {
        selectedVoice = ttsService.getDefaultVoice(input.voiceGender);
      }

      // 调用 TTS 服务
      const ttsResult = await ttsService.synthesize(text, {
        voice: selectedVoice,
        speed: input.speed,
      });

      yield* this.reportProgress("合成语音", 90, "语音合成完成");

      // Step 5: 输出交付物
      yield* this.reportProgress("输出音频", 95, "正在生成音频交付物...");

      // 转换为 Base64
      const audioBase64 = this.arrayBufferToBase64(ttsResult.audio);

      // 构建输出（用于类型验证，实际数据通过 deliverable 传递）
      const _output: TTSSynthesisOutput = {
        audioBase64,
        format: ttsResult.format,
        durationSec: ttsResult.durationSec,
        charCount: ttsResult.charCount,
        bookmarkTitle: bookmark.title,
        contentType: input.contentType || "summary",
        requestId: ttsResult.requestId,
      };

      // 输出交付物
      const deliverable = this.createDeliverable(
        "audio",
        `${bookmark.title} - 语音朗读`,
        {
          audioBase64,
          format: ttsResult.format,
          durationSec: ttsResult.durationSec,
          charCount: ttsResult.charCount,
        },
        "audio",
        {
          downloadable: true,
          shareable: false,
          metadata: {
            bookmarkId: input.bookmarkId,
            contentType: input.contentType,
            requestId: ttsResult.requestId,
          },
        },
      );

      yield* this.emitDeliverable(deliverable);

      const latencyMs = Date.now() - startTime;

      yield* this.emitText(
        `✅ 语音合成完成！时长 ${ttsResult.durationSec.toFixed(1)} 秒，共 ${ttsResult.charCount} 字。\n`,
      );

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          bookmarkId: input.bookmarkId,
          contentType: input.contentType,
          charCount: ttsResult.charCount,
          durationSec: ttsResult.durationSec,
          latencyMs,
        },
        "TTSSynthesisSkill: Completed",
      );

      yield* this.reportProgress("输出音频", 100, "完成");
      yield* this.emitDone(true, "语音合成完成");
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
          latencyMs,
        },
        "TTSSynthesisSkill: Error",
      );

      if (error instanceof TTSError) {
        yield* this.emitText(`❌ 语音合成失败: ${error.message}\n`);
      } else {
        yield* this.emitText("❌ 语音合成服务异常，请稍后重试。\n");
      }

      yield* this.emitDone(false, "语音合成失败");
    }
  }

  /**
   * 准备朗读文本
   */
  private prepareText(
    bookmark: {
      title: string;
      ai_summary: string | null;
    },
    contentType: TTSContentType,
  ): string {
    const parts: string[] = [];

    const structured = bookmark.ai_summary
      ? parseStructuredSummary(bookmark.ai_summary)
      : null;

    const displaySummary = bookmark.ai_summary
      ? getDisplaySummary(bookmark.ai_summary)
      : "";

    switch (contentType) {
      case "tldr":
        if (structured?.tldr) {
          parts.push(structured.tldr);
        } else if (displaySummary) {
          parts.push(displaySummary.slice(0, 100));
        }
        break;

      case "summary":
        if (displaySummary) {
          parts.push(displaySummary);
        }
        break;

      case "keypoints":
        if (structured?.key_points && structured.key_points.length > 0) {
          structured.key_points.forEach((point, index) => {
            parts.push(`第${index + 1}点：${point}`);
          });
        } else if (displaySummary) {
          parts.push(displaySummary);
        }
        break;

      case "all":
        parts.push(`标题：${bookmark.title}`);
        if (structured?.tldr) {
          parts.push(`一句话总结：${structured.tldr}`);
        }
        if (displaySummary) {
          parts.push(`摘要：${displaySummary}`);
        }
        if (structured?.key_points && structured.key_points.length > 0) {
          parts.push("关键要点：");
          structured.key_points.forEach((point, index) => {
            parts.push(`第${index + 1}点：${point}`);
          });
        }
        break;
    }

    return parts.join("。\n");
  }

  /**
   * ArrayBuffer 转 Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

/**
 * 导出单例实例
 */
export const ttsSynthesisSkill = new TTSSynthesisSkill();
