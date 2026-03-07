/**
 * 内容去噪服务
 *
 * 将 HTML 内容清理为干净的 Markdown 格式文本，
 * 移除导航、广告、推荐、评论等噪音区块。
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import { logger } from "@/lib/logger";
import {
  removeScriptsAndStyles,
  stripHtmlTags,
  decodeHtmlEntities,
} from "@/lib/utils/html-utils";

// ============================================================
// 类型定义
// ============================================================

export interface CleanOptions {
  /** 是否移除导航（默认 true） */
  removeNav?: boolean;
  /** 是否移除广告（默认 true） */
  removeAds?: boolean;
  /** 是否移除推荐区块（默认 true） */
  removeRecommendations?: boolean;
  /** 是否保留文档结构转 Markdown（默认 true） */
  preserveStructure?: boolean;
  /** 最大输出长度（字符数） */
  maxLength?: number;
}

const DEFAULT_OPTIONS: Required<CleanOptions> = {
  removeNav: true,
  removeAds: true,
  removeRecommendations: true,
  preserveStructure: true,
  maxLength: 0, // 0 表示不限制
};

// ============================================================
// 噪音移除规则
// ============================================================

/**
 * 构建匹配指定标签（含属性）的正则
 * 使用非贪婪匹配 + [\s\S] 处理跨行内容
 */
function buildTagPattern(tag: string): RegExp {
  return new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
}

/**
 * 构建匹配 class/id 包含指定关键词的任意标签的正则
 * 匹配形如 <div class="xxx-ad-yyy">...</div> 的区块
 *
 * 为避免灾难性回溯：
 * - 属性匹配部分使用 [^>]* 限制在标签内
 * - 内容部分使用 [\s\S]*? 非贪婪匹配到最近的闭合标签
 */
function buildAttrPattern(keywords: string[]): RegExp {
  // 用 | 连接所有关键词
  const kw = keywords.join("|");
  // 匹配 class 或 id 属性中包含关键词的常见块级标签
  const blockTags = "div|section|aside|article|figure|ul|ol";
  return new RegExp(
    `<(${blockTags})\\b[^>]*(?:class|id)="[^"]*\\b(?:${kw})\\b[^"]*"[^>]*>[\\s\\S]*?<\\/\\1>`,
    "gi",
  );
}

/** 导航相关噪音模式 */
const NAV_PATTERNS: RegExp[] = [
  buildTagPattern("nav"),
  buildAttrPattern([
    "breadcrumb",
    "sidebar",
    "nav-bar",
    "navbar",
    "navigation",
  ]),
];

/** 广告相关噪音模式 */
const AD_PATTERNS: RegExp[] = [
  buildAttrPattern([
    "ad",
    "ads",
    "advert",
    "sponsor",
    "promotion",
    "banner-ad",
  ]),
];

/** 推荐/社交/评论等噪音模式 */
const RECOMMENDATION_PATTERNS: RegExp[] = [
  buildAttrPattern([
    "related",
    "recommend",
    "suggested",
    "share",
    "social",
    "follow",
    "comment",
    "comments",
    "discuss",
    "discussion",
  ]),
  buildTagPattern("footer"),
];

// ============================================================
// HTML → Markdown 转换
// ============================================================

/**
 * 将 HTML 转换为 Markdown 格式
 * 按优先级依次处理各类标签
 */
function htmlToMarkdown(html: string): string {
  let md = html;

  // 1. 代码块：<pre><code>...</code></pre>
  md = md.replace(
    /<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_match, code) => {
      const cleaned = stripHtmlTags(code).trim();
      return `\n\n\`\`\`\n${cleaned}\n\`\`\`\n\n`;
    },
  );

  // 2. 行内代码：<code>...</code>
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_match, code) => {
    const cleaned = stripHtmlTags(code).trim();
    return `\`${cleaned}\``;
  });

  // 3. 标题：h1-h6
  for (let level = 1; level <= 6; level++) {
    const hashes = "#".repeat(level);
    md = md.replace(
      new RegExp(`<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi"),
      (_match, content) => {
        const text = stripHtmlTags(content).trim();
        return `\n\n${hashes} ${text}\n\n`;
      },
    );
  }

  // 4. 引用块：<blockquote>
  md = md.replace(
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_match, content) => {
      const text = stripHtmlTags(content).trim();
      const quoted = text
        .split("\n")
        .map((line: string) => `> ${line}`)
        .join("\n");
      return `\n\n${quoted}\n\n`;
    },
  );

  // 5. 有序列表：<ol>...<li>...</li>...</ol>
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_match, content) => {
    let index = 0;
    const items = content.replace(
      /<li[^>]*>([\s\S]*?)<\/li>/gi,
      (_m: string, item: string) => {
        index++;
        const text = stripHtmlTags(item).trim();
        return `${index}. ${text}\n`;
      },
    );
    return `\n\n${stripHtmlTags(items).trim()}\n\n`;
  });

  // 6. 无序列表：<ul>...<li>...</li>...</ul>
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_match, content) => {
    const items = content.replace(
      /<li[^>]*>([\s\S]*?)<\/li>/gi,
      (_m: string, item: string) => {
        const text = stripHtmlTags(item).trim();
        return `- ${text}\n`;
      },
    );
    return `\n\n${stripHtmlTags(items).trim()}\n\n`;
  });

  // 7. 链接：<a href="url">text</a>
  md = md.replace(
    /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_match, href, text) => {
      const linkText = stripHtmlTags(text).trim();
      if (!linkText || !href) return linkText || "";
      return `[${linkText}](${href})`;
    },
  );

  // 8. 粗体：<strong> / <b>
  md = md.replace(
    /<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi,
    (_match, content) => {
      const text = stripHtmlTags(content).trim();
      return `**${text}**`;
    },
  );

  // 9. 斜体：<em> / <i>
  md = md.replace(
    /<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi,
    (_match, content) => {
      const text = stripHtmlTags(content).trim();
      return `*${text}*`;
    },
  );

  // 10. 段落：<p>
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_match, content) => {
    const text = stripHtmlTags(content).trim();
    return `\n\n${text}\n\n`;
  });

  // 11. 换行：<br> / <br/>
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // 12. 图片：忽略（摘要不需要图片）
  md = md.replace(/<img[^>]*>/gi, "");

  // 13. 表格：提取单元格内容为纯文本行
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_match, content) => {
    const rows: string[] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(content)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(stripHtmlTags(cellMatch[1]).trim());
      }
      if (cells.length > 0) {
        rows.push(cells.join(" | "));
      }
    }
    return `\n\n${rows.join("\n")}\n\n`;
  });

  // 14. 移除剩余的 HTML 标签
  md = stripHtmlTags(md);

  return md;
}

// ============================================================
// ContentCleanerService
// ============================================================

export class ContentCleanerService {
  /**
   * 清理 HTML 内容，返回干净的文本/Markdown
   *
   * @param html - 原始 HTML 字符串
   * @param options - 清理选项
   * @returns 清理后的文本
   */
  clean(html: string, options?: CleanOptions): string {
    if (!html || typeof html !== "string") {
      return "";
    }

    const opts = { ...DEFAULT_OPTIONS, ...options };
    const originalLength = html.length;

    try {
      let result = html;

      // 步骤 1：移除脚本和样式（复用已有工具函数）
      result = removeScriptsAndStyles(result);

      // 步骤 2：按选项移除噪音区块
      if (opts.removeNav) {
        result = this.removeByPatterns(result, NAV_PATTERNS);
      }
      if (opts.removeAds) {
        result = this.removeByPatterns(result, AD_PATTERNS);
      }
      if (opts.removeRecommendations) {
        result = this.removeByPatterns(result, RECOMMENDATION_PATTERNS);
      }

      // 步骤 3：转换为目标格式
      if (opts.preserveStructure) {
        result = htmlToMarkdown(result);
      } else {
        result = stripHtmlTags(result);
      }

      // 步骤 4：解码 HTML 实体
      result = decodeHtmlEntities(result);

      // 步骤 5：清理多余空行（最多保留 2 个连续空行）
      result = this.normalizeWhitespace(result);

      // 步骤 6：按 maxLength 截断
      if (opts.maxLength > 0 && result.length > opts.maxLength) {
        result = result.slice(0, opts.maxLength).trimEnd();
        // 尝试在最后一个完整段落处截断，避免断句
        const lastParagraphEnd = result.lastIndexOf("\n\n");
        if (lastParagraphEnd > opts.maxLength * 0.8) {
          result = result.slice(0, lastParagraphEnd);
        }
        result += "\n\n...";
      }

      logger.debug(
        {
          originalLength,
          cleanedLength: result.length,
          reductionPercent: Math.round(
            (1 - result.length / originalLength) * 100,
          ),
        },
        "内容去噪完成",
      );

      return result;
    } catch (error) {
      logger.error({ error, htmlLength: originalLength }, "内容去噪失败");
      // 降级：返回纯文本
      return stripHtmlTags(removeScriptsAndStyles(html)).trim();
    }
  }

  /**
   * 使用一组正则模式移除匹配的区块
   */
  private removeByPatterns(html: string, patterns: RegExp[]): string {
    let result = html;
    for (const pattern of patterns) {
      // 重置正则的 lastIndex（全局正则复用时需要）
      pattern.lastIndex = 0;
      result = result.replace(pattern, "");
    }
    return result;
  }

  /**
   * 规范化空白字符
   * - 移除行首尾空白
   * - 最多保留 2 个连续空行
   * - 移除首尾空行
   */
  private normalizeWhitespace(text: string): string {
    return (
      text
        // 移除每行首尾的空白（保留换行）
        .replace(/^[^\S\n]+|[^\S\n]+$/gm, "")
        // 将 3 个及以上连续空行压缩为 2 个
        .replace(/\n{4,}/g, "\n\n\n")
        .trim()
    );
  }
}

// ============================================================
// 单例
// ============================================================

let instance: ContentCleanerService | null = null;

/**
 * 获取 ContentCleanerService 单例
 */
export function getContentCleanerService(): ContentCleanerService {
  if (!instance) {
    instance = new ContentCleanerService();
  }
  return instance;
}

/**
 * 重置单例（用于测试）
 */
export function resetContentCleanerService(): void {
  instance = null;
}
