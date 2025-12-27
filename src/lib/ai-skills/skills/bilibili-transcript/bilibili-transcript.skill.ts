/**
 * BilibiliTranscriptSkill - B站视频字幕提取 Skill
 *
 * 功能：
 * - 从 B站视频中提取 CC 字幕
 * - 支持多种输出格式（纯文本、SRT、JSON、Markdown）
 * - 可选保存到书签记录
 * - 支持自动触发（保存书签时）和手动触发
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { SkillContext } from "../../core/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  BilibiliTranscriptInputSchema,
  BilibiliTranscriptOutputSchema,
  BILIBILI_TRANSCRIPT_STEPS,
  BILIBILI_TRANSCRIPT_ERRORS,
  type BilibiliTranscriptInput,
  type BilibiliTranscriptOutput,
} from "./types";
import { bilibiliApi } from "./api/bilibili-api";
import {
  parseBilibiliUrl,
  resolveShortLink,
  isValidBvid,
  formatMinuteTime,
} from "./api/url-parser";
import { formatTranscript } from "./formatters/transcript-formatter";

export class BilibiliTranscriptSkill extends OrchestrationSkill<
  BilibiliTranscriptInput,
  BilibiliTranscriptOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "bilibili_transcript",
    name: "B站字幕提取",
    description:
      "从B站视频中提取CC字幕，支持多种输出格式，可保存到书签记录便于后续阅读。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "bilibili-subtitle",
      "video-transcript",
      "multi-format-export",
      "auto-save",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 15000,
    maxExecutionTimeMs: 60000,
    deliverableTypes: ["document"],
    outputFormats: ["markdown", "json", "plain"],
    steps: BILIBILI_TRANSCRIPT_STEPS,
  };

  readonly inputSchema = BilibiliTranscriptInputSchema;
  readonly outputSchema = BilibiliTranscriptOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<BilibiliTranscriptInput> {
    const input: BilibiliTranscriptInput = {
      format: "text",
      saveToBookmark: true,
    };

    // 尝试从消息中提取 URL
    const urlMatch = message.match(
      /https?:\/\/(?:www\.)?(?:bilibili\.com|b23\.tv)\/[^\s]+/,
    );
    if (urlMatch) {
      input.url = urlMatch[0];
    }

    // 解析输出格式
    if (/srt|字幕文件/.test(message)) {
      input.format = "srt";
    } else if (/json|结构化/.test(message)) {
      input.format = "json";
    } else if (/markdown|md/.test(message)) {
      input.format = "markdown";
    }

    // 解析语言偏好
    if (/英文|英语|english/i.test(message)) {
      input.preferredLang = "en";
    } else if (/中文|chinese/i.test(message)) {
      input.preferredLang = "zh-CN";
    }

    // 检查是否需要保存
    if (/不保存|不要保存/.test(message)) {
      input.saveToBookmark = false;
    }

    return input;
  }

  /**
   * 流式执行
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as BilibiliTranscriptInput;

    this.initProgress(BILIBILI_TRANSCRIPT_STEPS);

    try {
      // ========== 步骤 1: 解析链接 ==========
      yield* this.emitText("📺 正在解析B站视频链接...\n\n");
      yield* this.reportProgress("解析链接", 0, "解析URL中");

      if (this.isCancelled(context)) {
        yield* this.emitCancelled("用户取消了操作");
        return;
      }

      // 获取 URL（从输入或书签）
      let url = input.url;
      const bookmarkId = input.bookmarkId;

      if (!url && bookmarkId) {
        // 从书签获取 URL
        const supabase = await createClient();
        const { data: bookmark } = await supabase
          .from("bookmarks")
          .select("url, title")
          .eq("id", bookmarkId)
          .eq("user_id", context.userId)
          .single();

        if (bookmark) {
          url = bookmark.url;
        }
      }

      if (!url) {
        yield* this.emitError(
          "请提供B站视频链接",
          BILIBILI_TRANSCRIPT_ERRORS.INVALID_URL,
        );
        yield* this.emitDone(false, "未提供视频链接");
        return;
      }

      // 解析 URL
      let parsedUrl = parseBilibiliUrl(url);

      // 处理短链
      if (parsedUrl?.isShortLink) {
        yield* this.emitText("🔗 检测到短链，正在解析...\n");
        const realUrl = await resolveShortLink(url);
        if (realUrl) {
          parsedUrl = parseBilibiliUrl(realUrl);
        }
      }

      if (!parsedUrl || !parsedUrl.bvid || !isValidBvid(parsedUrl.bvid)) {
        yield* this.emitError(
          "无效的B站视频链接，请提供正确的视频URL",
          BILIBILI_TRANSCRIPT_ERRORS.INVALID_URL,
        );
        yield* this.emitDone(false, "无效的视频链接");
        return;
      }

      const { bvid, page } = parsedUrl;
      yield* this.reportProgress("解析链接", 100, `视频 ${bvid} P${page}`);
      yield* this.emitText(`✅ 视频ID: **${bvid}**（第${page}P）\n\n`);

      // ========== 步骤 2: 获取视频信息 ==========
      yield* this.reportProgress("获取信息", 0, "获取视频元数据");

      if (this.isCancelled(context)) {
        yield* this.emitCancelled("用户取消了操作");
        return;
      }

      // 添加超时保护（30秒）
      const API_TIMEOUT_MS = 30000;
      const videoResult = await Promise.race([
        bilibiliApi.getVideoTranscript(bvid, page, input.preferredLang),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("B站 API 请求超时，请稍后重试")),
            API_TIMEOUT_MS,
          ),
        ),
      ]);

      yield* this.reportProgress("获取信息", 100, "视频信息获取完成");
      yield* this.emitText(
        `📹 **${videoResult.videoInfo.title}**\n` +
          `👤 UP主: ${videoResult.videoInfo.uploader}\n` +
          `⏱️ 时长: ${formatMinuteTime(videoResult.videoInfo.duration)}\n\n`,
      );

      // ========== 步骤 3: 检查字幕 ==========
      yield* this.reportProgress("获取字幕", 0, "检查字幕可用性");

      if (this.isCancelled(context)) {
        yield* this.emitCancelled("用户取消了操作");
        return;
      }

      if (videoResult.subtitles.length === 0) {
        // 无字幕情况
        yield* this.emitText("⚠️ 该视频**暂无CC字幕**\n\n");
        yield* this.emitText("💡 提示：\n");
        yield* this.emitText("- 并非所有B站视频都有CC字幕\n");
        yield* this.emitText("- UP主需要手动上传或开启AI字幕\n");
        yield* this.emitText("- 部分会员专享视频可能需要登录\n\n");

        // 保存无字幕状态到书签
        if (input.saveToBookmark && bookmarkId) {
          await this.updateBookmarkTranscriptStatus(
            context.userId,
            bookmarkId,
            "not_available",
          );
        }

        const output: BilibiliTranscriptOutput = {
          videoInfo: {
            bvid: videoResult.videoInfo.bvid,
            title: videoResult.videoInfo.title,
            duration: videoResult.videoInfo.duration,
            uploader: videoResult.videoInfo.uploader,
            coverUrl: videoResult.videoInfo.coverUrl,
          },
          transcriptStatus: "not_available",
          savedToBookmark: false,
          stats: {
            segmentCount: 0,
            totalDuration: 0,
            fetchTimeMs: Date.now() - startTime,
          },
          generatedAt: new Date().toISOString(),
        };

        const deliverable = this.createDeliverable(
          "document",
          "B站视频信息",
          output,
          "json",
          { downloadable: false },
        );
        yield* this.emitDeliverable(deliverable);
        yield* this.emitDone(true, "视频无CC字幕");
        return;
      }

      yield* this.reportProgress(
        "获取字幕",
        100,
        `找到 ${videoResult.subtitles.length} 种字幕`,
      );
      yield* this.emitText(
        `🎯 可用字幕: ${videoResult.subtitles.map((s) => s.languageLabel).join("、")}\n\n`,
      );

      // ========== 步骤 4: 下载字幕 ==========
      yield* this.reportProgress("下载字幕", 0, "下载字幕内容");

      if (this.isCancelled(context)) {
        yield* this.emitCancelled("用户取消了操作");
        return;
      }

      if (!videoResult.transcript) {
        yield* this.emitError(
          "字幕下载失败",
          BILIBILI_TRANSCRIPT_ERRORS.FETCH_FAILED,
        );
        yield* this.emitDone(false, "字幕下载失败");
        return;
      }

      yield* this.reportProgress(
        "下载字幕",
        100,
        `${videoResult.transcript.length} 条字幕段`,
      );

      // ========== 步骤 5: 格式化 ==========
      yield* this.reportProgress("格式化", 0, "格式化字幕内容");

      const formatted = formatTranscript(
        videoResult.transcript,
        input.format,
        videoResult.videoInfo.title,
      );

      yield* this.reportProgress("格式化", 100, "格式化完成");
      yield* this.emitText(
        `📝 字幕统计: **${videoResult.transcript.length}** 条，` +
          `约 **${formatted.wordCount}** 字\n\n`,
      );

      // ========== 步骤 6: 保存 ==========
      let savedToBookmark = false;

      if (input.saveToBookmark && bookmarkId) {
        yield* this.reportProgress("保存", 0, "保存到书签");

        await this.saveTranscriptToBookmark(
          context.userId,
          bookmarkId,
          formatted.fullText,
          formatted.wordCount,
        );

        savedToBookmark = true;
        yield* this.reportProgress("保存", 100, "保存完成");
        yield* this.emitText("✅ 字幕已保存到书签记录\n\n");
      } else {
        yield* this.reportProgress("保存", 100, "跳过保存");
      }

      // 输出预览
      yield* this.emitText("---\n\n");
      yield* this.emitText("## 字幕预览\n\n");

      // 只显示前 500 字符
      const preview = formatted.content.substring(0, 500);
      yield* this.emitText(preview);
      if (formatted.content.length > 500) {
        yield* this.emitText("\n\n*（已省略后续内容）*\n");
      }

      // 构建输出
      const output: BilibiliTranscriptOutput = {
        videoInfo: {
          bvid: videoResult.videoInfo.bvid,
          title: videoResult.videoInfo.title,
          duration: videoResult.videoInfo.duration,
          uploader: videoResult.videoInfo.uploader,
          coverUrl: videoResult.videoInfo.coverUrl,
        },
        transcriptStatus: "available",
        transcript: {
          language: videoResult.selectedLang || "zh-CN",
          languageLabel:
            videoResult.subtitles.find(
              (s) => s.language === videoResult.selectedLang,
            )?.languageLabel || "中文",
          segments: videoResult.transcript,
          fullText: formatted.fullText,
          formattedContent: formatted.content,
          wordCount: formatted.wordCount,
        },
        savedToBookmark,
        stats: {
          segmentCount: videoResult.transcript.length,
          totalDuration: videoResult.videoInfo.duration,
          fetchTimeMs: Date.now() - startTime,
        },
        generatedAt: new Date().toISOString(),
      };

      // 输出交付物
      const deliverable = this.createDeliverable(
        "document",
        `${videoResult.videoInfo.title} - 字幕`,
        output,
        input.format === "markdown" ? "markdown" : "json",
        {
          downloadable: true,
          shareable: true,
          metadata: {
            bvid,
            format: input.format,
            wordCount: formatted.wordCount,
          },
        },
      );

      yield* this.emitDeliverable(deliverable);

      // 后续建议
      yield* this.emitSuggestions([
        {
          text: "生成内容摘要",
          action: "summarize",
          params: { bookmarkId },
        },
        {
          text: "提取关键知识点",
          action: "extract",
          params: { bookmarkId },
        },
      ]);

      yield* this.emitDone(
        true,
        `成功提取 ${videoResult.transcript.length} 条字幕`,
      );

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          bvid,
          segmentCount: videoResult.transcript.length,
          wordCount: formatted.wordCount,
          durationMs: Date.now() - startTime,
        },
        "BilibiliTranscriptSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "BilibiliTranscriptSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "字幕提取失败",
        BILIBILI_TRANSCRIPT_ERRORS.FETCH_FAILED,
        true,
      );
      yield* this.emitDone(false, "字幕提取失败");
    }
  }

  /**
   * 保存字幕到书签
   */
  private async saveTranscriptToBookmark(
    userId: string,
    bookmarkId: number,
    transcriptText: string,
    wordCount: number,
  ): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from("bookmarks")
      .update({
        video_transcript: transcriptText,
        video_transcript_word_count: wordCount,
        video_transcript_status: "available",
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookmarkId)
      .eq("user_id", userId);
  }

  /**
   * 更新书签字幕状态
   */
  private async updateBookmarkTranscriptStatus(
    userId: string,
    bookmarkId: number,
    status: "available" | "not_available" | "fetch_failed",
  ): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from("bookmarks")
      .update({
        video_transcript_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookmarkId)
      .eq("user_id", userId);
  }

  /**
   * 非流式执行
   */
  protected async executeInternal(
    input: BilibiliTranscriptInput,
    context: SkillContext,
  ): Promise<BilibiliTranscriptOutput> {
    const orchestrationContext: OrchestrationContext = {
      ...context,
      params: input,
    };

    let output: BilibiliTranscriptOutput | undefined;

    for await (const chunk of this.executeStream(orchestrationContext)) {
      if (chunk.type === "deliverable") {
        output = chunk.data.content as BilibiliTranscriptOutput;
      }
    }

    if (!output) {
      throw new Error("字幕提取失败");
    }

    return output;
  }
}

// 导出单例
export const bilibiliTranscriptSkill = new BilibiliTranscriptSkill();
