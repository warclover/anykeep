/**
 * UpdateMdCollection Tool - 更新 MD 收藏元信息
 *
 * 更新 MD 收藏的标题、标签等元数据
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  collectionId: z.number().int().positive().describe("MD 收藏 ID"),
  title: z.string().min(1).max(200).optional().describe("新标题"),
  userTags: z
    .array(z.string().min(1).max(50))
    .max(20)
    .optional()
    .describe("用户标签列表（完全替换）"),
  folderId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("移动到的文件夹 ID"),
  contentType: z
    .enum(["article", "note", "reference", "other"])
    .optional()
    .describe("内容类型"),
});

type UpdateMdCollectionParams = z.infer<typeof paramsSchema>;

interface UpdateMdCollectionResult {
  collectionId: number;
  title: string;
  updated: string[];
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const updateMdCollectionTool: Tool<
  UpdateMdCollectionParams,
  UpdateMdCollectionResult
> = {
  definition: {
    name: "update_md_collection",
    description: `更新 MD 收藏的元信息。

使用场景：
- 用户要求 "修改这篇文章的标题"
- 用户要求 "给这个文档添加标签"
- 用户要求 "把这篇移动到某个文件夹"
- 用户要求 "更改内容类型为笔记"

可更新字段：
- title: 标题
- userTags: 用户标签（会完全替换）
- folderId: 所属文件夹
- contentType: 内容类型（article/note/reference/other）`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 200,
  },

  async execute(
    params: UpdateMdCollectionParams,
    context,
  ): Promise<ToolResult<UpdateMdCollectionResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 验证收藏存在
      const { data: collection, error: fetchError } = await supabase
        .from("md_collections")
        .select("id, title")
        .eq("id", params.collectionId)
        .eq("user_id", context.userId)
        .single();

      if (fetchError || !collection) {
        return {
          success: false,
          error: "MD 收藏不存在或无权访问",
          errorCode: "NOT_FOUND",
        };
      }

      // 2. 检查是否有更新内容
      const hasUpdates =
        params.title !== undefined ||
        params.userTags !== undefined ||
        params.folderId !== undefined ||
        params.contentType !== undefined;

      if (!hasUpdates) {
        return {
          success: false,
          error: "请至少指定一个要更新的字段",
          errorCode: "INVALID_PARAMS",
        };
      }

      // 3. 如果移动文件夹，验证目标文件夹存在
      if (params.folderId !== undefined) {
        const { data: folder, error: folderError } = await supabase
          .from("folders")
          .select("id")
          .eq("id", params.folderId)
          .eq("user_id", context.userId)
          .single();

        if (folderError || !folder) {
          return {
            success: false,
            error: "目标文件夹不存在或无权访问",
            errorCode: "FOLDER_NOT_FOUND",
          };
        }
      }

      // 4. 构建更新对象
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      const updated: string[] = [];

      if (params.title !== undefined) {
        updateData.title = params.title;
        updated.push("title");
      }

      if (params.userTags !== undefined) {
        updateData.user_tags = params.userTags;
        updated.push("userTags");
      }

      if (params.folderId !== undefined) {
        updateData.folder_id = params.folderId;
        updated.push("folderId");
      }

      if (params.contentType !== undefined) {
        updateData.content_type = params.contentType;
        updated.push("contentType");
      }

      // 5. 执行更新
      const { error: updateError } = await supabase
        .from("md_collections")
        .update(updateData)
        .eq("id", params.collectionId)
        .eq("user_id", context.userId);

      if (updateError) {
        throw updateError;
      }

      const newTitle = params.title || collection.title || "未命名文档";

      logger.info(
        {
          toolName: "update_md_collection",
          userId: context.userId,
          collectionId: params.collectionId,
          updated,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "update_md_collection: Success",
      );

      return {
        success: true,
        data: {
          collectionId: collection.id,
          title: newTitle,
          updated,
          message: `已更新 ${updated.join("、")}`,
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
          toolName: "update_md_collection",
          userId: context.userId,
          collectionId: params.collectionId,
          error: errorMessage,
        },
        "update_md_collection: Failed",
      );

      return {
        success: false,
        error: `更新 MD 收藏失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
