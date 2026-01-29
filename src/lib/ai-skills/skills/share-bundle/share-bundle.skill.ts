/**
 * ShareBundleSkill - 分享包编排 Skill
 *
 * 功能：
 * - 生成书签分享包
 * - 支持多种格式（链接、HTML、Markdown、JSON）
 * - 支持私密/公开/密码保护
 * - 可设置过期时间
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { z } from "zod";
import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { SkillContext } from "../../core/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  ShareBundleInput,
  ShareBundleOutput,
  ShareBookmarkItem,
  ShareBundleStats,
  ShareBundleMetadata,
} from "./types";
import {
  SHARE_FORMAT_CONFIG,
  DEFAULT_SHARE_CONFIG,
  generateShareId,
} from "./types";

// ============================================
// Schema 定义
// ============================================

const ShareBundleInputSchema = z.object({
  format: z.enum(["link", "html", "markdown", "json"]).default("link"),
  scope: z
    .enum(["bookmarks", "folder", "tag", "collection"])
    .default("bookmarks"),
  bookmarkIds: z.array(z.number()).optional(),
  folderId: z.number().optional(),
  tag: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  visibility: z.enum(["public", "private", "password"]).default("private"),
  password: z.string().optional(),
  expirationDays: z.number().min(0).max(365).default(7),
  options: z
    .object({
      includeSummary: z.boolean().default(true),
      includeTags: z.boolean().default(true),
      includeRating: z.boolean().default(false),
      includeNotes: z.boolean().default(false),
      theme: z.enum(["light", "dark", "auto"]).default("auto"),
    })
    .optional(),
});

const ShareBundleOutputSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  format: z.enum(["link", "html", "markdown", "json"]),
  shareUrl: z.string().optional(),
  content: z.string().optional(),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  bookmarks: z.array(z.any()),
  stats: z.any(),
  metadata: z.any(),
  suggestions: z.array(z.string()),
  generatedAt: z.string(),
});

// ============================================
// 步骤定义
// ============================================

const SHARE_STEPS = [
  { id: "collect", name: "收集数据", description: "收集分享书签", weight: 25 },
  { id: "process", name: "处理内容", description: "处理分享内容", weight: 25 },
  {
    id: "generate",
    name: "生成分享包",
    description: "生成分享格式",
    weight: 25,
  },
  { id: "finalize", name: "完成", description: "生成分享链接", weight: 25 },
];

// ============================================
// ShareBundleSkill 实现
// ============================================

export class ShareBundleSkill extends OrchestrationSkill<
  ShareBundleInput,
  ShareBundleOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "share_bundle",
    name: "分享包助手",
    description:
      "将收藏的书签打包分享，支持生成分享链接、HTML 页面、Markdown 文档或 JSON 数据包，可设置访问权限和过期时间。",
    category: "utility",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "share-link",
      "export-html",
      "export-markdown",
      "access-control",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 10000,
    maxExecutionTimeMs: 60000,
    deliverableTypes: ["document", "list"],
    outputFormats: ["html", "markdown", "json"],
    steps: SHARE_STEPS,
  };

  readonly inputSchema = ShareBundleInputSchema;
  readonly outputSchema =
    ShareBundleOutputSchema as z.ZodType<ShareBundleOutput>;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<ShareBundleInput> {
    const input: ShareBundleInput = {
      format: DEFAULT_SHARE_CONFIG.format,
      scope: "bookmarks",
      visibility: DEFAULT_SHARE_CONFIG.visibility,
      expirationDays: DEFAULT_SHARE_CONFIG.expirationDays,
      options: DEFAULT_SHARE_CONFIG.options,
    };

    // 解析格式
    if (/链接|link/.test(message)) {
      input.format = "link";
    } else if (/html|网页|页面/.test(message)) {
      input.format = "html";
    } else if (/markdown|md/.test(message)) {
      input.format = "markdown";
    } else if (/json|数据/.test(message)) {
      input.format = "json";
    }

    // 解析范围
    if (/文件夹|目录/.test(message)) {
      input.scope = "folder";
    } else if (/标签/.test(message)) {
      input.scope = "tag";
    }

    // 解析可见性
    if (/公开|公共/.test(message)) {
      input.visibility = "public";
    } else if (/密码|加密/.test(message)) {
      input.visibility = "password";
    }

    // 解析过期时间
    const dayMatch = message.match(/(\d+)\s*天/);
    if (dayMatch) {
      input.expirationDays = parseInt(dayMatch[1], 10);
    } else if (/永久|不过期/.test(message)) {
      input.expirationDays = 0;
    }

    return input;
  }

  /**
   * 流式执行分享包生成
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as ShareBundleInput;
    const formatConfig = SHARE_FORMAT_CONFIG[input.format];

    // 初始化进度
    this.initProgress(SHARE_STEPS);

    try {
      // Step 1: 收集数据
      yield* this.reportProgress("收集数据", 5, "正在收集书签数据...");
      yield* this.emitText(
        `${formatConfig.icon} 正在生成${formatConfig.name}，请稍候...\n\n`,
      );

      const bookmarks = await this.fetchBookmarks(context.userId, input);

      yield* this.reportProgress(
        "收集数据",
        25,
        `收集到 ${bookmarks.length} 条书签`,
      );

      if (bookmarks.length === 0) {
        yield* this.emitText("没有找到符合条件的书签。\n");
        yield* this.emitDone(true, "没有找到书签");
        return;
      }

      yield* this.emitText(`📚 共收集到 **${bookmarks.length}** 条书签。\n\n`);

      // Step 2: 处理内容
      yield* this.reportProgress("处理内容", 30, "正在处理书签内容...");

      const shareItems = this.processBookmarks(bookmarks, input.options);
      const stats = this.calculateStats(shareItems);

      yield* this.reportProgress("处理内容", 50, "内容处理完成");

      // Step 3: 生成分享包
      yield* this.reportProgress("生成分享包", 55, "正在生成分享格式...");

      const shareId = generateShareId();
      const title = input.title || `分享收藏 (${bookmarks.length} 条)`;
      const content = this.generateContent(
        input.format,
        title,
        input.description,
        shareItems,
        stats,
        input.options,
      );

      yield* this.reportProgress("生成分享包", 75, "分享格式生成完成");

      // Step 4: 完成
      yield* this.reportProgress("完成", 80, "正在完成分享...");

      const expirationDays = input.expirationDays ?? 7;
      const metadata: ShareBundleMetadata = {
        shareId,
        createdBy: context.userId,
        createdAt: new Date().toISOString(),
        expiresAt:
          expirationDays > 0
            ? new Date(
                Date.now() + expirationDays * 24 * 60 * 60 * 1000,
              ).toISOString()
            : undefined,
        viewCount: 0,
        visibility: input.visibility || "private",
        requiresPassword: input.visibility === "password",
      };

      // 构建输出
      const output: ShareBundleOutput = {
        title,
        description: input.description,
        format: input.format,
        shareUrl:
          input.format === "link"
            ? `https://anykeep.app/share/${shareId}`
            : undefined,
        content: input.format !== "link" ? content : undefined,
        filename:
          input.format !== "link"
            ? `anykeep-share-${shareId}${formatConfig.extension}`
            : undefined,
        mimeType: formatConfig.mimeType,
        bookmarks: shareItems,
        stats,
        metadata,
        suggestions: this.generateSuggestions(input, stats),
        generatedAt: new Date().toISOString(),
      };

      yield* this.reportProgress("完成", 95, "分享包生成完成");

      // 输出结果
      yield* this.emitText(`## ${formatConfig.icon} ${title}\n\n`);

      if (input.description) {
        yield* this.emitText(`> ${input.description}\n\n`);
      }

      yield* this.emitText(`### 📊 统计信息\n\n`);
      yield* this.emitText(`- 书签数量: **${stats.totalBookmarks}**\n`);
      yield* this.emitText(
        `- 涉及平台: **${Object.keys(stats.platforms).length}** 个\n`,
      );
      yield* this.emitText(`- 标签数量: **${stats.tags.length}** 个\n\n`);

      if (output.shareUrl) {
        yield* this.emitText(`### 🔗 分享链接\n\n`);
        yield* this.emitText(`[${output.shareUrl}](${output.shareUrl})\n\n`);
        yield* this.emitText(
          `- 可见性: **${this.getVisibilityLabel(input.visibility)}**\n`,
        );
        if (metadata.expiresAt) {
          yield* this.emitText(
            `- 过期时间: **${new Date(metadata.expiresAt).toLocaleDateString("zh-CN")}**\n`,
          );
        } else {
          yield* this.emitText(`- 过期时间: **永不过期**\n`);
        }
        yield* this.emitText("\n");
      }

      // 输出交付物
      // DeliverableType: "report" | "list" | "cards" | "document" | "mindmap" | "graph" | "table"
      // OutputFormat: "markdown" | "html" | "json" | "cards" | "mindmap" | "plain"
      const deliverableFormat: "html" | "markdown" | "json" | "plain" =
        input.format === "link" ? "plain" : input.format;
      const deliverable = this.createDeliverable(
        "document",
        output.title,
        output,
        deliverableFormat,
        {
          downloadable: input.format !== "link",
          shareable: true,
          metadata: {
            shareId,
            format: input.format,
            bookmarkCount: stats.totalBookmarks,
            visibility: input.visibility,
          },
        },
      );

      yield* this.emitDeliverable(deliverable);

      // 输出建议
      if (output.suggestions.length > 0) {
        yield* this.emitSuggestions(
          output.suggestions.map((s, i) => ({
            text: s,
            label: `建议 ${i + 1}`,
            action: "share",
            icon: "💡",
          })),
        );
      }

      yield* this.reportProgress("完成", 100, "分享包生成完成");
      yield* this.emitDone(
        true,
        `已生成${formatConfig.name}，包含 ${stats.totalBookmarks} 条书签`,
      );

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          format: input.format,
          bookmarkCount: stats.totalBookmarks,
          shareId,
          durationMs: Date.now() - startTime,
        },
        "ShareBundleSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "ShareBundleSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "分享包生成失败",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "分享包生成失败");
    }
  }

  /**
   * 获取书签数据
   */
  private async fetchBookmarks(
    userId: string,
    input: ShareBundleInput,
  ): Promise<BookmarkRow[]> {
    const supabase = await createClient();

    let query = supabase
      .from("bookmarks")
      .select(
        `
        id,
        title,
        url,
        platform,
        ai_tags,
        ai_summary,
        user_tags,
        rating,
        created_at
      `,
      )
      .eq("user_id", userId)
      .is("deleted_at", null);

    // 根据范围筛选
    if (input.scope === "bookmarks" && input.bookmarkIds?.length) {
      query = query.in("id", input.bookmarkIds);
    } else if (input.scope === "folder" && input.folderId) {
      query = query.eq("folder_id", input.folderId);
    } else if (input.scope === "tag" && input.tag) {
      query = query.contains("user_tags", [input.tag]);
    }

    query = query.order("created_at", { ascending: false }).limit(100);

    const { data, error } = await query;

    if (error) {
      logger.error({ error }, "ShareBundleSkill: Failed to fetch bookmarks");
      throw new Error(`获取书签失败: ${error.message}`);
    }

    return (data || []) as BookmarkRow[];
  }

  /**
   * 处理书签数据
   */
  private processBookmarks(
    bookmarks: BookmarkRow[],
    options?: ShareBundleInput["options"],
  ): ShareBookmarkItem[] {
    return bookmarks.map((b) => ({
      id: b.id,
      title: b.title,
      url: b.url,
      platform: b.platform,
      summary: options?.includeSummary ? b.ai_summary || undefined : undefined,
      tags: options?.includeTags
        ? [...(b.user_tags || []), ...(b.ai_tags || [])]
        : [],
      rating: options?.includeRating ? b.rating || undefined : undefined,
      note: undefined, // note column no longer exists
      createdAt: b.created_at || new Date().toISOString(),
    }));
  }

  /**
   * 计算统计信息
   */
  private calculateStats(bookmarks: ShareBookmarkItem[]): ShareBundleStats {
    const platforms: Record<string, number> = {};
    const tagsSet = new Set<string>();
    let earliest = bookmarks[0]?.createdAt;
    let latest = bookmarks[0]?.createdAt;

    for (const b of bookmarks) {
      platforms[b.platform] = (platforms[b.platform] || 0) + 1;
      b.tags.forEach((tag) => tagsSet.add(tag));

      if (b.createdAt < earliest) earliest = b.createdAt;
      if (b.createdAt > latest) latest = b.createdAt;
    }

    return {
      totalBookmarks: bookmarks.length,
      platforms,
      tags: Array.from(tagsSet).slice(0, 20),
      dateRange: {
        earliest: earliest || new Date().toISOString(),
        latest: latest || new Date().toISOString(),
      },
    };
  }

  /**
   * 生成分享内容
   */
  private generateContent(
    format: ShareBundleInput["format"],
    title: string,
    description: string | undefined,
    bookmarks: ShareBookmarkItem[],
    stats: ShareBundleStats,
    options?: ShareBundleInput["options"],
  ): string {
    switch (format) {
      case "html":
        return this.generateHtml(title, description, bookmarks, stats, options);
      case "markdown":
        return this.generateMarkdown(title, description, bookmarks, stats);
      case "json":
        return JSON.stringify(
          {
            title,
            description,
            bookmarks,
            stats,
            generatedAt: new Date().toISOString(),
          },
          null,
          2,
        );
      default:
        return "";
    }
  }

  /**
   * 生成 HTML 内容
   */
  private generateHtml(
    title: string,
    description: string | undefined,
    bookmarks: ShareBookmarkItem[],
    stats: ShareBundleStats,
    options?: ShareBundleInput["options"],
  ): string {
    const theme = options?.theme || "auto";
    const themeClass =
      theme === "dark" ? "dark" : theme === "light" ? "light" : "";

    const bookmarkItems = bookmarks
      .map(
        (b) => `
        <div class="bookmark">
          <h3><a href="${this.escapeHtml(b.url)}" target="_blank">${this.escapeHtml(b.title)}</a></h3>
          <div class="meta">
            <span class="platform">${this.escapeHtml(b.platform)}</span>
            <span class="date">${new Date(b.createdAt).toLocaleDateString("zh-CN")}</span>
          </div>
          ${b.summary ? `<p class="summary">${this.escapeHtml(b.summary)}</p>` : ""}
          ${b.tags.length > 0 ? `<div class="tags">${b.tags.map((t) => `<span class="tag">${this.escapeHtml(t)}</span>`).join("")}</div>` : ""}
        </div>
      `,
      )
      .join("\n");

    return `<!DOCTYPE html>
<html lang="zh-CN" class="${themeClass}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
    :root { --bg: #fff; --text: #333; --border: #eee; --accent: #0066cc; }
    .dark { --bg: #1a1a1a; --text: #eee; --border: #333; --accent: #66b3ff; }
    @media (prefers-color-scheme: dark) { :root:not(.light) { --bg: #1a1a1a; --text: #eee; --border: #333; --accent: #66b3ff; } }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .desc { color: #666; margin-bottom: 1.5rem; }
    .stats { display: flex; gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background: var(--border); border-radius: 8px; }
    .stats span { font-size: 0.9rem; }
    .bookmark { padding: 1rem; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1rem; }
    .bookmark h3 { margin: 0 0 0.5rem 0; font-size: 1rem; }
    .bookmark a { color: var(--accent); text-decoration: none; }
    .bookmark a:hover { text-decoration: underline; }
    .meta { font-size: 0.8rem; color: #888; margin-bottom: 0.5rem; }
    .meta span { margin-right: 1rem; }
    .summary { font-size: 0.9rem; color: #666; margin: 0.5rem 0; }
    .tags { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .tag { font-size: 0.75rem; padding: 0.25rem 0.5rem; background: var(--border); border-radius: 4px; }
    footer { text-align: center; margin-top: 2rem; font-size: 0.8rem; color: #888; }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(title)}</h1>
  ${description ? `<p class="desc">${this.escapeHtml(description)}</p>` : ""}
  <div class="stats">
    <span>📚 ${stats.totalBookmarks} 条书签</span>
    <span>🌐 ${Object.keys(stats.platforms).length} 个平台</span>
    <span>🏷️ ${stats.tags.length} 个标签</span>
  </div>
  <div class="bookmarks">
    ${bookmarkItems}
  </div>
  <footer>由 AnyKeep 生成 · ${new Date().toLocaleDateString("zh-CN")}</footer>
</body>
</html>`;
  }

  /**
   * 生成 Markdown 内容
   */
  private generateMarkdown(
    title: string,
    description: string | undefined,
    bookmarks: ShareBookmarkItem[],
    stats: ShareBundleStats,
  ): string {
    const lines: string[] = [
      `# ${title}`,
      "",
      description ? `> ${description}` : "",
      "",
      "## 📊 统计",
      "",
      `- 📚 ${stats.totalBookmarks} 条书签`,
      `- 🌐 ${Object.keys(stats.platforms).length} 个平台`,
      `- 🏷️ ${stats.tags.length} 个标签`,
      "",
      "## 📖 书签列表",
      "",
    ];

    for (const b of bookmarks) {
      lines.push(`### [${b.title}](${b.url})`);
      lines.push("");
      lines.push(
        `- 平台: ${b.platform} | 时间: ${new Date(b.createdAt).toLocaleDateString("zh-CN")}`,
      );
      if (b.summary) {
        lines.push(`- 摘要: ${b.summary}`);
      }
      if (b.tags.length > 0) {
        lines.push(`- 标签: ${b.tags.map((t) => `\`${t}\``).join(" ")}`);
      }
      lines.push("");
    }

    lines.push("---");
    lines.push(`*由 AnyKeep 生成 · ${new Date().toLocaleDateString("zh-CN")}*`);

    return lines.join("\n");
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * 获取可见性标签
   */
  private getVisibilityLabel(visibility?: string): string {
    switch (visibility) {
      case "public":
        return "公开";
      case "password":
        return "密码保护";
      default:
        return "私密";
    }
  }

  /**
   * 生成建议
   */
  private generateSuggestions(
    input: ShareBundleInput,
    stats: ShareBundleStats,
  ): string[] {
    const suggestions: string[] = [];

    if (input.visibility === "public") {
      suggestions.push("公开分享链接可被任何人访问，请确认内容适合公开");
    }

    if (!input.expirationDays || input.expirationDays === 0) {
      suggestions.push("分享链接永不过期，建议定期检查和清理不需要的分享");
    }

    if (stats.totalBookmarks > 50) {
      suggestions.push("书签数量较多，建议分批分享以便阅读");
    }

    if (suggestions.length === 0) {
      suggestions.push("分享链接已生成，可以复制给朋友或发布到社交媒体");
    }

    return suggestions;
  }

  /**
   * 非流式执行
   */
  protected async executeInternal(
    input: ShareBundleInput,
    context: SkillContext,
  ): Promise<ShareBundleOutput> {
    const orchestrationContext: OrchestrationContext = {
      ...context,
      params: input,
    };

    let output: ShareBundleOutput | undefined;

    for await (const chunk of this.executeStream(orchestrationContext)) {
      if (chunk.type === "deliverable") {
        output = chunk.data.content as ShareBundleOutput;
      }
    }

    if (!output) {
      throw new Error("分享包生成失败");
    }

    return output;
  }
}

// ============================================
// 辅助类型
// ============================================

import type { BookmarkRow as BookmarkRowBase } from "@/types/domain";

/**
 * BookmarkRow 扩展（用于分享包查询）
 */
type BookmarkRow = Pick<
  BookmarkRowBase,
  | "id"
  | "title"
  | "url"
  | "platform"
  | "ai_tags"
  | "ai_summary"
  | "user_tags"
  | "rating"
  | "created_at"
>;

// ============================================
// 导出
// ============================================

export const shareBundleSkill = new ShareBundleSkill();
