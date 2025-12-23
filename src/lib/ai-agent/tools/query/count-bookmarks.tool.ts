/**
 * count_bookmarks Tool
 *
 * 统计用户的书签数量
 * 支持按文件夹、平台、时间范围筛选
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";

// ============================================
// 参数定义
// ============================================

const paramsSchema = z.object({
  folder_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("指定文件夹 ID 进行筛选"),
  platform: z
    .string()
    .optional()
    .describe("指定平台进行筛选，如 WECHAT、BROWSER_CHROME 等"),
  date_from: z
    .string()
    .optional()
    .describe("起始日期（ISO 格式），如 2024-01-01"),
  date_to: z
    .string()
    .optional()
    .describe("结束日期（ISO 格式），如 2024-12-31"),
  has_tags: z
    .boolean()
    .optional()
    .describe("是否有标签：true=有标签，false=无标签"),
  include_breakdown: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否包含按平台和文件夹的分组统计"),
});

type CountParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

interface PlatformCount {
  platform: string;
  count: number;
}

interface FolderCount {
  folderId: number;
  folderName: string;
  count: number;
}

interface CountResult {
  /** 总数 */
  total: number;
  /** 按平台分组 */
  byPlatform?: PlatformCount[];
  /** 按文件夹分组（前10个） */
  byFolder?: FolderCount[];
  /** 筛选条件描述 */
  filterDescription: string;
}

// ============================================
// Tool 实现
// ============================================

export const countBookmarksTool: Tool<CountParams, CountResult> = {
  definition: {
    name: "count_bookmarks",
    description:
      "统计用户的书签数量。支持按文件夹、平台、时间范围筛选。用于回答「我有多少收藏」「最近一周收藏了多少」「某个文件夹有多少内容」等问题。",
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },

  async execute(
    params: CountParams,
    context: ToolContext,
  ): Promise<ToolResult<CountResult>> {
    const supabase = await createClient();
    const {
      folder_id,
      platform,
      date_from,
      date_to,
      has_tags,
      include_breakdown,
    } = params;

    // 构建筛选条件描述
    const filters: string[] = [];
    if (folder_id) filters.push(`文件夹ID=${folder_id}`);
    if (platform) filters.push(`平台=${platform}`);
    if (date_from) filters.push(`从${date_from}开始`);
    if (date_to) filters.push(`到${date_to}结束`);
    if (has_tags === true) filters.push("有标签");
    if (has_tags === false) filters.push("无标签");
    const filterDescription =
      filters.length > 0 ? filters.join("，") : "全部书签";

    // 基础查询
    let query = supabase
      .from("bookmarks")
      .select("id, platform, folder_id, user_tags", { count: "exact" })
      .eq("user_id", context.userId)
      .is("deleted_at", null);

    // 应用筛选条件
    if (folder_id) {
      query = query.eq("folder_id", folder_id);
    }
    if (platform) {
      query = query.eq("platform", platform);
    }
    if (date_from) {
      query = query.gte("created_at", date_from);
    }
    if (date_to) {
      query = query.lte("created_at", date_to);
    }
    if (has_tags === true) {
      // 有标签：user_tags 不为 null 且长度 > 0
      query = query.not("user_tags", "is", null).filter("user_tags", "neq", []);
    }
    if (has_tags === false) {
      // 无标签：user_tags 为 null 或空数组
      query = query.or("user_tags.is.null,user_tags.eq.[]");
    }

    const { data, count, error } = await query;

    if (error) {
      return {
        success: false,
        error: error.message,
        errorCode: "DB_ERROR",
      };
    }

    const total = count ?? 0;

    // 如果不需要分组统计，直接返回
    if (!include_breakdown || !data || data.length === 0) {
      return {
        success: true,
        data: {
          total,
          filterDescription,
        },
      };
    }

    // 计算按平台分组
    const platformMap = new Map<string, number>();
    const folderMap = new Map<number, { name: string; count: number }>();

    for (const item of data) {
      // 平台统计
      const p = item.platform || "OTHER";
      platformMap.set(p, (platformMap.get(p) || 0) + 1);

      // 文件夹统计（需要额外查询文件夹名称）
      if (item.folder_id) {
        const existing = folderMap.get(item.folder_id);
        if (existing) {
          existing.count++;
        } else {
          folderMap.set(item.folder_id, { name: "", count: 1 });
        }
      }
    }

    // 获取文件夹名称
    if (folderMap.size > 0) {
      const folderIds = Array.from(folderMap.keys());
      const { data: folders } = await supabase
        .from("folders")
        .select("id, name")
        .in("id", folderIds);

      if (folders) {
        for (const folder of folders) {
          const entry = folderMap.get(folder.id);
          if (entry) {
            entry.name = folder.name;
          }
        }
      }
    }

    // 转换为数组并排序
    const byPlatform: PlatformCount[] = Array.from(platformMap.entries())
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count);

    const byFolder: FolderCount[] = Array.from(folderMap.entries())
      .map(([folderId, { name, count }]) => ({
        folderId,
        folderName: name || `文件夹${folderId}`,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // 只返回前10个

    return {
      success: true,
      data: {
        total,
        byPlatform,
        byFolder,
        filterDescription,
      },
      metadata: {
        executionTimeMs: 0, // 由 registry 填充
        affectedCount: total,
      },
    };
  },
};
