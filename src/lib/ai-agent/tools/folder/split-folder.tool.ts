/**
 * 拆分文件夹 Tool
 *
 * 将文件夹中的部分书签拆分到新文件夹
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type {
  Tool,
  ToolContext,
  ToolResult,
  PendingConfirmation,
} from "../types";
import {
  generateConfirmationId,
  getConfirmationExpiryTime,
  getBookmarkTitles,
} from "../utils";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  sourceFolderId: z.number().int().positive().describe("源文件夹 ID"),
  newFolderName: z
    .string()
    .min(1, "新文件夹名称不能为空")
    .max(50, "文件夹名称最长 50 个字符")
    .describe("新文件夹名称"),
  bookmarkIds: z
    .array(z.number().int().positive())
    .min(1, "至少选择一个书签")
    .describe("要移动到新文件夹的书签 ID 列表"),
  newFolderGroup: z
    .enum(["work", "study", "life", "entertainment", "other"])
    .optional()
    .describe("新文件夹分组（可选）"),
});

type SplitFolderParams = z.infer<typeof paramsSchema>;

interface SplitFolderResult {
  sourceFolderId: number;
  sourceFolderName: string;
  newFolderId: number | null;
  newFolderName: string;
  movedBookmarkCount: number;
  remainingBookmarkCount: number;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const splitFolderTool: Tool<SplitFolderParams, SplitFolderResult> = {
  definition: {
    name: "split_folder",
    description: `将文件夹中的部分书签拆分到新文件夹。

使用场景：
- 用户要求 "把'技术'文件夹里的 Vue 相关文章拆分出来，新建一个'Vue'文件夹"
- 用户要求 "这个文件夹太大了，把这些书签分出去"
- AI 建议拆分过大的文件夹

注意事项：
- 需要指定要拆分的书签列表
- 会创建新文件夹并移动指定书签
- 源文件夹保留未选中的书签
- 此操作不可逆（高风险）`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 1000,
  },

  async execute(
    params: SplitFolderParams,
    context: ToolContext,
  ): Promise<ToolResult<SplitFolderResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 验证源文件夹
      const { data: sourceFolder, error: sourceError } = await supabase
        .from("folders")
        .select("id, name, is_system")
        .eq("id", params.sourceFolderId)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (sourceError || !sourceFolder) {
        return {
          success: false,
          error: "源文件夹不存在或无权操作",
          errorCode: "SOURCE_NOT_FOUND",
        };
      }

      if (sourceFolder.is_system) {
        return {
          success: false,
          error: "系统文件夹不能拆分",
          errorCode: "SYSTEM_FOLDER",
        };
      }

      // 2. 验证书签所有权且属于源文件夹
      const { data: validBookmarks, error: bookmarkError } = await supabase
        .from("bookmarks")
        .select("id")
        .in("id", params.bookmarkIds)
        .eq("user_id", context.userId)
        .eq("folder_id", params.sourceFolderId)
        .is("deleted_at", null);

      if (bookmarkError) {
        throw bookmarkError;
      }

      const validBookmarkIds = validBookmarks?.map((b) => b.id) || [];
      if (validBookmarkIds.length !== params.bookmarkIds.length) {
        return {
          success: false,
          error: `部分书签不在源文件夹中（请求 ${params.bookmarkIds.length} 个，有效 ${validBookmarkIds.length} 个）`,
          errorCode: "INVALID_BOOKMARKS",
        };
      }

      // 3. 检查新文件夹名称是否已存在
      const { data: existingFolder } = await supabase
        .from("folders")
        .select("id")
        .eq("user_id", context.userId)
        .eq("name", params.newFolderName)
        .is("deleted_at", null)
        .single();

      if (existingFolder) {
        return {
          success: false,
          error: `已存在同名文件夹「${params.newFolderName}」`,
          errorCode: "DUPLICATE_NAME",
        };
      }

      // 4. 获取源文件夹总书签数
      const { count: totalCount } = await supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("folder_id", params.sourceFolderId)
        .is("deleted_at", null);

      const remainingCount = (totalCount || 0) - params.bookmarkIds.length;

      // 5. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const affectedItems = await getBookmarkTitles(
          context.userId,
          params.bookmarkIds,
        );

        const description = `从「${sourceFolder.name}」拆分创建「${params.newFolderName}」`;
        const impactSummary = `将「${sourceFolder.name}」中的 ${params.bookmarkIds.length} 个书签拆分到新文件夹「${params.newFolderName}」，源文件夹将剩余 ${remainingCount} 个书签`;

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "split_folder",
          description,
          impactSummary,
          affectedItems,
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: "high",
        };

        logger.info(
          {
            toolName: "split_folder",
            userId: context.userId,
            sourceFolderId: sourceFolder.id,
            newFolderName: params.newFolderName,
            bookmarkCount: params.bookmarkIds.length,
            confirmationId: confirmation.confirmationId,
          },
          "split_folder: Confirmation required",
        );

        return {
          success: true,
          data: {
            sourceFolderId: sourceFolder.id,
            sourceFolderName: sourceFolder.name,
            newFolderId: null,
            newFolderName: params.newFolderName,
            movedBookmarkCount: 0,
            remainingBookmarkCount: remainingCount,
            message: `待用户确认：${impactSummary}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 6. 已确认，执行拆分操作
      // 6.1 获取最大排序值
      const { data: maxSort } = await supabase
        .from("folders")
        .select("sort_order")
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();

      const newSortOrder = (maxSort?.sort_order ?? 0) + 1;

      // 6.2 创建新文件夹
      const { data: newFolder, error: createError } = await supabase
        .from("folders")
        .insert({
          user_id: context.userId,
          name: params.newFolderName,
          folder_group: params.newFolderGroup ?? null,
          sort_order: newSortOrder,
          is_archived: false,
        })
        .select("id, name")
        .single();

      if (createError || !newFolder) {
        throw createError || new Error("创建新文件夹失败");
      }

      // 6.3 移动书签到新文件夹
      const { error: moveError } = await supabase
        .from("bookmarks")
        .update({
          folder_id: newFolder.id,
          updated_at: new Date().toISOString(),
        })
        .in("id", params.bookmarkIds)
        .eq("user_id", context.userId)
        .is("deleted_at", null);

      if (moveError) {
        // 回滚：删除已创建的文件夹
        await supabase.from("folders").delete().eq("id", newFolder.id);
        throw moveError;
      }

      const message = `已从「${sourceFolder.name}」拆分 ${params.bookmarkIds.length} 个书签到新文件夹「${newFolder.name}」`;

      logger.info(
        {
          toolName: "split_folder",
          userId: context.userId,
          sourceFolderId: sourceFolder.id,
          newFolderId: newFolder.id,
          newFolderName: newFolder.name,
          movedBookmarkCount: params.bookmarkIds.length,
          remainingBookmarkCount: remainingCount,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "split_folder: Success",
      );

      return {
        success: true,
        data: {
          sourceFolderId: sourceFolder.id,
          sourceFolderName: sourceFolder.name,
          newFolderId: newFolder.id,
          newFolderName: newFolder.name,
          movedBookmarkCount: params.bookmarkIds.length,
          remainingBookmarkCount: remainingCount,
          message,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: params.bookmarkIds.length + 1, // 书签数 + 新文件夹
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "split_folder",
          userId: context.userId,
          error: errorMessage,
        },
        "split_folder: Failed",
      );

      return {
        success: false,
        error: `拆分文件夹失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
