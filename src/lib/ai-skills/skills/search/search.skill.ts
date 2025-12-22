/**
 * SearchSkill - 书签搜索技能
 *
 * 功能：
 * - 支持关键词搜索、语义搜索、混合搜索
 * - 支持按平台、文件夹、标签筛选
 * - 返回格式化的搜索结果
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { z } from "zod";
import { BaseSkill } from "../../core/base-skill";
import type { SkillMetadata, SkillContext } from "../../core/types";
import type {
  SearchSkillInput,
  SearchSkillOutput,
  SearchResultBookmark,
  SearchMode,
} from "./types";
import { createClient } from "@/lib/supabase/server";
import { searchBookmarksHybrid } from "@/lib/utils/semantic-search";
import { searchBookmarksFulltext } from "@/lib/utils/fulltext-search";
import { logger } from "@/lib/logger";

/**
 * 输入 Schema
 */
const SearchInputSchema = z.object({
  query: z
    .string()
    .min(1, "搜索关键词不能为空")
    .max(200, "搜索关键词不能超过200字符")
    .describe("搜索关键词，用于在标题、摘要、作者等字段中搜索"),
  mode: z
    .enum(["keyword", "semantic", "hybrid"])
    .optional()
    .default("hybrid")
    .describe(
      "搜索模式：keyword-关键词搜索，semantic-语义搜索，hybrid-混合搜索",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe("返回结果数量，默认10，最大50"),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.5)
    .describe("语义搜索相似度阈值，0-1之间，默认0.5"),
  platform: z
    .string()
    .optional()
    .describe("筛选平台，如 wechat、bilibili、zhihu 等"),
  folderId: z.number().int().positive().optional().describe("筛选文件夹ID"),
  tags: z
    .array(z.string())
    .optional()
    .describe("筛选标签列表，结果需包含任一标签"),
  starredOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否只搜索已标星的书签"),
});

/**
 * 输出 Schema
 */
const SearchOutputSchema = z.object({
  query: z.string(),
  searchMode: z.enum(["keyword", "semantic", "hybrid"]),
  results: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      url: z.string(),
      description: z.string().nullable(),
      coverUrl: z.string().nullable(),
      platform: z.string(),
      aiSummary: z.string().nullable(),
      aiTags: z.array(z.string()).nullable(),
      userTags: z.array(z.string()).nullable(),
      folderId: z.number().nullable(),
      folderName: z.string().nullable(),
      author: z.string().nullable(),
      publishTime: z.string().nullable(),
      createdAt: z.string(),
      similarity: z.number().optional(),
    }),
  ),
  totalCount: z.number(),
  hasMore: z.boolean(),
  suggestions: z.array(z.string()).optional(),
});

/**
 * SearchSkill 实现
 */
export class SearchSkill extends BaseSkill<
  SearchSkillInput,
  SearchSkillOutput
> {
  readonly metadata: SkillMetadata = {
    id: "search",
    name: "搜索书签",
    description:
      "在用户的书签库中搜索内容。支持关键词搜索、语义搜索和混合搜索模式。可以按平台、文件夹、标签等条件筛选结果。",
    category: "utility",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "keyword-search",
      "semantic-search",
      "hybrid-search",
      "filter-by-platform",
      "filter-by-folder",
      "filter-by-tags",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 2000,
    maxExecutionTimeMs: 10000,
  };

  readonly inputSchema = SearchInputSchema;
  readonly outputSchema = SearchOutputSchema;

  /**
   * 执行搜索
   */
  protected async executeInternal(
    input: SearchSkillInput,
    context: SkillContext,
  ): Promise<SearchSkillOutput> {
    const {
      query,
      mode = "hybrid",
      limit = 10,
      threshold = 0.5,
      platform,
      folderId,
      tags,
      starredOnly = false,
    } = input;

    logger.info(
      {
        skillId: this.metadata.id,
        userId: context.userId,
        query: query.substring(0, 50),
        mode,
        limit,
        traceId: context.traceId,
      },
      "SearchSkill: Executing search",
    );

    // 创建 Supabase 客户端
    const supabase = await createClient();

    // 执行搜索
    let results: SearchResultBookmark[] = [];
    let actualSearchMode: SearchMode = mode;

    if (mode === "keyword") {
      // 关键词搜索
      const { data, error } = await searchBookmarksFulltext(
        supabase,
        context.userId,
        query,
        limit * 2, // 多获取一些以便筛选
      );

      if (error) {
        logger.error({ error }, "SearchSkill: Fulltext search failed");
        throw new Error(`搜索失败: ${error}`);
      }

      results = this.transformResults(data || []);
    } else {
      // 语义搜索或混合搜索
      const { data, searchType, error } = await searchBookmarksHybrid(
        supabase,
        context.userId,
        query,
        { threshold, limit: limit * 2 },
      );

      if (error) {
        logger.error(
          { error: error.message },
          "SearchSkill: Hybrid search failed",
        );
        throw new Error(`搜索失败: ${error.message}`);
      }

      results = this.transformResults(data || []);
      actualSearchMode = searchType;
    }

    // 应用额外筛选条件
    results = this.applyFilters(results, {
      platform,
      folderId,
      tags,
      starredOnly,
    });

    // 截取指定数量
    const hasMore = results.length > limit;
    results = results.slice(0, limit);

    // 生成搜索建议（当结果为空时）
    const suggestions =
      results.length === 0 ? this.generateSuggestions(query, mode) : undefined;

    logger.info(
      {
        skillId: this.metadata.id,
        userId: context.userId,
        resultCount: results.length,
        actualSearchMode,
        traceId: context.traceId,
      },
      "SearchSkill: Search completed",
    );

    return {
      query,
      searchMode: actualSearchMode,
      results,
      totalCount: results.length,
      hasMore,
      suggestions,
    };
  }

  /**
   * 转换数据库结果为输出格式
   */
  private transformResults(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[],
  ): SearchResultBookmark[] {
    return data.map((item) => ({
      id: item.id,
      title: item.title || "",
      url: item.url || "",
      description: item.description || null,
      coverUrl: item.cover_url || null,
      platform: item.platform || "unknown",
      aiSummary: item.ai_summary || null,
      aiTags: item.ai_tags || null,
      userTags: item.user_tags || null,
      folderId: item.folder_id || null,
      folderName: item.folders?.name || null,
      author: item.author || null,
      publishTime: item.publish_time || null,
      createdAt: item.created_at,
      similarity: item.similarity,
    }));
  }

  /**
   * 应用筛选条件
   */
  private applyFilters(
    results: SearchResultBookmark[],
    filters: {
      platform?: string;
      folderId?: number;
      tags?: string[];
      starredOnly?: boolean;
    },
  ): SearchResultBookmark[] {
    let filtered = results;

    // 平台筛选
    if (filters.platform) {
      const platformLower = filters.platform.toLowerCase();
      filtered = filtered.filter(
        (r) => r.platform.toLowerCase() === platformLower,
      );
    }

    // 文件夹筛选
    if (filters.folderId) {
      filtered = filtered.filter((r) => r.folderId === filters.folderId);
    }

    // 标签筛选（任一匹配）
    if (filters.tags && filters.tags.length > 0) {
      const tagsLower = filters.tags.map((t) => t.toLowerCase());
      filtered = filtered.filter((r) => {
        const allTags = [...(r.aiTags || []), ...(r.userTags || [])];
        return allTags.some((t) => tagsLower.includes(t.toLowerCase()));
      });
    }

    return filtered;
  }

  /**
   * 生成搜索建议
   */
  private generateSuggestions(query: string, mode: SearchMode): string[] {
    const suggestions: string[] = [];

    if (query.length < 3) {
      suggestions.push("尝试使用更长的关键词");
    }

    if (mode === "keyword") {
      suggestions.push("尝试使用混合搜索模式以获得更多结果");
    }

    suggestions.push("尝试使用不同的关键词或同义词");
    suggestions.push("检查是否有拼写错误");

    return suggestions;
  }
}

/**
 * 导出单例实例
 */
export const searchSkill = new SearchSkill();
