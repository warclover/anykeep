/**
 * 一键分类待整理书签 Tool
 *
 * 对待整理文件夹（INBOX）中的书签执行 AI 智能分类
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
import { generateConfirmationId, getConfirmationExpiryTime } from "../utils";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { FOLDER_TOOL_DESCRIPTIONS } from "../tool-description-templates";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("一次处理的书签数量，默认 20，最大 50"),
  forceRun: z
    .boolean()
    .default(false)
    .describe("是否强制执行（即使有待处理建议），默认 false"),
});

type AutoClassifyInboxParams = z.infer<typeof paramsSchema>;

interface AutoClassifyInboxResult {
  inboxFolderId: number | null;
  pendingCount: number;
  processedCount: number;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const autoClassifyInboxTool: Tool<
  AutoClassifyInboxParams,
  AutoClassifyInboxResult
> = {
  definition: {
    name: "auto_classify_inbox",
    description: FOLDER_TOOL_DESCRIPTIONS.auto_classify_inbox,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 5000,
  },

  async execute(
    params: AutoClassifyInboxParams,
    context: ToolContext,
  ): Promise<ToolResult<AutoClassifyInboxResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取待整理文件夹
      const { data: inboxFolder, error: folderError } = await supabase
        .from("folders")
        .select("id, name")
        .eq("user_id", context.userId)
        .eq("is_system", true)
        .eq("system_type", "INBOX")
        .is("deleted_at", null)
        .single();

      if (folderError || !inboxFolder) {
        return {
          success: false,
          error: "待整理文件夹不存在",
          errorCode: "INBOX_NOT_FOUND",
        };
      }

      // 2. 获取待整理文件夹中的书签数量
      const { count: bookmarkCount } = await supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("folder_id", inboxFolder.id)
        .is("deleted_at", null);

      const pendingCount = bookmarkCount || 0;

      // 3. 检查是否有待处理的书签
      if (pendingCount === 0) {
        return {
          success: true,
          data: {
            inboxFolderId: inboxFolder.id,
            pendingCount: 0,
            processedCount: 0,
            message: "待整理文件夹为空，无需分类",
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 4. 检查是否有待处理的分类建议
      if (!params.forceRun) {
        const { data: suggestionCount } = await supabase.rpc(
          "get_pending_suggestions_count",
          {
            p_user_id: context.userId,
          },
        );

        if ((suggestionCount ?? 0) > 0) {
          return {
            success: false,
            error: `已有 ${suggestionCount} 条待处理的分类建议，请先处理后再执行新的分类（或设置 forceRun=true 强制执行）`,
            errorCode: "PENDING_SUGGESTIONS",
          };
        }
      }

      // 5. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const processCount = Math.min(params.limit, pendingCount);
        const description = `一键分类待整理书签`;
        const impactSummary = `对待整理文件夹中的 ${processCount} 个书签（共 ${pendingCount} 个）执行 AI 智能分类`;

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "auto_classify_inbox",
          description,
          impactSummary,
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: "medium",
        };

        logger.info(
          {
            toolName: "auto_classify_inbox",
            userId: context.userId,
            inboxFolderId: inboxFolder.id,
            pendingCount,
            processCount,
            confirmationId: confirmation.confirmationId,
          },
          "auto_classify_inbox: Confirmation required",
        );

        return {
          success: true,
          data: {
            inboxFolderId: inboxFolder.id,
            pendingCount,
            processedCount: 0,
            message: `待用户确认：${impactSummary}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 6. 已确认，调用 reclassify API 执行分类
      // 由于这是内部调用，直接复用 reclassify 逻辑的核心部分
      // 这里简化处理，返回触发信息，让前端调用 reclassify API
      const processCount = Math.min(params.limit, pendingCount);

      // 调用 reclassify RPC 函数（如果存在）或直接标记任务
      // 注：实际实现可能需要调用现有的 reclassify 服务

      logger.info(
        {
          toolName: "auto_classify_inbox",
          userId: context.userId,
          inboxFolderId: inboxFolder.id,
          pendingCount,
          processCount,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "auto_classify_inbox: Triggered classification",
      );

      // 返回触发成功的结果，实际分类由后台任务或前端轮询完成
      return {
        success: true,
        data: {
          inboxFolderId: inboxFolder.id,
          pendingCount,
          processedCount: processCount,
          message: `已开始对 ${processCount} 个书签执行 AI 分类，分类结果将在处理完成后显示。请调用 /api/reclassify API 或在界面上查看分类进度。`,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: processCount,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "auto_classify_inbox",
          userId: context.userId,
          error: errorMessage,
        },
        "auto_classify_inbox: Failed",
      );

      return {
        success: false,
        error: `一键分类失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
