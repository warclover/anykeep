/**
 * ListMdCollections Tool - 查询 MD 收藏列表
 *
 * 查询用户的 Markdown 收藏列表，支持分页、筛选和排序
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
  page: z
    .number()
    .int()
    .positive()
    .optional()
    .default(1)
    .describe("页码，从 1 开始"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("每页数量，最大 100"),
  folderId: z.number().int().positive().optional().describe("文件夹 ID 筛选"),
  contentType: z
    .string()
    .optional()
    .describe("内容类型筛选（如 TUTORIAL, CODE_SNIPPET, ANALYSIS 等）"),
  isRead: z.boolean().optional().describe("已读状态筛选"),
  isStarred: z.boolean().optional().describe("星标状态筛选"),
  keyword: z.string().max(100).optional().describe("关键词搜索（标题和摘要）"),
  sort: z
    .enum(["created_desc", "created_asc", "title_asc", "updated_desc"])
    .optional()
    .default("created_desc")
    .describe("排序方式"),
});

type ListMdCollectionsParams = z.infer<typeof paramsSchema>;

interface MdCollectionItem {
  id: number;
  title: string;
  wordCount: number;
  codeBlockCount: number;
  readingTimeMinutes: number;
  contentType: string | null;
  aiSummary: string | null;
  aiTags: string[] | null;
  isRead: boolean;
  isStarred: boolean;
  processingStatus: string;
  createdAt: string;
  updatedAt: string;
}

interface ListMdCollectionsResult {
  items: MdCollectionItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const listMdCollectionsTool: Tool<
  ListMdCollectionsParams,
  ListMdCollectionsResult
> = {
  definition: {
    name: "list_md_collections",
    description: `查询用户的 Markdown 收藏列表。

使用场景：
- 用户要求 "显示我的 MD 收藏"
- 用户要求 "查看教程类的收藏"
- 用户要求 "显示未读的 MD 文档"
- 用户要求 "找到有星标的代码片段"

支持的筛选：
- contentType: 内容类型（TUTORIAL, CODE_SNIPPET, ANALYSIS, SUMMARY, QA, DOCUMENTATION, OTHER）
- isRead: 已读状态
- isStarred: 星标状态
- keyword: 关键词搜索
- folderId: 指定文件夹

支持的排序：
- created_desc: 创建时间倒序（默认）
- created_asc: 创建时间正序
- title_asc: 标题字母序
- updated_desc: 更新时间倒序`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 200,
  },

  async execute(
    params: ListMdCollectionsParams,
    context,
  ): Promise<ToolResult<ListMdCollectionsResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 构建查询
      let query = supabase
        .from("md_collections")
        .select(
          `
          id,
          title,
          word_count,
          code_block_count,
          reading_time_minutes,
          content_type,
          ai_summary,
          ai_tags,
          is_read,
          is_starred,
          processing_status,
          created_at,
          updated_at
        `,
          { count: "exact" },
        )
        .eq("user_id", context.userId)
        .is("deleted_at", null);

      // 2. 应用筛选条件
      if (params.folderId) {
        query = query.eq("folder_id", params.folderId);
      }
      if (params.contentType) {
        query = query.eq("content_type", params.contentType);
      }
      if (params.isRead !== undefined) {
        query = query.eq("is_read", params.isRead);
      }
      if (params.isStarred !== undefined) {
        query = query.eq("is_starred", params.isStarred);
      }
      if (params.keyword) {
        // 使用 ilike 进行模糊匹配
        query = query.or(
          `title.ilike.%${params.keyword}%,ai_summary.ilike.%${params.keyword}%`,
        );
      }

      // 3. 应用排序
      const sortConfig: Record<string, { column: string; ascending: boolean }> =
        {
          created_desc: { column: "created_at", ascending: false },
          created_asc: { column: "created_at", ascending: true },
          title_asc: { column: "title", ascending: true },
          updated_desc: { column: "updated_at", ascending: false },
        };

      const sort = sortConfig[params.sort || "created_desc"];
      query = query.order(sort.column, { ascending: sort.ascending });

      // 4. 应用分页
      const offset = (params.page - 1) * params.limit;
      query = query.range(offset, offset + params.limit - 1);

      // 5. 执行查询
      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / params.limit);

      // 6. 格式化结果
      const items: MdCollectionItem[] = (data || []).map((item) => ({
        id: item.id,
        title: item.title,
        wordCount: item.word_count,
        codeBlockCount: item.code_block_count,
        readingTimeMinutes: item.reading_time_minutes,
        contentType: item.content_type,
        aiSummary: item.ai_summary,
        aiTags: item.ai_tags,
        isRead: item.is_read,
        isStarred: item.is_starred,
        processingStatus: item.processing_status,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));

      // 7. 构建消息
      let message = `共找到 ${total} 条 MD 收藏`;
      if (params.contentType) {
        message += `，类型：${params.contentType}`;
      }
      if (params.keyword) {
        message += `，关键词：${params.keyword}`;
      }
      if (total > 0) {
        message += `，当前显示第 ${params.page} 页（共 ${totalPages} 页）`;
      }

      logger.info(
        {
          toolName: "list_md_collections",
          userId: context.userId,
          total,
          page: params.page,
          limit: params.limit,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "list_md_collections: Success",
      );

      return {
        success: true,
        data: {
          items,
          pagination: {
            page: params.page,
            limit: params.limit,
            total,
            totalPages,
          },
          message,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "list_md_collections",
          userId: context.userId,
          error: errorMessage,
        },
        "list_md_collections: Failed",
      );

      return {
        success: false,
        error: `查询 MD 收藏列表失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
