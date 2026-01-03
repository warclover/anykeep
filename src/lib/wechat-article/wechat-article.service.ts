/**
 * 微信文章服务
 *
 * @module wechat-article
 * @description 微信公众号文章完整内容抓取与管理
 *
 * 设计原则：
 * - 复用现有快照表 (bookmark_snapshots)
 * - 复用现有微信解析工具 (wechat-parser.ts)
 * - 新增图片持久化和 Markdown 转换能力
 *
 * V4.2.6: 使用统一类型定义 (WechatArticleSnapshot)
 */

import {
  createServerSupabaseClient,
  createServiceClient,
} from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/supabase";
import type {
  WechatArticleContent,
  WechatArticleCrawlProgress,
  RefetchOptions,
  RefetchResult,
  WechatArticleImage,
  CrawlOptions,
} from "./wechat-article.types";
import { toWechatArticleSnapshot } from "./utils/type-helpers";
import {
  processWechatContent,
  replaceImageUrls,
  extractTextContent,
} from "./processors/content.processor";
import {
  persistImages,
  calculateImagesStats,
  getImagesStatus,
} from "./processors/image.processor";
import { processStylesInline } from "./processors/style.processor";
import {
  ERROR_CODES,
  DEFAULT_STYLE_PRESERVE_LEVEL,
} from "./wechat-article.config";

// =============================================================================
// 服务类
// =============================================================================

/**
 * 微信文章服务
 *
 * 提供：
 * - 完整内容抓取
 * - 图片持久化
 * - 重新获取
 * - 内容查询
 */
export class WechatArticleService {
  /**
   * 抓取微信文章完整内容
   *
   * 样式选项升级：支持 text-only / full-snapshot 两种级别
   *
   * @param snapshotId - 现有快照 ID（必须已有 basic 快照）
   * @param options - 抓取选项（包含 styleLevel）
   * @param onProgress - 进度回调
   * @returns 处理后的文章内容
   */
  async crawlFullContent(
    snapshotId: number,
    options: CrawlOptions = {},
    onProgress?: (progress: WechatArticleCrawlProgress) => void,
  ): Promise<WechatArticleContent> {
    const { styleLevel = DEFAULT_STYLE_PRESERVE_LEVEL } = options;
    const supabase = await createServiceClient();

    try {
      // 1. 获取现有快照
      onProgress?.({ stage: "fetching", progress: 10 });

      const { data: snapshot, error } = await supabase
        .from("bookmark_snapshots")
        .select(
          `
          id,
          bookmark_id,
          readable_content,
          readable_text_content,
          readable_word_count,
          original_url,
          original_html,
          bookmarks!inner(url, platform)
        `,
        )
        .eq("id", snapshotId)
        .single();

      if (error || !snapshot) {
        throw new Error(ERROR_CODES.SNAPSHOT_NOT_FOUND);
      }

      // 使用类型安全的转换函数
      // Note: 使用 unknown 中间转换是因为 Supabase 类型定义尚未包含新列
      const snapshotData = toWechatArticleSnapshot(
        snapshot as unknown as Record<string, unknown>,
      );

      // 2. 验证是微信平台
      if (snapshotData.bookmarks?.platform !== "WECHAT_OFFICIAL_ACCOUNT") {
        throw new Error(ERROR_CODES.NOT_WECHAT_ARTICLE);
      }

      // 3. 准备内容源
      // 优先使用 original_html（含 <style> 标签），回退到 readable_content
      let sourceHtml = snapshotData.readable_content || "";

      if (snapshotData.original_html) {
        // 使用原始 HTML，并内联 CSS 样式
        sourceHtml = processStylesInline(snapshotData.original_html);
        // Note: Using original_html with CSS inlining
      } else {
        // Note: Fallback to readable_content (no original_html available)
      }

      // 4. 处理正文内容（传入 styleLevel）
      onProgress?.({ stage: "parsing", progress: 30 });

      const content = await processWechatContent(
        sourceHtml,
        snapshotData.original_url || "",
        { styleLevel },
      );

      // 5. 持久化图片
      if (content.images.length > 0) {
        onProgress?.({
          stage: "images",
          progress: 50,
          images: { total: content.images.length, completed: 0 },
        });

        const persistedImages = await persistImages(
          content.images,
          snapshotId,
          (completed) => {
            onProgress?.({
              stage: "images",
              progress:
                50 + Math.round((completed / content.images.length) * 40),
              images: { total: content.images.length, completed },
            });
          },
        );

        content.images = persistedImages;

        // 替换 HTML 中的图片 URL
        content.html = replaceImageUrls(content.html, persistedImages);
      }

      // 5. 更新快照记录（包含 styleLevel 和处理后的 HTML）
      onProgress?.({ stage: "saving", progress: 95 });

      const imagesStats = calculateImagesStats(content.images);
      const imagesStatus = getImagesStatus(content.images);

      const { error: updateError } = await supabase
        .from("bookmark_snapshots")
        .update({
          processed_html: content.html,
          content_markdown: content.markdown,
          article_images: content.images as unknown as Json,
          images_status: imagesStatus,
          images_stats: imagesStats as unknown as Json,
          style_preserve_level: styleLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", snapshotId);

      if (updateError) {
        logger.error(
          { snapshotId, error: updateError.message },
          "WechatArticleService: Failed to update snapshot",
        );
        // 设置警告信息而不是静默失败
        content.saveWarning = `数据库保存失败: ${updateError.message}`;
      }

      onProgress?.({ stage: "completed", progress: 100 });

      return content;
    } catch (error) {
      logger.error(
        {
          snapshotId,
          error: error instanceof Error ? error.message : String(error),
        },
        "WechatArticleService: crawlFullContent failed",
      );

      onProgress?.({
        stage: "failed",
        progress: 0,
        error: error instanceof Error ? error.message : "抓取失败",
      });

      throw error;
    }
  }

  /**
   * 重新获取文章内容
   *
   * @param snapshotId - 快照 ID
   * @param options - 重新获取选项
   * @returns 重新获取结果
   */
  async refetch(
    snapshotId: number,
    options: RefetchOptions = {},
  ): Promise<RefetchResult> {
    const supabase = await createServiceClient();

    // 1. 获取现有快照
    const { data: snapshot, error } = await supabase
      .from("bookmark_snapshots")
      .select(
        `
        id,
        bookmark_id,
        readable_content,
        readable_text_content,
        readable_title,
        readable_word_count,
        content_version,
        original_url,
        bookmarks!inner(url)
      `,
      )
      .eq("id", snapshotId)
      .single();

    if (error || !snapshot) {
      throw new Error(ERROR_CODES.SNAPSHOT_NOT_FOUND);
    }

    // 使用类型安全的转换函数
    // Note: 使用 unknown 中间转换是因为 Supabase 类型定义尚未包含新列
    const snapshotData = toWechatArticleSnapshot(
      snapshot as unknown as Record<string, unknown>,
    );

    // 2. 仅更新图片模式（传递 styleLevel）
    if (options.imagesOnly) {
      const result = await this.crawlFullContent(snapshotId, {
        styleLevel: options.styleLevel,
      });
      const imagesUpdated = result.images.filter(
        (i) => i.status === "success",
      ).length;

      return {
        success: true,
        contentChanged: false,
        newVersion: snapshotData.content_version || 1,
        changes: {
          title: false,
          content: false,
          wordCount: false,
          imagesUpdated,
        },
      };
    }

    // 2.5 重新下载模式：强制重新处理内容（不检查变化）
    if (options.redownloadImages) {
      const newVersion = (snapshotData.content_version || 1) + 1;

      // 更新版本号
      await supabase
        .from("bookmark_snapshots")
        .update({
          content_version: newVersion,
          updated_at: new Date().toISOString(),
        })
        .eq("id", snapshotId);

      // 强制重新处理内容（会生成 processed_html）
      const result = await this.crawlFullContent(snapshotId, {
        styleLevel: options.styleLevel,
      });
      const imagesUpdated = result.images.filter(
        (i) => i.status === "success",
      ).length;

      return {
        success: true,
        contentChanged: true,
        newVersion,
        changes: {
          title: false,
          content: true,
          wordCount: false,
          imagesUpdated,
        },
      };
    }

    // 3. 重新抓取网页内容
    // 注意：这里需要实现实际的网页抓取，目前使用现有内容
    // TODO: 集成 browserless 或其他抓取服务
    const newTextContent = extractTextContent(
      snapshotData.readable_content || "",
    );

    // 4. 对比变化
    const contentChanged =
      newTextContent !== snapshotData.readable_text_content ||
      options.forceUpdate;

    if (!contentChanged) {
      return {
        success: true,
        contentChanged: false,
        newVersion: snapshotData.content_version || 1,
        changes: {
          title: false,
          content: false,
          wordCount: false,
          imagesUpdated: 0,
        },
      };
    }

    // 5. 更新内容版本
    const newVersion = (snapshotData.content_version || 1) + 1;

    const { error: updateError } = await supabase
      .from("bookmark_snapshots")
      .update({
        content_version: newVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", snapshotId);

    if (updateError) {
      throw new Error(ERROR_CODES.REFETCH_FAILED);
    }

    return {
      success: true,
      contentChanged,
      newVersion,
      changes: {
        title: false, // 暂不支持标题对比
        content: contentChanged,
        wordCount: false, // 暂不支持字数对比
        imagesUpdated: 0,
      },
    };
  }

  /**
   * 获取微信文章内容（用于展示）
   *
   * 样式选项升级：返回存储的 styleLevel
   * 内容完整性修复：优先返回 processed_html，其次返回 readable_content
   *
   * @param snapshotId - 快照 ID
   * @returns 文章内容，如果不存在返回 null
   */
  async getArticleContent(
    snapshotId: number,
  ): Promise<WechatArticleContent | null> {
    try {
      const supabase = await createServerSupabaseClient();

      const { data: snapshot, error } = await supabase
        .from("bookmark_snapshots")
        .select(
          `
          id,
          bookmark_id,
          readable_content,
          readable_text_content,
          readable_word_count,
          content_markdown,
          processed_html,
          article_images,
          images_status,
          style_preserve_level,
          original_url,
          original_html
        `,
        )
        .eq("id", snapshotId)
        .single();

      if (error) {
        logger.error(
          { snapshotId, error },
          "[WechatArticleService] Failed to fetch snapshot",
        );
        return null;
      }

      if (!snapshot) {
        logger.warn(
          { snapshotId },
          "[WechatArticleService] Snapshot not found",
        );
        return null;
      }

      // 使用类型安全的转换函数
      // Note: 使用 unknown 中间转换是因为 Supabase 类型定义尚未包含新列
      let snapshotData: ReturnType<typeof toWechatArticleSnapshot>;
      try {
        snapshotData = toWechatArticleSnapshot(
          snapshot as unknown as Record<string, unknown>,
        );
      } catch (conversionError) {
        logger.error(
          { snapshotId, error: conversionError, snapshot },
          "[WechatArticleService] Failed to convert snapshot data",
        );
        // 如果转换失败，尝试直接使用原始数据
        const rawSnapshot = snapshot as Record<string, unknown>;
        return {
          html: (rawSnapshot.readable_content as string) || "",
          text: (rawSnapshot.readable_text_content as string) || "",
          markdown: (rawSnapshot.content_markdown as string) || null,
          images: (Array.isArray(rawSnapshot.article_images)
            ? rawSnapshot.article_images
            : []) as WechatArticleImage[],
          wordCount: (rawSnapshot.readable_word_count as number) || 0,
          styleLevel:
            (rawSnapshot.style_preserve_level as
              | "text-only"
              | "full-snapshot"
              | undefined) || undefined,
        };
      }

      // 优先使用处理后的 HTML，其次使用原始 readable_content
      const htmlContent =
        snapshotData.processed_html || snapshotData.readable_content || "";

      return {
        html: htmlContent,
        text: snapshotData.readable_text_content || "",
        markdown: snapshotData.content_markdown || null,
        images: (snapshotData.article_images as WechatArticleImage[]) || [],
        wordCount: snapshotData.readable_word_count || 0,
        styleLevel:
          (snapshotData.style_preserve_level as
            | "text-only"
            | "full-snapshot"
            | undefined) || undefined,
      };
    } catch (error) {
      logger.error(
        { snapshotId, error },
        "[WechatArticleService] getArticleContent error",
      );
      return null;
    }
  }

  /**
   * 检查快照是否有完整的微信文章内容
   *
   * @param snapshotId - 快照 ID
   * @returns 是否有完整内容
   */
  async hasFullContent(snapshotId: number): Promise<boolean> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("bookmark_snapshots")
      .select("images_status, content_markdown, processed_html")
      .eq("id", snapshotId)
      .single();

    if (error || !data) {
      return false;
    }

    // 使用类型安全的转换函数
    // Note: 使用 unknown 中间转换是因为 Supabase 类型定义尚未包含新列
    const snapshotData = toWechatArticleSnapshot(
      data as unknown as Record<string, unknown>,
    );

    // 有处理后的 HTML、Markdown 内容或图片已处理，认为有完整内容
    return !!(
      snapshotData.processed_html ||
      snapshotData.content_markdown ||
      ["completed", "partial"].includes(snapshotData.images_status || "")
    );
  }

  /**
   * 获取用户的微信文章统计
   *
   * @param userId - 用户 ID
   * @returns 统计信息
   */
  async getUserStats(userId: string): Promise<{
    totalArticles: number;
    totalImages: number;
    successImages: number;
    failedImages: number;
    storageUsed: number;
  }> {
    const supabase = await createServiceClient();

    // RPC 函数类型已在 Database.public.Functions 中定义
    const { data, error } = await supabase.rpc("get_wechat_article_stats", {
      p_user_id: userId,
    });

    if (error || !data || !Array.isArray(data) || data.length === 0) {
      return {
        totalArticles: 0,
        totalImages: 0,
        successImages: 0,
        failedImages: 0,
        storageUsed: 0,
      };
    }

    const stats = data[0];

    return {
      totalArticles: Number(stats.total_articles) || 0,
      totalImages: Number(stats.total_images) || 0,
      successImages: Number(stats.success_images) || 0,
      failedImages: Number(stats.failed_images) || 0,
      storageUsed: Number(stats.storage_used) || 0,
    };
  }
}

// =============================================================================
// 单例导出
// =============================================================================

export const wechatArticleService = new WechatArticleService();
