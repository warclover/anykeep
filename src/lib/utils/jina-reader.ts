/**
 * Jina Reader Service
 * 使用 Jina Reader API 将网页转换为干净的 Markdown 内容
 *
 * 特点：
 * - 自动去除广告、导航栏、侧边栏
 * - 输出 LLM 友好的 Markdown 格式
 * - 免费额度大，适合高频调用
 *
 * API 文档：https://r.jina.ai/
 *
 * @version 1.0.0
 * @since 2025-12-06
 */

import { logger } from "@/lib/logger";

/**
 * Jina Reader 提取结果
 */
export interface JinaReaderResult {
  success: boolean;
  content: string;
  title?: string;
  description?: string;
  wordCount: number;
  source: "jina" | "fallback";
  error?: string;
}

/**
 * Jina Reader 请求选项
 */
export interface JinaReaderOptions {
  /** 超时时间（毫秒），默认 10000 */
  timeout?: number;
  /** 是否返回原始 HTML（默认 false，返回 Markdown） */
  returnHtml?: boolean;
  /** 最大内容长度（字符数），超过将截断 */
  maxContentLength?: number;
}

/**
 * 默认选项
 */
const DEFAULT_OPTIONS: Required<JinaReaderOptions> = {
  timeout: 10000,
  returnHtml: false,
  maxContentLength: 50000, // 约 30k tokens
};

/**
 * 使用 Jina Reader 提取网页内容
 *
 * @param url - 要提取的网页 URL
 * @param options - 提取选项
 * @returns 提取结果
 *
 * @example
 * ```typescript
 * const result = await fetchWithJinaReader('https://example.com/article');
 * if (result.success) {
 *   console.log(result.content); // Markdown 格式内容
 * }
 * ```
 */
export async function fetchWithJinaReader(
  url: string,
  options: JinaReaderOptions = {},
): Promise<JinaReaderResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 构建 Jina Reader URL
  const jinaUrl = `https://r.jina.ai/${url}`;

  logger.info(
    {
      url,
      timeout: opts.timeout,
      action: "jina_reader_start",
    },
    "Jina Reader: Fetching content",
  );

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

    const response = await fetch(jinaUrl, {
      method: "GET",
      headers: {
        Accept: opts.returnHtml ? "text/html" : "text/markdown",
        "User-Agent": "AnyKeep/1.0 (Content Aggregator)",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Jina Reader 响应错误: ${response.status}`);
    }

    let content = await response.text();

    // 提取标题（Markdown 第一行通常是标题）
    let title: string | undefined;
    const titleMatch = content.match(/^#\s+(.+)/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // 提取描述（第一段非标题内容）
    let description: string | undefined;
    const paragraphs = content
      .split("\n\n")
      .filter((p) => p.trim() && !p.startsWith("#"));
    if (paragraphs.length > 0) {
      description = paragraphs[0].trim().substring(0, 200);
    }

    // 截断过长内容
    if (content.length > opts.maxContentLength) {
      content = content.substring(0, opts.maxContentLength);
      // 尝试在句子边界截断
      const lastSentenceEnd = content.lastIndexOf("。");
      if (lastSentenceEnd > opts.maxContentLength * 0.8) {
        content = content.substring(0, lastSentenceEnd + 1);
      }
      logger.info(
        {
          originalLength: content.length,
          truncatedLength: content.length,
          action: "jina_reader_truncated",
        },
        "Jina Reader: Content truncated",
      );
    }

    // 计算字数（中文按字符计算）
    const wordCount = content.replace(/\s+/g, "").length;

    logger.info(
      {
        url,
        wordCount,
        hasTitle: !!title,
        action: "jina_reader_success",
      },
      "Jina Reader: Content fetched successfully",
    );

    return {
      success: true,
      content,
      title,
      description,
      wordCount,
      source: "jina",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logger.warn(
      {
        url,
        error: errorMessage,
        action: "jina_reader_failed",
      },
      "Jina Reader: Fetch failed",
    );

    return {
      success: false,
      content: "",
      wordCount: 0,
      source: "jina",
      error: errorMessage,
    };
  }
}

/**
 * 清理 Markdown 内容
 * 移除不必要的元素，优化 LLM 输入
 */
export function cleanMarkdownContent(content: string): string {
  let cleaned = content;

  // 移除图片标签（保留 alt 文本）
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, alt) =>
    alt ? `[图片: ${alt}]` : "",
  );

  // 移除链接，保留文本
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 移除 HTML 注释
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");

  // 移除多余空行
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // 移除首尾空白
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * 提取 Markdown 中的纯文本
 */
export function extractTextFromMarkdown(markdown: string): string {
  let text = markdown;

  // 移除标题标记
  text = text.replace(/^#+\s+/gm, "");

  // 移除加粗/斜体
  text = text.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");
  text = text.replace(/_{1,2}([^_]+)_{1,2}/g, "$1");

  // 移除代码块
  text = text.replace(/```[\s\S]*?```/g, "[代码块]");

  // 移除行内代码
  text = text.replace(/`([^`]+)`/g, "$1");

  // 移除列表标记
  text = text.replace(/^[\s]*[-*+]\s+/gm, "");
  text = text.replace(/^[\s]*\d+\.\s+/gm, "");

  // 移除引用标记
  text = text.replace(/^>\s+/gm, "");

  // 移除链接
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 移除图片
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");

  return text.trim();
}

/**
 * 判断 URL 是否适合使用 Jina Reader
 *
 * 某些平台可能有更好的专用提取器，或者 Jina 不支持
 */
export function shouldUseJinaReader(url: string): boolean {
  const urlLower = url.toLowerCase();

  // 不适合使用 Jina 的平台（需要登录或特殊处理）
  const unsupportedPatterns = [
    "weixin.qq.com", // 微信公众号（需要特殊处理）
    "mp.weixin.qq.com",
    "bilibili.com", // B站（视频平台）
    "youtube.com",
    "youtu.be",
    "douyin.com", // 抖音
    "xiaohongshu.com", // 小红书（需要登录）
    "zhihu.com/question", // 知乎问答（结构特殊）
  ];

  for (const pattern of unsupportedPatterns) {
    if (urlLower.includes(pattern)) {
      return false;
    }
  }

  // 适合使用 Jina 的平台
  const supportedPatterns = [
    "medium.com",
    "dev.to",
    "hashnode.dev",
    "github.io",
    "gitbook.io",
    "notion.site",
    "substack.com",
    "mirror.xyz",
    "sspai.com",
    "36kr.com",
    "infoq.cn",
    "juejin.cn",
    "segmentfault.com",
  ];

  for (const pattern of supportedPatterns) {
    if (urlLower.includes(pattern)) {
      return true;
    }
  }

  // 默认尝试使用（对于未知网站）
  return true;
}

/**
 * 估算内容的 Token 数量
 * 粗略估算：中文约 1.5 token/字，英文约 0.75 token/词
 */
export function estimateTokenCount(content: string): number {
  // 分离中英文
  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;

  // 粗略估算
  const chineseTokens = Math.ceil(chineseChars * 1.5);
  const englishTokens = Math.ceil(englishWords * 0.75);

  return chineseTokens + englishTokens;
}
