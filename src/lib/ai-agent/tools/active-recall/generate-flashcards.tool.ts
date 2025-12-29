/**
 * generate_flashcards Tool
 *
 * 为指定书签生成 Flashcards（问答卡片）
 * 使用 LLM 分析书签内容，提取关键知识点
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import type {
  GenerateFlashcardsParams,
  GenerateFlashcardsResult,
} from "./types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  generateFlashcards as generateFlashcardsFromContent,
  filterValidFlashcards,
} from "@/lib/ai-skills/shared/review";

// ============================================
// 参数定义
// ============================================

const paramsSchema = z.object({
  bookmark_id: z
    .number()
    .int()
    .positive()
    .describe("要生成 Flashcards 的书签 ID"),
  count: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(3)
    .describe("生成的 Flashcard 数量（1-10，默认 3）"),
  difficulty: z
    .enum(["easy", "medium", "hard"])
    .optional()
    .default("medium")
    .describe(
      "难度级别：easy（基础概念）、medium（理解分析）、hard（综合应用）",
    ),
});

// ============================================
// Tool 描述
// ============================================

const TOOL_DESCRIPTION = `为书签内容生成复习问答卡片（Flashcards），用于间隔重复学习。

【使用场景】
• "为这个书签生成复习卡片"
• "帮我把这篇文章转成记忆卡"
• "生成5个关于这个收藏的问题"
• "为这个书签创建复习材料"

【参数说明】
• bookmark_id: 目标书签 ID（必填）
• count: 生成数量 1-10（默认 3）
• difficulty: 难度 easy/medium/hard（默认 medium）

【注意事项】
• 书签必须有内容（content 字段）才能生成
• 生成的卡片会自动保存，可通过 get_review_queue 查看
• 同一书签可多次生成，不会重复`;

// ============================================
// Tool 实现
// ============================================

export const generateFlashcardsTool: Tool<
  GenerateFlashcardsParams,
  GenerateFlashcardsResult
> = {
  definition: {
    name: "generate_flashcards",
    description: TOOL_DESCRIPTION,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 5000,
  },

  async execute(
    params: GenerateFlashcardsParams,
    context: ToolContext,
  ): Promise<ToolResult<GenerateFlashcardsResult>> {
    const startTime = performance.now();
    const { bookmark_id, count = 3, difficulty = "medium" } = params;

    try {
      const supabase = await createClient();

      // 1. 获取书签信息（使用实际列名：ai_summary, description）
      const { data: bookmark, error: bookmarkError } = await supabase
        .from("bookmarks")
        .select("id, title, ai_summary, description, user_id")
        .eq("id", bookmark_id)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (bookmarkError || !bookmark) {
        return {
          success: false,
          error: `书签不存在或无权访问: ${bookmark_id}`,
          errorCode: "NOT_FOUND",
        };
      }

      // 2. 检查内容是否存在（使用 description 作为内容）
      const content = bookmark.description || "";
      if (content.trim().length < 50) {
        return {
          success: false,
          error: "书签内容不足，无法生成 Flashcards（至少需要 50 字）",
          errorCode: "INSUFFICIENT_CONTENT",
        };
      }

      // 3. 调用 LLM 生成 Flashcards
      const generateResult = await generateFlashcardsFromContent({
        title: bookmark.title || "未命名书签",
        summary: bookmark.ai_summary || "",
        content,
        count,
        difficulty,
      });

      if (!generateResult.success || generateResult.flashcards.length === 0) {
        return {
          success: false,
          error: generateResult.error || "Flashcard 生成失败",
          errorCode: "GENERATION_FAILED",
        };
      }

      // 4. 过滤有效的 Flashcards
      const validFlashcards = filterValidFlashcards(generateResult.flashcards);

      if (validFlashcards.length === 0) {
        return {
          success: false,
          error: "生成的 Flashcards 未通过质量验证",
          errorCode: "QUALITY_CHECK_FAILED",
        };
      }

      // 5. 批量插入到数据库
      const { error: insertError } = await supabase.rpc(
        "batch_create_flashcards",
        {
          p_user_id: context.userId,
          p_bookmark_id: bookmark_id,
          p_flashcards: validFlashcards.map((fc) => ({
            question: fc.question,
            answer: fc.answer,
            source_paragraph: fc.sourceParagraph || null,
            difficulty,
          })),
        },
      );

      if (insertError) {
        logger.error(
          {
            toolName: "generate_flashcards",
            userId: context.userId,
            bookmarkId: bookmark_id,
            error: insertError.message,
          },
          "generate_flashcards: DB insert failed",
        );

        return {
          success: false,
          error: `保存 Flashcards 失败: ${insertError.message}`,
          errorCode: "DB_ERROR",
        };
      }

      // 查询新创建的 flashcards
      const { data: createdFlashcards } = await supabase
        .from("flashcards")
        .select("id, question, answer, source_paragraph")
        .eq("user_id", context.userId)
        .eq("bookmark_id", bookmark_id)
        .order("created_at", { ascending: false })
        .limit(validFlashcards.length);

      const flashcardsResult = createdFlashcards || [];

      logger.info(
        {
          toolName: "generate_flashcards",
          userId: context.userId,
          bookmarkId: bookmark_id,
          requestedCount: count,
          generatedCount: validFlashcards.length,
          savedCount: flashcardsResult.length,
          difficulty,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "generate_flashcards: Success",
      );

      return {
        success: true,
        data: {
          success: true,
          bookmarkId: bookmark_id,
          bookmarkTitle: bookmark.title || "未命名书签",
          flashcards: flashcardsResult.map((fc) => ({
            id: fc.id,
            question: fc.question,
            answer: fc.answer,
            sourceParagraph: fc.source_paragraph ?? undefined,
            difficulty, // 使用请求参数的 difficulty
          })),
          message: `已为「${bookmark.title}」生成 ${flashcardsResult.length} 张复习卡片`,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: flashcardsResult.length,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "generate_flashcards",
          userId: context.userId,
          bookmarkId: bookmark_id,
          error: errorMessage,
        },
        "generate_flashcards: Failed",
      );

      return {
        success: false,
        error: `生成 Flashcards 失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
