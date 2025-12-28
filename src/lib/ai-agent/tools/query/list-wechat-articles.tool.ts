/**
 * ListWechatArticles Tool - 列出微信公众号文章
 *
 * 查询用户收藏的微信公众号文章，支持按公众号分组、时间筛选、统计分析
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数定义
// ============================================

const paramsSchema = z.object({
  /** AI 选择此工具的理由 (规范要求) */
  reasoning: z
    .string()
    .optional()
    .describe("选择此工具的理由（内部使用，不展示给用户）"),

  /** 按公众号名称筛选 (可选，模糊匹配) */
  accountName: z.string().optional().describe("按公众号名称筛选，支持模糊匹配"),

  /** 时间范围 - 开始日期 (可选) */
  dateStart: z.string().optional().describe("开始日期，ISO 格式如 2025-01-01"),

  /** 时间范围 - 结束日期 (可选) */
  dateEnd: z.string().optional().describe("结束日期，ISO 格式如 2025-12-31"),

  /** 是否分组 (默认 true) */
  groupByAccount: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否按公众号分组显示，默认 true"),

  /** 返回数量限制 (默认 50) */
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(50)
    .describe("返回数量限制，默认 50"),

  /** 排序方式 (默认 newest) */
  orderBy: z
    .enum(["newest", "oldest"])
    .optional()
    .default("newest")
    .describe("排序方式，newest 最新优先，oldest 最旧优先"),

  /** 仅统计模式 (只返回统计数据) */
  statsOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe("仅返回统计数据，不返回文章列表"),
});

type ListWechatArticlesParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型定义
// ============================================

interface ArticleSummary {
  bookmarkId: number;
  title: string;
  url: string;
  wordCount?: number;
  createdAt: string;
  hasFullContent: boolean;
  excerpt?: string;
  tags: string[];
}

interface AccountGroup {
  accountName: string;
  accountId?: string;
  articleCount: number;
  articles: ArticleSummary[];
}

interface ListWechatArticlesResult {
  stats: {
    totalArticles: number;
    totalAccounts: number;
    totalWordCount: number;
    dateRange: { earliest: string; latest: string };
  };
  groups?: AccountGroup[];
  articles?: ArticleSummary[];
  message: string;
}

// ============================================
// 辅助函数
// ============================================

interface ArticleWithAccount extends ArticleSummary {
  accountName: string;
  accountId?: string;
}

/**
 * 数据库查询返回的书签行类型
 */
interface WechatBookmarkRow {
  id: number;
  title: string;
  url: string;
  created_at: string;
  user_tags: string[] | null;
  bookmark_snapshots: Array<{
    id: string;
    readable_text_content: string | null;
    readable_word_count: number | null;
    readable_excerpt: string | null;
    readable_byline: string | null;
    images_status: string | null;
  }> | null;
}

/**
 * 从 URL 和 byline 提取公众号信息
 */
function extractAccountInfo(
  url: string,
  byline?: string | null,
): { name: string; id?: string } {
  try {
    const urlObj = new URL(url);
    const biz = urlObj.searchParams.get("__biz");
    let name = "未知公众号";

    if (byline) {
      name = byline.trim();
    }

    return { name, id: biz || undefined };
  } catch {
    // 静默失败：URL 解析失败时返回默认公众号名称
    return { name: "未知公众号" };
  }
}

/**
 * 按公众号分组文章
 */
function groupArticlesByAccount(
  articles: ArticleWithAccount[],
): AccountGroup[] {
  const groupMap = new Map<string, AccountGroup>();

  for (const article of articles) {
    const key = article.accountName;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        accountName: article.accountName,
        accountId: article.accountId,
        articleCount: 0,
        articles: [],
      });
    }

    const group = groupMap.get(key)!;
    // 移除内部字段
    const { accountName: _, accountId: __, ...rest } = article;
    group.articles.push(rest);
    group.articleCount = group.articles.length;
  }

  return Array.from(groupMap.values()).sort(
    (a, b) => b.articleCount - a.articleCount,
  );
}

/**
 * 格式化统计消息
 */
function formatStatsMessage(stats: ListWechatArticlesResult["stats"]): string {
  const wordCountK = Math.round(stats.totalWordCount / 1000);
  return `您共收藏了 ${stats.totalArticles} 篇微信文章，来自 ${stats.totalAccounts} 个公众号，总计约 ${wordCountK}k 字`;
}

/**
 * 格式化分组消息
 */
function formatGroupsMessage(
  groups: AccountGroup[],
  stats: ListWechatArticlesResult["stats"],
): string {
  const topAccounts = groups
    .slice(0, 3)
    .map((g) => `「${g.accountName}」(${g.articleCount}篇)`)
    .join("、");
  return `共 ${stats.totalArticles} 篇微信文章，主要来自 ${topAccounts}`;
}

/**
 * 格式化列表消息
 */
function formatListMessage(
  articles: ArticleSummary[],
  stats: ListWechatArticlesResult["stats"],
): string {
  if (articles.length === 0) {
    return "暂无收藏的微信文章";
  }
  const titles = articles
    .slice(0, 3)
    .map((a) => `「${a.title}」`)
    .join("、");
  return `找到 ${stats.totalArticles} 篇微信文章，包括 ${titles}${articles.length > 3 ? " 等" : ""}`;
}

// ============================================
// Tool 实现
// ============================================

export const listWechatArticlesTool: Tool<
  ListWechatArticlesParams,
  ListWechatArticlesResult
> = {
  definition: {
    name: "list_wechat_articles",
    description: `列出用户收藏的微信公众号文章，支持按公众号分组、时间筛选、统计分析。

使用场景：
- 用户问 "我收藏了哪些微信文章"
- 用户问 "我关注了哪些公众号"
- 用户问 "最近收藏了多少微信文章"
- 用户问 "XX 公众号的文章有哪些"

返回信息：
- 按公众号分组的文章列表
- 统计信息（总数、字数、时间范围）
- 每篇文章的标题、字数、标签

注意：仅查询微信公众号文章，其他平台请使用 list_by_platform`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 1000,
  },

  async execute(
    params: ListWechatArticlesParams,
    context: ToolContext,
  ): Promise<ToolResult<ListWechatArticlesResult>> {
    const startTime = performance.now();
    const {
      accountName,
      dateStart,
      dateEnd,
      groupByAccount = true,
      limit = 50,
      orderBy = "newest",
      statsOnly = false,
      reasoning,
    } = params;

    if (reasoning) {
      logger.debug(
        { reasoning, tool: "list_wechat_articles" },
        "Tool reasoning",
      );
    }

    try {
      const supabase = await createClient();

      // 1. 构建查询
      let query = supabase
        .from("bookmarks")
        .select(
          `
          id,
          title,
          url,
          user_tags,
          created_at,
          bookmark_snapshots (
            id,
            readable_text_content,
            readable_word_count,
            readable_excerpt,
            readable_byline,
            images_status
          )
        `,
          { count: "exact" },
        )
        .eq("user_id", context.userId)
        .eq("platform", "WECHAT_OFFICIAL_ACCOUNT")
        .is("deleted_at", null);

      // 2. 应用时间筛选
      if (dateStart) {
        query = query.gte("created_at", dateStart);
      }
      if (dateEnd) {
        query = query.lte("created_at", dateEnd);
      }

      // 3. 应用排序
      query = query.order("created_at", { ascending: orderBy === "oldest" });

      // 4. 应用限制
      query = query.limit(limit);

      const { data: bookmarks, count: _count, error } = await query;

      if (error) {
        logger.error(
          {
            toolName: "list_wechat_articles",
            userId: context.userId,
            error: error.message,
          },
          "list_wechat_articles: DB Error",
        );

        return {
          success: false,
          error: error.message,
          errorCode: "DB_ERROR",
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 5. 解析公众号信息

      const articlesWithAccount: ArticleWithAccount[] = (bookmarks || []).map(
        (bookmark: WechatBookmarkRow) => {
          const snapshot = bookmark.bookmark_snapshots?.[0];
          const accountInfo = extractAccountInfo(
            bookmark.url,
            snapshot?.readable_byline,
          );

          return {
            bookmarkId: bookmark.id,
            title: bookmark.title,
            url: bookmark.url,
            wordCount: snapshot?.readable_word_count || undefined,
            createdAt: bookmark.created_at,
            hasFullContent: !!snapshot?.readable_text_content,
            excerpt: snapshot?.readable_excerpt?.substring(0, 100) || undefined,
            tags: bookmark.user_tags || [],
            accountName: accountInfo.name,
            accountId: accountInfo.id,
          };
        },
      );

      // 6. 应用公众号筛选
      let filteredArticles = articlesWithAccount;
      if (accountName) {
        const lowerAccountName = accountName.toLowerCase();
        filteredArticles = filteredArticles.filter(
          (a) =>
            a.accountName.toLowerCase().includes(lowerAccountName) ||
            a.title.toLowerCase().includes(lowerAccountName),
        );
      }

      // 7. 计算统计信息
      const stats = {
        totalArticles: filteredArticles.length,
        totalAccounts: new Set(filteredArticles.map((a) => a.accountName)).size,
        totalWordCount: filteredArticles.reduce(
          (sum, a) => sum + (a.wordCount || 0),
          0,
        ),
        dateRange: {
          earliest:
            filteredArticles.length > 0
              ? filteredArticles[filteredArticles.length - 1].createdAt
              : "",
          latest:
            filteredArticles.length > 0 ? filteredArticles[0].createdAt : "",
        },
      };

      // 8. 构建结果
      if (statsOnly) {
        logger.info(
          {
            toolName: "list_wechat_articles",
            userId: context.userId,
            statsOnly: true,
            totalArticles: stats.totalArticles,
            executionTimeMs: Math.round(performance.now() - startTime),
          },
          "list_wechat_articles: Success (stats only)",
        );

        return {
          success: true,
          data: {
            stats,
            message: formatStatsMessage(stats),
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
            affectedCount: stats.totalArticles,
          },
        };
      }

      if (groupByAccount) {
        const groups = groupArticlesByAccount(filteredArticles);

        logger.info(
          {
            toolName: "list_wechat_articles",
            userId: context.userId,
            groupByAccount: true,
            totalArticles: stats.totalArticles,
            totalGroups: groups.length,
            executionTimeMs: Math.round(performance.now() - startTime),
          },
          "list_wechat_articles: Success (grouped)",
        );

        return {
          success: true,
          data: {
            stats,
            groups,
            message: formatGroupsMessage(groups, stats),
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
            affectedCount: stats.totalArticles,
          },
        };
      }

      // 移除内部字段返回文章列表
      const articles: ArticleSummary[] = filteredArticles.map(
        ({ accountName: _, accountId: __, ...rest }) => rest,
      );

      logger.info(
        {
          toolName: "list_wechat_articles",
          userId: context.userId,
          groupByAccount: false,
          totalArticles: stats.totalArticles,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "list_wechat_articles: Success (list)",
      );

      return {
        success: true,
        data: {
          stats,
          articles,
          message: formatListMessage(articles, stats),
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: stats.totalArticles,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "list_wechat_articles",
          userId: context.userId,
          error: errorMessage,
        },
        "list_wechat_articles: Failed",
      );

      return {
        success: false,
        error: `查询微信文章失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    }
  },
};
