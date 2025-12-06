/**
 * Smart Content Fetcher
 * 智能内容提取服务，自动选择最佳提取策略
 *
 * 提取策略优先级：
 * 1. Jina Reader（干净 Markdown，推荐）
 * 2. 原生爬虫（HTML 解析，降级方案）
 *
 * @version 1.0.0
 * @since 2025-12-06
 */

import { logger } from "@/lib/logger";
import {
  isJinaReaderEnabled,
  getAISummaryConfig,
} from "@/lib/classification/config/ai-summary-config";
import {
  fetchWithJinaReader,
  cleanMarkdownContent,
  extractTextFromMarkdown,
  shouldUseJinaReader,
  estimateTokenCount,
} from "./jina-reader";
import {
  extractMainContent,
  extractWordCount,
  extractImageCount,
  extractKeyContent,
} from "./content-extractor";
import { stripHtmlTags, decodeHtmlEntities } from "./html-utils";
import { logFetchError } from "./fetch-error-handler";

/**
 * 内容提取结果
 */
export interface ContentFetchResult {
  /** 是否成功 */
  success: boolean;

  /** 提取的内容（Markdown 或纯文本） */
  content: string;

  /** 内容格式 */
  format: "markdown" | "text" | "html";

  /** 提取源 */
  source: "jina" | "native" | "provided";

  /** 字数统计 */
  wordCount: number;

  /** 图片数量 */
  imageCount?: number;

  /** 估算的 Token 数 */
  estimatedTokens: number;

  /** 提取时间（毫秒） */
  fetchTime: number;

  /** 标题（如果提取到） */
  title?: string;

  /** 描述（如果提取到） */
  description?: string;

  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 内容提取选项
 */
export interface ContentFetchOptions {
  /** 超时时间（毫秒） */
  timeout?: number;

  /** 最大内容长度 */
  maxContentLength?: number;

  /** 是否强制使用 Jina Reader（忽略平台检测） */
  forceJina?: boolean;

  /** 是否跳过 Jina Reader（直接使用原生提取） */
  skipJina?: boolean;

  /** 预提供的 HTML 内容（跳过网络请求） */
  providedHtml?: string;

  /** 预提供的纯文本内容 */
  providedText?: string;
}

/**
 * 智能提取网页内容
 *
 * @param url - 网页 URL
 * @param options - 提取选项
 * @returns 提取结果
 *
 * @example
 * ```typescript
 * const result = await smartFetchContent('https://example.com/article');
 * if (result.success) {
 *   // 使用干净的内容
 *   await generateAISummary(result.content);
 * }
 * ```
 */
export async function smartFetchContent(
  url: string,
  options: ContentFetchOptions = {},
): Promise<ContentFetchResult> {
  const startTime = Date.now();
  const config = getAISummaryConfig();

  logger.info(
    {
      url,
      jinaEnabled: isJinaReaderEnabled(),
      options: {
        forceJina: options.forceJina,
        skipJina: options.skipJina,
        hasProvidedHtml: !!options.providedHtml,
        hasProvidedText: !!options.providedText,
      },
      action: "smart_fetch_start",
    },
    "Smart Content Fetcher: Starting",
  );

  // 情况 1: 已提供纯文本内容
  if (options.providedText) {
    const content = options.providedText;
    return {
      success: true,
      content,
      format: "text",
      source: "provided",
      wordCount: content.replace(/\s+/g, "").length,
      estimatedTokens: estimateTokenCount(content),
      fetchTime: Date.now() - startTime,
    };
  }

  // 情况 2: 已提供 HTML 内容
  if (options.providedHtml) {
    return extractFromHtml(
      options.providedHtml,
      startTime,
      config.contentFetcher.maxKeyContentLength,
    );
  }

  // 情况 3: 需要从 URL 获取

  // 决定是否使用 Jina Reader
  const useJina =
    !options.skipJina &&
    isJinaReaderEnabled() &&
    (options.forceJina || shouldUseJinaReader(url));

  if (useJina) {
    // 尝试 Jina Reader
    const jinaResult = await fetchWithJinaReader(url, {
      timeout: options.timeout || config.jinaReaderTimeout,
      maxContentLength: options.maxContentLength,
    });

    if (
      jinaResult.success &&
      jinaResult.content.length > config.contentFetcher.minJinaContentLength
    ) {
      // Jina 成功
      const cleanedContent = cleanMarkdownContent(jinaResult.content);

      return {
        success: true,
        content: cleanedContent,
        format: "markdown",
        source: "jina",
        wordCount: jinaResult.wordCount,
        estimatedTokens: estimateTokenCount(cleanedContent),
        fetchTime: Date.now() - startTime,
        title: jinaResult.title,
        description: jinaResult.description,
      };
    }

    // Jina 失败，降级到原生提取
    logger.info(
      {
        url,
        jinaError: jinaResult.error,
        action: "jina_fallback_to_native",
      },
      "Smart Content Fetcher: Jina failed, falling back to native",
    );
  }

  // 原生 HTTP 提取
  try {
    const html = await fetchHtmlContent(
      url,
      options.timeout || config.contentFetcher.nativeFetchTimeout,
    );
    return extractFromHtml(
      html,
      startTime,
      config.contentFetcher.maxKeyContentLength,
    );
  } catch (error) {
    // 使用统一的错误处理
    const errorResult = logFetchError("smart_fetch", url, error);

    return {
      success: false,
      content: "",
      format: "text",
      source: "native",
      wordCount: 0,
      estimatedTokens: 0,
      fetchTime: Date.now() - startTime,
      error: errorResult.message,
    };
  }
}

/**
 * 从 HTML 提取内容
 *
 * @param html - HTML 内容
 * @param startTime - 开始时间戳
 * @param maxKeyContentLength - 最大关键内容长度
 */
function extractFromHtml(
  html: string,
  startTime: number,
  maxKeyContentLength: number = 5000,
): ContentFetchResult {
  // 提取主要内容区域
  const mainContent = extractMainContent(html);

  // 转换为纯文本
  let text = stripHtmlTags(mainContent);
  text = decodeHtmlEntities(text);

  // 清理空白
  text = text.replace(/\s+/g, " ").trim();

  // 提取关键内容（如果过长）
  const processedContent = extractKeyContent(text, maxKeyContentLength);

  const wordCount = extractWordCount(html);
  const imageCount = extractImageCount(html);

  return {
    success: true,
    content: processedContent,
    format: "text",
    source: "native",
    wordCount,
    imageCount,
    estimatedTokens: estimateTokenCount(processedContent),
    fetchTime: Date.now() - startTime,
  };
}

/**
 * 原生 HTTP 获取 HTML
 */
async function fetchHtmlContent(url: string, timeout: number): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 为 AI 摘要准备内容
 * 将任意格式的内容转换为适合 AI 处理的格式
 */
export function prepareContentForAI(
  result: ContentFetchResult,
  maxTokens: number = 4000,
): string {
  let content = result.content;

  // 如果是 Markdown，转换为纯文本
  if (result.format === "markdown") {
    content = extractTextFromMarkdown(content);
  }

  // 检查 Token 数量
  const estimatedTokens = estimateTokenCount(content);

  // 如果超过限制，截断
  if (estimatedTokens > maxTokens) {
    // 按比例截断
    const ratio = maxTokens / estimatedTokens;
    const targetLength = Math.floor(content.length * ratio * 0.9); // 留 10% 余量
    content = content.substring(0, targetLength);

    // 尝试在句子边界截断
    const lastSentenceEnd = Math.max(
      content.lastIndexOf("。"),
      content.lastIndexOf("！"),
      content.lastIndexOf("？"),
      content.lastIndexOf("."),
    );

    if (lastSentenceEnd > targetLength * 0.8) {
      content = content.substring(0, lastSentenceEnd + 1);
    }

    logger.info(
      {
        originalTokens: estimatedTokens,
        maxTokens,
        truncatedLength: content.length,
        action: "content_truncated_for_ai",
      },
      "Smart Content Fetcher: Content truncated for AI",
    );
  }

  return content;
}
