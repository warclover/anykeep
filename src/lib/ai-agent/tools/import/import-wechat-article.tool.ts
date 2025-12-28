/**
 * ImportWechatArticle Tool - 导入微信公众号文章
 *
 * 通过链接导入微信文章，自动抓取完整内容和图片
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { z } from "zod";
import type { Tool, ToolResult, ToolContext } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  isWechatArticleUrl,
  autoFetchWechatArticle,
} from "@/lib/wechat-article";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  /** AI 选择此工具的理由 (规范要求) */
  reasoning: z
    .string()
    .optional()
    .describe("选择此工具的理由（内部使用，不展示给用户）"),

  /** 微信文章链接 (必需) */
  url: z.string().url("请提供有效的 URL").describe("微信公众号文章链接"),

  /** 指定文件夹 ID (可选，默认收件箱) */
  folderId: z.number().int().positive().optional().describe("目标文件夹 ID"),

  /** 自定义标签 (可选) */
  tags: z
    .array(z.string().max(50))
    .max(10)
    .optional()
    .describe("用户标签列表，最多 10 个"),

  /** 是否立即抓取完整内容 (可选，默认 true) */
  crawlImmediately: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否立即抓取完整内容，默认 true"),
});

type ImportWechatArticleParams = z.infer<typeof paramsSchema>;

interface ImportWechatArticleResult {
  /** 创建的书签 */
  bookmark: {
    id: number;
    title: string;
    url: string;
    platform: "WECHAT_OFFICIAL_ACCOUNT";
    createdAt: string;
  };

  /** 公众号信息 (如果能解析) */
  account?: {
    name: string;
    id?: string;
  };

  /** 是否已存在 */
  isExisting: boolean;

  /** 抓取状态 */
  crawlStatus: "pending" | "triggered" | "skipped";

  /** 人类可读的结果消息 */
  message: string;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 解析公众号信息
 */
function parseAccountInfo(
  url: string,
): { name: string; id?: string } | undefined {
  try {
    const urlObj = new URL(url);
    const biz = urlObj.searchParams.get("__biz");

    if (biz) {
      return { name: "微信公众号", id: biz };
    }
    return undefined;
  } catch {
    // 静默失败：URL 解析失败时返回 undefined，调用方使用默认值
    return undefined;
  }
}

/**
 * 格式化成功消息
 */
function formatSuccessMessage(
  title: string,
  isExisting: boolean,
  crawlStatus: string,
  account?: { name: string },
): string {
  if (isExisting) {
    return `该文章已存在于收藏中：「${title}」`;
  }

  const parts = [`已保存微信文章「${title}」`];

  if (account?.name && account.name !== "微信公众号") {
    parts.push(`来自「${account.name}」`);
  }

  if (crawlStatus === "triggered") {
    parts.push("正在后台抓取完整内容");
  }

  return parts.join("，");
}

// ============================================
// Tool 实现
// ============================================

export const importWechatArticleTool: Tool<
  ImportWechatArticleParams,
  ImportWechatArticleResult
> = {
  definition: {
    name: "import_wechat_article",
    description: `导入微信公众号文章。通过链接保存文章，自动抓取完整内容和图片。

使用场景：
- 用户提供微信文章链接想要保存
- 用户说"帮我收藏这篇文章"并附带 mp.weixin.qq.com 链接
- 用户说"保存这个微信链接"

URL 格式示例：
- https://mp.weixin.qq.com/s/xxxxx
- https://mp.weixin.qq.com/s?__biz=xxx&mid=xxx

注意：仅支持微信公众号文章，其他平台请使用 create_bookmark 或 import_bookmarks`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 3000,
  },

  async execute(
    params: ImportWechatArticleParams,
    context: ToolContext,
  ): Promise<ToolResult<ImportWechatArticleResult>> {
    const startTime = performance.now();
    const { url, folderId, tags, crawlImmediately, reasoning } = params;

    // 记录 reasoning (规范要求)
    if (reasoning) {
      logger.debug(
        { reasoning, tool: "import_wechat_article" },
        "Tool reasoning",
      );
    }

    try {
      // 1. 验证是否为微信文章链接
      if (!isWechatArticleUrl(url)) {
        return {
          success: false,
          error:
            "该链接不是微信公众号文章，请使用 create_bookmark 工具保存其他平台内容",
          errorCode: "NOT_WECHAT_URL",
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 2. 解析公众号信息
      const accountInfo = parseAccountInfo(url);

      const supabase = await createClient();

      // 3. 如果指定了文件夹，验证文件夹存在
      let folderName: string | null = null;
      if (folderId) {
        const { data: folder, error: folderError } = await supabase
          .from("folders")
          .select("id, name")
          .eq("id", folderId)
          .eq("user_id", context.userId)
          .is("deleted_at", null)
          .single();

        if (folderError || !folder) {
          return {
            success: false,
            error: "指定的文件夹不存在",
            errorCode: "FOLDER_NOT_FOUND",
            metadata: {
              executionTimeMs: Math.round(performance.now() - startTime),
            },
          };
        }
        folderName = folder.name;
      }

      // 4. 检查是否已存在
      const { data: existing } = await supabase
        .from("bookmarks")
        .select("id, title")
        .eq("user_id", context.userId)
        .eq("url", url)
        .is("deleted_at", null)
        .single();

      if (existing) {
        logger.info(
          {
            toolName: "import_wechat_article",
            userId: context.userId,
            bookmarkId: existing.id,
            isExisting: true,
            executionTimeMs: Math.round(performance.now() - startTime),
          },
          "import_wechat_article: Article already exists",
        );

        return {
          success: true,
          data: {
            bookmark: {
              id: existing.id,
              title: existing.title,
              url,
              platform: "WECHAT_OFFICIAL_ACCOUNT",
              createdAt: "",
            },
            account: accountInfo,
            isExisting: true,
            crawlStatus: "skipped",
            message: formatSuccessMessage(
              existing.title,
              true,
              "skipped",
              accountInfo,
            ),
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
            affectedCount: 0,
          },
        };
      }

      // 5. 创建书签
      const now = new Date().toISOString();
      const tempTitle = "微信文章 (获取中...)";

      const { data: bookmark, error: insertError } = await supabase
        .from("bookmarks")
        .insert({
          user_id: context.userId,
          url,
          title: tempTitle,
          platform: "WECHAT_OFFICIAL_ACCOUNT",
          folder_id: folderId || null,
          user_tags: tags || [],
          is_read: false,
          is_starred: false,
          status: "PENDING",
          created_at: now,
          updated_at: now,
        })
        .select("id, title, url, created_at")
        .single();

      if (insertError || !bookmark) {
        throw insertError || new Error("创建书签失败");
      }

      // 6. 触发自动抓取（如果启用）
      let crawlStatus: "pending" | "triggered" | "skipped" = "pending";
      if (crawlImmediately !== false) {
        try {
          // 异步触发抓取，不阻塞返回
          autoFetchWechatArticle(bookmark.id, context.userId, url);
          crawlStatus = "triggered";
        } catch (crawlError) {
          logger.warn(
            {
              bookmarkId: bookmark.id,
              error:
                crawlError instanceof Error
                  ? crawlError.message
                  : String(crawlError),
            },
            "import_wechat_article: Auto crawl trigger failed (non-blocking)",
          );
          crawlStatus = "pending";
        }
      } else {
        crawlStatus = "skipped";
      }

      const message = folderName
        ? `已保存微信文章并放入「${folderName}」${crawlStatus === "triggered" ? "，正在后台抓取完整内容" : ""}`
        : formatSuccessMessage(tempTitle, false, crawlStatus, accountInfo);

      logger.info(
        {
          toolName: "import_wechat_article",
          userId: context.userId,
          bookmarkId: bookmark.id,
          folderId,
          crawlStatus,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "import_wechat_article: Success",
      );

      return {
        success: true,
        data: {
          bookmark: {
            id: bookmark.id,
            title: bookmark.title,
            url: bookmark.url,
            platform: "WECHAT_OFFICIAL_ACCOUNT",
            createdAt: bookmark.created_at || now,
          },
          account: accountInfo,
          isExisting: false,
          crawlStatus,
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
          toolName: "import_wechat_article",
          userId: context.userId,
          url,
          error: errorMessage,
        },
        "import_wechat_article: Failed",
      );

      return {
        success: false,
        error: `导入微信文章失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    }
  },
};
