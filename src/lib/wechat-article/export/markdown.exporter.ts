/**
 * 微信文章 Markdown 导出器
 *
 * @module wechat-article/export
 * @description 将微信文章导出为 Markdown 格式
 *
 * Phase 6 升级：导出功能
 */

import type { WechatArticleContent, MediaElement } from "../wechat-article.types";

// =============================================================================
// 类型定义
// =============================================================================

export interface MarkdownExportOptions {
  /** 包含元数据头部（YAML frontmatter） */
  includeMetadata?: boolean;
  /** 包含图片 */
  includeImages?: boolean;
  /** 图片引用格式 */
  imageFormat?: "inline" | "reference";
  /** 包含媒体占位 */
  includeMediaPlaceholders?: boolean;
}

export interface MarkdownExportResult {
  /** Markdown 内容 */
  content: string;
  /** 推荐文件名 */
  filename: string;
}

export interface ArticleMetadata {
  /** 标题 */
  title: string;
  /** 作者 */
  author?: string;
  /** 发布时间 */
  publishTime?: string;
  /** 原始 URL */
  originalUrl: string;
  /** 保存时间 */
  savedAt: string;
}

// =============================================================================
// HTML 转 Markdown（增强版）
// =============================================================================

/**
 * 增强的 HTML 转 Markdown 转换器
 *
 * 基于正则实现，不依赖外部库
 */
export function htmlToMarkdownEnhanced(html: string): string {
  if (!html) return "";

  let md = html;

  // 移除空的 div/section/span
  md = md.replace(/<(div|section|span)[^>]*>\s*<\/\1>/gi, "");

  // 处理标题
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n");
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n");

  // 处理强调
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");
  md = md.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, "<u>$1</u>");
  md = md.replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, "~~$1~~");
  md = md.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, "~~$1~~");

  // 处理链接
  md = md.replace(
    /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    "[$2]($1)",
  );

  // 处理图片
  md = md.replace(
    /<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi,
    "![$2]($1)",
  );
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, "![]($1)");

  // 处理代码
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n");

  // 处理引用块
  md = md.replace(
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_, content) => {
      const lines = content.trim().split("\n");
      return "\n" + lines.map((line: string) => `> ${line.trim()}`).join("\n") + "\n";
    },
  );

  // 处理列表
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<\/?[ou]l[^>]*>/gi, "\n");

  // 处理换行和段落
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n");

  // 处理水平线
  md = md.replace(/<hr[^>]*\/?>/gi, "\n---\n");

  // 处理视频/音频占位（保留文本说明）
  md = md.replace(
    /<div[^>]*class="[^"]*wechat-video-placeholder[^"]*"[^>]*>[\s\S]*?<span[^>]*class="video-title"[^>]*>([^<]*)<\/span>[\s\S]*?<\/div>/gi,
    "\n> 📹 **视频**: $1\n",
  );
  md = md.replace(
    /<div[^>]*class="[^"]*wechat-audio-placeholder[^"]*"[^>]*>[\s\S]*?<span[^>]*class="audio-name"[^>]*>([^<]*)<\/span>[\s\S]*?<\/div>/gi,
    "\n> 🎵 **音频**: $1\n",
  );

  // 移除剩余 HTML 标签
  md = md.replace(/<[^>]+>/g, "");

  // 解码 HTML 实体
  md = decodeHtmlEntities(md);

  // 清理多余空白
  md = md.replace(/\n{3,}/g, "\n\n");
  md = md.replace(/^\s+|\s+$/g, "");

  return md;
}

/**
 * 解码 HTML 实体
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return "";

  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    );
}

// =============================================================================
// 元数据格式化
// =============================================================================

/**
 * 生成 YAML frontmatter
 */
function generateFrontmatter(metadata: ArticleMetadata): string {
  const lines = [
    "---",
    `title: "${escapeYamlString(metadata.title)}"`,
  ];

  if (metadata.author) {
    lines.push(`author: "${escapeYamlString(metadata.author)}"`);
  }

  if (metadata.publishTime) {
    lines.push(`date: "${metadata.publishTime}"`);
  }

  lines.push(`source: "${metadata.originalUrl}"`);
  lines.push(`saved_at: "${metadata.savedAt}"`);
  lines.push("---");
  lines.push("");

  return lines.join("\n");
}

/**
 * 转义 YAML 字符串中的特殊字符
 */
function escapeYamlString(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, " ");
}

// =============================================================================
// 媒体占位生成
// =============================================================================

/**
 * 生成媒体占位 Markdown
 */
function generateMediaMarkdown(media: MediaElement[]): string {
  if (!media || media.length === 0) return "";

  const lines: string[] = ["\n---\n", "## 媒体内容\n"];

  for (const item of media) {
    if (item.type === "video") {
      lines.push(`- 📹 **视频**: ${item.title}`);
      if (item.sourceUrl) {
        lines.push(`  - 链接: ${item.sourceUrl}`);
      }
      if (item.localUrl) {
        lines.push(`  - 本地: ${item.localUrl}`);
      }
    } else if (item.type === "audio") {
      lines.push(`- 🎵 **音频**: ${item.title}`);
      if (item.duration) {
        lines.push(`  - 时长: ${item.duration}`);
      }
      if (item.localUrl) {
        lines.push(`  - 本地: ${item.localUrl}`);
      }
    }
  }

  return lines.join("\n") + "\n";
}

// =============================================================================
// 主导出函数
// =============================================================================

/**
 * 导出微信文章为 Markdown
 */
export function exportToMarkdown(
  content: WechatArticleContent,
  metadata: ArticleMetadata,
  options: MarkdownExportOptions = {},
): MarkdownExportResult {
  const {
    includeMetadata = true,
    includeImages = true,
    includeMediaPlaceholders = true,
  } = options;

  let markdown = "";

  // 1. 添加元数据头部
  if (includeMetadata) {
    markdown += generateFrontmatter(metadata);
  }

  // 2. 添加标题
  markdown += `# ${metadata.title}\n\n`;

  // 3. 添加正文
  // 优先使用已转换的 markdown，否则使用增强转换
  let bodyContent = content.markdown || htmlToMarkdownEnhanced(content.html);

  // 4. 处理图片 URL（替换为持久化 URL）
  if (includeImages && content.images) {
    for (const img of content.images) {
      if (img.persistedUrl) {
        bodyContent = bodyContent.replace(
          new RegExp(escapeRegExp(img.originalUrl), "g"),
          img.persistedUrl,
        );
      }
    }
  }

  markdown += bodyContent;

  // 5. 添加媒体占位
  if (includeMediaPlaceholders && content.media && content.media.length > 0) {
    markdown += generateMediaMarkdown(content.media);
  }

  // 6. 生成安全文件名
  const safeTitle = metadata.title
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 100);
  const filename = `${safeTitle}.md`;

  return { content: markdown, filename };
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
