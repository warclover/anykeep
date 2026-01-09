/**
 * CreateMdCollection Tool - 创建 MD 收藏
 *
 * 将 Markdown 内容保存为 MD 收藏，支持笔记、文章、参考资料等类型。
 *
 * @version 1.0.0
 * @since 2025-01-09
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  computeContentHash,
  preprocessMarkdownForAI,
  sanitizeMarkdownContent,
} from "@/features/md-collections/lib";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  title: z
    .string()
    .min(1, "标题不能为空")
    .max(200, "标题最长 200 字符")
    .describe("MD 收藏标题"),
  content: z
    .string()
    .min(1, "内容不能为空")
    .max(100000, "内容最长 100000 字符")
    .describe("Markdown 格式的内容"),
  contentType: z
    .enum(["article", "note", "reference", "other"])
    .optional()
    .default("note")
    .describe(
      "内容类型：article(文章)、note(笔记)、reference(参考资料)、other(其他)，默认为 note",
    ),
  userTags: z
    .array(z.string().min(1).max(50))
    .max(20)
    .optional()
    .describe("用户标签列表，最多 20 个标签"),
  folderId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("目标文件夹 ID，不传则保存到根目录"),
});

type CreateMdCollectionParams = z.infer<typeof paramsSchema>;

interface CreateMdCollectionResult {
  collectionId: number;
  title: string;
  contentType: string;
  folderId: number | null;
  folderName: string | null;
  wordCount: number;
  message: string;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 获取内容类型的中文名称
 */
function getContentTypeLabel(contentType: string): string {
  const labels: Record<string, string> = {
    article: "文章",
    note: "笔记",
    reference: "参考资料",
    other: "其他",
  };
  return labels[contentType] || "笔记";
}

// ============================================
// Tool 实现
// ============================================

export const createMdCollectionTool: Tool<
  CreateMdCollectionParams,
  CreateMdCollectionResult
> = {
  definition: {
    name: "create_md_collection",
    description: `创建新的 MD 收藏，将 Markdown 内容保存到用户的收藏库中。

使用场景：
- 用户要求 "保存这个总结到收藏"
- 用户要求 "存一个笔记"
- 用户要求 "把这个内容保存为 MD"
- 用户要求 "创建一个新的文档/笔记/参考资料"
- AI 生成内容后用户要求保存

支持的内容类型：
- article: 文章（较长的、结构化的内容）
- note: 笔记（默认，简短的记录）
- reference: 参考资料（待查阅的资料）
- other: 其他类型

注意：
- 标题和内容为必填项
- 内容应为 Markdown 格式
- 可选择保存到指定文件夹
- 可添加标签便于后续查找`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 300,
  },

  async execute(
    params: CreateMdCollectionParams,
    context,
  ): Promise<ToolResult<CreateMdCollectionResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 如果指定了文件夹，验证文件夹存在
      let folderName: string | null = null;
      if (params.folderId) {
        const { data: folder, error: folderError } = await supabase
          .from("folders")
          .select("id, name")
          .eq("id", params.folderId)
          .eq("user_id", context.userId)
          .is("deleted_at", null)
          .single();

        if (folderError || !folder) {
          return {
            success: false,
            error: "指定的文件夹不存在或无权访问",
            errorCode: "FOLDER_NOT_FOUND",
          };
        }
        folderName = folder.name;
      }

      // 2. 清理内容并计算元数据
      const sanitizedContent = sanitizeMarkdownContent(params.content);
      const contentHash = computeContentHash(sanitizedContent);
      const preprocessResult = preprocessMarkdownForAI(sanitizedContent);
      const wordCount = preprocessResult.metadata.wordCount;

      // 3. 创建 MD 收藏
      const now = new Date().toISOString();
      const contentType = params.contentType || "note";

      // 类型断言：避免 Supabase 生成类型与实际表结构不一致的问题
      type NewCollectionRow = {
        id: number;
        title: string;
        content_type: string;
        folder_id: number | null;
      };

      const { data: collection, error: insertError } =
        (await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("md_collections") as any)
          .insert({
            user_id: context.userId,
            title: params.title,
            raw_content: sanitizedContent,
            content_hash: contentHash,
            content_type: contentType,
            word_count: wordCount,
            code_block_count: preprocessResult.metadata.codeBlockCount,
            reading_time_minutes: preprocessResult.metadata.readingTimeMinutes,
            user_tags: params.userTags || [],
            folder_id: params.folderId || null,
            source_type: "ai_tool",
            processing_status: "pending",
            is_read: false,
            is_starred: false,
            created_at: now,
            updated_at: now,
          })
          .select("id, title, content_type, folder_id")
          .single()) as {
          data: NewCollectionRow | null;
          error: { message: string } | null;
        };

      if (insertError || !collection) {
        throw insertError || new Error("创建 MD 收藏失败");
      }

      const contentTypeLabel = getContentTypeLabel(contentType);
      const message = params.folderId
        ? `已创建${contentTypeLabel}「${collection.title}」并保存到「${folderName}」（${wordCount} 字）`
        : `已创建${contentTypeLabel}「${collection.title}」（${wordCount} 字）`;

      logger.info(
        {
          toolName: "create_md_collection",
          userId: context.userId,
          collectionId: collection.id,
          contentType,
          folderId: params.folderId,
          wordCount,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "create_md_collection: Success",
      );

      return {
        success: true,
        data: {
          collectionId: collection.id,
          title: collection.title,
          contentType: collection.content_type,
          folderId: collection.folder_id,
          folderName,
          wordCount,
          message,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: 1,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "create_md_collection",
          userId: context.userId,
          title: params.title,
          error: errorMessage,
        },
        "create_md_collection: Failed",
      );

      return {
        success: false,
        error: `创建 MD 收藏失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
